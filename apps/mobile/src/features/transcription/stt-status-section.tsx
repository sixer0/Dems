/**
 * Settings → Transcription status (blueprint row 118; R-8, D20; ux §8a, tablet and phone columns;
 * C3 §2.5 operation 90). READ-ONLY on this device: the block draws enabled, backend, model, speaker
 * labelling, whether a credential is set, the last connection test and the "applies to the next
 * session" note. It has no switch, no field, no picker, no Save and no Test connection: those are
 * the web console's (G11, G12), and the tablet and phone "never receive" the credential.
 *
 * `SttStatusBlock` is self-contained so that the capture section of row 68 can embed it; until that
 * section lands it is mounted by `TranscriptionSection` as the Settings section `transcription`.
 *
 * Error handling (the three layers): a failed read shows a plain card (layer 1), is one record in the
 * persistent runtime log (layer 2, in `useSttConfig`), and offers a rate-limited retry, 3 s then 6 s
 * then 12 s with a visible countdown and at most 3 tries (layer 3). An earlier good answer stays on
 * screen with a note while a later read fails. Recording never depends on this block.
 */
import { Alert, Button, SkeletonGroup } from 'heroui-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { fontFamily, palette, spacing, typography, type StatusTone } from '@dems/shared/tokens';
import { KeyValueList, SectionCard, StatusChip, type KeyValueItem } from '@/components/kit';
import { RECOVERY_MAX_RETRIES, recoveryRetryCooldownMs } from '@/features/session-recovery/recovery-boundary';
import type { SttStatusView, SttTestOutcome } from './stt-status-model';
import { useSttConfig } from './use-stt-config';

const TEST_TEXT_KEY: Readonly<Record<SttTestOutcome, string>> = {
  NEVER: 'features.transcription.test.never',
  READY: 'features.transcription.test.ready',
  MODEL_MISSING: 'features.transcription.test.modelMissing',
  UNREACHABLE: 'features.transcription.test.unreachable',
};
const TEST_TONE: Readonly<Record<SttTestOutcome, StatusTone>> = {
  NEVER: 'default',
  READY: 'success',
  MODEL_MISSING: 'warning',
  UNREACHABLE: 'warning',
};

/** The Settings section body: the status block under a one-line "read-only" hint. */
export function TranscriptionSection() {
  const { t } = useTranslation();
  return (
    <View style={styles.stack} testID="settings-transcription">
      <Text maxFontSizeMultiplier={1.2} style={styles.hint} testID="stt-status-hint">
        {t('features.transcription.hint')}
      </Text>
      <SttStatusBlock />
    </View>
  );
}

