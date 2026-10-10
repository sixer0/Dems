/**
 * THE UNSEALABLE STATE OF A RECORDING (task 3 fix pass F-M7b; review R88-02 (c); rulings D178 (2),
 * D183). The Core could not seal the session: it ended it as INCOMPLETE and moved its files to its
 * quarantine folder. Shown as a STATE of the recording, in the Core's own sentence
 * (`common.sealUnsealable.notice`) with the code of the cause - never as an operator error, and
 * with no control: nothing an operator presses here seals it.
 *
 * Read from the Core's alert (`unsealableNoticeOf`): of `sessionId` when one is given, otherwise the
 * most recent one that is still active - the Finalizing and the Recovery screen have no open
 * session any more once the Core ended it. Draws nothing when there is no such state.
 */
import { Alert } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { unsealableNoticeOf, useSim } from '@dems/shared/sim';

export function UnsealableNotice({ sessionId = null }: { readonly sessionId?: string | null }) {
  const { t } = useTranslation();
  const cause = useSim((state) => unsealableNoticeOf(state, sessionId)?.cause ?? null);
  if (cause === null) return null;
  return (
    <View testID="session-unsealable" accessibilityLiveRegion="polite">
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>{t('common.sealUnsealable.notice', { cause })}</Alert.Description>
        </Alert.Content>
      </Alert>
    </View>
  );
}
