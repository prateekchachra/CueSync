// Turns an agent run into a playable, ranked list: the tracks the agent recommended (in the order
// it mentions them), topped up with the best remaining search hits, up to `topN`.

import { SearchInput, checkClearance, getTrack, searchCatalogue, type SearchArgs } from "./tools.ts";
import type { Catalogue } from "./types.ts";

export interface ShortlistItem {
  rank: number;
  id: string;
  title: string;
  artist: string;
  recommended: boolean;
  verdict: "ready" | "needs_work" | "blocked";
  bpm?: number;
  moods: string[];
  has_lyrics: boolean;
  price_range_eur?: { min: number; max: number };
}

/** Collects valid search_catalog inputs from tool calls (use as an onToolCall listener). */
export function searchRecorder() {
  const calls: SearchArgs[] = [];
  return {
    calls,
    listener: (name: string, input: unknown, isError: boolean) => {
      if (name !== "search_catalog" || isError) return;
      const parsed = SearchInput.safeParse(input ?? {});
      if (parsed.success) calls.push(parsed.data);
    },
  };
}

export function buildShortlist(cat: Catalogue, answer: string, searches: SearchArgs[], topN = 10): ShortlistItem[] {
  const n = Math.max(1, Math.min(10, Math.floor(topN)));
  const text = answer.toLowerCase();
  const territory = [...searches].reverse().find((s) => s.territory)?.territory;

  // 1. Recommended: id or exact title appears in the answer, ordered by first mention.
  const mentioned = cat.tracks
    .map((t) => {
      const byId = text.indexOf(t.id.toLowerCase());
      const byTitle = t.title.length >= 3 ? text.indexOf(t.title.toLowerCase()) : -1;
      const hits = [byId, byTitle].filter((i) => i >= 0);
      return { t, at: hits.length ? Math.min(...hits) : -1 };
    })
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((m) => m.t.id);

  const ids: string[] = [];
  const recommended = new Set<string>();
  for (const id of mentioned) {
    if (ids.length >= n) break;
    ids.push(id);
    recommended.add(id);
  }

  // 2. Top up from the agent's own searches (latest search first), same ranking as the tool.
  for (const args of [...searches].reverse()) {
    if (ids.length >= n) break;
    for (const hit of searchCatalogue(cat, { ...args, limit: 10 })) {
      if (ids.length >= n) break;
      if (!ids.includes(hit.id)) ids.push(hit.id);
    }
  }

  return ids
    .map((id) => getTrack(cat, id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t, i) => ({
      rank: i + 1,
      id: t.id,
      title: t.title,
      artist: t.artist,
      recommended: recommended.has(t.id),
      verdict: checkClearance(t, territory).verdict,
      bpm: t.bpm,
      moods: t.moods,
      has_lyrics: t.has_lyrics,
      price_range_eur: t.price_range_eur,
    }));
}
