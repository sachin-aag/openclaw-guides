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
    └── price-monitor.ts               the monitoring script
```

## How the monitor works (under the hood)

The script in `skills/price-monitor.ts`:

1. Reads watch items from `workspace/watchlist.yaml` (parsed with the `yaml` package).
2. For each item, fetches the URL via `curl` (20-second timeout).
3. Sends the raw page/feed content to the LLM, asking it to extract the price as JSON.
4. Parses the LLM's response to get a numeric price.
5. Compares against the item's threshold and direction.
6. If triggered, prints an alert to the console.
7. Appends every check (success or failure) to `workspace/price-log.md`.

## Supported providers

| Provider | Env var | Model example |
|----------|---------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Google | `GOOGLE_API_KEY` | `gemini-1.5-flash` |
| Featherless | `FEATHERLESS_API_KEY` | `meta-llama/Meta-Llama-3.1-8B-Instruct` |

Set `OPENCLAW_PROVIDER` and `OPENCLAW_MODEL` in `.env` to choose.

## Where to extend

1. **Track price history.** Modify the script to write a CSV file alongside the log, then chart it later.
2. **Multiple thresholds.** Add "warn" vs "critical" thresholds per item with different alert urgency.
3. **Schedule it.** Use cron on a VPS or your laptop to run `npm run check` on an interval.
4. **OpenClaw integration.** When OpenClaw is available on npm, the `gateway.config.yaml` file documents how this skill plugs in — with heartbeat, channels, and Telegram notifications.

## Troubleshooting

- No alerts fire — check your threshold/direction logic. Set a threshold that's guaranteed to trigger.
- `price-log.md` shows "price not found" — the LLM couldn't extract a price from the page. Try a different URL or a simpler page.
- `WATCHLIST_FILE` not found — check your `.env` points to the right path (default: `workspace/watchlist.yaml`).
- LLM error — verify your API key is set and the provider/model are correct.
