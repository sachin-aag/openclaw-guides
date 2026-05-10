# Track A · Daily Review Agent

> An OpenClaw skill that reads yesterday's notes and writes a one-page summary to `daily-review.md`. The "hello world" of always-on agents.

## What it does

- You jot quick notes during the day via the Web UI chat — they go into `notes/<today>.md`.
- You trigger the review (manually for the workshop, on cron in production).
- The agent reads yesterday's `notes/*.md`, generates a structured summary, and writes `daily-review.md`.
- The agent confirms in chat with a 3-bullet TL;DR.

## Definition of done (workshop bar)

You run `npm run review`, a `daily-review.md` appears in the workspace folder, and the agent posts a confirmation message in the Web UI.

## Prerequisites

- Node 20+ (`node -v`)
- An API key for one of: Anthropic, OpenAI, Google
- ~10 minutes

## Setup

```bash
npm install
cp .env.example .env
# edit .env: pick a provider, paste an API key
npm run dev
```

First boot calls `openclaw init` under the hood, which scaffolds the canonical
`SOUL.md`, `USER.md`, `MEMORY.md`, and `notes/` into `workspace/` from the
[official OpenClaw templates](https://github.com/openclaw/openclaw/tree/main/docs/reference/templates).

Then add this skill's behavior on top:

```bash
cat skill-personality.snippet.md >> workspace/SOUL.md
npm run reload
```

Open `http://localhost:3000`. Send a couple of test messages — they're stored as today's notes.

In a second terminal, trigger the review:

```bash
npm run review
```

A `daily-review.md` appears alongside this README. Open it. You should see:

- A header with yesterday's date
- A "Summary" section (3–5 bullets)
- A "Decisions made" section (if any)
- A "Open questions" section
- An "Action items" section

## Files in this skill

```
.
├── README.md                          this file
├── package.json                       OpenClaw + Pi pinned deps
├── .env.example                       configuration template
├── gateway.config.yaml                gateway config (cron, channels, memory paths)
├── skill-personality.snippet.md       append to SOUL.md after init (skill rules)
├── workspace/
│   └── README.md                      explains what openclaw init scaffolds here
│   # SOUL.md, USER.md, MEMORY.md, notes/ are scaffolded on first run from the
│   # official OpenClaw templates — we don't ship copies, to avoid drift.
└── skills/
    └── daily-review.ts                the review skill itself
```

## How the review works (under the hood)

The skill defined in `skills/daily-review.ts`:

1. Computes yesterday's date.
2. Uses `Read` to load `workspace/notes/<yesterday>.md` (and any others matching `look_back_days`).
3. Sends them to the model with a system prompt that asks for a structured summary.
4. Uses `Write` to save the result to `daily-review.md`.
5. Calls the `notify: web` tool to post a confirmation in the chat.

The schedule (when running on a VPS) lives in `gateway.config.yaml`:

```yaml
cron:
  - name: morning-review
    schedule: "30 7 * * *"
    skill: daily-review
```

## Where to extend

1. **Add an evening reflection.** Add a second cron entry that asks "what's worth keeping from today?" and appends `#keep`-tagged answers to `MEMORY.md`.
2. **Email the review.** Replace `notify: web` with a Resend or SMTP call so the review lands in your inbox at 07:30.
3. **Multi-channel.** Wire up Telegram via [../../guides/07-channels-messaging.md](../../guides/07-channels-messaging.md) so you can chat from your phone.
4. **Deploy to a VPS.** Once you trust the workflow, move it somewhere always-on — see [../../guides/04-deploy-vps-hostinger.md](../../guides/04-deploy-vps-hostinger.md).

## Troubleshooting

- `daily-review.md` is empty → no notes existed for yesterday. Add a few via the Web UI today, then run `npm run review` *tomorrow* (or pass `--days 0` for today).
- Agent replies "I cannot access that file" → `WORKSPACE_DIR` in `.env` is wrong. Should be `./workspace` (relative to this folder).
- More problems? → [../../guides/10-troubleshooting.md](../../guides/10-troubleshooting.md).

## Stopping it

```bash
Ctrl-C in the npm run dev terminal
```
