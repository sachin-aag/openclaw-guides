# Track C · Folder Watcher (advanced)

> Drop a `.txt` into `inbox/`, get a 3-bullet summary in `summaries/<name>.md` within a minute. Uses the OpenClaw heartbeat — your first taste of always-on.

> **For people comfortable enough with the terminal that "tail a log" doesn't scare you.** If that's not you, do Track A or B first.

## What it does

- Every minute, the agent's heartbeat fires `folder-watcher.scan`.
- The skill lists `inbox/*.txt`, picks anything new, and produces a `summaries/<basename>.md` containing a 3-bullet TL;DR plus an "Action items" line.
- Processed files are moved to `inbox/processed/` so they don't get summarized twice.

## Definition of done

You drop `inbox/article.txt` in. Within ~60 seconds, `summaries/article.md` exists with a meaningful summary, and `inbox/article.txt` has moved to `inbox/processed/article.txt`.

## Setup

```bash
npm install
cp .env.example .env       # add your model API key
npm run dev
cat skill-personality.snippet.md >> workspace/SOUL.md
npm run reload

# create the input folder, then drop a test file:
mkdir -p workspace/inbox workspace/summaries
echo "OpenClaw is an open-source agent gateway with markdown memory." > workspace/inbox/test.txt

# watch it happen:
tail -f sessions/*.jsonl
```

## Files

```
.
├── README.md
├── package.json
├── .env.example
├── gateway.config.yaml              heartbeat config — fires every 60s
├── skill-personality.snippet.md
├── workspace/
│   └── README.md                    SOUL.md / USER.md / MEMORY.md scaffolded by openclaw init
└── skills/
    └── folder-watcher.ts            scan + summarize + move
```

## How the heartbeat works

In `gateway.config.yaml`:

```yaml
heartbeat:
  interval_minutes: 1
  skill: folder-watcher
  args:
    inbox: workspace/inbox
    out: workspace/summaries
    archive: workspace/inbox/processed
```

The gateway calls `folder-watcher.scan` every 60 seconds. The skill is **idempotent** — if `inbox/` is empty (or only contains processed files), the skill returns silently and costs nothing meaningful.

## Watch out

- Heartbeat intervals shorter than ~30s will hit model rate limits when you drop many files at once. 60s is a safe default for the workshop.
- If the skill crashes mid-summary, the file stays in `inbox/` and gets retried next tick. Fine for transient errors; a problem if your file consistently breaks the model (e.g. binary file). Add a `.failed/` archive in production.
- Heartbeat only fires while the gateway is running. Laptop closed = nothing happens. See [../../guides/09-cron-and-heartbeat.md › Local laptop reality check](../../guides/09-cron-and-heartbeat.md#local-laptop-reality-check).

## Where to extend

1. **Other file types.** Add `.md`, `.pdf`, `.html` handlers (PDF needs a text-extraction step — `pdftotext` via Bash).
2. **Email summaries to yourself.** After writing the summary, call out to Resend or SMTP.
3. **Vector search over summaries.** Once you have 200 summaries, the natural next step is a `summaries/` index for quick lookup. Out of scope for the workshop.

## Troubleshooting

- File sits in `inbox/` and nothing happens → is the gateway actually running? `ps aux | grep openclaw`. Check logs for `[heartbeat] folder-watcher fired …`.
- File gets summarized but the summary is generic → your test file is probably too short for the model to say anything specific. Try a real article (200+ words).
- Model bills are scaring you → bump `interval_minutes` to 5 or 15. The heartbeat is a knob.
