import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { onFail } from '@/components/notify';
import { ProgressBar } from '@/components/ProgressBar';
import { ReorderableList } from '@/components/ReorderableList';
import { RoutineRow } from '@/components/RoutineRow';
import { Screen } from '@/components/Screen';
import { TaskAdder } from '@/components/TaskAdder';
import { TaskRow } from '@/components/TaskRow';
import { MONTH_NAMES, fromKey, todayKey } from '@/domain/date';
import { completionKey, currentStreak, scheduledOn } from '@/domain/recurrence';
import { overdueTasks, tasksOn } from '@/domain/task';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useTaskStore } from '@/store/useTaskStore';
import { radius, useTheme } from '@/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function TodayScreen() {
  const t = useTheme();
  const { routines, done, toggle, reorder, ready } = useRoutineStore();
  const { tasks, toggle: toggleTask, remove: removeTask, reschedule } = useTaskStore();
  const today = todayKey();

  // Open tasks first; done ones sink to the bottom (stable otherwise).
  const todayTasks = useMemo(
    () => [...tasksOn(tasks, today)].sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt)),
    [tasks, today],
  );
  const overdue = useMemo(() => overdueTasks(tasks, today), [tasks, today]);
  const hasTasks = todayTasks.length + overdue.length > 0;

  const scheduled = useMemo(() => scheduledOn(routines, today), [routines, today]);
  const doneCount = scheduled.filter((r) => done.has(completionKey(r.id, today))).length;
  const streak = useMemo(() => currentStreak(routines, done), [routines, done]);
  const d = fromKey(today);

  return (
    <Screen>
      <Text style={[styles.greet, { color: t.textDim }]}>{greeting()}</Text>
      <Text style={[styles.date, { color: t.text }]}>
        {MONTH_NAMES[d.getMonth()]} {d.getDate()}
      </Text>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={styles.cardTop}>
          <View>
            <Text style={[styles.big, { color: t.text }]}>
              {doneCount}
              <Text style={{ color: t.textDim }}> / {scheduled.length}</Text>
            </Text>
            <Text style={[styles.small, { color: t.textDim }]}>done today</Text>
          </View>
          <View style={[styles.streak, { backgroundColor: t.accentSoft }]}>
            <Ionicons name="flame" size={18} color={t.accent} />
            <Text style={[styles.streakText, { color: t.accent }]}>{streak} day streak</Text>
          </View>
        </View>
        <ProgressBar value={scheduled.length ? doneCount / scheduled.length : 0} />
      </View>

      <ReorderableList
        data={scheduled}
        contentContainerStyle={{ paddingBottom: 24 }}
        header={
          <View style={{ marginBottom: 8 }}>
            <Text style={[styles.section, { color: t.textDim }]}>Tasks for today</Text>
            <TaskAdder date={today} />
            {overdue.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                sub={`Overdue · was due ${MONTH_NAMES[fromKey(task.date).getMonth()].slice(0, 3)} ${fromKey(task.date).getDate()}`}
                onToggle={() => toggleTask(task.id).catch(onFail())}
                onDelete={() => removeTask(task.id).catch(onFail())}
                onMoveToToday={() => reschedule(task.id, today).catch(onFail())}
              />
            ))}
            {todayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id).catch(onFail())}
                onDelete={() => removeTask(task.id).catch(onFail())}
              />
            ))}
            {scheduled.length > 0 && <Text style={[styles.section, { color: t.textDim, marginTop: 12 }]}>Routines</Text>}
          </View>
        }
        onReorder={(ids) => reorder(ids).catch(onFail())}
        renderItem={(item, dragProps) => (
          <RoutineRow
            routine={item}
            date={today}
            done={done.has(completionKey(item.id, today))}
            onToggle={() => toggle(item.id, today).catch(onFail())}
            dragProps={dragProps}
          />
        )}
        empty={
          ready && !hasTasks ? (
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={40} color={t.textDim} />
              <Text style={[styles.emptyTitle, { color: t.text }]}>
                {routines.some((r) => !r.archivedAt) ? 'Nothing scheduled today' : 'No routines yet'}
              </Text>
              <Pressable
                onPress={() => router.push('/routine-form')}
                style={[styles.cta, { backgroundColor: t.accent }]}
              >
                <Text style={styles.ctaText}>Add a routine</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      />
      {scheduled.length > 1 && (
        <Text style={{ color: t.textDim, fontSize: 12, textAlign: 'center', paddingBottom: 12 }}>
          Long-press and drag to reorder
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  greet: { fontSize: 15, fontWeight: '500' },
  date: { fontSize: 34, fontWeight: '800', marginBottom: 16 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 18, gap: 16, marginBottom: 20 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  big: { fontSize: 36, fontWeight: '800' },
  small: { fontSize: 13 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  streakText: { fontWeight: '700', fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  cta: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.pill, marginTop: 4 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
