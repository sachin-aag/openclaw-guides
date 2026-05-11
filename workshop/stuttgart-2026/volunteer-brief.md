# Volunteer brief · OpenClaw Hands-On Stuttgart

> Read this **30 minutes before doors open**. The session lives or dies on volunteer triage.

---

## Your job

You are a roving teaching assistant. Your job is to **keep people building**. Not to teach OpenClaw end-to-end. Not to refactor their setup. Keep them building.

You succeed when participants leave with **something running**, even if it's hacky. You fail when one person eats an hour of your time and the other 15 in your zone get nothing.

---

## Zone assignments

The room is split into 3 zones plus an installation bar at the back.

| Zone | Track | You support participants who picked... |
|---|---|---|
| **1** | A · news-briefing | folks building a daily RSS news briefing agent |
| **2** | B · price-monitor | folks building a price monitoring + alerting system |
| **3** | C · email-monitor | advanced folks using IMAP + urgency classification |
| **Installation bar** | (back of room) | anyone whose setup is broken in a deep way |

You'll be assigned a zone before doors. **Stay in your zone.** Beginners pair-program with you, you get to know their context, you can fix things faster the second time.

---

## Triage rule (memorize this)

> **L1 = pair through it. L2 = pair them with a working neighbor.**

| Level | Symptom | Action |
|---|---|---|
| **L1** | Wrong Node version, `EACCES`, missing API key, typo in `.env`, `Cannot find module`, agent loaded wrong file path | Sit next to them, fix it together. ~5 minutes. |
| **L2** | OS-specific install break, suspected OpenClaw bug, npm hangs forever on this network, mystery error after 15 min of poking | **Pair them with a participant whose install works** — they share a screen and edit memory files together. Then come back to fix the broken install in parallel — *but never block the participant on it.* coral.inc with code `STUTTGART` ($30 off $50/mo) is a paid post-workshop option, not a real-time escape. |

The L2 move is the single most important rule. **Better that someone *uses* an agent on a working laptop than spend the whole session debugging Node.**

---

## Common issues, ranked by frequency we expect

1. **`Cannot find module '@mariozechner/pi-coding-agent'`** → they're in the wrong folder. `cd workflows/<track>/`.
2. **`EACCES` on npm** → `sudo chown -R $(whoami):$(id -gn) ~/.npm ./node_modules`.
3. **`401 Unauthorized`** → API key isn't loaded in the shell. Restart terminal or `export $(grep -v '^#' .env | xargs)`.
4. **Agent replies but doesn't write the file** → check `WORKSPACE_DIR` in `.env`. Should be `./workspace` (relative to the workflow folder).
5. **Tone/language wrong after editing SOUL.md** → they didn't run `npm run reload`.
6. **Cron / heartbeat doesn't fire on a laptop** → laptops sleep. For the workshop, use manual `npm run briefing` / `npm run check` / `npm run scan` instead.
7. **Windows-specific issues** → push them to WSL2 if they're not already; otherwise pair them with a Mac/Linux neighbor.
8. **Track A bot misbehaving (`npm run bot`)** → tell them to stop it (`Ctrl-C`). The `npm run briefing` file flow still works — that's the workshop bar. The bot is Step 3, optional, post-baseline. **Don't debug `npm run bot` live during the session** — it's a long-running process with Telegram + cron + LLM in one and isn't a 5-minute fix.

Full reference: [`guides/howto/06-troubleshooting.md`](../../guides/howto/06-troubleshooting.md). Read it once before doors.

---

## What "good" looks like at each checkpoint

- **16:30** — All your zone has picked a track and is in pairs/trios.
- **16:50** — Most of your zone has their track's script running (`npm run briefing` for A, `npm run check` for B, `npm run scan` for C). The 2–3 that don't are the ones to focus on.
- **17:00** — *(facilitator pauses for a hand-raise check)* — anyone with their hand up gets you within 60 seconds.
- **17:30** — Everyone in your zone has either hit the success criterion or is sitting at the installation bar / paired with a neighbor.
- **17:40** — Build block ends. Help your zone **pack up mentally**: laptops closed, stretch, snacks. If someone has something demo-worthy, **point them to whoever runs the Showcase sign-up sheet** — open-mic slots are real; two minutes, no deck required.

---

## Things to **not** do

- **Don't refactor their code.** They want to learn, not watch you type.
- **Don't lecture about OpenClaw architecture.** That's the impulse's job. If they ask, point at the slide deck or the [`concepts/01-concepts.md`](../../guides/concepts/01-concepts.md) link.
- **Don't get pulled into "what about LangGraph / CrewAI / AutoGen?"** Smile, say "great Showcase question, ask after 18:00," move on.
- **Don't fix things alone.** Always pair — that's the learning moment.

---

## When you're not actively helping

Walk your zone slowly. Look over shoulders. **Ask "how's it going?"** to anyone who looks stuck but didn't raise a hand. Most beginners under-ask for help; you have to fish.

---

## Emergency contacts

- **Lead facilitator:** _(name + phone)_ — interrupt them only for room issues, not technical issues
- **Workshop ops (snacks, power, mic):** _(name + phone)_
- **Building/Frameworx contact:** _(name + phone)_

---

## 17:40–18:00 · Break

Hands-on is **paused**. You're not doing tech support in the hallway unless someone is truly stuck—prefer "we'll debug after the Showcase."

## 18:00 · Showcase starts

Show up if you can. You've earned the audience. If the room needs queue-wrangling for open slots, help the facilitator until things are rolling—then you're off the hook.

Thank you.
