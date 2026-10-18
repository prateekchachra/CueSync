import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Muted, Pill, SectionTitle, Segmented, Title } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePlayer } from '@/context/PlayerContext';
import { useStyles, useTheme, type ThemePreference } from '@/context/ThemeContext';
import { clearBlocks, fetchBlockedCount } from '@/lib/briefs';
import { haptic } from '@/lib/haptics';

export function AccountView() {
  const { profile, session, signOut } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const player = usePlayer();
  const isSupervisor = profile?.role === 'supervisor';
  const [blocked, setBlocked] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (isSupervisor) fetchBlockedCount().then(setBlocked).catch(() => undefined);
    }, [isSupervisor])
  );

  const name = profile?.artist_name ?? '—';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Title>Account</Title>

      <Animated.View entering={FadeInDown.springify()}>
        <Card style={styles.profile}>
          <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </LinearGradient>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{session?.user.email ?? profile?.email ?? '—'}</Text>
            <Pill
              label={isSupervisor ? 'Music supervisor' : 'Musician'}
              color={isSupervisor ? colors.accent : colors.primary}
              background={isSupervisor ? colors.accentSoft : colors.primarySoft}
            />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: 10 }}>
        <SectionTitle>Appearance</SectionTitle>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Animated.View>

      {isSupervisor ? (
        <Animated.View entering={FadeInDown.delay(140).springify()} style={{ gap: 10 }}>
          <SectionTitle>Blocked musicians</SectionTitle>
          <Muted>
            {blocked === 0
              ? "You haven't blocked anyone. Blocking is silent: the musician just stops seeing your briefs."
              : `${blocked} musician${blocked === 1 ? '' : 's'} can't see or submit to your briefs. You never see who they are.`}
          </Muted>
          {blocked > 0 ? (
            <Button
              label="Unblock everyone"
              variant="soft"
              icon="lock-open-outline"
              onPress={async () => {
                await clearBlocks();
                haptic.success();
                setBlocked(0);
              }}
            />
          ) : null}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(140).springify()} style={{ gap: 10 }}>
          <SectionTitle>Privacy</SectionTitle>
          <Muted>
            Supervisors see your songs under an anonymous alias when you answer a brief. Only releases you mark
            "Open to sync" are searchable by the supervisor sync agent.
          </Muted>
        </Animated.View>
      )}

      <Button
        label="Log out"
        variant="ghost"
        icon="log-out-outline"
        onPress={() => {
          player.stop();
          signOut();
        }}
        style={{ marginTop: 8 }}
      />
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 20, gap: 22, paddingBottom: 140 },
    profile: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 24 },
    name: { color: c.text, fontSize: 20, fontWeight: '900' },
    email: { color: c.muted, fontSize: 14 },
  });
