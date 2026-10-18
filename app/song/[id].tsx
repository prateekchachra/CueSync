import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Equalizer, PlatformLinks, Poster, TypeBadge } from '@/components/music';
import { Button, Card, Chip, ErrorText, IconButton, Muted, SectionTitle, StatusBadge } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePlayer } from '@/context/PlayerContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { deleteSong, fetchSong, saveMetadataCheck, toPlayable } from '@/lib/catalog';
import { haptic } from '@/lib/haptics';
import type { MetadataCheck, SongWithExtras } from '@/lib/types';
import { formatDuration } from '@/components/SongForm';

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const player = usePlayer();
  const [song, setSong] = useState<SongWithExtras | null>(null);
  const [check, setCheck] = useState<MetadataCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const row = await fetchSong(id);
      setSong(row);
      setCheck(row.latestCheck);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load song');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-200, 0, 300], [-60, 0, 120]) },
      { scale: interpolate(scrollY.value, [-200, 0], [1.25, 1], 'clamp') },
    ],
    opacity: interpolate(scrollY.value, [0, 260], [1, 0.2], 'clamp'),
  }));

  const track = useMemo(() => (song ? toPlayable(song, profile?.artist_name ?? 'You') : null), [song, profile]);

  async function onCheck() {
    if (!song || !session?.user.id) return;
    setChecking(true);
    setError(null);
    try {
      const result = await saveMetadataCheck(song, session.user.id);
      setCheck(result);
      if (result.status === 'passed') haptic.success();
      else haptic.warning();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Metadata check failed');
    } finally {
      setChecking(false);
    }
  }

  function onDelete() {
    if (!id) return;
    const run = async () => {
      haptic.heavy();
      if (player.current?.id === id) player.stop();
      await deleteSong(id);
      router.back();
    };
    if (Platform.OS === 'web') {
      // Alert.alert has no buttons on web.
      if (globalThis.confirm?.('Delete this song from your catalog?')) run();
      return;
    }
    Alert.alert('Delete song', 'Remove this song from your catalog?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  if (!song || !track) {
    return (
      <View style={styles.center}>
        {error ? <ErrorText message={error} /> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const isCurrent = player.current?.id === song.id;
  const playing = isCurrent && player.isPlaying;
  const details: [string, string | null][] = [
    ['Album', song.album],
    ['Released', song.release_date],
    ['ISRC', song.isrc],
    ['Duration', song.duration_seconds ? formatDuration(song.duration_seconds) : null],
    ['BPM', song.bpm ? String(song.bpm) : null],
    ['Key', song.musical_key],
    ['Genre', song.genre],
    ['Writers', song.writers],
    ['Publishers', song.publishers],
  ];
  const filled = details.filter(([, v]) => Boolean(v));
  const hasLinks = Boolean(song.disco_url || song.spotify_url || song.apple_music_url || song.soundcloud_url);

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerRight: () => (
            <IconButton
              icon="create-outline"
              accessibilityLabel="Edit song"
              onPress={() => router.push(`/song/edit/${song.id}`)}
              color={colors.primary}
              background={colors.surface}
            />
          ),
        }}
      />
      <LinearGradient
        colors={[colors.primarySoft, colors.bg]}
        style={[StyleSheet.absoluteFill, { height: 420 }]}
        pointerEvents="none"
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 64 }]}>
        <Animated.View style={[styles.hero, heroStyle]}>
          <Animated.View entering={FadeInUp.springify().damping(16)} style={styles.posterShadow}>
            <Poster uri={song.poster_url} title={song.title} size={230} radius={28} />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.titleBlock}>
          <View style={{ alignSelf: 'center' }}>
            <TypeBadge type={song.song_type} large />
          </View>
          <Text style={styles.title}>{song.title}</Text>
          <Text style={styles.artist}>{profile?.artist_name ?? 'You'}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.playRow}>
          <Button
            label={!song.audio_url ? 'No audio yet' : playing ? 'Pause' : isCurrent ? 'Resume' : 'Play'}
            icon={playing ? 'pause' : 'play'}
            variant="gradient"
            disabled={!song.audio_url}
            onPress={() => player.play(track, [track])}
            style={{ flex: 1 }}
          />
          {isCurrent ? (
            <View style={styles.eq}>
              <Equalizer active={player.isPlaying} height={20} />
            </View>
          ) : null}
          <IconButton
            icon="expand"
            accessibilityLabel="Open full player"
            onPress={() => {
              if (!isCurrent && song.audio_url) player.play(track, [track]);
              router.push('/player');
            }}
            background={colors.surface}
            color={colors.primary}
          />
        </Animated.View>

        {hasLinks ? (
          <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.section}>
            <SectionTitle>Listen on</SectionTitle>
            <PlatformLinks links={song} interactive showLabels size={30} />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.section}>
          <SectionTitle>About</SectionTitle>
          <Muted>{song.description || 'No description yet. Tap edit to add one.'}</Muted>
          {song.moods.length > 0 ? (
            <View style={styles.chips}>
              {song.moods.map((m) => (
                <Chip key={m.id} label={m.name} />
              ))}
            </View>
          ) : null}
        </Animated.View>

        {song.lyrics ? (
          <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.section}>
            <SectionTitle>Lyrics</SectionTitle>
            <Card>
              <Text style={styles.lyrics}>{song.lyrics}</Text>
            </Card>
          </Animated.View>
        ) : null}

        {filled.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.section}>
            <SectionTitle>Details</SectionTitle>
            <View style={styles.grid}>
              {filled.map(([label, value]) => (
                <View key={label} style={styles.cell}>
                  <Text style={styles.cellLabel}>{label}</Text>
                  <Text style={styles.cellValue}>{value}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {song.song_type === 'release' ? (
          <>
            <Animated.View entering={FadeInDown.delay(280).springify()} style={styles.section}>
              <SectionTitle
                right={
                  <View style={[styles.syncPill, song.open_to_sync && { backgroundColor: colors.accentSoft }]}>
                    <Ionicons
                      name={song.open_to_sync ? 'radio' : 'radio-outline'}
                      size={13}
                      color={song.open_to_sync ? colors.accent : colors.muted}
                    />
                    <Text style={[styles.syncText, song.open_to_sync && { color: colors.accent }]}>
                      {song.open_to_sync ? 'Open to sync' : 'Not listed'}
                    </Text>
                  </View>
                }>
                Sync & rights
              </SectionTitle>
              <View style={styles.flags}>
                <Flag on={song.one_stop} label="One-stop" styles={styles} colors={colors} />
                <Flag on={song.stems_available} label="Stems" styles={styles} colors={colors} />
                <Flag on={!song.has_lyrics} label="Instrumental" styles={styles} colors={colors} />
                <Flag on={song.provenance === 'human'} label="Human-made" styles={styles} colors={colors} />
              </View>
              <Muted>
                {[
                  song.price_min_eur != null && song.price_max_eur != null
                    ? `€${song.price_min_eur.toLocaleString('en-GB')}–€${song.price_max_eur.toLocaleString('en-GB')}`
                    : 'No fee range',
                  song.territories?.join(', ') || 'No territories',
                  { non_exclusive: 'Non-exclusive', exclusive: 'Exclusive', unknown: 'Exclusivity not set' }[song.exclusivity],
                ].join(' · ')}
              </Muted>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
              <SectionTitle right={<StatusBadge status={check?.status ?? null} />}>Metadata check</SectionTitle>
              <Muted>Checks the fields licensors ask for and saves a snapshot of what was checked.</Muted>
              <Button label="Run metadata check" icon="shield-checkmark-outline" variant="soft" onPress={onCheck} loading={checking} />
              {check && check.issues.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {check.issues.map((issue, i) => (
                    <Animated.View
                      entering={FadeInDown.delay(i * 40)}
                      key={`${issue.field}-${issue.message}`}
                      style={styles.issue}>
                      <Ionicons
                        name={issue.severity === 'error' ? 'close-circle' : 'alert-circle'}
                        size={16}
                        color={issue.severity === 'error' ? colors.danger : colors.warning}
                      />
                      <Text style={[styles.issueText, { color: issue.severity === 'error' ? colors.danger : colors.warning }]}>
                        {issue.message}
                      </Text>
                    </Animated.View>
                  ))}
                </View>
              ) : check ? (
                <Text style={{ color: colors.success, fontWeight: '700' }}>All good. Snapshot saved.</Text>
              ) : null}
            </Animated.View>
          </>
        ) : null}

        <ErrorText message={error} />
        <View style={{ gap: 10, marginTop: 8 }}>
          <Button label="Edit song" icon="create-outline" variant="primary" onPress={() => router.push(`/song/edit/${song.id}`)} />
          <Button label="Delete song" icon="trash-outline" variant="ghost" onPress={onDelete} />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Flag({
  on,
  label,
  styles,
  colors,
}: {
  on: boolean;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.flag, on && { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
      <Ionicons name={on ? 'checkmark' : 'remove'} size={13} color={on ? colors.success : colors.muted} />
      <Text style={[styles.flagText, on && { color: colors.success }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
    content: { paddingHorizontal: 20, paddingBottom: 140, gap: 20 },
    hero: { alignItems: 'center' },
    posterShadow: {
      borderRadius: 28,
      shadowColor: c.primary,
      shadowOpacity: 0.45,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    },
    titleBlock: { alignItems: 'center', gap: 8 },
    title: { color: c.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
    artist: { color: c.muted, fontSize: 16, fontWeight: '600' },
    playRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eq: { width: 28, alignItems: 'center' },
    section: { gap: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    lyrics: { color: c.text, fontSize: 15, lineHeight: 24, fontStyle: 'italic' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    cell: {
      width: '48%',
      flexGrow: 1,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: c.line,
    },
    cellLabel: { color: c.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    cellValue: { color: c.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
    syncPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.surface2,
    },
    syncText: { color: c.muted, fontWeight: '800', fontSize: 12 },
    flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    flag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.line,
    },
    flagText: { color: c.muted, fontWeight: '700', fontSize: 12 },
    issue: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    issueText: { fontSize: 14, lineHeight: 20, flex: 1 },
  });
