import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/ui';
import type { Song } from '@/lib/types';

export type SongFormValues = {
  title: string;
  album: string;
  isrc: string;
  release_date: string;
  duration: string;
  genre: string;
  bpm: string;
  musical_key: string;
  writers: string;
  publishers: string;
  notes: string;
};

export function emptySongForm(): SongFormValues {
  return {
    title: '',
    album: '',
    isrc: '',
    release_date: '',
    duration: '',
    genre: '',
    bpm: '',
    musical_key: '',
    writers: '',
    publishers: '',
    notes: '',
  };
}

export function formFromSong(song: Song): SongFormValues {
  return {
    title: song.title,
    album: song.album ?? '',
    isrc: song.isrc ?? '',
    release_date: song.release_date ?? '',
    duration: formatDuration(song.duration_seconds),
    genre: song.genre ?? '',
    bpm: song.bpm != null ? String(song.bpm) : '',
    musical_key: song.musical_key ?? '',
    writers: song.writers ?? '',
    publishers: song.publishers ?? '',
    notes: song.notes ?? '',
  };
}

export function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':');
    const minutes = Number(m);
    const seconds = Number(s);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return minutes * 60 + seconds;
  }
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function toSongFields(form: SongFormValues) {
  const bpm = form.bpm.trim() ? Number(form.bpm) : null;
  return {
    title: form.title.trim(),
    album: form.album,
    isrc: form.isrc,
    release_date: form.release_date,
    duration_seconds: parseDuration(form.duration),
    genre: form.genre,
    bpm: bpm != null && !Number.isNaN(bpm) ? bpm : null,
    musical_key: form.musical_key,
    writers: form.writers,
    publishers: form.publishers,
    notes: form.notes,
  };
}

export function SongForm({
  value,
  onChange,
}: {
  value: SongFormValues;
  onChange: (next: SongFormValues) => void;
}) {
  function patch(partial: Partial<SongFormValues>) {
    onChange({ ...value, ...partial });
  }

  return (
    <View style={styles.form}>
      <Field label="Title" value={value.title} onChangeText={(title) => patch({ title })} autoCapitalize="words" />
      <Field label="Album / project" value={value.album} onChangeText={(album) => patch({ album })} autoCapitalize="words" />
      <Field label="ISRC" value={value.isrc} onChangeText={(isrc) => patch({ isrc })} autoCapitalize="characters" placeholder="QZNWX2481001" />
      <Field label="Release date" value={value.release_date} onChangeText={(release_date) => patch({ release_date })} placeholder="YYYY-MM-DD" />
      <Field label="Duration" value={value.duration} onChangeText={(duration) => patch({ duration })} placeholder="3:24 or seconds" />
      <Field label="Genre" value={value.genre} onChangeText={(genre) => patch({ genre })} autoCapitalize="words" />
      <Field label="BPM" value={value.bpm} onChangeText={(bpm) => patch({ bpm })} keyboardType="number-pad" />
      <Field label="Key" value={value.musical_key} onChangeText={(musical_key) => patch({ musical_key })} placeholder="F# minor" />
      <Field label="Writers" value={value.writers} onChangeText={(writers) => patch({ writers })} autoCapitalize="words" />
      <Field label="Publishers" value={value.publishers} onChangeText={(publishers) => patch({ publishers })} autoCapitalize="words" />
      <Field label="Notes" value={value.notes} onChangeText={(notes) => patch({ notes })} autoCapitalize="sentences" multiline />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
});
