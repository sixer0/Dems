import { router, useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import { useCallback } from 'react';
import { reportNavigationIssue } from './log';
import { ALL_TABS, TAB_DESTINATIONS, type TabHref, type TabName } from './routes';

/**
 * Opening another tab at its ROOT from inside a screen (closing-fix row CF-M2, defect R-P-3).
 *
 * `router.push('/devices')` from Settings does not open the Devices list when the Devices tab still
 * holds a pushed detail: Expo Router turns the push into a NAVIGATE on the tab navigator with nested
 * params `{ screen: 'index' }`, and the Devices stack, whose top route is the detail, pushes a second
 * list over it ([list, detail, list]); Back then shows the old detail and it takes three Backs to
 * reach Settings again.
 *
 * This opens the tab the way the kit's own tab trigger does with its `resetOnFocus` option
 * (`expo-router/ui`, `useTabTrigger().switchTab(name, { resetOnFocus: true })`, "Navigate and reset
 * the history on route focus"): a `JUMP_TO` on the tab navigator with `resetOnFocus`, which the kit's
 * `ExpoTabRouter` handles by dropping the tab's nested state, so the tab's stack starts again from
 * its initial route (the list). The tab history (`backBehavior="history"`) still records the jump,
 * so ONE Back returns to the screen that opened it. The navigator is found from the calling screen's
 * own navigation object (its nearest `tab` ancestor), not through the trigger hook, so a screen
 * mounted without the tab layout (a feature test bed) still works; it then falls back to
 * `router.navigate` and records why.
 */

/** The tab whose href this is (`/devices` -> `devices`). */
export function tabForHref(href: TabHref): TabName {
  const tab = ALL_TABS.find((name) => TAB_DESTINATIONS[name].href === href);
  // TabHref and TAB_DESTINATIONS are the same closed list, so this never happens at runtime.
  if (tab === undefined) throw new Error(`tabForHref: no tab for ${href}`);
  return tab;
}

type AnyNavigation = Pick<NavigationProp<ParamListBase>, 'getState' | 'getParent' | 'dispatch'>;

/** The nearest navigation object (the caller's own, then its parents) whose navigator is the tab navigator holding `tab`. */
export function findTabNavigation(from: AnyNavigation | undefined, tab: TabName): AnyNavigation | undefined {
  let current: AnyNavigation | undefined = from;
  while (current) {
    const state = current.getState() as { type?: string; routeNames?: readonly string[] } | undefined;
    if (state?.type === 'tab' && state.routeNames?.includes(tab)) return current;
    current = current.getParent<AnyNavigation | undefined>();
  }
  return undefined;
}

/**
 * Returns `open(href)`: shows that tab at its root screen (its list), as described above. Call the
 * hook in a screen rendered by a route (it reads the screen's navigation object).
 */
export function useOpenTabRoot(): (href: TabHref) => void {
  const navigation = useNavigation<AnyNavigation>();
  return useCallback(
    (href: TabHref) => {
      const tab = tabForHref(href);
      const tabs = findTabNavigation(navigation, tab);
      if (!tabs) {
        reportNavigationIssue('warn', 'navigation.tabRoot.open', 'No tab navigator above this screen; opened with router.navigate', { tab });
        router.navigate(href);
        return;
      }
      try {
        tabs.dispatch({ type: 'JUMP_TO', payload: { name: tab, resetOnFocus: true } });
      } catch (error) {
        reportNavigationIssue('error', 'navigation.tabRoot.open', error, { tab });
        router.navigate(href);
      }
    },
    [navigation],
  );
}
