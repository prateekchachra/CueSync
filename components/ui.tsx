import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { ThemeColors } from '@/constants/theme';
import { useStyles, useTheme } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';
import type { CheckStatus, SubmissionStatus } from '@/lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 15, stiffness: 320, mass: 0.6 };

/* ------------------------------------------------------------------ */
/* PressableScale: every tappable surface shrinks a touch + haptic tick */
/* ------------------------------------------------------------------ */

export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptics = 'tap',
  onPress,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptics?: 'tap' | 'press' | 'none';
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics === 'tap') haptic.tap();
        if (haptics === 'press') haptic.press();
        onPress?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

/* ------------------------------------------------------------------ */
/* Text + layout                                                        */
/* ------------------------------------------------------------------ */

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Title({ children, size = 28 }: { children: ReactNode; size?: number }) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.title, { fontSize: size }]}>{children}</Text>;
}

export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.kicker, color ? { color } : null]}>{children}</Text>;
}

export function Muted({ children, center }: { children: ReactNode; center?: boolean }) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.muted, center && { textAlign: 'center' }]}>{children}</Text>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorText({ message }: { message?: string | null }) {
  const styles = useStyles(makeStyles);
  if (!message) return null;
  return (
    <Animated.View entering={FadeIn} style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color={styles.error.color} />
      <Text style={styles.error}>{message}</Text>
    </Animated.View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Muted center>{body}</Muted> : null}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const focus = useSharedValue(0);
  const border = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [colors.line, colors.primary]),
  }));

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputWrap, border]}>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }]}
          autoCapitalize="none"
          {...props}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: 180 });
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: 180 });
            props.onBlur?.(e);
          }}
        />
      </Animated.View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          haptic.tap();
          onValueChange(next);
        }}
        trackColor={{ true: colors.primary, false: colors.line }}
        thumbColor={value ? colors.accent : colors.surface}
        // react-native-web ignores thumbColor for the "on" state.
        {...({ activeThumbColor: colors.accent } as object)}
        ios_backgroundColor={colors.line}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

export function Button({
  label,
  onPress,
  disabled,
  loading,
  icon,
  variant = 'primary',
  compact,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  variant?: 'primary' | 'accent' | 'gradient' | 'ghost' | 'danger' | 'soft';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const fg = {
    primary: colors.onPrimary,
    accent: colors.onAccent,
    gradient: '#FFFFFF',
    ghost: colors.primary,
    danger: '#FFFFFF',
    soft: colors.primary,
  }[variant];

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={styles.buttonInner}>
      {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={fg} /> : null}
      <Text style={[styles.buttonLabel, compact && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </View>
  );

  const shape = [
    styles.button,
    compact && styles.buttonCompact,
    variant === 'primary' && { backgroundColor: colors.primary },
    variant === 'accent' && { backgroundColor: colors.accent },
    variant === 'danger' && { backgroundColor: colors.danger },
    variant === 'soft' && { backgroundColor: colors.primarySoft },
    variant === 'ghost' && styles.buttonGhost,
    (disabled || loading) && styles.buttonDisabled,
  ];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptics="press"
      style={[{ borderRadius: 14 }, style]}>
      {variant === 'gradient' ? (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[...shape, styles.buttonGradient]}>
          {content}
        </LinearGradient>
      ) : (
        <View style={shape}>{content}</View>
      )}
    </PressableScale>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 22,
  color,
  background,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.88}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: size + 20,
        height: size + 20,
        borderRadius: (size + 20) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background ?? 'transparent',
      }}>
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ */
/* Chips, badges, radios                                                */
/* ------------------------------------------------------------------ */

export function Chip({
  label,
  selected,
  onPress,
  tone = 'primary',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'primary' | 'accent';
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const fill = tone === 'accent' ? colors.accent : colors.primary;
  const body = (
    <View
      style={[
        styles.chip,
        selected && { backgroundColor: fill, borderColor: fill },
      ]}>
      <Text
        style={[
          styles.chipLabel,
          selected && { color: tone === 'accent' ? colors.onAccent : colors.onPrimary },
        ]}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} scaleTo={0.92}>
      {body}
    </PressableScale>
  );
}

