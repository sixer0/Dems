import Animated from 'react-native-reanimated';
import type { NavChrome } from '@/layout';
import { crossFadeIn, crossFadeOut, useMotionSettings } from '@/motion';
import type { TabName } from '@/navigation/routes';
import { BottomTabBar } from './bottom-tab-bar';
import { NavRail, type NavRailProps } from './nav-rail';

export interface ResponsiveTabListProps {
  /** The chrome of the current layout class (`useLayoutClass().nav`, 04 §2.2). */
  nav: NavChrome;
  items: readonly TabName[];
  active: TabName | null;
  collapse?: NavRailProps['collapse'];
}

/**
 * The tab list of the headless `Tabs` navigator (C-5; 04_mobile_specs §3.1, §3.4): the bottom bar
 * on compact, the rail on every other class. Both are made of tab triggers of the same navigator,
 * so rotating or resizing swaps only this list; the navigator, its history and the open screens
 * are untouched (§2.5 rule 2). The swap cross-fades in 160 ms (M-MB-03).
 */
export function ResponsiveTabList({ nav, items, active, collapse }: ResponsiveTabListProps) {
  const motion = useMotionSettings();
  return (
    <Animated.View key={nav.kind} entering={crossFadeIn(motion)} exiting={crossFadeOut(motion)}>
      {nav.kind === 'rail' ? (
        <NavRail items={items} active={active} nav={nav} {...(collapse ? { collapse } : {})} />
      ) : (
        <BottomTabBar items={items} active={active} />
      )}
    </Animated.View>
  );
}
