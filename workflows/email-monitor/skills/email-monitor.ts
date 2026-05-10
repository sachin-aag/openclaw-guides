/**
 * Email Monitor skill — standalone version
 *
 * Connects to a Gmail account via IMAP (using ImapFlow), checks for new
 * unread emails, sends them to an LLM for summarization and urgency
 * classification, and writes a digest to `workspace/email-digests/`.
 *
 * Run:
 *   npm run scan
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
`.trim();

// ── helpers ───────────────────────────────────────────────────────

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "(could not extract section)";
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

// ── main ──────────────────────────────────────────────────────────

async function main() {
  const imapHost = process.env.EMAIL_IMAP_HOST || "imap.gmail.com";
  const imapPort = parseInt(process.env.EMAIL_IMAP_PORT || "993", 10);
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_APP_PASSWORD;
  const digestDir = process.env.EMAIL_DIGEST_DIR ?? "workspace/email-digests";
  const logFile = resolve("workspace/email-log.md");

  if (!emailUser || !emailPass) {
    console.error("Email monitor not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in .env.");
    process.exit(1);
  }

  const today = new Date();
  const timestamp = today.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const readableTime = today.toISOString().slice(0, 16).replace("T", " ");

  // Dynamic import — ImapFlow is a CommonJS module
  const { ImapFlow } = await import("imapflow");

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    logger: false,
  });

  try {
    console.log(`Connecting to ${imapHost}:${imapPort}...`);
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    try {
      // 1. Search for unread messages
      const uids = await client.search({ seen: false }, { uid: true });

      if (uids.length === 0) {
        const logMsg = `[${readableTime}] No new unread emails.`;
        appendToLog(logFile, logMsg);
        console.log("No new unread emails.");
        return;
      }

      console.log(`Found ${uids.length} unread email(s). Fetching...`);

      // 2. Fetch headers + body snippet (limit to 20 most recent)
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

        // Extract text from source if available
        let bodySnippet = "";
        if (msg.source) {
          const sourceStr = msg.source.toString("utf-8");
          // Take last portion after headers (rough body extraction)
          const bodyStart = sourceStr.indexOf("\r\n\r\n");
          if (bodyStart > -1) {
            bodySnippet = sourceStr.slice(bodyStart + 4, bodyStart + 2004);
          }
        }

        emailData.push(
          `--- UID ${msg.uid} ---\nFrom: ${from}\nSubject: ${subject}\nDate: ${date}\n\nBody snippet:\n${bodySnippet}`,
        );
        console.log(`  FETCHED UID ${msg.uid}: ${subject}`);
      }

      // 3. Send to model for summarization and classification
      const modelInput = [
        `Current time: ${readableTime}`,
        `Number of unread emails: ${uids.length} (showing ${recentUids.length} most recent)`,
        "",
        "## Raw Email Data",
        "",
        emailData.join("\n\n"),
      ].join("\n");

      console.log("Generating digest...");
      const digest = await generateText(modelInput, SYSTEM_PROMPT);

      // 4. Write digest file
      mkdirSync(resolve(digestDir), { recursive: true });
      const digestPath = resolve(digestDir, `${timestamp}.md`);
      writeFileSync(digestPath, digest, "utf-8");

      // 5. Log the check
      const logMsg = `[${readableTime}] Processed ${recentUids.length} emails -> ${digestPath}`;
      appendToLog(logFile, logMsg);

      // 6. Check for urgent items
      const hasUrgent =
        digest.includes("## 🔴 Urgent") && !digest.includes("## 🔴 Urgent\n\n## ");
      if (hasUrgent) {
        const urgentSection = extractSection(digest, "🔴 Urgent");
        console.log(`\nURGENT emails detected!\n\n${urgentSection}`);
      }

      console.log(
        `\nDigest saved to ${digestPath} (${recentUids.length} emails processed).`,
      );
    } finally {
      lock.release();
    }
  } catch (err: any) {
    const errorMsg = `[${readableTime}] IMAP error: ${err.message || "unknown error"}`;
    appendToLog(logFile, errorMsg);
    console.error(`Email check failed: ${err.message || "IMAP connection error"}`);
    process.exit(1);
  } finally {
    await client.logout().catch(() => {});
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
