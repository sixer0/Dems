/**
 * The state of one accepted export, read from the Core until the job is finished (blueprint row 92;
 * UX spec flow 5 step 7, §6.5): Queued / Running with the Core's percent, Complete with the hash
 * and the signature of the export manifest, or FAILED with the Core's cause (a failed job is an
 * answer, worded as a FAIL — never as an error of this screen).
 *
 * A composite is marked "Derived output — not the sealed evidence"; a composite job that ends
 * `COMPOSITE_ENCODER_NOT_SELECTED` reads "Composite video is not available in this build" (a state
 * of the product, not a fault of the operator). The line says "The export is stored on the Core";
 * the DOWNLOAD of a finished export is the web console's (UX §6.6 gives tablet and phone none): when
 * the Core names one, this screen adds "Download from the web console." and draws no control (fix
 * pass F-M8, R93-05). Plain views and the kit; the
 * bar is a static width, nothing here is animated (E-13).
 */
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from 'heroui-native';
import { RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSimInstance } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { KeyValueList, StatusChip } from '@/components/kit';
import { ExportJobReadError, exportJobQueryKey, useExportJob } from './export-job';
import { COMPOSITE_NOT_SELECTED, exportJobIdOf, type ExportJobStatus as JobStatus } from './export-job-model';

const STATUS_TONE = { QUEUED: 'default', RUNNING: 'info', COMPLETE: 'success', FAILED: 'danger' } as const satisfies Record<JobStatus, 'default' | 'info' | 'success' | 'danger'>;
const RETRY_BASE_MS = 3_000;
const RETRY_MAX = 3;
const short = (hash: string): string => `${hash.slice(0, 16)}…`;

export interface ExportJobStatusProps {
  /** The export ID of the accepted request (operation 42, `EXP-NNNNNN`). */
  exportId: string;
  /** The job the 202 answer named, when it named one. */
  jobId?: string | null;
}

export function ExportJobStatus({ exportId, jobId: answeredJobId = null }: ExportJobStatusProps) {
  const { t } = useTranslation();
  const sim = useSimInstance();
  const queryClient = useQueryClient();
  const jobId = exportJobIdOf(exportId, answeredJobId);
  const query = useExportJob(jobId);
  const [retry, setRetry] = useState({ attempts: 0, until: 0 });

  const job = query.data ?? null;
  const unknown = jobId === null || (query.error instanceof ExportJobReadError && query.error.unknownJob);
  const readFailed = query.isError && !unknown;
  const coreNow = sim.store.getState().clock.now;
  const canRetry = retry.attempts < RETRY_MAX && coreNow >= retry.until && jobId !== null;
  const readAgain = () => {
    const now = sim.store.getState().clock.now;
    if (jobId === null || retry.attempts >= RETRY_MAX || now < retry.until) return;
    setRetry({ attempts: retry.attempts + 1, until: now + RETRY_BASE_MS * 2 ** retry.attempts });
    void queryClient.invalidateQueries({ queryKey: exportJobQueryKey(jobId), exact: true });
  };
  const compositeUnavailable = job?.failureReason === COMPOSITE_NOT_SELECTED;

  return (
    <View style={styles.root} testID={`evidence-export-job-${job?.status ?? (unknown ? 'UNKNOWN' : readFailed ? 'READ_FAILED' : 'WAITING')}`}>
      <View style={styles.head}>
        <Text maxFontSizeMultiplier={1.2} style={styles.strong}>
          {t('evidence.exportJob.title', { jobId: job?.jobId ?? jobId ?? exportId })}
        </Text>
        {job !== null ? (
          <>
            <StatusChip size="sm" tone={STATUS_TONE[job.status]} icon={null} label={t(`evidence.exportJob.status.${job.status}`)} testID="evidence-export-job-status" />
            <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
              {t(`evidence.exportJob.kind.${job.kind}`)}
            </Text>
            {job.derived ? <StatusChip size="sm" tone="warning" icon={null} label={t('evidence.exportJob.derived')} testID="evidence-export-job-derived" /> : null}
          </>
        ) : null}
      </View>

      {job === null && !unknown && !readFailed ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-export-job-waiting">
          {t('evidence.exportJob.waiting')}
        </Text>
      ) : null}

      {job !== null && (job.status === 'QUEUED' || job.status === 'RUNNING') ? (
        <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: job.shownPct }} testID="evidence-export-job-progress">
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${job.shownPct}%` }]} />
          </View>
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-export-job-percent">
            {t('evidence.exportJob.progress', { percent: job.shownPct })}
          </Text>
        </View>
      ) : null}

      {job?.status === 'COMPLETE' ? (
        <View testID="evidence-export-job-complete">
          <KeyValueList
            items={[
              { id: 'manifestHash', label: t('evidence.exportJob.manifestHash'), value: job.manifestHash !== null ? short(job.manifestHash) : '—', mono: true },
              { id: 'signature', label: t('evidence.exportJob.signature'), value: job.signature !== null ? short(job.signature) : '—', mono: true },
            ]}
          />
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-export-job-on-core">
            {t('evidence.exportJob.onCore', { exportId })}
          </Text>
          {/* Fix F-M8 (R93-05): the UX spec gives the download to the web console only (§6.6); this app says where it is. */}
          {job.downloadable ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-export-job-download-from-web">
              {t('evidence.exportJob.downloadFromWeb')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {job?.status === 'FAILED' ? (
        // A composite that cannot be made in this build is a state of the product, not a fault of the operator.
        <Alert status={compositeUnavailable ? 'warning' : 'danger'} testID={`evidence-export-job-failed-${compositeUnavailable ? 'composite' : 'cause'}`}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {compositeUnavailable
                ? t('evidence.exportJob.compositeUnavailable')
                : job.failureReason !== null
                  ? t('evidence.exportJob.failed', { reason: job.failureReason })
                  : t('evidence.exportJob.failedNoReason')}
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      {unknown ? (
        <Text maxFontSizeMultiplier={1.2} style={[styles.caption, styles.failText]} accessibilityRole="alert" testID="evidence-export-job-unknown">
          {t('evidence.exportJob.unknown')}
        </Text>
      ) : null}
      {readFailed ? (
        <View style={styles.head} accessibilityRole="alert" testID="evidence-export-job-read-failed">
          <Text maxFontSizeMultiplier={1.2} style={[styles.caption, styles.failText]}>
            {t('evidence.exportJob.pollFailed')}
          </Text>
          <Button size="sm" variant="outline" onPress={readAgain} isDisabled={!canRetry} testID="evidence-export-job-retry">
            <RotateCcw size={16} color={canRetry ? palette.gold : palette.gray} />
            <Button.Label>{retry.attempts >= RETRY_MAX ? t('common.errors.maxRetries') : t('evidence.exportJob.retry')}</Button.Label>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1], padding: spacing[1] + 2, borderRadius: radius.px.lg, borderWidth: 1, borderColor: derived.separator, backgroundColor: derived.surfaceSecondary },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  bar: { height: 6, borderRadius: 3, backgroundColor: derived.border, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: palette.gold },
  strong: { fontFamily: fontFamily.native.semibold, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  failText: { color: statusText.danger },
});
