// Picks the model provider from configuration (env vars / Supabase secrets).
//
//   AGENT_PROVIDER = gemini | openai_compatible | anthropic   (optional; inferred from which key is set)
//   GEMINI_API_KEY                         → Gemini via its OpenAI-compatible endpoint
//   LLM_API_KEY + LLM_BASE_URL             → any OpenAI-compatible API (Groq, OpenRouter, OpenAI…)
//   ANTHROPIC_API_KEY                      → Claude
//   MODEL                                  → override the default model for the chosen provider

import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL as CLAUDE_DEFAULT, runAgent, type ChatTurn } from "./agent.ts";
import { runAgentOpenAICompat } from "./openaiCompat.ts";
import type { Catalogue } from "./types.ts";

export type Provider = "gemini" | "openai_compatible" | "anthropic";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

export interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  baseURL?: string;
}

/** `env` is a getter so this works with process.env (Node) and Deno.env.get (Deno). */
export function resolveProvider(env: (name: string) => string | undefined): ProviderConfig {
  const explicit = env("AGENT_PROVIDER")?.trim().toLowerCase() as Provider | undefined;
  const provider: Provider | undefined =
    explicit ||
    (env("GEMINI_API_KEY") ? "gemini" : env("LLM_API_KEY") ? "openai_compatible" : env("ANTHROPIC_API_KEY") ? "anthropic" : undefined);

  if (!provider) {
    throw new Error("No model configured. Set GEMINI_API_KEY (free tier), LLM_API_KEY + LLM_BASE_URL, or ANTHROPIC_API_KEY.");
  }
  const model = env("MODEL")?.trim();

  switch (provider) {
    case "gemini": {
      const apiKey = env("GEMINI_API_KEY");
      if (!apiKey) throw new Error("AGENT_PROVIDER=gemini but GEMINI_API_KEY is not set.");
      return { provider, apiKey, baseURL: GEMINI_BASE_URL, model: model || GEMINI_DEFAULT_MODEL };
    }
    case "openai_compatible": {
      const apiKey = env("LLM_API_KEY");
      const baseURL = env("LLM_BASE_URL");
      if (!apiKey || !baseURL) throw new Error("openai_compatible needs LLM_API_KEY and LLM_BASE_URL.");
      if (!model) throw new Error("openai_compatible needs MODEL (e.g. llama-3.3-70b-versatile on Groq).");
      return { provider, apiKey, baseURL, model };
    }
    case "anthropic": {
      const apiKey = env("ANTHROPIC_API_KEY");
      if (!apiKey) throw new Error("AGENT_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.");
      return { provider, apiKey, model: model || CLAUDE_DEFAULT };
    }
    default:
      throw new Error(`Unknown AGENT_PROVIDER "${explicit}". Use gemini, openai_compatible or anthropic.`);
  }
}

export function runSyncAgent(
  catalogue: Catalogue,
  input: string | ChatTurn[],
  config: ProviderConfig,
  onToolCall?: (name: string, input: unknown, isError: boolean) => void,
): Promise<string> {
  if (config.provider === "anthropic") {
    return runAgent(catalogue, input, { client: new Anthropic({ apiKey: config.apiKey }), model: config.model, onToolCall });
  }
  return runAgentOpenAICompat(catalogue, input, {
    apiKey: config.apiKey,
    baseURL: config.baseURL!,
    model: config.model,
    onToolCall,
  });
}
