import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { animateSpring, useMotionSettings } from '@/motion';
import type { TabName } from '@/navigation/routes';

export interface IndicatorTrack {
  /** Feed every item's `onLayout` here. */
  onItemLayout(name: TabName, event: LayoutChangeEvent): void;
  /** The active item's frame, once measured. */
  readonly frame: LayoutRectangle | null;
  readonly x: SharedValue<number>;
  readonly y: SharedValue<number>;
  readonly width: SharedValue<number>;
  readonly height: SharedValue<number>;
}

/**
 * Drives the travelling active indicator of the bar and the rail (04_mobile_specs §7.5 M-MB-01):
 * it measures the items and moves the indicator to the active one with the `indicator` spring
 * (03M §2.3; proof mode ×10; reduced motion jumps). The first placement never animates, so the
 * indicator does not fly in from the corner on mount or after a chrome swap.
 */
export function useIndicatorTrack(active: TabName | null): IndicatorTrack {
  const motion = useMotionSettings();
  const [frames, setFrames] = useState<Partial<Record<TabName, LayoutRectangle>>>({});
  const placed = useRef(false);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  const onItemLayout = useCallback((name: TabName, event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setFrames((current) => {
      const prev = current[name];
      if (prev && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height) {
        return current;
      }
      return { ...current, [name]: next };
    });
  }, []);

  const frame = active ? (frames[active] ?? null) : null;

  useEffect(() => {
    if (frame === null) return;
    if (!placed.current) {
      placed.current = true;
      x.set(frame.x);
      y.set(frame.y);
      width.set(frame.width);
      height.set(frame.height);
      return;
    }
    x.set(animateSpring(frame.x, 'indicator', motion));
    y.set(animateSpring(frame.y, 'indicator', motion));
    width.set(animateSpring(frame.width, 'indicator', motion));
    height.set(animateSpring(frame.height, 'indicator', motion));
  }, [frame, motion, x, y, width, height]);

  return { onItemLayout, frame, x, y, width, height };
}
