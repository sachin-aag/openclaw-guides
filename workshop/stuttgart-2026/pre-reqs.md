# Pre-requisites · OpenClaw Hands-On Stuttgart

> Do these **before you arrive on Saturday**. They take 10 minutes total. Skipping them means you'll spend the first 30 minutes of the workshop installing instead of building.

## Mandatory (everyone)

- [ ] **Laptop** with at least 4 GB free disk space.
- [ ] **Node.js 20 LTS or 22 LTS.**
  - macOS: `brew install node@22`
  - Ubuntu: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs`
  - Windows: install [WSL2](https://learn.microsoft.com/windows/wsl/install) + Ubuntu, then follow the Ubuntu steps inside WSL
  - Verify: `node -v` should print `v20.x` or `v22.x`
- [ ] **git** installed. Verify: `git --version`.
- [ ] **A code editor.** VS Code, Cursor, JetBrains, vim — anything you're comfortable with.

## Mandatory: pick one

- [ ] **A model API key** for one of:
  - **Anthropic** ([console.anthropic.com](https://console.anthropic.com)) — recommended, $5 free credit on signup, the workshop tracks are tuned for Claude. **Note:** a Claude Pro/Team subscription does *not* give you API access. You need API credits loaded at [console.anthropic.com](https://console.anthropic.com).
  - **OpenAI** ([platform.openai.com](https://platform.openai.com)) — works fine, no free credit.
  - **Google AI Studio** ([aistudio.google.com](https://aistudio.google.com)) — free tier available, model latency varies.
  - **Featherless** ([featherless.ai](https://featherless.ai)) — generous free tier, access to a wide range of open-source models. **Caveat:** most Featherless models top out at 32K context, which can be tight for OpenClaw agents that load `SOUL.md` + `MEMORY.md` + notes into every turn. Fine for the workshop; keep an eye on context limits in longer sessions.

  **Set a hard spending limit of €10/mo in your provider dashboard.** Costs accidents happen; ceilings prevent regret.

## Strongly recommended

- [ ] **Set the spending cap.** Seriously. Five seconds in the dashboard saves a four-figure mistake.
- [ ] **Test that your laptop can run the starter.** Try this on Friday night:

  ```bash
  git clone https://github.com/creators-stuttgart/openclaw-guides
  cd openclaw-guides/workflows/news-briefing-agent
  npm install
  ```

  If `npm install` fails, post in the workshop Discord (link below) — we can help before doors open.

- [ ] **Optional: set up a Telegram bot** if you want notifications from your agent. Message [@BotFather](https://t.me/botfather) on Telegram, create a bot, and save the token. Not required — all tracks work with the Web UI alone.

## After the workshop (optional)

- [ ] **Want an always-on managed home for your agent?** [coral.inc](https://coral.inc) is the lowest-friction option — no VPS to maintain, web UI for editing memory files. It's $50/mo for the base plan; workshop attendees get $30 off the first month with code `STUTTGART`. Not needed for the workshop itself — if your local install breaks on the day, pair with a neighbor instead (see the cheatsheet).

## At the door

- [ ] **Power adapter** — power strips at every cluster of tables, but bring your own brick.
- [ ] **Headphones** — optional, but useful when the room is noisy and you're debugging.

## Get help before the day

- **Workshop Discord/Slack:** *(invite link printed on the cheatsheet given out at the door, or DM the organizers via the [Luma event](https://luma.com/cgq6d8j9))*
- **OpenClaw docs:** [openclaw.cc](https://openclaw.cc) and [docs.openclaw.ai](https://docs.openclaw.ai)
- **This repo:** clone it now and skim [`guides/howto/01-install-local.md`](../../guides/howto/01-install-local.md). 5 minutes.
