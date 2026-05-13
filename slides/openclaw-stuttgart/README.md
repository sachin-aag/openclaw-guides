# OpenClaw Hands-On · Stuttgart — Slides

Self-contained HTML deck for the **Hands-On block (16:00–18:00)** and hand-off copy for **break + OpenClaw Showcase (18:30–20:00)** at the [OpenClaw Showcase & Hands On Stuttgart](https://luma.com/cgq6d8j9) event.

## Files

- `index.html` — the deck, 18 slides (single self-contained file, no build step). Slide 12 is a "wider landscape" beat covering Hermes alongside OpenClaw.
- `facilitator-script.md` — time-coded speaker script with cues
- `assets/architecture.svg` — diagram used on slides 5–9

## Further reading

- [Hermes Agent (Nous Research)](https://hermes-agent.org) — the closest open-source peer to OpenClaw, referenced on slide 12.
- [AI Lab Notes, May 2026 — The execution layer rewrite](https://substack.com/home/post/p-196325438) — context for why agent harnesses are moving outside the sandbox.
- [badlogic/pi-mono](https://github.com/badlogic/pi-mono) — the Pi coding agent OpenClaw embeds.

## Run locally

Open in any modern browser:

```bash
open index.html
```

Or serve it (recommended for asset paths):

```bash
npx serve .
```

## Navigate

- Arrow keys / Space — next/prev slide
- Scroll / swipe — next/prev slide
- Click the dots on the right edge — jump to a slide
- Press `F` — fullscreen
- Press `G` — toggle grid overview

## Edit

All content is inline in `index.html`. To restyle, edit the CSS variables in `:root` near the top of the `<style>` block:

```css
--bg: #0b0b0e;
--fg: #f4ede1;
--accent: #ff6b35;   /* OpenClaw accent — adjust freely */
```

## Deploy to a public URL

```bash
npx vercel deploy --prod
```

Or drag-and-drop the folder onto [vercel.com/new](https://vercel.com/new).

## Export to PDF

```bash
# headless Chromium → one PNG per slide → combined PDF
npx playwright install chromium
node ./.export-pdf.mjs    # add this script if you want a one-liner; otherwise use Chrome's "Print to PDF"
```

For most cases, the simplest way is: open the deck in Chrome, press `F` for fullscreen,
then File → Print → Save as PDF (set "Background graphics" on, layout: Landscape).

## License

CC BY 4.0 — feel free to remix for your own OpenClaw events.
