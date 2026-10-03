/**
 * C-3 SessionTimeline (04_mobile_specs §4.0, §4.5 S1, §7.4 M-C-08; 03_motion_spec M-C-08, App. A).
 *
 * RN `View` rail with node dots, kit `Typography`, Reanimated entering and layout transitions.
 * First render: rows fade in with the R1 stagger. Insertion: the previous row's line segment grows
 * (`scaleY`, 320 ms `luxe`), the node pops (`bouncy`), the text rises 8 px (240 ms) and the newest
 * node's halo pulses twice, then rests. Older rows move with `LinearTransition`. Reduced: instant.
 */
import { Typography } from 'heroui-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { derived, motion as motionTokens, palette, toneHex } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media/color';
import {
  INSERT_BEATS,
  isInsertion,
  newestId,
  orderTimeline,
  timelineTime,
  type TimelineItem,
  type TimelineOrder,
} from './session-timeline.math';
import { staggerDelay } from './stepper.math';

export type { TimelineItem, TimelineOrder } from './session-timeline.math';

export interface SessionTimelineProps {
  items: readonly TimelineItem[];
  order?: TimelineOrder;
  /** Motion policy from `useMotionPolicy()` (04 §7.7). */
  motion: 'full' | 'reduced';
  emptyLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const LUXE = Easing.bezier(...motionTokens.easing.luxe);
const { gentle, bouncy } = motionTokens.spring;
const NODE = 10;
const RAIL = 22;

export function SessionTimeline({ items, order = 'oldest-first', motion, emptyLabel, style, testID }: SessionTimelineProps) {
  const reduced = motion === 'reduced';
  const [initialIds] = useState(() => new Set(items.map((i) => i.id)));
  const rows = orderTimeline(items, order);
  const newest = newestId(items);

  if (rows.length === 0) {
    return (
      <View testID={testID} style={style}>
        <Typography type="body-xs" color="muted">
          {emptyLabel ?? 'No events yet'}
        </Typography>
      </View>
    );
  }

  return (
    <View testID={testID} style={style} accessibilityRole="list">
      {rows.map((item, index) => (
        <TimelineRow
          key={item.id}
          item={item}
          index={index}
          hasNext={index < rows.length - 1}
          inserted={isInsertion(initialIds, item.id)}
          isNewest={item.id === newest}
          reduced={reduced}
          testID={testID ? `${testID}-row-${item.id}` : undefined}
        />
      ))}
    </View>
  );
}

interface TimelineRowProps {
  item: TimelineItem;
  index: number;
  hasNext: boolean;
  inserted: boolean;
  isNewest: boolean;
  reduced: boolean;
  testID?: string;
}

function TimelineRow({ item, index, hasNext, inserted, isNewest, reduced, testID }: TimelineRowProps) {
  const color = toneHex[item.tone ?? 'accent'];
  const animateIn = inserted && !reduced;

  const line = useSharedValue(hasNext ? 1 : 0);
  const node = useSharedValue(animateIn ? 0 : 1);
  const text = useSharedValue(animateIn ? 0 : 1);
  const halo = useSharedValue(0);

  // The segment below this node grows when a newer row arrives after it.
  useEffect(() => {
    const target = hasNext ? 1 : 0;
    line.set(reduced ? target : withTiming(target, { duration: INSERT_BEATS.line.duration, easing: LUXE }));
  }, [hasNext, reduced, line]);

  useEffect(() => {
    if (!animateIn) return;
    node.set(withDelay(INSERT_BEATS.node.delay, withSpring(1, bouncy)));
    text.set(withDelay(INSERT_BEATS.text.delay, withTiming(1, { duration: INSERT_BEATS.text.duration, easing: LUXE })));
  }, [animateIn, node, text]);

  useEffect(() => {
    if (!animateIn || !isNewest) return;
    halo.set(
      withDelay(
        INSERT_BEATS.halo.delay,
        withRepeat(withTiming(1, { duration: INSERT_BEATS.halo.period, easing: Easing.out(Easing.quad) }), INSERT_BEATS.halo.pulses, false),
      ),
    );
  }, [animateIn, isNewest, halo]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: line.get() }] }));
  const nodeStyle = useAnimatedStyle(() => ({ transform: [{ scale: node.get() }] }));
  const haloStyle = useAnimatedStyle(() => {
    const h = halo.get();
    return { opacity: h > 0 && h < 1 ? 0.55 * (1 - h) : 0, transform: [{ scale: 1 + 1.2 * h }] };
  });
  const textStyle = useAnimatedStyle(() => ({
    opacity: text.get(),
    transform: [{ translateY: (1 - text.get()) * INSERT_BEATS.text.rise }],
  }));

  return (
    <Animated.View
      testID={testID}
      entering={reduced || inserted ? undefined : FadeIn.duration(motionTokens.duration.base).delay(staggerDelay(index, 30))}
      layout={reduced ? undefined : LinearTransition.springify().stiffness(gentle.stiffness).damping(gentle.damping).mass(gentle.mass)}
      style={{ flexDirection: 'row' }}
      accessible
      accessibilityLabel={`${timelineTime(item.at)}, ${item.title}${item.detail ? `, ${item.detail}` : ''}`}
    >
      <View style={{ width: RAIL, alignItems: 'center' }}>
        <View style={{ width: NODE, height: NODE, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            pointerEvents="none"
            style={[styles.dot, { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: withAlpha(color, 0.6) }, haloStyle]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                width: NODE,
                height: NODE,
                borderRadius: NODE / 2,
                backgroundColor: color,
                borderWidth: 2,
                borderColor: withAlpha(palette.black, 0.6),
              },
              nodeStyle,
            ]}
          />
        </View>
        <Animated.View
          style={[{ width: 2, flex: 1, marginTop: 4, backgroundColor: derived.border, transformOrigin: 'top' }, lineStyle]}
        />
      </View>
      <Animated.View style={[{ flex: 1, paddingBottom: 14, gap: 2 }, textStyle]}>
        <Typography type="body-xs" color="muted" className="font-mono">
          {timelineTime(item.at)}
        </Typography>
        <Typography type="body-sm" weight="semibold">
          {item.title}
        </Typography>
        {item.detail ? (
          <Typography type="body-xs" color="muted">
            {item.detail}
          </Typography>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute' },
});
