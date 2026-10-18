import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { useStyles } from '@/context/ThemeContext';

export default function NotFoundScreen() {
  const styles = useStyles(makeStyles);
  return (
    <>
      <Stack.Screen options={{ title: 'Oops' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back home</Text>
        </Link>
      </View>
    </>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
    title: { fontSize: 20, fontWeight: '800', color: c.text },
    link: { marginTop: 15, paddingVertical: 15 },
    linkText: { fontSize: 15, color: c.primary, fontWeight: '700' },
  });
