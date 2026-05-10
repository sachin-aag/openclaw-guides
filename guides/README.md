# Guides

Two halves, two different reading modes.

- **[concepts/](concepts/)** — read these to *understand* what something is and why it works the way it does. Sit with a coffee, no laptop required.
- **[howto/](howto/)** — read these to *do* something specific, in order. Have a terminal open.

If you're brand new, start with [concepts/01-concepts.md](concepts/01-concepts.md), then jump to a how-to that matches where you want OpenClaw to run.

## concepts/

| # | Guide | What it covers |
|---|-------|----------------|
| 01 | [Core concepts](concepts/01-concepts.md) | The mental model — gateway, skills, channels, memory. Mirrors openclaw.cc. |
| 02 | [The Web UI channel](concepts/02-channels-web-ui.md) | What the bundled web UI is, and what it's good for. |
| 03 | [Memory files](concepts/03-memory-files.md) | `SOUL.md`, `USER.md`, `MEMORY.md` — what each is for and the patterns that work. |
| 04 | [Cron and the heartbeat](concepts/04-cron-and-heartbeat.md) | How always-on workflows actually fire, and the idempotency rule. |
| 05 | [Pi](concepts/05-pi.md) | The coding agent embedded in OpenClaw — what it is and how it's wired in. |

## howto/

| # | Guide | When to reach for it |
|---|-------|----------------------|
| 01 | [Install on your laptop](howto/01-install-local.md) | Local-first dev install. Includes the risk callouts. |
| 02 | [Deploy on coral.inc](howto/02-deploy-coral.md) | Zero-setup hosted instance. Fastest path to "it's running." |
| 03 | [Deploy on Hostinger](howto/03-deploy-vps-hostinger.md) | Three doors: 1-click managed, 1-click VPS, or manual KVM build. |
| 04 | [Deploy on GCP](howto/04-deploy-vps-gcp.md) | Compute Engine + Secret Manager. |
| 05 | [Add a messaging channel](howto/05-channels-messaging.md) | Wire up Telegram or Discord. |
| 06 | [Troubleshooting](howto/06-troubleshooting.md) | Common errors and fixes. Skim before the workshop. |
