# Track B · Scratchpad Assistant

> A chat agent that takes notes for you. Say `save this: …` and the line lands in `notes.md`. Most generally useful of the three workshop tracks.

## What it does

- You chat normally in the Web UI.
- When your message starts with `save this:` (or `note:` or `remember:`), the agent appends the rest of the line to `notes.md` with a timestamp, and confirms in chat.
- Anything else is a normal conversation — the agent can answer, search prior notes, or summarize.

## Definition of done (workshop bar)

You send `save this: try the new Vietnamese place near Frameworx`. The agent replies "saved." A `notes.md` file in the workspace contains your line with today's timestamp.

## Setup

```bash
npm install
cp .env.example .env       # add your model API key
npm run dev
cat skill-personality.snippet.md >> workspace/SOUL.md
npm run reload
```

Open `http://localhost:3000`. Try:

```
save this: I want to learn more about agent loops.
what have I saved this week?
remember: I prefer Claude over GPT for prose.
```

## Files

```
.
├── README.md
├── package.json
├── .env.example
├── gateway.config.yaml
├── skill-personality.snippet.md     append to SOUL.md after init
├── workspace/
│   └── README.md                    SOUL.md / USER.md / MEMORY.md scaffolded by openclaw init
└── skills/
    └── scratchpad.ts                save / list / search behavior
```

## How it works

The `scratchpad` skill defines three sub-actions the agent invokes based on intent:

- `save(line)` → appends `- [<HH:MM>] <line>` under today's `## YYYY-MM-DD` header in `notes.md`.
- `list(days)` → reads the last N days of headers and shows them.
- `search(query)` → greps `notes.md` for matching lines.

The agent reads `notes.md` on every turn so it has fresh context.

## Where to extend

1. **Tags.** Treat any `#word` in a saved line as a tag and let the agent filter by tag.
2. **Daily roll-up.** Add a cron entry that summarizes yesterday's saves into `weekly-digest.md`.
3. **Voice input.** Wire up Telegram (see [../../guides/07-channels-messaging.md](../../guides/07-channels-messaging.md)) and dictate notes from your phone.

## Troubleshooting

- Agent saves but you can't find the file → check `WORKSPACE_DIR` in `.env`. By default it's `./workspace`, so look in `workspace/notes.md`.
- Agent treats every message as a save → SOUL.md was over-fitted. The snippet uses the prefix `save this:` deliberately. If you removed the prefix rule, restore it.
- More problems? → [../../guides/10-troubleshooting.md](../../guides/10-troubleshooting.md).
