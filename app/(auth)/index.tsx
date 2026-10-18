import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthHero } from '@/components/AuthHero';
import { RolePicker } from '@/components/RolePicker';
import { Button, ErrorText, Field } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStyles } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';
import type { Role } from '@/lib/types';

export default function LoginScreen() {
  const { signIn, signInAsDemo } = useAuth();
  const styles = useStyles(makeStyles);
  const [role, setRole] = useState<Role>('musician');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>, setLoading: (v: boolean) => void) {
    setError(null);
    setLoading(true);
    try {
      await work();
      haptic.success();
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  const isSupervisor = role === 'supervisor';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthHero
          title={isSupervisor ? 'Find the right cue, fast' : 'Your catalog, sync-ready'}
          subtitle={
            isSupervisor
              ? 'Post briefs, review anonymous submissions and search catalogs with the sync agent.'
              : 'Releases, drafts and previews in one place. Answer briefs from music supervisors.'
          }
        />

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.delay(220).springify()}>
            <RolePicker value={role} onChange={setRole} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              placeholder={isSupervisor ? 'you@productionco.com' : 'you@studio.com'}
            />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
            <ErrorText message={error} />
            <Button
              label="Log in"
              variant="gradient"
              icon="log-in-outline"
              onPress={() => run(() => signIn(email.trim(), password, role), setBusy)}
              loading={busy}
              disabled={!email || !password}
            />
            <Button
              label={isSupervisor ? 'Continue as demo supervisor' : 'Continue as Darzini'}
              icon={isSupervisor ? 'film-outline' : 'sparkles-outline'}
              variant="ghost"
              onPress={() => run(() => signInAsDemo(role), setDemoBusy)}
              loading={demoBusy}
            />
          </Animated.View>

          <Link href="/(auth)/register" style={styles.link}>
            <Text>
              New here? <Text style={styles.linkStrong}>Create an account</Text>
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    scroll: { flexGrow: 1, paddingBottom: 40 },
    body: { padding: 24, gap: 22 },
    form: { gap: 14 },
    link: { color: c.muted, fontSize: 15, textAlign: 'center' },
    linkStrong: { color: c.primary, fontWeight: '800' },
  });
