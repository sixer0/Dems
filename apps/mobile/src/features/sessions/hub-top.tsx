/**
 * Top of the Sessions hub (04_mobile_specs §4.9 bullets 1-2): the active-session `SectionCard`
 * (MB 2's active-session card language: REC dot, recording timer, case and subject, "Return to
 * monitor") and the primary "Start New Session" button.
 *
 * - The card shows while the simulator's current session is RECORDING; a finalizing or interrupted
 *   session gets the same card with its own call to action (finalization, recovery), so the hub
 *   never hides a session that still needs the operator.
 * - "Start New Session" opens `/session/new?step=1`; during CREATE/PRECHECK/ARMED it continues the
 *   setup at its step (§3.7 table); while a session is busy it is disabled with a hint, matching the
 *   route guard that refuses `/session/new` then (§3.5).
 * - R2 (E-fix row FX-M2, E2E-P-5; decision D201): starting or continuing a setup needs
 *   `SESSION_START`. Without it (TECHNICIAN) the button is disabled with "Requires the Investigator
 *   role" (`useRoleGate`), as the web locks its Start; a role change pushed by the Core re-gates it.
 */
import { Button } from 'heroui-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatDuration } from '@dems/shared/realtime';
import { Permission, SEAL_RECORDING_KEPT_SENTENCE, faultKindLabelKey, isCoreNotRunningKind, useSim } from '@dems/shared/sim';
import { derived, fontFamily, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard, SubjectTypeChip } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { enterRise, triggerHaptic, useMotionPolicy, useMotionSettings } from '@/motion';
import { isSessionBusy, sessionResyncHref } from '@/navigation';
import { failedStartWords } from '@/features/capture-selector/capture-notices-model';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { useFailedStart } from '@/features/session-live/capture-start-notice';
import { useConnectingCameras } from '@/features/session-live/rec-indicator';
import { SealRetryControl, useSealBlocked, useSealBlockedOf } from '@/features/session-finalizing/seal-attention';
import { RecDot } from './rec-dot';
import { SessionStatusChip } from './session-status-chip';
import { activeRow, type SessionRow } from './sessions-model';
import { useSafePush } from './use-hand-off';
import { useActiveSessionFields, useCurrentSessionState, useLiveElapsedSeconds } from './use-sessions-data';

export const START_SESSION_HREF = '/session/new?step=1';

export interface HubTopProps {
  /** Stagger index of the first block (R1 enter). */
  index: number;
}

/** The active-session card (when listed) followed by the Start button. */
export function HubTop({ index }: HubTopProps) {
  const m = useMotionSettings();
  const fields = useActiveSessionFields();
  const row = fields ? activeRow(fields) : null;
  return (
    <View style={styles.stack}>
      {row ? (
        <Animated.View entering={enterRise(index, m)}>
          <ActiveSessionCard row={row} />
        </Animated.View>
      ) : null}
      <Animated.View entering={enterRise(index + (row ? 1 : 0), m)}>
        <StartButton />
      </Animated.View>
    </View>
  );
}

function ActiveSessionCard({ row }: { row: SessionRow }) {
  const { t } = useTranslation();
  const push = useSafePush();
  // Integration pass D7 item 3 (ux §8e.2; D84, D91 R-1 option A). Before the first durable fragment the
  // open session is "Connecting cameras…": no REC dot, no timer, no red recording border. A session that
  // recorded nothing (FAULT + `captureDurable: false`) says so in full and offers no recovery of evidence.
  const connecting = useConnectingCameras() && row.status === 'RECORDING';
  const failedStart = useFailedStart();
  const failedWords = failedStart !== null && row.status === 'FAULT' ? failedStartWords(t, failedStart) : null;
  // Closing pass J (G75b-03, D217 (5)): the restart fault of a Core in its own capture is worded from its member, never "Power failure".
  const coreNotRunning = useSim((s) => row.status === 'FAULT' && isCoreNotRunningKind(s, row.faultKind));
  const recording = row.status === 'RECORDING' && !connecting;
  const sealBlocked = useSealBlockedOf(row.status === 'FINALIZING' ? row.id : null);
  const action =
    row.status === 'RECORDING'
      ? { label: t('features.sessions.active.returnToMonitor'), href: '/session/live', variant: 'primary' as const }
      : row.status === 'FINALIZING'
        ? { label: t('features.sessions.active.openFinalizing'), href: '/session/finalizing', variant: 'primary' as const }
        : failedWords !== null
          ? { label: t('common.actions.viewDetails'), href: '/session/recovery', variant: 'danger' as const }
          : { label: t('features.sessions.active.openRecovery'), href: '/session/recovery', variant: 'danger' as const };

  return (
    <SectionCard testID="sessions-active" style={recording ? styles.cardRecording : undefined}>
      <View style={styles.activeHead}>
        {recording ? (
          <View style={styles.recLeft}>
            <RecDot testID="sessions-active-rec" />
            <Text maxFontSizeMultiplier={1.2} style={styles.recLabel}>
              {t('common.enums.sessionState.RECORDING')}
            </Text>
          </View>
        ) : (
          <SessionStatusChip status={row.status} sessionId={row.id} size="md" testID="sessions-active-status" />
        )}
        {recording ? <ActiveTimer /> : null}
      </View>
      <Text maxFontSizeMultiplier={1.2} style={styles.overline}>
        {t('features.sessions.active.label')}
      </Text>
      <Text selectable maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.activeId} testID="sessions-active-id">
        {row.id}
      </Text>
      <View style={styles.activeLine}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.mono}>
          {row.caseNumber}
        </Text>
        <SubjectTypeChip type={row.subjectType} size="sm" />
      </View>
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.subject}>
        {row.subjectName}
      </Text>
      {row.status === 'FINALIZING' && sealBlocked ? (
        // Fix wave I (re-gate 75, G75b-02): a blocked seal does not "take a few seconds".
        <Text maxFontSizeMultiplier={1.2} style={styles.body} testID="sessions-active-seal-blocked">
          {`${t('features.session-finalizing.sealAttention.hubBody')} ${SEAL_RECORDING_KEPT_SENTENCE}`}
        </Text>
      ) : row.status === 'FINALIZING' ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.body}>
          {t('features.sessions.active.finalizingBody')}
        </Text>
      ) : null}
      {row.status === 'FAULT' ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.body} testID="sessions-active-fault">
          {failedWords !== null
            ? `${failedWords.title}. ${failedWords.body}`
            : `${row.faultKind ? `${t(faultKindLabelKey(row.faultKind, coreNotRunning ? { coreNotRunning: true } : null))}. ` : ''}${t('features.sessions.active.faultBody')}`}
        </Text>
      ) : null}
      <Button
        testID="sessions-active-action"
        variant={action.variant}
        size="lg"
        onPress={() => {
          triggerHaptic('primaryPress');
          push(action.href, `active.${row.status.toLowerCase()}`, { sessionId: row.id });
        }}
      >
        <Button.Label>{action.label}</Button.Label>
      </Button>
    </SectionCard>
  );
}

