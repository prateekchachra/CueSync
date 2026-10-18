import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { usePlayer } from '@/context/PlayerContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { SONG_TYPE_LABEL, type PlayableTrack, type SongType } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Song type badge: bold, colour-coded                                  */
/* ------------------------------------------------------------------ */

export function TypeBadge({ type, large }: { type: SongType; large?: boolean }) {
  const { colors } = useTheme();
  const tone = {
    release: { fg: colors.onPrimary, bg: colors.primary, icon: 'disc' as const },
    lyric_draft: { fg: colors.onAccent, bg: colors.accent, icon: 'create' as const },
    songwriting_draft: { fg: colors.primary, bg: colors.primarySoft, icon: 'musical-notes' as const },
  }[type];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        backgroundColor: tone.bg,
        borderRadius: 8,
        paddingHorizontal: large ? 10 : 8,
        paddingVertical: large ? 5 : 3,
      }}>
      <Ionicons name={tone.icon} size={large ? 13 : 11} color={tone.fg} />
      <Text
        style={{
          color: tone.fg,
          fontWeight: '900',
          fontSize: large ? 13 : 11,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}>
        {SONG_TYPE_LABEL[type]}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Platform links                                                       */
/* ------------------------------------------------------------------ */

export type PlatformLinkSet = {
  disco_url?: string | null;
  spotify_url?: string | null;
  apple_music_url?: string | null;
  soundcloud_url?: string | null;
};

const PLATFORMS = [
  { key: 'disco_url', label: 'DISCO', color: '#111111', kind: 'disco' },
  { key: 'spotify_url', label: 'Spotify', color: '#1DB954', kind: 'spotify' },
  { key: 'apple_music_url', label: 'Apple Music', color: '#FA243C', kind: 'apple' },
  { key: 'soundcloud_url', label: 'SoundCloud', color: '#FF5500', kind: 'soundcloud' },
] as const;

function PlatformGlyph({ kind, size, color }: { kind: (typeof PLATFORMS)[number]['kind']; size: number; color: string }) {
  if (kind === 'disco') {
    return <Text style={{ color, fontWeight: '900', fontSize: size * 0.82, letterSpacing: -0.5 }}>D</Text>;
  }
  return <FontAwesome5 name={kind} brand size={size} color={color} />;
}

/** Small round logos. On cards they're indicators; with `interactive` they open the link. */
export function PlatformLinks({
  links,
  size = 22,
  interactive,
  showLabels,
}: {
  links: PlatformLinkSet;
  size?: number;
  interactive?: boolean;
  showLabels?: boolean;
}) {
  const { colors } = useTheme();
  const present = PLATFORMS.filter((p) => Boolean(links[p.key]));
  if (present.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: showLabels ? 10 : 6 }}>
      {present.map((p) => {
        const glyphColor = '#FFFFFF';
        const bubble = (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingRight: showLabels ? 12 : 0,
              borderRadius: 999,
              backgroundColor: showLabels ? colors.surface2 : 'transparent',
            }}>
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: p.kind === 'disco' && colors.scheme === 'dark' ? '#3A2A5C' : p.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <PlatformGlyph kind={p.kind} size={size * 0.56} color={glyphColor} />
            </View>
            {showLabels ? <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{p.label}</Text> : null}
          </View>
        );
        if (!interactive) return <View key={p.key}>{bubble}</View>;
        return (
          <PressableScale
            key={p.key}
            scaleTo={0.9}
            accessibilityLabel={`Open on ${p.label}`}
            onPress={() => {
              const url = links[p.key];
              if (url) WebBrowser.openBrowserAsync(url).catch(() => undefined);
            }}>
            {bubble}
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Poster: the artwork, or a purple→orange gradient with initials       */
/* ------------------------------------------------------------------ */

export function Poster({
  uri,
  title,
  size,
  radius = 14,
  style,
}: {
  uri?: string | null;
  title: string;
  size: number | '100%';
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const dims = size === '100%' ? { width: '100%' as const, aspectRatio: 1 } : { width: size, height: size };
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const hash = [...title].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const angle = hash % 2 === 0 ? { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } : { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } };

  if (uri) {
    return <Image source={{ uri }} style={[dims, { borderRadius: radius }, style as object]} resizeMode="cover" />;
  }
  return (
    <LinearGradient
      colors={colors.gradient}
      {...angle}
      style={[dims, { borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Text
        style={{
          color: '#FFFFFF',
          fontWeight: '900',
          fontSize: typeof size === 'number' ? size * 0.34 : 64,
          letterSpacing: -1,
          opacity: 0.95,
        }}>
        {initials || '♪'}
      </Text>
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ */
/* Equalizer bars: shown on the track that's playing                    */
/* ------------------------------------------------------------------ */

function Bar({ active, delay, color, height }: { active: boolean; delay: number; color: string; height: number }) {
  const h = useSharedValue(0.3);
  useEffect(() => {
    if (active) {
      h.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 320, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.25, { duration: 280, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.7, { duration: 260 }),
            withTiming(0.35, { duration: 240 })
          ),
          -1,
          true
        )
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(0.3, { duration: 200 });
    }
  }, [active, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value * height }));
  return <Animated.View style={[{ width: 3, borderRadius: 2, backgroundColor: color }, style]} />;
}

export function Equalizer({ active, color, height = 14 }: { active: boolean; color?: string; height?: number }) {
  const { colors } = useTheme();
  const fill = color ?? colors.accent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height }}>
      {[0, 140, 70, 210].map((delay, i) => (
        <Bar key={i} active={active} delay={delay} color={fill} height={height} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Play button bound to the global player                               */
/* ------------------------------------------------------------------ */

export function PlayButton({
  track,
  queue,
  size = 40,
}: {
  track: PlayableTrack;
  queue?: PlayableTrack[];
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const player = usePlayer();
  const isCurrent = player.current?.id === track.id;
  const playing = isCurrent && player.isPlaying;
  const disabled = !track.audio_url;

  return (
    <PressableScale
      disabled={disabled}
      scaleTo={0.85}
      haptics="press"
      accessibilityLabel={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      onPress={() => player.play(track, queue)}
      style={[
        styles.play,
        { width: size, height: size, borderRadius: size / 2 },
        { backgroundColor: disabled ? colors.surface2 : colors.accent },
      ]}>
      <Ionicons
        name={disabled ? 'volume-mute' : playing ? 'pause' : 'play'}
        size={size * 0.45}
        color={disabled ? colors.muted : colors.onAccent}
        style={!playing && !disabled ? { marginLeft: 2 } : undefined}
      />
    </PressableScale>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    play: {
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.accent,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  });
