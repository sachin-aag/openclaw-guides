# 01 · Install on your laptop

The fastest way to get a working OpenClaw agent. Best for hacking, fast iteration, and learning. **Not** the right place for an always-on production agent — your laptop sleeps.

> **Time:** ~10 minutes
> **Cost:** free (model API calls extra, typically pennies for the workshop)

> **Security:** a local OpenClaw install gives an LLM **shell access on your laptop** via Pi's `Bash` tool, holds **API keys in `.env`** that bill against your accounts, and ships with **no auth or rate limiting** out of the box. Skim [Risks](#risks) below *before* you run `npm run dev` — especially if you have sensitive files in `$HOME` or are on a shared/work machine. For anything beyond personal hacking, deploy to a VPS ([Hostinger](03-deploy-vps-hostinger.md) / [GCP](04-deploy-vps-gcp.md)) where you control the firewall.

## Prerequisites

You need five things. Each block below tells you what to install, how to install it on each OS, and how to verify it's working.

### Node.js (20 LTS or 22 LTS)

The runtime that executes OpenClaw and Pi. **Node 22 LTS is recommended.** Node 18 and earlier are EOL and will fail with cryptic errors.

**Verify first:** `node -v` should print `v20.x.x` or `v22.x.x`. If it does, skip the install steps.

**Install:**

- **macOS:** `brew install node@22` (install [Homebrew](https://brew.sh) first if you don't have it). Or grab the installer from [nodejs.org](https://nodejs.org).
- **Ubuntu / Debian:** `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs`
- **Windows:** install [WSL2 + Ubuntu](https://learn.microsoft.com/windows/wsl/install), then follow the Ubuntu steps inside WSL. Native Windows works in theory but breaks often — WSL is the supported path.
- **Anywhere (alternative):** use [`nvm`](https://github.com/nvm-sh/nvm) if you juggle Node versions: `nvm install 22 && nvm use 22`.

### npm (10+)

Ships with Node — you almost certainly don't need to install it separately.

**Verify first:** `npm -v` should print `10.x.x` or higher. If it does, you're done.

**Install / upgrade:** `npm install -g npm@latest`.

### git

Used to clone this repo.

**Verify first:** `git --version` should print `git version 2.x.x`. If it does, skip the install steps.

**Install:**

- **macOS:** preinstalled with Xcode Command Line Tools (`xcode-select --install`), or `brew install git`.
- **Ubuntu / Debian:** `sudo apt install -y git`
- **Windows (WSL):** `sudo apt install -y git` inside WSL.

### A code editor

You'll be editing `.env`, markdown memory files (`SOUL.md`, `USER.md`, `MEMORY.md`), and occasionally TypeScript skill code.

**Verify first:** if you already have VS Code, Cursor, JetBrains, Zed, vim, or emacs working — you're done.

**Install:** if you have no preference, download [VS Code](https://code.visualstudio.com) — free, cross-platform, works out of the box.

### A model API key

Pick **one** provider. The workshop tracks are tuned for Claude, but any of these will work.

**Verify first:** if you already have a key for one of the providers below and it has credits / free quota left, you're done — keep the key handy for `.env` in step 3.

**Sign up + create a key:**

- **Anthropic** — [console.anthropic.com](https://console.anthropic.com), create an API key, load $5+ of credits. **Note:** a Claude Pro / Team subscription does *not* give you API access — you need credits at `console.anthropic.com`. Recommended.
- **OpenAI** — [platform.openai.com](https://platform.openai.com), create an API key, load credits. No free credit on signup.
- **Google AI Studio** — [aistudio.google.com](https://aistudio.google.com), create an API key. Free tier available; latency varies.
- **Featherless** — [featherless.ai](https://featherless.ai), create an API key. Generous free tier, access to a wide range of open-source models. Caveat: most models cap at 32K context, which gets tight when OpenClaw loads `SOUL.md` + `MEMORY.md` + notes into every turn.

**Set a hard spending cap of €10/mo in your provider's dashboard before using the key.** Five seconds in the dashboard prevents a four-figure mistake.

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
- Want it managed (paid)? [02-deploy-coral.md](02-deploy-coral.md)
