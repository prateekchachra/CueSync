import type { CheckIssue, CheckStatus, Mood, Song } from './types';

const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

export function runMetadataCheck(input: {
  song: Pick<
    Song,
    | 'title'
    | 'album'
    | 'isrc'
    | 'release_date'
    | 'duration_seconds'
    | 'genre'
    | 'bpm'
    | 'musical_key'
    | 'writers'
    | 'publishers'
  >;
  moods: Mood[];
  isrcTaken: boolean;
}): { status: CheckStatus; issues: CheckIssue[] } {
  const { song, moods, isrcTaken } = input;
  const issues: CheckIssue[] = [];

  if (!song.title?.trim() || song.title.trim().length < 2) {
    issues.push({
      field: 'title',
      severity: 'error',
      message: 'Title is missing or too short.',
    });
  }

  const isrc = song.isrc?.replace(/[-\s]/g, '').toUpperCase() ?? '';
  if (!isrc) {
    issues.push({
      field: 'isrc',
      severity: 'warning',
      message: 'ISRC is missing. Most sync licensors require it.',
    });
  } else if (!ISRC.test(isrc)) {
    issues.push({
      field: 'isrc',
      severity: 'error',
      message: 'ISRC format looks invalid. Expected 12 characters, e.g. USRC17607839.',
    });
  }

  if (isrc && isrcTaken) {
    issues.push({
      field: 'isrc',
      severity: 'error',
      message: 'This ISRC is already used on another song in your catalog.',
    });
  }

  if (!song.release_date) {
    issues.push({
      field: 'release_date',
      severity: 'warning',
      message: 'Release date is missing.',
    });
  }

  if (!song.duration_seconds || song.duration_seconds < 15) {
    issues.push({
      field: 'duration_seconds',
      severity: 'warning',
      message: 'Duration is missing or unusually short for a sync submission.',
    });
  }

  if (!song.genre?.trim()) {
    issues.push({
      field: 'genre',
      severity: 'warning',
      message: 'Genre helps licensors search your catalog.',
    });
  }

  if (!song.album?.trim()) {
    issues.push({
      field: 'album',
      severity: 'warning',
      message: 'Album / project name is empty.',
    });
  }

  if (!song.writers?.trim()) {
    issues.push({
      field: 'writers',
      severity: 'warning',
      message: 'Writer credits are missing.',
    });
  }

  if (!song.publishers?.trim()) {
    issues.push({
      field: 'publishers',
      severity: 'warning',
      message: 'Publisher info is missing.',
    });
  }

  if (moods.length === 0) {
    issues.push({
      field: 'moods',
      severity: 'warning',
      message: 'Add at least one mood so the track is easier to pitch.',
    });
  }

  if (!song.bpm) {
    issues.push({
      field: 'bpm',
      severity: 'warning',
      message: 'BPM is empty.',
    });
  }

  if (!song.musical_key?.trim()) {
    issues.push({
      field: 'musical_key',
      severity: 'warning',
      message: 'Musical key is empty.',
    });
  }

  const status: CheckStatus = issues.some((issue) => issue.severity === 'error')
    ? 'failed'
    : issues.length
      ? 'warnings'
      : 'passed';

  return { status, issues };
}

export function snapshotFromSong(song: Song, moods: Mood[]) {
  return {
    title: song.title,
    album: song.album,
    isrc: song.isrc,
    release_date: song.release_date,
    duration_seconds: song.duration_seconds,
    genre: song.genre,
    bpm: song.bpm,
    musical_key: song.musical_key,
    writers: song.writers,
    publishers: song.publishers,
    moods: moods.map((mood) => mood.name),
  };
}
