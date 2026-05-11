# Track B · Price Monitor

> A standalone skill that watches product/stock prices via RSS feeds or web pages, alerts when conditions are met, and logs all checks to `workspace/price-log.md`. A practical monitoring system you'd actually use.

## What it does

- You define watch targets in `workspace/watchlist.yaml` — name, URL, type, threshold, direction.
- You run `npm run check`.
- The script fetches each target, sends the content to an LLM to extract the price, and compares against thresholds.
- If a price crosses its threshold, an alert is printed.
- Every check is logged to `workspace/price-log.md` with a timestamp.

## Definition of done (workshop bar)

Add an item to `watchlist.yaml` with a threshold you know will trigger → run `npm run check` → an alert appears in the console, and `price-log.md` shows the check.

## Prerequisites

- Node 20+ (`node -v`)
- An API key for one of: Anthropic, OpenAI, Google, Featherless

## Setup

The setup is in three optional layers. **Step 1** gives you a working price check from the CLI — that's the workshop's success criterion. **Step 2** adds Telegram delivery. **Step 3** turns it into a long-running interactive bot that re-checks on a schedule and answers questions about your price history.

### Step 1 — get a check running

```bash
npm install
cp .env.example .env
# edit .env: pick a provider, paste an API key
```

Edit `workspace/watchlist.yaml` — set a threshold you know will trigger (e.g., set Bitcoin threshold to $999,999 with direction "below" — it will always fire).

Run a check:

```bash
npm run check
```

You should see:

- Console output showing each item's fetched price
- Alerts for items that crossed their threshold
- A new entry in `workspace/price-log.md` with timestamp and price

If you stop here, you've hit the workshop bar.

### Step 2 — get checks on Telegram (optional)

Once Step 1 is working, you can have each `npm run check` push a summary to a Telegram chat. The `price-log.md` file is still written to disk — Telegram is an additional delivery channel, not a replacement. (Step 3 layers on top of this: the long-running bot pushes *alerts only* to the same chat automatically.)

#### 2a. Create a Telegram bot

In the Telegram app, open a chat with [@BotFather](https://t.me/botfather) and send:

```
/newbot
```

BotFather will ask for:

- **A name** for your bot (anything, e.g. `My Price Monitor`).
- **A username** (must end in `bot`, e.g. `my_price_monitor_bot`).

BotFather's reply contains three things you'll need:

- **The HTTP API token**, which looks like `1234567890:AAH...rest-of-token...` — copy this somewhere safe. **Treat the token like a password** — anyone who has it can send messages as your bot.
- **A `t.me/<your_bot_username>` link** — click it to open a chat with your new bot. (No need to search by username.)
- **A link to BotSettings** — ignore for now.

Click the `t.me/...` link. A chat with your bot opens. Press the blue **Start** button at the bottom — this sends `/start` to the bot. The bot won't reply yet (we haven't run the bot code), but Telegram now has the chat on record, which matters for step 2b.

#### 2b. Find your chat ID

