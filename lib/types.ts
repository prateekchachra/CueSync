export type Role = 'musician' | 'supervisor';

export type Profile = {
  id: string;
  artist_name: string;
  email: string | null;
  role: Role;
  created_at: string;
};

export type SongType = 'release' | 'lyric_draft' | 'songwriting_draft';
export type Exclusivity = 'non_exclusive' | 'exclusive' | 'unknown';
export type Provenance = 'human' | 'ai_assisted' | 'unknown';

export type RightsOwner = {
  name: string;
  share_pct: number;
  contact_email?: string;
};

export type Song = {
  id: string;
  user_id: string;
  title: string;
  song_type: SongType;
  description: string | null;
  lyrics: string | null;
  poster_url: string | null;
  audio_url: string | null;
  disco_url: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  soundcloud_url: string | null;
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
  open_to_sync: boolean;
  has_lyrics: boolean;
  stems_available: boolean;
  one_stop: boolean;
  territories: string[];
  exclusivity: Exclusivity;
  provenance: Provenance;
  price_min_eur: number | null;
  price_max_eur: number | null;
  master_owners: RightsOwner[];
  publishing_owners: RightsOwner[];
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

/** Anything the player can play: a musician's own song or an anonymous submission. */
export type PlayableTrack = {
  id: string;
  title: string;
  subtitle: string;
  audio_url: string | null;
  poster_url: string | null;
  song_type: SongType;
};

export type VocalsPref = 'any' | 'instrumental' | 'vocals';
export type BriefStatus = 'open' | 'closed';

export type Brief = {
  id: string;
  supervisor_id: string;
  title: string;
  project_type: string | null;
  description: string;
  moods: string[];
  genres: string[];
  vocals: VocalsPref;
  bpm_min: number | null;
  bpm_max: number | null;
  budget_eur: number | null;
  territory: string | null;
  deadline: string | null;
  status: BriefStatus;
  created_at: string;
};

export type BriefStats = {
  brief_id: string;
  total: number;
  pending: number;
  accepted: number;
  declined: number;
};

export type SubmissionStatus = 'pending' | 'accepted' | 'declined';

export type Submission = {
  id: string;
  brief_id: string;
  song_id: string;
  note: string | null;
  status: SubmissionStatus;
  created_at: string;
  reviewed_at: string | null;
};

/** What a supervisor sees: no artist identity, only a per-supervisor alias. */
export type SupervisorSubmission = {
  submission_id: string;
  status: SubmissionStatus;
  note: string | null;
  created_at: string;
  artist_alias: string;
  artist_blocked: boolean;
  song_id: string;
  title: string;
  song_type: SongType;
  description: string | null;
  genre: string | null;
  bpm: number | null;
  musical_key: string | null;
  duration_seconds: number | null;
  has_lyrics: boolean;
  poster_url: string | null;
  audio_url: string | null;
  disco_url: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  soundcloud_url: string | null;
  moods: string[];
};

export const SONG_TYPE_LABEL: Record<SongType, string> = {
  release: 'Release',
  lyric_draft: 'Lyric draft',
  songwriting_draft: 'Songwriting draft',
};
