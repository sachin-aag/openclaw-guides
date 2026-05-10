# Cheatsheet · OpenClaw Hands-On Stuttgart

> One-pager for participants. Print double-sided. Keep on your table.

---

## Today's success criterion

> **Send a message → OpenClaw writes a markdown file → confirmation appears in chat.**
> That's it. Anything beyond is bonus.

---

## Pick a track

| Track | What you'll build | Difficulty |
|---|---|---|
| **A** · news-briefing | Fetches RSS feeds, generates a daily news briefing to markdown + optional Telegram | beginner |
| **B** · price-monitor | Watches product/stock prices, alerts when thresholds are crossed | intermediate (heartbeat) |
| **C** · email-monitor | Monitors Gmail inbox via IMAP, summarizes & classifies emails by urgency | advanced (heartbeat + IMAP) |

---

## Setup in 4 commands

```bash
git clone https://github.com/creators-stuttgart/openclaw-guides
cd openclaw-guides/workflows/<your-track>      # news-briefing-agent | price-monitor | email-monitor
npm install
cp .env.example .env       # paste your API key in the file
npm run dev
```

Then in the same folder:

```bash
cat skill-personality.snippet.md >> workspace/SOUL.md
npm run reload
```

Open **http://localhost:3000** and start chatting.

---

## Stuck? Three rules

1. **Stuck > 5 minutes** → raise a hand. A volunteer will come.
2. **Setup is broken in a deep way** → walk to the **installation bar at the back**. Don't burn 30 minutes alone.
3. **Stuck > 1 hour** → switch to the shared **coral.inc workshop instance**:
   - URL: *(printed at the top of the room — ask a volunteer)*
   - Workshop access code: *(handed out at the door)*

---

## Common 30-second fixes

| Problem | Fix |
|---|---|
| `Cannot find module …` | You're in the wrong folder. `cd workflows/<track>/` first. |
| `EACCES` on npm | `sudo chown -R $(whoami) ~/.npm ./node_modules` |
| `401 Unauthorized` | API key isn't loaded. Re-source `.env` or restart the terminal. |
| Agent replies but no file appears | `WORKSPACE_DIR` in `.env` is wrong. Should be `./workspace`. |
| Wrong tone / language | You edited `SOUL.md` but didn't `npm run reload`. |

Full troubleshooting: [`guides/10-troubleshooting.md`](../../guides/10-troubleshooting.md)

---

## After the build (17:40+)

- **17:40 — 18:00 · Break** — on purpose. Refill, breathe, find a seat. The Showcase is next.
- **18:00 — 20:00 · OpenClaw Showcase** — curated demos **plus** spare slots for today's builds. If you shipped something, ask a volunteer how to grab a short open-mic turn.
- **Discord/Slack:** invite link on the back of this cheatsheet (or in the workshop terminal).
- **Long-form guides:** [github.com/creators-stuttgart/openclaw-guides](https://github.com/creators-stuttgart/openclaw-guides)
- **Official OpenClaw docs:** [openclaw.cc](https://openclaw.cc)
- **Pi (the embedded coding agent):** [docs.openclaw.ai/pi](https://docs.openclaw.ai/pi)

---

*Hosted by KI-Bundesverband · Startup Stuttgart · Creators · 2026-05-09*
