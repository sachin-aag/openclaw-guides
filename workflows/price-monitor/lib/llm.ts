/**
 * Multi-provider LLM abstraction.
 *
 * Reads OPENCLAW_PROVIDER and OPENCLAW_MODEL from the environment and
 * dispatches to the matching SDK.  Supports Anthropic, OpenAI, Google
 * Generative AI, and Featherless (OpenAI-compatible).
 *
 * Usage:
 *   import "dotenv/config";          // load .env first
 *   import { generateText } from "../lib/llm.js";
 *   const answer = await generateText("Summarise this…", "You are a …");
 */

// ── provider: Anthropic ────────────────────────────────────────────
async function anthropic(
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// ── provider: OpenAI ───────────────────────────────────────────────
async function openai(
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI(); // reads OPENAI_API_KEY
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });
  const res = await client.chat.completions.create({ model, messages });
  return res.choices[0]?.message?.content ?? "";
}

// ── provider: Google Generative AI ─────────────────────────────────
async function google(
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });
  const res = await genModel.generateContent(prompt);
  return res.response.text();
}

// ── provider: Featherless (OpenAI-compatible) ──────────────────────
async function featherless(
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) throw new Error("FEATHERLESS_API_KEY is not set");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.featherless.ai/v1",
  });
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });
  const res = await client.chat.completions.create({ model, messages });
  return res.choices[0]?.message?.content ?? "";
}

// ── public API ─────────────────────────────────────────────────────

const PROVIDERS: Record<
  string,
  (p: string, s: string | undefined, m: string) => Promise<string>
> = { anthropic, openai, google, featherless };

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  google: "gemini-1.5-flash",
  featherless: "meta-llama/Meta-Llama-3.1-8B-Instruct",
};

export async function generateText(
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const provider = (process.env.OPENCLAW_PROVIDER ?? "anthropic").toLowerCase();
  const model = process.env.OPENCLAW_MODEL ?? DEFAULT_MODELS[provider] ?? "gpt-4o";
  const fn = PROVIDERS[provider];
  if (!fn) {
    throw new Error(
      `Unknown provider "${provider}". Supported: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return fn(prompt, systemPrompt, model);
}
