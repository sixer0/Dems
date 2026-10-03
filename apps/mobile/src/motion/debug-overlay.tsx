/**
 * `?debug=1` performance overlay (04_mobile_specs §3.5, §7.8; 03_motion_spec §9.5; MA-17).
 *
 * Shows, once per second: UI-thread fps (`useFrameCallback`, the primary figure because `gfxinfo`
 * may under-count Skia surfaces, H-MB-07), JS fps (`requestAnimationFrame`), meter frames per
 * second per channel (`reportMeterFrame`), the running ambient loops (`useAmbientLoop`
 * registrations, cap 4) and the motion policy with its reasons.
 *
 * It renders nothing and measures nothing unless the overlay flag is on (`?debug=1` on any deep
 * link, or Settings → Performance overlay). It ignores touches and is hidden from accessibility
 * services. Its text re-renders at 1 Hz; the fps counters themselves never cause React renders.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useStore } from 'zustand';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { drainMeterFrames, fpsFromWindow, setMeterFrameCounting } from './debug-metrics';
import { AMBIENT_LOOP_CAP, loopRegistry } from './loops';
import { useMotionSettings, useMotionState, useReducedReasons } from './use-motion-policy';

const WINDOW_MS = 1000;

export interface MotionDebugOverlayProps {
  /** Top offset in px; default the initial safe-area top inset plus 8. */
  top?: number;
}

/** Mounted by `MotionPolicyProvider`; renders only while the overlay flag is on. */
export function MotionDebugOverlay({ top }: MotionDebugOverlayProps) {
  const enabled = useMotionState((s) => s.debugOverlay);
  if (!enabled) return null;
  return <DebugPanel top={top ?? (initialWindowMetrics?.insets.top ?? 0) + spacing[1]} />;
}

interface JsStats {
  jsFps: number;
  meters: Record<string, number>;
}

function DebugPanel({ top }: { top: number }) {
  const [uiFps, setUiFps] = useState(0);
  const [stats, setStats] = useState<JsStats>({ jsFps: 0, meters: {} });
  const loops = useStore(loopRegistry, (s) => s.loops);
  const { policy, slow } = useMotionSettings();
  const reasons = useReducedReasons();

  // UI-thread frame rate: counted in a worklet, published to React once per window.
  const frames = useSharedValue(0);
  const windowStart = useSharedValue(-1);
  useFrameCallback((info) => {
    'worklet';
    const now = info.timestamp;
    const start = windowStart.get();
    if (start < 0) {
      windowStart.set(now);
      frames.set(0);
      return;
    }
    frames.set(frames.get() + 1);
    const elapsed = now - start;
    if (elapsed >= WINDOW_MS) {
      scheduleOnRN(setUiFps, fpsFromWindow(frames.get(), elapsed));
      frames.set(0);
      windowStart.set(now);
    }
  });

  // JS-thread frame rate and meter frames, sampled once per window.
  useEffect(() => {
    let jsFrames = 0;
    let alive = true;
    let raf = 0;
    const onFrame = () => {
      jsFrames += 1;
      if (alive) raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);
    setMeterFrameCounting(true);
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      setStats({ jsFps: fpsFromWindow(jsFrames, elapsed), meters: drainMeterFrames(elapsed) });
      jsFrames = 0;
    }, WINDOW_MS);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearInterval(timer);
      setMeterFrameCounting(false);
    };
  }, []);

  const meterText = Object.keys(stats.meters).length
    ? Object.entries(stats.meters)
        .map(([channel, rate]) => `${channel} ${rate}/s`)
        .join(' · ')
    : '–';
  const policyText = `${policy}${reasons.length ? ` (${reasons.join(', ')})` : ''}${slow ? ' · slow ×10' : ''}`;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="motion-debug-overlay"
      style={[styles.panel, { top }]}
    >
      <Text style={styles.line} testID="motion-debug-fps">{`UI ${uiFps} fps · JS ${stats.jsFps} fps`}</Text>
      <Text style={styles.line} testID="motion-debug-meters">{`meters ${meterText}`}</Text>
      <Text style={styles.line} testID="motion-debug-loops">
        {`loops ${loops.length}/${AMBIENT_LOOP_CAP}${loops.length ? `: ${loops.map((l) => l.name).join(', ')}` : ''}`}
      </Text>
      <Text style={styles.line} testID="motion-debug-policy">{`motion ${policyText}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: spacing[1],
    zIndex: 1000,
    maxWidth: 320,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[0],
    borderRadius: radius.px.lg,
    borderWidth: 1,
    borderColor: derived.border,
    backgroundColor: palette.charcoal,
    opacity: 0.92,
  },
  line: {
    color: palette.foreground,
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    fontVariant: ['tabular-nums'],
  },
});
