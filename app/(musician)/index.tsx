import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SongCard } from '@/components/SongCard';
import { EmptyState, ErrorText, Kicker, PressableScale, Segmented, Title } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { fetchSongs, toPlayable } from '@/lib/catalog';
import type { SongWithExtras } from '@/lib/types';

type Filter = 'all' | 'release' | 'drafts';

export default function SongsScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [songs, setSongs] = useState<SongWithExtras[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setError(null);
    try {
      setSongs(await fetchSongs(session.user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load songs');
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

  const visible = useMemo(
    () =>
      songs.filter((s) =>
        filter === 'all' ? true : filter === 'release' ? s.song_type === 'release' : s.song_type !== 'release'
      ),
    [songs, filter]
  );

  const artist = profile?.artist_name ?? 'Artist';
  const queue = useMemo(() => visible.map((s) => toPlayable(s, artist)), [visible, artist]);
  const counts = {
    releases: songs.filter((s) => s.song_type === 'release').length,
    drafts: songs.filter((s) => s.song_type !== 'release').length,
    sync: songs.filter((s) => s.open_to_sync).length,
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Kicker>{artist}</Kicker>
          <Title>Your songs</Title>
        </View>
        <PressableScale
          haptics="press"
          scaleTo={0.9}
          onPress={() => router.push('/song/new')}
          accessibilityLabel="Add a song"
          style={styles.add}>
          <Ionicons name="add" size={26} color={colors.onAccent} />
        </PressableScale>
      </View>

      <Animated.View entering={FadeIn.delay(100)} style={styles.stats}>
        <Stat label="Releases" value={counts.releases} color={colors.primary} styles={styles} />
        <Stat label="Drafts" value={counts.drafts} color={colors.accent} styles={styles} />
        <Stat label="Open to sync" value={counts.sync} color={colors.success} styles={styles} />
      </Animated.View>

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'release', label: 'Releases' },
          { value: 'drafts', label: 'Drafts' },
        ]}
      />

      {loading && songs.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
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
              icon="musical-notes-outline"
              title={filter === 'drafts' ? 'No drafts yet' : 'No songs yet'}
              body="Tap + to add a release, a lyric draft or a songwriting idea."
            />
          }
          renderItem={({ item, index }) => (
            <SongCard song={item} index={index} track={queue[index]!} queue={queue} />
          )}
        />
      )}
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  styles,
}: {
  label: string;
  value: number;
  color: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    stats: { flexDirection: 'row', gap: 10 },
    stat: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: c.line,
    },
    statValue: { fontSize: 22, fontWeight: '900' },
    statLabel: { color: c.muted, fontSize: 12, fontWeight: '600' },
    list: { paddingBottom: 140, paddingTop: 4, gap: 14 },
  });
