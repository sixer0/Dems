/**
 * Kit BottomSheet frame for the Evidence sheets (Play, Export; 04_mobile_specs §4.11 D6, §4.19).
 *
 * Two device findings of step 79 apply here as well (F-79-2 and its SimContext note), so this
 * feature keeps its own copy of the pattern (P6: another feature's files are not shared code):
 * - the kit portals sheet content to its host under HeroUINativeProvider, which sits ABOVE the
 *   simulator's provider (04 §3.2 slots 7 and 9), so the frame re-provides the simulator;
 * - a kit sheet only slides in on a closed → open transition of `isOpen`, and a sheet mounted while
 *   closed still mounts a gorhom sheet. `useSheetPresence` mounts the sheet on request, opens it one
 *   frame later and unmounts it after the exit animation.
 *
 * Runtime-contract hooks (`useAuth`, …) do not reach portalled content either: sheets take what
 * they need as props.
 *
 * Under reduced motion the frame is the SAME sheet with a short fade (fix wave J round two, JM-08 ruling); it
 * used to be a kit `Dialog` there.
 */
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet } from 'heroui-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { useConfirmedOpen } from '@/lib/sheet-open';
import { SimContext, useSimInstance } from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { REDUCED_FADE_MS, useMotionPolicy } from '@/motion';

export const SHEET_EXIT_MS = 450;
// Fix wave J, JM-02: the confirmed open. Round two moved the rule to `@/lib/sheet-open` (every sheet of the app uses it).
export { SHEET_OPEN_CHECK_MS, SHEET_OPEN_RETRIES, useConfirmedOpen } from '@/lib/sheet-open';

export interface SheetPresence {
  /** Render the sheet at all. */
  readonly mounted: boolean;
  /** The kit's `isOpen`. */
  readonly open: boolean;
}

export function useSheetPresence(requested: boolean, exitMs: number = SHEET_EXIT_MS): SheetPresence {
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

export interface SheetFrameProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Header content right of the title (chips). */
  badges?: ReactNode;
  closeLabel: string;
  testID: string;
  /** Scroll the body (the export wizard with its reason field). */
  scroll?: boolean;
  /** Keep a drag inside the body from moving the sheet (the player's scrubber). */
  lockContentPan?: boolean;
  /**
   * Round two (JM-08 / JA2-20): false for a surface that holds typed input (the export wizard and its reason) - a
   * tap outside or a drag down does not discard it; its Close button and Android Back do. Default true.
   */
  dismissOnOutsidePress?: boolean;
  children: ReactNode;
}

export function SheetFrame({
  isOpen,
  onClose,
  title,
  description,
  badges,
  closeLabel,
  testID,
  scroll = false,
  lockContentPan = false,
  dismissOnOutsidePress = true,
  children,
}: SheetFrameProps) {
  const sim = useSimInstance();
  const reduced = useMotionPolicy() === 'reduced';
  const presence = useSheetPresence(isOpen);
  // Device finding (step 83): a sheet whose body needs more than a frame to lay out (the player's
  // VideoView, the wizard) stayed parked below the screen when it opened one frame after mounting.
  // The sheet therefore opens only once its body has reported a layout.
  const [laidOut, setLaidOut] = useState(false);
  if (!presence.mounted && laidOut) setLaidOut(false);
  // JT-23 / JM-04: a sheet that closes takes the keyboard of its own field with it - since fix wave Q the rule of
  // every sheet, in `useConfirmedOpen` (opening and closing).
  // JM-02: the open is confirmed by the library's own report of a slide, and asked again when none came.
  // Round two (JM-08 ruling: a multi-step or scrolling surface is a SHEET in both motion modes - it was a centred
  // Dialog under reduced motion, a different thing with a different way out). The reduced form is the sheet with
  // the short fade the app's other sheets use (`overrideReduceMotion`: a gorhom sheet never snapped open under
  // the reduced-motion config), and its open is confirmed like every other.
  const confirmed = useConfirmedOpen(presence.open && laidOut, onClose, { testID });
  if (!presence.mounted) return null;
  const body = (
    <SimContext.Provider value={sim}>
      <View onLayout={() => setLaidOut(true)}>{children}</View>
    </SimContext.Provider>
  );
  return (
    <BottomSheet isOpen={confirmed.kitOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay isCloseOnPress={dismissOnOutsidePress} />
        <BottomSheet.Content
          onAnimate={confirmed.onAnimate}
          overrideReduceMotion={ReduceMotion.Never}
          {...(reduced ? { animationConfigs: { duration: REDUCED_FADE_MS } } : {})}
          {...(dismissOnOutsidePress ? {} : { enablePanDownToClose: false })}
          {...(scroll
            ? {
                snapPoints: ['92%'],
                enableDynamicSizing: false,
                enableOverDrag: false,
                contentContainerClassName: 'h-full',
              }
            : {})}
          {...(lockContentPan ? { enableContentPanningGesture: false } : {})}
        >
          <View style={styles.header} testID={testID}>
            <View style={styles.headerText}>
              <BottomSheet.Title>{title}</BottomSheet.Title>
              {description ? <BottomSheet.Description>{description}</BottomSheet.Description> : null}
              {badges ? <View style={styles.badges}>{badges}</View> : null}
            </View>
            <BottomSheet.Close accessibilityLabel={closeLabel} testID={`${testID}-close`} onPress={onClose} />
          </View>
          {scroll ? (
            <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollBody}>
              {body}
            </BottomSheetScrollView>
          ) : (
            body
          )}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[2] },
  headerText: { flex: 1, gap: spacing[0] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  scrollBody: { paddingBottom: spacing[5] },
});
