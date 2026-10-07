import { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';
import { slowSpringTiming, useMotionSettings, type MotionSettings } from '@/motion';
import type { TabName } from '@/navigation/routes';

/** One trip of the indicator between two items (full motion only). `id` keys the travelling copy. */
export interface IndicatorTravel {
  readonly from: LayoutRectangle;
  readonly to: LayoutRectangle;
  readonly id: number;
}

export interface IndicatorTrack {
  /** Feed every item's `onLayout` here. */
  onItemLayout(name: TabName, event: LayoutChangeEvent): void;
  /**
   * The active item's frame, once measured: where the indicator SETTLES. The bar and the rail draw
   * the settled indicator from it with plain React styles, so its final place never depends on a
   * UI-thread update.
   */
  readonly frame: LayoutRectangle | null;
  /** While the indicator travels to a new item: the trip its travelling copy animates; null when settled. */
  readonly travel: IndicatorTravel | null;
}

/**
 * How long a trip may take before a React commit ends it, whatever the UI thread did: the
 * `indicator` spring (380/36/1, ζ ≈ 0.92) is at rest well inside 600 ms; proof mode runs the trip as
 * `slowSpringTiming` (×10).
 */
export const INDICATOR_TRAVEL_MS = 600;

export function indicatorTravelBudgetMs(m: MotionSettings): number {
  return m.slow ? (slowSpringTiming().duration ?? INDICATOR_TRAVEL_MS * 10) + 100 : INDICATOR_TRAVEL_MS;
}

function sameFrame(a: LayoutRectangle | null, b: LayoutRectangle | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Drives the travelling active indicator of the bar and the rail (04_mobile_specs §7.5 M-MB-01).
 *
 * E-fix row FX-M2b (E2E-P-1, E2E-T-2; decision D201): the indicator used to be ONE animated view
 * whose place was a UI-thread transform. On the phone (90a) and on the tablet (12_devices_blank) the
 * transform update of a tab switch was lost: the label had moved to the new tab, the indicator stayed
 * on the old one. Now the settled indicator is drawn by React at `frame`, and a trip is only an
 * overlay: the travelling copy (`IndicatorTravelLayer`) animates from the old frame to the new one
 * with the `indicator` spring (proof mode ×10) and a React commit removes it after
 * `indicatorTravelBudgetMs`, so the settled indicator shows at the right place even if every UI-thread
 * update of the trip was lost. The first placement never travels (no flight from the corner on mount
 * or after a chrome swap), and reduced motion jumps (no trip at all).
 */
export function useIndicatorTrack(active: TabName | null): IndicatorTrack {
  const motion = useMotionSettings();
  const [frames, setFrames] = useState<Partial<Record<TabName, LayoutRectangle>>>({});

  const onItemLayout = useCallback((name: TabName, event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setFrames((current) => {
      const prev = current[name];
      if (prev && sameFrame(prev, next)) return current;
      return { ...current, [name]: next };
    });
  }, []);

  const frame = active ? (frames[active] ?? null) : null;

  // A new settled frame starts a trip from the previous one (adjusted during render, no effect).
  const [placed, setPlaced] = useState<LayoutRectangle | null>(frame);
  const [travel, setTravel] = useState<IndicatorTravel | null>(null);
  if (!sameFrame(placed, frame)) {
    setPlaced(frame);
    setTravel(placed !== null && frame !== null && motion.policy !== 'reduced' ? { from: placed, to: frame, id: (travel?.id ?? 0) + 1 } : null);
  }

  // The trip ends on a React commit after its budget, whether or not the UI thread animated it.
  useEffect(() => {
    if (travel === null) return undefined;
    const timer = setTimeout(() => setTravel((current) => (current?.id === travel.id ? null : current)), indicatorTravelBudgetMs(motion));
    return () => clearTimeout(timer);
  }, [travel, motion]);

  return { onItemLayout, frame, travel };
}
