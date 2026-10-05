import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Chip, Muted, StatusBadge, Title } from '@/components/ui';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { fetchSongs } from '@/lib/catalog';
import type { SongWithExtras } from '@/lib/types';

export default function CatalogScreen() {
  const { session, profile } = useAuth();
  const [songs, setSongs] = useState<SongWithExtras[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setError(null);
    try {
      setSongs(await fetchSongs(session.user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load catalog');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{profile?.artist_name ?? 'Artist'}</Text>
          <Title>Released catalog</Title>
        </View>
        <Pressable style={styles.add} onPress={() => router.push('/song/new')}>
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>

      {loading && songs.length === 0 ? (
        <ActivityIndicator color={palette.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.gold} />
          }
          ListEmptyComponent={
            <Muted>No songs yet. Add a release or continue as Darzini to load a sample catalog.</Muted>
          }
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/song/${item.id}`)}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.songTitle}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {[item.album, item.genre].filter(Boolean).join(' · ') || 'No album / genre'}
                  </Text>
                </View>
                <StatusBadge status={item.latestCheck?.status ?? null} />
              </View>
              {item.moods.length > 0 ? (
                <View style={styles.moods}>
                  {item.moods.slice(0, 4).map((mood) => (
                    <Chip key={mood.id} label={mood.name} />
                  ))}
                </View>
              ) : (
                <Text style={styles.noMoods}>No moods tagged</Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 16, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 16 },
  kicker: {
    color: palette.gold,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
    marginBottom: 4,
  },
  add: {
    backgroundColor: palette.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addLabel: { color: palette.bg, fontWeight: '700' },
  list: { paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  songTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
  meta: { color: palette.muted, marginTop: 4 },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noMoods: { color: palette.muted, fontSize: 13 },
  error: { color: palette.danger, marginBottom: 12 },
});
