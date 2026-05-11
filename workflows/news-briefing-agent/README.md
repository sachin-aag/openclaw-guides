# Track A · News Briefing Agent

> A standalone skill that fetches RSS feeds, generates a structured daily news briefing using an LLM, and saves it as markdown. A real workflow you'd actually run every morning.

## What it does

- You configure RSS feed URLs in `workspace/feeds.txt`.
- You run `npm run briefing`.
- The script fetches each feed, sends the raw content to your chosen LLM, which extracts recent articles, groups them by topic, and produces a structured briefing.
- The briefing is written to `workspace/briefings/<today>.md`.

## Definition of done (workshop bar)

You run `npm run briefing`, a `workspace/briefings/<today>.md` appears with a structured news digest grouped by topic.

## Prerequisites

- Node 20+ (`node -v`)
- An API key for one of: Anthropic, OpenAI, Google, Featherless

## Setup

The setup is in two steps. **Step 1** gives you a working briefing as a markdown file — that's the workshop's success criterion. **Step 2** is optional: also receive the briefing on Telegram so it lands on your phone.

### Step 1 — get a briefing as a markdown file

```bash
npm install
cp .env.example .env
# edit .env: pick a provider, paste an API key
npm run briefing
```

A briefing file appears in `workspace/briefings/`. Open it. You should see:

- A header with today's date
- Articles grouped by topic (AI, Security, Business, etc.)
- Each item as a one-line summary with a link
- Any fetch errors noted at the bottom

If you stop here, you've hit the workshop bar.

### Step 2 — get briefings on Telegram (optional)

Once Step 1 is working, you can have the same briefing pushed to a Telegram chat every time you run `npm run briefing`. The markdown file is still written to disk — Telegram is an additional delivery channel, not a replacement.

#### 2a. Create a Telegram bot

In the Telegram app, open a chat with [@BotFather](https://t.me/botfather) and send:

```
/newbot
```

BotFather will ask for:

- **A name** for your bot (anything, e.g. `My News Briefing`).
- **A username** (must end in `bot`, e.g. `my_news_briefing_bot`).

BotFather's reply contains three things you'll need:

- **The HTTP API token**, which looks like `1234567890:AAH...rest-of-token...` — copy this somewhere safe. **Treat the token like a password** — anyone who has it can send messages as your bot.
- **A `t.me/<your_bot_username>` link** — click it to open a chat with your new bot. (No need to search by username.)
- **A link to BotSettings** — ignore for now.

Click the `t.me/...` link. A chat with your bot opens. Press the blue **Start** button at the bottom — this sends `/start` to the bot. The bot won't reply yet (we haven't run the bot code), but Telegram now has the chat on record, which matters for step 2b.

#### 2b. Find your chat ID

