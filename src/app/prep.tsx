import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { onFail } from '@/components/notify';
import { PrepItemCard } from '@/components/PrepItemCard';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { MONTH_NAMES, addDays, dayTitle, fromKey, isDateKey } from '@/domain/date';
import { agendaFor, agendaProgress, clampToPlan, dayStatus, prepStreak, studyDayPosition } from '@/domain/prep';
import { PREP_END, PREP_START } from '@/domain/prepPlan';
import { usePrepEnabled } from '@/hooks/usePrepEnabled';
import { useToday } from '@/hooks/useToday';
import { celebrate } from '@/store/useCelebration';
import { usePrepStore } from '@/store/usePrepStore';
import { radius, useTheme } from '@/theme';

const short = (key: string) => `${MONTH_NAMES[fromKey(key).getMonth()].slice(0, 3)} ${fromKey(key).getDate()}`;

export default function PrepScreen() {
  const t = useTheme();
  const enabled = usePrepEnabled();
  const today = useToday();
  const { checked, toggleItem, toggleStep } = usePrepStore();
  // Opened from the calendar with ?date=YYYY-MM-DD; otherwise it starts on today.
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const [picked, setPicked] = useState<string | null>(() => (isDateKey(dateParam) ? clampToPlan(dateParam) : null));
  const date = picked ?? clampToPlan(today);

  const agenda = useMemo(() => agendaFor(date, today, checked), [date, today, checked]);
  const progress = useMemo(() => agendaProgress(agenda, checked), [agenda, checked]);
  const streak = useMemo(() => prepStreak(today, checked), [today, checked]);
  const pos = useMemo(() => studyDayPosition(date), [date]);
  const day = agenda.day;
  const rest = !!day && dayStatus(day, checked) === 'rest';

  // Big celebration when ticking the last item of the day flips the goal to complete.
  const prev = useRef<{ date: string; complete: boolean } | null>(null);
  useEffect(() => {
    if (prev.current?.date === date && !prev.current.complete && progress.complete) celebrate('big');
    prev.current = { date, complete: progress.complete };
  }, [date, progress.complete]);

  if (!enabled) return <Redirect href="/" />; // personal feature; also guards a stray deep link

  const go = (n: number) => setPicked(clampToPlan(addDays(date, n)));
  const canPrev = date > PREP_START;
  const canNext = date < PREP_END;
  const tone = progress.complete ? t.success : t.accent;

  return (
    <Screen padBottom>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>Switch prep</Text>
        {date !== clampToPlan(today) ? (
          <Pressable onPress={() => setPicked(null)} hitSlop={12}>
            <Text style={{ color: t.accent, fontWeight: '700' }}>Today</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={styles.nav}>
        <Pressable onPress={() => go(-1)} disabled={!canPrev} hitSlop={12} accessibilityLabel="Previous day">
          <Ionicons name="chevron-back-circle-outline" size={30} color={canPrev ? t.text : t.border} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.dayTitle, { color: t.text }]}>{dayTitle(date, today)}</Text>
          <Text style={{ color: t.textDim, fontSize: 13 }}>{short(date)}</Text>
        </View>
        <Pressable onPress={() => go(1)} disabled={!canNext} hitSlop={12} accessibilityLabel="Next day">
          <Ionicons name="chevron-forward-circle-outline" size={30} color={canNext ? t.text : t.border} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {day && (
          <View
            style={[
              styles.summary,
              { backgroundColor: progress.complete ? t.successSoft : t.surface, borderColor: progress.complete ? t.success : t.border },
            ]}
          >
            <View style={styles.summaryTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.focus, { color: t.text }]}>{day.focus}</Text>
                <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
                  {day.week ? `Week ${day.week} · ` : ''}
                  {rest ? 'No catch-up' : `Study day ${pos.n} of ${pos.total}`}
                </Text>
              </View>
              {streak > 0 && (
                <View style={[styles.streak, { backgroundColor: t.accentSoft }]}>
                  <Ionicons name="flame" size={16} color={t.accent} />
                  <Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>{streak} day streak</Text>
                </View>
              )}
            </View>
            {!rest && (
              <>
                <ProgressBar value={progress.fraction} color={tone} />
                <Text style={{ color: progress.complete ? t.success : t.textDim, fontSize: 13, fontWeight: '600' }}>
                  {progress.complete ? (date === today ? "Today's goal complete" : 'Day complete') : `${progress.done} of ${progress.total} done`}
                </Text>
              </>
            )}
          </View>
        )}

        {!day && (
          <Text style={{ color: t.textDim, textAlign: 'center', marginTop: 40 }}>Nothing planned for this day.</Text>
        )}

        {rest && (
          <View style={styles.rest}>
            <Ionicons name="moon-outline" size={40} color={t.textDim} />
            <Text style={{ color: t.text, fontSize: 18, fontWeight: '600' }}>Rest day</Text>
            <Text style={{ color: t.textDim, textAlign: 'center' }}>Nothing planned and nothing to catch up on.</Text>
          </View>
        )}

        {agenda.carried.length > 0 && (
          <>
            <Text style={[styles.section, { color: t.textDim }]}>Carried over</Text>
            {agenda.carried.map(({ item, from }) => (
              <PrepItemCard
                key={item.id}
                item={item}
                checked={checked}
                sub={`From ${dayTitle(from, today)} · ${short(from)}`}
                onToggleItem={() => toggleItem(item).catch(onFail())}
                onToggleStep={(id) => toggleStep(id).catch(onFail())}
              />
            ))}
          </>
        )}

        {agenda.own.length > 0 && (
          <>
            {agenda.carried.length > 0 && (
              <Text style={[styles.section, { color: t.textDim, marginTop: 12 }]}>{date === today ? 'Planned for today' : 'Planned'}</Text>
            )}
            {agenda.own.map((item) => (
              <PrepItemCard
                key={item.id}
                item={item}
                checked={checked}
                onToggleItem={() => toggleItem(item).catch(onFail())}
                onToggleStep={(id) => toggleStep(id).catch(onFail())}
              />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dayTitle: { fontSize: 24, fontWeight: '800' },
  summary: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 12, marginBottom: 16 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  focus: { fontSize: 17, fontWeight: '700' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  rest: { alignItems: 'center', gap: 8, paddingVertical: 32 },
});
