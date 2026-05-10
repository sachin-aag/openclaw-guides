# Track C · Email Monitor

> A standalone skill that connects to a Gmail inbox via IMAP, checks for new unread emails, summarizes them with an LLM, classifies by urgency, and saves digests as markdown. A real system for taming inbox overload.

## What it does

- Connects to your Gmail via IMAP (using a Gmail App Password).
- Checks for new unread emails.
- Sends email headers + body snippets to the LLM for summarization and urgency classification.
- Writes a categorized digest to `workspace/email-digests/<timestamp>.md`.
- Urgent (🔴) emails are highlighted in the console output.
- Every check is logged to `workspace/email-log.md` for audit.

## Definition of done (workshop bar)

Configure your Gmail App Password → send yourself a test email → run `npm run scan` → `workspace/email-digests/<timestamp>.md` appears with a categorized summary.

## Prerequisites

- Node 20+ (`node -v`)
- An API key for one of: Anthropic, OpenAI, Google, Featherless
- A Gmail account with 2FA enabled (for App Password generation)

## Setup

```bash
npm install
cp .env.example .env
# edit .env: pick a provider, paste an API key, configure Gmail credentials
```

### Gmail App Password

You need an App Password (not your regular Gmail password):

1. **Enable 2FA** on your Google account: https://myaccount.google.com/security
2. **Create an App Password**: https://myaccount.google.com/apppasswords
   - App: "Mail"
   - Device: "Other (Custom name)" → type "OpenClaw"
3. **Copy the 16-character password** into `.env` as `EMAIL_APP_PASSWORD`
4. **Set `EMAIL_USER`** to your full Gmail address

### First run

Send yourself a test email, wait a few seconds for delivery, then:

```bash
npm run scan
```

A digest file appears in `workspace/email-digests/`.

## Files in this project

```
.
├── README.md                          this file
├── package.json                       project deps (tsx, LLM SDKs, imapflow)
├── .env.example                       configuration template
├── gateway.config.yaml                reference config for future OpenClaw integration
├── skill-personality.snippet.md       personality rules (documentation)
├── lib/
│   └── llm.ts                         multi-provider LLM abstraction
├── workspace/
│   ├── README.md                      explains what lives here + Gmail setup
│   ├── email-digests/                 generated digests land here
│   └── email-log.md                   created on first run; check history
└── skills/
    └── email-monitor.ts               the monitoring script
```

## How the monitor works (under the hood)

The script in `skills/email-monitor.ts`:

1. Connects to Gmail IMAP using the `imapflow` library with the App Password.
2. Searches for unread messages in the INBOX.
3. Fetches envelope data (From, Subject, Date) and a body snippet for each (up to 20 most recent).
4. Sends all email data to the LLM with a system prompt requesting:
   - One-sentence summaries
   - Urgency classification (🔴 / 🟡 / 🟢)
   - Action items
5. Writes the digest to `workspace/email-digests/<timestamp>.md`.
6. If any 🔴 urgent emails are found, highlights them in console output.
7. Appends a log entry to `workspace/email-log.md`.

## Supported providers

| Provider | Env var | Model example |
|----------|---------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Google | `GOOGLE_API_KEY` | `gemini-1.5-flash` |
| Featherless | `FEATHERLESS_API_KEY` | `meta-llama/Meta-Llama-3.1-8B-Instruct` |

Set `OPENCLAW_PROVIDER` and `OPENCLAW_MODEL` in `.env` to choose.

## Where to extend

1. **Filter by sender/label.** Modify the IMAP search query to only check specific labels or senders.
2. **Schedule it.** Use cron on a VPS or your laptop to run `npm run scan` on an interval.
3. **Auto-categorize with labels.** Extend the script to suggest Gmail labels based on content (requires Gmail API for write access — IMAP is read-only here).
4. **Multi-account.** Run multiple instances with different `.env` files for personal + work inboxes.
5. **OpenClaw integration.** When OpenClaw is available on npm, the `gateway.config.yaml` file documents how this skill plugs in — with heartbeat, channels, and Telegram notifications.

## Security notes

- **App Passwords bypass 2FA.** Treat them like any secret. Never commit `.env` to git.
- **This skill is read-only.** It fetches and reads emails but never sends, deletes, or modifies them.
- **Email content stays local.** Summaries are stored on disk; full content is only sent to your chosen model provider for summarization.
- **The `.env.example` ships empty credentials.** Fill them in locally; the `.gitignore` should exclude `.env`.

## Troubleshooting

- `IMAP error` → check `EMAIL_USER` and `EMAIL_APP_PASSWORD` in `.env`.
- `No new unread emails` but you know there are some → Gmail may have marked them read. Star an email or send a new one.
- Digest is empty or malformed → the model may have struggled with the raw email format. Check `workspace/email-digests/` for the raw output.
- LLM error → verify your API key is set and the provider/model are correct.