The bot needs to know *which* chat to send the summary to. For a personal bot — you talking to your own bot — your "chat ID" is just your numeric Telegram user ID. The fastest way:

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
npm run check
```

You should see a new line at the end of the script's output:

```
Telegram: delivered.
```

Open Telegram — the price summary is in your chat. The summary contains every item that was checked: alerts at the top, OK readings below, and any fetch/extraction issues at the bottom. If the message would exceed Telegram's ~4,000-character per-message limit, the script splits it into multiple messages, each prefixed with `[1/N]`.

If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is missing or empty, the Telegram step is silently skipped and you just get the console output and the price-log entry. Telegram failures (bad token, network error) are logged but don't fail the script — the file write is the source of truth.

### Step 3 — make it interactive (optional, after Steps 1 + 2)

Step 2 is one-way: you run `npm run check`, you receive a message. **Step 3** flips that around — a long-running bot you can talk to from Telegram (`/check` runs one on demand, `/watchlist` shows what's configured, `/ask` answers questions about the price log) and that re-checks prices automatically on a schedule. This is the "always-on agent" experience that the OpenClaw gateway gives you for free; here we build it by hand to show the moving parts.

The bot behaves differently from the news briefing bot in two important ways:

- **Cron pushes are alerts-only.** A scheduled re-check that finds everything within thresholds writes to `price-log.md` and stays silent. Your phone doesn't buzz with "everything's fine" every hour. (The news briefing pushes the digest unconditionally because it *is* the content; here, a price alert is the actionable signal and a quiet check is non-news.)
- **Re-check interval is configurable in minutes**, not a fixed hour-of-day. Prices move on minute scales; once-a-day is too coarse.

> **Heads-up.** This step starts a long-running process that holds your model API key, accepts inbound messages from Telegram, and stays up until you `Ctrl-C` it. Read the safety paragraph at 3h before you start it.

#### 3a. Reuse your Telegram user ID from Step 2b

The bot needs an allow-list of users it will accept commands from. Without one, anyone who guesses your bot's username could run `/check` and bill your account.

For a personal bot you're the only allowed user, so the allow-list is the same number you already put in `TELEGRAM_CHAT_ID` from Step 2b. (If you skipped that and want to find it now: message [@userinfobot](https://t.me/userinfobot), press Start, copy the `Id:` number.)

#### 3b. Add three more env vars

Add these to your `.env` (leave the Step 2 vars in place — the bot uses both):

```bash
TELEGRAM_ALLOWED_USER_IDS=42718903       # default: same as TELEGRAM_CHAT_ID. Comma-separate to allow more users.
PRICE_CHECK_INTERVAL_MINUTES=60          # how often the cron re-checks. Minimum 5. Leave empty to disable the cron.
ASK_DAILY_LIMIT=20                       # per-user cap on /ask calls per day. Default 20.
```

`TELEGRAM_ALLOWED_USER_IDS` is **required** — the bot refuses to start without it. `PRICE_CHECK_INTERVAL_MINUTES` is optional; if you leave it empty, the bot only acts on commands and never re-checks on its own. `ASK_DAILY_LIMIT` is optional too (default 20) but worth thinking about — every `/ask` is a full LLM call against the last week of price-log data, so a chatty user can run up cost faster than `/check` can.

#### 3c. Run the bot

```bash
npm run bot
```

You should see something like:

```
[bot] @my_price_monitor_bot ready.
[bot] allow-list: [42718903]
[bot] cron: every 60 minute(s), alerts-only push to env chat
[bot] /check on demand.
```

Now open the chat with your bot and send `/check`. The bot replies "Running a price check..." and a few seconds later sends the summary. Each `/check` always re-fetches — prices move minute-to-minute, so a stale cached number would be a worse answer than a fresh one. If you tap `/check` again while a check is still in flight, the second tap gets "already running, hold tight" rather than double-billing the LLM (that's the in-process mutex doing its job).

#### 3d. The command surface

| You send | Bot does |
|---|---|
| `/check` | Runs a fresh price check and sends the full summary to your chat. If a check is already in flight (cron or another `/check`), replies "already running, hold tight." |
| `/ask <question>` | Answers the question using `price-log.md` entries from the last 7 days as context. See Step 3g. |
| `/reset` | Clears your `/ask` conversation memory (does **not** reset your daily quota). |
| `/watchlist` | Sends the contents of `workspace/watchlist.yaml`. |
| `/help` | Shows the command list. |
| `/start` | Greets you. |
| anything else (no leading slash, or unknown command) | Replies with the same text as `/help`. **No LLM call.** |
| anything from a non-allow-listed user | Replies `"Not authorized."` and logs once. |

Only `/check` and `/ask` reach the LLM. Bare text never does. That's the cost-amplification guardrail — the bot is a CLI over Telegram, not a chatbot.

#### 3e. Cron behaviour (alerts-only)

When the recurring check fires, the bot pushes to Telegram **only if there are alerts**. A run where every item is within its threshold writes to `price-log.md` and exits silently — your phone doesn't buzz. This is the opposite of the news briefing, where the cron always pushes a digest, because price alerts are signals you actually want to act on, not a daily ritual.

If you want a regular "all is well" ping anyway, just send `/check` whenever you feel like it.

#### 3f. `/ask` — questions about your price history

`/ask` lets you interrogate the last week of price checks without re-reading the log file. It's deliberately small in scope:

- **Context window: the last 7 days of `price-log.md`** plus the current `watchlist.yaml`. The bot filters log lines by their `[YYYY-MM-DD HH:MM:SS]` timestamps and gives only the recent ones to the model. Nothing else — no live web fetch, no outside knowledge of market prices. If the answer isn't in the log, the bot says so.
- **Multi-turn memory with periodic compaction.** Recent (question, answer) turns are kept verbatim so follow-ups ("what about the second one?") work cleanly. When the buffer reaches `ASK_COMPACT_EVERY` turns (default 5) *or* the memory grows past `ASK_COMPACT_AT_CHARS` characters (default 6000), a single LLM call folds it into a short running summary (≤200 words) and the buffer is cleared. So most turns cost 1 LLM call; every Nth turn (or any turn that produces a wall of text) costs 2.
- **Per-user daily limit.** Default 20 `/ask` calls per user per day. Resets at local midnight. Override with `ASK_DAILY_LIMIT=N`. Compaction calls don't count against your quota.
- **`/reset` clears memory but not the counter.**

Example:

```
You:  /ask did bitcoin ever drop below 50k this week?
Bot:  Yes — twice. Once on 2026-05-09 at 03:15 (USD 49,820) and again on
      2026-05-10 at 14:30 (USD 49,640). Both crossed the "below 50000"
      threshold and would have alerted.
