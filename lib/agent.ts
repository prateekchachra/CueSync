import { supabase } from './supabase';

export type AgentTurn = { role: 'user' | 'assistant'; content: string };

export type ShortlistTrack = {
  rank: number;
  id: string;
  title: string;
  artist: string;
  recommended: boolean;
  verdict: 'ready' | 'needs_work' | 'blocked';
  bpm?: number;
  moods: string[];
  has_lyrics: boolean;
  price_range_eur?: { min: number; max: number };
  source: 'mysync' | 'sample';
  audio_url: string | null;
  poster_url: string | null;
};

export type AgentReply = {
  answer: string;
  tool_calls: { name: string; is_error: boolean }[];
  /** Ranked, playable list: the agent's picks first, then the best remaining search hits. */
  shortlist: ShortlistTrack[];
  model?: string;
  catalogue: { app_tracks: number; sample_tracks: number; skipped: number };
};

/** Calls the `sync-agent` Supabase Edge Function. Supervisors only (enforced server-side). */
export async function askSyncAgent(
  messages: AgentTurn[],
  includeSample: boolean,
  topN = 10
): Promise<AgentReply> {
  const { data, error } = await supabase.functions.invoke('sync-agent', {
    body: { messages, include_sample: includeSample, top_n: topN },
  });
  if (error) {
    // FunctionsHttpError carries the JSON body in `context`.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    if (/not found|404/i.test(error.message)) {
      throw new Error('The sync-agent function is not deployed yet. See README → "Deploy the sync agent".');
    }
    throw error;
  }
  const reply = data as AgentReply;
  return { ...reply, shortlist: reply.shortlist ?? [] };
}
