/**
 * GlowLayer (04_mobile_specs §4.0 recipes; 03_motion_spec §2.2, §9.2).
 *
 * Glow is a STATE (elevation levels 1–3, 01_specs §2.7 rev 3) and is never animated as a shadow:
 * this component pre-renders one absolutely positioned layer per level, each carrying that level's
 * static `boxShadow`, and cross-fades their OPACITY (composite-only, 03M §9.2). Put it as the first
 * child of a positioned container with the same corner radius; it draws outside the container's
 * border box and ignores touches.
 *
 * Motion:
 * - level change: cross-fade over `base` (240 ms, `luxe`); reduced: instant;
 * - `breathe`: e2 ↔ e3 over `glowBreath` (2,400 ms) — "SYSTEM READY" / "SECURE" (03M §2.1); an
 *   ambient loop, so it registers with `useAmbientLoop` and stops under reduced motion;
 * - `pulseKey` change: one e3 halo pulse (600 ms), for escalations only (R8, M-C-10); reduced: none.
 */
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { elevation, toneHex, type StatusTone } from '@dems/shared/tokens';
import { animateBreath, animatePulseOnce, animateTiming } from './builders';
import { useAmbientLoop, useMotionSettings } from './use-motion-policy';
import type { MotionPolicy, MotionSettings } from './tokens';

export type GlowLevel = 0 | 1 | 2 | 3;

const LEVELS = [1, 2, 3] as const;
type LitLevel = (typeof LEVELS)[number];

const HEX_COLOR = /#([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?/g;

/**
 * The `boxShadow` of an elevation level. Without a tone it is the token string (bronze and gold
 * glow). With a tone, each colour in the token is replaced by the tone's colour and keeps its
 * alpha, so geometry and intensity stay the tokens' (for example a green glow for Verify PASS).
 */
export function glowShadow(level: LitLevel, tone?: StatusTone): string {
  const token = elevation[level];
  if (!tone) return token;
  const hex = toneHex[tone].slice(1, 7);
  return token.replace(HEX_COLOR, (_match, _rgb: string, alpha: string | undefined) => `#${hex}${alpha ?? ''}`);
}

/** Opacity of each lit layer for a target level (exactly one layer on, or none for level 0). */
export function layerOpacities(level: GlowLevel): Record<LitLevel, number> {
  return { 1: level === 1 ? 1 : 0, 2: level === 2 ? 1 : 0, 3: level === 3 ? 1 : 0 };
}

export interface GlowLayerProps {
  /** Target elevation level; 0 = no glow. With `breathe`, the base level is 2. */
  level: GlowLevel;
  /** Glow colour; default the token colours (bronze bloom, gold ring at level 3). */
  tone?: StatusTone;
  /** Corner radius of the host, px (`radius.px.xl` = 12 for panels). */
  radius?: number;
  /** e2 ↔ e3 breathing (ambient loop). */
  breathe?: boolean;
  /** Pauses the breathing (screen unfocused, off-screen). */
  paused?: boolean;
  /** Change it to play one e3 escalation pulse. */
  pulseKey?: string | number;
  /** Policy override; default the app policy (`useMotionSettings`). */
  motion?: MotionPolicy;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function GlowLayer({
  level,
  tone,
  radius = 0,
  breathe = false,
  paused = false,
  pulseKey,
  motion: policyOverride,
  style,
  testID,
}: GlowLayerProps) {
  const appSettings = useMotionSettings();
  const policy = policyOverride ?? appSettings.policy;
  const slow = policy === 'full' && appSettings.slow;
  const m = useMemo<MotionSettings>(() => ({ policy, slow }), [policy, slow]);
  const breathing = useAmbientLoop('glow-breath', { active: breathe && policy === 'full', paused });
  const baseLevel: GlowLevel = breathe ? 2 : level;

  const initial = layerOpacities(baseLevel);
  const o1 = useSharedValue(initial[1]);
  const o2 = useSharedValue(initial[2]);
  const o3 = useSharedValue(initial[3]);

  // Level cross-fade; while breathing, layer 3 fades in and out over the level-2 layer instead.
  useEffect(() => {
    const target = layerOpacities(baseLevel);
    o1.set(animateTiming(target[1], 'base', 'luxe', m));
    o2.set(animateTiming(target[2], 'base', 'luxe', m));
    if (breathing) {
      o3.set(animateBreath(0, 1, 'glowBreath', m, 0));
      return () => cancelAnimation(o3);
    }
    o3.set(animateTiming(target[3], 'base', 'luxe', m));
    return undefined;
  }, [baseLevel, breathing, m, o1, o2, o3]);

  // One escalation pulse per pulseKey change (never on mount, never while breathing).
  const lastPulse = useRef(pulseKey);
  useEffect(() => {
    if (lastPulse.current === pulseKey) return;
    lastPulse.current = pulseKey;
    if (m.policy === 'reduced' || breathing) return;
    o3.set(animatePulseOnce(1, layerOpacities(baseLevel)[3], m));
  }, [pulseKey, m, breathing, baseLevel, o3]);

  const s1 = useAnimatedStyle(() => ({ opacity: o1.get() }));
  const s2 = useAnimatedStyle(() => ({ opacity: o2.get() }));
  const s3 = useAnimatedStyle(() => ({ opacity: o3.get() }));
  const animated = { 1: s1, 2: s2, 3: s3 } as const;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, style]}
      testID={testID}
    >
      {LEVELS.map((n) => (
        <Animated.View
          key={n}
          testID={testID ? `${testID}-e${n}` : undefined}
          style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: glowShadow(n, tone) }, animated[n]]}
        />
      ))}
    </View>
  );
}
