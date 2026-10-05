export type Profile = {
  id: string;
  artist_name: string;
  email: string | null;
  created_at: string;
};

export type Song = {
  id: string;
  user_id: string;
  title: string;
  album: string | null;
  isrc: string | null;
  release_date: string | null;
  duration_seconds: number | null;
  genre: string | null;
  bpm: number | null;
  musical_key: string | null;
  writers: string | null;
  publishers: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Mood = {
  id: string;
  name: string;
};

export type CheckIssue = {
  field: string;
  severity: 'error' | 'warning';
  message: string;
};

export type CheckStatus = 'passed' | 'warnings' | 'failed';

export type MetadataCheck = {
  id: string;
  song_id: string;
  status: CheckStatus;
  issues: CheckIssue[];
  saved_snapshot: Record<string, unknown> | null;
  created_at: string;
};

export type SongWithExtras = Song & {
  moods: Mood[];
  latestCheck: MetadataCheck | null;
};
