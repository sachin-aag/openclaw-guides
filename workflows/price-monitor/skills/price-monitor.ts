/**
 * Price Monitor skill — standalone version
 *
 * Reads watch targets from `workspace/watchlist.yaml`, fetches each via curl,
 * uses an LLM to extract the current price, compares against thresholds,
 * appends results to `workspace/price-log.md`, and (optionally) pushes a
 * summary or alerts to Telegram.
 *
 * Two entry points share this module:
 *   - npm run check  → main() below (one-shot, always re-checks)
 *   - npm run bot    → bot.ts (calls runCheck() through a mutex)
 */

import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { generateText } from "../lib/llm.js";

const execFileAsync = promisify(execFile);

// How many items to check in parallel. Each item is one curl + one LLM call,
// so this also caps concurrent requests to your model provider. Default 4
// scales reasonably from a 4-item shipped watchlist (one batch) up to
// ~30 items (~8 batches, ~25-40s total) without hammering free-tier rate
// limits. Set PRICE_CHECK_CONCURRENCY=1 to force sequential, or raise it
// on a paid plan with many items.
const CONCURRENCY = Math.max(1, Number(process.env.PRICE_CHECK_CONCURRENCY ?? "4"));

// ── config ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are running the price-monitor skill.
You will receive the raw content of a web page or RSS feed.
Your job is to extract the current price of the item described.

Rules:
- Return ONLY a JSON object: { "price": <number or null>, "currency": "<USD|EUR|etc>", "error": "<string or null>" }
- If you can find a clear price, set "price" to the numeric value and "error" to null.
- If the content doesn't contain a clear price, set "price" to null and "error" to a short explanation.
- Never guess or hallucinate a price. If unsure, return null.
- Strip currency symbols and commas from the number (e.g., "$1,234.56" → 1234.56).
`.trim();

// ── types ─────────────────────────────────────────────────────────

export interface WatchItem {
  name: string;
  url: string;
  type: "rss" | "webpage";
  threshold: number;
  direction: "above" | "below";
}

interface PriceResult {
  price: number | null;
  currency: string;
  error: string | null;
}

export interface ItemCheck {
  item: WatchItem;
  status: "ok" | "alert" | "warn" | "fail";
  price: number | null;
  currency: string;
  message?: string;
}

export interface RunCheckResult {
  timestamp: string;
  itemsChecked: number;
  alerts: ItemCheck[];
  results: ItemCheck[];
  /** Human-readable summary, the same text we'd push to Telegram. */
  summary: string;
  telegram: { delivered: boolean; reason?: string };
}

// ── helpers ───────────────────────────────────────────────────────

function parseWatchlist(raw: string): WatchItem[] {
  const doc = parseYaml(raw) as { items?: WatchItem[] } | null;
  if (!doc?.items || !Array.isArray(doc.items)) return [];
  return doc.items.filter(
    (i) => i.name && i.url && typeof i.threshold === "number" && i.direction,
  );
}

function parsePriceResponse(response: string): PriceResult {
  try {
    const jsonMatch = response.match(/\{[^}]*"price"[^}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        price: typeof parsed.price === "number" ? parsed.price : null,
        currency: parsed.currency || "USD",
        error: parsed.error || null,
      };
    }
  } catch {
    // Fall through
  }
  return { price: null, currency: "USD", error: "Could not parse model response" };
}

function safeReadFile(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

// ── summary formatting ────────────────────────────────────────────

function formatSummary(timestamp: string, results: ItemCheck[]): string {
  const alerts = results.filter((r) => r.status === "alert");
  const ok = results.filter((r) => r.status === "ok");
  const issues = results.filter((r) => r.status === "warn" || r.status === "fail");

  const lines: string[] = [];
  lines.push(`Price check — ${timestamp}`);
  lines.push(`Checked ${results.length} item(s).`);
  lines.push("");

  if (alerts.length > 0) {
    lines.push(`ALERTS (${alerts.length}):`);
    for (const a of alerts) {
      lines.push(
        `- ${a.item.name}: ${a.currency} ${a.price} (${a.item.direction} ${a.item.threshold}) — ${a.item.url}`,
      );
    }
    lines.push("");
  }

  if (ok.length > 0) {
    lines.push("OK:");
    for (const r of ok) {
      lines.push(`- ${r.item.name}: ${r.currency} ${r.price}`);
    }
    lines.push("");
  }

  if (issues.length > 0) {
    lines.push(`Issues (${issues.length}):`);
    for (const r of issues) {
      lines.push(`- ${r.item.name}: ${r.message ?? r.status}`);
    }
  }

  return lines.join("\n").trimEnd();
}

function formatAlertsOnly(timestamp: string, alerts: ItemCheck[]): string {
  const lines: string[] = [];
  lines.push(`Price alerts — ${timestamp}`);
  lines.push("");
  for (const a of alerts) {
    lines.push(
      `- ${a.item.name}: ${a.currency} ${a.price} (${a.item.direction} ${a.item.threshold}) — ${a.item.url}`,
    );
  }
  return lines.join("\n");
}

// ── Telegram delivery ─────────────────────────────────────────────

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
  message: string,
  opts: { token?: string; chatId?: string } = {},
): Promise<{ delivered: boolean; reason?: string }> {
  const token = (opts.token ?? process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (opts.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "").trim();

  if (!token || !chatId) {
    return { delivered: false, reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const chunks = chunkForTelegram(message);

  for (let i = 0; i < chunks.length; i++) {
    const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n\n` : "";
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: prefix + chunks[i],
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

