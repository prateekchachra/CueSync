import { StyleSheet, Text, View } from 'react-native';

import { RadioGroup } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import type { Role } from '@/lib/types';

export function RolePicker({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.question, { color: colors.text }]}>Are you a musician or supervisor?</Text>
      <RadioGroup<Role>
        horizontal
        value={value}
        onChange={onChange}
        options={[
          { value: 'musician', label: 'For musicians', icon: 'mic' },
          { value: 'supervisor', label: 'For supervisors', icon: 'film' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  question: { fontSize: 16, fontWeight: '800' },
});
