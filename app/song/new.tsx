import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { emptySongForm, SongForm, toSongFields } from '@/components/SongForm';
import { Button, ErrorText } from '@/components/ui';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { createSong } from '@/lib/catalog';

export default function NewSongScreen() {
  const { session } = useAuth();
  const initial = useMemo(() => emptySongForm(), []);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (!session?.user.id) return;
    const fields = toSongFields(form);
    if (!fields.title) {
      setError('Title is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const song = await createSong(session.user.id, fields);
      router.replace(`/song/${song.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save song');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SongForm value={form} onChange={setForm} />
        <ErrorText message={error} />
        <Button label="Save song" onPress={onSave} loading={busy} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else Alert.alert('Close this screen to return to catalog');
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
});
