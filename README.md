# OpenClaw Guides

Practical, opinionated guides for getting started with [OpenClaw](https://openclaw.cc) — the open-source agent gateway with markdown memory, always-on cron, and the Pi coding agent embedded inside.

> Companion repo for the **OpenClaw Hands-On Stuttgart** workshop ([Luma](https://luma.com/cgq6d8j9)). Useful long after the event.

---

## What's in here

```
.
├── blog/                          long-form posts
│   └── getting-started-with-openclaw.md
├── guides/                        bite-sized topic guides
│   ├── 01-concepts.md             Core concepts (mirrors openclaw.cc)
│   ├── 02-install-local.md        Install on your laptop (with risks)
│   ├── 03-deploy-coral.md         Deploy on coral.inc (zero-setup)
│   ├── 04-deploy-vps-hostinger.md Hostinger VPS, Docker, systemd
│   ├── 05-deploy-vps-gcp.md       GCP Compute Engine + Secret Manager
│   ├── 06-channels-web-ui.md      The Web UI channel
│   ├── 07-channels-messaging.md   Telegram or Discord
│   ├── 08-memory-files.md         SOUL.md, USER.md, MEMORY.md patterns
│   ├── 09-cron-and-heartbeat.md   Always-on workflows
│   ├── 10-troubleshooting.md      Common errors and fixes
│   └── 11-pi.md                   The Pi coding agent embedded in OpenClaw
├── workflows/                     starter projects
│   ├── news-briefing-agent/       Track A (beginner)
│   ├── price-monitor/             Track B (intermediate)
│   └── email-monitor/             Track C (advanced)
└── workshop/
    └── stuttgart-2026/            event-day materials
        ├── pre-reqs.md            install BEFORE arriving
        ├── cheatsheet.md          one-pager for participants
        └── volunteer-brief.md     for the TAs
```

## Quickstart (10 minutes)

1. Read [guides/01-concepts.md](guides/01-concepts.md) — the mental model.
2. Pick a deployment target — [local](guides/02-install-local.md), [coral.inc](guides/03-deploy-coral.md), or a [VPS](guides/04-deploy-vps-hostinger.md).
3. Clone a workflow starter from [workflows/](workflows/) and follow its README.
4. When stuck, check [guides/10-troubleshooting.md](guides/10-troubleshooting.md).

For the longer story, read the blog post: [Getting started with OpenClaw](blog/getting-started-with-openclaw.md).

## Key principles (from openclaw.cc)

- **Local-first** — runs on your laptop, your VPS, or your homelab. Cloud is optional.
- **Privacy-focused** — your memory, your messages, your model keys.
- **Extensible** — new tools, new skills, new channels are pluggable.
- **Multi-platform** — one agent, every channel where your humans actually are.

## License

MIT. See [LICENSE](LICENSE). Content is also available under CC BY 4.0 — remix freely for your own meetups.

## Credits

Compiled by the [Creators](https://creators-ecosystem.com) community for the OpenClaw Stuttgart hands-on, with thanks to the OpenClaw maintainers and the Pi project ([@mariozechner/pi-coding-agent](https://github.com/badlogic/pi-mono)).

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
