/**
 * Folder Watcher skill
 *
 * Runs on the gateway heartbeat. Each tick:
 *   1. List `*.txt` in inbox/
 *   2. For each new file: produce a markdown summary in out/<basename>.md
 *   3. Move the source to archive/<basename>.txt
 *
 * Idempotent: if inbox/ is empty, returns silently.
 *
 * NOTE: SDK shape may differ in your installed OpenClaw version —
 *       see https://docs.openclaw.ai for the current API.
 */

import { defineSkill } from "@openclaw/gateway";

export default defineSkill({
  name: "folder-watcher",

  args: {
    inbox: { type: "string", required: true },
    out: { type: "string", required: true },
    archive: { type: "string", required: true },
  },

  systemPromptAddendum: `
You will be asked to summarize a single text file. Output strictly:

  # <basename>

  ## Summary
  - bullet 1
  - bullet 2
  - bullet 3

  ## Action items
  - one short line, or "_none_"

No preamble. No closing remarks. Markdown only.
`,

  async run({ tools, args }) {
    const { inbox, out, archive } = args;
    const files = await listTxt(tools, inbox);
    if (files.length === 0) return;

    await tools.Bash({ cmd: `mkdir -p "${out}" "${archive}"` });

    for (const path of files) {
      const basename = path.split("/").pop()!.replace(/\.txt$/i, "");
      try {
        const content = await tools.Read({ path });
        const summary = await tools.llm.generate({
          input: `Source file: ${basename}.txt\n\n${content}`,
        });
        await tools.Write({ path: `${out}/${basename}.md`, content: summary });
        await tools.Bash({ cmd: `mv "${path}" "${archive}/"` });
      } catch (err) {
        // Leave the file in inbox; log and move on.
        await tools.log?.warn?.(`folder-watcher: failed on ${path}: ${String(err)}`);
      }
    }
  },
});

// --- helpers ---------------------------------------------------

async function listTxt(tools: any, dir: string): Promise<string[]> {
  try {
    const out = await tools.Bash({ cmd: `ls -1 "${dir}"/*.txt 2>/dev/null || true` });
    return String(out).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
