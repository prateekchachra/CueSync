import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { PlayButton, Poster, TypeBadge } from '@/components/music';
import { Button, Card, Chip, ErrorText, Field, Muted, PressableScale, SectionTitle, Title } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { briefSummary, fetchBrief, fetchMySubmissions, submitToBrief } from '@/lib/briefs';
import { fetchSongs, toPlayable } from '@/lib/catalog';
import { haptic } from '@/lib/haptics';
import type { Brief, SongWithExtras } from '@/lib/types';

export default function BriefDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [songs, setSongs] = useState<SongWithExtras[]>([]);
  const [already, setAlready] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !session?.user.id) return;
    Promise.all([fetchBrief(id), fetchSongs(session.user.id), fetchMySubmissions()])
      .then(([b, s, subs]) => {
        setBrief(b);
        setSongs(s);
        setAlready(new Set(subs.filter((x) => x.brief_id === id).map((x) => x.song_id)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'This brief is no longer available'));
  }, [id, session?.user.id]);

  const queue = useMemo(() => songs.map((s) => toPlayable(s, profile?.artist_name ?? 'You')), [songs, profile]);

  async function onSubmit() {
    if (!id || !picked) return;
    setBusy(true);
    setError(null);
    try {
      await submitToBrief(id, picked, note);
      haptic.success();
      setDone(true);
      setAlready((cur) => new Set(cur).add(picked));
      setTimeout(() => router.back(), 1400);
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setBusy(false);
    }
  }

  if (!brief) {
    return (
      <View style={styles.center}>
        {error ? <ErrorText message={error} /> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.doneBadge}>
          <Ionicons name="paper-plane" size={42} color={colors.onAccent} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(150)} style={styles.doneText}>
          Sent!
        </Animated.Text>
        <Muted center>The supervisor will hear it without seeing your name.</Muted>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify()} style={{ gap: 8 }}>
          <Text style={styles.type}>{brief.project_type ?? 'Brief'}</Text>
          <Title size={26}>{brief.title}</Title>
          <Muted>{brief.description}</Muted>
          <View style={styles.chips}>
            {brief.moods.map((m) => (
              <Chip key={m} label={m} selected tone="accent" />
            ))}
            {brief.genres.map((g) => (
              <Chip key={g} label={g} />
            ))}
          </View>
          <Card style={styles.specs}>
            {briefSummary(brief).map((s) => (
              <View key={s} style={styles.spec}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.specText}>{s}</Text>
              </View>
            ))}
            {brief.deadline ? (
              <View style={styles.spec}>
                <Ionicons name="calendar" size={16} color={colors.accent} />
                <Text style={styles.specText}>Deadline {brief.deadline}</Text>
              </View>
            ) : null}
          </Card>
        </Animated.View>

        <SectionTitle>Pick a song to submit</SectionTitle>
        {songs.length === 0 ? <Muted>Add a song first from the Songs tab.</Muted> : null}
        <View style={{ gap: 10 }}>
          {songs.map((song, i) => {
            const sent = already.has(song.id);
            const selected = picked === song.id;
            return (
              <Animated.View key={song.id} entering={FadeInDown.delay(i * 50).springify()}>
                <PressableScale
                  disabled={sent}
                  onPress={() => setPicked(selected ? null : song.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: sent }}
                  style={[
                    styles.songRow,
                    selected && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                    sent && { opacity: 0.55 },
                  ]}>
                  <Poster uri={song.poster_url} title={song.title} size={52} radius={12} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <TypeBadge type={song.song_type} />
                    <Text style={styles.songTitle} numberOfLines={1}>
                      {song.title}
                    </Text>
                    <Text style={styles.songMeta} numberOfLines={1}>
                      {sent ? 'Already submitted' : [song.genre, song.bpm && `${song.bpm} BPM`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <PlayButton track={queue[i]!} queue={queue} size={34} />
                  <View style={[styles.check, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                    {selected ? (
                      <Animated.View entering={ZoomIn.springify()}>
                        <Ionicons name="checkmark" size={16} color={colors.onAccent} />
                      </Animated.View>
                    ) : null}
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        <Field
          label="Note to the supervisor (optional)"
          value={note}
          onChangeText={setNote}
          autoCapitalize="sentences"
          multiline
          placeholder="Stems available, cut-down at 0:30…"
          hint="Keep it about the music: don't include your name or links if you want to stay anonymous."
        />
        <ErrorText message={error} />
        <Button
          label="Submit song"
          icon="paper-plane"
          variant="gradient"
          onPress={onSubmit}
          loading={busy}
          disabled={!picked}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    content: { padding: 20, gap: 16, paddingBottom: 140 },
    type: { color: c.accent, fontWeight: '900', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    specs: { gap: 8, marginTop: 6 },
    spec: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    specText: { color: c.text, fontWeight: '600' },
    songRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: c.line,
      backgroundColor: c.surface,
    },
    songTitle: { color: c.text, fontWeight: '900', fontSize: 16 },
    songMeta: { color: c.muted, fontSize: 12 },
    check: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: c.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBadge: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneText: { color: c.text, fontSize: 28, fontWeight: '900' },
  });
