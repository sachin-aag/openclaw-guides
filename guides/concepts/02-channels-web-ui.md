# 02 · The Web UI channel

The Web UI is the simplest channel and the one we use throughout the workshop. A browser tab talks to your local (or hosted) Gateway over HTTP.

## What it gives you

- A chat-style interface in the browser (Vercel-style, dark by default)
- Streaming responses
- Inline tool-call traces (you can see when the agent runs `Read`, `Write`, `Bash`)
- A memory inspector — open `SOUL.md` / `MEMORY.md` from a side panel

## Configuration

In `.env`:

```bash
OPENCLAW_HOST=127.0.0.1     # bind address; 0.0.0.0 to expose
OPENCLAW_PORT=3000          # default

# Optional auth (production)
OPENCLAW_WEB_AUTH=basic
OPENCLAW_WEB_USER=workshop
OPENCLAW_WEB_PASS=<long-random-string>
```

Then start the gateway as usual (`npm run dev` locally, or via Docker on a VPS).

## Useful URLs

- `http://localhost:3000/` — chat UI
- `http://localhost:3000/inspect` — session inspector (raw JSONL)
- `http://localhost:3000/memory` — markdown memory file editor
- `http://localhost:3000/healthz` — liveness probe

## Limitations

- No mobile-optimized layout yet (it works, but it's tight on small screens — use Telegram instead).
- No multi-user accounts in the OSS web UI; treat each Web UI deployment as a single-user surface.

## Workshop tip

Keep the chat UI open in one browser tab and `tail -f sessions/*.jsonl` in a terminal. Watching the JSONL stream while you chat makes the agent loop click instantly.

## Next

- Add a phone-friendly channel → [05-channels-messaging.md](../howto/05-channels-messaging.md)