You:  what about gold?
Bot:  Gold (XAU/USD) ranged USD 2,408–2,481 in the last 7 days; never
      crossed the "above 2500" threshold (2026-05-05 to 2026-05-11).
You:  /reset
Bot:  Conversation memory cleared.
```

If you haven't run `/check` (or `npm run check`) at least once in the last 7 days, `/ask` replies `"No price-log entries from the last 7 days. Run /check first."`

#### 3g. Stopping the bot

`Ctrl-C` once. The cron stops, the long-poll loop closes, in-flight checks complete. Restart with `npm run bot` — the bot drains pending updates, so you don't get a flood of replays.

#### 3h. Safety paragraph (read this)

- **Allow-list is mandatory.** The bot refuses to start without `TELEGRAM_ALLOWED_USER_IDS`. Don't disable that check.
- **Interval floor is 5 minutes.** The bot refuses to start with `PRICE_CHECK_INTERVAL_MINUTES` below that. Lower values bill the LLM faster than prices actually change.
- **Laptop sleep.** The cron only fires while the process is running. If your laptop sleeps, no checks happen until it wakes. For a real always-on setup, run on a VPS — see [03-deploy-vps-hostinger.md](../../guides/howto/03-deploy-vps-hostinger.md).
- **Mutex, not a queue.** If a cron tick arrives while a `/check` is in flight (or vice versa), the new request is rejected with "already running" rather than queued. Same-second double-clicks won't double-bill you.
- **Token and allow-list go in `.env`.** That file is gitignored. Don't commit it. If you suspect the token leaked, regenerate via `@BotFather` → `/revoke`.

## Files in this project

```
.
├── README.md                          this file
├── package.json                       project deps (tsx, LLM SDKs, yaml)
├── .env.example                       configuration template
├── gateway.config.yaml                reference config for future OpenClaw integration
├── skill-personality.snippet.md       personality rules (documentation)
├── lib/
│   └── llm.ts                         multi-provider LLM abstraction
├── workspace/
│   ├── README.md                      explains what lives here
│   ├── watchlist.yaml                 items to monitor (edit this!)
│   └── price-log.md                   created on first run; check history
└── skills/
    ├── price-monitor.ts               the check core (exports runCheck) + CLI for `npm run check`
    ├── ask.ts                         /ask Q&A grounded on the last 7 days of price-log (Step 3f)
    └── bot.ts                         long-running Telegram bot + recurring cron (Step 3, `npm run bot`)
