# Workspace

This is your agent's mind on disk. **It starts mostly empty on purpose** — OpenClaw scaffolds the canonical templates here on first run.

## What gets created here

When you run `openclaw init` (or the first time `npm run dev` boots the gateway), OpenClaw writes:

- `SOUL.md` — personality + operating principles ([official template](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md))
- `USER.md` — facts about you, the human
- `MEMORY.md` — long-term notes the agent appends to over time

## Pre-shipped files

- `watchlist.yaml` — defines what prices to monitor, thresholds, and alert directions.
- `price-log.md` — created on first run; every price check is logged here with timestamps.

## Adding skill-specific behavior

The price-monitor skill needs a few extra rules in `SOUL.md` — things like "never hallucinate a price" and "alert only when threshold is crossed."

We ship those in [`../skill-personality.snippet.md`](../skill-personality.snippet.md). After `openclaw init` creates `SOUL.md`, append the snippet:

```bash
cat ../skill-personality.snippet.md >> SOUL.md
```

## How the workshop fits in

1. `npm install`
2. `cp .env.example .env` and add your API key
3. `npm run dev` — first boot scaffolds `SOUL.md / USER.md / MEMORY.md` here
4. `cat ../skill-personality.snippet.md >> SOUL.md` — adds the price-monitor rules
5. Edit `watchlist.yaml` with a target you know will trigger
6. `npm run check` or wait for the heartbeat — alerts appear in the Web UI
