/**
 * /ask — answer questions grounded on the last week's briefings.
 *
 * Design constraints (do not relax without re-reading bot.ts and README.md):
 *   - Only the explicit `/ask` command reaches the LLM. Bare text still
 *     gets a fixed reply (the help text). The cost-amplification guardrail
 *     is preserved — chatty group members can't burn tokens by typing.
 *   - Context = ONLY the briefing files from the last WINDOW_DAYS days.
 *     No web fetch, no tools, no outside knowledge. Bounds tokens per call
 *     to roughly briefing_corpus + question + short_answer.
 *   - Multi-turn memory uses a rolling buffer + periodic compaction.
 *     Recent (Q, A) turns are kept verbatim. When we've accumulated
 *     COMPACT_EVERY_N turns OR the memory exceeds COMPACT_AT_CHARS, a
 *     single LLM call folds everything into a short running summary and
 *     the buffer is cleared. So most turns cost 1 LLM call, every Nth
 *     turn costs 2. Cost-per-turn is bounded and amortised.
 *   - Per-user daily rate limit. The allow-list bounds *who*; this bounds
 *     *how often*. Resets at local midnight.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { generateText } from "../lib/llm.js";

// ── config ────────────────────────────────────────────────────────

const BRIEFINGS_DIR = process.env.BRIEFING_OUTPUT_DIR ?? "workspace/briefings";
const WINDOW_DAYS = 7;
const DAILY_LIMIT = Number(process.env.ASK_DAILY_LIMIT ?? "20");

// Compaction triggers: whichever fires first.
const COMPACT_EVERY_N = Number(process.env.ASK_COMPACT_EVERY ?? "5");
const COMPACT_AT_CHARS = Number(process.env.ASK_COMPACT_AT_CHARS ?? "6000");
const SUMMARY_MAX_CHARS = 2000;

const ANSWER_SYSTEM = `
You answer questions about a small set of news briefings the user already received.

Rules:
- Use ONLY the briefings provided as context. Do not invent facts. Do not use outside knowledge.
- If the answer is not in the briefings, say so plainly. Do not guess.
- Be concise: 1–4 sentences unless the user explicitly asks for more.
- Cite the briefing date(s) you drew from in parentheses, e.g. "(2026-05-09)".
- "Conversation summary so far" and "Recent turns" are YOUR memory of earlier turns
  in this chat. Use them to resolve references like "that", "the second one",
  "what you mentioned earlier". Do NOT treat them as a source of facts about
  the news — only the briefings are.
`.trim();

const COMPACT_SYSTEM = `
You maintain a short running summary of a Q&A conversation about news briefings.
Given the previous summary plus a batch of recent (question, answer) turns,
output an updated summary that absorbs the new turns.

Rules:
- Output ONLY the new summary text. No preamble, no markdown headings.
- Keep it under 200 words.
- Preserve facts, names, and topics the user has shown interest in.
- Drop pleasantries, meta-chat, and anything purely procedural.
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
    // New user, or first /ask after local midnight: reset the counter
    // and don't carry yesterday's memory into a new day.
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
  // dodge the per-day cap. Just clear the conversation memory.
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
  return buffer
    .map((t, i) => `Turn ${i + 1}\nUser: ${t.q}\nAssistant: ${t.a}`)
    .join("\n\n");
}

function memoryChars(st: UserState): number {
  // Rough proxy for "how big is the memory we'd ship to the model next time".
  // Not an exact token count, but cheap and good enough as a trigger.
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

// ── briefing loader ───────────────────────────────────────────────

interface BriefingDoc {
  date: string;
  content: string;
}

function loadRecentBriefings(): BriefingDoc[] {
  const dir = resolve(BRIEFINGS_DIR);
  if (!existsSync(dir)) return [];

  // Files are written as YYYY-MM-DD.md by news-briefing.ts. Anything else
  // (drafts, backups, .DS_Store) is ignored.
  const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));

  // Use UTC midnight for the cutoff so this is timezone-agnostic and
  // matches how formatDate() writes the filenames (toISOString slice).
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const cutoffMs = todayUtc.getTime() - (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000;

  const docs: BriefingDoc[] = [];
  for (const f of files) {
    const date = f.replace(/\.md$/, "");
    const t = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(t) || t < cutoffMs) continue;
    docs.push({ date, content: readFileSync(resolve(dir, f), "utf-8") });
  }
  docs.sort((a, b) => a.date.localeCompare(b.date));
  return docs;
}

// ── public API ────────────────────────────────────────────────────

export interface AskResult {
  kind: "answer" | "no-briefings" | "rate-limited" | "empty-question";
  text: string;
}

export async function handleAsk(userId: number, question: string): Promise<AskResult> {
  const q = question.trim();
  if (!q) {
    return {
      kind: "empty-question",
      text: "Usage: /ask <your question>. I'll answer from briefings in the last 7 days.",
    };
  }

  const st = getState(userId);
  if (st.todayCount >= DAILY_LIMIT) {
    return {
      kind: "rate-limited",
      text: `Daily /ask limit reached (${DAILY_LIMIT}/day). Resets at local midnight.`,
    };
  }

  const briefings = loadRecentBriefings();
  if (briefings.length === 0) {
    return {
      kind: "no-briefings",
      text: `No briefings from the last ${WINDOW_DAYS} days. Run /briefing first.`,
    };
  }

  const briefingBlock = briefings
    .map((b) => `### Briefing — ${b.date}\n\n${b.content}`)
    .join("\n\n---\n\n");

  const userPrompt = [
    `## Briefings (last ${WINDOW_DAYS} days, oldest first)`,
    "",
    briefingBlock,
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

  // Count the user's question only. Compaction (when it fires) is an
  // internal cost we accept as the price of multi-turn memory.
  st.todayCount += 1;
  st.buffer.push({ q, a: answer });

  // Compact only when the buffer is full enough OR the memory is getting
  // large. Most turns skip this and pay 1 LLM call total. Every Nth turn
  // (or any turn that produces a wall of text) pays 2.
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
      // Non-fatal: keep summary + buffer as-is. The buffer keeps growing
      // until the next successful compaction. If the LLM is genuinely
      // down, the answer call above would have failed too.
      console.warn(`[ask] compaction failed for user ${userId}: ${err.message ?? err}`);
    }
  }

  return { kind: "answer", text: answer };
}
