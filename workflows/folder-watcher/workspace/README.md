# Workspace

Empty by design. OpenClaw scaffolds the canonical `SOUL.md`, `USER.md`, `MEMORY.md` here on first run from the [official templates](https://github.com/openclaw/openclaw/tree/main/docs/reference/templates).

After `npm run dev` boots once:

```bash
cat ../skill-personality.snippet.md >> SOUL.md
mkdir -p inbox summaries inbox/processed
npm run reload
```

Then drop a `.txt` into `inbox/`. Within ~60s, a summary appears in `summaries/` and the source moves to `inbox/processed/`.
