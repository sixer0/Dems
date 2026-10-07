import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { derived, palette, statusSoft } from '@dems/shared/tokens';
import { NAV_DIMENSIONS } from '@/layout';
import { GlowLayer } from '@/motion';
import { TAB_DESTINATIONS, type TabName } from '@/navigation/routes';
import { IndicatorTravelLayer, settledBoxStyle, type IndicatorBox } from './indicator-travel';
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

/** The pill's and the streak's places for an item's frame (centred on the item). */
function pillBox(frame: LayoutRectangle): IndicatorBox {
  return { x: frame.x + (frame.width - PILL.width) / 2, y: PILL.top, width: PILL.width, height: PILL.height };
}
function streakBox(frame: LayoutRectangle): IndicatorBox {
  return { x: frame.x + (frame.width - STREAK.width) / 2, y: 0, width: STREAK.width, height: STREAK.height };
}

/**
 * Phone bottom tab bar (C-5; 04_mobile_specs §2.3 compact; MB 2 (350–595, 495–530)): five
 * destinations, 60 dp plus the bottom inset (it consumes that inset, so screens above it do not
 * pad it again). The active item is gold with a soft gold pill behind the icon and a light streak
 * on the top edge; both travel with the `indicator` spring and the pill's glow pulses e2 → e3 → e2
 * on arrival (M-MB-01). It sits below the content, never over it, so it needs no blur (H-MB-03 is
 * not exercised: the design-black surface is the fallback fill).
 *
 * E-fix row FX-M2b (E2E-P-1): the settled pill and streak are plain views placed by React at the
 * active item; a trip draws travelling copies over them (`IndicatorTravelLayer`) and React removes
 * them when the trip's budget is over, so the highlight always ends on the active tab.
 */
export function BottomTabBar({ items, active }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const track = useIndicatorTrack(active);
  const { frame, travel } = track;

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
        {frame ? (
          <>
            {/* Settled: React places it at the active item; hidden (not moved) while a copy travels. */}
            <View
              pointerEvents="none"
              testID="nav-bottom-indicator"
              style={[styles.pill, settledBoxStyle(pillBox(frame)), travel ? styles.hidden : null]}
            >
              <GlowLayer level={2} radius={PILL.radius} pulseKey={active ?? undefined} />
            </View>
            <View pointerEvents="none" testID="nav-bottom-streak" style={[styles.streak, settledBoxStyle(streakBox(frame)), travel ? styles.hidden : null]} />
            {travel ? (
              <>
                <IndicatorTravelLayer key={`pill-${travel.id}`} testID="nav-bottom-indicator-travel" from={pillBox(travel.from)} to={pillBox(travel.to)} style={styles.pill}>
                  <GlowLayer level={2} radius={PILL.radius} />
                </IndicatorTravelLayer>
                <IndicatorTravelLayer key={`streak-${travel.id}`} from={streakBox(travel.from)} to={streakBox(travel.to)} style={styles.streak} />
              </>
            ) : null}
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
    top: 0,
    left: 0,
    width: PILL.width,
    height: PILL.height,
    borderRadius: PILL.radius,
    backgroundColor: statusSoft.accent,
  },
  hidden: { opacity: 0 },
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
