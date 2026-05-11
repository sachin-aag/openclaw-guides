/**
 * News Briefing Bot — long-running Telegram bot + daily cron
 *
 * Runs as `npm run bot`. Two things happen in one process:
 *   1. Daily cron fires runBriefing() at BRIEFING_CRON_HOUR (local time).
 *   2. Long-poll loop accepts /briefing, /feeds, /help, /start from
 *      allow-listed users.
 *
 * Hard rules (do not relax without re-reading the README):
 *   - TELEGRAM_ALLOWED_USER_IDS is REQUIRED. Empty = refuse to start.
 *   - The ONLY commands that reach the LLM are /briefing and /ask. Bare
 *     text (no leading slash, or any unknown command) gets a fixed reply
 *     — the same help text /help shows. There is no freeform chat path.
 *     This is the cost-amplification guardrail; do not remove it.
 *   - /ask is grounded on local briefing files only and rate-limited
 *     per user per day (see skills/ask.ts). It is not a general chatbot.
 *   - All briefing runs go through a single in-process mutex so the cron
 *     and a /briefing command can't double-fire.
 */

import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runBriefing, formatDate } from "./news-briefing.js";
import { handleAsk, resetAskMemory } from "./ask.js";

// ── env / startup checks ──────────────────────────────────────────

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
const ALLOW_LIST_RAW = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "").trim();
const CRON_HOUR_RAW = (process.env.BRIEFING_CRON_HOUR ?? "").trim();
const FEEDS_FILE = process.env.FEEDS_FILE ?? "workspace/feeds.txt";

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
    "Refusing to start: TELEGRAM_ALLOWED_USER_IDS is empty. The bot would accept commands from anyone who finds its username, and every /briefing call costs LLM tokens. Set it to your numeric Telegram user ID (find it via @userinfobot). Comma-separate for multiple users.",
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

const CRON_HOUR = CRON_HOUR_RAW === "" ? null : Number(CRON_HOUR_RAW);
if (CRON_HOUR !== null && (!Number.isInteger(CRON_HOUR) || CRON_HOUR < 0 || CRON_HOUR > 23)) {
  fail(`BRIEFING_CRON_HOUR must be an integer 0–23, got "${CRON_HOUR_RAW}". Leave empty to disable the cron.`);
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
  "News briefing bot. Commands:",
  "  /briefing   — run today's briefing (cached if recent)",
  "  /ask <q>    — ask a question about briefings from the last 7 days",
  "  /reset      — clear /ask conversation memory",
  "  /feeds      — list configured RSS feeds",
  "  /help       — this message",
].join("\n");

async function handleBriefing(chatId: number): Promise<void> {
  const result = await runWithLock(async () => {
    await reply(chatId, "Working on the briefing...");
    return runBriefing({
      // Reuse same-day file when fresh — protects against repeated /briefing.
      forceRegenerate: false,
      // Deliver back to the chat that asked, not the env default.
      deliverTo: { chatId: String(chatId) },
      log: (m) => console.log(`[bot] ${m}`),
    });
  });

  if ("skipped" in result) {
    await reply(chatId, "A briefing is already running — hold tight, I'll send it shortly.");
    return;
  }

  if (!result.telegram.delivered) {
    await reply(chatId, `Briefing saved to ${result.outPath}, but Telegram delivery failed: ${result.telegram.reason ?? "unknown"}`);
  }
}

async function handleAskCommand(
  chatId: number,
  userId: number,
  question: string,
): Promise<void> {
  // Show "typing..." while the LLM works. Best-effort; ignore failures.
  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  try {
    const result = await handleAsk(userId, question);
    await reply(chatId, result.text);
  } catch (err: any) {
    console.error(`[bot] /ask failed for user ${userId}:`, err);
    await reply(chatId, `/ask failed: ${err.message ?? "unknown error"}`);
  }
}

async function handleFeeds(chatId: number): Promise<void> {
  const path = resolve(FEEDS_FILE);
  if (!existsSync(path)) {
    await reply(chatId, `No feeds file at ${path}. Create workspace/feeds.txt with one URL per line.`);
    return;
  }
  const lines = readFileSync(path, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) {
    await reply(chatId, "No feeds configured. Add URLs to workspace/feeds.txt.");
    return;
  }

  const list = lines.map((u, i) => `${i + 1}. ${u}`).join("\n");
  await reply(chatId, `Configured feeds (${lines.length}):\n\n${list}`);
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

  // Normalize "/ask@my_bot foo" → "/ask" so group-style mentions still route.
  const cmd = text.toLowerCase().split(/\s+/)[0].split("@")[0];
  switch (cmd) {
    case "/start":
      await reply(chatId, "Hi. I'm your news-briefing bot. Try /briefing or /help.");
      return;
    case "/help":
      await reply(chatId, HELP_TEXT);
      return;
    case "/briefing":
      await handleBriefing(chatId);
      return;
    case "/ask": {
      // Everything after the command word is the question. Strip the
      // leading "/ask" (and any bot-mention suffix like "/ask@my_bot").
      const question = text.slice(text.indexOf(" ") + 1).trim();
      const isJustCommand = !text.includes(" ");
      await handleAskCommand(chatId, userId, isJustCommand ? "" : question);
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
    case "/feeds":
      await handleFeeds(chatId);
      return;
    default:
      // CRITICAL: do not route arbitrary text to the LLM. The only commands
      // that hit the model are /briefing and /ask. Anything else gets the
      // help text — same as /help — so users discover the right command.
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
        // Process serially so the mutex semantics are obvious. /briefing
        // is the only slow command; serial handling is fine here.
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

// ── daily cron ────────────────────────────────────────────────────

function startDailyCron(hour: number): void {
  let firedThisHour = false;
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() !== hour || now.getMinutes() !== 0) {
      if (now.getMinutes() !== 0) firedThisHour = false;
      return;
    }
    if (firedThisHour) return;
    firedThisHour = true;

    console.log(`[bot] cron tick at ${now.toISOString()} — running briefing`);
    const result = await runWithLock(() =>
      runBriefing({
        forceRegenerate: true,
        log: (m) => console.log(`[bot] ${m}`),
      }),
    );
    if ("skipped" in result) {
      console.log(`[bot] cron skipped — a manual /briefing was already in flight`);
    }
  }, 60_000);
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
    CRON_HOUR === null
      ? `[bot] cron: disabled (set BRIEFING_CRON_HOUR to enable)`
      : `[bot] cron: ${String(CRON_HOUR).padStart(2, "0")}:00 ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  );
  console.log(`[bot] /briefing on demand. Today is ${formatDate(new Date())}.`);

  if (CRON_HOUR !== null) startDailyCron(CRON_HOUR);

  await pollLoop();
}

main().catch((err) => {
  console.error("[bot] fatal:", err);
  process.exit(1);
});
