import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { WeightPanel } from '@/components/WeightPanel';
import { WorkoutsPanel } from '@/components/workouts/WorkoutsPanel';
import { useWorkoutFocus } from '@/store/useWorkoutFocus';
import { useTheme } from '@/theme';

type Section = 'workouts' | 'weight';

export default function BodyScreen() {
  const t = useTheme();
  const highlightId = useWorkoutFocus((s) => s.highlightId);
  // A just-finished workout forces Workouts until the user picks a section; the highlight is dropped when leaving the tab.
  const [manual, setManual] = useState<{ value: Section; at: string | null }>({ value: 'workouts', at: null });
  const section = highlightId && manual.at !== highlightId ? 'workouts' : manual.value;
  const setSection = (value: Section) => setManual({ value, at: highlightId });
  useFocusEffect(useCallback(() => () => useWorkoutFocus.getState().clear(), []));
  return (
    <Screen>
      <Text style={[styles.title, { color: t.text }]}>Body</Text>
      <Segmented
        options={[
          { value: 'workouts', label: 'Workouts' },
          { value: 'weight', label: 'Weight logging' },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === 'workouts' ? <WorkoutsPanel /> : <WeightPanel />}
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 34, fontWeight: '800', marginBottom: 12 } });
