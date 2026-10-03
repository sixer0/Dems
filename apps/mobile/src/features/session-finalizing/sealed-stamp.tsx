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
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { motion as motionTokens, palette } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { animateFade, animatePulseOnce, animateSpring, animateTiming, glowShadow, triggerHaptic, useMotionSettings } from '@/motion';

/** 03M M-C-09: e3 glow flash 400 ms; hairline ring 700 ms. */
export const STAMP_GLOW_MS = 400;
export const STAMP_RING_MS = 700;
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

export function SealedStamp({ play, label, accessibilityLabel, size = 'lg', testID }: SealedStampProps) {
  const settings = useMotionSettings();
  const animate = play && settings.policy === 'full';
  const scale = useSharedValue(animate ? motionTokens.scale.stampFrom : 1);
  const opacity = useSharedValue(animate ? 0 : 1);
  const glow = useSharedValue(0);
  const ring = useSharedValue(0);
  const played = useRef(false);

  useEffect(() => {
    if (!play || played.current) return;
    played.current = true;
    triggerHaptic('sealedStamp');
    if (settings.policy === 'reduced') {
      scale.set(1);
      opacity.set(1);
      return;
    }
    opacity.set(animateFade(1, settings, 'fast'));
    scale.set(animateSpring(1, 'bouncy', settings));
    // D73 F74-02: the pulse builder always gets its total explicitly.
    glow.set(animatePulseOnce(1, 0, settings, STAMP_GLOW_MS));
    ring.set(animateTiming(1, STAMP_RING_MS, 'standard', settings));
  }, [play, settings, scale, opacity, glow, ring]);

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
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={play ? 'polite' : 'none'}
      style={styles.host}
    >
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <Animated.View style={stampStyle}>
        <Animated.View pointerEvents="none" style={[styles.glow, { boxShadow: glowShadow(3, 'sealed') }, glowStyle]} />
        <StatusChip badge="SEALED" label={label} size={size} testID={testID ? `${testID}-chip` : undefined} />
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
