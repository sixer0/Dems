import { useTabTrigger } from 'expo-router/ui';
import { PressableFeedback } from 'heroui-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { animateTiming, durationMs, useHaptics, useMotionSettings, type HapticEvent, type MotionSettings } from '@/motion';
import type { TabName } from '@/navigation/routes';

/** Label placement of a navigation item (04_mobile_specs §2.3). */
export type NavItemLayout = 'bar' | 'rail-icon' | 'rail-below' | 'rail-inline';

export interface NavItemProps {
  name: TabName;
  label: string;
  icon: LucideIcon;
  active: boolean;
  layout: NavItemLayout;
  /** `tabSelect` for the bottom bar, `railSelect` for the rail (04 §7.6). */
  haptic: HapticEvent;
  onLayout?: (name: TabName, event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
}

/** Icon size in dp; touch targets stay ≥ 48 dp (04 §2.6). */
export const NAV_ICON_SIZE = 24;

/** Icon and label colour cross-fade (04 §7.5 M-MB-01: 240 ms). */
export const COLOR_FADE_MS = 240;

/** How long the fading copy may stay before a React commit removes it (the fade, ×10 in proof mode, plus one frame budget). */
export function colorFadeBudgetMs(m: MotionSettings): number {
  return durationMs(COLOR_FADE_MS, m) + 60;
}

/** One cross-fade: the colours the item had before (`wasActive`), shown over the new ones while they fade out. */
interface ColorFade {
  readonly wasActive: boolean;
  readonly id: number;
}

/**
 * E-fix row FX-M2b (E2E-P-1): the cross-fade of an item whose state changed, or null when settled.
 * Reduced motion jumps (no fade). A React commit ends the fade after `colorFadeBudgetMs`, whatever
 * the UI thread did.
 */
function useColorFade(active: boolean, m: MotionSettings): ColorFade | null {
  const [seen, setSeen] = useState(active);
  const [fade, setFade] = useState<ColorFade | null>(null);
  if (seen !== active) {
    setSeen(active);
    setFade(m.policy === 'reduced' ? null : { wasActive: seen, id: (fade?.id ?? 0) + 1 });
  }
  useEffect(() => {
    if (fade === null) return undefined;
    const timer = setTimeout(() => setFade((current) => (current?.id === fade.id ? null : current)), colorFadeBudgetMs(m));
    return () => clearTimeout(timer);
  }, [fade, m]);
  return fade;
}

/**
 * One destination of the bottom bar or the rail (C-5, 04_mobile_specs §3.4): an `expo-router/ui`
 * tab trigger (`useTabTrigger`, the documented hook behind `TabTrigger`) on a HeroUI Native
 * `PressableFeedback`, with a Lucide icon and a label. It is a `tab` for TalkBack, labelled even
 * when the label is hidden; the travelling indicator itself is drawn by the bar or rail.
 *
 * E-fix row FX-M2b (E2E-P-1, E2E-T-2; decision D201): the icon and the label used to be coloured by
 * UI-thread animated styles only (a gold copy of the icon over a grey one, both opacities from one
 * shared value). On the phone (90a) and the tablet (12_devices_blank) the label's colour followed a
 * tab switch while the icon opacities did not: the new tab showed a gold label over a grey icon, the
 * old tab a gold icon. Now the settled colours are plain React props of the `active` state (gold or
 * grey), so the final state cannot be lost; M-MB-01's 240 ms cross-fade is a copy of the item in
 * its previous colours laid over it and faded out on the UI thread, which React removes after
 * `colorFadeBudgetMs` even if no frame of the fade ran.
 */
export function NavItem({ name, label, icon, active, layout, haptic, onLayout, style }: NavItemProps) {
  const { triggerProps } = useTabTrigger({ name });
  const haptics = useHaptics();
  const motion = useMotionSettings();
  const fade = useColorFade(active, motion);

  return (
    <PressableFeedback
      testID={`nav-item-${name}`}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onLayout={onLayout ? (event: LayoutChangeEvent) => onLayout(name, event) : undefined}
      onPress={(event) => {
        if (!active) haptics(haptic);
        triggerProps.onPress?.(event);
      }}
      onLongPress={triggerProps.onLongPress}
      style={[styles.base, LAYOUT_STYLES[layout], style]}
    >
      <NavItemFace testID={`nav-item-${name}-face`} icon={icon} label={label} active={active} layout={layout} />
      {fade ? (
        <FadingFace key={fade.id} motion={motion} layout={layout}>
          <NavItemFace testID={`nav-item-${name}-fading`} icon={icon} label={label} active={fade.wasActive} layout={layout} />
        </FadingFace>
      ) : null}
    </PressableFeedback>
  );
}

interface NavItemFaceProps {
  testID: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  layout: NavItemLayout;
}

/** The icon and the label in the colours of one state, as plain React props (no UI-thread value). */
function NavItemFace({ testID, icon: Icon, label, active, layout }: NavItemFaceProps) {
  const tint = active ? palette.gold : palette.gray;
  return (
    <>
      <View testID={`${testID}-icon`} style={styles.icon} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Icon size={NAV_ICON_SIZE} color={tint} strokeWidth={active ? 2 : 1.75} />
      </View>
      {layout !== 'rail-icon' ? (
        <Text
          testID={`${testID}-label`}
          // Two lines under the icon in the 88 dp rail ("Network & Time"); one line elsewhere.
          numberOfLines={layout === 'rail-below' ? 2 : 1}
          maxFontSizeMultiplier={1.2}
          importantForAccessibility="no"
          style={[layout === 'rail-inline' ? styles.labelInline : styles.labelBelow, { color: tint }]}
        >
          {label}
        </Text>
      ) : null}
    </>
  );
}

/**
 * The previous colours laid exactly over the item (the same layout box) and faded from 1 to 0 in
 * COLOR_FADE_MS on the UI thread. Hidden from TalkBack, never touchable.
 */
function FadingFace({ motion, layout, children }: { motion: MotionSettings; layout: NavItemLayout; children: ReactNode }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(animateTiming(0, COLOR_FADE_MS, 'standard', motion));
  }, [opacity, motion]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.base, LAYOUT_STYLES[layout], StyleSheet.absoluteFill, fadeStyle]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
  icon: { width: NAV_ICON_SIZE, height: NAV_ICON_SIZE, alignItems: 'center', justifyContent: 'center' },
  labelBelow: {
    marginTop: 4,
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    textAlign: 'center',
  },
  labelInline: {
    marginLeft: 12,
    flexShrink: 1,
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
  },
});

const LAYOUT_STYLES: Record<NavItemLayout, ViewStyle> = {
  bar: { flex: 1, flexDirection: 'column', paddingVertical: 6 },
  'rail-icon': { flexDirection: 'column', height: 56, alignSelf: 'stretch' },
  'rail-below': { flexDirection: 'column', minHeight: 64, alignSelf: 'stretch', paddingHorizontal: 4, paddingVertical: 6 },
  'rail-inline': { flexDirection: 'row', justifyContent: 'flex-start', height: 48, alignSelf: 'stretch', paddingHorizontal: 16 },
};
