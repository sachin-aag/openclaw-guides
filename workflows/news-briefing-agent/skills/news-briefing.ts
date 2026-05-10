/**
 * News Briefing skill
 *
 * Reads RSS feed URLs from `workspace/feeds.txt`, fetches each feed via curl,
 * extracts recent entries, generates a structured briefing using the model,
 * and writes it to `workspace/briefings/<date>.md`.
 *
 * Invoked by:
 *   - manual:  `npm run briefing`
 *   - cron:    see gateway.config.yaml
 *
 * NOTE: This file uses the OpenClaw Skill SDK shape. If the SDK package
 *       names differ in your installed OpenClaw version, the imports may
 *       need adjustment — see https://docs.openclaw.ai for the current API.
 */

import { defineSkill } from "@openclaw/gateway";

export default defineSkill({
  name: "news-briefing",

  /** What the agent sees as its job, on top of SOUL.md. */
  systemPromptAddendum: `
You are running the news-briefing skill.
You will receive raw RSS/XML content from multiple feeds. Your job:

1. Extract article titles, links, and descriptions from the XML.
2. Filter to items published in the last 24 hours (use <pubDate> or similar).
3. Group articles by topic (e.g., AI, Security, Business, Open Source, Science).
4. Produce a structured markdown briefing with this format:

  # News Briefing — <YYYY-MM-DD>

  ## <Topic 1>
  - **<Title>** — <one-sentence summary> ([link](<url>))

  ## <Topic 2>
  - ...

  ## Fetch errors (if any)
  - <feed URL>: <reason>

Keep each item to one line. No editorializing. No opinions.

After writing the file, reply in chat with a 3-bullet TL;DR of today's highlights.
`,

  /** Skill arguments configured in gateway.config.yaml */
  args: {
    feeds_file: { type: "string", default: "workspace/feeds.txt" },
    output_dir: { type: "string", default: "workspace/briefings" },
    notify: { type: "string", default: "web" },
  },

  /** Skill body. `tools` is the Pi tool set; `notify` posts to a channel. */
  async run({ tools, notify, args, workspace, today }) {
    // 1. Read the feeds file
    const feedsRaw = await tools.Read({ path: args.feeds_file });
    const feedUrls = parseFeedUrls(feedsRaw);

    if (feedUrls.length === 0) {
      await notify(args.notify, "No feeds configured. Add URLs to workspace/feeds.txt.");
      return;
    }

    // 2. Fetch each feed via curl
    const feedContents: Array<{ url: string; content: string | null; error?: string }> = [];

    for (const url of feedUrls) {
      try {
        const result = await tools.Bash({
          command: `curl -sL --max-time 15 "${url}"`,
        });
        feedContents.push({ url, content: result });
      } catch (err: any) {
        feedContents.push({ url, content: null, error: err.message || "fetch failed" });
      }
    }

    // 3. Build the input for the model
    const successfulFeeds = feedContents
      .filter((f) => f.content)
      .map((f) => `### Feed: ${f.url}\n\n${f.content}`)
      .join("\n\n---\n\n");

    const failedFeeds = feedContents
      .filter((f) => !f.content)
      .map((f) => `- ${f.url}: ${f.error}`)
      .join("\n");

    const modelInput = [
      `Today's date: ${formatDate(today)}`,
      "",
      "## RSS Feed Content",
      "",
      successfulFeeds,
      "",
      failedFeeds ? `## Failed Fetches\n\n${failedFeeds}` : "",
    ].join("\n");

    // 4. Generate the briefing
    const briefing = await tools.llm.generate({
      input: modelInput,
    });

    // 5. Write to output file
    const outPath = `${args.output_dir}/${formatDate(today)}.md`;
    await tools.Write({ path: outPath, content: briefing });

    // 6. Notify
    await notify(
      args.notify,
      `Briefing for ${formatDate(today)} saved to ${outPath} (${feedUrls.length} feeds processed, ${feedContents.filter((f) => !f.content).length} failed).`,
    );
  },
});

// --- helpers ---------------------------------------------------

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseFeedUrls(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}
