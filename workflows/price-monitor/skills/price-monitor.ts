/**
 * Price Monitor skill
 *
 * Reads watch targets from `workspace/watchlist.yaml`, fetches each via curl,
 * uses the model to extract the current price, compares against thresholds,
 * and alerts when conditions are met. Logs every check to `price-log.md`.
 *
 * Invoked by:
 *   - manual:    `npm run check`
 *   - heartbeat: see gateway.config.yaml (every 15 minutes by default)
 *
 * NOTE: This file uses the OpenClaw Skill SDK shape. If the SDK package
 *       names differ in your installed OpenClaw version, the imports may
 *       need adjustment — see https://docs.openclaw.ai for the current API.
 */

import { defineSkill } from "@openclaw/gateway";

export default defineSkill({
  name: "price-monitor",

  /** What the agent sees as its job, on top of SOUL.md. */
  systemPromptAddendum: `
You are running the price-monitor skill.
You will receive the raw content of a web page or RSS feed.
Your job is to extract the current price of the item described.

Rules:
- Return ONLY a JSON object: { "price": <number or null>, "currency": "<USD|EUR|etc>", "error": "<string or null>" }
- If you can find a clear price, set "price" to the numeric value and "error" to null.
- If the content doesn't contain a clear price, set "price" to null and "error" to a short explanation.
- Never guess or hallucinate a price. If unsure, return null.
- Strip currency symbols and commas from the number (e.g., "$1,234.56" → 1234.56).
`,

  /** Skill arguments configured in gateway.config.yaml */
  args: {
    watchlist: { type: "string", default: "workspace/watchlist.yaml" },
    log_file: { type: "string", default: "workspace/price-log.md" },
    notify: { type: "string", default: "web" },
  },

  /** Skill body. */
  async run({ tools, notify, args, today }) {
    // 1. Read and parse the watchlist
    const watchlistRaw = await tools.Read({ path: args.watchlist });
    const items = parseWatchlist(watchlistRaw);

    if (items.length === 0) {
      await notify(args.notify, "No items in watchlist. Add entries to workspace/watchlist.yaml.");
      return;
    }

    const timestamp = today.toISOString().slice(0, 19).replace("T", " ");
    const logEntries: string[] = [];
    const alerts: string[] = [];

    // 2. Check each item
    for (const item of items) {
      let pageContent: string;
      try {
        pageContent = await tools.Bash({
          command: `curl -sL --max-time 20 "${item.url}"`,
        });
      } catch (err: any) {
        const errorMsg = `[${timestamp}] ❌ ${item.name}: fetch failed — ${err.message || "timeout"}`;
        logEntries.push(errorMsg);
        continue;
      }

      // 3. Ask the model to extract the price
      const extraction = await tools.llm.generate({
        input: `Extract the price for "${item.name}" from this content:\n\n${pageContent.slice(0, 8000)}`,
      });

      // 4. Parse the model's response
      const parsed = parsePriceResponse(extraction);

      if (parsed.price === null) {
        const errorMsg = `[${timestamp}] ⚠️  ${item.name}: price not found — ${parsed.error || "unknown"}`;
        logEntries.push(errorMsg);
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
        const alert = `🚨 ${item.name}: ${parsed.currency} ${parsed.price} (${item.direction} ${item.threshold}) — ${item.url}`;
        alerts.push(alert);
      }
    }

    // 7. Append to price log
    if (logEntries.length > 0) {
      const existingLog = await safeRead(tools, args.log_file);
      const newContent = existingLog
        ? `${existingLog}\n${logEntries.join("\n")}\n`
        : `# Price Log\n\n${logEntries.join("\n")}\n`;
      await tools.Write({ path: args.log_file, content: newContent });
    }

    // 8. Send alerts
    if (alerts.length > 0) {
      await notify(args.notify, `Price alerts:\n\n${alerts.join("\n")}`);
    } else {
      await notify(
        args.notify,
        `Price check complete — ${items.length} items checked, no thresholds crossed.`,
      );
    }
  },
});

// --- helpers ---------------------------------------------------

interface WatchItem {
  name: string;
  url: string;
  type: "rss" | "webpage";
  threshold: number;
  direction: "above" | "below";
}

function parseWatchlist(raw: string): WatchItem[] {
  // Simple YAML-like parsing for the items list.
  // In production you'd use a YAML parser; for the workshop this handles
  // the expected format from watchlist.yaml.
  const items: WatchItem[] = [];
  const itemBlocks = raw.split(/^\s*-\s+name:/m).slice(1);

  for (const block of itemBlocks) {
    const nameMatch = block.match(/^[^\n]*/);
    const urlMatch = block.match(/url:\s*"?([^"\n]+)"?/);
    const typeMatch = block.match(/type:\s*(\w+)/);
    const thresholdMatch = block.match(/threshold:\s*([\d.]+)/);
    const directionMatch = block.match(/direction:\s*(\w+)/);

    if (nameMatch && urlMatch && thresholdMatch && directionMatch) {
      items.push({
        name: nameMatch[0].replace(/^["']|["']$/g, "").trim(),
        url: urlMatch[1].trim(),
        type: (typeMatch?.[1] as "rss" | "webpage") || "webpage",
        threshold: parseFloat(thresholdMatch[1]),
        direction: directionMatch[1] as "above" | "below",
      });
    }
  }

  return items;
}

interface PriceResult {
  price: number | null;
  currency: string;
  error: string | null;
}

function parsePriceResponse(response: string): PriceResult {
  try {
    // Try to extract JSON from the response
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

async function safeRead(tools: any, path: string): Promise<string | null> {
  try {
    return await tools.Read({ path });
  } catch {
    return null;
  }
}
