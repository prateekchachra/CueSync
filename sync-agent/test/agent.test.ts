import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIEFS_PATH, loadCatalogue, SAMPLE_CATALOGUE_PATH } from "../src/catalogue.ts";
import { runAgent } from "../src/agent.ts";

const cat = loadCatalogue(SAMPLE_CATALOGUE_PATH);

// A fake client that first asks for two tool calls, then gives a final answer.
function fakeClient() {
  const seen: unknown[] = [];
  let call = 0;
  return {
    seen,
    client: {
      messages: {
        create: async (req: { messages: unknown[] }) => {
          seen.push(structuredClone(req.messages));
          call++;
          if (call === 1) {
            return {
              stop_reason: "tool_use",
              content: [
                { type: "tool_use", id: "t1", name: "search_catalog", input: { moods: ["tense"], instrumental_only: true } },
                { type: "tool_use", id: "t2", name: "check_clearance", input: { track_id: "trk_001" } },
              ],
            };
          }
          return { stop_reason: "end_turn", content: [{ type: "text", text: "Top pick: trk_001 Midnight Pursuit" }] };
        },
      },
    },
  };
}

test("agent loop runs tools, feeds results back, and returns the final text", async () => {
  const { client, seen } = fakeClient();
  const calls: string[] = [];
  const answer = await runAgent(cat, "tense chase", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
    onToolCall: (name) => calls.push(name),
  });
  assert.equal(answer, "Top pick: trk_001 Midnight Pursuit");
  assert.deepEqual(calls, ["search_catalog", "check_clearance"]);

  // Second request must include the assistant tool_use turn and a user turn with both tool_results.
  const second = seen[1] as { role: string; content: unknown }[];
  assert.equal(second.length, 3);
  const results = second[2]?.content as { type: string; tool_use_id: string; is_error: boolean }[];
  assert.deepEqual(results.map((r) => r.tool_use_id), ["t1", "t2"]);
  assert.ok(results.every((r) => r.type === "tool_result" && r.is_error === false));
});

test("agent stops with an error if the model never finishes", async () => {
  const looping = {
    messages: {
      create: async () => ({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "x", name: "search_catalog", input: {} }],
      }),
    },
  };
  await assert.rejects(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runAgent(cat, "loop forever", { client: looping as any }),
    /did not finish/,
  );
});

test("agent accepts a multi-turn chat and replays earlier turns as text", async () => {
  const { client, seen } = fakeClient();
  await runAgent(
    cat,
    [
      { role: "user", content: "tense chase" },
      { role: "assistant", content: "Top pick: trk_001" },
      { role: "user", content: "anything with vocals?" },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { client: client as any },
  );
  const first = seen[0] as { role: string; content: unknown }[];
  assert.deepEqual(first.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(first[2]?.content, "anything with vocals?");
});

test("agent refuses a chat that doesn't end with the supervisor", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runAgent(cat, [{ role: "assistant", content: "hi" }], { client: client as any }),
    /last message/,
  );
});

test("OpenAI-compatible loop (Gemini/Groq) runs tools and returns the final text", async () => {
  const { runAgentOpenAICompat } = await import("../../supabase/functions/_shared/sync-agent/openaiCompat.ts");
  const bodies: { messages: { role: string; tool_call_id?: string }[]; tools: unknown[] }[] = [];
  let call = 0;
  const fakeFetch = (async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    call++;
    const message =
      call === 1
        ? {
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: "search_catalog", arguments: '{"moods":["tense"]}' } },
              { id: "c2", type: "function", function: { name: "check_clearance", arguments: "not json" } },
            ],
          }
        : { content: "Top pick: trk_001" };
    return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
  }) as unknown as typeof fetch;

  const calls: [string, boolean][] = [];
  const answer = await runAgentOpenAICompat(cat, "tense chase", {
    apiKey: "k",
    baseURL: "https://example.test/v1/",
    model: "gemini-test",
    fetch: fakeFetch,
    onToolCall: (n, _i, e) => calls.push([n, e]),
  });
  assert.equal(answer, "Top pick: trk_001");
  assert.deepEqual(calls, [["search_catalog", false], ["check_clearance", true]]);
  assert.equal(bodies[0]!.messages[0]!.role, "system");
  assert.equal(bodies[0]!.tools.length, 4);
  const second = bodies[1]!.messages;
  assert.deepEqual(second.slice(-2).map((m) => m.tool_call_id), ["c1", "c2"]);
});

test("provider is picked from whichever key is set", async () => {
  const { resolveProvider } = await import("../../supabase/functions/_shared/sync-agent/provider.ts");
  const env = (vars: Record<string, string>) => (k: string) => vars[k];
  assert.equal(resolveProvider(env({ GEMINI_API_KEY: "g" })).provider, "gemini");
  assert.equal(resolveProvider(env({ GEMINI_API_KEY: "g", MODEL: "m" })).model, "m");
  assert.equal(resolveProvider(env({ ANTHROPIC_API_KEY: "a" })).provider, "anthropic");
  assert.equal(
    resolveProvider(env({ LLM_API_KEY: "l", LLM_BASE_URL: "https://api.groq.com/openai/v1", MODEL: "llama" })).provider,
    "openai_compatible",
  );
  assert.throws(() => resolveProvider(env({})), /No model configured/);
  assert.throws(() => resolveProvider(env({ LLM_API_KEY: "l" })), /LLM_BASE_URL/);
});
