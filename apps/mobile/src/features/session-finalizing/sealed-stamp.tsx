/**
 * The SEALED stamp (04_mobile_specs §4.6, §7.3 "Finalizing" hero moment, §7.6; 03_motion_spec
 * M-C-09, P4). The violet `StatusChip` SEALED badge with `BadgeCheck`:
 *
 * - scale `stampFrom` 1.2 → 1 on the `bouncy` spring (P4 reserves `bouncy` for completion moments;
 *   this is the only place the finalization flow uses it);
 * - one elevation-3 glow flash in the sealed violet (400 ms, composite opacity on a pre-rendered
 *   `boxShadow` layer, 03M §9.2);
 * - one hairline ring expanding and fading (700 ms);
 * - haptic Success (`sealedStamp`, §7.6), once per mount.
 *
 * `play` false (a past session, an acknowledged summary) draws the final frame with no motion and no
 * haptic. Reduced motion: a static stamp; the haptic still fires, because haptics are a separate
 * preference (§7.6).
 *
 * **React holds the rest state** (blueprint row 87, backlog B9 = FXR-DEV-2 with MB-04; E-13; the W93-7
 * pattern of the C-4 Stepper). The stamp plays at the Finalizing -> Summary hand-over, where the copy
 * drawn in place is replaced by the route's copy a moment later: the place where the device drops
 * Reanimated updates. Before, the chip's visibility lived in a shared value that started at opacity 0,
 * so a lost update could leave the hero's stamp invisible. Now:
 *
 * - the REST state (chip at opacity 1, scale 1; no glow; no ring) is what React draws whenever no
 *   motion is playing, with plain style values;
 * - the motion is a phase `playing` that lasts `STAMP_BUDGET_MS` and then ends by a React state
 *   change: the animated style leaves the chip's style list, and the glow and the ring (removable
 *   overlays, rest = invisible) are unmounted. Whatever Reanimated did or lost, React's commit draws
 *   the final stamp;
 * - the motion STARTS when the stamp's host view reports its layout, that is once the native view
 *   exists, never in the commit that mounts it: an update is not sent to a view the mounting layer
 *   does not hold yet (the "Unable to find SurfaceMountingManager for tag" warning). When no layout
 *   arrives inside the budget, no motion plays and the rest state is drawn.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { motion as motionTokens, palette } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { animateFade, animatePulseOnce, animateSpring, animateTiming, glowShadow, triggerHaptic, useMotionSettings } from '@/motion';

/** 03M M-C-09: e3 glow flash 400 ms; hairline ring 700 ms. */
export const STAMP_GLOW_MS = 400;
export const STAMP_RING_MS = 700;
/** From the first render of a playing stamp until React draws the rest state (the ring's 700 ms plus slack). */
export const STAMP_BUDGET_MS = 900;
const RING_SCALE_TO = 1.9;

export interface SealedStampProps {
  /** Play the stamp once on mount (a freshly sealed, unacknowledged summary). */
  play: boolean;
  /** The chip label (shared i18n `session.finalization.sealed`). */
  label: string;
  /** Screen-reader text for the moment ("Evidence sealed"). */
  accessibilityLabel: string;
  size?: 'md' | 'lg';
  testID?: string;
}

/** The rest state of the chip, as plain React style values. */
const REST = { opacity: 1, transform: [{ scale: 1 }] } as const;

export function SealedStamp({ play, label, accessibilityLabel, size = 'lg', testID }: SealedStampProps) {
  const settings = useMotionSettings();
  const animate = play && settings.policy === 'full';
  /** True from mount until the budget is over; only a stamp that animates ever plays. */
  const [playing, setPlaying] = useState(animate);
  const haptic = useRef(false);

  // Haptic Success once per mount, with or without motion (§7.6).
  useEffect(() => {
    if (!play || haptic.current) return;
    haptic.current = true;
    triggerHaptic('sealedStamp');
  }, [play]);

  // The budget: after it React draws the rest state, whatever happened to the motion.
  const budgetMs = STAMP_BUDGET_MS * (settings.slow ? motionTokens.proofSlowFactor : 1);
  useEffect(() => {
    if (!playing) return undefined;
    const handle = setTimeout(() => setPlaying(false), budgetMs);
    return () => clearTimeout(handle);
  }, [playing, budgetMs]);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={play ? 'polite' : 'none'}
      style={styles.host}
    >
      {playing ? (
        <StampMotion testID={testID}>
          <StatusChip badge="SEALED" label={label} size={size} testID={testID ? `${testID}-chip` : undefined} />
        </StampMotion>
      ) : (
        <View style={REST} testID={testID ? `${testID}-rest` : undefined}>
          <StatusChip badge="SEALED" label={label} size={size} testID={testID ? `${testID}-chip` : undefined} />
        </View>
      )}
    </View>
  );
}

/**
 * The stamp while its motion plays: the chip popping in, with the glow flash and the expanding ring.
 * Mounted for the budget only; the motion starts at the first layout of this view.
 */
function StampMotion({ testID, children }: { testID?: string | undefined; children: ReactNode }) {
  const settings = useMotionSettings();
  const scale = useSharedValue<number>(motionTokens.scale.stampFrom);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);
  const ring = useSharedValue(0);
  const started = useRef(false);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    opacity.set(animateFade(1, settings, 'fast'));
    scale.set(animateSpring(1, 'bouncy', settings));
    // D73 F74-02: the pulse builder always gets its total explicitly.
    glow.set(animatePulseOnce(1, 0, settings, STAMP_GLOW_MS));
    ring.set(animateTiming(1, STAMP_RING_MS, 'standard', settings));
  }, [settings, scale, opacity, glow, ring]);

  const stampStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const ringStyle = useAnimatedStyle(() => {
    const progress = ring.get();
    // Invisible at rest (0) and once finished (1); fades 0.6 → 0 while it expands.
    const visible = progress > 0 && progress < 1;
    return {
      opacity: visible ? 0.6 * (1 - progress) : 0,
      transform: [{ scale: 1 + (RING_SCALE_TO - 1) * progress }],
    };
  });

  return (
    <View onLayout={start} testID={testID ? `${testID}-motion` : undefined}>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <Animated.View style={stampStyle}>
        <Animated.View pointerEvents="none" style={[styles.glow, { boxShadow: glowShadow(3, 'sealed') }, glowStyle]} />
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  ring: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -4,
    right: -4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: palette.sealed,
  },
  glow: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 9999 },
});
