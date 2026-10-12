/**
 * Full hash value sheet (04_mobile_specs §4.7 "Tapping a hash opens a BottomSheet with the full
 * value as `Text selectable` (long-press copy is native; no clipboard dependency is added)").
 *
 * Kit `BottomSheet`, mounted only while open or closing (`useSheetPresence`, F-79-2) and
 * content-sized (scrolling bodies stayed parked on dems_phone). The kit portals the content above
 * the simulator's provider, so everything arrives as props; nothing in here calls `useSim`.
 */
import { BottomSheet } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';
import { useConfirmedOpen } from '@/lib/sheet-open';

export interface HashSheetValue {
  /** Row label, for example "VIDEO-01 · Camera 1" or "Manifest hash". */
  label: string;
  value: string;
  /** Extra line under the value (the simulated-signature note). */
  note?: string;
}

export interface HashSheetProps {
  /** The value to show; null closes the sheet. */
  value: HashSheetValue | null;
  onClose: () => void;
}

export function HashSheet({ value, onClose }: HashSheetProps) {
  const { t } = useTranslation();
  const presence = useSheetPresence(value !== null);
  // Fix wave J round two (JM-02 is the app's, not only the Evidence sheets'): the open is confirmed, and asked again when the sheet library dropped it.
  const confirmed = useConfirmedOpen(presence.open, onClose, { testID: 'summary-hash-sheet' });
  if (!presence.mounted) return null;
  return (
    <BottomSheet isOpen={confirmed.kitOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content onAnimate={confirmed.onAnimate}>
          <SheetContentSignal onChange={presence.setContentMounted}>
            <View style={styles.header} testID="summary-hash-sheet">
              <View style={styles.headerText}>
                <BottomSheet.Title>{t('features.session-summary.hashes.sheetTitle', { label: value?.label ?? '' })}</BottomSheet.Title>
                <BottomSheet.Description>{t('features.session-summary.hashes.sheetBody')}</BottomSheet.Description>
              </View>
              {/* Also closes directly, so a close within the opening frame is never lost. */}
              <BottomSheet.Close accessibilityLabel={t('features.session-summary.hashes.close')} testID="summary-hash-sheet-close" onPress={onClose} />
            </View>
            <View style={styles.valueBox}>
              <Text selectable maxFontSizeMultiplier={1.2} style={styles.value} testID="summary-hash-sheet-value">
                {value?.value ?? ''}
              </Text>
            </View>
            {value?.note ? (
              <Text maxFontSizeMultiplier={1.2} style={styles.note}>
                {value.note}
              </Text>
            ) : null}
          </SheetContentSignal>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[2] },
  headerText: { flex: 1, gap: spacing[0] },
  valueBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.sealed,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  value: {
    fontFamily: fontFamily.native.mono,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.4,
    color: palette.foreground,
  },
  note: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    marginBottom: spacing[2],
  },
});
