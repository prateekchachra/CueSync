import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Equalizer, Poster } from '@/components/music';
import { IconButton, PressableScale } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { usePlayer } from '@/context/PlayerContext';
import { useStyles, useTheme } from '@/context/ThemeContext';

export function MiniPlayer() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const player = usePlayer();
  const progress = player.duration > 0 ? Math.min(1, player.position / player.duration) : 0;

  const bar = useAnimatedStyle(() => ({
    transform: [{ scaleX: withTiming(progress, { duration: 250 }) }],
  }));

  if (!player.current) return null;
  const track = player.current;

  return (
    <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown} style={styles.wrap}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => router.push('/player')}
        accessibilityLabel="Open player"
        style={styles.card}>
        <View style={styles.track}>
          <Animated.View style={[styles.progress, bar]} />
        </View>
        <View style={styles.row}>
          <Poster uri={track.poster_url} title={track.title} size={42} radius={10} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={1} style={styles.title}>
                {track.title}
              </Text>
              <Equalizer active={player.isPlaying} height={12} />
            </View>
            <Text numberOfLines={1} style={styles.subtitle}>
              {track.subtitle}
            </Text>
          </View>
          <IconButton
            icon={player.isPlaying ? 'pause' : 'play'}
            accessibilityLabel={player.isPlaying ? 'Pause' : 'Play'}
            onPress={player.toggle}
            color={colors.onAccent}
            background={colors.accent}
            size={20}
          />
          <IconButton icon="play-skip-forward" accessibilityLabel="Next track" onPress={player.next} size={20} />
          <IconButton icon="close" accessibilityLabel="Stop" onPress={player.stop} size={18} color={colors.muted} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 10, paddingBottom: 6, backgroundColor: 'transparent' },
    card: {
      backgroundColor: c.elevated,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.line,
      overflow: 'hidden',
      shadowColor: c.primary,
      shadowOpacity: c.scheme === 'dark' ? 0.4 : 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    track: { height: 3, backgroundColor: c.surface2 },
    progress: { height: 3, width: '100%', backgroundColor: c.accent, transformOrigin: 'left' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 4 },
    title: { color: c.text, fontWeight: '800', fontSize: 15, flexShrink: 1 },
    subtitle: { color: c.muted, fontSize: 12, marginTop: 2 },
  });