The bot needs to know *which* chat to send the briefing to. For a personal bot — you talking to your own bot — your "chat ID" is just your numeric Telegram user ID. The fastest way:

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
npm run briefing
```

You should see a new line at the end of the script's output:

```
Telegram: sending briefing (1 message)...
Telegram: delivered.
```

Open Telegram — the briefing is in your chat. If it's longer than ~3,800 characters, the script will split it into multiple messages, each prefixed with `[1/N] News briefing <date>`.

If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is missing or empty, the Telegram step is silently skipped and you just get the file. Telegram failures (bad token, network error) are logged but don't fail the script — the file write is the source of truth.

### Step 3 — make it interactive (optional, after Steps 1 + 2)

Step 2 is one-way: you run `npm run briefing`, you receive a message. **Step 3** flips that around — a long-running bot that you can talk to from Telegram (`/briefing` runs one on demand, `/feeds` lists what's configured) and that fires a fresh briefing automatically every morning at a fixed hour. This is the "always-on agent" experience that the OpenClaw gateway gives you for free; here we build it by hand to show the moving parts.

> **Heads-up.** This step starts a long-running process that holds your model API key, accepts inbound messages from Telegram, and stays up until you `Ctrl-C` it. Read the safety paragraph below before you start it.

#### 3a. Reuse your Telegram user ID from Step 2b

The bot needs an allow-list of users it will accept commands from. Without one, anyone who guesses your bot's username could run `/briefing` and bill your account.

For a personal bot you're the only allowed user, so the allow-list is the same number you already put in `TELEGRAM_CHAT_ID` from Step 2b. (If you skipped that and want to find it now: message [@userinfobot](https://t.me/userinfobot), press Start, copy the `Id:` number.)

#### 3b. Add two more env vars

Add these to your `.env` (leave the Step 2 vars in place — the bot uses both):

```bash
TELEGRAM_ALLOWED_USER_IDS=42718903       # default: same as TELEGRAM_CHAT_ID from Step 2b. Comma-separate to allow more users.
BRIEFING_CRON_HOUR=8                     # local hour 0–23. Leave empty to disable the daily cron.
```

`TELEGRAM_ALLOWED_USER_IDS` is **required** — the bot refuses to start without it. `BRIEFING_CRON_HOUR` is optional; if you leave it empty, the bot only acts on commands.

#### 3c. Run the bot

```bash
npm run bot
```

You should see something like:

```
[bot] @my_news_briefing_bot ready.
[bot] allow-list: [42718903]
[bot] cron: 08:00 Europe/Berlin
[bot] /briefing on demand. Today is 2026-05-13.
```

Now open the chat with your bot and send `/briefing`. The bot replies "Working on the briefing..." and ~15 seconds later sends the structured briefing. Send it again immediately — the second call is free, because today's file is still fresh and gets re-sent without re-running the LLM (default cache window: 60 minutes).

#### 3d. The command surface

| You send | Bot does |
|---|---|
| `/briefing` | Runs today's briefing (cache-aware). If a run is already in flight, replies "already running, hold tight." |
| `/ask <question>` | Answers the question using briefings from the last 7 days as context. See Step 3g below. |
| `/reset` | Clears your `/ask` conversation memory (does **not** reset your daily quota). |
| `/feeds` | Lists the URLs in `workspace/feeds.txt`. |
| `/help` | Shows the command list. |
| `/start` | Greets you. |
| anything else (no leading slash, or unknown command) | Replies with the same text as `/help`. **No LLM call.** |
| anything from a non-allow-listed user | Replies `"Not authorized."` and logs once. |

Only `/briefing` and `/ask` reach the LLM. Bare text never does. That's the cost-amplification guardrail — the bot is a CLI over Telegram, not a chatbot. If you add a third LLM-touching command later, also add a per-user rate limit to it, the way `/ask` does.

#### 3g. `/ask` — questions about recent briefings

`/ask` lets you interrogate the last week's briefings without scrolling. It's deliberately small in scope:

- **Context window: the last 7 days of briefings.** The bot reads every `workspace/briefings/<date>.md` file from the past 7 days and gives them to the model as context. Nothing else — no web search, no tool use, no outside knowledge. If the answer isn't in those files, the bot says so.
- **Multi-turn memory with periodic compaction.** Recent (question, answer) turns are kept verbatim so follow-ups ("what was the second one again?") work cleanly. When the buffer reaches `ASK_COMPACT_EVERY` turns (default 5) *or* the memory grows past `ASK_COMPACT_AT_CHARS` characters (default 6000), a single LLM call folds it into a short running summary (≤200 words) and the buffer is cleared. So most turns cost 1 LLM call; every Nth turn (or any turn that produces a wall of text) costs 2. Cost-per-turn stays bounded.
- **Per-user daily limit.** Default `20` `/ask` calls per user per day. Resets at local midnight. Override with `ASK_DAILY_LIMIT=N` in `.env`. Compaction calls don't count against your quota.
- **`/reset` clears memory but not the counter.** Use it when you change topics and don't want stale references leaking into the next answer. It does **not** reset your daily quota.

Example:

```
You:  /ask any AI policy news this week?
Bot:  Two items: the EU AI Act enforcement update on May 8 (2026-05-08), and
      OpenAI's safety council reshuffle on May 10 (2026-05-10).
You:  what was the second one about?
Bot:  OpenAI announced a restructuring of its internal safety council,
      adding two external members and a new escalation process (2026-05-10).
