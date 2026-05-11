/**
 * Price Monitor Bot — long-running Telegram bot + recurring cron
 *
 * Runs as `npm run bot`. Two things happen in one process:
 *   1. Recurring cron fires runCheck() every PRICE_CHECK_INTERVAL_MINUTES.
 *      Cron-mode delivery is alerts-only — quiet runs stay quiet so your
 *      phone isn't pinged for "everything is fine" every hour.
 *   2. Long-poll loop accepts /check, /ask, /reset, /watchlist, /help, /start
 *      from allow-listed users.
 *
 * Hard rules (do not relax without re-reading the README):
 *   - TELEGRAM_ALLOWED_USER_IDS is REQUIRED. Empty = refuse to start.
 *   - The ONLY commands that reach the LLM are /check and /ask. Bare text
 *     (no leading slash, or any unknown command) gets a fixed reply — the
 *     same help text /help shows. There is no freeform chat path.
 *   - /ask is grounded on the local price-log only and rate-limited per
 *     user per day (see skills/ask.ts). It is not a general chatbot.
 *   - All checks go through a single in-process mutex so the cron and a
 *     /check command can't double-fire.
 */

import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runCheck } from "./price-monitor.js";
import { handleAsk, resetAskMemory } from "./ask.js";

// ── env / startup checks ──────────────────────────────────────────

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
const ALLOW_LIST_RAW = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "").trim();
const INTERVAL_RAW = (process.env.PRICE_CHECK_INTERVAL_MINUTES ?? "").trim();
const WATCHLIST_FILE = process.env.WATCHLIST_FILE ?? "workspace/watchlist.yaml";

const MIN_INTERVAL_MINUTES = 5;

function fail(msg: string): never {
  console.error(`\n[bot] ${msg}\n`);
  process.exit(1);
}

if (!TOKEN) {
  fail(
    "TELEGRAM_BOT_TOKEN is not set. Get a token from @BotFather and add it to .env. See README.md → Step 2a.",
  );
}

if (!ALLOW_LIST_RAW) {
  fail(
    "Refusing to start: TELEGRAM_ALLOWED_USER_IDS is empty. The bot would accept commands from anyone who finds its username, and every /check call costs LLM tokens. Set it to your numeric Telegram user ID (find it via @userinfobot). Comma-separate for multiple users.",
  );
}

const ALLOW_LIST = new Set(
  ALLOW_LIST_RAW.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n)),
);

if (ALLOW_LIST.size === 0) {
  fail(
    "TELEGRAM_ALLOWED_USER_IDS is set but contains no valid numeric IDs. Example: TELEGRAM_ALLOWED_USER_IDS=12345678,87654321",
  );
}

const INTERVAL_MINUTES = INTERVAL_RAW === "" ? null : Number(INTERVAL_RAW);
if (INTERVAL_MINUTES !== null) {
  if (!Number.isFinite(INTERVAL_MINUTES) || INTERVAL_MINUTES < MIN_INTERVAL_MINUTES) {
    fail(
      `PRICE_CHECK_INTERVAL_MINUTES must be a number ≥ ${MIN_INTERVAL_MINUTES}, got "${INTERVAL_RAW}". Lower values would re-bill the LLM faster than prices change. Leave empty to disable the recurring check.`,
    );
  }
}

// ── concurrency: single-flight mutex ──────────────────────────────

let runInProgress = false;

async function runWithLock<T>(fn: () => Promise<T>): Promise<T | { skipped: true }> {
  if (runInProgress) return { skipped: true };
  runInProgress = true;
  try {
    return await fn();
  } finally {
    runInProgress = false;
  }
}

// ── Telegram helpers ──────────────────────────────────────────────

const API = `https://api.telegram.org/bot${TOKEN}`;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
}

async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  }
  return json.result as T;
}

async function reply(chatId: number, text: string): Promise<void> {
  try {
    await tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
  } catch (err: any) {
    console.error(`[bot] reply failed: ${err.message ?? err}`);
  }
}

// ── command handlers ──────────────────────────────────────────────

const HELP_TEXT = [
  "Price monitor bot. Commands:",
  "  /check       — run a fresh price check now",
  "  /ask <q>     — ask a question about price-log entries from the last 7 days",
  "  /reset       — clear /ask conversation memory",
  "  /watchlist   — list configured items",
  "  /help        — this message",
].join("\n");

async function handleCheck(chatId: number): Promise<void> {
  const result = await runWithLock(async () => {
    await reply(chatId, "Running a price check...");
    return runCheck({
      // Deliver back to the chat that asked, not the env default. The
      // mutex above (runWithLock) handles same-second double-taps —
      // they get "already running" instead of double-billing the LLM.
      deliverTo: { chatId: String(chatId) },
      log: (m) => console.log(`[bot] ${m}`),
    });
  });

  if ("skipped" in result) {
    await reply(chatId, "A check is already running — hold tight, I'll send the result shortly.");
    return;
  }

  if (!result.telegram.delivered) {
    await reply(
      chatId,
      `Check completed but Telegram delivery failed: ${result.telegram.reason ?? "unknown"}\n\n${result.summary}`,
    );
  }
}

async function handleAskCommand(
  chatId: number,
  userId: number,
  question: string,
): Promise<void> {
  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  try {
    const result = await handleAsk(userId, question);
    await reply(chatId, result.text);
  } catch (err: any) {
    console.error(`[bot] /ask failed for user ${userId}:`, err);
    await reply(chatId, `/ask failed: ${err.message ?? "unknown error"}`);
  }
}

