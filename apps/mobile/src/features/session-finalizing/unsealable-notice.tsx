/**
 * THE UNSEALABLE STATE OF A RECORDING (task 3 fix pass F-M7b; review R88-02 (c); rulings D178 (2),
 * D183). The Core could not seal the session: it ended it as INCOMPLETE and moved its files to its
 * quarantine folder. Shown as a STATE of the recording - never as an operator error, and with no
 * control: nothing an operator presses here seals it.
 *
 * Fix wave L (G75d-01, G75d-04; contract_wave_l.md sections 1 and 3):
 * - The notice is a statement about ITS session only. It is read with the id of the session the
 *   screen FOLLOWS (`unsealableNoticeOf(state, sessionId)`); without an id NOTHING is drawn. (Before,
 *   a missing id answered the newest open notice of ANY session, so the Finalizing screen of a later
 *   day showed the quarantine of an old session as if it were its own.) Home and its header state
 *   the open notices of the whole Core (`open-notice.ts` beside this file).
 * - The sentence is the shared one WITHOUT the code in brackets (`SEAL_UNSEALABLE_PLAIN_SENTENCE`);
 *   the code is a detail line of its own.
 * - It says that recording is not blocked, and who closes the notice (`canResolveUnsealable(role)`).
 */
import { Alert } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SEAL_UNSEALABLE_PLAIN_SENTENCE, canResolveUnsealable, selectRole, unsealableNoticeOf, useSim } from '@dems/shared/sim';

export function UnsealableNotice({ sessionId = null }: { readonly sessionId?: string | null }) {
  const { t } = useTranslation();
  const cause = useSim((state) => (sessionId === null ? null : (unsealableNoticeOf(state, sessionId)?.cause ?? null)));
  const canClose = useSim((state) => canResolveUnsealable(selectRole(state)));
  if (cause === null || sessionId === null) return null;
  return (
    <View testID="session-unsealable" accessibilityLiveRegion="polite">
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.session-finalizing.unsealable.ofSession', { sessionId })}</Alert.Title>
          <Alert.Description>{SEAL_UNSEALABLE_PLAIN_SENTENCE}</Alert.Description>
          <Alert.Description testID="session-unsealable-cause">{t('features.session-finalizing.unsealable.cause', { cause })}</Alert.Description>
          <Alert.Description testID="session-unsealable-not-blocking">{t('features.session-finalizing.unsealable.notBlocking')}</Alert.Description>
          <Alert.Description testID="session-unsealable-close">{t(canClose ? 'features.session-finalizing.unsealable.closeByYou' : 'features.session-finalizing.unsealable.closeBySupervisor')}</Alert.Description>
        </Alert.Content>
      </Alert>
    </View>
  );
}
