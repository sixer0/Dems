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
 * Under reduced motion the frame renders a kit `Dialog` instead of the sheet (see the reduced
 * branch below); the testIDs (`<testID>`, `<testID>-close`) are the same in both forms.
 */
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, CloseButton, Dialog } from 'heroui-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SimContext, useSimInstance } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { useMotionPolicy } from '@/motion';

export const SHEET_EXIT_MS = 450;

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
  if (!presence.mounted) return null;
  const body = (
    <SimContext.Provider value={sim}>
      <View onLayout={() => setLaidOut(true)}>{children}</View>
    </SimContext.Provider>
  );
  if (reduced) {
    // Reduced motion (OS setting, the in-app override or `?motion=off`): a kit Dialog, which
    // cross-fades in place of the slide-up (03M §8). Device finding (step 83): under the kit's
    // 'disable-all' the gorhom sheet's snap did not always run on a fresh start, leaving the sheet
    // parked below the screen while its content (the player) was already running.
    return (
      <Dialog isOpen={presence.open} onOpenChange={(open) => (open ? undefined : onClose())}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content isSwipeable={false} testID={`${testID}-dialog`}>
            <View style={styles.header} testID={testID}>
              <View style={styles.headerText}>
                <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.dialogTitle}>
                  {title}
                </Text>
                {description ? (
                  <Text maxFontSizeMultiplier={1.2} style={styles.dialogDescription}>
                    {description}
                  </Text>
                ) : null}
                {badges ? <View style={styles.badges}>{badges}</View> : null}
              </View>
              <CloseButton accessibilityLabel={closeLabel} testID={`${testID}-close`} onPress={onClose} />
            </View>
            <ScrollView style={styles.dialogScroll} keyboardShouldPersistTaps="handled">
              <SimContext.Provider value={sim}>{children}</SimContext.Provider>
            </ScrollView>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    );
  }

  return (
    <BottomSheet isOpen={presence.open && laidOut} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
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
  dialogScroll: { maxHeight: 640 },
  dialogTitle: { fontFamily: fontFamily.native.semibold, fontSize: typography.h3.size, lineHeight: typography.h3.lineHeight, color: palette.foreground },
  dialogDescription: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.gray },
});
