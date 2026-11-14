import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { onFail } from '@/components/notify';
import { PrepDayRow } from '@/components/PrepDayRow';
import { RoutineRow } from '@/components/RoutineRow';
import { Screen } from '@/components/Screen';
import { TaskAdder } from '@/components/TaskAdder';
import { TaskRow } from '@/components/TaskRow';
import { YearView } from '@/components/YearView';
import { sqliteWorkoutRepo } from '@/data/sqliteWorkoutLogRepository';
import { MONTH_NAMES, WEEKDAY_LABELS, fromKey, monthGrid } from '@/domain/date';
import { useToday } from '@/hooks/useToday';
import { completionKey, dayStatus, scheduledOn } from '@/domain/recurrence';
import { taskCounts, tasksOn } from '@/domain/task';
import { useRoutineStore } from '@/store/useRoutineStore';
import { formatDuration, workoutDurationSeconds, type Workout } from '@/domain/workout';
import { useTaskStore } from '@/store/useTaskStore';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { radius, useTheme } from '@/theme';

export default function CalendarScreen() {
  const t = useTheme();
  const { routines, done, toggle } = useRoutineStore();
  const { tasks, toggle: toggleTask, remove: removeTask } = useTaskStore();
  const counts = useMemo(() => taskCounts(tasks), [tasks]);
  const workoutDates = useWorkoutHistory((s) => s.dates);
  const workoutDays = useMemo(() => new Set(workoutDates), [workoutDates]);
  const today = useToday();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(today);
  const [mode, setMode] = useState<'month' | 'year'>('month');

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const shift = (n: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const yearDoneDays = useMemo(() => {
    if (mode !== 'year') return 0; // only needed in year view; skip ~400 day lookups on first render
    let n = 0;
    for (let m = 0; m < 12; m++)
      for (const row of monthGrid(cursor.y, m))
        for (const key of row) if (key && dayStatus(routines, done, key) === 'all') n++;
    return n;
  }, [mode, cursor.y, routines, done]);

  const selectedRoutines = scheduledOn(routines, selected);
  const selectedTasks = tasksOn(tasks, selected);
  const sel = fromKey(selected);

  // Workouts on the selected day (the badge set above only knows which days have one).
  const [dayWorkouts, setDayWorkouts] = useState<Workout[]>([]);
  useEffect(() => {
    let alive = true;
    sqliteWorkoutRepo
      .listByDate(selected)
      .then((w) => alive && setDayWorkouts(w))
      .catch(() => alive && setDayWorkouts([]));
    return () => {
      alive = false;
    };
  }, [selected, workoutDates]);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.seg, { backgroundColor: t.surfaceAlt }]}>
          {(['month', 'year'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.segItem, mode === m && { backgroundColor: t.accent }]}
            >
              <Text style={{ color: mode === m ? '#fff' : t.textDim, fontWeight: '700', textTransform: 'capitalize' }}>
                {m}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'year' ? (
          <>
            <View style={styles.header}>
              <Pressable onPress={() => setCursor((c) => ({ ...c, y: c.y - 1 }))} hitSlop={12}>
                <Ionicons name="chevron-back" size={24} color={t.text} />
              </Pressable>
              <Text style={[styles.month, { color: t.text }]}>{cursor.y}</Text>
              <Pressable onPress={() => setCursor((c) => ({ ...c, y: c.y + 1 }))} hitSlop={12}>
                <Ionicons name="chevron-forward" size={24} color={t.text} />
              </Pressable>
            </View>
            <Text style={{ color: t.textDim, marginBottom: 12, textAlign: 'center' }}>
              {yearDoneDays} fully completed {yearDoneDays === 1 ? 'day' : 'days'} in {cursor.y}
            </Text>
            <YearView
              year={cursor.y}
              routines={routines}
              done={done}
              onPickMonth={(m) => {
                setCursor((c) => ({ ...c, m }));
                setMode('month');
              }}
            />
            <View style={styles.legend}>
              <Legend color={t.success} label="All done" t={t} />
              <Legend color={t.successSoft} label="Partial" t={t} />
              <Legend color={t.surfaceAlt} label="Missed" t={t} />
            </View>
          </>
        ) : (
          <>
        <View style={styles.header}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={t.text} />
          </Pressable>
          <Text style={[styles.month, { color: t.text }]}>
            {MONTH_NAMES[cursor.m]} {cursor.y}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={12}>
            <Ionicons name="chevron-forward" size={24} color={t.text} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAY_LABELS.map((l, i) => (
            <Text key={i} style={[styles.weekLabel, { color: t.textDim }]}>{l}</Text>
          ))}
        </View>

        {grid.map((row, ri) => (
          <View key={ri} style={styles.weekRow}>
            {row.map((key, ci) => {
              if (!key) return <View key={ci} style={styles.cell} />;
              const status = dayStatus(routines, done, key);
              const isToday = key === today;
              const isSel = key === selected;
              const bg =
                status === 'all' ? t.success : status === 'partial' ? t.successSoft : 'transparent';
              const fg = status === 'all' ? t.bg : t.text;
              return (
                <Pressable key={ci} style={styles.cell} onPress={() => setSelected(key)}>
                  <View
                    style={[
                      styles.day,
                      {
                        backgroundColor: bg,
                        borderColor: isSel ? t.accent : isToday ? t.textDim : 'transparent',
                        borderWidth: isSel || isToday ? 2 : 0,
                      },
                    ]}
                  >
                    <Text style={{ color: fg, fontWeight: status === 'all' ? '800' : '500', fontSize: 15 }}>
                      {Number(key.slice(8))}
                    </Text>
                    {workoutDays.has(key) && (
                      <Ionicons name="barbell" size={10} color={status === 'all' ? t.bg : '#F5B800'} style={styles.workoutBadge} />
                    )}
                    {counts.get(key) && (
                      <View
                        style={[
                          styles.taskDot,
                          { backgroundColor: counts.get(key)!.open > 0 ? t.accent : t.textDim },
                        ]}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.legend}>
          <Legend color={t.success} label="All done" t={t} />
          <Legend color={t.successSoft} label="Partial" t={t} />
          <Legend color={t.accent} label="Task due" t={t} />
          <View style={styles.legendItem}>
            <Ionicons name="barbell" size={12} color="#F5B800" />
            <Text style={{ color: t.textDim, fontSize: 12 }}>Workout</Text>
          </View>
        </View>

        <Text style={[styles.selTitle, { color: t.text }]}>
          {MONTH_NAMES[sel.getMonth()]} {sel.getDate()}
        </Text>
        {dayWorkouts.length > 0 && (
          <>
            <Text style={[styles.section, { color: t.textDim }]}>Workouts</Text>
            {dayWorkouts.map((w) => (
              <Pressable
                key={w.id}
                onPress={() => router.push(`/workout-detail?id=${w.id}` as Href)}
                style={[styles.workoutRow, { backgroundColor: t.surface, borderColor: t.border }]}
              >
                <Ionicons name="barbell" size={20} color="#F5B800" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{w.title}</Text>
                  <Text style={{ color: t.textDim, fontSize: 12 }}>
                    {formatDuration(workoutDurationSeconds(w))} · {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.textDim} />
              </Pressable>
            ))}
            <View style={{ height: 12 }} />
          </>
        )}
        <PrepDayRow date={selected} />
        <Text style={[styles.section, { color: t.textDim }]}>Tasks</Text>
        <TaskAdder date={selected} placeholder={`Add a task for ${MONTH_NAMES[sel.getMonth()].slice(0, 3)} ${sel.getDate()}…`} />
        {selectedTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={() => toggleTask(task.id).catch(onFail())}
            onDelete={() => removeTask(task.id).catch(onFail())}
          />
        ))}

        <Text style={[styles.section, { color: t.textDim, marginTop: 12 }]}>Routines</Text>
        {selectedRoutines.length === 0 ? (
          <Text style={{ color: t.textDim }}>No routines scheduled.</Text>
        ) : (
          selectedRoutines.map((r) => (
            <RoutineRow
              key={r.id}
              routine={r}
              date={selected}
              done={done.has(completionKey(r.id, selected))}
              disabled={selected > today}
              onToggle={() => toggle(r.id, selected).catch(onFail())}
            />
          ))
        )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Legend({ color, label, t }: { color: string; label: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color, borderColor: t.border }]} />
      <Text style={{ color: t.textDim, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', borderRadius: radius.pill, padding: 3, marginBottom: 16 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  month: { fontSize: 22, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cell: { flex: 1, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: 16, marginVertical: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  workoutBadge: { position: 'absolute', top: 3, right: 4 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
  taskDot: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3 },
  selTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});
