import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PlayerProvider } from '@/context/PlayerContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

export { ErrorBoundary } from 'expo-router';

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const { colors } = useTheme();
  const signedIn = !!session && !!profile;
  const isMusician = signedIn && profile?.role === 'musician';
  const isSupervisor = signedIn && profile?.role === 'supervisor';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '800' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}>
        <Stack.Protected guard={isMusician}>
          <Stack.Screen name="(musician)" options={{ headerShown: false }} />
          <Stack.Screen name="song/[id]" options={{ title: '', headerTransparent: true }} />
          <Stack.Screen name="song/new" options={{ title: 'New song', presentation: 'modal' }} />
          <Stack.Screen name="song/edit/[id]" options={{ title: 'Edit song', presentation: 'modal' }} />
          <Stack.Screen name="brief/[id]" options={{ title: 'Brief' }} />
        </Stack.Protected>
        <Stack.Protected guard={isSupervisor}>
          <Stack.Screen name="(supervisor)" options={{ headerShown: false }} />
          <Stack.Screen name="review/[id]" options={{ title: 'Submissions' }} />
          <Stack.Screen name="review/new" options={{ title: 'New brief', presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen
            name="player"
            options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PlayerProvider>
          <RootNavigator />
        </PlayerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
