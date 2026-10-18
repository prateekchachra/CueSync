import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Equalizer, Poster, TypeBadge } from '@/components/music';
import { EmptyState, IconButton, PressableScale } from '@/components/ui';
import { formatTime, usePlayer } from '@/context/PlayerContext';
import { useTheme } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';

export default function PlayerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const player = usePlayer();
  const [barWidth, setBarWidth] = useState(1);
  const art = useSharedValue(0.86);

  useEffect(() => {
    art.value = withSpring(player.isPlaying ? 1 : 0.86, { damping: 14, stiffness: 140 });
  }, [player.isPlaying, art]);

  const artStyle = useAnimatedStyle(() => ({ transform: [{ scale: art.value }] }));
  const progress = player.duration > 0 ? Math.min(1, player.position / player.duration) : 0;
  const fill = useAnimatedStyle(() => ({ width: withTiming(progress * barWidth, { duration: 250 }) }));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const track = player.current;
  const upNext = track ? player.queue.filter((t) => t.audio_url) : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[...colors.heroGradient, colors.bg] as [string, string, ...string[]]}
        locations={[0, 0.35, 0.6, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.topBar}>
          <IconButton icon="chevron-down" accessibilityLabel="Close player" onPress={close} color="#FFFFFF" />
          <Text style={styles.topLabel}>Now playing</Text>
          <View style={{ width: 42 }} />
        </View>

        {!track ? (
          <EmptyState icon="musical-notes-outline" title="Nothing playing" body="Tap play on any song card." />
        ) : (
          <View style={styles.body}>
            <Animated.View entering={FadeIn.duration(400)} style={[styles.artWrap, artStyle]}>
              <Poster uri={track.poster_url} title={track.title} size={300} radius={32} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.meta}>
              <TypeBadge type={track.song_type} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                  {track.title}
                </Text>
                <Equalizer active={player.isPlaying} height={18} />
              </View>
              <Text style={[styles.subtitle, { color: colors.muted }]}>{track.subtitle}</Text>
            </Animated.View>

            <Pressable
              onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              onPress={(e) => {
                haptic.tap();
                player.seek((e.nativeEvent.locationX / barWidth) * player.duration);
              }}
              hitSlop={14}
              accessibilityRole="adjustable"
              accessibilityLabel="Seek">
              <View style={[styles.bar, { backgroundColor: colors.surface2 }]}>
                <Animated.View style={[styles.barFill, { backgroundColor: colors.accent }, fill]} />
              </View>
            </Pressable>
            <View style={styles.times}>
              <Text style={[styles.time, { color: colors.muted }]}>{formatTime(player.position)}</Text>
              <Text style={[styles.time, { color: colors.muted }]}>{formatTime(player.duration)}</Text>
            </View>

            <View style={styles.controls}>
              <IconButton
                icon="play-back"
                accessibilityLabel="Back 15 seconds"
                onPress={() => player.seek(player.position - 15)}
                color={colors.text}
              />
              <IconButton icon="play-skip-back" accessibilityLabel="Previous" onPress={player.previous} size={28} color={colors.text} />
              <PressableScale
                haptics="press"
                scaleTo={0.88}
                onPress={player.toggle}
                accessibilityLabel={player.isPlaying ? 'Pause' : 'Play'}
                style={[styles.bigPlay, { shadowColor: colors.accent }]}>
                <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigPlayInner}>
                  <Ionicons
                    name={player.isPlaying ? 'pause' : 'play'}
                    size={36}
                    color="#FFFFFF"
                    style={!player.isPlaying ? { marginLeft: 4 } : undefined}
                  />
                </LinearGradient>
              </PressableScale>
              <IconButton icon="play-skip-forward" accessibilityLabel="Next" onPress={player.next} size={28} color={colors.text} />
              <IconButton
                icon="play-forward"
                accessibilityLabel="Forward 15 seconds"
                onPress={() => player.seek(player.position + 15)}
                color={colors.text}
              />
            </View>

            {upNext.length > 1 ? (
              <View style={{ gap: 8, marginTop: 12 }}>
                <Text style={[styles.upNext, { color: colors.text }]}>Queue</Text>
                {upNext.map((t, i) => {
                  const active = t.id === track.id;
                  return (
                    <Animated.View key={t.id} entering={FadeInDown.delay(i * 50)}>
                      <PressableScale
                        onPress={() => player.play(t)}
                        style={[
                          styles.queueRow,
                          { backgroundColor: active ? colors.primarySoft : colors.surface, borderColor: colors.line },
                        ]}>
                        <Poster uri={t.poster_url} title={t.title} size={40} radius={10} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>
                            {t.title}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                            {t.subtitle}
                          </Text>
                        </View>
                        {active ? <Equalizer active={player.isPlaying} /> : null}
                      </PressableScale>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  topLabel: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', fontSize: 12 },
  body: { paddingHorizontal: 24, gap: 18, marginTop: 12 },
  artWrap: {
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  meta: { gap: 6, marginTop: 8 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6, flexShrink: 1 },
  subtitle: { fontSize: 16, fontWeight: '600' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  time: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bigPlay: {
    borderRadius: 42,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bigPlayInner: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  upNext: { fontSize: 18, fontWeight: '900' },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 16, borderWidth: 1 },
});
