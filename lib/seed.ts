import { supabase } from './supabase';

/*
 * Demo data. Audio previews are royalty-free SoundHelix examples and platform links point at
 * search pages, so everything works out of the box. Replace them with real links in the app.
 */
const SPOTIFY = 'https://open.spotify.com/search/Darzini';
const APPLE = 'https://music.apple.com/us/search?term=Darzini';
const SOUNDCLOUD = 'https://soundcloud.com/search?q=Darzini';
const DISCO = 'https://www.disco.ac/';
const helix = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

const darziniRights = {
  master_owners: [{ name: 'Darzini', share_pct: 100, contact_email: 'darzini@mysync.app' }],
  publishing_owners: [{ name: 'Darzini Music', share_pct: 100, contact_email: 'darzini@mysync.app' }],
};

const DEMO_SONGS = [
  {
    title: 'Midnight Circuit',
    song_type: 'release',
    description:
      'A pulse-driven night drive. Arpeggiated synths over a tight four-on-the-floor; builds into a wide chorus at 1:40. Built for tech, city and chase scenes.',
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
    audio_url: helix(1),
    disco_url: DISCO,
    spotify_url: SPOTIFY,
    apple_music_url: APPLE,
    soundcloud_url: SOUNDCLOUD,
    open_to_sync: true,
    has_lyrics: false,
    stems_available: true,
    one_stop: true,
    territories: ['worldwide'],
    exclusivity: 'non_exclusive',
    provenance: 'human',
    price_min_eur: 800,
    price_max_eur: 2500,
    ...darziniRights,
    moods: ['Dark', 'Energetic', 'Tense'],
  },
  {
    title: 'Golden Hour Letters',
    song_type: 'release',
    description:
      'Warm, nostalgic love letter with finger-picked guitar and soft vocal harmonies. Good for lifestyle, travel and end-of-summer montages.',
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
    audio_url: helix(2),
    spotify_url: SPOTIFY,
    apple_music_url: APPLE,
    open_to_sync: true,
    has_lyrics: true,
    stems_available: false,
    one_stop: true,
    territories: ['worldwide'],
    exclusivity: 'non_exclusive',
    provenance: 'human',
    price_min_eur: 600,
    price_max_eur: 1800,
    ...darziniRights,
    moods: ['Hopeful', 'Romantic', 'Nostalgic'],
  },
  {
    title: 'Glass Cathedral',
    song_type: 'release',
    description: 'Slow-burning cinematic piece: choir pads, felt piano and a huge percussive drop. Trailer-ready.',
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
    audio_url: helix(3),
    soundcloud_url: SOUNDCLOUD,
    open_to_sync: false,
    has_lyrics: false,
    stems_available: true,
    one_stop: false,
    territories: ['worldwide'],
    exclusivity: 'unknown',
    provenance: 'human',
    ...darziniRights,
    moods: ['Epic', 'Cinematic'],
  },
  {
    title: 'Madrid, 4AM',
    song_type: 'lyric_draft',
    description: 'Lyric sketch about walking home through Lavapiés after a gig. Verse 2 still missing.',
    lyrics:
      'Streetlights hum a borrowed tune\nOn Calle Ave María\nI keep your number like a coin\nI never spend, I never…',
    genre: 'Indie Pop',
    writers: 'Darzini',
    moods: ['Nostalgic', 'Intimate'],
  },
  {
    title: 'Untitled Raga Loop',
    song_type: 'songwriting_draft',
    description: 'Voice memo idea: Yaman-inspired melody over a 6/8 loop. Wants a pre-chorus and a lift.',
    genre: 'Electronic',
    bpm: 84,
    musical_key: 'E major',
    writers: 'Darzini',
    audio_url: helix(4),
    moods: ['Hopeful', 'Cinematic'],
  },
] as const;

async function moodIdsByName() {
  const { data, error } = await supabase.from('moods').select('id, name');
  if (error) throw error;
  return new Map((data ?? []).map((m) => [m.name as string, m.id as string]));
}

/**
 * Seeds Darzini's catalog. Also upgrades an older seed in place: fills in the new card/player
 * fields on existing demo songs (by title) and adds the two draft songs if they're missing.
 */
export async function seedDarziniCatalog(userId: string) {
  const { data: existing, error } = await supabase
    .from('songs')
    .select('id, title, audio_url')
    .eq('user_id', userId);
  if (error) throw error;

  const byTitle = new Map((existing ?? []).map((s) => [s.title as string, s]));
  const moods = await moodIdsByName();

  for (const demo of DEMO_SONGS) {
    const { moods: moodNames, ...fields } = demo;
    const found = byTitle.get(demo.title);

    if (found) {
      if (!found.audio_url) {
        // Older seed without v2 fields: backfill everything except what the user may have edited.
        const { title, album, isrc, release_date, duration_seconds, genre, bpm, musical_key, writers, publishers, notes, ...v2 } =
          fields as Record<string, unknown>;
        void title; void album; void isrc; void release_date; void duration_seconds; void genre;
        void bpm; void musical_key; void writers; void publishers; void notes;
        const { error: upError } = await supabase.from('songs').update(v2).eq('id', found.id);
        if (upError) throw upError;
      }
      continue;
    }

    const { data: song, error: insertError } = await supabase
      .from('songs')
      .insert({ ...fields, user_id: userId })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const links = moodNames
      .map((name) => moods.get(name))
      .filter((id): id is string => Boolean(id))
      .map((mood_id) => ({ song_id: song.id, mood_id }));
    if (links.length) {
      const { error: linkError } = await supabase.from('song_moods').insert(links);
      if (linkError) throw linkError;
    }
  }
}

const DEMO_BRIEFS = [
  {
    title: 'Night chase — streaming thriller, ep. 3',
    project_type: 'TV series',
    description:
      'Our lead is chased through a rain-soaked city at night. We need something tense and driving that builds, no lyrics over dialogue. Fast clearance matters: one-stop preferred.',
    moods: ['Tense', 'Dark', 'Energetic'],
    genres: ['Electronic', 'Cinematic'],
    vocals: 'instrumental',
    bpm_min: 90,
    bpm_max: 125,
    budget_eur: 2500,
    territory: 'Worldwide',
  },
  {
    title: 'Summer travel spot — Spain',
    project_type: 'Advertising',
    description:
      '30s online ad for a travel brand. Friends, golden hour, beach roads. Warm and hopeful, vocals welcome if the lyric is positive.',
    moods: ['Hopeful', 'Uplifting', 'Nostalgic'],
    genres: ['Indie Pop', 'Indie Folk'],
    vocals: 'any',
    bpm_min: 85,
    bpm_max: 120,
    budget_eur: 1500,
    territory: 'Europe',
  },
] as const;

export async function seedSupervisorBriefs(userId: string) {
  const { count, error } = await supabase
    .from('briefs')
    .select('id', { count: 'exact', head: true })
    .eq('supervisor_id', userId);
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  const { error: insertError } = await supabase
    .from('briefs')
    .insert(DEMO_BRIEFS.map((b) => ({ ...b, moods: [...b.moods], genres: [...b.genres], supervisor_id: userId })));
  if (insertError) throw insertError;
}
