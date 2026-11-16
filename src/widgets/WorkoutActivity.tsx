import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';
import type { WorkoutActivityProps } from '@/domain/workoutActivity';

// Runs in an isolated runtime: no hooks, no outer constants, props/environment only.
const WorkoutActivity = (props: WorkoutActivityProps) => {
  'widget';
  const { title, startedAt, setsDone, setsTotal } = props;
  const started = new Date(startedAt);
  const sets = setsTotal > 0 ? `${setsDone}/${setsTotal} sets` : 'In progress';
  const purple = '#7C5CFF';

  const clock = (size: number) => (
    <Text
      date={started}
      dateStyle="timer"
      modifiers={[font({ size, weight: 'bold' }), monospacedDigit(), foregroundStyle(purple)]}
    />
  );

  return {
    banner: (
      <HStack spacing={12}>
        <Image systemName="dumbbell.fill" size={26} color={purple} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 17, weight: 'bold' })]}>{title}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93')]}>{`Workout in progress · ${sets}`}</Text>
        </VStack>
        <Spacer />
        {clock(24)}
      </HStack>
    ),
    compactLeading: <Image systemName="dumbbell.fill" size={14} color={purple} />,
    compactTrailing: clock(13),
    minimal: <Image systemName="dumbbell.fill" size={14} color={purple} />,
    expandedLeading: <Image systemName="dumbbell.fill" size={28} color={purple} />,
    expandedTrailing: clock(22),
    expandedCenter: <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{title}</Text>,
    expandedBottom: (
      <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93')]}>{`Workout in progress · ${sets} · open Compound to finish`}</Text>
    ),
  };
};

export default createLiveActivity('WorkoutActivity', WorkoutActivity);
