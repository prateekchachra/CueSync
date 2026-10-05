import { supabase } from './supabase';

const DEMO_SONGS = [
  {
    title: 'Midnight Circuit',
    album: 'Night Languages',
    isrc: 'QZNWX2481001',
    release_date: '2024-03-12',
    duration_seconds: 214,
    genre: 'Electronic',
    bpm: 118,
    musical_key: 'F# minor',
    writers: 'Darzini',
    publishers: 'Darzini Music',
    notes: 'Pulse-driven night drive track for tech and city scenes.',
    moods: ['Dark', 'Energetic', 'Tense'],
  },
  {
    title: 'Golden Hour Letters',
    album: 'Paper Light',
    isrc: 'QZNWX2481002',
    release_date: '2023-09-01',
    duration_seconds: 198,
    genre: 'Indie Pop',
    bpm: 92,
    musical_key: 'C major',
    writers: 'Darzini',
    publishers: 'Darzini Music',
    notes: 'Warm, nostalgic love letter. Good for lifestyle and travel.',
    moods: ['Hopeful', 'Romantic', 'Nostalgic'],
  },
  {
    title: 'Glass Cathedral',
    album: 'Night Languages',
    isrc: null,
    release_date: '2025-01-20',
    duration_seconds: 256,
    genre: 'Cinematic',
    bpm: 70,
    musical_key: 'D minor',
    writers: 'Darzini',
    publishers: null,
    notes: 'Incomplete publisher + missing ISRC on purpose, for metadata check demo.',
    moods: ['Epic', 'Cinematic'],
  },
];

export async function seedDarziniCatalogIfEmpty(userId: string) {
  const { count, error: countError } = await supabase
    .from('songs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return false;

  const { data: moods, error: moodError } = await supabase.from('moods').select('id, name');
  if (moodError) throw moodError;

  const moodByName = new Map((moods ?? []).map((mood) => [mood.name, mood.id]));

  for (const demo of DEMO_SONGS) {
    const { moods: moodNames, ...fields } = demo;
    const { data: song, error } = await supabase
      .from('songs')
      .insert({ ...fields, user_id: userId })
      .select('id')
      .single();

    if (error) throw error;

    const links = moodNames
      .map((name) => moodByName.get(name))
      .filter((id): id is string => Boolean(id))
      .map((mood_id) => ({ song_id: song.id, mood_id }));

    if (links.length) {
      const { error: linkError } = await supabase.from('song_moods').insert(links);
      if (linkError) throw linkError;
    }
  }

  return true;
}
