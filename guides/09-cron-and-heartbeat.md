# 09 · Cron and the heartbeat

Always-on is the OpenClaw feature that surprises people. Your agent isn't waiting for you to ping it — it can wake up, do work, and message you first.

## Two mechanisms

### 1 · Cron jobs

Schedule named tasks at fixed times. Defined in `gateway.config.yaml` (or your gateway's equivalent):

```yaml
cron:
  - name: daily-review
    schedule: "30 7 * * *"      # 07:30 every day, server time
    skill: daily-review
    args:
      look_back_days: 1
      output: daily-review.md
      notify: web
```

When the schedule fires, the gateway invokes the named skill exactly as if you had triggered it from chat. The skill can read files, write files, and call `notify: <channel>` to message you.

### 2 · Heartbeat

A coarser tick that runs every N minutes. Useful when you want the agent to *check the world* rather than do a fixed task.

```yaml
heartbeat:
  interval_minutes: 5
  skill: check-inbox
  args:
    folder: ./inbox
```

The `check-inbox` skill in this example would scan the folder every 5 minutes and act on anything new.

## Server-time gotcha

Cron schedules use the gateway's server time. On a VPS that defaults to UTC, `"30 7 * * *"` is **07:30 UTC** = 09:30 in Berlin during summer time. Set the gateway timezone explicitly:

```yaml
timezone: Europe/Berlin
```

Or set the system timezone on the VPS:

```bash
sudo timedatectl set-timezone Europe/Berlin
```

## Local laptop reality check

Cron only fires when the gateway is running. On a laptop that means: lid open, awake, not asleep. macOS's energy saver will close your `npm run dev` faster than you think.

Three options:

1. **Workshop hack:** trigger manually with `npm run review` instead of relying on cron.
2. **Stay awake on macOS:** `caffeinate -i npm run dev`.
3. **Move to a VPS:** [04-deploy-vps-hostinger.md](04-deploy-vps-hostinger.md). This is the right answer for anything you actually want to keep using.

## A canonical always-on workflow: the daily review agent

Pseudocode of what a complete daily review setup looks like:

```yaml
# gateway.config.yaml
timezone: Europe/Berlin

cron:
  - name: morning-review
    schedule: "30 7 * * *"
    skill: daily-review
    args:
      input_glob: "notes/*.md"
      look_back_days: 1
      output: daily-review.md
      notify: web

  - name: evening-prompt
    schedule: "0 21 * * *"
    skill: ask-for-reflection
    args:
      prompt_template: |
        It's 21:00. What's one thing worth keeping from today?
        Reply with `#keep <one sentence>` and I'll add it to MEMORY.md.
      notify: web
```

That's a real second-brain agent: morning summary, evening reflection. Two cron entries, ~10 lines of config, no custom code.

## Watching cron fire

```bash
# locally
docker compose logs -f openclaw | grep cron

# on the VPS
journalctl -u openclaw -f | grep cron
```

You'll see lines like:

```
[cron] morning-review fired at 2026-05-09T07:30:00+02:00
[cron] morning-review completed in 12.4s
```

## Idempotency rule

Cron jobs may fire twice (machine restart, daylight saving change, manual re-run). Skills you wire into cron should be **idempotent** — re-running them should produce the same file, not a duplicate.

Practical tip: name output files by the date they cover, not the run time:

```
daily-review-2026-05-09.md   # good — overwrites cleanly
daily-review-1715234400.md   # bad — every run = new file
```

## Next

- Build the daily-review skill end-to-end → [../workflows/daily-review-agent/README.md](../workflows/daily-review-agent/README.md)
- Things firing twice or not at all → [10-troubleshooting.md › Cron](10-troubleshooting.md#cron-issues)
