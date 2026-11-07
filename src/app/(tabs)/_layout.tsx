import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, type ColorValue } from 'react-native';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName, focused: IconName) =>
  function TabIcon({ color, size, focused: f }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={f ? focused : name} size={size} color={color as string} />;
  };

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textDim,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('checkmark-circle-outline', 'checkmark-circle') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar-outline', 'calendar') }} />
      <Tabs.Screen name="weight" options={{ title: 'Weight', tabBarIcon: icon('scale-outline', 'scale') }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals', tabBarIcon: icon('restaurant-outline', 'restaurant') }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: icon('repeat-outline', 'repeat') }} />
    </Tabs>
  );
}
