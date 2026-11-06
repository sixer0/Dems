import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { animateSpring, useMotionSettings } from '@/motion';

/** A place of the indicator inside its list, in the list's coordinates (dp). */
export interface IndicatorBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface IndicatorTravelLayerProps {
  readonly from: IndicatorBox;
  readonly to: IndicatorBox;
  /** The look of the indicator, positioned at the list's top left (`position: 'absolute', top: 0, left: 0`). */
  readonly style: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly children?: ReactNode;
}

/**
 * The travelling copy of the bar's pill or of the rail's card for ONE trip (E-fix row FX-M2b;
 * E2E-P-1, E2E-T-2). Mounted per trip (keyed by the trip's id) at the old place and moved to the new
 * one with the `indicator` spring on the UI thread. It decides nothing about the final state: the
 * settled indicator under it is drawn by React, and `useIndicatorTrack` unmounts this copy after
 * the trip's budget, so a lost UI-thread update can only shorten the motion, never leave the
 * indicator on the old tab.
 */
export function IndicatorTravelLayer({ from, to, style, testID, children }: IndicatorTravelLayerProps) {
  const motion = useMotionSettings();
  const x = useSharedValue(from.x);
  const y = useSharedValue(from.y);
  const width = useSharedValue(from.width);
  const height = useSharedValue(from.height);

  useEffect(() => {
    x.set(animateSpring(to.x, 'indicator', motion));
    y.set(animateSpring(to.y, 'indicator', motion));
    width.set(animateSpring(to.width, 'indicator', motion));
    height.set(animateSpring(to.height, 'indicator', motion));
  }, [to, motion, x, y, width, height]);

  const travelling = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
    width: width.get(),
    height: height.get(),
  }));

  return (
    <Animated.View pointerEvents="none" testID={testID} style={[style, travelling]}>
      {children}
    </Animated.View>
  );
}

/** The settled indicator's place as a plain React style (no UI-thread value). */
export function settledBoxStyle(box: IndicatorBox): ViewStyle {
  return { transform: [{ translateX: box.x }, { translateY: box.y }], width: box.width, height: box.height };
}
