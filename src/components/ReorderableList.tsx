/* eslint-disable react-hooks/immutability -- `m` is a stable mutable gesture store, written only from gesture callbacks/effects, never read during render */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type DragProps = { onLongPress: () => void; onPressOut: () => void };

type Props<T extends { id: string }> = {
  data: T[];
  /** Spread `dragProps` onto a Pressable (onLongPress / onPressOut) to make the row draggable. */
  renderItem: (item: T, dragProps: DragProps) => ReactNode;
  /** New order of `data` ids after a drop. */
  onReorder: (ids: string[]) => void;
  empty?: ReactNode;
  /** Rendered above the rows inside the same scroll view (outside the drag gesture area). */
  header?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

const idle = { activeIndex: -1, over: -1, moved: false };

/**
 * Long-press a row, then drag it up/down. Rows may have different heights.
 * Pure RN (PanResponder + Animated) — no native dependencies.
 */
export function ReorderableList<T extends { id: string }>({
  data,
  renderItem,
  onReorder,
  empty,
  header,
  contentContainerStyle,
}: Props<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dy] = useState(() => new Animated.Value(0));
  // Mutable gesture bookkeeping, only touched from gesture callbacks and effects (never read in render).
  const [m] = useState(() => ({
    heights: new Map<string, number>(),
    shifts: new Map<string, Animated.Value>(),
    drag: { ...idle },
    data,
    onReorder,
  }));
  useLayoutEffect(() => {
    m.data = data;
    m.onReorder = onReorder;
  });

  const layoutOf = () => {
    const list = m.data;
    const hs = list.map((it) => m.heights.get(it.id) ?? 0);
    let acc = 0;
    const tops = hs.map((h) => {
      const top = acc;
      acc += h;
      return top;
    });
    return { list, hs, tops };
  };

  const applyShifts = (from: number, over: number) => {
    const { list, hs } = layoutOf();
    const h = hs[from] ?? 0;
    list.forEach((it, i) => {
      let target = 0;
      if (i !== from) {
        if (over > from && i > from && i <= over) target = -h;
        else if (over < from && i >= over && i < from) target = h;
      }
      Animated.spring(m.shifts.get(it.id) ?? new Animated.Value(0), { toValue: target, useNativeDriver: false, bounciness: 0, speed: 24 }).start();
    });
  };

  const finish = () => {
    const { activeIndex, over } = m.drag;
    m.drag = { ...idle };
    if (activeIndex < 0) return;
    const ids = m.data.map((it) => it.id);
    const [moved] = ids.splice(activeIndex, 1);
    ids.splice(over, 0, moved);
    setActiveId(null); // offsets are cleared in the layout effect, after the new order has rendered
    if (over !== activeIndex) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      m.onReorder(ids);
    }
  };

  const register = useCallback(
    (id: string, v: Animated.Value | null) => {
      if (v) m.shifts.set(id, v);
      else m.shifts.delete(id);
    },
    [m],
  );
  const onHeight = useCallback((id: string, h: number) => void m.heights.set(id, h), [m]);

  // Reset transforms only once the (re)ordered rows are committed, so a dropped row never snaps back.
  useLayoutEffect(() => {
    if (activeId !== null) return;
    dy.setValue(0);
    m.shifts.forEach((v) => {
      v.stopAnimation();
      v.setValue(0);
    });
  }, [activeId, data, dy, m]);

  const [pan] = useState(() =>
    PanResponder.create({
      // Takes over from the row's Pressable once a drag is active and the finger moves.
      onMoveShouldSetPanResponderCapture: () => {
        if (m.drag.activeIndex < 0) return false;
        m.drag.moved = true;
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const { activeIndex, over } = m.drag;
        if (activeIndex < 0) return;
        dy.setValue(g.dy);
        const { list, hs, tops } = layoutOf();
        const center = tops[activeIndex] + hs[activeIndex] / 2 + g.dy;
        let next = 0;
        list.forEach((_it, i) => {
          if (i !== activeIndex && tops[i] + hs[i] / 2 < center) next++;
        });
        if (next !== over) {
          m.drag.over = next;
          applyShifts(activeIndex, next);
          Haptics.selectionAsync().catch(() => {});
        }
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    }),
  );

  const begin = (id: string) => {
    const i = m.data.findIndex((it) => it.id === id);
    if (i < 0) return;
    m.drag = { activeIndex: i, over: i, moved: false };
    dy.setValue(0);
    setActiveId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  // Long-press released without moving: nothing to reorder. Deferred so a press-out caused by
  // the pan responder taking over (which marks `moved` first) isn't mistaken for a release.
  const pressOut = () =>
    requestAnimationFrame(() => {
      if (m.drag.activeIndex >= 0 && !m.drag.moved) finish();
    });

  return (
    <ScrollView
      scrollEnabled={activeId === null}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
    >
      {header}
      <View style={data.length === 0 ? styles.fill : undefined} {...pan.panHandlers}>
        {data.length === 0
          ? empty
          : data.map((item) => {
              const active = item.id === activeId;
              return (
                <Row
                  key={item.id}
                  id={item.id}
                  active={active}
                  dy={dy}
                  register={register}
                  onHeight={onHeight}
                >
                  {renderItem(item, { onLongPress: () => begin(item.id), onPressOut: pressOut })}
                </Row>
              );
            })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lifted: {
    zIndex: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});

type RowProps = {
  id: string;
  active: boolean;
  dy: Animated.Value;
  register: (id: string, shift: Animated.Value | null) => void;
  onHeight: (id: string, h: number) => void;
  children: ReactNode;
};

/** Owns its shift offset so the list can animate neighbours aside while another row is dragged. */
function Row({ id, active, dy, register, onHeight, children }: RowProps) {
  const [shift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    register(id, shift);
    return () => register(id, null);
  }, [id, shift, register]);
  return (
    <Animated.View
      onLayout={(e) => onHeight(id, e.nativeEvent.layout.height)}
      style={[active && styles.lifted, { transform: [{ translateY: active ? dy : shift }, { scale: active ? 1.01 : 1 }] }]}
    >
      {children}
    </Animated.View>
  );
}
