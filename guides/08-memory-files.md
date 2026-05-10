# 08 · Memory files — SOUL.md, USER.md, MEMORY.md

OpenClaw's memory is **plain markdown files on disk.** This is the part that makes builders smile when they first see it.

The official `SOUL.md` template lives at [openclaw/openclaw › docs/reference/templates/SOUL.md](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md). What follows is a working set of patterns we use in the workshop.

## The three files

### `SOUL.md` — who the agent is

Personality, voice, operating principles. Kept short on purpose — every turn loads the whole thing.

```markdown
# SOUL

You are **Lobster**, a calm, terse second-brain agent.

## Voice
- Speak briefly. No emojis. No "great question".
- Prefer markdown lists over prose.

## Operating principles
- Anything tagged `#keep` in chat → append to MEMORY.md with date.
- If asked to do something destructive (delete, overwrite), confirm first.
- Default to small steps. One file change at a time.

## Tools you have
- Read, Write, Edit, Bash (Pi defaults)
- A `notes/` folder you own and can scan.
```

### `USER.md` — who the human is

Stable facts about the person you talk to. Update rarely; let the agent update it for you.

```markdown
# USER

**Name:** Sachin
**Role:** Co-organizer of OpenClaw Stuttgart
**Time zone:** Europe/Berlin
**Workflow:** Morning planning, deep work 10–14, async after.

## Preferences
- Briefings under 200 words.
- Bullet lists, no walls of text.
- Always include a "next action" at the end.
```

### `MEMORY.md` — what the agent has learned

Append-only. The agent writes here when it learns something durable.

```markdown
# MEMORY

## 2026-05-08
- Sachin prefers German-language mornings, English afternoons.
- Project "Frameworx event" confirmed 2026-05-09 16:00.

## 2026-05-09
- New skill shipped: `news-briefing-agent` (workshop track A).
- TODO: ask Sachin if he wants the morning briefing at 07:30 or 08:00.
```

## How the agent reads them

Every agent turn, the gateway prepends `SOUL.md` and `USER.md` to the system prompt and provides `MEMORY.md` as a context block. The agent can also `Read` any other file in `notes/` on demand.

## How the agent writes them

The agent uses Pi's `Write` and `Edit` tools. A typical pattern in `SOUL.md`:

```markdown
## Operating principles
- When the user says "remember:", append a dated bullet to MEMORY.md.
- When the user says "forget:", show me the matching bullets and ask which to delete — never delete unprompted.
```

## Patterns that work

### Pattern 1 — Tag-driven memory

Use a tag (`#keep`, `#remember`, `#fact`) to mark what should persist. Keeps cheap turns cheap.

```markdown
# In SOUL.md
- If the user's message contains `#keep`, append the surrounding sentence
  (without the tag) to MEMORY.md under today's date.
```

### Pattern 2 — Per-domain notes

For agents that span domains (work, health, side projects), give each its own file:

```
workspace/
  SOUL.md
  USER.md
  MEMORY.md
  notes/
    work.md
    health.md
    side-projects.md
```

Then in `SOUL.md`:

```markdown
- For work-related memory, append to notes/work.md, not MEMORY.md.
```

### Pattern 3 — Dated daily logs

Auto-create `notes/2026-05-09.md` on first message of the day. The daily review agent then summarizes yesterday's file.

### Pattern 4 — Structured headers

If you want the agent to reliably find sections, give them stable headers it can grep:

```markdown
## decisions
## open questions
## people
## resources
```

## Anti-patterns

- **Multi-megabyte MEMORY.md.** The agent loads it every turn. Compact periodically — ask it to "summarize MEMORY.md and replace the older 2025 entries with a 5-bullet summary."
- **Vague SOUL.md.** "Be helpful and concise" gives you nothing. Be specific: "Use bullet points. Never paragraphs over 3 sentences."
- **Editing MEMORY.md by hand a lot.** That's a sign your `SOUL.md` rules aren't capturing what you want the agent to remember.

## Versioning your agent's mind

Memory files are markdown — `git init` your workspace folder. You'll see the agent's mind change over time, in diffs.

```bash
cd workspace
git init
git add SOUL.md USER.md MEMORY.md
git commit -m "v1: initial agent personality"
```

After a week of use:

```bash
git diff HEAD~7
# the agent's mind, changed
```

## Next

- Wire memory to a heartbeat → [09-cron-and-heartbeat.md](09-cron-and-heartbeat.md)
- See how Pi reads and writes these → [11-pi.md](11-pi.md)
