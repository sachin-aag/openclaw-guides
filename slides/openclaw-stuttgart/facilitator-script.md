# Facilitator Script — OpenClaw Hands-On Stuttgart

**Duration:** 16:00–20:00 (Hands-On 16:00–17:40 · break 17:40–18:00 · Showcase 18:00–20:00)
**Format:** ~25 min impulse + ~10 min tracks/setup + **60 min build** (to 17:40) · **20 min break** · **Showcase 18:00–20:00** (planned demos + open slots)
**Audience:** ~50 builders, mixed experience, mostly beginners with OpenClaw

---

## 16:00–16:10 · Welcome (Slides 1–3)

**Tone:** Warm, low-pressure. Most people have never touched OpenClaw.

> "Welcome to OpenClaw Hands-On Stuttgart. From now until 17:40 we're building—by the break, aim to have a tiny but real skill running. After a deliberate pause, the Showcase opens at 18:00: planned demos plus open slots if you want to show what you shipped today."

**Cues:**
- Slide 1 (title) — let it breathe for 10 seconds; host line is on the title slide if you want one line per org
- Slide 2 (success criteria) — **read this slide out loud verbatim.** This is the anchor for the whole session.
- Slide 3 (agenda) — point at where we are (16:00 block)

---

## 16:10–16:30 · Impulse: What is OpenClaw? (Slides 4–12)

**Tone:** Visual, fast. Don't go deep on config. The goal is the mental model.

- **Slide 4 — Architecture overview.** "Here's the official picture: a user sends a message into a channel, the gateway routes it to an agent, the agent picks a model, response goes back. That's it. Everything else is just *which* channel, *which* agent, *which* model."

- **Slide 5 — Gateway.** "The gateway is the central hub. It doesn't know about WhatsApp or Telegram or your CLI specifically. It speaks one normalized language and channels translate."

- **Slide 6 — Channels.** "Channels are how the outside world reaches OpenClaw. Today we're using just **one** channel — the web UI — to keep things simple."

- **Slide 7 — Memory as Markdown (SOUL.md).** "This is the part people don't believe at first. Your agent's personality and long-term memory live in **plain markdown files you can open in any editor**. SOUL.md is an official OpenClaw template. You can `cat`, `vim`, `git diff` your agent."

- **Slide 8 — Always-on (cron / heartbeat).** "OpenClaw isn't a chatbot that wakes up when you talk to it. It can run on a heartbeat — wake every minute, check things, write to memory, message you. Daily-review agents are the canonical example."

- **Slide 9 — Why people love it.** Read the four bullets, don't elaborate.

- **Slide 10 — Pi: the coding brain.** "OpenClaw embeds Pi — a coding agent with Read, Write, Edit, and Bash tools. That's why your agent can actually *do* things, not just chat."

- **Slide 11 — Key Principles.** Local-first, Privacy-focused, Extensible, Multi-platform. One sentence each.

- **Slide 12 — Live demo.** **SWITCH TO TERMINAL/BROWSER.** Send a message → OpenClaw appends to a markdown log → replies with a summary. **2 minutes max.** If it breaks, laugh and move on — the recovery is the lesson.

---

## 16:30–16:40 · Tracks + Setup (Slides 13–17)

**Tone:** Practical. Get people moving.

- **Slide 13 — The 3 Skills for today.** Walk through Track A / B / C. Note that C is for advanced folks — *most people should pick A or B.*

- **Slide 14 — Pick your Skill, form pairs/trios.** **Roles: driver / docs / debugger.** Wait 60 seconds while people physically move and pair up.

- **Slide 15 — Setup in 4 steps.** "Don't try to memorize this — every step is in the repo. The cheatsheet on your table has the URL."

- **Slide 16 — Where to deploy.** "For today, **local is fine**. If you don't want to install anything, use the shared coral.inc instance — URL on your cheatsheet. VPS is for after the workshop."

- **Slide 17 — Volunteer zones + installation bar.** Point at the room. "If you're stuck for more than 5 minutes, raise a hand. There's an installation bar at the back if you have hard setup issues — a volunteer will sit with you while everyone else keeps going."

---

## 16:40–17:40 · Build (Slide 18 stays on screen)

**Tone:** Hands off. You become a roving TA.

- **Slide 18 — Success criteria** stays projected the whole hour. People can re-read it whenever they're lost.

**Volunteer triage rule (brief them on this beforehand):**

| Level | Symptom | Action |
|---|---|---|
| L1 | Config / env-var / typo / Node version | Pair with the participant, fix it together |
| L2 | Hard install break, OS-specific, OpenClaw bug | Park them on the **shared demo agent** so they can still play. Volunteer fixes their machine in parallel |

**At ~17:00 (mid-point):** Pause for 30 seconds. From the front:

> "Quick check — raise your hand if you **can't yet** send a message and see anything happen. Volunteers, go to those hands. Everyone else, keep building."

**At ~17:30 (10 min warning):** From the front:

> "Ten minutes until we wrap the build slot. Push for message → markdown → reply—even if it's held together with duct tape. **We're not doing on-stage micro-demos here** — there's a proper break, then the Showcase at 18:00 has room for quick 'here's what I built' stories. Land the skill; storytelling comes later."

---

## 17:40–20:00 · Break + Showcase hand-off (Slides 19–21)

**Tone:** Warm close to the *hands-on* block—not the end of the night. People should know the Showcase is where demos happen.

- **Slide 19 — Break + Showcase bridge.** The slide is built to **read left → right**: the top rail is the timeline (hands-off → break → showcase); the two panels are break vs. showcase. Emphasize **held demos + blank run-sheet slots** for today's builds. Encourage signing up with whoever owns the list.

- **Slide 20 — Next steps tile grid.** Reinforce: 18:00 Showcase is set-list + empty chairs for brave first-timers.

- **Slide 21 — QR / resources.** Point people to:
  - The guides repo (long-form tutorials)
  - The Discord/Slack
  - **Where and when to queue for an open Showcase slot** (your org's actual process)

- **Slide 22 — Thanks / build** *(optional)* — "Now build something" outro if you have a few seconds before switching off the deck.

---

## Track success criteria ("Done for this workshop")

| Track | Done means |
|---|---|
| **A · Daily review agent** | Trigger the agent manually → `daily-review.md` exists and contains a summary the agent generated. |
| **B · Scratchpad assistant** | Send "save this: <anything>" in chat → check `notes.md` and your line is there → agent confirms in chat. |
| **C · Folder watcher** *(advanced)* | Drop a `.txt` into `inbox/` → within 30s, a `summaries/<name>.md` appears with a 3-bullet summary. |

---

## Equipment checklist

- [ ] Projector at 1920×1080, deck open in fullscreen (`F`)
- [ ] Backup deck on USB (PDF export) in case of WiFi/projector hiccups
- [ ] Demo laptop with the working skill **already running** before doors open
- [ ] Shared coral.inc instance URL printed on cheatsheets
- [ ] Volunteer briefing done 30 min before doors (use `volunteer-brief.md` from the guides repo)
- [ ] Mic + a roving handheld for Q&A
- [ ] Power strips at every cluster of tables
