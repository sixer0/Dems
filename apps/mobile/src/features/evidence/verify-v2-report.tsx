/**
 * The schema-v2 result of one Verify run, as the Core server answered it (blueprint row 87;
 * evidence package spec §D, §F.3; UX spec flow 5 step 6; MB-07 / MB-12).
 *
 * Top to bottom: FIRST the source line (row 92; R-11, spec §D.1: "DEVELOPMENT SOURCES — this
 * package was not recorded from production devices." with one entry per source, or the declared
 * production line, or "not trustworthy"; never collapsed, and nothing at all when the answer carries
 * no `sources` block); the transcript state of the package (row 119's fixed lines) and the
 * interrupted mark, when the answer carries them; one row per camera file (stored bytes, decrypted
 * bytes, fragment chain), the transcript hash, the manifest, the signature; on a failure the
 * fragment the answer names ("VIDEO-02 fragment 3 tampered (…)"); then the per-check list V-01 to
 * V-15, when the answer carries the report. The source line never changes the verdict.
 *
 * Every value drawn is the answer's (`verify-v2.ts`); a part the answer does not carry is not
 * drawn. Plain React Native views only: nothing here is animated, so there is no Reanimated state
 * to lose (E-13), and every row keeps a constant 1 px border whose colour alone says FAIL (E-15).
 */
import { CircleCheck, CircleMinus, CircleX, FileText, FlaskConical, ShieldQuestion } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { V2_SIGNING_KEY_LINE, V2_SOURCES_LINE, v2CheckName, v2FragmentLine, v2Rows, type V2Check, type V2Notice, type V2Row, type V2SigningKey, type V2Sources, type VerifyV2Answer } from './verify-v2';

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
      {answer.sources !== null ? <SourcesLine sources={answer.sources} /> : null}
      {answer.signingKey === 'DEVELOPMENT' || answer.signingKey === 'NOT_ESTABLISHED' ? <SigningKeyLine state={answer.signingKey} /> : null}
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
          {answer.failedFragmentCount !== null && answer.failedFragmentCount > answer.failedFragments.length ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.body} testID="evidence-v2-fragments-more">
              {t('evidence.verifyV2.fragment.more', { count: answer.failedFragmentCount - answer.failedFragments.length })}
            </Text>
          ) : null}
        </View>
      ) : null}
      {failed && !namesPlace && fileFailed ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-v2-fragment-not-named">
          {t('evidence.verifyV2.fragment.notNamed')}
        </Text>
      ) : null}

      {answer.checks !== null ? <CheckReport checks={answer.checks} /> : null}
      {answer.notices.length > 0 ? <Notices notices={answer.notices} /> : null}
    </View>
  );
}

/** The most audio intervals listed under the line; the rest are counted (a long session switches often). */
const SOURCE_INTERVALS_SHOWN = 8;

/**
 * The source line and its entries: an icon AND the words (never colour alone), a constant 1 px
 * border whose colour says which state (E-15). It is a plain view: no press, no collapse.
 */
/**
 * THE SIGNING-KEY LINE (fix pass F-M7, R88-07; D178), directly after the source line: a bordered
 * row like the source line, never collapsed, no press. A development key is the warning tone on a
 * result that passed as on one that failed; a key that is not established is the danger tone.
 */
function SigningKeyLine({ state }: { state: Exclude<V2SigningKey, 'NOT_DEVELOPMENT'> }) {
  const { t } = useTranslation();
  const development = state === 'DEVELOPMENT';
  const Icon = development ? FlaskConical : ShieldQuestion;
  const tone = development ? statusText.warning : statusText.danger;
  return (
    <View style={[styles.row, { borderColor: tone }]} accessibilityRole="text" testID={`evidence-v2-signing-key-${state}`}>
      <View style={styles.rowHead}>
        <Icon size={16} color={tone} />
        <Text maxFontSizeMultiplier={1.2} style={[styles.sourceLine, { color: tone }]}>
          {t(V2_SIGNING_KEY_LINE[state])}
        </Text>
      </View>
    </View>
  );
}

/** WHAT THE PACKAGE SIGNATURE DOES NOT COVER (R88-06): each statement of the verifier, with the Core's own line. */
function Notices({ notices }: { notices: readonly V2Notice[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.list} accessibilityLabel={t('evidence.verifyV2Key.noticesTitle')} testID="evidence-v2-notices">
      <Text maxFontSizeMultiplier={1.2} style={styles.strong}>
        {t('evidence.verifyV2Key.noticesTitle')}
      </Text>
      {notices.map((notice) => (
        <Text key={notice.code} maxFontSizeMultiplier={1.2} style={styles.caption} testID={`evidence-v2-notice-${notice.code}`}>
          {notice.report}
        </Text>
      ))}
    </View>
  );
}

function SourcesLine({ sources }: { sources: V2Sources }) {
  const { t } = useTranslation();
  const line = t(V2_SOURCES_LINE[sources.state]);
  if (sources.state === 'DECLARED_PRODUCTION') {
    return (
      <Text maxFontSizeMultiplier={1.2} style={styles.strong} testID="evidence-v2-sources-DECLARED_PRODUCTION">
        {line}
      </Text>
    );
  }
  const development = sources.state === 'DEVELOPMENT';
  const Icon = development ? FlaskConical : ShieldQuestion;
  const tone = development ? statusText.warning : statusText.danger;
  const shown = sources.audioIntervals.slice(0, SOURCE_INTERVALS_SHOWN);
  const more = sources.audioIntervals.length - shown.length;
  return (
    <View style={[styles.row, { borderColor: tone }]} accessibilityRole="text" testID={`evidence-v2-sources-${sources.state}`}>
      <View style={styles.rowHead}>
        <Icon size={16} color={tone} />
        <Text maxFontSizeMultiplier={1.2} style={[styles.sourceLine, { color: tone }]} testID="evidence-v2-sources-line">
          {line}
        </Text>
      </View>
      {development ? (
        <View accessibilityLabel={t('evidence.sources.entriesTitle')} testID="evidence-v2-source-entries">
          {sources.tracks.map((track) => (
            <Text key={track.trackId} maxFontSizeMultiplier={1.2} style={styles.caption} testID={`evidence-v2-source-track-${track.trackId}`}>
              {t('evidence.sources.track', { track: track.trackId, device: track.deviceId, kind: t(`evidence.sources.kind.${track.sourceClass}`) })}
            </Text>
          ))}
          {shown.map((interval) => (
            <Text key={interval.seq} maxFontSizeMultiplier={1.2} style={styles.caption} testID={`evidence-v2-source-interval-${interval.seq}`}>
              {t('evidence.sources.interval', { seq: interval.seq, device: interval.micDeviceId, kind: t(`evidence.sources.kind.${interval.sourceClass}`) })}
            </Text>
          ))}
          {more > 0 ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
              {t('evidence.sources.moreIntervals', { count: more })}
            </Text>
          ) : null}
        </View>
      ) : null}
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
  sourceLine: { flex: 1, fontFamily: fontFamily.native.semibold, fontSize: typography.body.size, lineHeight: typography.body.lineHeight },
  rowLabel: { flex: 1, fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: derived.foreground2 },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] + 2 },
  checkName: { flex: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  strong: { fontFamily: fontFamily.native.semibold, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  passText: { color: statusText.success },
  failText: { color: statusText.danger },
});
