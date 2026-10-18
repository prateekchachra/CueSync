import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Poster } from '@/components/music';
import { Button, Chip, ErrorText, Field, RadioGroup, SectionTitle, ToggleRow } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useStyles, useTheme } from '@/context/ThemeContext';
import type { SongFields } from '@/lib/catalog';
import { haptic } from '@/lib/haptics';
import { pickAndUploadAudio, pickAndUploadPoster } from '@/lib/media';
import type { Exclusivity, Mood, Provenance, RightsOwner, Song, SongType } from '@/lib/types';

export type SongFormValues = {
  song_type: SongType;
  title: string;
  description: string;
  lyrics: string;
  poster_url: string;
  audio_url: string;
  disco_url: string;
  spotify_url: string;
  apple_music_url: string;
  soundcloud_url: string;
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
  open_to_sync: boolean;
  has_lyrics: boolean;
  stems_available: boolean;
  one_stop: boolean;
  exclusivity: Exclusivity;
  provenance: Provenance;
  price_min: string;
  price_max: string;
  territories: string;
  master_owners: string;
  publishing_owners: string;
};

export function emptySongForm(): SongFormValues {
  return {
    song_type: 'release',
    title: '',
    description: '',
    lyrics: '',
    poster_url: '',
    audio_url: '',
    disco_url: '',
    spotify_url: '',
    apple_music_url: '',
    soundcloud_url: '',
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
    open_to_sync: false,
    has_lyrics: true,
    stems_available: false,
    one_stop: false,
    exclusivity: 'unknown',
    provenance: 'unknown',
    price_min: '',
    price_max: '',
    territories: 'worldwide',
    master_owners: '',
    publishing_owners: '',
  };
}

export function formFromSong(song: Song): SongFormValues {
  return {
    song_type: song.song_type,
    title: song.title,
    description: song.description ?? '',
    lyrics: song.lyrics ?? '',
    poster_url: song.poster_url ?? '',
    audio_url: song.audio_url ?? '',
    disco_url: song.disco_url ?? '',
    spotify_url: song.spotify_url ?? '',
    apple_music_url: song.apple_music_url ?? '',
    soundcloud_url: song.soundcloud_url ?? '',
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
    open_to_sync: song.open_to_sync,
    has_lyrics: song.has_lyrics,
    stems_available: song.stems_available,
    one_stop: song.one_stop,
    exclusivity: song.exclusivity,
    provenance: song.provenance,
    price_min: song.price_min_eur != null ? String(song.price_min_eur) : '',
    price_max: song.price_max_eur != null ? String(song.price_max_eur) : '',
    territories: (song.territories ?? []).join(', '),
    master_owners: formatOwners(song.master_owners),
    publishing_owners: formatOwners(song.publishing_owners),
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

/** One owner per line: "Name, 50, email@x.com" (share and email optional; share defaults to 100). */
export function parseOwners(text: string): RightsOwner[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      const name = parts[0] ?? '';
      const share = parts.find((p, i) => i > 0 && /^\d+(\.\d+)?%?$/.test(p));
      const email = parts.find((p, i) => i > 0 && p.includes('@'));
      const owner: RightsOwner = { name, share_pct: share ? Number(share.replace('%', '')) : 100 };
      if (email) owner.contact_email = email;
      return owner;
    })
    .filter((o) => o.name);
}

function formatOwners(owners: RightsOwner[] | null | undefined) {
  return (owners ?? [])
    .map((o) => [o.name, String(o.share_pct), o.contact_email].filter(Boolean).join(', '))
    .join('\n');
}

const toInt = (v: string) => {
  const n = Number(v.trim());
  return v.trim() && !Number.isNaN(n) ? Math.round(n) : null;
};

export function toSongFields(form: SongFormValues): SongFields {
  return {
    song_type: form.song_type,
    title: form.title.trim(),
    description: form.description,
    lyrics: form.lyrics,
    poster_url: form.poster_url,
    audio_url: form.audio_url,
    disco_url: form.disco_url,
    spotify_url: form.spotify_url,
    apple_music_url: form.apple_music_url,
    soundcloud_url: form.soundcloud_url,
    album: form.album,
    isrc: form.isrc,
    release_date: form.release_date,
    duration_seconds: parseDuration(form.duration),
    genre: form.genre,
    bpm: toInt(form.bpm),
    musical_key: form.musical_key,
    writers: form.writers,
    publishers: form.publishers,
    notes: form.notes,
    open_to_sync: form.song_type === 'release' ? form.open_to_sync : false,
    has_lyrics: form.has_lyrics,
    stems_available: form.stems_available,
    one_stop: form.one_stop,
    exclusivity: form.exclusivity,
    provenance: form.provenance,
    price_min_eur: toInt(form.price_min),
    price_max_eur: toInt(form.price_max),
    territories: form.territories
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    master_owners: parseOwners(form.master_owners),
    publishing_owners: parseOwners(form.publishing_owners),
  };
}

