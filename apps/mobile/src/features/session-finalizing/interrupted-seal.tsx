/**
 * THE INTERRUPTED SEAL OF A SESSION on the tablet and the phone (wave H driver B; gates 75 / 89:
 * G75-03, B-3; ruling D197). A recording that a fault ended and the Core sealed is named on every
 * session surface - Finalizing, the Session Summary, the Sessions hub - with "Sealed — recording was
 * interrupted" and the sentence of its cause (the shared capture wording), never as an ordinary seal.
 *
 * The fact is the Core's: the custody entry `RECORDING_INTERRUPTED` of the session's item, or the
 * session's own `fault` while it is still being sealed (`interruptedSealOfSession`). The notice is a
 * plain kit `Alert`: no Reanimated node, so it is safe on the copies of a hand-over (B9).
 */
import { Alert } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { interruptedSealCauseSentence, interruptedSealOfSession, useSim } from '@dems/shared/sim';

export interface InterruptedSealWords {
  /** Shown IN PLACE of the plain sealed state. */
  readonly title: string;
  /** The stamp's word. */
  readonly short: string;
  /** A list row's chip. */
  readonly chip: string;
  /** The sentence of the cause, then what the evidence holds. */
  readonly body: string;
}

/** No interrupted seal: a value no fault kind can be (the selector returns a primitive). */
const NONE = '\u0000';

/** The words of the interrupted seal of `sessionId`, or null for every other session. */
export function useInterruptedSeal(sessionId: string | null | undefined): InterruptedSealWords | null {
  const { t } = useTranslation();
  const kind = useSim((state) => {
    const seal = interruptedSealOfSession(state, sessionId);
    return seal === null ? NONE : (seal.faultKind ?? '');
  });
  if (kind === NONE) return null;
  return {
    title: t('common.interruptedSeal.title'),
    short: t('common.interruptedSeal.short'),
    chip: t('common.interruptedSeal.chip'),
    body: `${interruptedSealCauseSentence(kind === '' ? null : kind)} ${t('common.interruptedSeal.kept')}`,
  };
}

/** The notice: the title and the cause, announced politely, with no control. Draws nothing for any other session. */
export function InterruptedSealNotice({ sessionId, testID = 'session-interrupted' }: { readonly sessionId: string | null | undefined; readonly testID?: string }) {
  const words = useInterruptedSeal(sessionId);
  if (words === null) return null;
  return (
    <View testID={testID} accessibilityLiveRegion="polite">
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{words.title}</Alert.Title>
          <Alert.Description>{words.body}</Alert.Description>
        </Alert.Content>
      </Alert>
    </View>
  );
}
