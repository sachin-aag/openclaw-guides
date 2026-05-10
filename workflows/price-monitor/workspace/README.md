# Workspace

This folder holds input data and generated output for the price monitor.

## Pre-shipped files

- `watchlist.yaml` — defines what prices to monitor, thresholds, and alert directions.
- `price-log.md` — created on first run; every price check is logged here with timestamps.

## Adding skill-specific behavior

The price-monitor skill's personality rules are documented in [`../skill-personality.snippet.md`](../skill-personality.snippet.md). These are baked into the system prompt in the standalone version.

## Quick start

1. `npm install`
2. `cp .env.example .env` and add your API key
3. Edit `watchlist.yaml` with a target you know will trigger
4. `npm run check` — alerts appear in the console, log entry written to `price-log.md`
