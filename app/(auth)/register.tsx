import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AuthHero } from '@/components/AuthHero';
import { RolePicker } from '@/components/RolePicker';
import { Button, ErrorText, Field } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStyles } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';
import type { Role } from '@/lib/types';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const styles = useStyles(makeStyles);
  const [role, setRole] = useState<Role>('musician');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const isSupervisor = role === 'supervisor';

  async function onRegister() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await signUp(email.trim(), password, name.trim(), role);
      haptic.success();
      if (result === 'confirm') setInfo('Account created. Confirm your email, then log in.');
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : 'Could not register');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthHero
          title="Create your account"
          subtitle={
            isSupervisor
              ? 'Supervisors post briefs and get the sync agent. Musicians never see who you are.'
              : 'Musicians manage songs, drafts and previews, and submit to open briefs.'
          }
        />
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <RolePicker value={role} onChange={setRole} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(280).springify()} style={styles.form}>
            <Field
              label={isSupervisor ? 'Your name or company' : 'Artist name'}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder={isSupervisor ? 'Northlight Music Supervision' : 'Darzini'}
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
            {info ? (
              <Animated.Text entering={FadeIn} style={styles.info}>
                {info}
              </Animated.Text>
            ) : null}
            <Button
              label={isSupervisor ? 'Create supervisor account' : 'Create artist account'}
              variant="gradient"
              icon="person-add-outline"
              onPress={onRegister}
              loading={busy}
              disabled={!name || !email || password.length < 6}
            />
            <Button label="Back to login" onPress={() => router.back()} variant="ghost" />
          </Animated.View>
          <Link href="/(auth)" style={styles.link}>
            <Text>
              Already have an account? <Text style={styles.linkStrong}>Log in</Text>
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
    info: { color: c.success, fontSize: 14 },
    link: { color: c.muted, fontSize: 15, textAlign: 'center' },
    linkStrong: { color: c.primary, fontWeight: '800' },
  });
