import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { derived, palette, statusSoft } from '@dems/shared/tokens';
import { NAV_DIMENSIONS } from '@/layout';
import { GlowLayer } from '@/motion';
import { TAB_DESTINATIONS, type TabName } from '@/navigation/routes';
import { NavItem } from './nav-item';
import { useIndicatorTrack } from './use-indicator';

export interface BottomTabBarProps {
  /** The five phone destinations (04 §2.3). */
  items: readonly TabName[];
  /** The highlighted destination (More while a More destination is open, MB 8 / MB 10). */
  active: TabName | null;
}

/** The pill behind the active icon (04 §2.3 "gold pill indicator under the icon"). */
const PILL = { width: 56, height: 32, radius: 16, top: 4 } as const;
/** The gold light streak on the bar's top edge above the active item (MB 2 tab bar). */
const STREAK = { width: 32, height: 2 } as const;

/**
 * Phone bottom tab bar (C-5; 04_mobile_specs §2.3 compact; MB 2 (350–595, 495–530)): five
 * destinations, 60 dp plus the bottom inset (it consumes that inset, so screens above it do not
 * pad it again). The active item is gold with a soft gold pill behind the icon and a light streak
 * on the top edge; both travel with the `indicator` spring and the pill's glow pulses e2 → e3 → e2
 * on arrival (M-MB-01). It sits below the content, never over it, so it needs no blur (H-MB-03 is
 * not exercised: the design-black surface is the fallback fill).
 */
export function BottomTabBar({ items, active }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const track = useIndicatorTrack(active);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: track.x.get() + (track.width.get() - PILL.width) / 2 }],
  }));
  const streakStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: track.x.get() + (track.width.get() - STREAK.width) / 2 }],
  }));

  return (
    <View
      testID="nav-bottom"
      collapsable={false}
      accessibilityRole="tablist"
      accessibilityLabel={t('features.navigation.tabList')}
      style={[
        styles.bar,
        {
          height: NAV_DIMENSIONS.bottomBarHeight + insets.bottom,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View style={styles.row}>
        {track.frame ? (
          <>
            <Animated.View pointerEvents="none" testID="nav-bottom-indicator" style={[styles.pill, pillStyle]}>
              <GlowLayer level={2} radius={PILL.radius} pulseKey={active ?? undefined} />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.streak, streakStyle]} />
          </>
        ) : null}
        {items.map((name) => {
          const destination = TAB_DESTINATIONS[name];
          return (
            <NavItem
              key={name}
              name={name}
              label={t(destination.labelKey)}
              icon={destination.icon}
              active={active === name}
              layout="bar"
              haptic="tabSelect"
              onLayout={track.onItemLayout}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: derived.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: derived.border,
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  pill: {
    position: 'absolute',
    top: PILL.top,
    left: 0,
    width: PILL.width,
    height: PILL.height,
    borderRadius: PILL.radius,
    backgroundColor: statusSoft.accent,
  },
  streak: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: STREAK.width,
    height: STREAK.height,
    borderRadius: STREAK.height,
    backgroundColor: palette.gold,
  },
});
