# Workspace

This folder holds generated output for the email monitor.

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

## Quick start

1. `npm install`
2. `cp .env.example .env` and add your API key + Gmail app password
3. Send yourself a test email, then `npm run scan` — a digest appears in `email-digests/`
