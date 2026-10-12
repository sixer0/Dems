/**
 * A SEAL THAT NEEDS ATTENTION, on the tablet and the phone (fix wave I, driver C; re-gate 75 finding
 * G75b-02; rulings D186 (1), D216; contract note `delegation_progress/contract_wave_i.md`).
 *
 * The ONE reading is `sealAttentionOf({ session, alerts })` of `@dems/shared/sim` - no member of the
 * contract was added, and nothing here is derived from a client timer or an attempt count:
 *
 * | The Core says | The surface says |
 * |---|---|
 * | `RETRYING`: a step failed and the Core runs the seal again by itself | "Sealing is being retried", the Core's own sentence (it holds "retry n of N, in s s"), "The recording is kept on the Core."; the screen can be left |
 * | `BLOCKED`: the retries are used up; ONE alert `params.reason: SEAL_BLOCKED` | "Sealing is blocked", the alert's whole message (the cause in words and what restores the seal), the fixed sentence of the detail code when there is one, "The recording is kept on the Core.", who resolves it, and that the session stays open on the Core; the screen MUST be leavable |
 *
 * Never said while either holds: a percentage, "takes a few seconds", "this screen closes by itself",
 * "Resumed after restart" (`attempt` grows with every run of the seal, a restart or not: note §4).
 *
 * Fix wave L (G75d-02; ruling D228 (1); contract_wave_l.md section 2), closing pass L-Z: a BLOCKED seal
 * names no action that no screen offers. The CORE's alert sentence itself now says that an investigator
 * or a supervisor presses "Retry sealing" on the Session Monitor of the web console (`sealBlockedNotice`
 * of the Core, from `SEAL_RETRY_HOW_SENTENCE` of the shared package). The device draws that sentence as
 * the Core wrote it; under it: the sentence the Core writes on the failed step - sealing stopped after
 * `SEAL_AUTOMATIC_RETRIES` automatic retries and the Core waits (`sealStoppedSentence`, the SAME shared
 * function, so the device and the Core cannot differ) - who resolves the cause, and that THIS device has
 * no retry control. (L-M's mapping of "start recovery" to the web control is gone: the Core no longer
 * says "start recovery".)
 *
 * Fix wave J (JT-02; decision D243 reverses D228 (1)): a tablet-only operator was STUCK at a blocked seal -
 * the retry existed on the web console alone. `SealRetryControl` is the device's "Retry sealing": for the roles
 * operation 33 allows (`canRetryBlockedSeal`: investigator, supervisor) a button that asks first and then sends
 * operation 33 (`recover`); every other role reads who can. The Finalizing notice, the Session entry of Home
 * and the Sessions hub all use this one control.
 *
 * The same reading gives Home, the Sessions hub and the refused New Session their words
 * (`useSealBlocked`): the open session is shown as "Sealing blocked", and a new session is explained
 * as unavailable instead of failing.
 */
import { Alert, Button, Dialog, Spinner, useToast } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { settle, useCoreActions } from '@dems/shared/live';
import {
  SEAL_AUTOMATIC_RETRIES,
  SEAL_BLOCKED_DETAIL_SENTENCE,
  SEAL_RECORDING_KEPT_SENTENCE,
  canRetryBlockedSeal,
  selectOperator,
  sealAttentionOf,
  sealBlockedNoticeOf,
  sealStoppedSentence,
  useSim,
  type SealAttention,
} from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { reportRuntimeIssue, useCoreErrorPresenter, useCoreLink } from '@/runtime';

/** `sealAttentionOf` of the store, compared by value (one flat string: nothing re-renders per frame, F74-13). */
export function useSealAttention(): SealAttention | null {
  const line = useSim((s) => {
    const attention = sealAttentionOf(s);
    return attention === null ? '' : JSON.stringify(attention);
  });
  return line === '' ? null : (JSON.parse(line) as SealAttention);
}

/** The blocked seal of the OPEN session, as Home and the Sessions hub need it; null when there is none. */
export function useSealBlocked(): { readonly sessionId: string; readonly message: string } | null {
  const line = useSim((s) => {
    if (s.session === null) return '';
    const notice = sealBlockedNoticeOf(s, s.session.id);
    return notice === null ? '' : JSON.stringify({ sessionId: notice.sessionId, message: notice.message });
  });
  return line === '' ? null : (JSON.parse(line) as { sessionId: string; message: string });
}

/** Whether `sessionId` is the open session and its seal is blocked (a boolean selector, for a row's chip). */
export function useSealBlockedOf(sessionId: string | null | undefined): boolean {
  return useSim((s) => sessionId !== null && sessionId !== undefined && s.session?.id === sessionId && sealBlockedNoticeOf(s, sessionId) !== null);
}

export interface SealAttentionNoticeProps {
  attention: SealAttention;
  /** The way back to Home: the session stays open on the Core. */
  onHome: () => void;
}

