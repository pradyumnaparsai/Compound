import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { startAutoBackup } from '@/services/backup';
import { refreshHealth } from '@/services/healthSync';
import { ensureDefaultMealGoal, refreshMealGoals } from '@/services/mealGoalSync';
import { runMealSchedules } from '@/services/mealSchedule';
import { applyUpdateNow } from '@/services/otaUpdate';
import { syncWidget } from '@/services/widgetSync';
import { useMealStore } from '@/store/useMealStore';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useWeightStore } from '@/store/useWeightStore';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const t = useTheme();
  const { load, ready, routines, done } = useRoutineStore();
  useEffect(() => {
    load().catch((e) => console.error('Failed to load data', e));
    useWeightStore.getState().load().catch((e) => console.error('Failed to load weights', e));
    useMealStore.getState().load().catch((e) => console.error('Failed to load meals', e));
    useTaskStore.getState().load().catch((e) => console.error('Failed to load tasks', e));
  }, [load]);

  // Apple Health → auto-check goal routines: on open, on every return to foreground, every minute while open,
  // and whenever goals change.
  const goalSignature = routines.map((r) => `${r.id}:${JSON.stringify(r.goal)}:${r.archivedAt ?? ''}`).join('|');
  useEffect(() => {
    if (!ready) return;
    refreshHealth();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshHealth());
    const timer = setInterval(() => AppState.currentState === 'active' && refreshHealth(), 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [ready, goalSignature]);

  // Published updates normally apply only on the second launch; fetch and restart into them right away.
  useEffect(() => {
    applyUpdateNow();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && applyUpdateNow());
    return () => sub.remove();
  }, []);

  // Cloud backup when the app goes to background (no-op until signed in and the cloud check passed).
  useEffect(() => startAutoBackup(), []);

  // Protein-goal routines: re-check whenever meals or routines change.
  const meals = useMealStore((s) => s.meals);
  useEffect(() => {
    if (ready) ensureDefaultMealGoal().then(refreshMealGoals);
  }, [ready, meals, goalSignature]);
  // Meal goals are judged once the day has ended, so re-check when the app returns to the foreground.
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshMealGoals());
    return () => sub.remove();
  }, [ready]);

  // Scheduled meals: log whatever is due on open, on return to foreground, every minute while open, and when
  // schedules/meals change (e.g. right after the data finished loading).
  const schedules = useMealStore((s) => s.schedules);
  const savedMeals = useMealStore((s) => s.saved);
  useEffect(() => {
    runMealSchedules();
  }, [schedules, savedMeals]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && runMealSchedules());
    const timer = setInterval(() => AppState.currentState === 'active' && runMealSchedules(), 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  // Keep the lock-screen widget in step with every change (and on each app open).
  useEffect(() => {
    if (ready) syncWidget(routines, done);
  }, [ready, routines, done]);

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="routine-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="diary" />
        <Stack.Screen name="meal-builder" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meal-settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="backup" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
