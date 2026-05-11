# Track C · Email Monitor

> A standalone skill that connects to a Gmail inbox via IMAP, checks for new unread emails, summarizes them with an LLM, classifies by urgency, and saves digests as markdown. A real system for taming inbox overload.

## What it does

- Connects to your Gmail via IMAP (using a Gmail App Password).
- Checks for new unread emails.
- Sends email headers + body snippets to the LLM for summarization and urgency classification.
- Writes a categorized digest to `workspace/email-digests/<timestamp>.md`.
- Urgent (🔴) emails are highlighted in the console output.
- Every check is logged to `workspace/email-log.md` for audit.

> **Read-only by design.** This skill connects via **IMAP only** — it can fetch and read messages but cannot send, reply, delete, archive, label, or modify anything in your account. It also doesn't mark emails as read; Gmail does that when *you* open them in the UI. There is no SMTP code path anywhere in this project. Read [Security & permissions](#security--permissions) before you create the App Password.

## Definition of done (workshop bar)

Configure your Gmail App Password → send yourself a test email → run `npm run scan` → `workspace/email-digests/<timestamp>.md` appears with a categorized summary.

## Prerequisites

- Node 20+ (`node -v`)
- An API key for one of: Anthropic, OpenAI, Google, Featherless
- A Gmail account with 2FA enabled (for App Password generation)

## Setup

The setup is in two steps. **Step 1** gives you a working email digest as a markdown file — that's the workshop's success criterion. **Step 2** is optional: also receive the digest on Telegram so it lands on your phone.

### Step 1 — get a digest as a markdown file

```bash
npm install
cp .env.example .env
# edit .env: pick a provider, paste an API key, configure Gmail credentials
```

#### Gmail App Password

You need an App Password (not your regular Gmail password):

1. **Enable 2FA** on your Google account: https://myaccount.google.com/security
2. **Create an App Password**: https://myaccount.google.com/apppasswords
   - App: "Mail"
   - Device: "Other (Custom name)" → type "OpenClaw"
3. **Copy the 16-character password** into `.env` as `EMAIL_APP_PASSWORD`
4. **Set `EMAIL_USER`** to your full Gmail address

