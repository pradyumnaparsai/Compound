import { Gauge, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, gaugeStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { PlatformColor } from 'react-native';

export type RoutineWidgetProps = {
  done: number;
  total: number;
  next: string; // first unfinished routine title, '' if none
};

// Runs in an isolated runtime: no hooks, no outer constants, props/environment only.
const RoutineWidget = (props: RoutineWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const { done, total, next } = props;
  const allDone = total > 0 && done >= total;
  const bg = containerBackground(PlatformColor('systemBackground'), 'widget');

  if (environment.widgetFamily === 'accessoryInline') {
    return <Text>{total === 0 ? 'No routines today' : `${done}/${total} routines done`}</Text>;
  }

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[bg]}>
        <Text modifiers={[font({ size: 15, weight: 'bold' })]}>
          {total === 0 ? 'No routines today' : allDone ? 'All done today ✓' : `${done}/${total} done today`}
        </Text>
        <Text modifiers={[font({ size: 12 })]}>
          {total === 0 ? 'Enjoy the day' : allDone ? 'Nice work' : `Next: ${next}`}
        </Text>
      </VStack>
    );
  }

  // accessoryCircular (default)
  return (
    <HStack modifiers={[bg]}>
      <Gauge
        value={total === 0 ? 0 : Math.min(done / total, 1)}
        modifiers={[gaugeStyle('circularCapacity')]}
        currentValueLabel={<Text>{`${done}/${total}`}</Text>}
      />
    </HStack>
  );
};

export default createWidget('RoutineWidget', RoutineWidget, {
  done: 0,
  total: 0,
  next: '',
} as RoutineWidgetProps);
