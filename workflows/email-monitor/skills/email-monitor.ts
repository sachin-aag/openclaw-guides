/**
 * Email Monitor skill — standalone version
 *
 * Connects to a Gmail account via IMAP (using ImapFlow), checks for new
 * unread emails, sends them to an LLM for summarization and urgency
 * classification, and writes a digest to `workspace/email-digests/`.
 * Optionally also delivers the digest to a Telegram chat.
 *
 * Two entry points share this module:
 *   - npm run scan  → main() below (one-shot, always re-scans)
 *   - npm run bot   → bot.ts (calls runScan() through a mutex)
 */

import "dotenv/config";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { generateText } from "../lib/llm.js";

// ── config ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are running the email-monitor skill.
You will receive raw email data (headers + body snippets) from an IMAP fetch.
Your job:

1. Parse each email: extract From, Subject, Date, and a brief body snippet.
2. Summarize each email in one sentence.
3. Classify urgency:
   - 🔴 Urgent: requires action today, time-sensitive, from important senders
   - 🟡 Review: worth reading soon but not time-critical
   - 🟢 Low: newsletters, notifications, FYI-only
4. Extract action items (if any) as bullet points.

Output format (markdown):

  # Email Digest — <YYYY-MM-DD HH:MM>

  ## 🔴 Urgent
  - **<Subject>** from <sender> — <one-sentence summary>
    - Action: <what to do>

  ## 🟡 Review
  - **<Subject>** from <sender> — <one-sentence summary>

  ## 🟢 Low Priority
  - **<Subject>** from <sender> — <one-sentence summary>

  ## Summary
  - <N> new emails: <X> urgent, <Y> review, <Z> low
  - Key action items: <bulleted list>

Rules:
- Never include full email bodies in the digest — summaries only.
- Classify urgency conservatively. When in doubt, use 🟡 not 🔴.
- Always include sender and subject.
- If a category has no items, write a single bullet "- (none)" under the
  header. Do NOT write prose like "No urgent emails in this batch" or leave
  the section blank — downstream code looks for bullet rows.
`.trim();

// ── helpers ───────────────────────────────────────────────────────

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}

/**
 * Returns true iff the digest's 🔴 Urgent section contains at least one
 * real bullet line that isn't the "(none)" placeholder. Used by:
 *  - the CLI to decide whether to print "URGENT emails detected!"
 *  - the bot's cron to decide whether to push (alerts-only mode)
 *
 * The model sometimes improvises prose like "*No urgent in this batch.*"
 * under the header; that's treated as empty.
 */
export function hasUrgentSection(digest: string): boolean {
  const section = extractSection(digest, "🔴 Urgent");
  if (!section) return false;
  const hasRealBullet = /^\s*-\s+\S/m.test(section);
  const isJustNonePlaceholder = /^\s*-\s+\(?none\)?\s*$/im.test(section);
  return hasRealBullet && !isJustNonePlaceholder;
}

function appendToLog(logPath: string, entry: string): void {
  let content: string;
  if (existsSync(logPath)) {
    const existing = readFileSync(logPath, "utf-8");
    content = `${existing}\n${entry}\n`;
  } else {
    content = `# Email Monitor Log\n\n${entry}\n`;
  }
  writeFileSync(logPath, content, "utf-8");
}

// ── Telegram delivery ─────────────────────────────────────────────

// Telegram caps each message at 4096 chars. Split on paragraph
// boundaries so headings and bullets stay readable.
const TELEGRAM_MAX_CHARS = 3800;

