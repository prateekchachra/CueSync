// Same agent, same tools, for any OpenAI-compatible chat API:
// Gemini (free tier), Groq / OpenRouter / Together (open models like Llama, Qwen, Gemma), or OpenAI itself.
// Uses plain fetch, so it runs unchanged in Node (CLI/tests) and Deno (Edge Function).

import { SYSTEM_PROMPT, type ChatTurn } from "./agent.ts";
import { TOOL_DEFS, runTool } from "./tools.ts";
import type { Catalogue } from "./types.ts";

const MAX_TURNS = 8;

export interface OpenAICompatOptions {
  apiKey: string;
  /** e.g. https://generativelanguage.googleapis.com/v1beta/openai (no trailing /chat/completions) */
  baseURL: string;
  model: string;
  onToolCall?: (name: string, input: unknown, isError: boolean) => void;
  /** Injected in tests. */
  fetch?: typeof fetch;
}

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Msg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export const OPENAI_TOOLS = TOOL_DEFS.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

export async function runAgentOpenAICompat(
  catalogue: Catalogue,
  input: string | ChatTurn[],
  opts: OpenAICompatOptions,
): Promise<string> {
  const doFetch = opts.fetch ?? fetch;
  const turns: ChatTurn[] = typeof input === "string" ? [{ role: "user", content: input }] : input;
  if (turns.length === 0 || turns[turns.length - 1]?.role !== "user") {
    throw new Error("The last message must be from the supervisor.");
  }

  const messages: Msg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...turns.map((t) => ({ role: t.role, content: t.content }) as Msg),
  ];
  const url = `${opts.baseURL.replace(/\/+$/, "")}/chat/completions`;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model: opts.model, messages, tools: OPENAI_TOOLS, tool_choice: "auto", max_tokens: 2000 }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("The model's free-tier rate limit was hit. Wait a minute and try again.");
      throw new Error(`Model API error ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[];
    };
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("The model returned no answer.");

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) return (message.content ?? "").trim();

    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
    for (const call of calls) {
      let args: unknown = {};
      let parseError: string | null = null;
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parseError = "Tool arguments were not valid JSON.";
      }
      const result = parseError ? { content: parseError, is_error: true } : runTool(catalogue, call.function.name, args);
      opts.onToolCall?.(call.function.name, args, result.is_error);
      messages.push({ role: "tool", tool_call_id: call.id, content: result.content });
    }
  }
  throw new Error(`Agent did not finish within ${MAX_TURNS} turns.`);
}
