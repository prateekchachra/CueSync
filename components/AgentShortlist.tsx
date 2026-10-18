import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Equalizer, PlayButton, Poster } from '@/components/music';
import { Button, Pill } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { usePlayer } from '@/context/PlayerContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import type { ShortlistTrack } from '@/lib/agent';
import type { PlayableTrack } from '@/lib/types';

/** The agent's ranked results as a playable list, with "Play all". */
export function AgentShortlist({ tracks }: { tracks: ShortlistTrack[] }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const player = usePlayer();

  const queue: PlayableTrack[] = useMemo(
    () =>
      tracks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: `#${t.rank} · ${t.artist}`,
        audio_url: t.audio_url,
        poster_url: t.poster_url,
        song_type: 'release',
      })),
    [tracks]
  );
  const playable = queue.filter((t) => t.audio_url);
  if (tracks.length === 0) return null;

  const verdict = {
    ready: { label: 'Ready', color: colors.success, background: colors.successSoft },
    needs_work: { label: 'Needs work', color: colors.warning, background: colors.warningSoft },
    blocked: { label: 'Blocked', color: colors.danger, background: colors.dangerSoft },
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Top {tracks.length} from the catalogue</Text>
        <Button
          compact
          variant="accent"
          icon="play"
          label={playable.length ? `Play all (${playable.length})` : 'No previews'}
          disabled={playable.length === 0}
          onPress={() => playable[0] && player.play(playable[0], playable)}
        />
      </View>
      {tracks.map((t, i) => {
        const isCurrent = player.current?.id === t.id;
        return (
          <Animated.View
            key={t.id}
            entering={FadeInDown.delay(i * 45).springify()}
            style={[styles.row, isCurrent && { borderColor: colors.accent }]}>
            <Text style={[styles.rank, t.recommended && { color: colors.accent }]}>{t.rank}</Text>
            <Poster uri={t.poster_url} title={t.title} size={44} radius={10} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {t.title}
                </Text>
                {isCurrent ? <Equalizer active={player.isPlaying} height={12} /> : null}
                {t.recommended ? <Ionicons name="star" size={12} color={colors.accent} /> : null}
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {[t.artist, t.bpm && `${t.bpm} BPM`, t.has_lyrics ? 'Vocals' : 'Instrumental', t.source === 'sample' ? 'sample' : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Pill {...verdict[t.verdict]} />
            <PlayButton track={queue[i]!} queue={playable} size={34} />
          </Animated.View>
        );
      })}
      <Text style={styles.foot}>★ = recommended by the agent. Sample tracks are fictional and have no audio.</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 8, alignSelf: 'stretch' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    title: { color: c.text, fontWeight: '900', fontSize: 16, flexShrink: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 8,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.line,
    },
    rank: { color: c.muted, fontWeight: '900', fontSize: 16, width: 20, textAlign: 'center' },
    trackTitle: { color: c.text, fontWeight: '800', fontSize: 15, flexShrink: 1 },
    meta: { color: c.muted, fontSize: 12 },
    foot: { color: c.muted, fontSize: 11 },
  });
