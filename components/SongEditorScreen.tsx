import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { emptySongForm, formFromSong, SongForm, toSongFields, type SongFormValues } from '@/components/SongForm';
import { Button, ErrorText } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { createSong, fetchMoods, fetchSong, setSongMoods, updateSong } from '@/lib/catalog';
import { haptic } from '@/lib/haptics';
import type { Mood } from '@/lib/types';

/** Create (no songId) or edit a song. */
export function SongEditorScreen({ songId }: { songId?: string }) {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [form, setForm] = useState<SongFormValues | null>(songId ? null : emptySongForm());
  const [moods, setMoods] = useState<Mood[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [allMoods, song] = await Promise.all([fetchMoods(), songId ? fetchSong(songId) : Promise.resolve(null)]);
        if (!alive) return;
        setMoods(allMoods);
        if (song) {
          setForm(formFromSong(song));
          setSelected(song.moods.map((m) => m.id));
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load');
      }
    })();
    return () => {
      alive = false;
    };
  }, [songId]);

  async function onSave() {
    if (!session?.user.id || !form) return;
    const fields = toSongFields(form);
    if (!fields.title) {
      haptic.warning();
      setError('Give the song a title first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let id = songId;
      if (id) await updateSong(id, fields);
      else id = (await createSong(session.user.id, fields)).id;
      await setSongMoods(id, selected);
      haptic.success();
      if (songId) router.back();
      else router.replace(`/song/${id}`);
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : 'Could not save song');
    } finally {
      setBusy(false);
    }
  }

  if (!form) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        {error ? <ErrorText message={error} /> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SongForm
          value={form}
          onChange={setForm}
          moods={moods}
          selectedMoods={selected}
          onToggleMood={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
          userId={session?.user.id ?? ''}
        />
        <ErrorText message={error} />
        <Button label={songId ? 'Save changes' : 'Save song'} variant="gradient" icon="checkmark" onPress={onSave} loading={busy} />
        <Button label="Cancel" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 64 },
});
