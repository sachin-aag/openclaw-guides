/**
 * Scratchpad skill
 *
 * Three sub-actions the agent invokes based on user intent:
 *   - save(line)   → append `- [HH:MM] <line>` under today's heading.
 *   - list(days)   → return the headers from the last N days.
 *   - search(q)    → grep notes.md for matching lines.
 *
 * NOTE: SDK shape may differ in your installed OpenClaw version —
 *       see https://docs.openclaw.ai for the current API.
 */

import { defineSkill } from "@openclaw/gateway";

export default defineSkill({
  name: "scratchpad",

  args: {
    file: { type: "string", default: "notes.md" },
  },

  systemPromptAddendum: `
You expose three actions the agent can call:
  scratchpad.save(line: string)
  scratchpad.list(days: number = 7)
  scratchpad.search(query: string)

Pick based on user intent. Confirm saves with one short word: "saved.".
For list/search, return results as a compact bullet list, no preamble.
`,

  actions: {
    async save({ tools, workspace, args }, { line }: { line: string }) {
      const path = `${workspace}/${args.file}`;
      const today = formatDate(new Date());
      const time = formatTime(new Date());

      const existing = await safeRead(tools, path);
      const todayHeader = `## ${today}`;
      const entry = `- [${time}] ${line.trim()}`;

      let next: string;
      if (!existing) {
        next = `# Notes\n\n${todayHeader}\n${entry}\n`;
      } else if (existing.includes(todayHeader)) {
        next = existing.replace(todayHeader, `${todayHeader}\n${entry}`);
      } else {
        next = `${existing.trimEnd()}\n\n${todayHeader}\n${entry}\n`;
      }
      await tools.Write({ path, content: next });
      return "saved.";
    },

    async list({ tools, workspace, args }, { days = 7 }: { days?: number }) {
      const text = (await safeRead(tools, `${workspace}/${args.file}`)) ?? "";
      const cutoff = subtractDays(new Date(), days);
      const headers = [...text.matchAll(/^## (\d{4}-\d{2}-\d{2})$/gm)]
        .map((m) => m[1])
        .filter((d) => new Date(d) >= cutoff);
      return headers.length ? headers.map((d) => `- ${d}`).join("\n") : "_no entries in window_";
    },

    async search({ tools, workspace, args }, { query }: { query: string }) {
      const text = (await safeRead(tools, `${workspace}/${args.file}`)) ?? "";
      const needle = query.toLowerCase();
      const hits = text
        .split("\n")
        .filter((l) => l.toLowerCase().includes(needle))
        .slice(0, 30);
      return hits.length ? hits.join("\n") : "_no matches_";
    },
  },
});

// --- helpers ---------------------------------------------------

async function safeRead(tools: any, path: string): Promise<string | null> {
  try {
    return await tools.Read({ path });
  } catch {
    return null;
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

function subtractDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - days);
  return r;
}
