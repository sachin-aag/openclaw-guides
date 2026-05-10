# 05 · Add a messaging channel

After the workshop, the most common follow-up question is "how do I talk to my agent from my phone?" Pick **one** channel; multi-channel can come later.

This guide covers **Telegram** (easiest) and **Discord** (best if you already have a server).

---

## Telegram

### 1 · Create a bot

In Telegram, message [@BotFather](https://t.me/botfather):

```
/newbot
```

Give it a name and a username (must end in `bot`). BotFather replies with a token like:

```
1234567890:AAH...rest-of-token...
```

### 2 · Configure OpenClaw

Add to your `.env`:

```bash
OPENCLAW_CHANNELS=web,telegram
TELEGRAM_BOT_TOKEN=1234567890:AAH...
TELEGRAM_ALLOWED_USER_IDS=123456789      # your Telegram user ID — find via @userinfobot
```

Restart the gateway. You should see:

```
[openclaw] telegram channel ready (polling)
```

### 3 · Test

Open Telegram, find your bot by username, send `/start`. The bot should reply through the same OpenClaw agent that's running on the Web UI. Both channels share memory.

### Production note

For VPS deployments, switch from polling to a webhook for lower latency:

```bash
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://agent.yourdomain.com/channels/telegram
TELEGRAM_WEBHOOK_SECRET=<long-random-string>
```

Then register the webhook once:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://agent.yourdomain.com/channels/telegram&secret_token=<SECRET>"
```

---

## Discord

### 1 · Create the application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) and click **New Application**.
2. Under **Bot**, click **Reset Token** and copy the token.
3. Under **Privileged Gateway Intents**, enable **Message Content Intent**.
4. Under **OAuth2 → URL Generator**: select scopes `bot` and `applications.commands`; permissions `Send Messages`, `Read Message History`, `Use Slash Commands`. Copy the generated URL.

### 2 · Invite the bot

Open the URL in a browser and pick the server you want the bot in.

### 3 · Configure OpenClaw

```bash
OPENCLAW_CHANNELS=web,discord
DISCORD_BOT_TOKEN=<token>
DISCORD_GUILD_ID=<your-server-id>           # right-click server icon → Copy ID
DISCORD_CHANNEL_ID=<channel-id>             # right-click channel → Copy ID
```

Restart the gateway. The bot will appear online in your server. `@mention` it in the configured channel.

---

## Memory across channels

Both channels share the **same agent** and the **same memory files**. Conversations are isolated per session, but `SOUL.md`, `MEMORY.md`, and shared `notes/` are visible to both.

If you want truly isolated agents per channel, configure two agents in your gateway config — see the [official docs](https://docs.openclaw.ai).

## Why we don't recommend WhatsApp for the workshop

WhatsApp Business API requires phone-number verification, business credentials, and a Meta developer account. Great for production, terrible for "let me try this in 5 minutes." Get something working on Telegram first.

## Used by the workshop tracks

All three workshop tracks support Telegram as an optional notification channel:

- **Track A (news-briefing-agent)** — receive your daily news digest in Telegram
- **Track B (price-monitor)** — get price alerts when thresholds are crossed
- **Track C (email-monitor)** — forward urgent email alerts to Telegram

See each track's `.env.example` for the `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_IDS` variables.

## Next

- Tighten security before exposing your bot publicly → [01-install-local.md › Risks](01-install-local.md#risks)
- Schedule the agent to message you on a heartbeat → [04-cron-and-heartbeat.md](../concepts/04-cron-and-heartbeat.md)
