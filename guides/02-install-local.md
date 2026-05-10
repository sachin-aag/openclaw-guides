# 02 · Install on your laptop

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

For the workshop, start with the news briefing agent:

```bash
git clone https://github.com/creators-stuttgart/openclaw-guides
cd openclaw-guides/workflows/news-briefing-agent
```

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

Open `http://localhost:3000`, send a message, watch a `notes/<today>.md` file appear in the workspace folder.

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
- For anything beyond personal use, deploy to a VPS where you control the firewall — see [04-deploy-vps-hostinger.md](04-deploy-vps-hostinger.md).

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

- Hit a problem? [10-troubleshooting.md](10-troubleshooting.md)
- Want it always-on? [04-deploy-vps-hostinger.md](04-deploy-vps-hostinger.md) or [05-deploy-vps-gcp.md](05-deploy-vps-gcp.md)
- Want zero-install? [03-deploy-coral.md](03-deploy-coral.md)
