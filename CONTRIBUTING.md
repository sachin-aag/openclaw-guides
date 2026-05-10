# Contributing

Thanks for wanting to add to this. Three things to know.

## What we accept

- **New deployment guides** — any provider you've actually shipped to, with concrete steps and gotchas you hit.
- **New workflow starters** — small, focused, beginner-runnable in under 30 minutes.
- **Fixes and clarifications** to existing guides — typos, broken links, outdated commands, better error messages.
- **Translations** — start with the blog post and `guides/01-concepts.md`. Open an issue first so we don't duplicate work.

## What we don't accept

- Marketing for closed-source agent tools.
- "Here's how to do this in LangGraph instead" — there are other repos for that.
- Walls of text without working code.

## How to contribute

1. **Fork** and create a branch named `feat/<short-thing>` or `fix/<short-thing>`.
2. **Open a draft PR early** — even just an outline. Cheaper to course-correct.
3. **Follow the conventions** below.
4. **Mark your PR ready** when you've actually run the steps end-to-end on a clean machine (or a fresh container).

## Conventions

- **Voice:** plain, direct, second person. No hype words. No "in today's fast-paced world".
- **Code blocks:** prefer copy-pasteable. Always specify the language fence (`bash`, `ts`, `json`, `yaml`).
- **Cost callouts:** if a guide costs money to follow (VPS, model API), say so up front in the first 3 lines.
- **Risk callouts:** if a step gives the agent shell access, network access, or write access to user files, add an explicit `> ⚠ Risk:` callout.
- **Filenames:** lowercase, hyphenated. Numbered guides keep the `NN-` prefix.
- **Links:** prefer relative links inside this repo, full URLs for external docs (especially openclaw.cc and docs.openclaw.ai).

## Workflow starters — extra rules

Each `workflows/<name>/` must contain:

- `README.md` with: what it does, definition of done, prerequisites, 4-step setup, troubleshooting.
- `.env.example` with every var documented and **no real values**.
- A working `package.json` (or equivalent) with pinned versions.
- A "Where to extend" section so people don't bounce when they finish step 4.

## Reviewing

We aim for **48 hours** to first review on PRs. Bigger changes (new deployment guides) may take a week.

Maintainers: ping `@creators-stuttgart/maintainers` if you've waited longer.