You:  /reset
Bot:  Conversation memory cleared.
```

If you didn't run `/briefing` (or `npm run briefing`) at least once in the last 7 days, `/ask` replies `"No briefings from the last 7 days. Run /briefing first."` — there's nothing to ground the answer on.

#### 3e. Stopping the bot

`Ctrl-C` once. The cron stops, the long-poll loop closes, in-flight briefings complete (the file write is atomic relative to the LLM response). Restart with `npm run bot` — the bot drains any pending updates from while it was off, so you don't get a flood of replays.

#### 3f. Safety paragraph (read this)

- **Allow-list is mandatory.** The bot refuses to start without `TELEGRAM_ALLOWED_USER_IDS`. Don't try to disable that check.
- **Laptop sleep.** The cron only fires while the process is running. If your laptop sleeps at 02:00 and wakes at 09:00, the 08:00 briefing is missed (it doesn't catch up). For a real always-on setup, run on a VPS — see [03-deploy-vps-hostinger.md](../../guides/howto/03-deploy-vps-hostinger.md) and [04-cron-and-heartbeat.md](../../guides/concepts/04-cron-and-heartbeat.md).
- **Mutex, not a queue.** If `/briefing` arrives while another briefing is running (cron tick, or another `/briefing`), the new request is rejected with "already running" rather than queued. Same-second double-clicks won't double-bill you.
- **Token and allow-list go in `.env`.** That file is gitignored. Don't commit it. If you suspect the token leaked, regenerate it via `@BotFather` → `/revoke`.

## Files in this project

```
.
├── README.md                          this file
├── package.json                       project deps (tsx, LLM SDKs)
├── .env.example                       configuration template
├── gateway.config.yaml                reference config for future OpenClaw integration
├── skill-personality.snippet.md       personality rules (documentation)
├── lib/
│   └── llm.ts                         multi-provider LLM abstraction
├── workspace/
│   ├── README.md                      explains what lives here
│   ├── feeds.txt                      RSS feed URLs (one per line)
│   └── briefings/                     generated briefings land here
└── skills/
    ├── news-briefing.ts               the briefing core (exports runBriefing) + CLI for `npm run briefing`
    ├── ask.ts                         /ask Q&A grounded on the last 7 days of briefings (Step 3g)
    └── bot.ts                         long-running Telegram bot + daily cron (Step 3, `npm run bot`)
```

## How the briefing works (under the hood)

The exported `runBriefing()` in `skills/news-briefing.ts`:

1. If today's file already exists and was written less than `cacheMinutes` ago (default 60), reuses it instead of regenerating. The CLI bypasses this with `forceRegenerate: true`; the bot leaves it on so repeat `/briefing` calls are free.
2. Reads feed URLs from `workspace/feeds.txt`.
3. Fetches each feed via `curl` (with a 15-second timeout per feed).
4. Sends all raw XML content to the LLM with a system prompt requesting a structured briefing.
5. The model extracts titles, links, descriptions; groups by topic; formats as markdown.
6. Writes the result to `workspace/briefings/<YYYY-MM-DD>.md`.
7. If `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set (or the caller passes `deliverTo`), also POSTs the briefing to the Telegram Bot API (`sendMessage`), chunked to fit the 4096-char per-message limit.

`skills/bot.ts` (Step 3) layers a long-poll loop and a single-fire-per-hour cron on top, both routed through a single in-process mutex so they can't overlap.

## Supported providers

| Provider | Env var | Model example |
|----------|---------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Google | `GOOGLE_API_KEY` | `gemini-1.5-flash` |
| Featherless | `FEATHERLESS_API_KEY` | `meta-llama/Meta-Llama-3.1-8B-Instruct` |

Set `OPENCLAW_PROVIDER` and `OPENCLAW_MODEL` in `.env` to choose.

## Optional next steps

Once the briefing is landing reliably, the interesting work is shaping it to your taste. These are all small edits — most are a one-liner in `workspace/feeds.txt` or a paragraph change in the system prompt inside `skills/news-briefing.ts`.

