import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Pill, PressableScale } from '@/components/ui';
import type { ThemeColors } from '@/constants/theme';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { briefSummary } from '@/lib/briefs';
import type { Brief, BriefStats } from '@/lib/types';

function daysLeft(deadline: string | null) {
  if (!deadline) return null;
  const ms = new Date(`${deadline}T23:59:59`).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return 'Deadline passed';
  if (days === 0) return 'Due today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

export function BriefCard({
  brief,
  index,
  onPress,
  stats,
  submitted,
}: {
  brief: Brief;
  index: number;
  onPress: () => void;
  stats?: BriefStats;
  submitted?: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const due = daysLeft(brief.deadline);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).springify().damping(18)} layout={LinearTransition}>
      <PressableScale onPress={onPress} scaleTo={0.975} style={styles.card}>
        <View style={styles.accentBar} />
        <View style={styles.top}>
          <Text style={styles.type}>{brief.project_type ?? 'Brief'}</Text>
          {brief.status === 'closed' ? (
            <Pill label="Closed" color={colors.muted} background={colors.surface2} />
          ) : due ? (
            <Pill label={due} color={colors.accent} background={colors.accentSoft} />
          ) : null}
        </View>
        <Text style={styles.title}>{brief.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {brief.description}
        </Text>
        <View style={styles.tags}>
          {[...brief.moods.slice(0, 3), ...briefSummary(brief)].map((t) => (
            <Text key={t} style={styles.tag}>
              {t}
            </Text>
          ))}
        </View>

        {stats ? (
          <View style={styles.stats}>
            <Stat icon="people" value={stats.total} label="submitted" color={colors.primary} styles={styles} />
            <Stat icon="time" value={stats.pending} label="to review" color={colors.accent} styles={styles} />
            <Stat icon="checkmark-circle" value={stats.accepted} label="accepted" color={colors.success} styles={styles} />
          </View>
        ) : submitted ? (
          <View style={styles.submitted}>
            <Ionicons name="paper-plane" size={14} color={colors.primary} />
            <Text style={styles.submittedText}>
              You submitted {submitted} song{submitted === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

function Stat({
  icon,
  value,
  label,
  color,
  styles,
}: {
  icon: 'people' | 'time' | 'checkmark-circle';
  value: number;
  label: string;
  color: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      padding: 16,
      paddingLeft: 20,
      borderWidth: 1,
      borderColor: c.line,
      gap: 8,
      overflow: 'hidden',
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 5,
      backgroundColor: c.accent,
    },
    top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    type: { color: c.primary, fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
    title: { color: c.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
    desc: { color: c.muted, fontSize: 14, lineHeight: 20 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
    stats: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 4,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.line,
    },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statValue: { fontWeight: '900', fontSize: 15 },
    statLabel: { color: c.muted, fontSize: 12 },
    submitted: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    submittedText: { color: c.primary, fontWeight: '700', fontSize: 13 },
  });
