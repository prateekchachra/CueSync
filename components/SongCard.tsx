import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Equalizer, PlatformLinks, PlayButton, Poster, TypeBadge } from '@/components/music';
import { PressableScale, StatusBadge } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { usePlayer } from '@/context/PlayerContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import type { PlayableTrack, SongWithExtras } from '@/lib/types';

export function SongCard({
  song,
  index,
  track,
  queue,
}: {
  song: SongWithExtras;
  index: number;
  track: PlayableTrack;
  queue: PlayableTrack[];
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const player = usePlayer();
  const isCurrent = player.current?.id === song.id;
  const meta = [song.genre, song.bpm ? `${song.bpm} BPM` : null, song.musical_key].filter(Boolean).join(' · ');

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).springify().damping(18)} layout={LinearTransition}>
      <PressableScale
        scaleTo={0.975}
        onPress={() => router.push(`/song/${song.id}`)}
        accessibilityLabel={`Open ${song.title}`}
        style={[styles.card, isCurrent && { borderColor: colors.accent }]}>
        <View style={styles.row}>
          <View>
            <Poster uri={song.poster_url} title={song.title} size={84} radius={16} />
            <View style={styles.playDock}>
              <PlayButton track={track} queue={queue} size={34} />
            </View>
          </View>

          <View style={styles.body}>
            <TypeBadge type={song.song_type} />
            <View style={styles.titleRow}>
              <Text numberOfLines={1} style={styles.title}>
                {song.title}
              </Text>
              {isCurrent ? <Equalizer active={player.isPlaying} /> : null}
            </View>
            <Text numberOfLines={1} style={styles.meta}>
              {meta || song.album || 'No genre / tempo yet'}
            </Text>
            <View style={styles.footer}>
              <PlatformLinks links={song} size={22} />
              {song.song_type === 'release' ? <StatusBadge status={song.latestCheck?.status ?? null} /> : null}
            </View>
          </View>
        </View>

        {song.moods.length > 0 ? (
          <View style={styles.moods}>
            {song.moods.slice(0, 4).map((m) => (
              <Text key={m.id} style={styles.mood}>
                #{m.name.toLowerCase()}
              </Text>
            ))}
            {song.open_to_sync ? <Text style={styles.sync}>● Open to sync</Text> : null}
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      padding: 12,
      borderWidth: 1.5,
      borderColor: c.line,
      gap: 10,
      shadowColor: c.primary,
      shadowOpacity: c.scheme === 'dark' ? 0.25 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    row: { flexDirection: 'row', gap: 16 },
    playDock: { position: 'absolute', right: -6, bottom: -6 },
    body: { flex: 1, gap: 5, paddingTop: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: c.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3, flexShrink: 1 },
    meta: { color: c.muted, fontSize: 13 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
      gap: 8,
    },
    moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingLeft: 4 },
    mood: { color: c.primary, fontSize: 12, fontWeight: '700' },
    sync: { color: c.accent, fontSize: 12, fontWeight: '800', marginLeft: 'auto' },
  });
