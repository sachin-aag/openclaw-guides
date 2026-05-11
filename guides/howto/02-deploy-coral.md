# 02 · Deploy on coral.inc

Managed hosting for OpenClaw — they run the gateway, you bring the API keys. Reach for it when you want an always-on agent without standing up a VPS.

> **Time:** ~5 minutes
> **Cost:** $50/mo base plan. Workshop attendees get $30 off the first month with code `STUTTGART` (effective $20/mo). See [coral.inc](https://coral.inc) for current pricing.
> **Best for:** demos, sharing a running agent with non-technical teammates, anyone who'd rather pay $50/mo than maintain their own VPS.

## What is coral.inc?

[coral.inc](https://coral.inc) is a managed host for OpenClaw agents. It runs the gateway, persists your memory files, exposes the web UI on a public URL, and handles the boring infrastructure (TLS, restarts, backups). You bring your model API keys.

## Steps

### 1. Sign up

Go to [coral.inc](https://coral.inc) and create an account. Sign in with GitHub for the fewest clicks. At checkout, apply the `STUTTGART` code for $30 off the first month if you attended (or are about to attend) the Stuttgart workshop.

### 2. Create an agent

From the dashboard, click **New agent**. You'll get a setup wizard with two important choices:

- **Template** — pick `news-briefing` for the workshop's Track A, `price-monitor` for Track B, or `blank` to start from scratch.
- **Model provider** — paste an API key for Anthropic, OpenAI, Google, or Featherless. coral.inc stores it encrypted at rest.

### 3. Open the web channel

Once provisioned (~30 seconds), the agent dashboard shows a `Open Web UI` button. Click it. You're now talking to a live OpenClaw agent.

Send a message. Verify the response appears. That's the workshop's success criterion — done.

### 4. (Optional) Edit the memory files

In the dashboard, the **Memory** tab lets you open `SOUL.md`, `USER.md`, and `MEMORY.md` in a browser editor. Save changes, and the next agent turn picks them up — no restart needed.

### 5. (Optional) Add another channel

The **Channels** tab supports adding Telegram, Slack, Discord, and WhatsApp via the same OAuth-style flow you'd use anywhere else. Useful if you want your agent reachable from your phone after the workshop.

## When coral.inc is the right choice

- You don't have Node.js installed and don't want to install it, and you're fine paying for the convenience.
- You're on a locked-down work laptop.
- You want to share the agent's URL with a teammate without explaining how to clone a repo.
- You want cron / heartbeat to actually fire even when your laptop is closed, and you'd rather pay $50/mo than babysit a VPS.

## When it isn't

- You want to edit the agent's TypeScript source code (only memory/skills are editable in the web UI).
- You're optimizing for the lowest monthly cost — a self-hosted €5–15/mo VPS ([Hostinger](03-deploy-vps-hostinger.md), [GCP](04-deploy-vps-gcp.md)) is meaningfully cheaper than $50/mo.
- You have hard data-residency requirements (check coral.inc's docs for region options).

## Migrating off coral.inc later

Everything in OpenClaw is portable. Use the dashboard's **Export** button to download:

- Memory files (`SOUL.md`, `USER.md`, `MEMORY.md`, `notes/*`)
- Session JSONLs
- Skill configs

Drop them into a fresh local install ([01-install-local.md](01-install-local.md)) or a VPS install ([03-deploy-vps-hostinger.md](03-deploy-vps-hostinger.md)) and continue.
