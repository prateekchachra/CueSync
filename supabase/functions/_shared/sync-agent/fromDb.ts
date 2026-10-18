import { TrackSchema, type Track } from "./types.ts";

/** Shape of a `songs` row joined with its owner's profile and mood names (see the edge function query). */
export interface DbSongRow {
  id: string;
  title: string;
  isrc: string | null;
  bpm: number | null;
  musical_key: string | null;
  duration_seconds: number | null;
  genre: string | null;
  description: string | null;
  notes: string | null;
  has_lyrics: boolean;
  stems_available: boolean;
  one_stop: boolean;
  territories: string[] | null;
  exclusivity: string;
  provenance: string;
  price_min_eur: number | null;
  price_max_eur: number | null;
  master_owners: unknown;
  publishing_owners: unknown;
  profiles: { artist_name: string } | { artist_name: string }[] | null;
  song_moods: { moods: { name: string } | { name: string }[] | null }[] | null;
}

const one = <T>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

/**
 * Turns app songs into agent tracks. Rows that don't validate (e.g. a malformed owner email) are
 * skipped and reported, so one bad row never takes the whole catalogue down.
 */
export function tracksFromRows(rows: DbSongRow[]): { tracks: Track[]; skipped: { id: string; reason: string }[] } {
  const tracks: Track[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const r of rows) {
    const moods = (r.song_moods ?? [])
      .map((link) => one(link.moods)?.name)
      .filter((m): m is string => Boolean(m))
      .map((m) => m.toLowerCase());

    const candidate = {
      id: r.id,
      title: r.title,
      artist: one(r.profiles)?.artist_name ?? "Unknown artist",
      isrc: r.isrc ?? undefined,
      bpm: r.bpm ?? undefined,
      key: r.musical_key ?? undefined,
      duration_sec: r.duration_seconds ?? undefined,
      moods,
      genres: (r.genre ?? "")
        .split(/[,/]/)
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean),
      instrumentation: [],
      has_lyrics: r.has_lyrics,
      lyric_themes: [],
      stems_available: r.stems_available,
      master_owners: Array.isArray(r.master_owners) ? r.master_owners : [],
      publishing_owners: Array.isArray(r.publishing_owners) ? r.publishing_owners : [],
      one_stop: r.one_stop,
      territories: r.territories && r.territories.length ? r.territories : ["worldwide"],
      exclusivity: r.exclusivity,
      price_range_eur:
        r.price_min_eur != null && r.price_max_eur != null ? { min: r.price_min_eur, max: r.price_max_eur } : undefined,
      provenance: r.provenance,
      notes: [r.description, r.notes].filter(Boolean).join(" ") || undefined,
    };

    const parsed = TrackSchema.safeParse(candidate);
    if (parsed.success) tracks.push(parsed.data);
    else skipped.push({ id: r.id, reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  }
  return { tracks, skipped };
}
