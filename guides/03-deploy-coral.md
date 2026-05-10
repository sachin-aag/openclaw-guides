# 03 · Deploy on coral.inc

Zero install. Everything in the browser. The fastest path from "never used OpenClaw" to "I have an agent running."

> **Time:** ~5 minutes
> **Cost:** free tier (then usage-based — see [coral.inc/pricing](https://coral.inc))
> **Best for:** workshop participants who don't want to install anything, demos, sharing a running agent with non-technical teammates.

## What is coral.inc?

[coral.inc](https://coral.inc) is a managed host for OpenClaw agents. It runs the gateway, persists your memory files, exposes the web UI on a public URL, and handles the boring infrastructure (TLS, restarts, backups). You bring your model API keys.

## Steps

### 1. Sign up

Go to [coral.inc](https://coral.inc) and create an account. Sign in with GitHub for the fewest clicks.

### 2. Create an agent

From the dashboard, click **New agent**. You'll get a setup wizard with two important choices:

- **Template** — pick `daily-review` for the workshop's Track A, `scratchpad` for Track B, or `blank` to start from scratch.
- **Model provider** — paste an API key for Anthropic, OpenAI, or Google. coral.inc stores it encrypted at rest.

### 3. Open the web channel

Once provisioned (~30 seconds), the agent dashboard shows a `Open Web UI` button. Click it. You're now talking to a live OpenClaw agent.

Send a message. Verify the response appears. That's the workshop's success criterion — done.

### 4. (Optional) Edit the memory files

In the dashboard, the **Memory** tab lets you open `SOUL.md`, `USER.md`, and `MEMORY.md` in a browser editor. Save changes, and the next agent turn picks them up — no restart needed.

### 5. (Optional) Add another channel

The **Channels** tab supports adding Telegram, Slack, Discord, and WhatsApp via the same OAuth-style flow you'd use anywhere else. Useful if you want your agent reachable from your phone after the workshop.

## When coral.inc is the right choice

- You don't have Node.js installed and don't want to install it.
- You're on a locked-down work laptop.
- You want to share the agent's URL with a teammate without explaining how to clone a repo.
- You want cron / heartbeat to actually fire even when your laptop is closed.

## When it isn't

- You want to edit the agent's TypeScript source code (only memory/skills are editable in the web UI).
- You're optimizing for the lowest possible monthly cost (a self-hosted €5/mo VPS is cheaper at scale).
- You have hard data-residency requirements (check coral.inc's docs for region options).

## Migrating off coral.inc later

Everything in OpenClaw is portable. Use the dashboard's **Export** button to download:

- Memory files (`SOUL.md`, `USER.md`, `MEMORY.md`, `notes/*`)
- Session JSONLs
- Skill configs

Drop them into a fresh local install ([02-install-local.md](02-install-local.md)) or a VPS install ([04-deploy-vps-hostinger.md](04-deploy-vps-hostinger.md)) and continue.

## Workshop tip

If your local install breaks during the hands-on, **switch to coral.inc immediately** — don't burn 30 minutes debugging Node versions. The shared workshop coral instance URL is on the [cheatsheet](../workshop/stuttgart-2026/cheatsheet.md).
