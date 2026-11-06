/**
 * Mount-on-demand for the kit BottomSheet: a COPY of step 79's
 * `features/session-live/use-sheet-presence.tsx` (F-79-2; D78 says step 91 lifts it into the kit,
 * after which this copy goes). Kept in this folder because screen steps write only their own
 * folders (P6) and do not import another screen's internals.
 *
 * Why (F-79-2): a kit sheet slides in only on a closed → open transition of `isOpen` that its
 * mounted, laid-out content sees, so a sheet mounted already open stays parked off-screen; and a
 * closed sheet still mounts gorhom, whose worklet closure trips Reanimated's Jest mapper. So the sheet
 * mounts on request, opens one frame after its content's first layout, and unmounts `exitMs` after
 * it closes.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

export const SHEET_EXIT_MS = 450;

export interface SheetPresence {
  /** Render the sheet at all. */
  readonly mounted: boolean;
  /** The kit's `isOpen`. */
  readonly open: boolean;
  /** Stable setter for `SheetContentSignal`. */
  readonly setContentMounted: (mounted: boolean) => void;
}

export function useSheetPresence(requested: boolean, exitMs = SHEET_EXIT_MS): SheetPresence {
  const [mounted, setMounted] = useState(requested);
  const [contentMounted, setContentMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [previous, setPrevious] = useState(requested);

  // React's "adjust state when a prop changes", during render rather than in an effect.
  if (previous !== requested) {
    setPrevious(requested);
    if (requested) setMounted(true);
    else setReady(false);
  }

  const canOpen = requested && contentMounted;
  useEffect(() => {
    if (canOpen) {
      const frame = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(frame);
    }
    if (requested || !mounted) return undefined;
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [canOpen, requested, mounted, exitMs]);

  return { mounted: mounted || requested, open: requested && ready, setContentMounted };
}

/** Wraps a sheet's content and reports its first non-empty layout (and its unmount). */
export function SheetContentSignal({ onChange, children }: { onChange: (mounted: boolean) => void; children: ReactNode }) {
  useEffect(() => () => onChange(false), [onChange]);
  return (
    <View
      testID="summary-sheet-content-signal"
      onLayout={(event) => {
        if (event.nativeEvent.layout.height > 0) onChange(true);
      }}
    >
      {children}
    </View>
  );
}
