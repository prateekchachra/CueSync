import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';

/** Gradient header with a slowly breathing logo mark. */
export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse]);

  const glow = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }, { rotate: `${pulse.value * 8}deg` }],
  }));

  return (
    <LinearGradient colors={colors.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <Animated.View style={[styles.logo, glow]}>
        <Ionicons name="musical-notes" size={30} color="#FFFFFF" />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(80).springify()} style={styles.brand}>
        MySync
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(160).springify()}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
      <View style={styles.blobA} />
      <View style={styles.blobB} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 72,
    paddingBottom: 36,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    gap: 10,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  brand: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 12,
    marginTop: 6,
  },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 22, marginTop: 6 },
  blobA: {
    position: 'absolute',
    right: -40,
    top: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  blobB: {
    position: 'absolute',
    right: 40,
    bottom: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(251,146,60,0.35)',
  },
});