async function handleWatchlist(chatId: number): Promise<void> {
  const path = resolve(WATCHLIST_FILE);
  if (!existsSync(path)) {
    await reply(chatId, `No watchlist file at ${path}. Create workspace/watchlist.yaml.`);
    return;
  }
  const yaml = readFileSync(path, "utf-8");
  // Send the YAML verbatim — it's the source of truth for what's monitored.
  await reply(chatId, `Watchlist (${path}):\n\n${yaml.trim()}`);
}

const seenUnauthorized = new Set<number>();

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg || !msg.text || !msg.from) return;

  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (!ALLOW_LIST.has(userId)) {
    if (!seenUnauthorized.has(userId)) {
      seenUnauthorized.add(userId);
      console.warn(
        `[bot] unauthorized message from user_id=${userId} (@${msg.from.username ?? "?"}, ${msg.from.first_name ?? "?"}): ${text.slice(0, 80)}`,
      );
    }
    await reply(chatId, "Not authorized.");
    return;
  }

  // Normalize "/cmd@my_bot foo" → "/cmd" so group-style mentions still route.
  const cmd = text.toLowerCase().split(/\s+/)[0].split("@")[0];
  switch (cmd) {
    case "/start":
      await reply(chatId, "Hi. I'm your price-monitor bot. Try /check or /help.");
      return;
    case "/help":
      await reply(chatId, HELP_TEXT);
      return;
    case "/check":
      await handleCheck(chatId);
      return;
    case "/ask": {
      const isJustCommand = !text.includes(" ");
      const question = isJustCommand ? "" : text.slice(text.indexOf(" ") + 1).trim();
      await handleAskCommand(chatId, userId, question);
      return;
    }
    case "/reset": {
      const { hadMemory } = resetAskMemory(userId);
      await reply(
        chatId,
        hadMemory ? "Conversation memory cleared." : "No conversation memory to clear.",
      );
      return;
    }
    case "/watchlist":
      await handleWatchlist(chatId);
      return;
    default:
      // CRITICAL: do not route arbitrary text to the LLM. Only /check and
      // /ask reach the model. Anything else gets the help text.
      await reply(chatId, HELP_TEXT);
      return;
  }
}

// ── long-poll loop ────────────────────────────────────────────────

async function pollLoop(): Promise<void> {
  let offset = 0;
  while (true) {
    try {
      const updates = await tg<TelegramUpdate[]>("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message"],
      });
      for (const u of updates) {
        offset = u.update_id + 1;
        // Process serially so the mutex semantics are obvious. /check is
        // the only slow command; serial handling is fine.
        await handleUpdate(u).catch((err) => {
          console.error(`[bot] handleUpdate failed:`, err);
        });
      }
    } catch (err: any) {
      console.error(`[bot] poll error: ${err.message ?? err}. Retrying in 5s.`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// ── recurring cron ────────────────────────────────────────────────

function startRecurringCheck(intervalMinutes: number): void {
  const intervalMs = intervalMinutes * 60_000;
  // First tick fires after `intervalMs` — not immediately on startup, so
  // restarting the bot doesn't re-bill the LLM right away.
  setInterval(async () => {
    console.log(`[bot] cron tick at ${new Date().toISOString()} — running check`);
    const result = await runWithLock(() =>
      runCheck({
        // deliverTo undefined → cron-mode: only push to env chat if alerts.
        log: (m) => console.log(`[bot] ${m}`),
      }),
    );
    if ("skipped" in result) {
      console.log(`[bot] cron skipped — a manual /check was already in flight`);
      return;
    }
    if (result.alerts.length > 0 && !result.telegram.delivered) {
      console.warn(
        `[bot] alerts present but Telegram push failed: ${result.telegram.reason ?? "unknown"}`,
      );
    }
  }, intervalMs);
}

// ── startup ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Verify the token is good before announcing readiness.
  let me: { username?: string; first_name?: string };
  try {
    me = await tg<{ username?: string; first_name?: string }>("getMe");
  } catch (err: any) {
    fail(
      `Telegram rejected the bot token (${err.message ?? err}). Get a fresh token from @BotFather.`,
    );
  }

  // Drain any pending updates so we don't replay history on restart.
  try {
    const pending = await tg<TelegramUpdate[]>("getUpdates", { offset: -1, timeout: 0 });
    if (pending.length > 0) {
      await tg("getUpdates", { offset: pending[pending.length - 1].update_id + 1, timeout: 0 });
    }
  } catch {
    /* not fatal */
  }

  console.log(`[bot] @${me.username ?? me.first_name ?? "?"} ready.`);
  console.log(`[bot] allow-list: [${[...ALLOW_LIST].join(", ")}]`);
  console.log(
    INTERVAL_MINUTES === null
      ? `[bot] cron: disabled (set PRICE_CHECK_INTERVAL_MINUTES to enable)`
      : `[bot] cron: every ${INTERVAL_MINUTES} minute(s), alerts-only push to env chat`,
  );
  console.log(`[bot] /check on demand.`);

  if (INTERVAL_MINUTES !== null) startRecurringCheck(INTERVAL_MINUTES);

  await pollLoop();
}

main().catch((err) => {
  console.error("[bot] fatal:", err);
  process.exit(1);
});