function chunkForTelegram(text: string, max = TELEGRAM_MAX_CHARS): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > max && buf) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export async function sendToTelegram(
  message: string,
  dateLabel: string,
  opts: { token?: string; chatId?: string } = {},
): Promise<{ delivered: boolean; reason?: string }> {
  const token = (opts.token ?? process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (opts.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "").trim();

  if (!token || !chatId) {
    return { delivered: false, reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const chunks = chunkForTelegram(message);

  for (let i = 0; i < chunks.length; i++) {
    const prefix =
      chunks.length > 1 ? `[${i + 1}/${chunks.length}] Email digest ${dateLabel}\n\n` : "";
    const body = prefix + chunks[i];

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Telegram sendMessage failed (${res.status}): ${errText}`);
    }
  }

  return { delivered: true };
}

// ── core: runScan ─────────────────────────────────────────────────

export interface RunScanOptions {
  /**
   * Override the outbound Telegram delivery target. Behaviour:
   *   - { chatId } → always send the digest to that chat (or "no new
   *                  emails" notice). Used by the explicit /scan command.
   *   - null       → no delivery
   *   - undefined  → cron-style: send the env-default chat ONLY when
   *                  the digest contains 🔴 Urgent items. Quiet runs
   *                  (no new emails, or no urgent items) stay quiet.
   */
  deliverTo?: { chatId: string } | null;
  /** Override stdout logging. Defaults to console.log. */
  log?: (msg: string) => void;
}

export interface RunScanResult {
  timestamp: string;
  emailsProcessed: number;
  digest: string | null;
  digestPath: string | null;
  hasUrgent: boolean;
  telegram: { delivered: boolean; reason?: string };
}

export async function runScan(opts: RunScanOptions = {}): Promise<RunScanResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const imapHost = process.env.EMAIL_IMAP_HOST || "imap.gmail.com";
  const imapPort = parseInt(process.env.EMAIL_IMAP_PORT || "993", 10);
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_APP_PASSWORD;
  const digestDir = process.env.EMAIL_DIGEST_DIR ?? "workspace/email-digests";
  const logFile = resolve("workspace/email-log.md");

  if (!emailUser || !emailPass) {
    throw new Error(
      "Email monitor not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in .env.",
    );
  }

  const today = new Date();
  const timestamp = today.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const readableTime = today.toISOString().slice(0, 16).replace("T", " ");

  // Dynamic import — ImapFlow is a CommonJS module.
  const { ImapFlow } = await import("imapflow");

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: { user: emailUser, pass: emailPass },
    logger: false,
  });

  try {
    log(`Connecting to ${imapHost}:${imapPort}...`);
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ seen: false }, { uid: true });

      if (uids.length === 0) {
        appendToLog(logFile, `[${readableTime}] No new unread emails.`);
        log("No new unread emails.");
        const tg = await deliver(null, readableTime, false, opts);
        return {
          timestamp: readableTime,
          emailsProcessed: 0,
          digest: null,
          digestPath: null,
          hasUrgent: false,
          telegram: tg,
        };
      }

      log(`Found ${uids.length} unread email(s). Fetching...`);

      // Fetch headers + body snippet (limit to 20 most recent).
      const recentUids = uids.slice(-20);
      const emailData: string[] = [];

      for await (const msg of client.fetch(recentUids, {
        uid: true,
        envelope: true,
        bodyStructure: true,
        source: { maxBytes: 4096 },
      })) {
        const envelope = msg.envelope;
        const from = envelope.from?.[0]
          ? `${envelope.from[0].name || ""} <${envelope.from[0].address}>`
          : "(unknown)";
        const subject = envelope.subject || "(no subject)";
        const date = envelope.date?.toISOString() || "(no date)";

        let bodySnippet = "";
        if (msg.source) {
          const sourceStr = msg.source.toString("utf-8");
          const bodyStart = sourceStr.indexOf("\r\n\r\n");
          if (bodyStart > -1) {
            bodySnippet = sourceStr.slice(bodyStart + 4, bodyStart + 2004);
          }
        }

        emailData.push(
          `--- UID ${msg.uid} ---\nFrom: ${from}\nSubject: ${subject}\nDate: ${date}\n\nBody snippet:\n${bodySnippet}`,
        );
        log(`  FETCHED UID ${msg.uid}: ${subject}`);
      }

      const modelInput = [
        `Current time: ${readableTime}`,
        `Number of unread emails: ${uids.length} (showing ${recentUids.length} most recent)`,
        "",
        "## Raw Email Data",
        "",
        emailData.join("\n\n"),
      ].join("\n");

      log("Generating digest...");
      const digest = await generateText(modelInput, SYSTEM_PROMPT);

      mkdirSync(resolve(digestDir), { recursive: true });
      const digestPath = resolve(digestDir, `${timestamp}.md`);
      writeFileSync(digestPath, digest, "utf-8");

      appendToLog(
        logFile,
        `[${readableTime}] Processed ${recentUids.length} emails -> ${digestPath}`,
      );

      const hasUrgent = hasUrgentSection(digest);
      if (hasUrgent) {
        const urgentSection = extractSection(digest, "🔴 Urgent");
        log(`\nURGENT emails detected!\n\n${urgentSection}`);
      }

      log(`\nDigest saved to ${digestPath} (${recentUids.length} emails processed).`);

      const tg = await deliver(digest, readableTime, hasUrgent, opts);

      return {
        timestamp: readableTime,
        emailsProcessed: recentUids.length,
        digest,
        digestPath,
        hasUrgent,
        telegram: tg,
      };
    } finally {
      lock.release();
    }
  } catch (err: any) {
    appendToLog(logFile, `[${readableTime}] IMAP error: ${err.message || "unknown error"}`);
    throw err;
  } finally {
    await client.logout().catch(() => {});
  }
}

async function deliver(
  digest: string | null,
  dateLabel: string,
  hasUrgent: boolean,
  opts: RunScanOptions,
): Promise<{ delivered: boolean; reason?: string }> {
  if (opts.deliverTo === null) return { delivered: false, reason: "delivery disabled by caller" };

  // Cron-style default: only push to env chat when there are urgent items.
  // No-new-mail and no-urgent-this-batch runs stay quiet.
  if (opts.deliverTo === undefined) {
    if (!digest || !hasUrgent) {
      return { delivered: false, reason: "no urgent items to push" };
    }
    try {
      return await sendToTelegram(digest, dateLabel);
    } catch (err: any) {
      return { delivered: false, reason: err.message ?? String(err) };
    }
  }

  // Explicit caller (a /scan command): tell the user what happened, even
  // if there were no new emails.
  const message = digest ?? `No new unread emails as of ${dateLabel}.`;
  try {
    return await sendToTelegram(message, dateLabel, { chatId: opts.deliverTo.chatId });
  } catch (err: any) {
    return { delivered: false, reason: err.message ?? String(err) };
  }
}

// ── CLI entry point ───────────────────────────────────────────────

async function main() {
  // CLI semantics: the user explicitly invoked `npm run scan`, so always
  // push the digest (or "no new emails") to TELEGRAM_CHAT_ID if set.
  // Cron-mode (alerts-only) is reserved for the bot's recurring scan.
  const envChatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  const result = await runScan({
    deliverTo: envChatId ? { chatId: envChatId } : null,
  });

  if (result.telegram.delivered) {
    console.log("Telegram: delivered.");
  } else if (!envChatId) {
    console.log("Telegram: skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).");
  } else if (result.telegram.reason) {
    console.log(`Telegram: ${result.telegram.reason}`);
  }
}

const isCli =
  process.argv[1] &&
  (process.argv[1].endsWith("email-monitor.ts") || process.argv[1].endsWith("email-monitor.js"));

if (isCli) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
