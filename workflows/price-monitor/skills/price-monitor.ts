/**
 * Price Monitor skill — standalone version
 *
 * Reads watch targets from `workspace/watchlist.yaml`, fetches each via curl,
 * uses an LLM to extract the current price, compares against thresholds,
 * and logs results. Alerts are printed to the console.
 *
 * Run:
 *   npm run check
 */

import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { generateText } from "../lib/llm.js";

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

interface WatchItem {
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

// ── main ──────────────────────────────────────────────────────────

async function main() {
  const watchlistFile = process.env.WATCHLIST_FILE ?? "workspace/watchlist.yaml";
  const logFile = process.env.PRICE_LOG_FILE ?? "workspace/price-log.md";
  const today = new Date();

  // 1. Read and parse the watchlist
  const watchlistPath = resolve(watchlistFile);
  if (!existsSync(watchlistPath)) {
    console.error(`Watchlist not found: ${watchlistPath}`);
    console.error("Create workspace/watchlist.yaml with items to monitor.");
    process.exit(1);
  }
  const watchlistRaw = readFileSync(watchlistPath, "utf-8");
  const items = parseWatchlist(watchlistRaw);

  if (items.length === 0) {
    console.log("No items in watchlist. Add entries to workspace/watchlist.yaml.");
    return;
  }

  const timestamp = today.toISOString().slice(0, 19).replace("T", " ");
  const logEntries: string[] = [];
  const alerts: string[] = [];

  console.log(`Checking ${items.length} item(s)...`);

  // 2. Check each item
  for (const item of items) {
    let pageContent: string;
    try {
      pageContent = execSync(`curl -sL --max-time 20 "${item.url}"`, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      console.log(`  FETCHED ${item.name}`);
    } catch (err: any) {
      const errorMsg = `[${timestamp}] FAIL ${item.name}: fetch failed — ${err.message || "timeout"}`;
      logEntries.push(errorMsg);
      console.log(`  FAIL    ${item.name}: ${err.message ?? "unknown"}`);
      continue;
    }

    // 3. Ask the model to extract the price
    const extraction = await generateText(
      `Extract the price for "${item.name}" from this content:\n\n${pageContent.slice(0, 8000)}`,
      SYSTEM_PROMPT,
    );

    // 4. Parse the model's response
    const parsed = parsePriceResponse(extraction);

    if (parsed.price === null) {
      const errorMsg = `[${timestamp}] WARN  ${item.name}: price not found — ${parsed.error || "unknown"}`;
      logEntries.push(errorMsg);
      console.log(`  WARN    ${item.name}: price not found`);
      continue;
    }

    // 5. Log the price
    const logMsg = `[${timestamp}] ${item.name}: ${parsed.currency} ${parsed.price} (threshold: ${item.direction} ${item.threshold})`;
    logEntries.push(logMsg);

    // 6. Check threshold
    const triggered =
      (item.direction === "below" && parsed.price < item.threshold) ||
      (item.direction === "above" && parsed.price > item.threshold);

    if (triggered) {
      const alert = `ALERT ${item.name}: ${parsed.currency} ${parsed.price} (${item.direction} ${item.threshold}) — ${item.url}`;
      alerts.push(alert);
      console.log(`  ALERT   ${item.name}: ${parsed.currency} ${parsed.price}`);
    } else {
      console.log(`  OK      ${item.name}: ${parsed.currency} ${parsed.price}`);
    }
  }

  // 7. Append to price log
  if (logEntries.length > 0) {
    const logPath = resolve(logFile);
    const existingLog = safeReadFile(logPath);
    const newContent = existingLog
      ? `${existingLog}\n${logEntries.join("\n")}\n`
      : `# Price Log\n\n${logEntries.join("\n")}\n`;
    writeFileSync(logPath, newContent, "utf-8");
  }

  // 8. Report
  console.log(`\nPrice check complete — ${items.length} items checked.`);
  if (alerts.length > 0) {
    console.log(`\nAlerts:\n${alerts.join("\n")}`);
  } else {
    console.log("No thresholds crossed.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
