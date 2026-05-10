# 01 · Install on your laptop

The fastest way to get a working OpenClaw agent. Best for hacking, fast iteration, and learning. **Not** the right place for an always-on production agent — your laptop sleeps.

> **Time:** ~10 minutes
> **Cost:** free (model API calls extra, typically pennies for the workshop)

## Prerequisites

| What | Version | Check |
|---|---|---|
| Node.js | 20 LTS or 22 LTS | `node -v` |
| npm | 10+ | `npm -v` |
| git | any recent | `git --version` |
| A code editor | any | — |
| A model API key | one of | Anthropic, OpenAI, Google, or Featherless |

If you don't have Node, install from [nodejs.org](https://nodejs.org) or via Homebrew (`brew install node@22`).

## Steps

### 1. Clone a workflow starter

Clone the repo once, then `cd` into the workshop track you want:

| Track | Folder | What you build |
|-------|--------|----------------|
| **A — News briefing** | `workflows/news-briefing-agent` | RSS → daily markdown briefings in `workspace/briefings/` |
| **B — Price monitor** | `workflows/price-monitor` | Watchlist → price checks, alerts, `workspace/price-log.md` |
| **C — Email monitor** | `workflows/email-monitor` | Gmail (IMAP) → digests in `workspace/email-digests/`, urgent alerts |

```bash
git clone https://github.com/creators-stuttgart/openclaw-guides
cd openclaw-guides/workflows/news-briefing-agent   # or price-monitor / email-monitor
```

Each track is a self-contained Node project — the steps below are the same after you pick a folder.

### 2. Install dependencies

```bash
npm install
```

This pulls in OpenClaw + Pi packages. Takes ~30 seconds on a decent connection.

### 3. Configure your environment

```bash
cp .env.example .env
```

Open `.env` in your editor and set at least:

- `OPENCLAW_PROVIDER` — `anthropic`, `openai`, `google`, or `featherless`
- `OPENCLAW_MODEL` — e.g. `claude-sonnet-4-6`, `gpt-5.4`, `gemini-3.1-pro`, or a Featherless-hosted model
- The matching API key: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, or `FEATHERLESS_API_KEY`
- `WORKSPACE_DIR` — folder the agent can write to (default: `./workspace`)

**Track C (email-monitor)** also needs Gmail / IMAP variables from its `.env.example` (App Password, not your normal password). Tracks A and B only need the items above unless you add optional Telegram — see [05-channels-messaging.md](05-channels-messaging.md).

### 4. Run

```bash
npm run dev
```

You should see:

```
[openclaw] gateway listening on http://localhost:3000
[openclaw] web channel ready
[openclaw] agent loaded: SOUL.md, USER.md, MEMORY.md
```

Open `http://localhost:3000` and send a message. What lands on disk depends on the track — for example **Track A** writes `workspace/briefings/<today>.md` after you run a briefing; **B** and **C** log heartbeats to `workspace/price-log.md` and `workspace/email-log.md` respectively. See that track's `README.md` for the exact commands (`npm run briefing`, `npm run check`, `npm run scan`, etc.).

## Risks

OpenClaw is open and powerful. Local installs come with three real risks. **Read these before running with sensitive data on your machine.**

### Risk 1 — The agent has shell access

By default, Pi's `Bash` tool can execute arbitrary commands as the user running `npm run dev`. An LLM with a bad turn (or a prompt-injected message) can in principle delete files, exfiltrate data, or run cryptominers.

**Mitigations:**

- Run inside a Docker container or a dedicated Unix user with limited filesystem access.
- Restrict the `Bash` tool's command allowlist via the [tool policy](https://docs.openclaw.ai) (see `pi-tools.policy.ts` references in the OpenClaw source).
- Don't paste untrusted text directly into your agent's chat. Treat user input as you would treat input to a shell script.

### Risk 2 — Leaked API keys = compute bill

Your `.env` file holds keys that bill against your accounts. If you `git add .env` by mistake, or if your laptop is compromised, someone can run up a four-figure model bill in hours.

**Mitigations:**

- Confirm `.env` is in `.gitignore` (it is in our starter — check anyway: `git check-ignore .env`).
- Set a hard spending cap in your provider's dashboard (Anthropic, OpenAI, Google, and Featherless all support this).
- Rotate keys after the workshop if you copy-pasted them anywhere.

### Risk 3 — No firewall, no audit log

Local OpenClaw doesn't ship with built-in rate limiting, request logging, or auth. The web UI is open to anyone on your local network unless you bind it to `127.0.0.1`.

**Mitigations:**

- Bind the gateway to `127.0.0.1` (default in our starter — verify in `.env`: `OPENCLAW_HOST=127.0.0.1`).
- Don't expose the local port to the internet via tunnels (ngrok, Cloudflare Tunnel) without adding auth.
- For anything beyond personal use, deploy to a VPS where you control the firewall — see [03-deploy-vps-hostinger.md](03-deploy-vps-hostinger.md).

## Stopping and restarting

```bash
# stop:
Ctrl-C

# restart after editing SOUL.md / USER.md / MEMORY.md:
npm run dev
```

For a soft reload without restarting the gateway:

```bash
npm run reload
```

## Where to next

- Hit a problem? [06-troubleshooting.md](06-troubleshooting.md)
- Want it always-on? [03-deploy-vps-hostinger.md](03-deploy-vps-hostinger.md) or [04-deploy-vps-gcp.md](04-deploy-vps-gcp.md)
- Want zero-install? [02-deploy-coral.md](02-deploy-coral.md)
