import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BriefCard } from '@/components/BriefCard';
import { EmptyState, ErrorText, Kicker, PressableScale, Title } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { fetchMyBriefs } from '@/lib/briefs';
import type { Brief, BriefStats } from '@/lib/types';

export default function SupervisorBriefsScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [briefs, setBriefs] = useState<(Brief & { stats: BriefStats })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setError(null);
    try {
      setBriefs(await fetchMyBriefs(session.user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load briefs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pending = briefs.reduce((n, b) => n + b.stats.pending, 0);
  const total = briefs.reduce((n, b) => n + b.stats.total, 0);
  const open = briefs.filter((b) => b.status === 'open').length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Kicker>{profile?.artist_name ?? 'Supervisor'}</Kicker>
          <Title>Your briefs</Title>
        </View>
        <PressableScale
          haptics="press"
          scaleTo={0.9}
          onPress={() => router.push('/review/new')}
          accessibilityLabel="Post a new brief"
          style={styles.add}>
          <Ionicons name="add" size={26} color={colors.onAccent} />
        </PressableScale>
      </View>

      <Animated.View entering={FadeIn.delay(80)}>
        <LinearGradient colors={colors.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroCell}>
            <Text style={styles.heroValue}>{pending}</Text>
            <Text style={styles.heroLabel}>to review</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroCell}>
            <Text style={styles.heroValue}>{total}</Text>
            <Text style={styles.heroLabel}>submissions</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroCell}>
            <Text style={styles.heroValue}>{open}</Text>
            <Text style={styles.heroLabel}>open briefs</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {loading && briefs.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={briefs}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
              colors={[colors.primary, colors.accent]}
            />
          }
          ListHeaderComponent={<ErrorText message={error} />}
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="No briefs yet"
              body="Post a brief and musicians can submit to it anonymously."
            />
          }
          renderItem={({ item, index }) => (
            <BriefCard brief={item} stats={item.stats} index={index} onPress={() => router.push(`/review/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
    add: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.accent,
      shadowOpacity: 0.4,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    hero: { flexDirection: 'row', borderRadius: 22, paddingVertical: 16, paddingHorizontal: 8 },
    heroCell: { flex: 1, alignItems: 'center' },
    heroValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
    heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
    heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 6 },
    list: { paddingBottom: 140, gap: 14 },
  });
