import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BriefCard } from '@/components/BriefCard';
import { Poster, TypeBadge } from '@/components/music';
import { EmptyState, ErrorText, IconButton, Kicker, Muted, Segmented, SubmissionBadge, Title } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { fetchMySubmissions, fetchOpenBriefs, withdrawSubmission, type MySubmission } from '@/lib/briefs';
import { haptic } from '@/lib/haptics';
import type { Brief, SongType } from '@/lib/types';

type Tab = 'open' | 'mine';

export default function MusicianBriefsScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('open');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [subs, setSubs] = useState<MySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setError(null);
    try {
      const [open, mine] = await Promise.all([fetchOpenBriefs(session.user.id), fetchMySubmissions()]);
      setBriefs(open);
      setSubs(mine);
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

  const submittedByBrief = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subs) map.set(s.brief_id, (map.get(s.brief_id) ?? 0) + 1);
    return map;
  }, [subs]);

  async function withdraw(id: string) {
    const go = async () => {
      haptic.heavy();
      try {
        await withdrawSubmission(id);
        setSubs((cur) => cur.filter((s) => s.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not withdraw');
      }
    };
    if (Platform.OS === 'web' && !globalThis.confirm?.('Withdraw this submission?')) return;
    go();
  }

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      tintColor={colors.primary}
      colors={[colors.primary, colors.accent]}
    />
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View>
        <Kicker>Sync opportunities</Kicker>
        <Title>Briefs</Title>
      </View>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: `Open briefs${briefs.length ? ` · ${briefs.length}` : ''}` },
          { value: 'mine', label: `My submissions${subs.length ? ` · ${subs.length}` : ''}` },
        ]}
      />
      <ErrorText message={error} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : tab === 'open' ? (
        <FlatList
          key="open"
          data={briefs}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            briefs.length ? (
              <Muted>Supervisors don't see your name, just your music. Pick a brief to submit.</Muted>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon="megaphone-outline" title="No open briefs" body="New briefs from supervisors show up here." />
          }
          renderItem={({ item, index }) => (
            <BriefCard
              brief={item}
              index={index}
              submitted={submittedByBrief.get(item.id)}
              onPress={() => router.push(`/brief/${item.id}`)}
            />
          )}
        />
      ) : (
        <FlatList
          key="mine"
          data={subs}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState icon="paper-plane-outline" title="Nothing submitted yet" body="Open a brief and send a song." />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).springify()} style={styles.sub}>
              <Poster uri={item.songs?.poster_url} title={item.songs?.title ?? '?'} size={52} radius={12} />
              <View style={{ flex: 1, gap: 3 }}>
                {item.songs ? <TypeBadge type={item.songs.song_type as SongType} /> : null}
                <Text style={styles.subTitle} numberOfLines={1}>
                  {item.songs?.title ?? 'Deleted song'}
                </Text>
                <Text style={styles.subBrief} numberOfLines={1}>
                  → {item.briefs?.title ?? 'Brief no longer available'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <SubmissionBadge status={item.status} />
                {item.status === 'pending' ? (
                  <IconButton
                    icon="arrow-undo-outline"
                    accessibilityLabel="Withdraw submission"
                    onPress={() => withdraw(item.id)}
                    size={16}
                    color={colors.muted}
                  />
                ) : null}
              </View>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16, gap: 14 },
    list: { paddingBottom: 140, gap: 14 },
    sub: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 10,
      borderWidth: 1,
      borderColor: c.line,
    },
    subTitle: { color: c.text, fontWeight: '900', fontSize: 16 },
    subBrief: { color: c.muted, fontSize: 13 },
  });
