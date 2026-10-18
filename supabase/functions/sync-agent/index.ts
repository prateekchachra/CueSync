// Supabase Edge Function: the sync licensing agent, for supervisors only.
//
// Deploy:  supabase functions deploy sync-agent
// Secrets (pick one model provider, see _shared/sync-agent/provider.ts):
//   supabase secrets set GEMINI_API_KEY=...                       (free tier, default gemini model)
//   supabase secrets set LLM_API_KEY=... LLM_BASE_URL=... MODEL=... (Groq, OpenRouter, any OpenAI-compatible API)
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...             (Claude)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from "@supabase/supabase-js";

import type { ChatTurn } from "../_shared/sync-agent/agent.ts";
import { resolveProvider, runSyncAgent, type ProviderConfig } from "../_shared/sync-agent/provider.ts";
import { tracksFromRows, type DbSongRow } from "../_shared/sync-agent/fromDb.ts";
import { buildShortlist, searchRecorder } from "../_shared/sync-agent/shortlist.ts";
import { CatalogueSchema, type Track } from "../_shared/sync-agent/types.ts";
import sample from "../_shared/sync-agent/catalogue.sample.json" with { type: "json" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_TURNS = 20;
const MAX_CHARS = 4000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let model: ProviderConfig;
  try {
    model = resolveProvider((name) => Deno.env.get(name));
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  // 1. Who is calling? Must be a signed-in supervisor.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sign in first." }, 401);

  const admin = createClient(url, serviceKey);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "supervisor") {
    return json({ error: "The sync agent is available to music supervisors only." }, 403);
  }

  // 2. Validate the chat.
  let body: { messages?: unknown; include_sample?: unknown; top_n?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  const turns = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatTurn[] = turns
    .slice(-MAX_TURNS)
    .filter(
      (m): m is ChatTurn =>
        !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  // The model needs the chat to start with the user.
  while (messages[0]?.role === "assistant") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return json({ error: "Send at least one message from the supervisor." }, 400);
  }

  // 3. Build the catalogue: releases musicians marked "Open to sync", minus anyone this supervisor blocked.
  const { data: blocks } = await admin
    .from("supervisor_blocks")
    .select("artist_id")
    .eq("supervisor_id", userData.user.id);
  const blocked = new Set((blocks ?? []).map((b: { artist_id: string }) => b.artist_id));

  const { data: rows, error: songsError } = await admin
    .from("songs")
    .select(
      `id, user_id, title, isrc, bpm, musical_key, duration_seconds, genre, description, notes,
       has_lyrics, stems_available, one_stop, territories, exclusivity, provenance,
       price_min_eur, price_max_eur, master_owners, publishing_owners, audio_url, poster_url,
       profiles ( artist_name ), song_moods ( moods ( name ) )`,
    )
    .eq("open_to_sync", true)
    .eq("song_type", "release")
    .limit(500);
  if (songsError) return json({ error: `Could not read the catalogue: ${songsError.message}` }, 500);

  const visible = (rows ?? []).filter((r: { user_id: string }) => !blocked.has(r.user_id)) as unknown as DbSongRow[];
  const { tracks: appTracks, skipped } = tracksFromRows(visible);
  const media = new Map(
    (visible as unknown as { id: string; audio_url: string | null; poster_url: string | null }[]).map((r) => [
      r.id,
      { audio_url: r.audio_url, poster_url: r.poster_url },
    ]),
  );
  const topN = typeof body.top_n === "number" ? body.top_n : 10;

  const includeSample = body.include_sample !== false;
  const sampleTracks: Track[] = includeSample ? CatalogueSchema.parse(sample).tracks : [];
  const tracks = [...appTracks, ...sampleTracks];
  if (tracks.length === 0) {
    return json({
      answer:
        "The catalogue is empty right now: no musician has marked a release as \"Open to sync\" yet. Turn on the sample catalogue to try the agent.",
      tool_calls: [],
      shortlist: [],
      catalogue: { app_tracks: 0, sample_tracks: 0, skipped: skipped.length },
    });
  }

  // 4. Run the agent.
  const tool_calls: { name: string; is_error: boolean }[] = [];
  const searches = searchRecorder();
  const catalogue = { catalogue_name: includeSample ? "MySync catalogue + fictional sample" : "MySync catalogue", tracks };
  try {
    const answer = await runSyncAgent(catalogue, messages, model, (name, input, isError) => {
      tool_calls.push({ name, is_error: isError });
      searches.listener(name, input, isError);
    });
    // Ranked, playable list: what the agent recommended first, then the best remaining search hits.
    const shortlist = buildShortlist(catalogue, answer, searches.calls, topN).map((item) => ({
      ...item,
      source: media.has(item.id) ? "mysync" : "sample",
      audio_url: media.get(item.id)?.audio_url ?? null,
      poster_url: media.get(item.id)?.poster_url ?? null,
    }));
    return json({
      answer,
      tool_calls,
      shortlist,
      model: `${model.provider}:${model.model}`,
      catalogue: { app_tracks: appTracks.length, sample_tracks: sampleTracks.length, skipped: skipped.length },
    });
  } catch (err) {
    console.error("sync-agent failed", err);
    return json({ error: err instanceof Error ? err.message : "The agent failed." }, 502);
  }
});
