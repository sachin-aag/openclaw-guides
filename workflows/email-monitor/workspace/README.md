# Workspace

This is your agent's mind on disk. **It starts mostly empty on purpose** — OpenClaw scaffolds the canonical templates here on first run.

## What gets created here

When you run `openclaw init` (or the first time `npm run dev` boots the gateway), OpenClaw writes:

- `SOUL.md` — personality + operating principles ([official template](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md))
- `USER.md` — facts about you, the human
- `MEMORY.md` — long-term notes the agent appends to over time

## Pre-shipped files

- `email-digests/` — generated email digests land here as `<YYYY-MM-DD-HHmm>.md` files.
- `email-log.md` — created on first run; every email check is logged here for audit.

## Gmail App Password setup

This skill connects to Gmail via IMAP using an App Password (not your regular password):

1. **Enable 2-Factor Authentication** on your Google account: https://myaccount.google.com/security
2. **Create an App Password**: https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select "Other (Custom name)" and type "OpenClaw"
   - Copy the 16-character password
3. **Paste it** into `.env` as `EMAIL_APP_PASSWORD`

> **Security note:** App passwords bypass 2FA. Treat them like any other secret. Don't commit `.env` to git.

## Adding skill-specific behavior

The email-monitor skill needs a few extra rules in `SOUL.md` — things like "never leak full email contents" and "classify urgency conservatively."

We ship those in [`../skill-personality.snippet.md`](../skill-personality.snippet.md). After `openclaw init` creates `SOUL.md`, append the snippet:

```bash
cat ../skill-personality.snippet.md >> SOUL.md
```

## How the workshop fits in

1. `npm install`
2. `cp .env.example .env` and add your API key + Gmail app password
3. `npm run dev` — first boot scaffolds `SOUL.md / USER.md / MEMORY.md` here
4. `cat ../skill-personality.snippet.md >> SOUL.md` — adds the email-monitor rules
5. Send yourself a test email, then `npm run scan` — a digest appears in `email-digests/`
