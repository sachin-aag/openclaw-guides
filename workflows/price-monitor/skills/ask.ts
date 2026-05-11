/**
 * /ask — answer questions about the last week's price-log entries.
 *
 * Design constraints (do not relax without re-reading bot.ts and README.md):
 *   - Only the explicit `/ask` command reaches the LLM. Bare text still
 *     gets a fixed reply (the help text). The cost-amplification guardrail
 *     is preserved — chatty group members can't burn tokens by typing.
 *   - Context = ONLY price-log entries from the last WINDOW_DAYS days,
 *     plus the current watchlist (so the model knows thresholds and URLs).
 *     No web fetch, no tools, no outside knowledge. If the answer isn't in
 *     the log, the bot says so.
 *   - Multi-turn memory uses a rolling buffer + periodic compaction.
 *     Recent (Q, A) turns are kept verbatim. When we've accumulated
 *     COMPACT_EVERY_N turns OR the memory exceeds COMPACT_AT_CHARS, a
 *     single LLM call folds everything into a short running summary and
 *     the buffer is cleared. Most turns cost 1 LLM call; every Nth turn
 *     costs 2.
 *   - Per-user daily rate limit. The allow-list bounds *who*; this bounds
 *     *how often*. Resets at local midnight.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { generateText } from "../lib/llm.js";

// ── config ────────────────────────────────────────────────────────

const PRICE_LOG_FILE = process.env.PRICE_LOG_FILE ?? "workspace/price-log.md";
const WATCHLIST_FILE = process.env.WATCHLIST_FILE ?? "workspace/watchlist.yaml";
const WINDOW_DAYS = 7;
const DAILY_LIMIT = Number(process.env.ASK_DAILY_LIMIT ?? "20");

// Compaction triggers: whichever fires first.
const COMPACT_EVERY_N = Number(process.env.ASK_COMPACT_EVERY ?? "5");
const COMPACT_AT_CHARS = Number(process.env.ASK_COMPACT_AT_CHARS ?? "6000");
const SUMMARY_MAX_CHARS = 2000;

const ANSWER_SYSTEM = `
You answer questions about a price-monitoring log the user already collected.

Rules:
- Use ONLY the price-log entries provided as context. Do not invent facts.
  Do not use outside knowledge about market prices, exchange rates, or news.
- The log is append-only. Each line starts with "[YYYY-MM-DD HH:MM:SS]" and
  records one check: an OK price reading, a WARN ("price not found"), or a
  FAIL (fetch error). Use the timestamps when answering trend/timing questions.
- The watchlist describes thresholds, directions ("below"/"above"), and URLs.
  Use it to explain *why* something would have alerted, but the prices
  themselves only come from the log.
- If the answer is not in the log, say so plainly. Do not guess.
- Be concise: 1–4 sentences unless the user explicitly asks for more.
- Cite specific timestamps when useful, e.g. "(2026-05-09 08:15)".
- "Conversation summary so far" and "Recent turns" are YOUR memory of earlier
  turns in this chat. Use them to resolve references like "that one" or "the
  first item". Do NOT treat them as a source of price facts.
`.trim();

const COMPACT_SYSTEM = `
You maintain a short running summary of a Q&A conversation about price
monitoring. Given the previous summary plus a batch of recent (question,
answer) turns, output an updated summary that absorbs the new turns.

Rules:
- Output ONLY the new summary text. No preamble, no markdown headings.
- Keep it under 200 words.
- Preserve item names, prices, dates, and topics the user has shown
  interest in. Drop pleasantries and meta-chat.
- Write in third person: "the user asked about X; the assistant answered Y".
`.trim();

// ── per-user state ────────────────────────────────────────────────

interface Turn {
  q: string;
  a: string;
}

interface UserState {
  /** Compacted memory of older turns. Empty = no history rolled up yet. */
  summary: string;
  /** Recent turns kept verbatim, oldest first. Folded into summary on compaction. */
  buffer: Turn[];
  /** Local-date key (YYYY-MM-DD). Counter resets when this changes. */
  dayKey: string;
  /** Number of /ask calls made today. */
  todayCount: number;
}

const state = new Map<number, UserState>();

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getState(userId: number): UserState {
  const key = todayKey();
  const cur = state.get(userId);
  if (!cur || cur.dayKey !== key) {
    const fresh: UserState = { summary: "", buffer: [], dayKey: key, todayCount: 0 };
    state.set(userId, fresh);
    return fresh;
  }
  return cur;
}

export function resetAskMemory(userId: number): { hadMemory: boolean } {
  const cur = state.get(userId);
  const hadMemory = !!(cur && (cur.summary || cur.buffer.length > 0));
  // Preserve today's rate-limit counter — /reset shouldn't be a way to
  // dodge the per-day cap.
  state.set(userId, {
    summary: "",
    buffer: [],
    dayKey: todayKey(),
    todayCount: cur?.todayCount ?? 0,
  });
  return { hadMemory };
}

