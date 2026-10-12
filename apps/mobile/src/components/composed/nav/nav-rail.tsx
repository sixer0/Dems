import { PressableFeedback } from 'heroui-native';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { TOPO_SVG } from '@dems/shared/brand';
import { SOFTWARE_VERSION } from '@dems/shared/sim';
import { useShownVersion } from '@/lib/app-version';
import { derived, fontFamily, palette, radius, typography } from '@dems/shared/tokens';
import { Emblem } from '@/components/media/emblem';
import type { NavChrome } from '@/layout';
import { GlowLayer } from '@/motion';
import { TAB_DESTINATIONS, type TabName } from '@/navigation/routes';
import { IndicatorTravelLayer, settledBoxStyle, type IndicatorBox } from './indicator-travel';
import { NavItem, type NavItemLayout } from './nav-item';
import { useIndicatorTrack } from './use-indicator';

/**
 * Device software version at the extended rail's foot ("DEMS EDGE CLIENT · v2.4.1", 04 §2.3, web
 * parity): the simulator dataset's `SOFTWARE_VERSION`, the one source the web sidebar reads too.
 * Round two (JW-26): in Live mode the foot states the app's OWN build under the app's name
 * (`useShownVersion`); this constant is the Simulated source's value.
 */
export const RAIL_FOOTER_VERSION: string = SOFTWARE_VERSION;

export interface NavRailProps {
  /** 5 destinations on a landscape phone, 8 on tablets (04 §2.3). */
  items: readonly TabName[];
  active: TabName | null;
  /** The chrome of the current layout class (`useLayoutClass().nav`). */
  nav: NavChrome;
  /** Present when the 232 dp rail is available (expanded, W ≥ 1200): the collapse toggle (§2.3). */
  collapse?: { readonly collapsed: boolean; toggle(): void };
}

function itemLayoutFor(nav: NavChrome): NavItemLayout {
  if (nav.labels === 'none') return 'rail-icon';
  return nav.labels === 'inline' ? 'rail-inline' : 'rail-below';
}

/** The card covers the active item's frame. */
function cardBox(frame: LayoutRectangle): IndicatorBox {
  return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
}

/** Horizontal inset of the items and the active card inside the rail. */
const LIST_INSET = 8;

/**
 * Start-side navigation rail (C-5; 04_mobile_specs §2.2, §2.3): 72 dp icon-only on a landscape
 * phone, 88 dp icon + label on tablet portrait (and a collapsed extended rail), 232 dp with inline
 * labels on tablet landscape from 1200 dp. It pads the start-side inset itself (the landscape
 * camera cutout, MA-14) and the top and bottom insets, so no item sits under a system bar.
 *
 * Active state (D49 web parity, token colours only): an inset card on `surface-tertiary` with a
 * gold hairline and glow e2, travelling with the `indicator` spring and pulsing to e3 on arrival
 * (M-MB-01). The extended rail carries the topographic texture and the version line at its foot.
 *
 * E-fix row FX-M2b (E2E-T-2, E2E-P-1): the settled card is a plain view placed by React on the
 * active item; a trip draws a travelling copy over it (`IndicatorTravelLayer`) that React removes
 * when the trip's budget is over, so the card never stays on the tab that was left (12_devices_blank).
 */
export function NavRail({ items, active, nav, collapse }: NavRailProps) {
  const { t } = useTranslation();
  const shownVersion = useShownVersion();
  const insets = useSafeAreaInsets();
  const { frame, travel, onItemLayout } = useIndicatorTrack(active);
  const layout = itemLayoutFor(nav);
  const showHeader = layout !== 'rail-icon';

  return (
    <View
      testID="nav-rail"
      collapsable={false}
      accessibilityRole="tablist"
      accessibilityLabel={t('features.navigation.tabList')}
      style={[
        styles.rail,
        {
          width: nav.railWidth + insets.left,
          paddingLeft: insets.left,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
        },
      ]}
    >
      {nav.extended ? (
        <View pointerEvents="none" style={styles.topo} importantForAccessibility="no-hide-descendants">
          <SvgXml xml={TOPO_SVG} width="100%" height="100%" preserveAspectRatio="xMidYMax slice" />
        </View>
      ) : null}

      {showHeader ? (
        <View style={[styles.header, nav.extended ? styles.headerInline : null]}>
          <Emblem size={nav.extended ? 32 : 28} />
          {nav.extended ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={1.2}
              style={styles.wordmark}
            >
              {t('mobile.app.name')}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.list}>
        {frame ? (
          // Settled: React places it on the active item; hidden (not moved) while a copy travels.
          <View pointerEvents="none" testID="nav-rail-indicator" style={[styles.card, settledBoxStyle(cardBox(frame)), travel ? styles.hidden : null]}>
            <GlowLayer level={2} radius={radius.px.lg} pulseKey={active ?? undefined} />
          </View>
        ) : null}
        {frame && travel ? (
          <IndicatorTravelLayer key={`card-${travel.id}`} testID="nav-rail-indicator-travel" from={cardBox(travel.from)} to={cardBox(travel.to)} style={styles.card}>
            <GlowLayer level={2} radius={radius.px.lg} />
          </IndicatorTravelLayer>
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
              layout={layout}
              haptic="railSelect"
              onLayout={onItemLayout}
            />
          );
        })}
      </View>

      <View style={styles.spacer} />

      {nav.extended ? (
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} testID="nav-rail-footer" style={styles.footer}>
          {t('mobile.app.versionFooter', { version: shownVersion.version })}
        </Text>
      ) : null}

      {collapse ? (
        <View style={[styles.toggleRow, nav.extended ? styles.toggleInline : null]}>
          <PressableFeedback
            testID="nav-rail-collapse"
            accessibilityRole="button"
            accessibilityLabel={t(collapse.collapsed ? 'mobile.nav.expandRail' : 'mobile.nav.collapseRail')}
            onPress={collapse.toggle}
            style={styles.toggle}
          >
            {collapse.collapsed ? (
              <PanelLeftOpen size={20} color={palette.gray} />
            ) : (
              <PanelLeftClose size={20} color={palette.gray} />
            )}
          </PressableFeedback>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flex: 1,
    backgroundColor: derived.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: derived.border,
    overflow: 'hidden',
  },
  topo: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, opacity: 0.55 },
  header: { alignItems: 'center', paddingBottom: 16 },
  headerInline: { flexDirection: 'row', paddingHorizontal: 20, gap: 10 },
  wordmark: {
    flexShrink: 1,
    fontFamily: fontFamily.native.display,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: palette.gold,
  },
  list: { paddingHorizontal: LIST_INSET, gap: 4 },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: radius.px.lg,
    borderWidth: 1,
    borderColor: palette.gold,
    backgroundColor: derived.surfaceTertiary,
  },
  hidden: { opacity: 0 },
  spacer: { flex: 1 },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontFamily: fontFamily.native.mono,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: 0.5,
    color: derived.foreground2,
  },
  toggleRow: { alignItems: 'center' },
  toggle: { width: 48, height: 48, borderRadius: radius.px.lg, alignItems: 'center', justifyContent: 'center' },
  toggleInline: { alignItems: 'flex-start', paddingHorizontal: 8 },
});
