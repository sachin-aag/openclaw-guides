# Track B · Price Monitor

> An OpenClaw skill that watches product/stock prices via RSS feeds or web pages, alerts via Telegram (or Web UI) when conditions are met, and logs all checks to `workspace/price-log.md`. A practical monitoring system you'd actually use.

## What it does

- You define watch targets in `workspace/watchlist.yaml` — name, URL, type, threshold, direction.
- On every heartbeat (default: 15 minutes), the agent fetches each target.
- The model extracts the current price from the raw page/feed content.
- If a price crosses its threshold, an alert fires in the Web UI (or Telegram if configured).
- Every check is logged to `workspace/price-log.md` with a timestamp.

## Definition of done (workshop bar)

Add an item to `watchlist.yaml` with a threshold you know will trigger → run `npm run check` → an alert appears in the Web UI, and `price-log.md` shows the check.

## Prerequisites

- Node 20+ (`node -v`)
- An API key for one of: Anthropic, OpenAI, Google, Featherless
- ~15 minutes

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

Edit `workspace/watchlist.yaml` — set a threshold you know will trigger (e.g., set Bitcoin threshold to $999,999 with direction "below" — it will always fire).

Trigger a check manually:

```bash
npm run check
```

You should see:
- An alert in the Web UI for items that crossed their threshold
- A new entry in `workspace/price-log.md` with timestamp and price

Once the heartbeat is running (`npm run dev`), checks happen automatically every 15 minutes.

## Files in this skill

```
.
├── README.md                          this file
├── package.json                       OpenClaw + Pi pinned deps
├── .env.example                       configuration template
├── gateway.config.yaml                gateway config (heartbeat, channels, skill args)
├── skill-personality.snippet.md       append to SOUL.md after init (skill rules)
├── workspace/
│   ├── README.md                      explains what lives here
│   ├── watchlist.yaml                 items to monitor (edit this!)
│   └── price-log.md                   created on first run; check history
│   # SOUL.md, USER.md, MEMORY.md are scaffolded on first run from the
│   # official OpenClaw templates — we don't ship copies, to avoid drift.
└── skills/
    └── price-monitor.ts               the monitoring skill itself
```

## How the monitor works (under the hood)

The skill defined in `skills/price-monitor.ts`:

1. Reads watch items from `workspace/watchlist.yaml`.
2. For each item, fetches the URL via `curl` (20-second timeout).
3. Sends the raw page/feed content to the model, asking it to extract the price as JSON.
4. Parses the model's response to get a numeric price.
5. Compares against the item's threshold and direction.
6. If triggered, sends an alert via the configured notify channel.
7. Appends every check (success or failure) to `workspace/price-log.md`.

The heartbeat (automatic checking) is configured in `gateway.config.yaml`:

```yaml
heartbeat:
  interval_minutes: 15
  skill: price-monitor
```

## Where to extend

1. **Add Telegram alerts.** Uncomment the Telegram channel in `gateway.config.yaml`, set tokens in `.env`, change `notify: web` to `notify: telegram`. See [../../guides/07-channels-messaging.md](../../guides/07-channels-messaging.md).
2. **Track price history.** Modify the skill to write a CSV file alongside the log, then chart it later.
3. **Multiple thresholds.** Add "warn" vs "critical" thresholds per item with different alert urgency.
4. **Deploy to a VPS.** Once you trust the workflow, move it somewhere always-on — see [../../guides/04-deploy-vps-hostinger.md](../../guides/04-deploy-vps-hostinger.md).

## Troubleshooting

- No alerts fire → check your threshold/direction logic. Set a threshold that's guaranteed to trigger.
- `price-log.md` shows "price not found" → the model couldn't extract a price from the page. Try a different URL or a simpler page.
- Agent replies "I cannot access that file" → `WATCHLIST_FILE` in `.env` is wrong. Should be `workspace/watchlist.yaml`.
- Heartbeat doesn't fire on a laptop → laptops sleep. Use `npm run check` manually, or deploy to a VPS.
- More problems? → [../../guides/10-troubleshooting.md](../../guides/10-troubleshooting.md).

## Stopping it

```bash
Ctrl-C in the npm run dev terminal
```
