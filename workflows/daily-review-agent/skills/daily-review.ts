/**
 * Daily Review skill
 *
 * Reads yesterday's notes from `workspace/notes/<yesterday>.md` (and any
 * additional days configured via `look_back_days`) and writes a structured
 * review to `daily-review.md` in the workspace root.
 *
 * Invoked by:
 *   - manual:  `npm run review`
 *   - cron:    see gateway.config.yaml
 *
 * NOTE: This file uses the OpenClaw Skill SDK shape. If the SDK package
 *       names differ in your installed OpenClaw version, the imports may
 *       need adjustment — see https://docs.openclaw.ai for the current API.
 */

import { defineSkill } from "@openclaw/gateway";

export default defineSkill({
  name: "daily-review",

  /** What the agent sees as its job, on top of SOUL.md. */
  systemPromptAddendum: `
You are running the daily-review skill.
Read every input file you are given. Produce a structured markdown report
with these exact sections (in order):

  # Daily review — <YYYY-MM-DD>

  ## Summary
  - 3 to 5 bullets, one sentence each.

  ## Decisions made
  - Bullet list. Empty section is fine — write "_none_".

  ## Open questions
  - Bullet list of unresolved threads.

  ## Action items
  - Bullet list, each starting with a verb.

End with one line of plain text in the chat reply (not in the file):
"Review for <YYYY-MM-DD> saved (<N> notes summarized)."
`,

  /** Skill arguments configured in gateway.config.yaml */
  args: {
    look_back_days: { type: "number", default: 1 },
    output: { type: "string", default: "daily-review.md" },
    notify: { type: "string", default: "web" },
  },

  /** Skill body. `tools` is the Pi tool set; `notify` posts to a channel. */
  async run({ tools, notify, args, workspace, today }) {
    const targetDate = subtractDays(today, args.look_back_days);
    const noteFiles = await collectNoteFiles({
      tools,
      workspace,
      from: targetDate,
      lookBackDays: args.look_back_days,
    });

    if (noteFiles.length === 0) {
      await notify(args.notify, `No notes found for ${formatDate(targetDate)}. Nothing to review.`);
      return;
    }

    // Let the model produce the structured review from the loaded notes.
    const review = await tools.llm.generate({
      // The agent loop will inject SOUL.md + the systemPromptAddendum above.
      input: noteFiles.map(({ path, contents }) => `### ${path}\n\n${contents}`).join("\n\n"),
    });

    const outPath = `${workspace}/${args.output}`;
    await tools.Write({ path: outPath, content: review });

    await notify(
      args.notify,
      `Review for ${formatDate(targetDate)} saved (${noteFiles.length} notes summarized).`,
    );
  },
});

// --- helpers ---------------------------------------------------

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function collectNoteFiles({
  tools,
  workspace,
  from,
  lookBackDays,
}: {
  tools: any;
  workspace: string;
  from: Date;
  lookBackDays: number;
}): Promise<Array<{ path: string; contents: string }>> {
  const out: Array<{ path: string; contents: string }> = [];
  for (let i = 0; i < lookBackDays; i++) {
    const date = subtractDays(from, -i);
    const path = `${workspace}/notes/${formatDate(date)}.md`;
    try {
      const contents = await tools.Read({ path });
      out.push({ path, contents });
    } catch {
      // missing file for that day — skip silently
    }
  }
  return out;
}
