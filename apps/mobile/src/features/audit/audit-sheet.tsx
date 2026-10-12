/**
 * Phone entry sheet (04_mobile_specs §4.16: "Row → BottomSheet"). The kit BottomSheet with the
 * step-79 mount-on-demand pattern (`use-sheet-presence.tsx`, copied, D78 F-79-2): mounted on request,
 * opened one frame after its content's first layout, unmounted after the exit animation. Two device
 * findings of step 83 carry over: the body scrolls in a fixed-height sheet (the record and both
 * hashes can outgrow a phone screen), and the sheet ignores the system reduce-motion setting (it never
 * snapped open under `?motion=off`) and takes the short reduced fade instead.
 *
 * Accessibility (fix wave J, JA2-16). The sheet library wraps its content in ONE accessible node,
 * role `adjustable`, named "Bottom Sheet" (`@gorhom/bottom-sheet` defaults): a screen reader lands on
 * that node and the title, the text and the controls inside are not offered one by one. The frame turns
 * the wrapper off (`accessible={false}`, no role, no name), so every element is reachable under its own
 * name; the content root is marked as a modal view; the kit names the dialog by its `Title` and closes
 * it on the Android Back key (it consumes the key, so the screen underneath is not left).
 */
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet } from 'heroui-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { spacing } from '@dems/shared/tokens';
import { REDUCED_FADE_MS, useMotionPolicy } from '@/motion';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';
import { useConfirmedOpen } from '@/lib/sheet-open';

export interface AuditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function AuditSheet({ isOpen, onClose, title, children }: AuditSheetProps) {
  const { t } = useTranslation();
  const reduced = useMotionPolicy() === 'reduced';
  const presence = useSheetPresence(isOpen);
  // Fix wave J round two (JM-02 is the app's, not only the Evidence sheets'): the open is confirmed, and asked again when the sheet library dropped it.
  const confirmed = useConfirmedOpen(presence.open, onClose, { testID: 'audit-sheet' });
  if (!presence.mounted) return null;
  return (
    <BottomSheet isOpen={confirmed.kitOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content onAnimate={confirmed.onAnimate}
          snapPoints={['88%']}
          enableDynamicSizing={false}
          enableOverDrag={false}
          contentContainerClassName="h-full"
          overrideReduceMotion={ReduceMotion.Never}
          accessible={false}
          accessibilityRole="none"
          accessibilityLabel=""
          {...(reduced ? { animationConfigs: { duration: REDUCED_FADE_MS } } : {})}
        >
          <SheetContentSignal onChange={presence.setContentMounted} style={styles.fill}>
           <View style={styles.fill} accessibilityViewIsModal>
            <View style={styles.header} testID="audit-sheet">
              <View style={styles.headerText}>
                <BottomSheet.Title>{title}</BottomSheet.Title>
              </View>
              {/* Also closes directly, so a close within the opening frame is never lost. */}
              <BottomSheet.Close accessibilityLabel={t('common.actions.close')} testID="audit-sheet-close" onPress={onClose} />
            </View>
            <BottomSheetScrollView contentContainerStyle={styles.body}>{children}</BottomSheetScrollView>
           </View>
          </SheetContentSignal>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[2] },
  headerText: { flex: 1, gap: spacing[0] },
  body: { paddingBottom: spacing[5] },
});