/* ------------------------------------------------------------------ */

export function SongForm({
  value,
  onChange,
  moods,
  selectedMoods,
  onToggleMood,
  userId,
}: {
  value: SongFormValues;
  onChange: (next: SongFormValues) => void;
  moods: Mood[];
  selectedMoods: string[];
  onToggleMood: (id: string) => void;
  userId: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [uploading, setUploading] = useState<'poster' | 'audio' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isRelease = value.song_type === 'release';

  function patch(partial: Partial<SongFormValues>) {
    onChange({ ...value, ...partial });
  }

  async function upload(kind: 'poster' | 'audio') {
    setUploadError(null);
    setUploading(kind);
    try {
      const url = kind === 'poster' ? await pickAndUploadPoster(userId) : await pickAndUploadAudio(userId);
      if (url) {
        haptic.success();
        patch(kind === 'poster' ? { poster_url: url } : { audio_url: url });
      }
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `${err.message}. You can paste a URL instead.`
          : 'Upload failed. You can paste a URL instead.'
      );
    } finally {
      setUploading(null);
    }
  }

  return (
    <Animated.View style={styles.form} layout={LinearTransition}>
      <SectionTitle>What is it?</SectionTitle>
      <RadioGroup<SongType>
        value={value.song_type}
        onChange={(song_type) => patch({ song_type })}
        options={[
          { value: 'release', label: 'Release', description: 'Out on DSPs (or about to be).', icon: 'disc' },
          { value: 'lyric_draft', label: 'Lyric draft', description: 'Words first, music later.', icon: 'create' },
          {
            value: 'songwriting_draft',
            label: 'Songwriting draft',
            description: 'Voice memos, loops, chord ideas.',
            icon: 'musical-notes',
          },
        ]}
      />

      <SectionTitle>Artwork & preview</SectionTitle>
      <View style={styles.mediaRow}>
        <Poster uri={value.poster_url || null} title={value.title || 'New'} size={96} radius={18} />
        <View style={{ flex: 1, gap: 8 }}>
          <Button
            compact
            variant="soft"
            icon="image-outline"
            label={value.poster_url ? 'Replace poster' : 'Upload poster'}
            loading={uploading === 'poster'}
            onPress={() => upload('poster')}
          />
          <Button
            compact
            variant="soft"
            icon="musical-note-outline"
            label={value.audio_url ? 'Replace audio' : 'Upload audio'}
            loading={uploading === 'audio'}
            onPress={() => upload('audio')}
          />
          {value.audio_url ? (
            <Animated.View entering={FadeIn} style={styles.attached}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.attachedText} numberOfLines={1}>
                Audio attached
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </View>
      <ErrorText message={uploadError} />
      <Field
        label="Poster URL"
        value={value.poster_url}
        onChangeText={(poster_url) => patch({ poster_url })}
        placeholder="https://… (or upload above)"
      />
      <Field
        label="Audio preview URL"
        value={value.audio_url}
        onChangeText={(audio_url) => patch({ audio_url })}
        placeholder="https://…/track.mp3"
        hint="Used by the in-app player and shown to supervisors when you submit."
      />

      <SectionTitle>The song</SectionTitle>
      <Field label="Title" value={value.title} onChangeText={(title) => patch({ title })} autoCapitalize="words" />
      <Field
        label="Description"
        value={value.description}
        onChangeText={(description) => patch({ description })}
        autoCapitalize="sentences"
        multiline
        placeholder="What it sounds like, where it would work…"
      />
      {value.song_type !== 'songwriting_draft' || value.lyrics ? (
        <Animated.View entering={FadeInDown}>
          <Field
            label="Lyrics"
            value={value.lyrics}
            onChangeText={(lyrics) => patch({ lyrics })}
            autoCapitalize="sentences"
            multiline
          />
        </Animated.View>
      ) : null}
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Field label="Genre" value={value.genre} onChangeText={(genre) => patch({ genre })} autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Key" value={value.musical_key} onChangeText={(musical_key) => patch({ musical_key })} placeholder="F# minor" />
        </View>
      </View>
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Field label="BPM" value={value.bpm} onChangeText={(bpm) => patch({ bpm })} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Duration" value={value.duration} onChangeText={(duration) => patch({ duration })} placeholder="3:24" />
        </View>
      </View>
      <Field label="Writers" value={value.writers} onChangeText={(writers) => patch({ writers })} autoCapitalize="words" />

      <SectionTitle>Moods</SectionTitle>
      <View style={styles.chips}>
        {moods.map((mood) => (
          <Chip
            key={mood.id}
            label={mood.name}
            selected={selectedMoods.includes(mood.id)}
            onPress={() => onToggleMood(mood.id)}
          />
        ))}
      </View>

      <SectionTitle>Links</SectionTitle>
      <Field label="DISCO" value={value.disco_url} onChangeText={(disco_url) => patch({ disco_url })} placeholder="https://s.disco.ac/…" />
      <Field label="Spotify" value={value.spotify_url} onChangeText={(spotify_url) => patch({ spotify_url })} placeholder="https://open.spotify.com/track/…" />
      <Field
        label="Apple Music"
        value={value.apple_music_url}
        onChangeText={(apple_music_url) => patch({ apple_music_url })}
        placeholder="https://music.apple.com/…"
      />
      <Field
        label="SoundCloud"
        value={value.soundcloud_url}
        onChangeText={(soundcloud_url) => patch({ soundcloud_url })}
        placeholder="https://soundcloud.com/…"
      />

      {isRelease ? (
        <Animated.View entering={FadeInDown} style={styles.form}>
          <SectionTitle>Release metadata</SectionTitle>
          <Field label="Album / project" value={value.album} onChangeText={(album) => patch({ album })} autoCapitalize="words" />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Field label="ISRC" value={value.isrc} onChangeText={(isrc) => patch({ isrc })} autoCapitalize="characters" placeholder="QZNWX2481001" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Release date" value={value.release_date} onChangeText={(release_date) => patch({ release_date })} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <Field label="Publishers" value={value.publishers} onChangeText={(publishers) => patch({ publishers })} autoCapitalize="words" />

          <SectionTitle>Sync & rights</SectionTitle>
          <View style={styles.card}>
            <ToggleRow
              label="Open to sync"
              hint="Lets supervisors find this release with the sync agent."
              value={value.open_to_sync}
              onValueChange={(open_to_sync) => patch({ open_to_sync })}
            />
            <ToggleRow label="Has lyrics" value={value.has_lyrics} onValueChange={(has_lyrics) => patch({ has_lyrics })} />
            <ToggleRow
              label="Stems available"
              value={value.stems_available}
              onValueChange={(stems_available) => patch({ stems_available })}
            />
            <ToggleRow
              label="One-stop"
              hint="Master and publishing cleared through one contact."
              value={value.one_stop}
              onValueChange={(one_stop) => patch({ one_stop })}
            />
          </View>
          <Text style={styles.label}>Exclusivity</Text>
          <RadioGroup<Exclusivity>
            value={value.exclusivity}
            onChange={(exclusivity) => patch({ exclusivity })}
            options={[
              { value: 'non_exclusive', label: 'Non-exclusive' },
              { value: 'exclusive', label: 'Exclusive' },
              { value: 'unknown', label: 'Not sure' },
            ]}
          />
          <Text style={styles.label}>How was it made?</Text>
          <RadioGroup<Provenance>
            value={value.provenance}
            onChange={(provenance) => patch({ provenance })}
            options={[
              { value: 'human', label: 'Human-made' },
              { value: 'ai_assisted', label: 'AI-assisted' },
              { value: 'unknown', label: 'Not stated' },
            ]}
          />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Field label="Fee from (€)" value={value.price_min} onChangeText={(price_min) => patch({ price_min })} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Fee up to (€)" value={value.price_max} onChangeText={(price_max) => patch({ price_max })} keyboardType="number-pad" />
            </View>
          </View>
          <Field
            label="Territories"
            value={value.territories}
            onChangeText={(territories) => patch({ territories })}
            placeholder="worldwide, or Spain, Europe…"
          />
          <Field
            label="Master owners"
            value={value.master_owners}
            onChangeText={(master_owners) => patch({ master_owners })}
            multiline
            placeholder={'Darzini, 100, you@email.com'}
            hint="One per line: name, share %, contact email. Shares should add up to 100."
          />
          <Field
            label="Publishing owners"
            value={value.publishing_owners}
            onChangeText={(publishing_owners) => patch({ publishing_owners })}
            multiline
            placeholder={'Darzini Music, 100, you@email.com'}
          />
        </Animated.View>
      ) : null}

      <Field label="Private notes" value={value.notes} onChangeText={(notes) => patch({ notes })} autoCapitalize="sentences" multiline />
    </Animated.View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    form: { gap: 14 },
    mediaRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    attached: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    attachedText: { color: c.success, fontSize: 12, fontWeight: '700' },
    twoCol: { flexDirection: 'row', gap: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.line,
      padding: 14,
      gap: 10,
    },
    label: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
  });