function formatBuffer(buffer: Turn[]): string {
  if (buffer.length === 0) return "(none)";
  return buffer.map((t, i) => `Turn ${i + 1}\nUser: ${t.q}\nAssistant: ${t.a}`).join("\n\n");
}

function memoryChars(st: UserState): number {
  let n = st.summary.length;
  for (const t of st.buffer) n += t.q.length + t.a.length + 32;
  return n;
}

function shouldCompact(st: UserState): boolean {
  if (st.buffer.length === 0) return false;
  if (st.buffer.length >= COMPACT_EVERY_N) return true;
  if (memoryChars(st) >= COMPACT_AT_CHARS) return true;
  return false;
}

// ── log + watchlist loaders ───────────────────────────────────────

function loadRecentLog(): { lines: string[]; cutoff: string } {
  const path = resolve(PRICE_LOG_FILE);
  if (!existsSync(path)) return { lines: [], cutoff: "" };

  // Match lines starting with [YYYY-MM-DD HH:MM:SS]. Skip headers and blanks.
  const allLines = readFileSync(path, "utf-8").split("\n");
  const stamp = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\]/;

  const cutoffMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const cutoffStr = new Date(cutoffMs).toISOString().slice(0, 19).replace("T", " ");

  const lines: string[] = [];
  for (const line of allLines) {
    const m = line.match(stamp);
    if (!m) continue;
    const t = Date.parse(`${m[1]}T${m[2]}Z`);
    if (Number.isFinite(t) && t >= cutoffMs) lines.push(line);
  }
  return { lines, cutoff: cutoffStr };
}

function loadWatchlist(): string {
  const path = resolve(WATCHLIST_FILE);
  if (!existsSync(path)) return "(no watchlist file found)";
  // Pass the YAML through verbatim — the model can read it. Simpler than
  // re-serialising and keeps thresholds + URLs aligned with whatever the
  // user has on disk right now.
  return readFileSync(path, "utf-8");
}

// ── public API ────────────────────────────────────────────────────

export interface AskResult {
  kind: "answer" | "no-log" | "rate-limited" | "empty-question";
  text: string;
}

export async function handleAsk(userId: number, question: string): Promise<AskResult> {
  const q = question.trim();
  if (!q) {
    return {
      kind: "empty-question",
      text: "Usage: /ask <your question>. I'll answer from price-log entries in the last 7 days.",
    };
  }

  const st = getState(userId);
  if (st.todayCount >= DAILY_LIMIT) {
    return {
      kind: "rate-limited",
      text: `Daily /ask limit reached (${DAILY_LIMIT}/day). Resets at local midnight.`,
    };
  }

  const { lines, cutoff } = loadRecentLog();
  if (lines.length === 0) {
    return {
      kind: "no-log",
      text: `No price-log entries from the last ${WINDOW_DAYS} days. Run /check first.`,
    };
  }

  const watchlistYaml = loadWatchlist();

  const userPrompt = [
    `## Watchlist (current config)`,
    "",
    "```yaml",
    watchlistYaml.trim(),
    "```",
    "",
    `## Price log (last ${WINDOW_DAYS} days, since ${cutoff}, oldest first)`,
    "",
    lines.join("\n"),
    "",
    "## Conversation summary so far",
    "",
    st.summary || "(none yet)",
    "",
    "## Recent turns (verbatim, oldest first)",
    "",
    formatBuffer(st.buffer),
    "",
    "## User question",
    "",
    q,
  ].join("\n");

  const answer = (await generateText(userPrompt, ANSWER_SYSTEM)).trim();

  st.todayCount += 1;
  st.buffer.push({ q, a: answer });

  // Compact only when the buffer is full enough OR the memory is getting
  // large. Most turns skip this and pay 1 LLM call total.
  if (shouldCompact(st)) {
    try {
      const compactPrompt = [
        "## Previous summary",
        "",
        st.summary || "(none)",
        "",
        "## New turns to absorb (oldest first)",
        "",
        formatBuffer(st.buffer),
      ].join("\n");
      const newSummary = (await generateText(compactPrompt, COMPACT_SYSTEM)).trim();
      st.summary = newSummary.slice(0, SUMMARY_MAX_CHARS);
      st.buffer = [];
    } catch (err: any) {
      // Non-fatal: keep summary + buffer as-is. Retry on next turn.
      console.warn(`[ask] compaction failed for user ${userId}: ${err.message ?? err}`);
    }
  }

  return { kind: "answer", text: answer };
}
