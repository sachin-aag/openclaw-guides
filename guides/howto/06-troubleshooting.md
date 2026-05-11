# 06 · Troubleshooting

The stuff we expect to break, and how to unstick it. Volunteers should skim this before the workshop.

## Setup errors

### `Cannot find module '@mariozechner/pi-coding-agent'`

You ran a script in the wrong folder. Each workflow under `workflows/<name>/` has its own `package.json`. `cd` into it and `npm install`.

### `Error: Node version 18.x is not supported`

Pi requires Node 20+. Install Node 22 LTS:

```bash
# macOS
brew install node@22 && brew link --force --overwrite node@22

# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
```

### `npm install` hangs forever

You're on a bad network or behind a corporate proxy. Two fixes:

```bash
npm config set registry https://registry.npmjs.org/
npm install --no-audit --no-fund
```

If it still hangs, switch networks (mobile hotspot during the workshop) or pair with a neighbor whose install works — don't burn the session on a flaky network.

### `EACCES` permission errors

You ran `npm install` with `sudo` at some point and broke ownership. Fix:

```bash
sudo chown -R $(whoami):$(id -gn) ~/.npm $(npm root -g) ./node_modules
```

## Runtime errors

### Agent replies but doesn't write the markdown file

Three things to check, in order:

1. **`WORKSPACE_DIR` exists and is writable** — `ls -la $WORKSPACE_DIR && touch $WORKSPACE_DIR/.test`
2. **The `Bash` / `Write` tool is enabled** in your skill config — beginner skills sometimes restrict it.
3. **The agent thinks it succeeded** — check logs: `npm run dev` output will show the tool call. If you see `tool_call: Write(...)` followed by `tool_result: error`, the file path is wrong.

### `401 Unauthorized` from the model provider

The most common cause is the API key isn't loaded in the same shell that runs `npm run dev`. Verify:

```bash
echo $ANTHROPIC_API_KEY   # should print your key (or whichever provider)
```

If empty, you didn't `source .env` or your shell doesn't auto-load it. Either:

```bash
export $(grep -v '^#' .env | xargs)
npm run dev
```

…or restart your terminal after editing `.env` (most starters use `dotenv` automatically).

### `429 Too Many Requests`

You hit a rate limit. Two fixes:

- Switch to a slower / cheaper model: edit `OPENCLAW_MODEL` to `claude-haiku-4-6` or `gpt-5.4-mini`.
- Add a delay between turns in your skill config.

### Agent answers in the wrong tone / language

You edited `SOUL.md` but didn't restart the gateway. Either restart, or:

```bash
npm run reload
```

If it still answers wrong, the model is caching system prompts on its end (Claude does this with prompt caching). Wait 5 minutes or change `SOUL.md` more dramatically.

### Agent loops forever / runs up bill

Pi has loop protection but it can be defeated by a bad `SOUL.md` rule. Kill the process:

```bash
# locally
Ctrl-C twice

# Docker
docker compose down

# VPS / systemd
sudo systemctl stop openclaw
```

Then:
1. Set a hard spend cap in your provider dashboard (do this before the workshop, just in case).
2. Read the last session JSONL: `tail -n 50 sessions/<sid>.jsonl` to see what tool the agent kept calling.
3. Tighten the SOUL.md rule that caused it.

## Cron issues

### Cron didn't fire

- Is the gateway actually running at the scheduled time? (Local laptops sleep — see [04-cron-and-heartbeat.md › Local laptop reality check](../concepts/04-cron-and-heartbeat.md#local-laptop-reality-check).)
- Is the timezone right? `date` on the box vs your `gateway.config.yaml > timezone:`.
- Are you sure the cron expression is what you think it is? Test on [crontab.guru](https://crontab.guru).

### Cron fired twice

Daylight saving change, or you restarted the gateway during the firing window. Make your skill idempotent — see the rule in [04-cron-and-heartbeat.md › Idempotency rule](../concepts/04-cron-and-heartbeat.md#idempotency-rule).

## Channel issues

### Web UI loads but messages do nothing

Open the browser console (`Cmd-Opt-J` / `Ctrl-Shift-J`). If you see WebSocket errors, the gateway isn't serving the right host/port. Check `OPENCLAW_HOST` and `OPENCLAW_PORT` in `.env`.

### Telegram bot is silent

- Did you `/start` the bot in Telegram? It won't reply to direct messages until you have.
- Is your Telegram user ID in `TELEGRAM_ALLOWED_USER_IDS`? (Get it from `@userinfobot`.)
- For webhook mode, did you actually call `setWebhook`?

### Discord bot shows offline

- The bot needs to be invited to a server it has permissions in. Re-do step 2 of [05-channels-messaging.md › Discord](05-channels-messaging.md#discord).
- The token must match the application — regenerating the token invalidates the previous one.

## Volunteer triage cheat sheet

| Symptom | Level | Action |
|---|---|---|
| Wrong Node version | L1 | `brew install node@22` (mac) — pair through it |
| `EACCES` on npm | L1 | `chown` fix above |
| Lost API key | L1 | Issue a temporary workshop key from the shared bucket |
| `Cannot find module` | L1 | They're in the wrong folder |
| Hard install break, OS-specific | L2 | Pair them with a neighbor whose install works — they don't lose the workshop. coral.inc with code `STUTTGART` is a paid post-workshop option, not a real-time escape. |
| Suspected OpenClaw bug | L2 | File a quick issue on the openclaw-guides repo with a reproducer |

## Asking for help

- In the room: raise a hand. Wait at most 2 minutes; if no one comes, walk to the installation bar at the back.
- After the workshop: post in the Discord/Slack (link on the [cheatsheet](../workshop/stuttgart-2026/cheatsheet.md)) with the **exact error message** and the **last 10 lines of `npm run dev` output**.
- For OpenClaw bugs: [github.com/openclaw/openclaw/issues](https://github.com/openclaw/openclaw/issues).
