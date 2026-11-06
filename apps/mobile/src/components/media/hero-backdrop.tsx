/**
 * HeroBackdrop asset renderer (04_mobile_specs §4.1 L1, §8.1, §8.2; 03_motion_spec M-C-13).
 *
 * The licensed room still (step 29's 1600 px variant by default since step 72, at D46's 62 % 45 %
 * object position; the MB 1 officer photo is never used, D28), graded black 45 % plus a bronze wash
 * (`expo-linear-gradient`), the shared topographic texture (step 35, SCR-06, rendered by
 * react-native-svg `SvgXml`; D53) with its brightest line at 15–30 %, and two static diagonal
 * light streaks. `source={null}` draws the procedural warm-light placeholder and `topoXml={null}`
 * the seeded placeholder contours (step 71).
 * Ambient: one Ken Burns push-in (1.00 → 1.06, 30 s, alternating) on the UI thread; off when
 * reduced or paused.
 */
import { Image, type ImageContentPosition, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { derived, palette } from '@dems/shared/tokens';
import { HERO_FOCUS, HERO_STILL, TOPO_XML, TOPO_XML_MAX_LINE_ALPHA } from './brand-assets';
import { KEN_BURNS_MAX, KEN_BURNS_MS } from './camera-feed.math';
import { mixHex, withAlpha } from './color';
import { TOPO_VIEWBOX, topoContours } from './hero-backdrop.math';

export interface HeroBackdropProps {
  /** Room still (expo-image source). Default: the W-05 still; `null`: the procedural warm-light placeholder. */
  source?: ImageSource | number | null;
  /** Object position of the still. Default: D46's 62 % 45 % for the W-05 still, else centre. */
  contentPosition?: ImageContentPosition;
  /** Topographic SVG markup. Default: the shared texture (SCR-06); `null`: the seeded placeholder contours. */
  topoXml?: string | null;
  /** Motion policy from `useMotionPolicy()` (04 §7.7). */
  motion: 'full' | 'reduced';
  paused?: boolean;
  /** Alpha of the texture's brightest line, 0.15–0.30 (04 §4.1 L1). */
  topoOpacity?: number;
  streaks?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SINE = Easing.inOut(Easing.sin);

export function HeroBackdrop({
  source = HERO_STILL,
  contentPosition,
  topoXml = TOPO_XML,
  motion,
  paused = false,
  topoOpacity = 0.22,
  streaks = true,
  children,
  style,
  testID,
}: HeroBackdropProps) {
  const reduced = motion === 'reduced';
  const kenBurns = useSharedValue(1);
  const contours = useMemo(() => (topoXml ? [] : topoContours()), [topoXml]);

  useEffect(() => {
    if (reduced || paused) {
      cancelAnimation(kenBurns);
      if (reduced) kenBurns.set(1);
      return;
    }
    kenBurns.set(withRepeat(withTiming(KEN_BURNS_MAX, { duration: KEN_BURNS_MS, easing: SINE }), -1, true));
    return () => cancelAnimation(kenBurns);
  }, [reduced, paused, kenBurns]);

  const photoStyle = useAnimatedStyle(() => ({ transform: [{ scale: kenBurns.get() }] }));
  const lineAlpha = Math.min(0.3, Math.max(0.15, topoOpacity));
  // The shared texture carries its own line alpha (0.15–0.40), so its layer is scaled to put the
  // brightest line at `lineAlpha`; the placeholder draws full-alpha lines at the layer opacity.
  const opacity = topoXml ? Math.min(1, lineAlpha / TOPO_XML_MAX_LINE_ALPHA) : lineAlpha;
  const position = contentPosition ?? (source === HERO_STILL ? HERO_FOCUS : 'center');

  return (
    <View testID={testID} style={[{ flex: 1, overflow: 'hidden', backgroundColor: palette.black }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '60% 40%' }, photoStyle]}>
        {source !== null ? (
          <Image
            source={source}
            contentFit="cover"
            contentPosition={position}
            style={StyleSheet.absoluteFill}
            accessible={false}
          />
        ) : (
          <PlaceholderLight />
        )}
      </Animated.View>

      {/* Grade: black 45 % deepening to the bottom, then a bronze wash (04 §4.1 L1). */}
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(palette.black, 0.4), withAlpha(palette.black, 0.5), withAlpha(palette.black, 0.86)]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(palette.bronze, 0.06) }]} />

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
        {topoXml ? (
          <SvgXml xml={topoXml} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <Svg width="100%" height="100%" viewBox={`0 0 ${TOPO_VIEWBOX} ${TOPO_VIEWBOX}`} preserveAspectRatio="xMidYMid slice">
            {contours.map((d, i) => (
              <Path key={i} d={d} fill="none" stroke={palette.bronze} strokeWidth={1.2} opacity={i % 3 === 0 ? 1 : 0.65} />
            ))}
          </Svg>
        )}
      </View>

      {streaks ? <Streaks /> : null}
      {children}
    </View>
  );
}

/** Two soft diagonal light streaks (static; light, not movement, P1). */
function Streaks() {
  const band = [withAlpha(palette.gold, 0), withAlpha(palette.gold, 0.09), withAlpha(palette.gold, 0)] as const;
  const line = [withAlpha(palette.gold, 0), withAlpha(palette.gold, 0.22), withAlpha(palette.gold, 0)] as const;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={band}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.streak, { top: '18%', height: 90, transform: [{ rotate: '-28deg' }] }]}
      />
      <LinearGradient
        colors={line}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.streak, { top: '34%', height: 1.5, transform: [{ rotate: '-28deg' }] }]}
      />
    </View>
  );
}

/** Procedural stand-in for the room still: a warm light pool over the L2 panel tone. */
function PlaceholderLight() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="hero-pool" cx="72" cy="22" r="70" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={mixHex(palette.bronze, palette.gold, 0.35)} stopOpacity={0.42} />
          <Stop offset="1" stopColor={palette.bronze} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="hero-floor" cx="25" cy="92" r="55" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={palette.gold} stopOpacity={0.14} />
          <Stop offset="1" stopColor={palette.gold} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={derived.surface} />
      <Rect x="0" y="0" width="100" height="100" fill="url(#hero-pool)" />
      <Rect x="0" y="0" width="100" height="100" fill="url(#hero-floor)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  streak: { position: 'absolute', left: '-30%', width: '160%' },
});
