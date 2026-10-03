import { useSegments } from 'expo-router';
import {
  TabSlot,
  defaultTabsSlotRender,
  useTabsWithTriggers,
  type TabsDescriptor,
  type TabsSlotRenderOptions,
  type UseTabsWithTriggersOptions,
} from 'expo-router/ui';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { Edge } from 'react-native-safe-area-context';
import { palette } from '@dems/shared/tokens';
import { LiveMiniBar, ResponsiveTabList } from '@/components/composed/nav';
import { BREAKPOINTS, ChromeInsetsProvider, useLayoutClass } from '@/layout';
import { animateFade, useMotionSettings } from '@/motion';
import { useActiveSession } from '@/runtime';
import { useRailCollapse } from './rail-prefs';
import { ALL_TABS, PHONE_TABS, TABLET_TABS, TAB_DESTINATIONS, activeDestination, tabForSegments } from './routes';

/**
 * Every tab route as a trigger (04_mobile_specs §3.4). The navigator always holds all nine, so a
 * route keeps its URL on every device; the chrome shows five on phones and eight on tablets
 * (H-MB-01: a route stays a tab without a visible trigger; phones reach Storage, Network & Time,
 * Audit and Settings from More with `router.push`, which Expo Router turns into a tab jump).
 */
export const TAB_TRIGGERS: UseTabsWithTriggersOptions['triggers'] = ALL_TABS.map((name) => ({
  type: 'internal' as const,
  name,
  href: TAB_DESTINATIONS[name].href,
}));

/**
 * `(app)/(tabs)/_layout.tsx`: the headless `expo-router/ui` tab navigator with
 * `backBehavior="history"` (Back from Storage returns to More on a phone, §3.4) and the
 * responsive chrome around one `TabSlot`.
 */
export function AppTabs() {
  // React Navigation's `NavigationContent` must re-render in the same render as this hook (it reads
  // a render-phase ref). React Compiler memoisation of the element made the tab content stick to
  // the first tab on the device (step 70's first session), so this component opts out.
  'use no memo';
  const { NavigationContent } = useTabsWithTriggers({ triggers: TAB_TRIGGERS, backBehavior: 'history' });
  return (
    <NavigationContent>
      <TabsFrame />
    </NavigationContent>
  );
}

/**
 * The chrome around the tab content (04 §2.3). The element tree keeps the content column at the
 * same position for every class (the list sits before it as a rail, or after it as a bottom bar,
 * with `null` in the other slot), so rotation re-lays out the chrome without remounting the open
 * screen: its scroll position, form input and timers survive (§2.5 rule 2, MA-13).
 */
function TabsFrame() {
  const railPrefs = useRailCollapse();
  const { layoutClass, width, nav } = useLayoutClass({ railCollapsed: railPrefs.collapsed });
  const segments = useSegments();
  const session = useActiveSession();

  const isRail = nav.kind === 'rail';
  const items = nav.destinations === 5 ? PHONE_TABS : TABLET_TABS;
  const tab = tabForSegments(segments);
  const active = activeDestination(tab, items);
  const canCollapse = layoutClass === 'expanded' && width >= BREAKPOINTS.extendedRail;
  const collapse = canCollapse ? { collapsed: railPrefs.collapsed, toggle: railPrefs.toggle } : undefined;
  // §3.8: while RECORDING, on any tab route (the monitor is a flow screen above the tabs).
  const showMiniBar = session.state === 'RECORDING' && tab !== null;
  const consumed: readonly Edge[] = isRail ? (showMiniBar ? RAIL_WITH_MINI_BAR : RAIL_EDGES) : BAR_EDGES;

  const list = <ResponsiveTabList nav={nav} items={items} active={active} {...(collapse ? { collapse } : {})} />;

  return (
    <View style={[styles.frame, isRail ? styles.row : styles.column]}>
      {isRail ? list : null}
      <View style={styles.content}>
        {showMiniBar && isRail ? <LiveMiniBar session={session} placement="top" /> : null}
        <ChromeInsetsProvider consumed={consumed}>
          <TabSlot style={styles.slot} renderFn={renderTabScreen} />
        </ChromeInsetsProvider>
        {showMiniBar && !isRail ? <LiveMiniBar session={session} placement="above-bar" /> : null}
      </View>
      {isRail ? null : list}
    </View>
  );
}

const BAR_EDGES: readonly Edge[] = ['bottom'];
const RAIL_EDGES: readonly Edge[] = ['left'];
const RAIL_WITH_MINI_BAR: readonly Edge[] = ['left', 'top'];

/** The default tab-screen render, with the M-APP-04 content cross-fade on every tab switch. */
function renderTabScreen(descriptor: TabsDescriptor, options: TabsSlotRenderOptions) {
  return defaultTabsSlotRender(
    { ...descriptor, render: () => <TabScreenFade focused={options.isFocused}>{descriptor.render()}</TabScreenFade> },
    options,
  );
}

/** 04 §7.2 M-APP-04: "Tab switches cross-fade content 160 ms" (reduced: the same short fade). */
function TabScreenFade({ focused, children }: { focused: boolean; children: ReactNode }) {
  const settings = useMotionSettings();
  const opacity = useSharedValue(focused ? 0 : 1);

  useEffect(() => {
    if (!focused) return;
    opacity.set(0);
    opacity.set(animateFade(1, settings, 'fast'));
  }, [focused, settings, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.slot, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: palette.black },
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column' },
  content: { flex: 1 },
  slot: { flex: 1 },
});
