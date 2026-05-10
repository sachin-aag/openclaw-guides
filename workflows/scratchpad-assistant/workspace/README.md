# Workspace

Empty by design. OpenClaw scaffolds the canonical `SOUL.md`, `USER.md`, `MEMORY.md`, and `notes/` here on first run from the [official templates](https://github.com/openclaw/openclaw/tree/main/docs/reference/templates).

After `npm run dev` boots once, append the skill-specific behavior:

```bash
cat ../skill-personality.snippet.md >> SOUL.md
```

The scratchpad's notes file (`notes.md`) is created lazily by the agent on the first `save this: …` message.
