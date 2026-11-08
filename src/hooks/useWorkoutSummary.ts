import { useEffect, useMemo, useState } from 'react';
import { sqliteWorkoutRepo } from '@/data/sqliteWorkoutLogRepository';
import { exerciseMap } from '@/domain/exerciseCatalog';
import { summarize, type WorkoutSummary } from '@/domain/summary';
import { weightOn } from '@/domain/weight';
import type { Workout } from '@/domain/workout';
import { useUnitStore } from '@/store/useUnitStore';
import { useWeightStore } from '@/store/useWeightStore';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';

/** Loads a finished workout and works out its totals and PRs against the workouts before it. */
export function useWorkoutSummary(id: string | undefined, reloadKey: unknown = null) {
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined); // undefined = loading, null = missing
  const [history, setHistory] = useState<Workout[]>([]);
  const customs = useWorkoutLibraryStore((s) => s.customs);
  const weights = useWeightStore((s) => s.entries);
  const warmupVolume = useUnitStore((s) => s.warmupVolume);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return alive && setWorkout(null);
      const w = await sqliteWorkoutRepo.get(id);
      if (!alive) return;
      setWorkout(w);
      if (w) setHistory(await sqliteWorkoutRepo.listForExercises([...new Set(w.exercises.map((e) => e.exerciseId))]));
    })().catch(() => alive && setWorkout(null));
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  const summary: WorkoutSummary | null = useMemo(() => {
    if (!workout) return null;
    const defs = exerciseMap(customs);
    return summarize(workout, history, (e) => defs.get(e)?.type, { includeWarmup: warmupVolume, bodyweightKg: weightOn(weights, workout.date) });
  }, [workout, history, customs, weights, warmupVolume]);

  return { workout, summary };
}
