/**
 * Phone entry sheet (04_mobile_specs §4.16: "Row → BottomSheet"). The kit BottomSheet with the
 * step-79 mount-on-demand pattern (`use-sheet-presence.tsx`, copied, D78 F-79-2): mounted on request,
 * opened one frame after its content's first layout, unmounted after the exit animation. Two device
 * findings of step 83 carry over: the body scrolls in a fixed-height sheet (the record and both
 * hashes can outgrow a phone screen), and the sheet ignores the system reduce-motion setting (it never
 * snapped open under `?motion=off`) and takes the short reduced fade instead.
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
  if (!presence.mounted) return null;
  return (
    <BottomSheet isOpen={presence.open} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={['88%']}
          enableDynamicSizing={false}
          enableOverDrag={false}
          contentContainerClassName="h-full"
          overrideReduceMotion={ReduceMotion.Never}
          {...(reduced ? { animationConfigs: { duration: REDUCED_FADE_MS } } : {})}
        >
          <SheetContentSignal onChange={presence.setContentMounted} style={styles.fill}>
            <View style={styles.header} testID="audit-sheet" accessibilityLabel={t('features.audit.detail.sheetLabel')}>
              <View style={styles.headerText}>
                <BottomSheet.Title>{title}</BottomSheet.Title>
              </View>
              {/* Also closes directly, so a close within the opening frame is never lost. */}
              <BottomSheet.Close accessibilityLabel={t('common.actions.close')} testID="audit-sheet-close" onPress={onClose} />
            </View>
            <BottomSheetScrollView contentContainerStyle={styles.body}>{children}</BottomSheetScrollView>
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
