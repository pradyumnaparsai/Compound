import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { patternFor } from '@/domain/poses';
import type { ExerciseDef } from '@/domain/workout';
import { useTheme } from '@/theme';
import { PoseFigure } from './PoseFigure';

/** Circular looping animation of the movement (original stick figure); a dumbbell icon when there is none. */
export function ExerciseThumb({
  def,
  size = 44,
  onPress,
}: {
  def: Pick<ExerciseDef, 'id' | 'title' | 'primaryMuscle'> | undefined;
  size?: number;
  onPress?: () => void;
}) {
  const t = useTheme();
  const pattern = def ? patternFor(def.id, def.primaryMuscle) : null;
  const body = (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.accentSoft }]}>
      {pattern ? (
        <PoseFigure pattern={pattern} size={size} body={t.accent} dim={t.textDim} />
      ) : (
        <Ionicons name="barbell-outline" size={size * 0.5} color={t.textDim} />
      )}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="imagebutton" accessibilityLabel={`${def?.title ?? 'Exercise'} form`}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({ circle: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } });
