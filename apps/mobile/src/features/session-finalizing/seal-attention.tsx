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
 * The same reading gives Home, the Sessions hub and the refused New Session their words
 * (`useSealBlocked`): the open session is shown as "Sealing blocked", and a new session is explained
 * as unavailable instead of failing.
 */
import { Alert, Button } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  SEAL_BLOCKED_DETAIL_SENTENCE,
  SEAL_RECORDING_KEPT_SENTENCE,
  sealAttentionOf,
  sealBlockedNoticeOf,
  useSim,
  type SealAttention,
} from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';

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
        <Text maxFontSizeMultiplier={1.2} className="text-body text-foreground" testID="finalizing-seal-who">
          {t('features.session-finalizing.sealAttention.who')}
        </Text>
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

const styles = StyleSheet.create({
  block: { gap: spacing[2] },
  action: { flexDirection: 'row' },
});