1. **Customise feeds.** Edit `workspace/feeds.txt` — one URL per line, blank lines and `#` comments allowed. Replace the defaults with feeds you actually read: company blogs, security advisories, niche subreddits (`https://www.reddit.com/r/<sub>/.rss`), GitHub release feeds (`https://github.com/<org>/<repo>/releases.atom`), Hacker News topic feeds (`https://hnrss.org/newest?q=<term>`), arXiv categories, podcast RSS.
2. **Improve formatting.** The briefing's shape (headers, grouping, one-line summaries) comes from the system prompt in `skills/news-briefing.ts`. Edit the prompt to change section order, add an executive summary at the top, switch to a table layout, include source attribution next to every link, or strip emojis. Re-run `npm run briefing -- --force` to bypass the cache.
3. **Summarise content or prioritise topics.** Tell the prompt what you care about: "lead with anything about Postgres, Kubernetes, or LLM evals; bury sports and crypto." Or have it write a 2-3 sentence executive summary at the top before the topic groups. Or ask it to flag items it thinks you'd want to read in full vs. skim.
4. **De-duplicate across feeds.** Multiple feeds often cover the same story (HN + tech blogs + newsletters). Add a line to the prompt: "If multiple sources cover the same story, include it once with all source links."
5. **Filter by recency.** Cap the briefing at "articles from the last 24 hours" or "since the last briefing" so a noisy feed doesn't crowd everything else out.
6. **Persist what you've seen.** Right now every briefing is independent. Keep a `workspace/seen.json` of URLs already shown and tell the prompt to skip them — the briefing then becomes "what's new since yesterday" rather than "what's on the feeds today."
7. **Multiple briefings.** Run separate briefings for separate purposes — `feeds-work.txt` and `feeds-personal.txt`, or a morning briefing (news) and an evening one (long-reads). Pass a different feeds file via `FEEDS_FILE=workspace/feeds-work.txt npm run briefing`.
8. **Change the output format.** Markdown is the default because it renders everywhere. If you want HTML for email, JSON for downstream tooling, or plain text for SMS, change the file extension and adjust the prompt — the rest of the pipeline doesn't care.

## Where to extend

1. **Curate feeds by domain.** Add feeds for your specific interests — security advisories, job boards, niche subreddits, company blogs.
2. **Weekly digest.** Write a second script that reads all `briefings/*.md` from the past week and generates a "week in review" summary.
3. **Schedule it.** Use cron on a VPS or your laptop to run `npm run briefing` every morning. Combined with Step 2 above, you get a daily briefing pushed to Telegram automatically.
4. **Add a second channel.** The Telegram delivery in Step 2 is a direct `fetch` to the Bot API. Slack, Discord, and email work the same way — POST to a webhook in the script after the file is written.
5. **OpenClaw integration.** When OpenClaw is available on npm, the `gateway.config.yaml` file documents how this skill plugs into the gateway — channels, cron scheduling, and shared memory across skills.

## Troubleshooting

- `workspace/briefings/` is empty — the script didn't run. Check that `npm run briefing` doesn't error.
- Briefing has "Fetch errors" for all feeds — network issue. Try `curl -sL "https://hnrss.org/frontpage"` manually.
- `FEEDS_FILE` not found — check your `.env` points to the right path (default: `workspace/feeds.txt`).
- LLM error — verify your API key is set and the provider/model are correct.
- **Telegram says "skipped"** — `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is empty in `.env`. Re-check Step 2c.
- **Telegram error `401 Unauthorized`** — the bot token is wrong or was regenerated. Get a fresh token from `@BotFather`.
- **Telegram error `400 Bad Request: chat not found`** — `TELEGRAM_CHAT_ID` is wrong, or you've never opened a chat with your bot. Click the `t.me/<your_bot>` link from BotFather and press **Start** at least once, then double-check the number from @userinfobot is exactly what's in `.env` (no quotes, no spaces).
- **Telegram delivers but the briefing looks like a wall of text** — that's expected; the script sends plain text (no Markdown parsing) to avoid Telegram's strict MarkdownV2 escaping rules. The file in `workspace/briefings/` keeps full markdown formatting.
- **`npm run bot` exits with "Refusing to start..."** — `TELEGRAM_ALLOWED_USER_IDS` is empty in `.env`. This is intentional. Add your numeric Telegram user ID (find it via @userinfobot) and try again.
- **Bot says "Not authorized" to my own messages** — your user ID isn't in `TELEGRAM_ALLOWED_USER_IDS`. Check the value matches what @userinfobot returned (it's a number, no quotes, no `@username`).
- **Bot is up but `/briefing` does nothing** — check the bot's terminal. Most likely an LLM error (bad API key, rate limit). The bot replies in the chat with the failure reason if Telegram delivery itself fails.
- **Cron didn't fire at the configured hour** — was the bot process actually running at that minute? Laptops sleep; cron only fires while `npm run bot` is alive. See [04-cron-and-heartbeat.md › Local laptop reality check](../../guides/concepts/04-cron-and-heartbeat.md).
