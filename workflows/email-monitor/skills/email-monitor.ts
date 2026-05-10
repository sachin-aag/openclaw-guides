/**
 * Email Monitor skill
 *
 * Connects to a Gmail account via IMAP (using curl), checks for new unread
 * emails, summarizes them, classifies by urgency, and posts digests.
 * Urgent emails trigger immediate alerts in the chat.
 *
 * Invoked by:
 *   - manual:    `npm run scan`
 *   - heartbeat: see gateway.config.yaml (every 5 minutes by default)
 *
 * NOTE: This file uses the OpenClaw Skill SDK shape. If the SDK package
 *       names differ in your installed OpenClaw version, the imports may
 *       need adjustment — see https://docs.openclaw.ai for the current API.
 */

import { defineSkill } from "@openclaw/gateway";

export default defineSkill({
  name: "email-monitor",

  /** What the agent sees as its job, on top of SOUL.md. */
  systemPromptAddendum: `
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
`,

  /** Skill arguments configured in gateway.config.yaml */
  args: {
    digest_dir: { type: "string", default: "workspace/email-digests" },
    log_file: { type: "string", default: "workspace/email-log.md" },
    notify: { type: "string", default: "web" },
  },

  /** Skill body. */
  async run({ tools, notify, args, today }) {
    const timestamp = today.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
    const readableTime = today.toISOString().slice(0, 16).replace("T", " ");

    // 1. Fetch unread emails via IMAP using curl
    const imapHost = process.env.EMAIL_IMAP_HOST || "imap.gmail.com";
    const imapPort = process.env.EMAIL_IMAP_PORT || "993";
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_APP_PASSWORD;

    if (!emailUser || !emailPass) {
      await notify(
        args.notify,
        "Email monitor not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in .env.",
      );
      return;
    }

    // Fetch unread message UIDs
    let uidList: string;
    try {
      uidList = await tools.Bash({
        command: `curl -s --url "imaps://${imapHost}:${imapPort}/INBOX" --user "${emailUser}:${emailPass}" --request "SEARCH UNSEEN"`,
      });
    } catch (err: any) {
      const errorMsg = `[${readableTime}] ❌ IMAP connection failed: ${err.message || "unknown error"}`;
      await appendToLog(tools, args.log_file, errorMsg);
      await notify(args.notify, `Email check failed: ${err.message || "IMAP connection error"}`);
      return;
    }

    // Parse UIDs from SEARCH response
    const uids = parseSearchResponse(uidList);

    if (uids.length === 0) {
      const logMsg = `[${readableTime}] ✓ No new unread emails.`;
      await appendToLog(tools, args.log_file, logMsg);
      await notify(args.notify, "No new unread emails.");
      return;
    }

    // 2. Fetch headers + body snippet for each email (limit to 20 most recent)
    const recentUids = uids.slice(-20);
    const emailData: string[] = [];

    for (const uid of recentUids) {
      try {
        const emailContent = await tools.Bash({
          command: `curl -s --url "imaps://${imapHost}:${imapPort}/INBOX;UID=${uid};SECTION=HEADER.FIELDS (FROM SUBJECT DATE)" --user "${emailUser}:${emailPass}"`,
        });

        // Fetch a body snippet (first 2000 chars of body)
        let bodySnippet = "";
        try {
          bodySnippet = await tools.Bash({
            command: `curl -s --url "imaps://${imapHost}:${imapPort}/INBOX;UID=${uid};SECTION=1" --user "${emailUser}:${emailPass}" | head -c 2000`,
          });
        } catch {
          // Body fetch may fail for some message formats — continue with headers only
        }

        emailData.push(`--- UID ${uid} ---\n${emailContent}\n\nBody snippet:\n${bodySnippet}`);
      } catch {
        emailData.push(`--- UID ${uid} ---\n(failed to fetch)`);
      }
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

    const digest = await tools.llm.generate({
      input: modelInput,
    });

    // 4. Write digest file
    const digestPath = `${args.digest_dir}/${timestamp}.md`;
    await tools.Write({ path: digestPath, content: digest });

    // 5. Log the check
    const logMsg = `[${readableTime}] ✓ Processed ${recentUids.length} emails → ${digestPath}`;
    await appendToLog(tools, args.log_file, logMsg);

    // 6. Check for urgent items and alert
    const hasUrgent = digest.includes("## 🔴 Urgent") && !digest.includes("## 🔴 Urgent\n\n## ");
    if (hasUrgent) {
      // Extract the urgent section for the alert
      const urgentSection = extractSection(digest, "🔴 Urgent");
      await notify(
        args.notify,
        `🔴 Urgent emails detected!\n\n${urgentSection}\n\nFull digest: ${digestPath}`,
      );
    } else {
      await notify(
        args.notify,
        `Email digest saved: ${recentUids.length} emails processed. No urgent items. → ${digestPath}`,
      );
    }
  },
});

// --- helpers ---------------------------------------------------

function parseSearchResponse(response: string): string[] {
  // IMAP SEARCH response format: "* SEARCH 1 2 3 4 5"
  const match = response.match(/\*\s+SEARCH\s+([\d\s]+)/);
  if (!match) return [];
  return match[1].trim().split(/\s+/).filter(Boolean);
}

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "(could not extract section)";
}

async function appendToLog(tools: any, logFile: string, entry: string): Promise<void> {
  const existing = await safeRead(tools, logFile);
  const content = existing
    ? `${existing}\n${entry}\n`
    : `# Email Monitor Log\n\n${entry}\n`;
  await tools.Write({ path: logFile, content });
}

async function safeRead(tools: any, path: string): Promise<string | null> {
  try {
    return await tools.Read({ path });
  } catch {
    return null;
  }
}
