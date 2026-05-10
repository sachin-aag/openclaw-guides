/**
 * News Briefing skill — standalone version
 *
 * Reads RSS feed URLs from `workspace/feeds.txt`, fetches each feed via curl,
 * sends the content to an LLM to produce a structured briefing, and writes
 * the result to `workspace/briefings/<date>.md`.
 *
 * Run:
 *   npm run briefing
 */

import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { generateText } from "../lib/llm.js";

// ── config ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
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

After the briefing content, add a section:

## TL;DR
- <highlight 1>
- <highlight 2>
- <highlight 3>
`.trim();

// ── helpers ───────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseFeedUrls(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

// ── main ──────────────────────────────────────────────────────────

async function main() {
  const feedsFile = process.env.FEEDS_FILE ?? "workspace/feeds.txt";
  const outputDir = process.env.BRIEFING_OUTPUT_DIR ?? "workspace/briefings";
  const today = new Date();

  // 1. Read the feeds file
  const feedsPath = resolve(feedsFile);
  if (!existsSync(feedsPath)) {
    console.error(`Feeds file not found: ${feedsPath}`);
    console.error("Create workspace/feeds.txt with one RSS URL per line.");
    process.exit(1);
  }
  const feedsRaw = readFileSync(feedsPath, "utf-8");
  const feedUrls = parseFeedUrls(feedsRaw);

  if (feedUrls.length === 0) {
    console.log("No feeds configured. Add URLs to workspace/feeds.txt.");
    return;
  }

  console.log(`Fetching ${feedUrls.length} feed(s)...`);

  // 2. Fetch each feed via curl
  const feedContents: Array<{ url: string; content: string | null; error?: string }> = [];

  for (const url of feedUrls) {
    try {
      const result = execSync(`curl -sL --max-time 15 "${url}"`, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      feedContents.push({ url, content: result });
      console.log(`  OK  ${url}`);
    } catch (err: any) {
      feedContents.push({ url, content: null, error: err.message || "fetch failed" });
      console.log(`  FAIL ${url}: ${err.message ?? "unknown"}`);
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

  console.log("Generating briefing...");

  // 4. Generate the briefing
  const briefing = await generateText(modelInput, SYSTEM_PROMPT);

  // 5. Write to output file
  mkdirSync(resolve(outputDir), { recursive: true });
  const outPath = resolve(outputDir, `${formatDate(today)}.md`);
  writeFileSync(outPath, briefing, "utf-8");

  // 6. Report
  const failed = feedContents.filter((f) => !f.content).length;
  console.log(
    `\nBriefing saved to ${outPath} (${feedUrls.length} feeds processed, ${failed} failed).`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
