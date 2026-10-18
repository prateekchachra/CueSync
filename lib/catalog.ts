import { supabase } from './supabase';
import { runMetadataCheck, snapshotFromSong } from './metadata';
import type { MetadataCheck, Mood, PlayableTrack, Song, SongWithExtras } from './types';

type SongRow = Song & {
  song_moods?: { moods: Mood | Mood[] | null }[];
  metadata_checks?: MetadataCheck[];
};

function flattenSong(row: SongRow): SongWithExtras {
  const moods = (row.song_moods ?? [])
    .map((link) => (Array.isArray(link.moods) ? link.moods[0] : link.moods))
    .filter((mood): mood is Mood => Boolean(mood));

  const checks = [...(row.metadata_checks ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const { song_moods, metadata_checks, ...song } = row;
  void song_moods;
  void metadata_checks;
  return {
    ...song,
    moods,
    latestCheck: checks[0] ?? null,
  };
}

export async function fetchSongs(userId: string): Promise<SongWithExtras[]> {
  const { data, error } = await supabase
    .from('songs')
    .select(
      `
      *,
      song_moods ( moods ( id, name ) ),
      metadata_checks ( id, song_id, status, issues, saved_snapshot, created_at )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as SongRow[]).map(flattenSong);
}

export async function fetchSong(id: string): Promise<SongWithExtras> {
  const { data, error } = await supabase
    .from('songs')
    .select(
      `
      *,
      song_moods ( moods ( id, name ) ),
      metadata_checks ( id, song_id, status, issues, saved_snapshot, created_at )
    `
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return flattenSong(data as SongRow);
}

export async function fetchMoods(): Promise<Mood[]> {
  const { data, error } = await supabase.from('moods').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export type SongFields = Partial<Omit<Song, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & {
  title: string;
};

/** Normalise form output into a DB row: trims strings, empties become null. */
function songPayload(fields: SongFields) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    out[key] = typeof value === 'string' ? emptyToNull(value) : value;
  }
  out.title = fields.title.trim();
  if (typeof out.isrc === 'string') out.isrc = (out.isrc as string).toUpperCase();
  return out;
}

export async function createSong(userId: string, fields: SongFields): Promise<Song> {
  const { data, error } = await supabase
    .from('songs')
    .insert({ ...songPayload(fields), user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data as Song;
}

export async function updateSong(id: string, fields: SongFields): Promise<void> {
  const { error } = await supabase.from('songs').update(songPayload(fields)).eq('id', id);
  if (error) throw error;
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
}

export async function setSongMoods(songId: string, moodIds: string[]): Promise<void> {
  const { error: delError } = await supabase.from('song_moods').delete().eq('song_id', songId);
  if (delError) throw delError;

  if (moodIds.length === 0) return;

  const { error } = await supabase.from('song_moods').insert(
    moodIds.map((mood_id) => ({ song_id: songId, mood_id }))
  );
  if (error) throw error;
}

export async function saveMetadataCheck(song: SongWithExtras, userId: string) {
  const isrc = song.isrc?.replace(/[-\s]/g, '').toUpperCase();
  let isrcTaken = false;

  if (isrc) {
    const { data, error } = await supabase
      .from('songs')
      .select('id')
      .eq('user_id', userId)
      .neq('id', song.id)
      .ilike('isrc', isrc);
    if (error) throw error;
    isrcTaken = (data ?? []).length > 0;
  }

  const result = runMetadataCheck({ song, moods: song.moods, isrcTaken });
  const snapshot = snapshotFromSong(song, song.moods);

  const { data, error } = await supabase
    .from('metadata_checks')
    .insert({
      song_id: song.id,
      status: result.status,
      issues: result.issues,
      saved_snapshot: snapshot,
    })
    .select()
    .single();

  if (error) throw error;
  return data as MetadataCheck;
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toPlayable(
  song: Pick<Song, 'id' | 'title' | 'audio_url' | 'poster_url' | 'song_type'>,
  subtitle: string
): PlayableTrack {
  return {
    id: song.id,
    title: song.title,
    subtitle,
    audio_url: song.audio_url,
    poster_url: song.poster_url,
    song_type: song.song_type,
  };
}
