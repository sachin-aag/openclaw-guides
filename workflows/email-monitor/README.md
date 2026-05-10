# Track C · Email Monitor

> An OpenClaw skill that connects to a Gmail inbox via IMAP, checks for new unread emails on a heartbeat, summarizes them, classifies by urgency, and alerts on urgent ones. A real system for taming inbox overload.

## What it does

- Connects to your Gmail via IMAP (using a Gmail App Password).
- On every heartbeat (default: 5 minutes), checks for new unread emails.
- Sends email headers + body snippets to the model for summarization and urgency classification.
- Writes a categorized digest to `workspace/email-digests/<timestamp>.md`.
- Urgent (🔴) emails trigger an immediate alert in the Web UI chat.
- Every check is logged to `workspace/email-log.md` for audit.

## Definition of done (workshop bar)

Configure your Gmail App Password → run `npm run dev` → send yourself a test email → run `npm run scan` → `workspace/email-digests/<timestamp>.md` appears with a categorized summary. If the test email is marked urgent, an alert appears in the Web UI chat.

## Prerequisites

- Node 20+ (`node -v`)
- An API key for one of: Anthropic, OpenAI, Google, Featherless
- A Gmail account with 2FA enabled (for App Password generation)
- ~20 minutes

## Setup

```bash
npm install
cp .env.example .env
# edit .env: pick a provider, paste an API key, configure Gmail credentials
npm run dev
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

First boot calls `openclaw init` under the hood, which scaffolds the canonical
`SOUL.md`, `USER.md`, `MEMORY.md` into `workspace/` from the
[official OpenClaw templates](https://github.com/openclaw/openclaw/tree/main/docs/reference/templates).

Then add this skill's behavior on top:

```bash
cat skill-personality.snippet.md >> workspace/SOUL.md
npm run reload
```

Open `http://localhost:3000`. The agent is now monitoring your inbox.

To trigger a check manually (without waiting for the heartbeat):

```bash
npm run scan
```

Send yourself a test email, wait a few seconds for delivery, then run `npm run scan`. A digest file appears in `workspace/email-digests/`.

## Files in this skill

```
.
├── README.md                          this file
├── package.json                       OpenClaw + Pi pinned deps
├── .env.example                       configuration template
├── gateway.config.yaml                gateway config (heartbeat, channels, skill args)
├── skill-personality.snippet.md       append to SOUL.md after init (skill rules)
├── workspace/
│   ├── README.md                      explains what lives here + Gmail setup
│   ├── email-digests/                 generated digests land here
│   └── email-log.md                   created on first run; check history
│   # SOUL.md, USER.md, MEMORY.md are scaffolded on first run from the
│   # official OpenClaw templates — we don't ship copies, to avoid drift.
└── skills/
    └── email-monitor.ts               the monitoring skill itself
```

## How the monitor works (under the hood)

The skill defined in `skills/email-monitor.ts`:

1. Connects to Gmail IMAP via `curl` with the App Password.
2. Runs `SEARCH UNSEEN` to find unread message UIDs.
3. Fetches headers (From, Subject, Date) and a body snippet for each (up to 20 most recent).
4. Sends all email data to the model with a system prompt requesting:
   - One-sentence summaries
   - Urgency classification (🔴 / 🟡 / 🟢)
   - Action items
5. Writes the digest to `workspace/email-digests/<timestamp>.md`.
6. If any 🔴 urgent emails are found, posts an immediate alert in chat.
7. Appends a log entry to `workspace/email-log.md`.

The heartbeat (automatic checking) is configured in `gateway.config.yaml`:

```yaml
heartbeat:
  interval_minutes: 5
  skill: email-monitor
```

## Where to extend

1. **Filter by sender/label.** Modify the IMAP SEARCH command to only check specific labels or senders (e.g., `SEARCH UNSEEN FROM "boss@company.com"`).
2. **Add Telegram alerts for urgent.** Wire up Telegram via [../../guides/07-channels-messaging.md](../../guides/07-channels-messaging.md) so urgent emails ping your phone.
3. **Auto-categorize with labels.** Extend the skill to suggest Gmail labels based on content (requires Gmail API for write access — IMAP is read-only here).
4. **Multi-account.** Run multiple instances with different `.env` files for personal + work inboxes.
5. **Deploy to a VPS.** Once you trust the workflow, move it somewhere always-on — see [../../guides/04-deploy-vps-hostinger.md](../../guides/04-deploy-vps-hostinger.md).

## Security notes

- **App Passwords bypass 2FA.** Treat them like any secret. Never commit `.env` to git.
- **This skill is read-only.** It fetches and reads emails but never sends, deletes, or modifies them.
- **Email content stays local.** Summaries are stored on disk; full content is only sent to your chosen model provider for summarization.
- **The `.env.example` ships empty credentials.** Fill them in locally; the `.gitignore` should exclude `.env`.

## Troubleshooting

- `IMAP connection failed` → check `EMAIL_USER` and `EMAIL_APP_PASSWORD`. Try: `curl -s --url "imaps://imap.gmail.com:993/INBOX" --user "you@gmail.com:your-app-password" --request "SEARCH UNSEEN"`
- `No new unread emails` but you know there are some → Gmail may have marked them read. Star an email and use `SEARCH FLAGGED` to test.
- Digest is empty or malformed → the model may have struggled with the raw email format. Check `workspace/email-digests/` for the raw output.
- Heartbeat doesn't fire on a laptop → laptops sleep. Use `npm run scan` manually, or deploy to a VPS.
- More problems? → [../../guides/10-troubleshooting.md](../../guides/10-troubleshooting.md).

## Stopping it

```bash
Ctrl-C in the npm run dev terminal
```