```

## How the check works (under the hood)

The exported `runCheck()` in `skills/price-monitor.ts`:

1. Reads watch items from `workspace/watchlist.yaml` (parsed with the `yaml` package).
2. Fetches up to `PRICE_CHECK_CONCURRENCY` items in parallel (default 4). Each item is one `curl` (20-second timeout, via `execFile` so it doesn't block) plus one LLM call to extract the price as JSON.
3. Parses each LLM response to get a numeric price and compares it against the item's threshold and direction.
4. Appends every check (success or failure) to `workspace/price-log.md` in watchlist order, regardless of which finished first.
5. If `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set (or the caller passes `deliverTo`), pushes the summary to Telegram. The bot's cron uses `deliverTo: undefined` which means alerts-only delivery; explicit `/check` uses `deliverTo: { chatId }` which always sends the full summary.

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

1. **Track price history as a chart.** Modify the script to write a CSV file alongside the log, then chart it later.
2. **Multiple thresholds.** Add "warn" vs "critical" thresholds per item with different alert urgency.
3. **Schedule it externally.** Use cron on a VPS to run `npm run check` on an interval if you don't want a long-running bot process.
4. **OpenClaw integration.** When OpenClaw is available on npm, the `gateway.config.yaml` documents how this skill plugs in — with heartbeat, channels, and Telegram notifications.

## Troubleshooting

- No alerts fire — check your threshold/direction logic. Set a threshold guaranteed to trigger.
- `price-log.md` shows "price not found" — the LLM couldn't extract a price from the page. Two common causes:
  - **Bot protection.** `curl` got a Cloudflare/Akamai challenge instead of the page. Most major retailers (Amazon, raspberrypi.com, etc.) block plain `curl`. Pick a JSON or CSV API instead — see the comment block at the top of `workspace/watchlist.yaml` for what works.
  - **JS-rendered content.** The page loads prices via JavaScript after the HTML arrives; `curl` only sees the empty shell. Same fix: switch to an API endpoint, or move that item to a headless-browser scraper (out of scope here).
- `WATCHLIST_FILE` not found — check your `.env` points to the right path (default: `workspace/watchlist.yaml`).
- LLM error — verify your API key is set and the provider/model are correct.
- **Telegram says "skipped"** — `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is empty. Re-check Step 2c.
- **Telegram error `401 Unauthorized`** — token is wrong or was regenerated. Get a fresh one from `@BotFather`.
- **Telegram error `400 Bad Request: chat not found`** — `TELEGRAM_CHAT_ID` is wrong, or you've never opened a chat with your bot. Click the `t.me/<your_bot>` link and press **Start**, then double-check the number from @userinfobot.
- **`npm run bot` exits with "Refusing to start..."** — `TELEGRAM_ALLOWED_USER_IDS` is empty. This is intentional. Add your numeric ID and try again.
- **`npm run bot` exits with "PRICE_CHECK_INTERVAL_MINUTES must be ≥ 5"** — lower values would bill the LLM faster than prices change. Set 5 or higher, or leave empty to disable the cron.
- **Bot says "Not authorized" to my own messages** — your user ID isn't in `TELEGRAM_ALLOWED_USER_IDS`. Check the value matches what @userinfobot returned.
- **Cron didn't fire as expected** — was the bot process actually running? Laptops sleep; the cron only fires while `npm run bot` is alive.
- **`/ask` says "No price-log entries from the last 7 days"** — you've never run `/check` (or you have, but everything in the log is older than 7 days). Run `/check` once and try again.
