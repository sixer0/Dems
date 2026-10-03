/**
 * Mount-on-demand for kit sheets: a copy of the session monitor's pattern
 * (`features/session-live/use-sheet-presence.tsx`, step 79 finding F-79-2; D78), kept in this
 * feature because another feature's files are not shared code (P6). Step 91 lifts it into the kit.
 *
 * - A kit sheet only slides in on a closed → open TRANSITION of `isOpen` that its content sees; a
 *   sheet whose content mounts already open stays parked off-screen (seen on dems_phone).
 * - A sheet mounted while closed still mounts a gorhom sheet (a worklet closure over the whole
 *   `react-native` module), so closed sheets stay unmounted.
 *
 * So: `mounted` turns true as soon as `requested` does; `open` turns true one frame after the
 * sheet's content reports its first layout (`<SheetContentSignal onChange={presence.setContentMounted}>`
 * around the content). After a close the sheet stays mounted for `exitMs` so its exit animation can
 * play, then unmounts.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

export const SHEET_EXIT_MS = 450;

export interface SheetPresenceOptions {
  /** Wait for the content's mount signal (default true); false = open one frame after mounting. */
  awaitContent?: boolean;
  exitMs?: number;
}

export interface SheetPresence {
  /** Render the sheet at all. */
  readonly mounted: boolean;
  /** The kit's `isOpen`. */
  readonly open: boolean;
  /** Stable setter for `SheetContentSignal`. */
  readonly setContentMounted: (mounted: boolean) => void;
}

export function useSheetPresence(requested: boolean, { awaitContent = true, exitMs = SHEET_EXIT_MS }: SheetPresenceOptions = {}): SheetPresence {
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

  // Open one frame after the request (anchored popover) or after the content's first layout.
  const canOpen = requested && (!awaitContent || contentMounted);
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

/**
 * Wraps a sheet's content: reports its first non-empty layout (and its unmount) to
 * `useSheetPresence`. Layout, not mount, is the signal: gorhom's dynamic sizing needs the content
 * measured before a snap takes effect (the timeline sheet stayed parked with a mount signal).
 */
export function SheetContentSignal({ onChange, children }: { onChange: (mounted: boolean) => void; children: ReactNode }) {
  useEffect(() => () => onChange(false), [onChange]);
  return (
    <View
      testID="sheet-content-signal"
      onLayout={(event) => {
        if (event.nativeEvent.layout.height > 0) onChange(true);
      }}
    >
      {children}
    </View>
  );
}