export function SttStatusBlock() {
  const { t } = useTranslation();
  const read = useSttConfig();
  const retry = useRateLimitedRetry(read.retry, read.phase === 'ready');

  if (read.phase === 'signed-out') {
    return (
      <SectionCard title={t('features.transcription.card.title')} testID="stt-status-signed-out">
        <Text maxFontSizeMultiplier={1.2} style={styles.muted}>
          {t('features.transcription.signedOut')}
        </Text>
      </SectionCard>
    );
  }
  if (read.phase === 'loading') {
    return (
      <SkeletonGroup isLoading style={styles.skeletons} testID="stt-status-loading">
        <SkeletonGroup.Item className="h-48 w-full rounded-xl" />
      </SkeletonGroup>
    );
  }
  if (read.phase === 'error' || read.view === null) {
    const exhausted = retry.tries >= RECOVERY_MAX_RETRIES;
    return (
      <Alert status="warning" testID="stt-status-error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.transcription.error.title')}</Alert.Title>
          <Alert.Description>{exhausted ? t('features.transcription.error.maxRetries') : t('features.transcription.error.body')}</Alert.Description>
          {exhausted ? null : (
            <Button size="sm" variant="secondary" isDisabled={retry.cooldownS > 0} onPress={retry.run} testID="stt-status-retry">
              <Button.Label>{retry.cooldownS > 0 ? t('common.actions.retryIn', { seconds: retry.cooldownS }) : t('common.actions.retry')}</Button.Label>
            </Button>
          )}
        </Alert.Content>
      </Alert>
    );
  }
  return (
    <View style={styles.stack}>
      {read.stale ? (
        <Alert status="warning" testID="stt-status-stale">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t('features.transcription.stale')}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {read.view.pendingForNextSession ? (
        <Alert status="accent" testID="stt-status-pending">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('features.transcription.pending.title')}</Alert.Title>
            <Alert.Description>{t('features.transcription.pending.body')}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <SectionCard title={t('features.transcription.card.title')} description={t('features.transcription.card.description')} testID="stt-status-card">
        <KeyValueList items={rowsOf(read.view, t)} />
      </SectionCard>
    </View>
  );
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** One kit row per fact, in the order of ux §8a. Values are words and chips, never an input. */
function rowsOf(view: SttStatusView, t: Translate): KeyValueItem[] {
  const tested = view.test.testedAt === null ? null : formatDate(view.test.testedAt, DATE_PATTERNS.dateTimeMinutes);
  return [
    {
      id: 'enabled',
      label: t('features.transcription.rows.enabled'),
      value: <StatusChip tone={view.enabled ? 'success' : 'default'} label={t(view.enabled ? 'common.status.enabled' : 'common.status.disabled')} icon={null} size="sm" testID="stt-status-enabled-chip" />,
      testID: 'stt-status-enabled',
    },
    { id: 'backend', label: t('features.transcription.rows.backend'), value: t(`features.transcription.backend.${view.backend}`), testID: 'stt-status-backend' },
    { id: 'model', label: t('features.transcription.rows.model'), value: view.model, mono: true, testID: 'stt-status-model' },
    { id: 'labelling', label: t('features.transcription.rows.labelling'), value: t(view.labelling ? 'features.transcription.labelling.on' : 'features.transcription.labelling.off'), testID: 'stt-status-labelling' },
    { id: 'credential', label: t('features.transcription.rows.credential'), value: t(view.credentialSet ? 'features.transcription.credential.set' : 'features.transcription.credential.notSet'), testID: 'stt-status-credential' },
    {
      id: 'last-test',
      label: t('features.transcription.rows.lastTest'),
      value: (
        <View style={styles.testValue}>
          <StatusChip tone={TEST_TONE[view.test.outcome]} label={t(TEST_TEXT_KEY[view.test.outcome])} icon={null} size="sm" testID="stt-status-test-chip" />
          {tested === null ? null : (
            <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID="stt-status-test-at">
              {t('features.transcription.test.at', { time: tested })}
            </Text>
          )}
        </View>
      ),
      testID: 'stt-status-test',
    },
  ];
}

interface RateLimitedRetry {
  /** Tries made since the last good answer. */
  readonly tries: number;
  /** Seconds left of the cooldown; 0 when a try may be made. */
  readonly cooldownS: number;
  run(): void;
}

/**
 * The retry rule of the app's error layers, as `RecoveryBoundary` words it: the n-th try starts a
 * cooldown of `recoveryRetryCooldownMs(n)` (3 s, 6 s, 12 s) shown as a countdown, at most
 * `RECOVERY_MAX_RETRIES` tries; a good answer resets both.
 */
function useRateLimitedRetry(read: () => void, healthy: boolean): RateLimitedRetry {
  const [tries, setTries] = useState(0);
  const [cooldownS, setCooldownS] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  // A good answer resets both (state adjusted while rendering; the running interval stops itself at 0).
  const [wasHealthy, setWasHealthy] = useState(healthy);
  if (healthy !== wasHealthy) {
    setWasHealthy(healthy);
    if (healthy) {
      setTries(0);
      setCooldownS(0);
    }
  }

  const run = useCallback(() => {
    if (cooldownS > 0 || tries >= RECOVERY_MAX_RETRIES) return;
    const attempt = tries + 1;
    setTries(attempt);
    setCooldownS(Math.ceil(recoveryRetryCooldownMs(attempt) / 1000));
    stop();
    timer.current = setInterval(() => {
      setCooldownS((previous) => {
        const next = Math.max(0, previous - 1);
        if (next === 0) stop();
        return next;
      });
    }, 1000);
    read();
  }, [cooldownS, read, stop, tries]);

  return { tries, cooldownS, run };
}

const styles = StyleSheet.create({
  stack: { gap: spacing[3] },
  skeletons: { gap: spacing[2] },
  hint: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    paddingHorizontal: spacing[1],
  },
  muted: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  testValue: { alignItems: 'flex-end', gap: spacing[1] },
});