/** HH:MM:SS on the simulator clock (C-6 `slide`; 1 Hz re-render of this component only). */
function ActiveTimer() {
  const { t } = useTranslation();
  const seconds = useLiveElapsedSeconds();
  const policy = useMotionPolicy();
  return (
    <RollingNumber
      value={seconds}
      mode="slide"
      format={{ kind: 'duration' }}
      motion={policy}
      size="h2"
      face="mono"
      color={palette.foreground}
      testID="sessions-active-timer"
      accessibilityLabel={t('features.sessions.active.timerLabel', { time: formatDuration(seconds * 1_000) })}
    />
  );
}

function StartButton() {
  const { t } = useTranslation();
  const push = useSafePush();
  const state = useCurrentSessionState();
  const startGate = useRoleGate(Permission.SESSION_START);
  const busy = isSessionBusy(state);
  // R2: no SESSION_START, no wizard (a busy session keeps its own reason, which comes first); an unknown role
  // locks it too, with "Checking your permissions…" (ruling W93-11).
  const locked = !busy && !startGate.allowed;
  const disabled = busy || locked;
  const setup = state === 'CREATE' || state === 'PRECHECK' || state === 'ARMED';
  const href = setup ? (sessionResyncHref(state) ?? START_SESSION_HREF) : START_SESSION_HREF;
  // Fix wave I (re-gate 75, G75b-02): the session that keeps the Core busy cannot be "finished" by the operator
  // when its seal is BLOCKED - the reason names that, by session.
  const sealBlocked = useSealBlocked();
  const busyHint = sealBlocked !== null ? t('features.session-finalizing.sealAttention.newSession', { sessionId: sealBlocked.sessionId }) : t('features.sessions.start.busyHint');
  const hint = busy ? busyHint : locked ? startGate.hint : null;
  return (
    <View style={styles.startWrap}>
      <Button
        testID="sessions-start"
        variant="primary"
        size="lg"
        isDisabled={disabled}
        accessibilityHint={hint ?? undefined}
        onPress={() => {
          if (disabled) return;
          triggerHaptic('primaryPress');
          push(href, 'start', { state });
        }}
      >
        <Plus size={20} color={disabled ? derived.foreground2 : palette.black} />
        <Button.Label>{setup ? t('features.sessions.start.continueSetup') : t('common.actions.startNewSession')}</Button.Label>
      </Button>
      {busy ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="sessions-start-busy">
          {busyHint}
        </Text>
      ) : locked && hint ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="sessions-start-locked">
          {hint}
        </Text>
      ) : null}
      {/* Fix wave J (JT-02): the blocked seal can be retried from here by the roles operation 33 allows. */}
      {sealBlocked !== null ? <SealRetryControl sessionId={sealBlocked.sessionId} compact testID="sessions-seal-retry" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing[2] },
  cardRecording: { borderWidth: 1, borderColor: withAlpha(palette.danger, 0.45) },
  activeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], minHeight: 40 },
  recLeft: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  recLabel: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: statusText.danger,
    letterSpacing: 0.4,
  },
  overline: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  activeId: {
    fontFamily: fontFamily.native.monoMedium,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
  },
  activeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  mono: {
    flexShrink: 1,
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: derived.foreground2,
  },
  subject: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  body: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  startWrap: { gap: spacing[0] },
  caption: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    textAlign: 'center',
  },
});