// ── core: runCheck ────────────────────────────────────────────────

export interface RunCheckOptions {
  /**
   * Override the outbound Telegram delivery target. Behaviour:
   *   - { chatId } → always send the full summary to that chat
   *   - null       → no delivery
   *   - undefined  → cron-style: send the env-default chat ONLY when
   *                  there are alerts. Quiet runs stay quiet.
   */
  deliverTo?: { chatId: string } | null;
  /** Override stdout logging. Defaults to console.log. */
  log?: (msg: string) => void;
}

export async function runCheck(opts: RunCheckOptions = {}): Promise<RunCheckResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const watchlistFile = process.env.WATCHLIST_FILE ?? "workspace/watchlist.yaml";
  const logFile = process.env.PRICE_LOG_FILE ?? "workspace/price-log.md";

  const watchlistPath = resolve(watchlistFile);
  if (!existsSync(watchlistPath)) {
    throw new Error(
      `Watchlist not found: ${watchlistPath}. Create workspace/watchlist.yaml with items to monitor.`,
    );
  }
  const items = parseWatchlist(readFileSync(watchlistPath, "utf-8"));
  if (items.length === 0) {
    throw new Error("No items in watchlist. Add entries to workspace/watchlist.yaml.");
  }

  const today = new Date();
  const timestamp = today.toISOString().slice(0, 19).replace("T", " ");

  log(`Checking ${items.length} item(s) with concurrency ${CONCURRENCY}...`);

  // Per-item check, no shared state — safe to run in parallel. Returns
  // both the structured ItemCheck and the price-log line. The caller
  // re-orders by watchlist index before writing the log so output is
  // deterministic regardless of completion order.
  async function checkItem(item: WatchItem): Promise<{ result: ItemCheck; logLine: string }> {
    let pageContent: string;
    try {
      // execFile (not execSync) so concurrent fetches don't block the
      // event loop, and arg array (not shell string) so URLs with shell
      // metacharacters can't be misinterpreted.
      const { stdout } = await execFileAsync("curl", ["-sL", "--max-time", "20", item.url], {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      pageContent = stdout;
      log(`  FETCHED ${item.name}`);
    } catch (err: any) {
      const msg = `fetch failed — ${err.message || "timeout"}`;
      log(`  FAIL    ${item.name}: ${err.message ?? "unknown"}`);
      return {
        result: { item, status: "fail", price: null, currency: "USD", message: msg },
        logLine: `[${timestamp}] FAIL ${item.name}: ${msg}`,
      };
    }

    const extraction = await generateText(
      `Extract the price for "${item.name}" from this content:\n\n${pageContent.slice(0, 8000)}`,
      SYSTEM_PROMPT,
    );
    const parsed = parsePriceResponse(extraction);

    if (parsed.price === null) {
      const msg = `price not found — ${parsed.error || "unknown"}`;
      log(`  WARN    ${item.name}: ${msg}`);
      return {
        result: {
          item,
          status: "warn",
          price: null,
          currency: parsed.currency,
          message: parsed.error ?? "price not found",
        },
        logLine: `[${timestamp}] WARN  ${item.name}: ${msg}`,
      };
    }

    const triggered =
      (item.direction === "below" && parsed.price < item.threshold) ||
      (item.direction === "above" && parsed.price > item.threshold);

    log(`  ${triggered ? "ALERT  " : "OK     "} ${item.name}: ${parsed.currency} ${parsed.price}`);
    return {
      result: {
        item,
        status: triggered ? "alert" : "ok",
        price: parsed.price,
        currency: parsed.currency,
      },
      logLine: `[${timestamp}] ${item.name}: ${parsed.currency} ${parsed.price} (threshold: ${item.direction} ${item.threshold})`,
    };
  }

  // Bounded-concurrency pool. Workers pull the next index until the queue
  // is drained. No external dependency, ~10 lines, fine for this scale.
  const ordered: Array<{ result: ItemCheck; logLine: string } | null> = new Array(items.length).fill(null);
  let nextIdx = 0;
  const workers: Promise<void>[] = [];
  const workerCount = Math.min(CONCURRENCY, items.length);
  for (let w = 0; w < workerCount; w++) {
    workers.push(
      (async () => {
        while (true) {
          const idx = nextIdx++;
          if (idx >= items.length) return;
          ordered[idx] = await checkItem(items[idx]);
        }
      })(),
    );
  }
  await Promise.all(workers);

  const results: ItemCheck[] = ordered.map((x) => x!.result);
  const logEntries: string[] = ordered.map((x) => x!.logLine);

  // Append to price log (source of truth for /ask).
  if (logEntries.length > 0) {
    const logPath = resolve(logFile);
    const existingLog = safeReadFile(logPath);
    const newContent = existingLog
      ? `${existingLog}\n${logEntries.join("\n")}\n`
      : `# Price Log\n\n${logEntries.join("\n")}\n`;
    writeFileSync(logPath, newContent, "utf-8");
  }

  const alerts = results.filter((r) => r.status === "alert");
  const summary = formatSummary(timestamp, results);

  log(`\nPrice check complete — ${results.length} items checked, ${alerts.length} alert(s).`);

  const tg = await deliver(summary, results, opts);

  return {
    timestamp,
    itemsChecked: results.length,
    alerts,
    results,
    summary,
    telegram: tg,
  };
}

async function deliver(
  summary: string,
  results: ItemCheck[],
  opts: RunCheckOptions,
): Promise<{ delivered: boolean; reason?: string }> {
  if (opts.deliverTo === null) return { delivered: false, reason: "delivery disabled by caller" };

  const alerts = results.filter((r) => r.status === "alert");

  // Cron-style default: only push to env chat when there are alerts.
  if (opts.deliverTo === undefined) {
    if (alerts.length === 0) return { delivered: false, reason: "no alerts to push" };
    const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
    try {
      return await sendToTelegram(formatAlertsOnly(ts, alerts));
    } catch (err: any) {
      return { delivered: false, reason: err.message ?? String(err) };
    }
  }

  // Explicit caller (a /check command): always send the full summary.
  try {
    return await sendToTelegram(summary, { chatId: opts.deliverTo.chatId });
  } catch (err: any) {
    return { delivered: false, reason: err.message ?? String(err) };
  }
}

// ── CLI entry point ───────────────────────────────────────────────

async function main() {
  // CLI semantics: the user explicitly invoked `npm run check`, so always
  // push the full summary to TELEGRAM_CHAT_ID (if set). Alerts-only mode
  // is reserved for the bot's recurring cron, where silent runs are the
  // whole point. Passing the env chat ID explicitly opts into "always push"
  // — leaving deliverTo undefined would inherit the cron-mode default.
  const envChatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  const result = await runCheck({
    deliverTo: envChatId ? { chatId: envChatId } : null,
  });

  if (result.alerts.length > 0) {
    console.log(
      `\nAlerts:\n${result.alerts.map((a) => `- ${a.item.name}: ${a.currency} ${a.price}`).join("\n")}`,
    );
  } else {
    console.log("No thresholds crossed.");
  }

  if (result.telegram.delivered) {
    console.log("Telegram: delivered.");
  } else if (!envChatId) {
    console.log("Telegram: skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).");
  } else if (result.telegram.reason) {
    console.log(`Telegram: ${result.telegram.reason}`);
  }
}

const isCli =
  process.argv[1] &&
  (process.argv[1].endsWith("price-monitor.ts") || process.argv[1].endsWith("price-monitor.js"));

if (isCli) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
