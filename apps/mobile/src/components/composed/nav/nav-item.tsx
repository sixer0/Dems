import { useTabTrigger } from 'expo-router/ui';
import { PressableFeedback } from 'heroui-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { animateTiming, useHaptics, useMotionSettings, type HapticEvent } from '@/motion';
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
const COLOR_FADE_MS = 240;

/**
 * One destination of the bottom bar or the rail (C-5, 04_mobile_specs §3.4): an `expo-router/ui`
 * tab trigger (`useTabTrigger`, the documented hook behind `TabTrigger`) on a HeroUI Native
 * `PressableFeedback`, with a Lucide icon and a label. The active state cross-fades a gold copy of
 * the icon over the muted one and tints the label (M-MB-01); the travelling indicator itself is
 * drawn by the bar or rail. It is a `tab` for TalkBack, labelled even when the label is hidden.
 */
export function NavItem({ name, label, icon: Icon, active, layout, haptic, onLayout, style }: NavItemProps) {
  const { triggerProps } = useTabTrigger({ name });
  const haptics = useHaptics();
  const motion = useMotionSettings();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.set(animateTiming(active ? 1 : 0, COLOR_FADE_MS, 'standard', motion));
  }, [active, motion, progress]);

  const goldIcon = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const mutedIcon = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const labelColor = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [0, 1], [palette.gray, palette.gold]),
  }));

  const showLabel = layout !== 'rail-icon';

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
      <View style={styles.icon} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, mutedIcon]}>
          <Icon size={NAV_ICON_SIZE} color={palette.gray} strokeWidth={1.75} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, goldIcon]}>
          <Icon size={NAV_ICON_SIZE} color={palette.gold} strokeWidth={2} />
        </Animated.View>
      </View>
      {showLabel ? (
        <Animated.Text
          // Two lines under the icon in the 88 dp rail ("Network & Time"); one line elsewhere.
          numberOfLines={layout === 'rail-below' ? 2 : 1}
          maxFontSizeMultiplier={1.2}
          importantForAccessibility="no"
          style={[layout === 'rail-inline' ? styles.labelInline : styles.labelBelow, labelColor]}
        >
          {label}
        </Animated.Text>
      ) : null}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
  icon: { width: NAV_ICON_SIZE, height: NAV_ICON_SIZE },
  center: { alignItems: 'center', justifyContent: 'center' },
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
