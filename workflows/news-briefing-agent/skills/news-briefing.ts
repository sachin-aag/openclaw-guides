/**
 * News Briefing skill — standalone version
 *
 * Reads RSS feed URLs from `workspace/feeds.txt`, fetches each feed via curl,
 * sends the content to an LLM to produce a structured briefing, and writes
 * the result to `workspace/briefings/<date>.md`. Optionally also delivers
 * the briefing to a Telegram chat.
 *
 * Two entry points share this module:
 *   - npm run briefing  → main() below (one-shot, always regenerates)
 *   - npm run bot       → bot.ts (calls runBriefing() through a mutex)
 */

import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
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

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseFeedUrls(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

// Telegram caps each message at 4096 chars. Split on paragraph
// boundaries so headings and bullets stay readable.
const TELEGRAM_MAX_CHARS = 3800;

function chunkForTelegram(text: string, max = TELEGRAM_MAX_CHARS): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > max && buf) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export async function sendToTelegram(
  briefing: string,
  dateLabel: string,
  opts: { token?: string; chatId?: string } = {},
): Promise<{ delivered: boolean; reason?: string }> {
  const token = (opts.token ?? process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (opts.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "").trim();

  if (!token || !chatId) {
    return { delivered: false, reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const chunks = chunkForTelegram(briefing);

  for (let i = 0; i < chunks.length; i++) {
    const prefix =
      chunks.length > 1 ? `[${i + 1}/${chunks.length}] News briefing ${dateLabel}\n\n` : "";
    const body = prefix + chunks[i];

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Telegram sendMessage failed (${res.status}): ${errText}`);
    }
  }

  return { delivered: true };
}

// ── core: runBriefing ─────────────────────────────────────────────

export interface RunBriefingOptions {
  /**
   * If true, always regenerate even when today's file exists and is fresh.
   * The CLI sets this; the bot leaves it false so repeat /briefing calls
   * within the cache window are free.
   */
  forceRegenerate?: boolean;
  /**
   * Override the outbound Telegram delivery target. When set, the briefing
   * is sent to this chatId instead of (or in addition to) the env default.
   * Pass null to disable Telegram delivery entirely for this call.
   */
  deliverTo?: { chatId: string } | null;
  /**
   * If a same-day briefing exists and was written less than this many
   * minutes ago, reuse it instead of regenerating. Defaults to 60.
   */
  cacheMinutes?: number;
  /** Override stdout logging. Defaults to console.log. */
  log?: (msg: string) => void;
}

export interface RunBriefingResult {
  outPath: string;
  briefing: string;
  reused: boolean;
  feedsProcessed: number;
  feedsFailed: number;
  telegram: { delivered: boolean; reason?: string };
}

export async function runBriefing(opts: RunBriefingOptions = {}): Promise<RunBriefingResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const cacheMinutes = opts.cacheMinutes ?? 60;
  const feedsFile = process.env.FEEDS_FILE ?? "workspace/feeds.txt";
  const outputDir = process.env.BRIEFING_OUTPUT_DIR ?? "workspace/briefings";
  const today = new Date();
  const dateLabel = formatDate(today);
  const outPath = resolve(outputDir, `${dateLabel}.md`);

  // Cache check — skip the LLM call if today's file is recent.
  if (!opts.forceRegenerate && existsSync(outPath)) {
    const ageMs = Date.now() - statSync(outPath).mtimeMs;
    if (ageMs < cacheMinutes * 60_000) {
      const cached = readFileSync(outPath, "utf-8");
      log(`Reusing today's briefing (${Math.round(ageMs / 60_000)}m old).`);
      const tg = await deliver(cached, dateLabel, opts);
      return {
        outPath,
        briefing: cached,
        reused: true,
        feedsProcessed: 0,
        feedsFailed: 0,
        telegram: tg,
      };
    }
  }

  const feedsPath = resolve(feedsFile);
  if (!existsSync(feedsPath)) {
    throw new Error(
      `Feeds file not found: ${feedsPath}. Create workspace/feeds.txt with one RSS URL per line.`,
    );
  }
  const feedUrls = parseFeedUrls(readFileSync(feedsPath, "utf-8"));
  if (feedUrls.length === 0) {
    throw new Error("No feeds configured. Add URLs to workspace/feeds.txt.");
  }

  log(`Fetching ${feedUrls.length} feed(s)...`);

  const feedContents: Array<{ url: string; content: string | null; error?: string }> = [];
  for (const url of feedUrls) {
    try {
      const result = execSync(`curl -sL --max-time 15 "${url}"`, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      feedContents.push({ url, content: result });
      log(`  OK  ${url}`);
    } catch (err: any) {
      feedContents.push({ url, content: null, error: err.message || "fetch failed" });
      log(`  FAIL ${url}: ${err.message ?? "unknown"}`);
    }
  }

  const successfulFeeds = feedContents
    .filter((f) => f.content)
    .map((f) => `### Feed: ${f.url}\n\n${f.content}`)
    .join("\n\n---\n\n");

  const failedFeeds = feedContents
    .filter((f) => !f.content)
    .map((f) => `- ${f.url}: ${f.error}`)
    .join("\n");

  const modelInput = [
    `Today's date: ${dateLabel}`,
    "",
    "## RSS Feed Content",
    "",
    successfulFeeds,
    "",
    failedFeeds ? `## Failed Fetches\n\n${failedFeeds}` : "",
  ].join("\n");

  log("Generating briefing...");
  const briefing = await generateText(modelInput, SYSTEM_PROMPT);

  mkdirSync(resolve(outputDir), { recursive: true });
  writeFileSync(outPath, briefing, "utf-8");

  const tg = await deliver(briefing, dateLabel, opts);
  const failed = feedContents.filter((f) => !f.content).length;
  log(`\nBriefing saved to ${outPath} (${feedUrls.length} feeds processed, ${failed} failed).`);

  return {
    outPath,
    briefing,
    reused: false,
    feedsProcessed: feedUrls.length,
    feedsFailed: failed,
    telegram: tg,
  };
}

async function deliver(
  briefing: string,
  dateLabel: string,
  opts: RunBriefingOptions,
): Promise<{ delivered: boolean; reason?: string }> {
  if (opts.deliverTo === null) return { delivered: false, reason: "delivery disabled by caller" };
  try {
    return await sendToTelegram(briefing, dateLabel, {
      chatId: opts.deliverTo?.chatId,
    });
  } catch (err: any) {
    const log = opts.log ?? ((m: string) => console.log(m));
    log(`Telegram delivery failed: ${err.message ?? err}`);
    log("(The briefing file was still written successfully.)");
    return { delivered: false, reason: err.message ?? String(err) };
  }
}

// ── CLI entry point ───────────────────────────────────────────────

async function main() {
  const result = await runBriefing({ forceRegenerate: true });
  if (result.telegram.delivered) {
    console.log("Telegram: delivered.");
  } else if (result.telegram.reason && !result.telegram.reason.includes("not set")) {
    console.log(`Telegram: ${result.telegram.reason}`);
  } else {
    console.log("Telegram: skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).");
  }
}

// Only run main() when this file is the entry point, not when imported by bot.ts.
const isCli =
  process.argv[1] && (process.argv[1].endsWith("news-briefing.ts") || process.argv[1].endsWith("news-briefing.js"));

if (isCli) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
