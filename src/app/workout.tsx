import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation, usePreventRemove, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifyError } from '@/components/notify';
import { ReorderableList } from '@/components/ReorderableList';
import { Screen } from '@/components/Screen';
import { ElapsedClock } from '@/components/workouts/ElapsedClock';
import { RestTimerBar } from '@/components/workouts/RestTimerBar';
import { WorkoutExerciseCard, encodePRs } from '@/components/workouts/WorkoutExerciseCard';
import { exerciseMap } from '@/domain/exerciseCatalog';
import { detectPRs } from '@/domain/records';
import { completedSets, incompleteSetCount } from '@/domain/session';
import { formatVolume } from '@/domain/workoutFormat';
import { formatDuration, supersetBadges, workoutDurationSeconds, workoutVolume, type Workout } from '@/domain/workout';
import { weightOn } from '@/domain/weight';
import { onLiveWorkoutFinished } from '@/services/workoutHealth';
import { useUnitStore } from '@/store/useUnitStore';
import { useWeightStore } from '@/store/useWeightStore';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { useWorkoutSession } from '@/store/useWorkoutSession';
import { radius, useTheme } from '@/theme';

/** Live workout (`/workout`) or editing a finished one (`/workout?edit=<id>`). */
export default function WorkoutScreen() {
  const t = useTheme();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { workout, mode, baseline, histories } = useWorkoutSession();
  const customs = useWorkoutLibraryStore((s) => s.customs);
  const { unit, plates, warmupVolume } = useUnitStore();
  const weights = useWeightStore((s) => s.entries);
  const [busy, setBusy] = useState(false);
  const live = mode === 'live';
  const session = useWorkoutSession.getState;
  const nav = useNavigation();

  // Edit mode: open the finished workout once.
  useEffect(() => {
    if (!edit) return;
    const s = session();
    if (s.mode === 'edit' && s.workout?.id === edit) return;
    s.beginEdit(edit).catch((e) => {
      notifyError(e, 'Could not open workout');
      router.back();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  const defs = useMemo(() => exerciseMap(customs), [customs]);
  const typeOf = useMemo(() => (id: string) => defs.get(id)?.type, [defs]);
  const dirty = mode === 'edit' && !!workout && JSON.stringify(workout) !== baseline;

  usePreventRemove(dirty && !busy, ({ data }) =>
    Alert.alert('Discard changes?', 'Your edits to this workout will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          void session().discard();
          nav.dispatch(data.action);
        },
      },
    ]),
  );

  const exerciseKey = workout?.exercises.map((e) => e.exerciseId).join('|') ?? '';
  const perExercise = useMemo(() => {
    const out: Record<string, Workout[]> = {};
    if (!workout) return out;
    for (const id of new Set(exerciseKey ? exerciseKey.split('|') : [])) {
      out[id] = (histories[id] ?? []).filter((h) => h.id !== workout.id && h.startedAt < workout.startedAt);
    }
    return out;
    // Only the id/start of the workout matter here, not every typed number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histories, workout?.id, workout?.startedAt, exerciseKey]);

  const prs = useMemo(() => {
    if (!workout) return [];
    const seen = new Set<string>();
    const hist: Workout[] = [];
    for (const list of Object.values(perExercise)) for (const h of list) {
        if (seen.has(h.id)) continue;
        seen.add(h.id);
        hist.push(h);
      }
    return detectPRs(hist, workout, typeOf);
  }, [workout, perExercise, typeOf]);

  const badges = useMemo(() => supersetBadges(workout?.exercises ?? []), [workout?.exercises]);

  if (!workout) {
    return (
      <Screen padBottom>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <Text style={{ color: t.textDim, marginTop: 24, textAlign: 'center' }}>{edit ? 'Opening…' : 'No workout in progress.'}</Text>
      </Screen>
    );
  }

  const volume = workoutVolume(workout, typeOf, { includeWarmup: warmupVolume, bodyweightKg: weightOn(weights, workout.date) });
  const done = completedSets(workout);

  const finishNow = async (countFilled = false) => {
    setBusy(true);
    try {
      const saved = await session().finish({ countFilled });
      if (live) await onLiveWorkoutFinished(saved);
      if (live) router.replace(`/workout-summary?id=${saved.id}` as Href);
      else router.back();
    } catch (e) {
      notifyError(e, 'Could not save workout', 'Could not save this workout. Please try again.');
      setBusy(false);
    }
  };

  const onFinish = () => {
    const open = incompleteSetCount(workout);
    if (done === 0 && open === 0 && live) {
      return Alert.alert('Nothing logged', 'This workout has no exercises yet.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard workout', style: 'destructive', onPress: () => void cancelWorkout(true) },
      ]);
    }
    if (open === 0) return void finishNow();
    Alert.alert(
      `${open} set${open === 1 ? '' : 's'} not ticked`,
      done === 0 ? 'Nothing is ticked yet.' : 'Unticked sets are not saved.',
      [
        { text: 'Keep logging', style: 'cancel' },
        { text: 'Count the ones with numbers', onPress: () => void finishNow(true) },
        ...(done > 0 ? [{ text: 'Finish without them', onPress: () => void finishNow() }] : []),
      ],
    );
  };

  async function cancelWorkout(skipConfirm = false) {
    const run = async () => {
      setBusy(true);
      try {
        await session().discard();
        router.back();
      } catch (e) {
        notifyError(e, 'Could not discard');
        setBusy(false);
      }
    };
    if (skipConfirm) return run();
    Alert.alert(live ? 'Cancel workout?' : 'Close without saving?', live ? 'Everything logged in this workout will be deleted.' : 'Your edits will be lost.', [
      { text: 'Keep going', style: 'cancel' },
      { text: live ? 'Delete workout' : 'Discard edits', style: 'destructive', onPress: run },
    ]);
  }

  const deleteWorkout = () =>
    Alert.alert('Delete workout?', `"${workout.title}" and its sets will be removed from your history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await useWorkoutHistory.getState().remove(workout.id);
            await session().discard();
            router.replace('/(tabs)/body' as Href);
          } catch (e) {
            notifyError(e, 'Could not delete');
            setBusy(false);
          }
        },
      },
    ]);

  const goBack = () => {
    if (live) void session().flush();
    router.back();
  };

  const header = (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <View style={styles.stats}>
        <Stat label="Duration">
          {live ? (
            <ElapsedClock startedAt={workout.startedAt} style={[styles.statValue, { color: t.text }]} />
          ) : (
            <Text style={[styles.statValue, { color: t.text }]}>{formatDuration(workoutDurationSeconds(workout))}</Text>
          )}
        </Stat>
        <Stat label="Volume">
          <Text style={[styles.statValue, { color: t.text }]}>{formatVolume(volume, unit)}</Text>
        </Stat>
        <Stat label="Sets">
          <Text style={[styles.statValue, { color: t.text }]}>{done}</Text>
        </Stat>
      </View>
      <TextInput
        value={workout.notes}
        onChangeText={(notes) => session().setNotes(notes)}
        placeholder="Workout notes (optional)"
        placeholderTextColor={t.textDim}
        multiline
        style={[styles.notes, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
      />
    </View>
  );

  const footer = (
    <View style={{ gap: 10, marginTop: 4, paddingBottom: live ? 90 : 16 }}>
      <Pressable
        onPress={() => router.push('/exercises?pick=1&target=workout' as Href)}
        style={[styles.addEx, { backgroundColor: t.accentSoft }]}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={20} color={t.accent} />
        <Text style={{ color: t.accent, fontWeight: '800', fontSize: 16 }}>Add exercise</Text>
      </Pressable>
      {live ? (
        <Pressable onPress={() => cancelWorkout()} style={styles.dangerBtn}>
          <Text style={{ color: t.danger, fontWeight: '700' }}>Cancel workout</Text>
        </Pressable>
      ) : (
        <Pressable onPress={deleteWorkout} style={styles.dangerBtn}>
          <Text style={{ color: t.danger, fontWeight: '700' }}>Delete workout</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <Screen padBottom>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <Pressable onPress={goBack} hitSlop={12} accessibilityLabel={live ? 'Minimise workout' : 'Back'}>
            <Ionicons name={live ? 'chevron-down' : 'chevron-back'} size={28} color={t.text} />
          </Pressable>
          <TextInput
            value={workout.title}
            onChangeText={(title) => session().setTitle(title)}
            placeholder="Workout name"
            placeholderTextColor={t.textDim}
            maxLength={40}
            style={[styles.title, { color: t.text }]}
            returnKeyType="done"
          />
          <Pressable disabled={busy} onPress={live ? onFinish : () => void finishNow()} style={[styles.finish, { backgroundColor: t.accent, opacity: busy ? 0.5 : 1 }]}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>{live ? 'Finish' : 'Save'}</Text>
          </Pressable>
        </View>

        <ReorderableList
          data={workout.exercises}
          header={header}
          footer={footer}
          contentContainerStyle={{ paddingBottom: 16 }}
          onReorder={(ids) => session().reorderExercises(ids)}
          empty={<Text style={{ color: t.textDim, marginBottom: 12 }}>No exercises yet. Add one to start logging.</Text>}
          renderItem={(e, drag) => {
            const i = workout.exercises.findIndex((x) => x.id === e.id);
            const mine = prs.filter((p) => p.exerciseId === e.exerciseId);
            return (
              <WorkoutExerciseCard
                exercise={e}
                def={defs.get(e.exerciseId)}
                badge={badges[i] ?? null}
                canLinkNext={i >= 0 && i < workout.exercises.length - 1}
                unit={unit}
                plates={plates}
                history={perExercise[e.exerciseId] ?? []}
                templateId={workout.templateId}
                prSig={encodePRs(mine)}
                live={live}
                drag={drag}
                onReplace={(exId) => router.push(`/exercises?pick=1&target=replace&exId=${exId}` as Href)}
              />
            );
          }}
        />

        {live && (
          <View style={styles.rest} pointerEvents="box-none">
            <RestTimerBar />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={{ color: t.textDim, fontSize: 12 }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', paddingVertical: 6 },
  finish: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800' },
  notes: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, minHeight: 40 },
  addEx: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.lg },
  dangerBtn: { alignItems: 'center', paddingVertical: 12 },
  rest: { position: 'absolute', left: 0, right: 0, bottom: 8 },
});
