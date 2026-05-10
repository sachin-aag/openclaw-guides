# 01 · Core concepts

This page mirrors the [official OpenClaw Core Concepts](https://openclaw.cc/en/concepts/) page with our own annotations. When in doubt, the official docs win.

## The flow

```
User → Channel → Gateway → Agent → Model → Response
```

1. **User** sends a message via a channel (Web UI, CLI, WhatsApp, Telegram, etc.).
2. **Channel** receives and forwards it to the Gateway in a normalized format.
3. **Gateway** routes to the appropriate Agent and Session.
4. **Agent** processes the message using its configured Model and tools.
5. **Response** is sent back through the originating channel.

## The five core concepts

### Gateway

The central hub that routes every message in and every reply out. The Gateway also owns the **agent loop** (receive → run → reply → persist) and the **heartbeat** (cron-like scheduled wake-ups).

You don't write a Gateway. You configure one and forget about it.

### Channels

How the outside world reaches your agent. OpenClaw supports several out of the box:

- **Web UI** — a browser tab that talks to your local Gateway.
- **CLI** — pipe text in, pipe text out. Scriptable.
- **Telegram, Slack, Discord, WhatsApp** — messaging-app channels via the official plugins.

For the workshop we use only the Web UI to keep setup simple. To add a messaging channel later, see [07-channels-messaging.md](07-channels-messaging.md).

### Agents

The AI entity that processes messages. OpenClaw embeds [**Pi**](https://docs.openclaw.ai/pi) — an open-source coding agent — by default. You can configure multiple agents per gateway and route between them.

For more on Pi specifically, see [11-pi.md](11-pi.md).

### Sessions

Conversation contexts, persisted across runs. A Session ties together:

- the channel and user the conversation belongs to,
- the message history,
- the agent's working state.

Sessions are stored as JSONL files on disk (one event per line). You can `tail -f` a session file to watch your agent think in real time.

### Memory

Long-term knowledge that survives across sessions. In OpenClaw, memory is **plain markdown files** — by convention `SOUL.md`, `USER.md`, `MEMORY.md`, and any `notes/*.md` you add. The official `SOUL.md` template lives at [openclaw/openclaw › docs/reference/templates/SOUL.md](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md).

For authoring patterns, see [08-memory-files.md](08-memory-files.md).

## Two more concepts worth knowing

### Models

OpenClaw is **provider-agnostic**. You configure which model to use (Claude, GPT, Gemini, Featherless open-source models, local) per agent or per channel. Switching providers means changing one line of config — your agent code, memory, and skills stay the same.

### Skills

A **Skill** is a reusable, named capability your agent can invoke — think "tools, but with a system prompt and a workflow attached." The three workshop tracks (news briefing, price monitor, email monitor) are each Skills.

## Key principles

From the official docs:

- **Local-first** — runs on your machine. Cloud is optional.
- **Privacy-focused** — your data stays with you.
- **Extensible** — add custom tools, skills, channels.
- **Multi-platform** — works across messaging surfaces.

## Where to read more

- [openclaw.cc/en/concepts](https://openclaw.cc/en/concepts/) — official concepts page
- [docs.openclaw.ai](https://docs.openclaw.ai) — full reference docs
- [docs.openclaw.ai/pi](https://docs.openclaw.ai/pi) — how Pi is embedded
