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
  - **Anthropic** ([console.anthropic.com](https://console.anthropic.com)) — recommended, $5 free credit on signup, the workshop tracks are tuned for Claude.
  - **OpenAI** ([platform.openai.com](https://platform.openai.com)) — works fine, no free credit.
  - **Google AI Studio** ([aistudio.google.com](https://aistudio.google.com)) — free tier available, model latency varies.

  **Set a hard spending limit of €10/mo in your provider dashboard.** Costs accidents happen; ceilings prevent regret.

## Strongly recommended

- [ ] **Set the spending cap.** Seriously. Five seconds in the dashboard saves a four-figure mistake.
- [ ] **Test that your laptop can run the starter.** Try this on Friday night:

  ```bash
  git clone https://github.com/creators-stuttgart/openclaw-guides
  cd openclaw-guides/workflows/daily-review-agent
  npm install
  ```

  If `npm install` fails, post in the workshop Discord (link below) — we can help before doors open.

## Optional escape hatch

- [ ] **Sign up for [coral.inc](https://coral.inc).** Free tier, zero install. If your local install breaks during the workshop, you can switch to the cloud version in 60 seconds and not lose the session.

## At the door

- [ ] **Power adapter** — power strips at every cluster of tables, but bring your own brick.
- [ ] **Headphones** — optional, but useful when the room is noisy and you're debugging.

## Get help before the day

- **Workshop Discord/Slack:** *(invite link printed on the cheatsheet given out at the door, or DM the organizers via the [Luma event](https://luma.com/cgq6d8j9))*
- **OpenClaw docs:** [openclaw.cc](https://openclaw.cc) and [docs.openclaw.ai](https://docs.openclaw.ai)
- **This repo:** clone it now and skim [`guides/02-install-local.md`](../../guides/02-install-local.md). 5 minutes.
