/**
 * The line of an interrupted recording on the evidence surfaces (wave H C2, finding 4; gate finding
 * G75-03; evidence package spec V-12): "Sealed — recording was interrupted", with its cause where
 * the surface has room. Drawn ONLY when the item itself says `interrupted === true`
 * (`item-facts.ts`); `false` and an absent member draw nothing - the plain status chip stands.
 * An interrupted recording is a state of the sealed package, not a failure: the warning tone.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, statusText, typography } from '@dems/shared/tokens';
import type { ItemFacts } from './item-facts';

export interface InterruptedLineProps {
  facts: Pick<ItemFacts, 'interrupted' | 'interruptedCause'>;
  /** The item header names the cause (or says it is not reported); a list row keeps to the status. */
  withCause?: boolean;
  testID: string;
}

export function InterruptedLine({ facts, withCause = false, testID }: InterruptedLineProps) {
  const { t } = useTranslation();
  if (facts.interrupted !== true) return null;
  const cause = facts.interruptedCause === null ? t('evidence.itemFacts.interrupted.causeNotReported') : t('evidence.itemFacts.interrupted.cause', { cause: facts.interruptedCause });
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={withCause ? `${t('evidence.itemFacts.interrupted.status')}. ${cause}` : t('evidence.itemFacts.interrupted.status')}>
      <Text maxFontSizeMultiplier={1.2} numberOfLines={withCause ? undefined : 1} style={styles.status}>
        {t('evidence.itemFacts.interrupted.status')}
      </Text>
      {withCause ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.cause}>
          {cause}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.warning },
  cause: { fontFamily: fontFamily.native.mono, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.warning },
});
