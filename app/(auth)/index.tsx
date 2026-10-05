import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, Field, Muted, Title } from '@/components/ui';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn, signInAsDarzini } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  async function onDarzini() {
    setError(null);
    setDemoBusy(true);
    try {
      await signInAsDarzini();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Darzini');
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>MySync</Text>
        <Title>Catalog for sync</Title>
        <Muted>Store releases, moods, and metadata checks before you pitch licensors.</Muted>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@studio.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <ErrorText message={error} />
          <Button label="Log in" onPress={onLogin} loading={busy} disabled={!email || !password} />
          <Button label="Continue as Darzini" onPress={onDarzini} loading={demoBusy} variant="ghost" />
        </View>

        <Link href="/(auth)/register" style={styles.link}>
          New artist? Create an account
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  kicker: {
    color: palette.gold,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  form: {
    marginTop: 20,
    gap: 14,
  },
  link: {
    color: palette.goldSoft,
    marginTop: 18,
    fontSize: 15,
    textAlign: 'center',
  },
});
