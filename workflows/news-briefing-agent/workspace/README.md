# Workspace

This is your agent's mind on disk. **It starts mostly empty on purpose** — OpenClaw scaffolds the canonical templates here on first run.

## What gets created here

When you run `openclaw init` (or the first time `npm run dev` boots the gateway), OpenClaw writes:

- `SOUL.md` — personality + operating principles ([official template](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md))
- `USER.md` — facts about you, the human
- `MEMORY.md` — long-term notes the agent appends to over time

These are **OpenClaw's templates**, not ours. We don't copy them into this repo so they stay in sync with upstream.

## Pre-shipped files

- `feeds.txt` — list of RSS feed URLs the briefing skill reads from. Edit this to customize your news sources.
- `briefings/` — generated daily briefings land here as `<YYYY-MM-DD>.md` files.

## Adding skill-specific behavior

The news-briefing skill needs a few extra rules in `SOUL.md` — things like "group by topic" and "no editorializing."

We ship those in [`../skill-personality.snippet.md`](../skill-personality.snippet.md). After `openclaw init` creates `SOUL.md`, append the snippet:

```bash
cat ../skill-personality.snippet.md >> SOUL.md
```

## How the workshop fits in

For the workshop, the simplest flow:

1. `npm install`
2. `cp .env.example .env` and add your API key
3. `npm run dev` — first boot scaffolds `SOUL.md / USER.md / MEMORY.md` here
4. `cat ../skill-personality.snippet.md >> SOUL.md` — adds the briefing rules
5. `npm run briefing` — generates today's news digest in `briefings/`
