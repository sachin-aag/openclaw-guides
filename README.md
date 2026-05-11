# OpenClaw Guides

Practical, opinionated guides for getting started with [OpenClaw](https://openclaw.cc) — the open-source agent gateway with markdown memory, always-on cron, and the Pi coding agent embedded inside.

> Companion repo for the **OpenClaw Hands-On Stuttgart** workshop ([Luma](https://luma.com/cgq6d8j9)). Useful long after the event.

---

## What's in here

```
.
├── blog/                          long-form posts
│   └── getting-started-with-openclaw.md
├── guides/                        bite-sized topic guides, split by intent
│   ├── concepts/                  what things are and how they fit together
│   │   ├── 01-concepts.md             Core concepts (mirrors openclaw.cc)
│   │   ├── 02-channels-web-ui.md      The Web UI channel
│   │   ├── 03-memory-files.md         SOUL.md, USER.md, MEMORY.md patterns
│   │   ├── 04-cron-and-heartbeat.md   Always-on workflows
│   │   └── 05-pi.md                   The Pi coding agent embedded in OpenClaw
│   └── howto/                     do this thing, in this order
│       ├── 01-install-local.md        Install on your laptop (with risks)
│       ├── 02-deploy-coral.md         Deploy on coral.inc (managed, paid)
│       ├── 03-deploy-vps-hostinger.md Hostinger: 1-click managed, 1-click VPS, or manual KVM build
│       ├── 04-deploy-vps-gcp.md       GCP Compute Engine + Secret Manager
│       ├── 05-channels-messaging.md   Telegram or Discord
│       └── 06-troubleshooting.md      Common errors and fixes
├── workflows/                     standalone starter projects
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

1. Read [guides/concepts/01-concepts.md](guides/concepts/01-concepts.md) — the mental model.
2. Pick a deployment target — [local](guides/howto/01-install-local.md) or a VPS on [Hostinger](guides/howto/03-deploy-vps-hostinger.md) (managed → DIY) / [GCP](guides/howto/04-deploy-vps-gcp.md). If you'd rather pay than configure, [coral.inc](guides/howto/02-deploy-coral.md) is the managed option.
3. Clone a workflow starter from [workflows/](workflows/) and follow its README. Each track is a self-contained Node.js project — just `npm install`, configure `.env`, and run.
4. When stuck, check [guides/howto/06-troubleshooting.md](guides/howto/06-troubleshooting.md).

For the longer story, read the blog post: [Getting started with OpenClaw](blog/getting-started-with-openclaw.md).

## Security note (read before running locally)

OpenClaw is a real agent runtime — that means real risks, especially on a local install:

- **Shell access** — Pi's `Bash` tool can run arbitrary commands as the user that started the gateway. A bad turn or a prompt-injected message can in principle delete files or exfiltrate data.
- **API keys in `.env`** — leaking that file (e.g. accidental `git add`, compromised laptop) can run up a four-figure model bill in hours. Set a hard spending cap in your provider dashboard and confirm `.env` is gitignored.
- **No auth, no rate limiting** — the local web UI has none of either. Bind to `127.0.0.1` and don't expose it via tunnels (ngrok, Cloudflare Tunnel) without adding auth.

Full details and mitigations: [guides/howto/01-install-local.md › Risks](guides/howto/01-install-local.md#risks). For anything beyond personal hacking, run on a VPS where you control the firewall — see [03-deploy-vps-hostinger.md](guides/howto/03-deploy-vps-hostinger.md) or [04-deploy-vps-gcp.md](guides/howto/04-deploy-vps-gcp.md).

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
