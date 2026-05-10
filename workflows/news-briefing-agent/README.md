# Track A · News Briefing Agent

> An OpenClaw skill that fetches RSS feeds, generates a structured daily news briefing, and optionally sends it to Telegram. A real workflow you'd actually run every morning.

## What it does

- You configure RSS feed URLs in `workspace/feeds.txt`.
- You trigger the briefing (manually for the workshop, on cron in production).
- The agent fetches each feed, extracts recent articles, groups them by topic, and writes a structured briefing to `workspace/briefings/<today>.md`.
- The agent confirms in chat with a 3-bullet TL;DR of the day's highlights.
- If Telegram is configured, the summary lands in your Telegram chat too.

## Definition of done (workshop bar)

You run `npm run briefing`, a `workspace/briefings/<today>.md` appears with a structured news digest grouped by topic, and the agent posts a confirmation message in the Web UI.

## Prerequisites

- Node 20+ (`node -v`)
- An API key for one of: Anthropic, OpenAI, Google, Featherless
- ~10 minutes

## Setup

```bash
npm install
cp .env.example .env
# edit .env: pick a provider, paste an API key
npm run dev
```

First boot calls `openclaw init` under the hood, which scaffolds the canonical
`SOUL.md`, `USER.md`, `MEMORY.md` into `workspace/` from the
[official OpenClaw templates](https://github.com/openclaw/openclaw/tree/main/docs/reference/templates).

Then add this skill's behavior on top:

```bash
cat skill-personality.snippet.md >> workspace/SOUL.md
npm run reload
```

Open `http://localhost:3000`. You can chat with the agent normally.

In a second terminal, trigger the briefing:

```bash
npm run briefing
```

A briefing file appears in `workspace/briefings/`. Open it. You should see:

- A header with today's date
- Articles grouped by topic (AI, Security, Business, etc.)
- Each item as a one-line summary with a link
- Any fetch errors noted at the bottom

## Files in this skill

```
.
├── README.md                          this file
├── package.json                       OpenClaw + Pi pinned deps
├── .env.example                       configuration template
├── gateway.config.yaml                gateway config (cron, channels, skill args)
├── skill-personality.snippet.md       append to SOUL.md after init (skill rules)
├── workspace/
│   ├── README.md                      explains what lives here
│   ├── feeds.txt                      RSS feed URLs (one per line)
│   └── briefings/                     generated briefings land here
│   # SOUL.md, USER.md, MEMORY.md are scaffolded on first run from the
│   # official OpenClaw templates — we don't ship copies, to avoid drift.
└── skills/
    └── news-briefing.ts               the briefing skill itself
```

## How the briefing works (under the hood)

The skill defined in `skills/news-briefing.ts`:

1. Reads feed URLs from `workspace/feeds.txt`.
2. Fetches each feed via `curl` (with a 15-second timeout per feed).
3. Sends all raw XML content to the model with a system prompt requesting a structured briefing.
4. The model extracts titles, links, descriptions; groups by topic; formats as markdown.
5. Writes the result to `workspace/briefings/<YYYY-MM-DD>.md`.
6. Posts a 3-bullet TL;DR in the chat channel.

The schedule (when running on a VPS) lives in `gateway.config.yaml`:

```yaml
cron:
  - name: morning-briefing
    schedule: "30 7 * * *"
    skill: news-briefing
```

## Where to extend

1. **Add Telegram notifications.** Uncomment the Telegram channel in `gateway.config.yaml`, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_IDS` in `.env`, and change `notify: web` to `notify: telegram`. See [../../guides/07-channels-messaging.md](../../guides/07-channels-messaging.md).
2. **Curate feeds by domain.** Add feeds for your specific interests — security advisories, job boards, niche subreddits, company blogs.
3. **Weekly digest.** Add a second skill that reads all `briefings/*.md` from the past week and generates a "week in review" summary.
4. **Deploy to a VPS.** Once you trust the workflow, move it somewhere always-on — see [../../guides/04-deploy-vps-hostinger.md](../../guides/04-deploy-vps-hostinger.md).

## Troubleshooting

- `workspace/briefings/` is empty → the skill didn't run. Check that `npm run briefing` doesn't error.
- Briefing has "Fetch errors" for all feeds → network issue. Try `curl -sL "https://hnrss.org/frontpage"` manually.
- Agent replies "I cannot access that file" → `FEEDS_FILE` in `.env` is wrong. Should be `workspace/feeds.txt`.
- Wrong tone / language → you edited `SOUL.md` but didn't `npm run reload`.
- More problems? → [../../guides/10-troubleshooting.md](../../guides/10-troubleshooting.md).

## Stopping it

```bash
Ctrl-C in the npm run dev terminal
```