Heads-up before you paste it: this credential **does** grant full mailbox access — read **and** send via Google's IMAP/SMTP servers. *This script* is read-only (it speaks IMAP only and has no SMTP code path), but the App Password itself isn't scoped to "read-only", so anyone who steals it from your `.env` could send mail as you. That's why `.env` is gitignored and why you should revoke the password at https://myaccount.google.com/apppasswords the moment you're done with the workshop or suspect leakage. See [Security & permissions](#security--permissions) for the full picture.

#### First run

Send yourself a test email, wait a few seconds for delivery, then:

```bash
npm run scan
```

A digest file appears in `workspace/email-digests/`. If you stop here, you've hit the workshop bar.

### Step 2 — get digests on Telegram (optional)

Once Step 1 is working, you can have the same digest pushed to a Telegram chat every time you run `npm run scan`. The markdown file is still written to disk — Telegram is an additional delivery channel, not a replacement.

#### 2a. Create a Telegram bot

In the Telegram app, open a chat with [@BotFather](https://t.me/botfather) and send:

```
/newbot
```

BotFather will ask for:

- **A name** for your bot (anything, e.g. `My Email Monitor`).
- **A username** (must end in `bot`, e.g. `my_email_monitor_bot`).

BotFather's reply contains three things you'll need:

- **The HTTP API token**, which looks like `1234567890:AAH...rest-of-token...` — copy this somewhere safe. **Treat the token like a password** — anyone who has it can send messages as your bot.
- **A `t.me/<your_bot_username>` link** — click it to open a chat with your new bot. (No need to search by username.)
- **A link to BotSettings** — ignore for now.

Click the `t.me/...` link. A chat with your bot opens. Press the blue **Start** button at the bottom — this sends `/start` to the bot. The bot won't reply yet (we haven't run any bot code), but Telegram now has the chat on record, which matters for step 2b.

#### 2b. Find your chat ID

The bot needs to know *which* chat to send the digest to. For a personal bot — you talking to your own bot — your "chat ID" is just your numeric Telegram user ID. The fastest way:

1. In Telegram, open a chat with [@userinfobot](https://t.me/userinfobot) and press **Start**.
2. It replies with a block that includes `Id: 42718903`. That number is your `TELEGRAM_CHAT_ID`.

That's it. No need to call any HTTP endpoint.

<details>
<summary>Alternative: <code>getUpdates</code> (use this for group chats, or if @userinfobot is offline)</summary>

For a **group** chat, you need the group's chat ID (negative number) instead of your user ID. To get it:

1. Add your bot to the group, or open the chat with your bot if it's a direct chat.
2. Send the bot any message (e.g. `hi`). This message is what `getUpdates` will return.
3. Open this URL in your browser, replacing `<TOKEN>` with the token from step 2a:

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

4. In the JSON response, look for `"chat":{"id":...}`. For direct messages it'll be your user ID; for groups it'll be a negative number. That's your `TELEGRAM_CHAT_ID`.

If the response is `{"ok":true,"result":[]}` — empty — the bot has no pending messages. Common causes: you haven't sent the bot a message yet (pressing the **Start** button counts, but only the *first* time), or `getUpdates` was already called by another process and consumed them. Send a fresh message to the bot and refresh the URL.

</details>

#### 2c. Wire it into `.env`

Add the two values to your `.env`. They're independent — the token identifies *the bot* (issued by BotFather), the chat ID identifies *the recipient* (your own Telegram account, from @userinfobot):

```bash
TELEGRAM_BOT_TOKEN=8123456789:AAH-some-long-secret-string-here
TELEGRAM_CHAT_ID=42718903
```

#### 2d. Test it

```bash
npm run scan
```

You should see a new line at the end of the script's output:

```
Telegram: delivered.
```

Open Telegram — the digest is in your chat. If it's longer than ~3,800 characters, the script will split it into multiple messages, each prefixed with `[1/N] Email digest <timestamp>`.

If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is missing or empty, the Telegram step is silently skipped and you just get the file. Telegram failures (bad token, network error) are logged but don't fail the script — the file write is the source of truth.

### Step 3 — make it interactive (optional, after Steps 1 + 2)

Step 2 is one-way: you run `npm run scan`, you receive a message. **Step 3** flips that around — a long-running bot you can talk to from Telegram (`/scan` runs one on demand, `/latest` re-sends the most recent digest, `/ask` answers questions about your inbox over the last week) and that re-scans automatically on a schedule. This is the "always-on agent" experience that the OpenClaw gateway gives you for free; here we build it by hand to show the moving parts.

The bot behaves differently from the news briefing bot in two important ways:

- **Cron pushes are urgent-only.** A scheduled re-scan that finds no new mail (or only 🟡/🟢 items) writes the digest to disk and stays silent. Your phone doesn't buzz for newsletters and notifications. (The news briefing pushes the digest unconditionally because it *is* the content; here, a 🔴 urgent email is the actionable signal and a quiet inbox is non-news.)
- **Re-scan interval is configurable in minutes**, not a fixed hour-of-day. Inboxes update throughout the day; once-a-day is too coarse.

> **Heads-up.** This step starts a long-running process that holds your model API key, your Gmail App Password, and accepts inbound messages from Telegram. It stays up until you `Ctrl-C` it. Read the safety paragraph at 3h before you start it.

#### 3a. Reuse your Telegram user ID from Step 2b

The bot needs an allow-list of users it will accept commands from. Without one, anyone who guesses your bot's username could run `/scan` and bill your account.

For a personal bot you're the only allowed user, so the allow-list is the same number you already put in `TELEGRAM_CHAT_ID` from Step 2b. (If you skipped that and want to find it now: message [@userinfobot](https://t.me/userinfobot), press Start, copy the `Id:` number.)

#### 3b. Add three more env vars

Add these to your `.env` (leave the Step 2 vars in place — the bot uses both):

```bash
TELEGRAM_ALLOWED_USER_IDS=42718903       # default: same as TELEGRAM_CHAT_ID. Comma-separate to allow more users.
EMAIL_SCAN_INTERVAL_MINUTES=30           # how often the cron re-scans. Minimum 5. Leave empty to disable the cron.
ASK_DAILY_LIMIT=20                       # per-user cap on /ask calls per day. Default 20.
```

`TELEGRAM_ALLOWED_USER_IDS` is **required** — the bot refuses to start without it. `EMAIL_SCAN_INTERVAL_MINUTES` is optional; if you leave it empty, the bot only acts on commands and never re-scans on its own. `ASK_DAILY_LIMIT` is optional too (default 20) but worth thinking about — every `/ask` is a full LLM call against the last week of digests, so a chatty user can run up cost faster than `/scan` can.

#### 3c. Run the bot

```bash
npm run bot
```

You should see something like:

```
[bot] @my_email_monitor_bot ready.
[bot] allow-list: [42718903]
[bot] cron: every 30 minute(s), urgent-only push to env chat
[bot] /scan on demand.
```

Now open the chat with your bot and send `/scan`. The bot replies "Scanning your inbox..." and a few seconds later sends the digest. Each `/scan` always re-fetches from IMAP — your inbox is the source of truth, so a stale cached digest would be a worse answer than a fresh one. If you tap `/scan` again while a scan is still in flight, the second tap gets "already running, hold tight" rather than double-billing the LLM (that's the in-process mutex doing its job).

#### 3d. The command surface

| You send | Bot does |
|---|---|
| `/scan` | Runs a fresh IMAP scan and sends the full digest to your chat. If a scan is already in flight (cron or another `/scan`), replies "already running, hold tight." |
| `/latest` | Re-sends the most recent digest from `workspace/email-digests/` without touching IMAP or the LLM. Useful for re-reading what you got earlier. |
| `/ask <question>` | Answers the question using digests from the last 7 days as context. See Step 3f. |
| `/reset` | Clears your `/ask` conversation memory (does **not** reset your daily quota). |
| `/help` | Shows the command list. |
| `/start` | Greets you. |
| anything else (no leading slash, or unknown command) | Replies with the same text as `/help`. **No LLM call.** |
| anything from a non-allow-listed user | Replies `"Not authorized."` and logs once. |

Only `/scan` and `/ask` reach the LLM. `/latest` is a file read. Bare text never reaches the model. That's the cost-amplification guardrail — the bot is a CLI over Telegram, not a chatbot.

#### 3e. Cron behaviour (urgent-only)

When the recurring scan fires, the bot pushes to Telegram **only if the digest contains 🔴 Urgent items**. A run where the inbox is empty, or where everything is 🟡 Review / 🟢 Low Priority, writes the digest to disk and exits silently — your phone doesn't buzz. This is the opposite of the news briefing, where the cron always pushes a digest, because urgent emails are signals you actually want to act on, not a daily ritual.

If you want a regular "what's in there" ping anyway, just send `/scan` whenever you feel like it. Or `/latest` to re-read what the cron silently saved.

#### 3f. `/ask` — questions about your recent inbox

`/ask` lets you interrogate the last week of digests without scrolling. It's deliberately small in scope:

- **Context window: the last 7 days of digest files** in `workspace/email-digests/`. The bot reads every digest written in the last week (filtered by file mtime) and gives them to the model as context. Nothing else — no live IMAP read, no web search, no outside knowledge of senders. If the answer isn't in the digests, the bot says so.
- **Multi-turn memory with periodic compaction.** Recent (question, answer) turns are kept verbatim so follow-ups ("what about the second one?") work cleanly. When the buffer reaches `ASK_COMPACT_EVERY` turns (default 5) *or* the memory grows past `ASK_COMPACT_AT_CHARS` characters (default 6000), a single LLM call folds it into a short running summary (≤200 words) and the buffer is cleared. So most turns cost 1 LLM call; every Nth turn (or any turn that produces a wall of text) costs 2.
- **Per-user daily limit.** Default 20 `/ask` calls per user per day. Resets at local midnight. Override with `ASK_DAILY_LIMIT=N`. Compaction calls don't count against your quota.
- **`/reset` clears memory but not the counter.**

Example:

```
You:  /ask did anything urgent come in from my bank this week?
Bot:  Yes — one 🔴 item: "Card ending 4421: unusual sign-in" from
      alerts@yourbank.com on 2026-05-09 (2026-05-09 08:32). Action item
      noted: review recent sign-ins.
You:  what about github?
Bot:  Two GitHub items in the last 7 days, both 🟢 Low Priority — a
      weekly digest (2026-05-08 09:00) and a release notification for
      one of your starred repos (2026-05-10 14:15). No urgent.
You:  /reset
Bot:  Conversation memory cleared.
```

If you haven't run `/scan` (or `npm run scan`) at least once in the last 7 days, `/ask` replies `"No email digests from the last 7 days. Run /scan first."`

#### 3g. Stopping the bot

`Ctrl-C` once. The cron stops, the long-poll loop closes, in-flight scans complete (the IMAP connection closes cleanly). Restart with `npm run bot` — the bot drains pending updates, so you don't get a flood of replays.

#### 3h. Safety paragraph (read this)

- **Allow-list is mandatory.** The bot refuses to start without `TELEGRAM_ALLOWED_USER_IDS`. Don't disable that check.
- **Interval floor is 5 minutes.** The bot refuses to start with `EMAIL_SCAN_INTERVAL_MINUTES` below that. Lower values bill the LLM faster than your inbox actually changes, and Gmail will rate-limit IMAP if you hammer it.
- **Read-only IMAP.** The skill never sends, deletes, or modifies emails. It only fetches headers and a body snippet. The "unread" flag isn't touched either — Gmail marks messages read when *you* open them, not when IMAP fetches them.
- **Laptop sleep.** The cron only fires while the process is running. If your laptop sleeps, no scans happen until it wakes. For a real always-on setup, run on a VPS — see [03-deploy-vps-hostinger.md](../../guides/howto/03-deploy-vps-hostinger.md).
- **Mutex, not a queue.** If a cron tick arrives while a `/scan` is in flight (or vice versa), the new request is rejected with "already running" rather than queued. Same-second double-clicks won't double-bill you.
- **Token, App Password, and allow-list go in `.env`.** That file is gitignored. Don't commit it. If you suspect the bot token leaked, regenerate via `@BotFather` → `/revoke`. If you suspect the Gmail App Password leaked, revoke it at https://myaccount.google.com/apppasswords and create a new one.

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
    ├── email-monitor.ts               the scan core (exports runScan) + CLI for `npm run scan`
    ├── ask.ts                         /ask Q&A grounded on the last 7 days of digests (Step 3f)
    └── bot.ts                         long-running Telegram bot + recurring cron (Step 3, `npm run bot`)
```

## How the monitor works (under the hood)

The exported `runScan()` in `skills/email-monitor.ts`:

1. Connects to Gmail IMAP using the `imapflow` library with the App Password.
2. Searches for unread messages in the INBOX.
3. Fetches envelope data (From, Subject, Date) and a body snippet for each (up to 20 most recent).
4. Sends all email data to the LLM with a system prompt requesting:
   - One-sentence summaries
   - Urgency classification (🔴 / 🟡 / 🟢)
   - Action items
5. Writes the digest to `workspace/email-digests/<timestamp>.md`.
6. Detects whether the digest contains a non-empty 🔴 Urgent section and surfaces it in console output.
7. Appends a log entry to `workspace/email-log.md`.
8. If `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set (or the caller passes `deliverTo`), pushes the digest to Telegram. The bot's cron uses `deliverTo: undefined` which means urgent-only delivery; explicit `/scan` uses `deliverTo: { chatId }` which always sends the digest (or a "no new emails" notice).

`skills/bot.ts` (Step 3) layers a long-poll loop and a recurring cron on top, both routed through a single in-process mutex so they can't overlap.

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

## Security & permissions

This skill touches your inbox, so it's worth understanding precisely what it can and can't do, what data leaves your machine, and how to revoke access cleanly.

### What this code can do

- **Read** unread messages from your Gmail INBOX over IMAP (envelope + first 4 KB of body).
- **Write** digest files and a log to `workspace/` on your local disk.
- **POST** the digest text to the Telegram Bot API, if you've configured Steps 2/3.

### What this code cannot do

The script only links the `imapflow` IMAP library and never imports an SMTP, Gmail API, or `googleapis` client. There is no code path that:

- Sends, replies to, or forwards email.
- Deletes, archives, trashes, or labels messages.
- Marks messages read or unread (Gmail flips the read flag when *you* open the message in the UI, not when IMAP fetches headers).
- Modifies filters, forwarding rules, or any other account settings.

You can verify this yourself: `rg -n "smtp|sendMail|googleapis|gmail.users" workflows/email-monitor` returns nothing.

### What the App Password actually grants

This is the part most setup guides gloss over.

A Gmail App Password is a single 16-character credential that authenticates against Google's IMAP **and** SMTP servers. Google does **not** offer a "read-only" App Password — the same string that lets this skill read mail would let any other process send mail as you. Practical implications:

- Treat `EMAIL_APP_PASSWORD` exactly like a password. Don't paste it into Slack, screenshots, or shared docs.
- Don't commit `.env`. The shipped `.gitignore` excludes it; double-check before your first push.
- Don't reuse one App Password across projects. Create a separate one per app/device so you can revoke just this skill's access without breaking your phone's mail client.
- App Passwords **bypass 2FA**. That's the whole point of them — IMAP/SMTP can't do interactive 2FA — but it means a leaked App Password is as good as your full mailbox until you revoke it.

To revoke: https://myaccount.google.com/apppasswords → click the trash icon next to the entry. The credential dies instantly, and the skill will get `IMAP error: AUTHENTICATIONFAILED` on its next run. Generate a new one if you still want to use the skill.

### What data leaves your machine

When `npm run scan` (or `/scan`) runs, three network destinations see your email content:

1. **Google IMAP** (`imap.gmail.com:993`) — TLS-encrypted; this is just your own mail server, no different from your phone's mail app.
2. **Your chosen LLM provider** (Anthropic / OpenAI / Google / Featherless) — receives email headers (From, Subject, Date) and the first ~2 KB of each message body, in plaintext over TLS, for summarization. Each provider has its own data-retention policy. Check it before scanning sensitive mailboxes:
   - Anthropic: https://privacy.anthropic.com
   - OpenAI: https://openai.com/policies/privacy-policy
   - Google AI: https://ai.google.dev/gemini-api/terms
3. **Telegram Bot API** (only if you set up Step 2 or 3) — receives the *digest* (summaries + sender names + subjects), not raw email bodies. Telegram retains messages on their servers indefinitely until you delete the chat.

The full digest sits on your local disk in `workspace/email-digests/`. The raw email bodies fetched from IMAP are kept only in memory during the run and never written to disk.

### Local-disk hygiene

- `workspace/email-digests/*.md` and `workspace/email-log.md` contain sender names, subjects, and one-sentence summaries. Anyone with read access to your repo checkout can read these. They're gitignored by default, but check before sharing the directory.
- The `.env` file holds: your model API key, your Gmail App Password, your Telegram bot token. Anyone who can read this file can impersonate you to all four services. Set restrictive permissions if you're on a shared machine: `chmod 600 .env`.
- The `.env.example` ships with empty credentials and is the only env file safe to commit.

### If you're running Step 3 (the bot)

The `npm run bot` process holds all of the above credentials in memory the entire time it runs and accepts inbound messages from Telegram. The bot's exposure surface adds three things on top of `npm run scan`:

- **Allow-listed callers can trigger LLM calls** (`/scan`, `/ask`) on demand. The allow-list is enforced by user ID, not username, so a username squatter can't impersonate you. But anyone you *do* add to `TELEGRAM_ALLOWED_USER_IDS` can run up your LLM bill — give it out the way you'd give out a credit card.
- **Telegram outages or token leaks** mean your bot might receive messages from someone else. The allow-list still rejects them with "Not authorized.", and unknown commands never reach the LLM, but the leaked token would let an attacker impersonate the bot itself (e.g., send fake digests to you). Revoke the token via `@BotFather` → `/revoke` if in doubt.
- **The cron auto-fires every `EMAIL_SCAN_INTERVAL_MINUTES`**, which means scans happen even if you forget the bot is running. Stop it with `Ctrl-C` when you're done — don't leave it running in a tmux pane indefinitely.

## Troubleshooting

- `IMAP error` → check `EMAIL_USER` and `EMAIL_APP_PASSWORD` in `.env`.
- `No new unread emails` but you know there are some → Gmail may have marked them read. Star an email or send a new one.
- Digest is empty or malformed → the model may have struggled with the raw email format. Check `workspace/email-digests/` for the raw output.
- LLM error → verify your API key is set and the provider/model are correct.
- **Telegram says "skipped"** — `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is empty in `.env`. Re-check Step 2c.
- **Telegram error `401 Unauthorized`** — the bot token is wrong or was regenerated. Get a fresh token from `@BotFather`.
- **Telegram error `400 Bad Request: chat not found`** — `TELEGRAM_CHAT_ID` is wrong, or you've never opened a chat with your bot. Click the `t.me/<your_bot>` link from BotFather and press **Start** at least once, then double-check the number from @userinfobot is exactly what's in `.env` (no quotes, no spaces).
- **`npm run bot` exits with "Refusing to start..."** — `TELEGRAM_ALLOWED_USER_IDS` is empty. This is intentional. Add your numeric ID and try again.
- **`npm run bot` exits with "EMAIL_SCAN_INTERVAL_MINUTES must be ≥ 5"** — lower values would re-bill the LLM faster than your inbox actually changes (and Gmail will rate-limit IMAP). Set 5 or higher, or leave empty to disable the cron.
- **Bot says "Not authorized" to my own messages** — your user ID isn't in `TELEGRAM_ALLOWED_USER_IDS`. Check the value matches what @userinfobot returned.
- **Cron didn't fire as expected** — was the bot process actually running? Laptops sleep; the cron only fires while `npm run bot` is alive.
- **Cron ran but I got no Telegram message** — by design. Cron pushes are urgent-only. If the digest had no 🔴 items (or there were no new emails at all), the bot stays silent. Send `/latest` to see the most recent digest, or `/scan` for a fresh push.
- **`/ask` says "No email digests from the last 7 days"** — you've never run `/scan` (or you have, but everything in `workspace/email-digests/` is older than 7 days). Run `/scan` once and try again.
