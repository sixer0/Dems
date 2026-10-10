/**
 * The finished exports of an item on the tablet and the phone (wave H C2, finding 7; gate finding
 * G94-05; UX spec §6.6): what operation 40 lists in `exports`, newest first as the Core answers
 * them. The DOWNLOAD of a finished export is the web console's (the same rule as
 * `export-job-status.tsx`): each entry says "Download from the web console." and this app draws no
 * control and asks for no job and no download path.
 *
 * | The member | Drawn |
 * |-----------|-------|
 * | a list with entries | the title and one row per export: its ID, its kind, when it finished |
 * | an empty list | "No finished export of this item." |
 * | absent on an item whose status is EXPORTED | "Finished exports: not reported" (the item says it was exported; the list was not stated) |
 * | absent otherwise | nothing |
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import type { FinishedExportFact } from './item-facts';

export interface FinishedExportsProps {
  /** `exports` of operation 40; null: not reported. */
  exports: readonly FinishedExportFact[] | null;
  /** The item's own status is EXPORTED. */
  exported: boolean;
}

export function FinishedExports({ exports, exported }: FinishedExportsProps) {
  const { t } = useTranslation();
  if (exports === null && !exported) return null;
  return (
    <View style={styles.root} testID="evidence-finished-exports">
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label}>
        {t('evidence.itemFacts.exports.title')}
      </Text>
      {exports === null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('evidence.itemFacts.exports.notReported')}
        </Text>
      ) : exports.length === 0 ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('evidence.itemFacts.exports.none')}
        </Text>
      ) : (
        exports.map((entry) => (
          <View key={entry.exportId} style={styles.row} testID={`evidence-finished-export-${entry.exportId}`}>
            <Text maxFontSizeMultiplier={1.2} selectable style={styles.entry}>
              {t('evidence.itemFacts.exports.entry', { exportId: entry.exportId, kind: t(`evidence.exportJob.kind.${entry.kind}`) })}
            </Text>
            {entry.completedAt !== null ? (
              <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
                {t('evidence.itemFacts.exports.at', { at: `${formatDate(entry.completedAt, DATE_PATTERNS.dateTime)} ${formatDate(entry.completedAt, DATE_PATTERNS.zone)}` })}
              </Text>
            ) : null}
            <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
              {t('evidence.exportJob.downloadFromWeb')}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1], padding: spacing[2], borderRadius: radius.px.xl, borderWidth: 1, borderColor: derived.border, backgroundColor: derived.surfaceSecondary },
  row: { gap: 2, paddingTop: spacing[1], borderTopWidth: 1, borderTopColor: derived.separator },
  label: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.size * typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  entry: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
});
