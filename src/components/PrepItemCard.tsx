import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { popFrom } from '@/components/popFrom';
import { itemProgress } from '@/domain/prep';
import type { PrepItem, PrepKind } from '@/domain/prepPlan';
import { radius, useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const KIND: Record<PrepKind, { label: string; icon: IconName }> = {
  dsa: { label: 'DSA', icon: 'code-slash-outline' },
  lld: { label: 'LLD', icon: 'construct-outline' },
  hld: { label: 'HLD', icon: 'git-network-outline' },
  fundamentals: { label: 'Fundamentals', icon: 'book-outline' },
  project: { label: 'Project', icon: 'briefcase-outline' },
  behavioral: { label: 'Behavioral', icon: 'chatbubbles-outline' },
  mock: { label: 'Mock', icon: 'timer-outline' },
  recruiting: { label: 'Recruiting', icon: 'paper-plane-outline' },
  review: { label: 'Review', icon: 'refresh-outline' },
};

type Props = {
  item: PrepItem;
  checked: ReadonlySet<string>;
  onToggleItem: () => void;
  onToggleStep: (stepId: string) => void;
  /** e.g. "Carried over from Nov 16". */
  sub?: string;
};

function Box({ done, size = 24, boxRef }: { done: boolean; size?: number; boxRef?: React.Ref<ComponentRef<typeof View>> }) {
  const t = useTheme();
  return (
    <View
      ref={boxRef}
      style={[
        styles.check,
        { width: size, height: size, borderColor: done ? t.success : t.textDim, backgroundColor: done ? t.success : 'transparent' },
      ]}
    >
      {done && <Ionicons name="checkmark" size={size - 8} color={t.bg} />}
    </View>
  );
}

export function PrepItemCard({ item, checked, onToggleItem, onToggleStep, sub }: Props) {
  const t = useTheme();
  const boxRef = useRef<ComponentRef<typeof View>>(null);
  const { done: n, total } = itemProgress(item, checked);
  const done = n === total;
  const kind = KIND[item.kind];
  const hasSteps = item.steps.length > 0;

  const tick = (wasDone: boolean, ref: ComponentRef<typeof View> | null) => {
    Haptics.impactAsync(wasDone ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!wasDone) popFrom(ref);
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: done ? t.successSoft : t.surface, borderColor: done ? t.success : t.border },
      ]}
    >
      <Pressable
        onPress={() => {
          tick(done, boxRef.current);
          onToggleItem();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={item.title}
        style={({ pressed }) => [styles.head, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Box done={done} boxRef={boxRef} />
        <View style={{ flex: 1 }}>
          <View style={styles.meta}>
            <Ionicons name={kind.icon} size={13} color={t.accent} />
            <Text style={[styles.kind, { color: t.accent }]}>{kind.label}</Text>
            {item.badge ? <Text style={[styles.badge, { color: t.textDim }]}>· {item.badge}</Text> : null}
            {hasSteps ? <Text style={[styles.badge, { color: t.textDim }]}>· {n}/{total}</Text> : null}
          </View>
          <Text
            style={[styles.title, { color: t.text, textDecorationLine: done ? 'line-through' : 'none', opacity: done ? 0.7 : 1 }]}
          >
            {item.title}
          </Text>
          {item.detail ? <Text style={[styles.detail, { color: t.textDim }]}>{item.detail}</Text> : null}
          {sub ? <Text style={[styles.detail, { color: t.accent }]}>{sub}</Text> : null}
        </View>
      </Pressable>

      {hasSteps && (
        <View style={[styles.steps, { borderTopColor: t.border }]}>
          {item.steps.map((s) => {
            const on = checked.has(s.id);
            return (
              <StepRow
                key={s.id}
                title={s.title}
                on={on}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onToggleStep(s.id);
                }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

function StepRow({ title, on, onPress }: { title: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={title}
      style={({ pressed }) => [styles.step, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Box done={on} size={20} />
      <Text style={[styles.stepText, { color: t.text, textDecorationLine: on ? 'line-through' : 'none', opacity: on ? 0.6 : 1 }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  check: { borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' },
  kind: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  steps: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4, paddingLeft: 50, paddingRight: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  stepText: { flex: 1, fontSize: 14 },
});
