/**
 * Mount-on-demand for kit sheets. Copied from step 79 (`session-live/use-sheet-presence.tsx`) for the
 * Audit entry sheet (step 87; P6: another feature's files are not shared code; D78 F-79-2). Step 79
 * finding F-79-2:
 *
 * - A kit sheet only slides in on a closed → open TRANSITION of `isOpen` that its content sees
 *   (HeroUI Native `BottomSheetContentContainer` snaps on that edge; gorhom mounts at index −1). A
 *   sheet whose content mounts already open stays parked off-screen (seen on dems_phone). Portal
 *   content mounts a commit or more after the portal itself, so a fixed one-frame delay is not
 *   enough for every sheet (the Popover's bottom-sheet presentation stayed parked with it).
 * - A sheet mounted while closed still mounts a gorhom sheet, whose worklet closure holds the whole
 *   `react-native` module; in Jest, Reanimated's JS mapper walks it and hits the native-less
 *   `DevMenu` getter. Keeping closed sheets unmounted keeps every other screen suite that renders
 *   the monitor (for example step 57's T-M11) free of that.
 *
 * So: `mounted` turns true as soon as `requested` does; `open` turns true one frame after the
 * sheet's content reports its first layout (`<SheetContentSignal onChange={presence.setContentMounted}>`
 * around the content), or one frame after the request for presentations whose content only mounts
 * when open (`awaitContent: false`, the anchored popover). After a close the sheet stays mounted for `exitMs` so its exit
 * animation can play, then unmounts.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

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
export function SheetContentSignal({
  onChange,
  style,
  children,
}: {
  onChange: (mounted: boolean) => void;
  /** Step 87: lets a fixed-height (scrolling) sheet give the wrapper `flex: 1`. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  useEffect(() => () => onChange(false), [onChange]);
  return (
    <View
      style={style}
      testID="sheet-content-signal"
      onLayout={(event) => {
        if (event.nativeEvent.layout.height > 0) onChange(true);
      }}
    >
      {children}
    </View>
  );
}
