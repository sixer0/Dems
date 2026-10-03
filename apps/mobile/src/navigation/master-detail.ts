import { useFocusEffect, useNavigation, useRouter, type Href } from 'expo-router';
import { StackActions } from 'expo-router/react-navigation';
import { useCallback } from 'react';
import { useLayoutClass } from '@/layout';

/**
 * Master-detail routing (04_mobile_specs §2.4, §2.5 rule 3). One list route holds the selection in
 * `?selected=`; the detail also has its own route for single-pane windows:
 *
 * - multi-pane (medium, expanded): `/evidence?selected=<id>` shows list and detail side by side;
 *   the detail route `/evidence/<id>` (a deep link, or a window that just grew) hands over to it;
 * - single-pane (compact, compact-landscape): selecting pushes `/evidence/<id>`; a `?selected=`
 *   left over from a wider window (a tablet split-screen that shrank) becomes that pushed detail,
 *   so Back returns to the list.
 *
 * Used by the Evidence, Devices, Sessions and Settings route pairs (§2.4 gives each a list |
 * detail layout on medium and expanded). Both sides act in a focus effect, like Expo Router's own
 * `<Redirect>`: only the focused route navigates, and never before the root navigator is mounted.
 */
export type MasterListPath = '/evidence' | '/devices' | '/sessions' | '/settings';

/** The list route's side: on a single-pane window a selection becomes a pushed detail route. */
export function useSelectionPush(listPath: MasterListPath, selectedId: string | null): void {
  const { isMultiPane } = useLayoutClass();
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      if (isMultiPane || selectedId === null) return;
      router.setParams({ selected: undefined });
      router.push(`${listPath}/${selectedId}` as Href);
    }, [isMultiPane, selectedId, listPath, router]),
  );
}

/**
 * The detail route's side: on a multi-pane window it returns to the list with `?selected=<id>`
 * (`POP_TO` the stack's `index`: pops a pushed detail, or reveals the anchor list under a
 * deep-linked one, replacing the list's params so none of the detail's path params leak into its
 * URL). Returns true while that hand-over is pending, so the route renders nothing in between. A
 * `null` id (malformed) is left to the route, which redirects to the list.
 */
export function useDetailPaneHandover(id: string | null): boolean {
  const { isMultiPane } = useLayoutClass();
  const navigation = useNavigation();
  const handOver = isMultiPane && id !== null;
  useFocusEffect(
    useCallback(() => {
      if (!handOver || id === null) return;
      navigation.dispatch(StackActions.popTo(LIST_ROUTE, { selected: id }));
    }, [handOver, id, navigation]),
  );
  return handOver;
}

/** The list's route name inside each master-detail stack (`<tab>/index.tsx`). */
const LIST_ROUTE = 'index';
