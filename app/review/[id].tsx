import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { PlatformLinks, PlayButton, Poster, TypeBadge } from '@/components/music';
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  IconButton,
  Muted,
  PressableScale,
  Segmented,
  SubmissionBadge,
  Title,
  ToggleRow,
} from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { briefSummary, deleteBrief, fetchBrief, fetchBriefSubmissions, reviewSubmission, setBriefStatus } from '@/lib/briefs';
import { haptic } from '@/lib/haptics';
import type { Brief, PlayableTrack, SubmissionStatus, SupervisorSubmission } from '@/lib/types';
import { formatDuration } from '@/components/SongForm';

type Filter = 'pending' | 'accepted' | 'declined' | 'all';

function confirm(title: string, body: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}

export default function ReviewBriefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [subs, setSubs] = useState<SupervisorSubmission[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [b, s] = await Promise.all([fetchBrief(id), fetchBriefSubmissions(id)]);
      setBrief(b);
      setSubs(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load brief');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const counts = useMemo(() => {
    const c: Record<SubmissionStatus, number> = { pending: 0, accepted: 0, declined: 0 };
    for (const s of subs) c[s.status]++;
    return c;
  }, [subs]);
  const artists = useMemo(() => new Set(subs.map((s) => s.artist_alias)).size, [subs]);
  const visible = filter === 'all' ? subs : subs.filter((s) => s.status === filter);
  const queue: PlayableTrack[] = useMemo(
    () =>
      visible.map((s) => ({
        id: s.song_id,
        title: s.title,
        subtitle: s.artist_alias,
        audio_url: s.audio_url,
        poster_url: s.poster_url,
        song_type: s.song_type,
      })),
    [visible]
  );

  async function decide(sub: SupervisorSubmission, decision: 'accepted' | 'declined' | 'block') {
    setBusyId(sub.submission_id);
    setError(null);
    try {
      await reviewSubmission(sub.submission_id, decision);
      if (decision === 'accepted') haptic.success();
      else haptic.heavy();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update submission');
    } finally {
      setBusyId(null);
    }
  }

  if (!brief) {
    return (
      <View style={styles.center}>
        {error ? <ErrorText message={error} /> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const header = (
    <View style={{ gap: 14 }}>
      <Animated.View entering={FadeInDown.springify()} style={{ gap: 6 }}>
        <Text style={styles.type}>{brief.project_type ?? 'Brief'}</Text>
        <Title size={24}>{brief.title}</Title>
        <Muted>{brief.description}</Muted>
        <View style={styles.tags}>
          {[...brief.moods, ...brief.genres, ...briefSummary(brief)].map((t) => (
            <Text key={t} style={styles.tag}>
              {t}
            </Text>
          ))}
        </View>
      </Animated.View>

      <Card style={styles.statsCard}>
        <View style={styles.statRow}>
          <Big value={subs.length} label="submissions" color={colors.primary} styles={styles} />
          <Big value={artists} label="artists" color={colors.accent} styles={styles} />
          <Big value={counts.accepted} label="accepted" color={colors.success} styles={styles} />
        </View>
        <ToggleRow
          label={brief.status === 'open' ? 'Accepting submissions' : 'Closed to submissions'}
          hint="Closed briefs disappear from musicians' lists."
          value={brief.status === 'open'}
          onValueChange={async (on) => {
            const status = on ? 'open' : 'closed';
            setBrief({ ...brief, status });
            try {
              await setBriefStatus(brief.id, status);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not update');
            }
          }}
        />
      </Card>

      <Button
        label="Ask the sync agent about this brief"
        icon="sparkles"
        variant="soft"
        onPress={() => router.push({ pathname: '/(supervisor)/agent', params: { briefId: brief.id } })}
      />

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'pending', label: `New ${counts.pending}` },
          { value: 'accepted', label: `Yes ${counts.accepted}` },
          { value: 'declined', label: `No ${counts.declined}` },
          { value: 'all', label: 'All' },
        ]}
      />
      <ErrorText message={error} />
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Submissions',
          headerRight: () => (
            <IconButton
              icon="trash-outline"
              accessibilityLabel="Delete brief"
              color={colors.danger}
              onPress={() =>
                confirm('Delete brief?', 'This removes the brief and all its submissions.', 'Delete', async () => {
                  await deleteBrief(brief.id);
                  router.back();
                })
              }
            />
          ),
        }}
      />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.content}
        data={visible}
        keyExtractor={(s) => s.submission_id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon={filter === 'pending' ? 'checkmark-done-outline' : 'file-tray-outline'}
            title={filter === 'pending' ? 'All caught up' : 'Nothing here'}
            body={subs.length === 0 ? 'No one has submitted yet. Musicians see open briefs in their Briefs tab.' : undefined}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index, 6) * 60).springify()}
            exiting={FadeOut}
            layout={LinearTransition}>
            <Card style={[styles.sub, item.status === 'accepted' && { borderColor: colors.success }]}>
              <View style={styles.subTop}>
                <View>
                  <Poster uri={item.poster_url} title={item.title} size={72} radius={14} />
                  <View style={styles.playDock}>
                    <PlayButton track={queue[index]!} queue={queue} size={32} />
                  </View>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.aliasRow}>
                    <Ionicons name="person-circle" size={14} color={colors.muted} />
                    <Text style={styles.alias}>{item.artist_alias}</Text>
                    {item.artist_blocked ? <Text style={styles.blocked}>· blocked</Text> : null}
                  </View>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <TypeBadge type={item.song_type} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {[
                      item.genre,
                      item.bpm && `${item.bpm} BPM`,
                      item.musical_key,
                      item.duration_seconds && formatDuration(item.duration_seconds),
                      item.has_lyrics ? 'Vocals' : 'Instrumental',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <SubmissionBadge status={item.status} />
              </View>

              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
              {item.moods.length ? <Text style={styles.moods}>{item.moods.map((m) => `#${m.toLowerCase()}`).join('  ')}</Text> : null}
              {item.note ? (
                <View style={styles.note}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
                  <Text style={styles.noteText}>{item.note}</Text>
                </View>
              ) : null}
              <PlatformLinks links={item} interactive size={26} />

              {item.status === 'pending' ? (
                <View style={{ gap: 8 }}>
                  <View style={styles.actions}>
                    <Button
                      label="Accept"
                      icon="checkmark"
                      compact
                      variant="primary"
                      loading={busyId === item.submission_id}
                      onPress={() => decide(item, 'accepted')}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Deny"
                      icon="close"
                      compact
                      variant="ghost"
                      disabled={busyId === item.submission_id}
                      onPress={() => decide(item, 'declined')}
                      style={{ flex: 1 }}
                    />
                  </View>
                  {!item.artist_blocked ? (
                    <PressableScale
                      onPress={() =>
                        confirm(
                          `Don't accept from ${item.artist_alias} again?`,
                          'Declines all their pending submissions to your briefs and hides your briefs from them. They are not notified and you never see who they are.',
                          'Block',
                          () => decide(item, 'block')
                        )
                      }
                      style={styles.blockBtn}>
                      <Ionicons name="ban" size={14} color={colors.danger} />
                      <Text style={styles.blockText}>Don't accept submissions from this musician again</Text>
                    </PressableScale>
                  ) : null}
                </View>
              ) : null}
            </Card>
          </Animated.View>
        )}
      />
    </>
  );
}

