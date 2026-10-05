import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { palette } from '@/constants/theme';
import type { CheckStatus } from '@/lib/types';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.muted}
        style={styles.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && { opacity: 0.85 },
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? palette.gold : palette.bg} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'ghost' && { color: palette.gold },
            variant === 'danger' && { color: '#fff' },
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({ status }: { status: CheckStatus | null }) {
  if (!status) {
    return (
      <View style={[styles.badge, { backgroundColor: palette.surface2 }]}>
        <Text style={[styles.badgeLabel, { color: palette.muted }]}>No check</Text>
      </View>
    );
  }

  const map = {
    passed: { bg: 'rgba(111,191,139,0.18)', color: palette.success, label: 'Passed' },
    warnings: { bg: 'rgba(224,168,79,0.18)', color: palette.warning, label: 'Warnings' },
    failed: { bg: 'rgba(224,106,94,0.18)', color: palette.danger, label: 'Failed' },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeLabel, { color: map.color }]}>{map.label}</Text>
    </View>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
    padding: 20,
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  muted: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  field: {
    gap: 8,
  },
  label: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 12,
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: palette.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.line,
  },
  buttonDanger: {
    backgroundColor: palette.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: palette.bg,
    fontWeight: '700',
    fontSize: 16,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.surface,
  },
  chipSelected: {
    backgroundColor: palette.gold,
    borderColor: palette.gold,
  },
  chipLabel: {
    color: palette.goldSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: palette.bg,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    color: palette.danger,
    fontSize: 14,
  },
});
