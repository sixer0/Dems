/**
 * The schema-v2 result of one Verify run, as the Core server answered it (blueprint row 87;
 * evidence package spec §D, §F.3; UX spec flow 5 step 6; MB-07 / MB-12).
 *
 * Top to bottom: the transcript state of the package (row 119's fixed lines) and the interrupted
 * mark, when the answer carries them; one row per camera file (stored bytes, decrypted bytes,
 * fragment chain), the transcript hash, the manifest, the signature; on a failure the fragment the
 * answer names ("VIDEO-02 fragment 3 tampered (…)"); then the per-check list V-01 to V-14, when the
 * answer carries the report.
 *
 * Every value drawn is the answer's (`verify-v2.ts`); a part the answer does not carry is not
 * drawn. Plain React Native views only: nothing here is animated, so there is no Reanimated state
 * to lose (E-13), and every row keeps a constant 1 px border whose colour alone says FAIL (E-15).
 */
import { CircleCheck, CircleMinus, CircleX, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { v2CheckName, v2FragmentLine, v2Rows, type V2Check, type V2Row, type VerifyV2Answer } from './verify-v2';

export interface VerifyV2ReportProps {
  answer: VerifyV2Answer;
}

export function VerifyV2Report({ answer }: VerifyV2ReportProps) {
  const { t } = useTranslation();
  const rows = v2Rows(answer);
  const failed = answer.verdict === 'FAIL';
  const namesPlace = answer.failedFragments.length > 0 || answer.chainBreaks.length > 0;
  const fileFailed = answer.files.some((file) => !file.ok);

  return (
    <View style={styles.root} testID={`evidence-verify-v2-${answer.verdict}`}>
      {answer.transcriptState !== null ? (
        <View style={styles.line} testID={`evidence-v2-transcript-state-${answer.transcriptState}`}>
          <FileText size={14} color={palette.gray} />
          <Text maxFontSizeMultiplier={1.2} style={styles.strong}>
            {t(`evidence.verifyV2.transcriptState.${answer.transcriptState}`)}
          </Text>
        </View>
      ) : null}
      {answer.interrupted === true ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-v2-interrupted">
          {t('evidence.verifyV2.interrupted')}
        </Text>
      ) : null}

      <View style={styles.list} accessibilityLabel={t('evidence.verifyV2.resultTitle')} testID="evidence-v2-rows">
        {rows.map((row) => (
          <ResultRow key={row.id} row={row} />
        ))}
      </View>

      {failed && namesPlace ? (
        <View style={[styles.row, styles.rowFail]} accessibilityRole="alert" testID="evidence-v2-fragments">
          <Text maxFontSizeMultiplier={1.2} style={[styles.strong, styles.failText]}>
            {t('evidence.verifyV2.fragment.title')}
          </Text>
          {answer.failedFragments.map((fragment) => (
            <Text key={`${fragment.trackId}#${fragment.seq}`} maxFontSizeMultiplier={1.2} style={styles.body} testID={`evidence-v2-fragment-${fragment.trackId}-${fragment.seq}`}>
              {v2FragmentLine(fragment, t)}
            </Text>
          ))}
          {answer.chainBreaks.map((chain) => (
            <Text key={chain.trackId} maxFontSizeMultiplier={1.2} style={styles.body} testID={`evidence-v2-chain-${chain.trackId}-${chain.fromSeq}`}>
              {t('evidence.verifyV2.fragment.chainOnly', { track: chain.trackId, from: chain.fromSeq })}
            </Text>
          ))}
        </View>
      ) : null}
      {failed && !namesPlace && fileFailed ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-v2-fragment-not-named">
          {t('evidence.verifyV2.fragment.notNamed')}
        </Text>
      ) : null}

      {answer.checks !== null ? <CheckReport checks={answer.checks} /> : null}
    </View>
  );
}

function ResultRow({ row }: { row: V2Row }) {
  const { t } = useTranslation();
  const Icon = row.ok ? CircleCheck : CircleX;
  const part = (ok: boolean): string => t(`evidence.verifyV2.outcome.${ok ? 'PASS' : 'FAIL'}`);
  const label = row.file ? t('evidence.verifyV2.file', { track: row.file.trackId }) : t(`evidence.verifyV2.rows.${row.id as 'transcript' | 'manifest' | 'signature'}`);
  return (
    <View style={[styles.row, row.ok ? null : styles.rowFail]} testID={`evidence-v2-row-${row.id}-${row.ok ? 'ok' : 'fail'}`}>
      <View style={styles.rowHead}>
        <Icon size={16} color={row.ok ? statusText.success : statusText.danger} />
        <Text maxFontSizeMultiplier={1.2} style={[styles.rowLabel, row.ok ? null : styles.failText]}>
          {label}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={[styles.strong, row.ok ? styles.passText : styles.failText]}>
          {part(row.ok)}
        </Text>
      </View>
      {row.file ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('evidence.verifyV2.fileParts', { stored: part(row.file.storedOk), plain: part(row.file.plainOk), chain: part(row.file.chainOk) })}
          {row.file.fragmentCount !== null ? ` · ${t('evidence.verifyV2.fragments', { count: row.file.fragmentCount })}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const CHECK_ICON = { PASS: CircleCheck, FAIL: CircleX, SKIPPED: CircleMinus } as const;
const CHECK_COLOR = { PASS: statusText.success, FAIL: statusText.danger, SKIPPED: palette.gray } as const;

function CheckReport({ checks }: { checks: readonly V2Check[] }) {
  const { t } = useTranslation();
  const passed = checks.filter((check) => check.status === 'PASS').length;
  return (
    <View style={styles.list} testID="evidence-v2-checks">
      <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
        <Text style={styles.strong}>{t('evidence.verifyV2.checksTitle')}</Text>
        {' · '}
        {t('evidence.verifyV2.checksSummary', { passed, total: checks.length })}
      </Text>
      {checks.map((check) => {
        const Icon = CHECK_ICON[check.status];
        const outcome =
          check.status === 'SKIPPED' && check.skipped !== null
            ? t(`evidence.verifyV2.skipped.${check.skipped}`)
            : check.status === 'FAIL' && check.failureClass !== null
              ? `${t('evidence.verifyV2.outcome.FAIL')} · ${t(`evidence.verifyV2.failureClass.${check.failureClass}`)}`
              : t(`evidence.verifyV2.outcome.${check.status}`);
        return (
          <View key={check.id} style={styles.checkLine} testID={`evidence-v2-check-${check.id}-${check.status}`}>
            <Icon size={14} color={CHECK_COLOR[check.status]} />
            <Text maxFontSizeMultiplier={1.2} style={[styles.checkName, check.status === 'FAIL' ? styles.failText : null]}>
              {v2CheckName(check.id, t)}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={[styles.caption, check.status === 'FAIL' ? styles.failText : null]}>
              {outcome}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1], marginTop: spacing[1] },
  list: { gap: spacing[0] + 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] + 2 },
  row: {
    gap: 2,
    padding: spacing[1] + 2,
    borderRadius: radius.px.lg,
    backgroundColor: derived.surfaceSecondary,
    // E-15: the border is always 1 px; a failure changes its colour only.
    borderWidth: 1,
    borderColor: derived.separator,
  },
  rowFail: { borderColor: statusText.danger },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  rowLabel: { flex: 1, fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: derived.foreground2 },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] + 2 },
  checkName: { flex: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  strong: { fontFamily: fontFamily.native.semibold, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  passText: { color: statusText.success },
  failText: { color: statusText.danger },
});
