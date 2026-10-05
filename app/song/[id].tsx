import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formFromSong, SongForm, toSongFields, type SongFormValues } from '@/components/SongForm';
import { Button, Chip, ErrorText, Muted, StatusBadge } from '@/components/ui';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { deleteSong, fetchMoods, fetchSong, saveMetadataCheck, setSongMoods, updateSong } from '@/lib/catalog';
import type { MetadataCheck, Mood, SongWithExtras } from '@/lib/types';

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [song, setSong] = useState<SongWithExtras | null>(null);
  const [form, setForm] = useState<SongFormValues | null>(null);
  const [allMoods, setAllMoods] = useState<Mood[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<MetadataCheck | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [row, moods] = await Promise.all([fetchSong(id), fetchMoods()]);
      setSong(row);
      setForm(formFromSong(row));
      setAllMoods(moods);
      setSelectedMoods(row.moods.map((mood) => mood.id));
      setLastCheck(row.latestCheck);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load song');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleMood(moodId: string) {
    setSelectedMoods((current) =>
      current.includes(moodId) ? current.filter((item) => item !== moodId) : [...current, moodId]
    );
  }

  async function onSave() {
    if (!id || !form) return;
    const fields = toSongFields(form);
    if (!fields.title) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSong(id, fields);
      await setSongMoods(id, selectedMoods);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function onCheck() {
    if (!id || !session?.user.id) return;
    await onSave();
    setChecking(true);
    try {
      const latest = await fetchSong(id);
      const result = await saveMetadataCheck(latest, session.user.id);
      setLastCheck(result);
      setSong(latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Metadata check failed');
    } finally {
      setChecking(false);
    }
  }

  function onDelete() {
    if (!id) return;
    Alert.alert('Delete song', 'Remove this track from the catalog?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSong(id);
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  if (loading || !form) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.gold} />
      </View>
    );
  }

  const issues = lastCheck?.issues ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>{song?.title ?? 'Song'}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.section}>Metadata check</Text>
          <StatusBadge status={lastCheck?.status ?? null} />
        </View>
        <Muted>
          Runs a local completeness check, then stores the result and a snapshot of the fields that
          were checked.
        </Muted>
        <Button label="Run metadata check" onPress={onCheck} loading={checking || saving} />

        {issues.length > 0 ? (
          <View style={styles.issues}>
            {issues.map((issue) => (
              <Text
                key={`${issue.field}-${issue.message}`}
                style={[styles.issue, issue.severity === 'error' ? styles.issueError : styles.issueWarn]}>
                {issue.severity === 'error' ? 'Error' : 'Warning'} · {issue.message}
              </Text>
            ))}
          </View>
        ) : lastCheck ? (
          <Text style={styles.passed}>Last run passed. Snapshot saved.</Text>
        ) : null}

        <Text style={styles.section}>Moods</Text>
        <View style={styles.moods}>
          {allMoods.map((mood) => (
            <Chip
              key={mood.id}
              label={mood.name}
              selected={selectedMoods.includes(mood.id)}
              onPress={() => toggleMood(mood.id)}
            />
          ))}
        </View>

        <Text style={styles.section}>Details</Text>
        <SongForm value={form} onChange={setForm} />
        <ErrorText message={error} />
        <Button label="Save changes" onPress={onSave} loading={saving} />
        <Button label="Delete song" variant="danger" onPress={onDelete} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 14, paddingBottom: 56 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  issues: { gap: 8 },
  issue: { fontSize: 14, lineHeight: 20 },
  issueError: { color: palette.danger },
  issueWarn: { color: palette.warning },
  passed: { color: palette.success, fontSize: 14 },
});
