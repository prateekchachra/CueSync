import { StyleSheet, Text, View } from 'react-native';

import { Button, Muted, Title } from '@/components/ui';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function AccountScreen() {
  const { profile, session, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <Title>Account</Title>
      <View style={styles.card}>
        <Text style={styles.label}>Artist</Text>
        <Text style={styles.value}>{profile?.artist_name ?? '—'}</Text>
        <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
        <Text style={styles.value}>{session?.user.email ?? profile?.email ?? '—'}</Text>
      </View>
      <Muted>
        This prototype stores catalog metadata only: song fields, moods, and saved metadata-check
        runs. Audio files are out of scope for now.
      </Muted>
      <Button label="Log out" onPress={() => signOut()} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg, padding: 20, gap: 18 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  label: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: { color: palette.text, fontSize: 18, marginTop: 4 },
});
