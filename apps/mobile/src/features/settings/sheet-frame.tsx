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
 */
import { BottomSheet } from 'heroui-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SimContext, useSimInstance } from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';

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
  if (!presence.mounted) return null;
  return (
    <BottomSheet isOpen={presence.open} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <SheetContentSignal onChange={presence.setContentMounted}>
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
