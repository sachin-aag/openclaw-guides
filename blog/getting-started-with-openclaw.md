# Getting started with OpenClaw

A practical, opinionated guide for builders who want a real agent running on their own machine in under an hour. Written for the [OpenClaw Hands-On Stuttgart](https://luma.com/cgq6d8j9) workshop, useful long after.

> **TL;DR**
>
> - **OpenClaw** is an open-source agent gateway that routes messages from any channel (web, CLI, Telegram, Slack, WhatsApp, Discord) to an AI agent and back. It runs locally, on a VPS, or on managed hosts like coral.inc.
> - Its memory is **plain markdown files on disk** (`SOUL.md`, `MEMORY.md`, `notes/*.md`) — you can `cat`, `vim`, and `git diff` your agent's mind. No vector DB required.
> - It embeds **Pi**, an open-source coding agent, so the assistant can `Read`, `Write`, `Edit`, and `Bash` — meaning it actually does things, not just chats.

---

## What is OpenClaw?

[OpenClaw](https://openclaw.cc) is an open-source agent runtime built around five concepts that the [official docs](https://openclaw.cc/en/concepts/) put on one page:

- **Gateway** — the central hub that routes every message.
- **Channels** — how the outside world reaches your agent (web UI, CLI, messaging apps).
- **Agents** — the AI entity that processes messages. OpenClaw ships with [Pi](https://docs.openclaw.ai/pi) embedded.
- **Sessions** — conversation contexts, persisted across runs.
- **Memory** — long-term knowledge, stored as markdown files you own.

The flow, end-to-end:

```
User → Channel → Gateway → Agent → Model → Response
```

That's the whole architecture. Everything else is *which* channel, *which* agent, *which* model.

## The mental model in one paragraph

Think of OpenClaw as the **glue between humans and a coding agent**. The Gateway speaks one normalized language. Channels translate WhatsApp, Telegram, the browser, the CLI, into that language. The agent (Pi, by default) reads its own personality from `SOUL.md`, its long-term memory from `MEMORY.md`, and any short-term context from a session file. It then either replies in chat — or, if the heartbeat woke it up on a cron, messages *you* unprompted.

## Your first workflow in 10 minutes — the daily review agent

The "hello world" of OpenClaw isn't a chatbot. It's a **daily review agent** that runs every morning, reads yesterday's notes, and writes a one-page summary to `daily-review.md`.

```bash
git clone https://github.com/creators-stuttgart/openclaw-guides
cd openclaw-guides/workflows/daily-review-agent

npm install
cp .env.example .env
# add your model API key (Anthropic, OpenAI, Google, Featherless — pick one)

npm run dev
```

You should see a local web UI on `http://localhost:3000`. Send any message; the agent will append it to `notes/<today>.md`. To trigger the review manually:

```bash
npm run review
```

A new `daily-review.md` appears in the workflow folder. Open it. That's your agent's output, in a file you can edit.

For step-by-step details and the other two workshop tracks, see [workflows/daily-review-agent/README.md](../workflows/daily-review-agent/README.md).

## Where to run it: local vs coral.inc vs VPS

You have three realistic deployment targets. Pick based on what you're optimizing for.

| Where | Best for | Cost | Always-on? | Setup time |
|---|---|---|---|---|
| **Local laptop** | Hacking, fast iteration, editing memory files in your IDE | Free | No (laptop sleeps) | 10 min |
| **[coral.inc](https://coral.inc)** | Zero install, demos, "I just want it to work" | Free tier, then usage-based | Yes | 5 min |
| **VPS** ([Hostinger](../guides/04-deploy-vps-hostinger.md), [GCP](../guides/05-deploy-vps-gcp.md)) | Always-on cron, real users, your own infra | ~€5–15/mo | Yes | 30–60 min |

Most people start local, prove the workflow they care about, then move to a VPS once cron actually matters.

> ⚠ **Risk callout for local:** OpenClaw gives the agent a `Bash` tool. That means an LLM, with your API key, can run shell commands on your machine. Treat your `SOUL.md` and tool policy like security boundaries. See [02-install-local.md › Risks](../guides/02-install-local.md#risks).

## Memory as markdown — why this changes how you build with agents

Most agent frameworks make memory a black box: a vector index you query, a hidden conversation log, a managed graph. You can't read it. You can't grep it. You definitely can't `git diff` it.

OpenClaw goes the other way. Your agent's mind is a folder. The most important files are:

- **`SOUL.md`** — the personality, voice, and operating principles. Open it, change a sentence, save. The agent thinks differently next turn. There's an [official template](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md) in the OpenClaw repo.
- **`USER.md`** — what the agent knows about the human(s) it talks to. Names, preferences, context.
- **`MEMORY.md`** — long-term notes the agent appends to over time. Things tagged `#keep`, decisions you've made, recurring patterns.
- **`notes/*.md`** — daily logs, scratchpads, anything domain-specific.

This makes three things possible that vector-DB agents struggle with:

1. **Audit.** You can read the agent's mind out loud at a meeting.
2. **Edit.** You don't "retrain" or "re-embed" — you open the file.
3. **Version.** Commit it. Branch it. Roll back if the agent develops a weird habit.

For real-world authoring patterns, see [guides/08-memory-files.md](../guides/08-memory-files.md).

## Pi as the coding brain

OpenClaw doesn't reinvent the agent loop. It [embeds Pi](https://docs.openclaw.ai/pi) — an open-source coding agent maintained at [@mariozechner/pi-coding-agent](https://github.com/badlogic/pi-mono) — directly via `createAgentSession()`.

Pi gives your assistant four primitive tools:

```ts
Read(path)            // open files, scan folders
Write(path, content)  // create new files
Edit(path, patch)     // surgical patches to existing files
Bash(cmd)             // run anything in a shell
```

That's why an OpenClaw agent can write to `MEMORY.md`, run a Python script, check git status, or compose an email — without you wiring up custom tooling. The agent is, functionally, a junior dev with shell access and a markdown notebook.

For a deeper dive into how Pi is wired into OpenClaw, see [guides/11-pi.md](../guides/11-pi.md).

## Common pitfalls and how to avoid them

These are the issues we expect to hit at the workshop. The full list is in [guides/10-troubleshooting.md](../guides/10-troubleshooting.md).

- **`Cannot find module '@mariozechner/pi-coding-agent'`** → run `npm install` in the workflow folder, not the repo root.
- **Agent replies but doesn't write the markdown file** → check that `WORKSPACE_DIR` in `.env` points to a folder the process can write to.
- **API key errors with no other context** → most providers throw 401 as 500. Verify the key is exported in the same shell that runs `npm run dev`.
- **Cron doesn't fire on my laptop** → laptops sleep. Either keep the lid open with caffeine on macOS (`caffeinate -i`), or move to a VPS.
- **The agent's tone is wrong** → you edited `SOUL.md` but didn't restart the gateway. Restart, or use `npm run reload`.

## Where to go next

You've got a daily review agent running. From here, the natural next steps:

- **Add a second channel.** Wire up Telegram or Discord so you can talk to your agent from your phone — see [guides/07-channels-messaging.md](../guides/07-channels-messaging.md).
- **Multi-agent routing.** Run two agents (a "researcher" and a "writer") that hand work to each other.
- **Hybrid model routing.** Use a cheap model for routing and an expensive one for thinking. This is configured in OpenClaw's model registry.
- **Skills.** Package a workflow as a reusable [Skill](https://github.com/openclaw/openclaw/tree/main/docs) so other agents can invoke it.

For the workshop, we're focused on shipping one skill end-to-end. Multi-agent and hybrid routing are great follow-ups for the [Showcase](https://luma.com/cgq6d8j9) at 18:00.

---

## FAQ

**What is OpenClaw in one sentence?**
An open-source agent gateway that routes messages between any channel (web, CLI, messaging apps) and an AI agent, with markdown files as long-term memory and Pi as the embedded coding agent.

**Is OpenClaw the same as Claude Code or Cursor?**
No. Claude Code and Cursor are coding assistants you talk to in an IDE or terminal. OpenClaw is a *gateway*: it exposes an agent over multiple channels (chat apps, web, CLI), runs always-on with cron, and persists memory across sessions. OpenClaw uses Pi internally — Pi itself is comparable to Claude Code in some ways, but the gateway around it is the differentiator.

**Do I need a vector database?**
No. Memory is markdown files. The agent reads them on each turn or selectively via the `Read` tool.

**Which AI models does OpenClaw support?**
Any provider Pi supports: Anthropic (Claude), OpenAI (GPT family), Google (Gemini), Featherless (open-source models), and local models. You configure this in the model registry; you can swap providers without changing your agent code.

**Where does my data live?**
Wherever you run OpenClaw. Local laptop = on disk in your project folder. VPS = on disk on the VPS. coral.inc = managed by coral. The model API call still goes to whichever provider you've configured (Anthropic, OpenAI, Featherless, etc.) — that's the only thing that leaves your machine.

**How much does it cost to run?**
The OpenClaw runtime is free and open-source (MIT). Costs come from (1) the model API — typically $1–10/month for personal use, more if you're hammering it — and (2) hosting if you use a VPS or managed host (~€5–15/month).

**Can I use it without writing TypeScript?**
You configure OpenClaw via JSON/YAML and markdown. Custom skills are usually TypeScript, but for the workshop tracks (daily review, scratchpad, folder watcher) you don't write any TS — you only edit markdown and `.env`.

**Is it production-ready?**
For personal use and small teams, yes — many builders are running it on VPSes. For high-traffic public products, treat it as you would any agent system: add rate limiting, observability, secret rotation, and a non-`Bash`-enabled tool policy.

**Where do I get help?**
Official docs: [openclaw.cc](https://openclaw.cc) and [docs.openclaw.ai](https://docs.openclaw.ai). Workshop community: Discord/Slack invites are on the [cheatsheet](../workshop/stuttgart-2026/cheatsheet.md).

---

*Written for the OpenClaw Hands-On Stuttgart workshop. Last updated 2026-05-09. PRs welcome — see [CONTRIBUTING.md](../CONTRIBUTING.md).*