export function Pill({ label, color, background }: { label: string; color: string; background: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: CheckStatus | null }) {
  const { colors } = useTheme();
  if (!status) return <Pill label="No check" color={colors.muted} background={colors.surface2} />;
  const map = {
    passed: { color: colors.success, background: colors.successSoft, label: 'Passed' },
    warnings: { color: colors.warning, background: colors.warningSoft, label: 'Warnings' },
    failed: { color: colors.danger, background: colors.dangerSoft, label: 'Failed' },
  }[status];
  return <Pill {...map} />;
}

export function SubmissionBadge({ status }: { status: SubmissionStatus }) {
  const { colors } = useTheme();
  const map = {
    pending: { color: colors.primary, background: colors.primarySoft, label: 'Pending' },
    accepted: { color: colors.success, background: colors.successSoft, label: 'Accepted' },
    declined: { color: colors.muted, background: colors.surface2, label: 'Not selected' },
  }[status];
  return <Pill {...map} />;
}

export type RadioOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: IconName;
};

export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  horizontal,
}: {
  options: RadioOption<T>[];
  value: T;
  onChange: (next: T) => void;
  horizontal?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: horizontal ? 'row' : 'column', gap: 10 }}>
      {options.map((option) => (
        <RadioItem
          key={option.value}
          option={option}
          selected={option.value === value}
          onPress={() => onChange(option.value)}
          flex={horizontal}
        />
      ))}
    </View>
  );
}

function RadioItem<T extends string>({
  option,
  selected,
  onPress,
  flex,
}: {
  option: RadioOption<T>;
  selected: boolean;
  onPress: () => void;
  flex?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, SPRING);
  }, [selected, progress]);

  const dot = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
    opacity: progress.value,
  }));
  const frame = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [colors.line, colors.primary]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface, colors.primarySoft]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={flex ? { flex: 1 } : undefined}>
      <Animated.View style={[styles.radio, frame]}>
        <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.muted }]}>
          <Animated.View style={[styles.radioDot, { backgroundColor: colors.accent }, dot]} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {option.icon ? (
              <Ionicons name={option.icon} size={16} color={selected ? colors.primary : colors.muted} />
            ) : null}
            <Text style={[styles.radioLabel, selected && { color: colors.primary }]}>{option.label}</Text>
          </View>
          {option.description ? <Text style={styles.hint}>{option.description}</Text> : null}
        </View>
      </Animated.View>
    </PressableScale>
  );
}

/** Pill-shaped segmented switch with a sliding thumb. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const segment = width / options.length;

  useEffect(() => {
    x.value = withSpring(index * segment, SPRING);
  }, [index, segment, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.segmented} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 ? (
        <Animated.View style={[styles.segmentThumb, { width: segment }, thumb]} />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic.tap();
              onChange(option.value);
            }}>
            <Text style={[styles.segmentLabel, active && { color: colors.onPrimary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, padding: 20 },
    title: { color: c.text, fontWeight: '800', letterSpacing: -0.6 },
    kicker: {
      color: c.accent,
      fontWeight: '800',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      fontSize: 12,
    },
    muted: { color: c.muted, fontSize: 15, lineHeight: 22 },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    section: { color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: c.line,
      gap: 12,
    },
    errorBox: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
    error: { color: c.danger, fontSize: 14, flex: 1 },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
    field: { gap: 8 },
    label: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    hint: { color: c.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
    inputWrap: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderRadius: 14,
    },
    input: {
      color: c.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    toggleLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
    button: {
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    buttonCompact: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 14 },
    buttonGradient: { overflow: 'hidden' },
    buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    buttonGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.line },
    buttonDisabled: { opacity: 0.45 },
    buttonLabel: { fontWeight: '800', fontSize: 16, letterSpacing: 0.1 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.line,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: c.surface,
    },
    chipLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
    badgeLabel: { fontSize: 12, fontWeight: '800' },
    radio: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1.5,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: { width: 10, height: 10, borderRadius: 5 },
    radioLabel: { color: c.text, fontSize: 15, fontWeight: '700' },
    segmented: {
      flexDirection: 'row',
      backgroundColor: c.surface2,
      borderRadius: 999,
      padding: 4,
      position: 'relative',
    },
    segmentThumb: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 999,
      backgroundColor: c.primary,
    },
    segment: { flex: 1, paddingVertical: 9, alignItems: 'center' },
    segmentLabel: { color: c.muted, fontWeight: '700', fontSize: 14 },
  });
