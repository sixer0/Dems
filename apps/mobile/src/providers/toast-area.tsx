/**
 * Where the app's toasts may lie (fix wave Q, CT-04; D246: "place it where it covers no navigation").
 *
 * The kit lays its toasts over the whole window, from the top edge. On the tablet the persistent critical toast
 * then covered the page title, the clock, the bell, the account button and the rail's "Home" and "Sessions" for
 * as long as its alert stood; on the phone it covered the header. This wrapper (the kit's own `contentWrapper`)
 * makes the toast area the CONTENT area: below the header row (`NAV_DIMENSIONS.headerHeight`) and beside the
 * navigation rail of the window's layout class. The bottom tab bar of a phone is never reached by a top toast.
 * It takes no touch itself (`box-none`): only a toast does.
 */
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { NAV_DIMENSIONS, navChromeFor, useLayoutClass } from '@/layout';

/** The toast area's offsets from the window's safe area, for a window of this size. Pure. */
export function toastAreaOffsets(width: number, height: number): { readonly top: number; readonly start: number } {
  return { top: NAV_DIMENSIONS.headerHeight, start: navChromeFor(width, height).railWidth };
}

function ToastArea({ children }: { children: ReactNode }) {
  const { width, height } = useLayoutClass();
  const { top, start } = toastAreaOffsets(width, height);
  return (
    // A margin, not a padding: the kit positions its toasts against this view's own box.
    <View pointerEvents="box-none" testID="toast-area" style={{ flex: 1, marginTop: top, marginStart: start }}>
      {children}
    </View>
  );
}

/** The kit's `toast.contentWrapper`. */
export const toastContentWrapper = (children: ReactNode): ReactElement => <ToastArea>{children}</ToastArea>;
