/**
 * Kit `BottomSheet` frame for the Settings sheets (Profile, Run diagnostics, Licences; 04_mobile_specs
 * §4.15, §4.19). The step-79 findings apply (F-79-2):
 *
 * - the sheet mounts on request and opens one frame after its content's first layout
 *   (`useSheetPresence`), then unmounts after the exit animation;
 * - the kit portals content under HeroUINativeProvider, above the simulator's provider (04 §3.2
 *   slots 7 and 9), so the frame re-provides the simulator. Runtime-contract hooks (`useAuth`, …)
 *   do not reach portalled content either: sheets take what they need as props;
 * - content-sized sheets open reliably on dems_phone, scrolling ones stayed parked: every Settings
 *   sheet is short and content-sized.
 *
 * Accessibility (fix wave J, JA2-16). The sheet library wraps its content in ONE accessible node,
 * role `adjustable`, named "Bottom Sheet" (`@gorhom/bottom-sheet` defaults): a screen reader lands on
 * that node and the title, the text and the controls inside are not offered one by one. The frame turns
 * the wrapper off (`accessible={false}`, no role, no name), so every element is reachable under its own
 * name; the content root is marked as a modal view; the kit names the dialog by its `Title` and closes
 * it on the Android Back key (it consumes the key, so the screen underneath is not left).
 */
import { BottomSheet } from 'heroui-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SimContext, useSimInstance } from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';
import { useConfirmedOpen } from '@/lib/sheet-open';

export interface SheetFrameProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  testID: string;
  children: ReactNode;
}

export function SheetFrame({ isOpen, onClose, title, description, testID, children }: SheetFrameProps) {
  const { t } = useTranslation();
  const sim = useSimInstance();
  const presence = useSheetPresence(isOpen);
  // Fix wave J round two (JM-02 is the app's, not only the Evidence sheets'): the open is confirmed, and asked again when the sheet library dropped it.
  const confirmed = useConfirmedOpen(presence.open, onClose, { testID: testID });
  if (!presence.mounted) return null;
  return (
    <BottomSheet isOpen={confirmed.kitOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content onAnimate={confirmed.onAnimate} accessible={false} accessibilityRole="none" accessibilityLabel="">
          <SheetContentSignal onChange={presence.setContentMounted}>
           <View accessibilityViewIsModal>
            <View style={styles.header} testID={testID}>
              <View style={styles.headerText}>
                <BottomSheet.Title>{title}</BottomSheet.Title>
                {description ? <BottomSheet.Description>{description}</BottomSheet.Description> : null}
              </View>
              {/* Also closes directly, so a close within the opening frame is never lost. */}
              <BottomSheet.Close accessibilityLabel={t('features.settings.sheets.close')} testID={`${testID}-close`} onPress={onClose} />
            </View>
            <View style={styles.body}>
              <SimContext.Provider value={sim}>{children}</SimContext.Provider>
            </View>
           </View>
          </SheetContentSignal>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[2] },
  headerText: { flex: 1, gap: spacing[0] },
  body: { paddingBottom: spacing[4], gap: spacing[3] },
});
