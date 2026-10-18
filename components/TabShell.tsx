import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, Tabs } from 'expo-router/tabs';
import { View } from 'react-native';

import { MiniPlayer } from '@/components/MiniPlayer';
import type { IconName } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';

export type TabDef = { name: string; title: string; icon: IconName; iconActive: IconName };

/** Themed bottom tabs with the mini player docked above the bar. */
export function TabShell({ tabs }: { tabs: TabDef[] }) {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => (
        <View>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenListeners={{ tabPress: () => haptic.tap() }}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        headerShadowVisible: false,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={24} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
