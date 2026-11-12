import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AtomicHost } from '@/components/atomic/AtomicHost';
import { ConfettiHost } from '@/components/ConfettiHost';
import { StartupSplash } from '@/components/StartupSplash';
import { startAutoBackup } from '@/services/backup';
import { refreshHealth } from '@/services/healthSync';
import { ensureDefaultMealGoal, refreshMealGoals } from '@/services/mealGoalSync';
import { runMealSchedules } from '@/services/mealSchedule';
import { applyUpdateNow } from '@/services/otaUpdate';
import { syncWidget } from '@/services/widgetSync';
import { useMealStore } from '@/store/useMealStore';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { useUnitStore } from '@/store/useUnitStore';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { useWorkoutSession } from '@/store/useWorkoutSession';
import { useWeightStore } from '@/store/useWeightStore';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const t = useTheme();
  // The navigator's default theme is light grey/white; it shows as a pale line along the edge of a screen
  // that is being swiped away. Paint every navigation surface with the app background instead.
  const base = t.dark ? DarkTheme : DefaultTheme;
  const navTheme = useMemo(
    () => ({ ...base, colors: { ...base.colors, background: t.bg, card: t.bg, border: t.border } }),
    [base, t.bg, t.border],
  );
  const { load, ready, routines, done } = useRoutineStore();
  useEffect(() => {
    load().catch((e) => console.error('Failed to load data', e));
    useWeightStore.getState().load().catch((e) => console.error('Failed to load weights', e));
    useMealStore.getState().load().catch((e) => console.error('Failed to load meals', e));
    useTaskStore.getState().load().catch((e) => console.error('Failed to load tasks', e));
    useUnitStore.getState().load().catch((e) => console.error('Failed to load units', e));
    useMemoryStore.getState().load().catch((e) => console.error('Failed to load Atomic memory', e));
    useWorkoutLibraryStore.getState().load().catch((e) => console.error('Failed to load workouts', e));
    useWorkoutHistory.getState().load().catch((e) => console.error('Failed to load workout history', e));
    useWorkoutSession.getState().load().catch((e) => console.error('Failed to resume workout', e)); // a workout in progress survives a kill
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

  // Write the workout being logged to SQLite whenever the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s !== 'active' && void useWorkoutSession.getState().flush());
    return () => sub.remove();
  }, []);

  // Cloud backup when the app goes to background (no-op until signed in and the cloud check passed).
  useEffect(() => startAutoBackup(), []);

  // Protein/meal-goal routines: re-check whenever meals or routines change.
  const meals = useMealStore((s) => s.meals);
  useEffect(() => {
    if (ready) ensureDefaultMealGoal().then(refreshMealGoals);
  }, [ready, meals, goalSignature]);
  // Past days and the 9 PM judgement depend on the clock, so re-check when the app returns to the foreground.
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
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      runMealSchedules();
      refreshMealGoals(); // picks up the 9 PM meal-goal judgement while the app stays open
    }, 60_000);
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
    <SafeAreaProvider style={{ backgroundColor: t.bg }}>
      <ThemeProvider value={navTheme}>
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          <StatusBar style={t.dark ? 'light' : 'dark'} />
          {/* Swipe back from anywhere on pushed screens; modals keep the native swipe-down dismiss. */}
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              contentStyle: { backgroundColor: t.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="routine-form" options={{ presentation: 'modal' }} />
            <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
            <Stack.Screen name="log-meal" />
            <Stack.Screen name="saved-meal" />
            <Stack.Screen name="meal-builder" options={{ presentation: 'modal' }} />
            <Stack.Screen name="meal-target" options={{ presentation: 'modal' }} />
            <Stack.Screen name="ai-settings" options={{ presentation: 'modal' }} />
            <Stack.Screen name="backup" options={{ presentation: 'modal' }} />
            <Stack.Screen name="exercises" />
            <Stack.Screen name="exercise-info" />
            <Stack.Screen name="exercise-form" options={{ presentation: 'modal' }} />
            <Stack.Screen name="template" />
            <Stack.Screen name="workout" options={{ gestureEnabled: false }} />
            <Stack.Screen name="workout-summary" options={{ gestureEnabled: false }} />
            <Stack.Screen name="workout-detail" />
            <Stack.Screen name="workout-manage" />
            <Stack.Screen name="workout-settings" options={{ presentation: 'modal' }} />
            <Stack.Screen name="memory" options={{ presentation: 'modal' }} />
          </Stack>
          <ConfettiHost />
          <AtomicHost />
          <StartupSplash />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
