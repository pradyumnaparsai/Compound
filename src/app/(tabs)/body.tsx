import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { WeightPanel } from '@/components/WeightPanel';
import { HistoryPanel } from '@/components/workouts/HistoryPanel';
import { WorkoutsPanel } from '@/components/workouts/WorkoutsPanel';
import { useTheme } from '@/theme';

type Section = 'workouts' | 'history' | 'weight';

export default function BodyScreen() {
  const t = useTheme();
  const [section, setSection] = useState<Section>('workouts');
  return (
    <Screen>
      <Text style={[styles.title, { color: t.text }]}>Body</Text>
      <Segmented
        options={[
          { value: 'workouts', label: 'Workouts' },
          { value: 'history', label: 'History' },
          { value: 'weight', label: 'Weight' },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === 'workouts' ? <WorkoutsPanel /> : section === 'history' ? <HistoryPanel /> : <WeightPanel />}
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 34, fontWeight: '800', marginBottom: 12 } });
