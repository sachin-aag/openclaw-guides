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
    └── news-briefing.ts               the briefing script
```

## How the briefing works (under the hood)

The script in `skills/news-briefing.ts`:

1. Reads feed URLs from `workspace/feeds.txt`.
2. Fetches each feed via `curl` (with a 15-second timeout per feed).
3. Sends all raw XML content to the LLM with a system prompt requesting a structured briefing.
4. The model extracts titles, links, descriptions; groups by topic; formats as markdown.
5. Writes the result to `workspace/briefings/<YYYY-MM-DD>.md`.

## Supported providers

| Provider | Env var | Model example |
|----------|---------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Google | `GOOGLE_API_KEY` | `gemini-1.5-flash` |
| Featherless | `FEATHERLESS_API_KEY` | `meta-llama/Meta-Llama-3.1-8B-Instruct` |

Set `OPENCLAW_PROVIDER` and `OPENCLAW_MODEL` in `.env` to choose.

## Where to extend

1. **Curate feeds by domain.** Add feeds for your specific interests — security advisories, job boards, niche subreddits, company blogs.
2. **Weekly digest.** Write a second script that reads all `briefings/*.md` from the past week and generates a "week in review" summary.
3. **Schedule it.** Use cron on a VPS or your laptop to run `npm run briefing` every morning.
4. **OpenClaw integration.** When OpenClaw is available on npm, the `gateway.config.yaml` file documents how this skill plugs in — with channels, cron scheduling, and Telegram notifications.

## Troubleshooting

- `workspace/briefings/` is empty — the script didn't run. Check that `npm run briefing` doesn't error.
- Briefing has "Fetch errors" for all feeds — network issue. Try `curl -sL "https://hnrss.org/frontpage"` manually.
- `FEEDS_FILE` not found — check your `.env` points to the right path (default: `workspace/feeds.txt`).
- LLM error — verify your API key is set and the provider/model are correct.
