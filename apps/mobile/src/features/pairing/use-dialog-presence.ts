/**
 * Mount-on-demand for the Unpair `Dialog`, copied from step 79's pattern
 * (`src/features/session-live/use-sheet-presence.tsx`, F-79-2; step 91 lifts it into the kit).
 *
 * A closed kit overlay still mounts its overlay hooks (S73-12), and a kit overlay animates in only
 * on a closed → open transition that its mounted content sees. So `mounted` turns true with the
 * request, `open` one frame later; after a close the dialog stays mounted for `exitMs` so its exit
 * can play, then unmounts. The Dialog's content only mounts while open, so there is no content
 * signal to wait for (the anchored-popover case of the original, `awaitContent: false`).
 */
import { useEffect, useState } from 'react';

export const DIALOG_EXIT_MS = 300;

export interface DialogPresence {
  /** Render the dialog at all. */
  readonly mounted: boolean;
  /** The kit's `isOpen`. */
  readonly open: boolean;
}

export function useDialogPresence(requested: boolean, exitMs: number = DIALOG_EXIT_MS): DialogPresence {
  const [mounted, setMounted] = useState(requested);
  const [ready, setReady] = useState(false);
  const [previous, setPrevious] = useState(requested);

  // React's "adjust state when a prop changes", during render rather than in an effect.
  if (previous !== requested) {
    setPrevious(requested);
    if (requested) setMounted(true);
    else setReady(false);
  }

  useEffect(() => {
    if (requested) {
      const frame = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(frame);
    }
    if (!mounted) return undefined;
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [requested, mounted, exitMs]);

  return { mounted: mounted || requested, open: requested && ready };
}
