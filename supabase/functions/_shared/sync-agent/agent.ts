import Anthropic from "@anthropic-ai/sdk";
import type { Catalogue } from "./types.ts";
import { TOOL_DEFS, runTool } from "./tools.ts";

/** Override per call with `opts.model` (the CLI reads MODEL, the edge function reads its MODEL secret). */
export const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_TURNS = 8;

export const SYSTEM_PROMPT = `You are a sync licensing assistant for music supervisors. A supervisor gives you a brief for a scene, ad or trailer. You search a catalogue and return a short, honest, ranked shortlist.

How to work:
1. Turn the brief into search filters. Hard constraints the supervisor states (budget, territory, "no vocals", "one-stop", "human-made", "need stems", BPM) become hard filters. Mood and genre words become soft criteria.
2. Call search_catalog. If nothing matches, relax ONE filter at a time and tell the supervisor which one you relaxed and why.
3. For EVERY track you plan to recommend, call check_clearance. Never recommend a track without checking it.
4. Return at most 5 tracks, best first. For each: the track id, title, artist, why it fits the brief in one or two sentences, price range, and its clearance status in plain words (ready, needs work, or blocked) with the specific issues.
5. Be honest. If nothing fits well, say so and name the closest option and the gap. Never invent catalogue data, prices or rights. Only use what the tools return.
6. Respect constraints strictly. If the supervisor says "human-made" or "one-stop", never present a track that fails that as a match. You may mention it as excluded and why.
7. Only call draft_license_request when the supervisor asks for a draft or picks a track. If supervisor name, project title, media type, territory or term are missing, ask for them first.
8. Keep answers short and scannable. No filler.`;

export interface AgentOptions {
  model?: string;
  /** Inject a client (used by tests). Defaults to a real Anthropic client. */
  client?: Pick<Anthropic, "messages">;
  onToolCall?: (name: string, input: unknown, isError: boolean) => void;
}

/** A plain-text chat turn (what the app keeps on screen between requests). */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Runs the tool-use loop. `input` is either one brief, or a whole chat so the supervisor can
 * follow up ("draft the email for the second one"). Only the text of earlier turns is replayed;
 * tool calls are re-run as needed, which keeps every answer grounded in current catalogue data.
 */
export async function runAgent(
  catalogue: Catalogue,
  input: string | ChatTurn[],
  opts: AgentOptions = {},
): Promise<string> {
  const client = opts.client ?? new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  const model = opts.model ?? DEFAULT_MODEL;

  const turns: ChatTurn[] = typeof input === "string" ? [{ role: "user", content: input }] : input;
  if (turns.length === 0 || turns[turns.length - 1]?.role !== "user") {
    throw new Error("The last message must be from the supervisor.");
  }
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({ role: t.role, content: t.content }));

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFS as unknown as Anthropic.Tool[],
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const result = runTool(catalogue, block.name, block.input);
      opts.onToolCall?.(block.name, block.input, result.is_error);
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content,
        is_error: result.is_error,
      });
    }
    messages.push({ role: "user", content: results });
  }

  throw new Error(`Agent did not finish within ${MAX_TURNS} turns.`);
}
