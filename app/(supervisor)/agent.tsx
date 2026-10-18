import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentShortlist } from '@/components/AgentShortlist';
import { Chip, ErrorText, IconButton, PressableScale, Segmented, ToggleRow } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { askSyncAgent, type AgentTurn, type ShortlistTrack } from '@/lib/agent';
import { briefSummary, fetchBrief, fetchMyBriefs } from '@/lib/briefs';
import { haptic } from '@/lib/haptics';
import type { Brief } from '@/lib/types';

type Message = AgentTurn & {
  id: string;
  tools?: { name: string; is_error: boolean }[];
  meta?: string;
  shortlist?: ShortlistTrack[];
};

const SUGGESTIONS = [
  'Tense night chase through a city, around 90 BPM, no vocals, budget under 2000 EUR, must be one-stop.',
  'Warm summer montage for a travel ad, friends laughing, upbeat but not aggressive, vocals fine, under 1500 EUR.',
  'Calm meditation app intro, dreamy, ethereal, no lyrics. Must be 100% human-made.',
];

function briefToPrompt(b: Brief) {
  const parts = [
    `${b.project_type ?? 'Project'}: ${b.title}.`,
    b.description,
    b.moods.length ? `Moods: ${b.moods.join(', ')}.` : '',
    b.genres.length ? `Genres: ${b.genres.join(', ')}.` : '',
    ...briefSummary(b).map((s) => `${s}.`),
  ];
  return parts.filter(Boolean).join(' ').replace(/≤ €/g, 'budget under EUR ');
}

export default function SyncAgentScreen() {
  const { briefId } = useLocalSearchParams<{ briefId?: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [includeSample, setIncludeSample] = useState(true);
  const [topN, setTopN] = useState<'5' | '10'>('10');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      fetchMyBriefs(session.user.id)
        .then((rows) => setBriefs(rows.filter((b) => b.status === 'open')))
        .catch(() => undefined);
    }, [session?.user.id]),
  );

  // Arriving from a brief's "Ask the sync agent" button.
  useEffect(() => {
    if (!briefId) return;
    fetchBrief(briefId)
      .then((b) => setDraft(briefToPrompt(b)))
      .catch(() => undefined);
  }, [briefId]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    haptic.press();
    setError(null);
    const next: Message[] = [...messages, { id: `u${Date.now()}`, role: 'user', content }];
    setMessages(next);
    setDraft('');
    setThinking(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    try {
      const reply = await askSyncAgent(
        next.map(({ role, content: c }) => ({ role, content: c })),
        includeSample,
        Number(topN),
      );
      haptic.success();
      setMessages((cur) => [
        ...cur,
        {
          id: `a${Date.now()}`,
          role: 'assistant',
          content: reply.answer,
          tools: reply.tool_calls,
          shortlist: reply.shortlist,
          meta: `${reply.catalogue.app_tracks} MySync track${reply.catalogue.app_tracks === 1 ? '' : 's'}${
            reply.catalogue.sample_tracks ? ` + ${reply.catalogue.sample_tracks} sample` : ''
          }${reply.model ? ` · ${reply.model}` : ''}`,
        },
      ]);
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : 'The agent did not answer');
      // Put the question back so it can be retried.
      setMessages(messages);
      setDraft(content);
    } finally {
      setThinking(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeIn}>
          <LinearGradient colors={colors.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.heroTitle}>Sync agent</Text>
              {messages.length ? (
                <IconButton
                  icon="refresh"
                  accessibilityLabel="New conversation"
                  color="#FFFFFF"
                  size={18}
                  onPress={() => {
                    haptic.tap();
                    setMessages([]);
                    setError(null);
                  }}
                />
              ) : null}
            </View>
            <Text style={styles.heroBody}>
              Describe the scene. The agent searches releases musicians opened to sync, checks clearance on every pick,
              and can draft the licence request.
            </Text>
          </LinearGradient>
        </Animated.View>

        <ToggleRow
          label="Include sample catalogue"
          hint="12 fictional tracks, handy while few musicians have opted in."
          value={includeSample}
          onValueChange={setIncludeSample}
        />
        <View style={styles.topRow}>
          <Text style={styles.topLabel}>Tracks to return</Text>
          <View style={{ width: 150 }}>
            <Segmented<'5' | '10'>
              value={topN}
              onChange={setTopN}
              options={[
                { value: '5', label: 'Top 5' },
                { value: '10', label: 'Top 10' },
              ]}
            />
          </View>
        </View>

        {messages.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 10 }}>
            {briefs.length ? (
              <>
                <Text style={styles.label}>Use one of your briefs</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {briefs.map((b) => (
                    <Chip key={b.id} label={b.title} tone="accent" onPress={() => setDraft(briefToPrompt(b))} />
                  ))}
                </ScrollView>
              </>
            ) : null}
            <Text style={styles.label}>Or try</Text>
            {SUGGESTIONS.map((s, i) => (
              <Animated.View key={s} entering={FadeInDown.delay(160 + i * 60)}>
                <PressableScale onPress={() => send(s)} style={styles.suggestion}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </PressableScale>
              </Animated.View>
            ))}
          </Animated.View>
        ) : null}

        {messages.map((m) => (
          <View key={m.id} style={{ gap: 10 }}>
            <Animated.View
              entering={m.role === 'user' ? FadeInUp.springify().damping(16) : FadeInDown.springify().damping(16)}
              layout={LinearTransition}
              style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]}>
              {m.role === 'user' ? (
                <Text style={styles.userText}>{m.content}</Text>
              ) : (
                <>
                  <RichText text={m.content} styles={styles} />
                  {m.tools?.length ? (
                    <View style={styles.tools}>
                      {summarizeTools(m.tools).map((t) => (
                        <View key={t.name} style={[styles.tool, t.errors > 0 && { borderColor: colors.danger }]}>
                          <Ionicons name="construct-outline" size={11} color={colors.muted} />
                          <Text style={styles.toolText}>
                            {t.name.replace(/_/g, ' ')}
                            {t.count > 1 ? ` ×${t.count}` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {m.meta ? <Text style={styles.meta}>{m.meta}</Text> : null}
                </>
              )}
            </Animated.View>
            {m.shortlist?.length ? <AgentShortlist tracks={m.shortlist} /> : null}
          </View>
        ))}

        {thinking ? <TypingDots color={colors.primary} styles={styles} /> : null}
        <ErrorText message={error} />
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: 10 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={messages.length ? 'Follow up… e.g. "draft the email for the first one"' : 'Describe your brief…'}
          placeholderTextColor={colors.muted}
          multiline
          style={styles.input}
        />
        <PressableScale
          disabled={!draft.trim() || thinking}
          onPress={() => send(draft)}
          scaleTo={0.85}
          haptics="none"
          accessibilityLabel="Send"
          style={{ opacity: !draft.trim() || thinking ? 0.45 : 1 }}>
          <LinearGradient colors={colors.gradient} style={styles.send}>
            <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
          </LinearGradient>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

function summarizeTools(tools: { name: string; is_error: boolean }[]) {
  const map = new Map<string, { name: string; count: number; errors: number }>();
  for (const t of tools) {
    const row = map.get(t.name) ?? { name: t.name, count: 0, errors: 0 };
    row.count++;
    if (t.is_error) row.errors++;
    map.set(t.name, row);
  }
  return [...map.values()];
}

/** Minimal markdown: headings, bullets and **bold**. */
function RichText({ text, styles }: { text: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={{ gap: 4 }}>
      {text.split('\n').map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const heading = /^#{1,4}\s+/.test(line);
        const bullet = /^\s*[-*•]\s+/.test(line);
        const body = line.replace(/^#{1,4}\s+/, '').replace(/^\s*([-*•])\s+/, '');
        const spans = body.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <Text key={j} style={styles.bold}>
              {part.slice(2, -2)}
            </Text>
          ) : (
            part
          ),
        );
        return (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              gap: 6,
              paddingLeft: bullet ? 4 : 0,
            }}>
            {bullet ? <Text style={styles.botText}>•</Text> : null}
            <Text style={[styles.botText, heading && styles.bold, { flex: 1 }]}>{spans}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 })), -1, false),
    );
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}

