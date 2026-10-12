/**
 * The recovery analysis: the C-4 Stepper `pipeline` (vertical; 04_mobile_specs §4.8, 03_motion_spec
 * M-C-09) over the five checks of the book's §18.1 RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS, and
 * the per-track integrity rows (VIDEO-01/02, AUDIO-01/02). A running check shows the kit Spinner; a
 * finished one draws its check (300 ms) or, when its finding needs attention, turns amber after one
 * halo pulse and holds the colour (03M P7, R8). The pace is the simulator's 3 s (SIM-GAP-M81-3).
 */
import { Spinner } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { formatClock, formatDuration } from '@dems/shared/realtime';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { Stepper, type StepDef, type StepStatusWords } from '@/components/composed/stepper';
import { KeyValueList, StatusChip, type KeyValueItem } from '@/components/kit';
import { useMotionSettings } from '@/motion';
import {
  RECOVERY_STEPS,
  findingsFor,
  pipelineStatuses,
  trackChecking,
  trackIssueCount,
  trackResolved,
  type RecoveryPhase,
  type RecoveryStepKey,
  type TrackFinding,
  type TrackIntegrity,
} from './recovery.model';
import type { RecoveryAnalysis } from './use-recovery';

/** The Stepper's screen-reader words from this feature's i18n ("Step 2 of 5, …, in progress"). */
export function useRecoveryStepperWords(): StepStatusWords {
  const { t } = useTranslation();
  return {
    step: t('features.session-recovery.stepper.step'),
    of: t('features.session-recovery.stepper.of'),
    pending: t('features.session-recovery.stepper.pending'),
    active: t('features.session-recovery.stepper.active'),
    running: t('features.session-recovery.stepper.running'),
    done: t('features.session-recovery.stepper.done'),
    warn: t('features.session-recovery.stepper.warn'),
    error: t('features.session-recovery.stepper.error'),
  };
}

/** The one-line result each finished step shows under its label. */
export function useStepDetails(analysis: RecoveryAnalysis): Readonly<Record<RecoveryStepKey, string>> {
  const { t } = useTranslation();
  const { tracks, segment, time } = analysis;
  const issues = trackIssueCount(tracks);
  const noMedia = tracks.every((finding) => finding.integrity === 'noMedia');
  return {
    scan: t('features.session-recovery.stepDetail.scan'),
    tracks: noMedia
      ? t('features.session-recovery.stepDetail.tracksNoMedia')
      : issues > 0
        ? t('features.session-recovery.stepDetail.tracksIssues', { count: issues })
        : t('features.session-recovery.stepDetail.tracksAllIntact'),
    segment:
      segment.endsAt === null
        ? t('features.session-recovery.stepDetail.segmentNone')
        : t('features.session-recovery.stepDetail.segment', { time: formatClock(segment.endsAt), length: formatDuration(segment.lengthMs) }),
    time:
      time.to === null
        ? t('features.session-recovery.stepDetail.timeLocked', { source: time.from })
        : t('features.session-recovery.stepDetail.timeFallback', { from: time.from, to: time.to, time: formatClock(time.at) }),
    analysis: t('features.session-recovery.stepDetail.analysis'),
  };
}

export interface RecoveryPipelineProps {
  phase: RecoveryPhase;
  milestone: number;
  analysis: RecoveryAnalysis;
  testID?: string;
}

export function RecoveryPipeline({ phase, milestone, analysis, testID = 'recovery-pipeline' }: RecoveryPipelineProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const words = useRecoveryStepperWords();
  const details = useStepDetails(analysis);
  const statuses = pipelineStatuses(phase, milestone, findingsFor(analysis.tracks, analysis.time));
  const steps: StepDef[] = RECOVERY_STEPS.map((key, index) => {
    const finished = statuses[index] === 'done' || statuses[index] === 'warn';
    return {
      key,
      label: t(`features.session-recovery.steps.${key}`),
      ...(finished ? { description: details[key] } : {}),
    };
  });
  return (
    <Stepper
      // Reduced motion: remount per status change so each badge mounts with its final glyph (step 78
      // S78-7: Fabric can drop the one synchronous reduced-motion update of a not-yet-mounted glyph).
      key={settings.policy === 'reduced' ? statuses.join('|') : 'pipeline'}
      testID={testID}
      steps={steps}
      statuses={statuses}
      orientation="vertical"
      motion={settings.policy}
      statusWords={words}
    />
  );
}

const INTEGRITY_TONE: Readonly<Record<TrackIntegrity, 'success' | 'warning' | 'danger' | 'default'>> = {
  intact: 'success',
  degraded: 'warning',
  gap: 'danger',
  noMedia: 'default',
};

export interface TrackRowsProps {
  phase: RecoveryPhase;
  milestone: number;
  tracks: readonly TrackFinding[];
}

/** VIDEO-01, VIDEO-02, AUDIO-01, AUDIO-02: waiting, checking (Spinner), then the result chip and line. */
export function TrackRows({ phase, milestone, tracks }: TrackRowsProps) {
  const { t } = useTranslation();
  const items: KeyValueItem[] = tracks.map((finding) => {
    const resolved = phase === 'complete' || (phase === 'analysing' && trackResolved(finding.track, milestone));
    const checking = trackChecking(finding.track, milestone, phase);
    let value;
    // JA2-17: the row's spoken state follows what it shows.
    let spokenValue: string | undefined;
    if (resolved) {
      const detail =
        finding.integrity === 'gap'
          ? t('features.session-recovery.track.gapDetail', { time: formatClock(finding.since) })
          : finding.integrity === 'degraded'
            ? t('features.session-recovery.track.degradedDetail', { time: formatClock(finding.since) })
            : finding.integrity === 'noMedia'
              ? t('features.session-recovery.track.noMediaDetail')
              : t('features.session-recovery.track.intactDetail');
      spokenValue = `${t(`features.session-recovery.track.${finding.integrity}`)}. ${detail}`;
      value = (
        <View style={styles.result} testID={`recovery-track-${finding.track}-result`}>
          <StatusChip
            size="sm"
            tone={INTEGRITY_TONE[finding.integrity]}
            icon={null}
            label={t(`features.session-recovery.track.${finding.integrity}`)}
          />
          <Text maxFontSizeMultiplier={1.2} style={styles.detail}>
            {detail}
          </Text>
        </View>
      );
    } else if (checking) {
      spokenValue = t('features.session-recovery.track.checking');
      value = (
        <View style={styles.checking}>
          <Spinner size="sm" color={palette.gold} />
          <Text maxFontSizeMultiplier={1.2} style={styles.detail}>
            {t('features.session-recovery.track.checking')}
          </Text>
        </View>
      );
    } else {
      value = t('features.session-recovery.track.waiting');
    }
    return {
      id: finding.track,
      label: `${t(`common.tracks.${finding.track}`)} · ${finding.track}`,
      value,
      ...(spokenValue === undefined ? {} : { spokenValue }),
      testID: `recovery-track-${finding.track}`,
    };
  });
  return <KeyValueList items={items} />;
}

const styles = StyleSheet.create({
  result: { alignItems: 'flex-end', gap: spacing[0] },
  checking: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  detail: {
    textAlign: 'right',
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
});
