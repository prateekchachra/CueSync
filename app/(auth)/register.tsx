import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, Field, Muted, Title } from '@/components/ui';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [artistName, setArtistName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onRegister() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await signUp(email.trim(), password, artistName.trim());
      if (result === 'confirm') {
        setInfo('Account created. Confirm your email in Supabase, then log in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>MySync</Text>
        <Title>Create artist account</Title>
        <Muted>This is just identity plus catalog data. No audio files in this prototype.</Muted>

        <View style={styles.form}>
          <Field
            label="Artist name"
            value={artistName}
            onChangeText={setArtistName}
            autoCapitalize="words"
            placeholder="Darzini"
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="you@studio.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 6 characters"
          />
          <ErrorText message={error} />
          {info ? <Text style={styles.info}>{info}</Text> : null}
          <Button
            label="Register"
            onPress={onRegister}
            loading={busy}
            disabled={!artistName || !email || password.length < 6}
          />
          <Button label="Back to login" onPress={() => router.back()} variant="ghost" />
        </View>

        <Link href="/(auth)" style={styles.link}>
          Already have an account?
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
  info: {
    color: palette.success,
    fontSize: 14,
  },
  link: {
    color: palette.goldSoft,
    marginTop: 18,
    fontSize: 15,
    textAlign: 'center',
  },
});
