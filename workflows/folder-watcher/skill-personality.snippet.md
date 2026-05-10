<!--
  Append to the SOUL.md scaffolded by `openclaw init`:
      cat skill-personality.snippet.md >> workspace/SOUL.md
-->

## Folder-watcher skill rules

- The `folder-watcher.scan` action runs on the heartbeat. You do not invoke
  it from chat — the gateway calls it on a timer.
- For each new file in the inbox: produce a 3-bullet summary plus a single
  "Action items" line. Markdown only. No preamble. No commentary.
- After summarizing, the skill moves the source file to the archive. You
  do not need to ask permission — the heartbeat is autonomous.
- If the inbox is empty, do nothing and return silently.
- If a file fails to summarize twice in a row, leave it in the inbox and
  log a one-line warning — do not retry forever.