function TypingDots({ color, styles }: { color: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <Animated.View entering={FadeIn} style={[styles.bubble, styles.botBubble, styles.typing]}>
      <Dot delay={0} color={color} />
      <Dot delay={130} color={color} />
      <Dot delay={260} color={color} />
      <Text style={styles.meta}>searching & checking clearance…</Text>
    </Animated.View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 24 },
    hero: { borderRadius: 24, padding: 18, gap: 8 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', flex: 1 },
    heroBody: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
    label: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    suggestion: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      alignItems: 'flex-start',
    },
    suggestionText: { color: c.text, flex: 1, fontSize: 14, lineHeight: 20 },
    bubble: { borderRadius: 20, padding: 14, maxWidth: '92%' },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: c.primary,
      borderBottomRightRadius: 6,
    },
    botBubble: {
      alignSelf: 'flex-start',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderBottomLeftRadius: 6,
    },
    userText: { color: c.onPrimary, fontSize: 15, lineHeight: 21 },
    botText: { color: c.text, fontSize: 15, lineHeight: 22 },
    bold: { fontWeight: '900', color: c.text },
    tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    tool: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    toolText: { color: c.muted, fontSize: 11, fontWeight: '700' },
    meta: { color: c.muted, fontSize: 11, marginTop: 6 },
    typing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.line,
      backgroundColor: c.surface,
    },
    input: {
      flex: 1,
      maxHeight: 140,
      minHeight: 46,
      backgroundColor: c.bg,
      color: c.text,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      fontSize: 15,
      borderWidth: 1,
      borderColor: c.line,
    },
    send: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
