# Workspace

This folder holds input data and generated output for the news briefing agent.

## Pre-shipped files

- `feeds.txt` — list of RSS feed URLs the briefing skill reads from. Edit this to customize your news sources.
- `briefings/` — generated daily briefings land here as `<YYYY-MM-DD>.md` files.

## Adding skill-specific behavior

The news-briefing skill's personality rules are documented in [`../skill-personality.snippet.md`](../skill-personality.snippet.md). These are baked into the system prompt in the standalone version.

## Quick start

1. `npm install`
2. `cp .env.example .env` and add your API key
3. `npm run briefing` — generates today's news digest in `briefings/`