/** The notice of the Finalizing card: what the Core says, that the recording is kept, who resolves it, and the way out. */
export function SealAttentionNotice({ attention, onHome }: SealAttentionNoticeProps) {
  const { t } = useTranslation();
  const blocked = attention.kind === 'BLOCKED';
  const detail = blocked && attention.detail !== null ? SEAL_BLOCKED_DETAIL_SENTENCE[attention.detail] : null;
  // BLOCKED: the alert's whole message (the cause in words, what restores the seal, what it costs meanwhile).
  // RETRYING: the Core's sentence on the failed step (it already says "retry n of N, in s s").
  const reason = blocked ? attention.message : attention.sentence;
  return (
    <View style={styles.block} accessibilityLiveRegion="polite">
      <Alert status={blocked ? 'danger' : 'warning'} testID={blocked ? 'finalizing-seal-blocked' : 'finalizing-seal-retrying'}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t(blocked ? 'features.session-finalizing.sealAttention.blockedTitle' : 'features.session-finalizing.sealAttention.retryingTitle')}</Alert.Title>
          {reason !== null ? <Alert.Description>{reason}</Alert.Description> : null}
          {detail !== null ? <Alert.Description>{detail}</Alert.Description> : null}
          <Alert.Description>{SEAL_RECORDING_KEPT_SENTENCE}</Alert.Description>
        </Alert.Content>
      </Alert>
      {blocked ? (
        <>
          <Text maxFontSizeMultiplier={1.2} className="text-body text-foreground" testID="finalizing-seal-stopped">
            {sealStoppedSentence(SEAL_AUTOMATIC_RETRIES)}
          </Text>
          <Text maxFontSizeMultiplier={1.2} className="text-body text-foreground" testID="finalizing-seal-who">
            {t('features.session-finalizing.sealAttention.who')}
          </Text>
          <SealRetryControl sessionId={attention.sessionId} testID="finalizing-seal-retry" />
        </>
      ) : null}
      <Text maxFontSizeMultiplier={1.2} className="text-body text-muted" testID="finalizing-seal-stays-open">
        {blocked
          ? t('features.session-finalizing.sealAttention.staysOpen', { chip: t('features.session-finalizing.sealAttention.chip') })
          : t('features.session-finalizing.sealAttention.retryingBody')}
      </Text>
      <View style={styles.action}>
        <Button testID="finalizing-seal-home" variant="outline" size="lg" onPress={onHome}>
          <Button.Label>{t('features.session-finalizing.goHome')}</Button.Label>
        </Button>
      </View>
    </View>
  );
}

export interface SealRetryControlProps {
  /** The session whose seal is blocked (named in the confirmation). */
  sessionId: string;
  /** `compact`: the button alone (a row of Home / Sessions); default: the sentence, then the button. */
  compact?: boolean;
  testID: string;
}

/**
 * "Retry sealing" on a device (JT-02): the sentence of who can, and for those roles the button, a confirmation
 * that says what will happen, then operation 33. A refusal is said and recorded; the seal's own progress says
 * the rest (the Finalizing screen follows the session's state by itself).
 */
export function SealRetryControl({ sessionId, compact = false, testID }: SealRetryControlProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const actions = useCoreActions();
  const presentCoreError = useCoreErrorPresenter();
  const live = useCoreLink().source === 'LIVE';
  const role = useSim((s) => selectOperator(s)?.role ?? null);
  const mayRetry = canRetryBlockedSeal(role);
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  const send = () => {
    if (pending) return;
    setAsking(false);
    setPending(true);
    settle(() => actions.recover(), {
      ok: () => toast.show({ variant: 'success', label: t('features.session-finalizing.sealAttention.retrySent') }),
      fail: (error) => {
        reportRuntimeIssue('error', 'features.sessionFinalizing.sealRetry', error, { sessionId, role });
        // AC-C-53: in LIVE the shared presenter words a refusal of the Core first (403, an outage, a limit).
        if (live && presentCoreError(error)) {
          return;
        }
        toast.show({ variant: 'danger', label: t('features.session-finalizing.sealAttention.retryRefused') });
      },
      done: () => setPending(false),
    });
  };

  const who = mayRetry
    ? t('features.session-finalizing.sealAttention.retryYouCan')
    : t('features.session-finalizing.sealAttention.retryWhoCan', { role: role === null ? '-' : t(`common.roles.${role}`) });

  return (
    <View style={compact ? styles.retryCompact : styles.retry} testID={testID}>
      {compact && mayRetry ? null : (
        <Text maxFontSizeMultiplier={1.2} className={compact ? 'text-body-xs text-muted' : 'text-body text-foreground'} testID={`${testID}-who`}>
          {who}
        </Text>
      )}
      {mayRetry ? (
        <View style={styles.action}>
          <Button testID={`${testID}-button`} variant="primary" size={compact ? 'sm' : 'lg'} isDisabled={pending} onPress={() => setAsking(true)} accessibilityState={{ busy: pending, disabled: pending }}>
            {pending ? <Spinner size="sm" /> : null}
            <Button.Label>{t(pending ? 'features.session-finalizing.sealAttention.retryPending' : 'features.session-finalizing.sealAttention.retryAction')}</Button.Label>
          </Button>
        </View>
      ) : null}
      <Dialog isOpen={asking} onOpenChange={(open) => (open ? undefined : setAsking(false))}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content testID={`${testID}-dialog`}>
            <Dialog.Title>{t('features.session-finalizing.sealAttention.retryConfirmTitle', { sessionId })}</Dialog.Title>
            <Dialog.Description>{t('features.session-finalizing.sealAttention.retryConfirmBody')}</Dialog.Description>
            <View style={styles.dialogActions}>
              <Button testID={`${testID}-confirm`} variant="primary" onPress={send}>
                <Button.Label>{t('features.session-finalizing.sealAttention.retryConfirm')}</Button.Label>
              </Button>
              <Button testID={`${testID}-cancel`} variant="outline" onPress={() => setAsking(false)}>
                <Button.Label>{t('features.session-finalizing.sealAttention.retryCancel')}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  retry: { gap: spacing[2] },
  retryCompact: { gap: spacing[1] },
  dialogActions: { gap: spacing[1], marginTop: spacing[3] },
  block: { gap: spacing[2] },
  action: { flexDirection: 'row' },
});