function Big({ value, label, color, styles }: { value: number; label: string; color: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.bigValue, { color }]}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
    content: { padding: 16, gap: 14, paddingBottom: 140 },
    type: { color: c.accent, fontWeight: '900', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    tag: {
      color: c.text,
      backgroundColor: c.surface2,
      fontSize: 12,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      overflow: 'hidden',
    },
    statsCard: { gap: 14 },
    statRow: { flexDirection: 'row' },
    bigValue: { fontSize: 28, fontWeight: '900' },
    bigLabel: { color: c.muted, fontSize: 12, fontWeight: '700' },
    sub: { gap: 10, borderWidth: 1.5 },
    subTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    playDock: { position: 'absolute', right: -8, bottom: -8 },
    aliasRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    alias: { color: c.muted, fontWeight: '800', fontSize: 12 },
    blocked: { color: c.danger, fontWeight: '800', fontSize: 12 },
    title: { color: c.text, fontSize: 17, fontWeight: '900' },
    meta: { color: c.muted, fontSize: 12 },
    desc: { color: c.text, fontSize: 14, lineHeight: 20 },
    moods: { color: c.primary, fontSize: 12, fontWeight: '700' },
    note: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: c.primarySoft,
      borderRadius: 12,
      padding: 10,
      alignItems: 'flex-start',
    },
    noteText: { color: c.text, fontSize: 13, flex: 1, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 10 },
    blockBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 6 },
    blockText: { color: c.danger, fontWeight: '700', fontSize: 13 },
  });
