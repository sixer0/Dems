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
import { hasSealedValues } from '@dems/shared/sim';
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
      <Text maxFontSizeMultiplier={1.2} numberOfLines={withCause ? undefined : 2} style={styles.status}>
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

/**
 * Round two (JA2-07): the item of an INTERRUPTED session that was never sealed (`sealedAt === null`,
 * contract_wave_j.md J-S 1) says so wherever the item is drawn - the list row and the item header - as the
 * Sessions hub does. Before, it read "Recorded" like any other item and only the hub told. Nothing is drawn
 * for an item with sealed values.
 */
export function NeverSealedLine({ item, withDetail = false, testID }: { item: unknown; withDetail?: boolean; testID: string }) {
  const { t } = useTranslation();
  if (hasSealedValues(item)) return null;
  const status = t('features.evidence.neverSealed.status');
  const detail = t('common.truth.incompleteSession.RECORDED_NOT_SEALED');
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={withDetail ? `${status}. ${detail}` : status}>
      {/* Fix wave Q (CP-07): two lines in a row - on the phone the one line read "Incomplete session — n…". */}
      <Text maxFontSizeMultiplier={1.2} numberOfLines={withDetail ? undefined : 2} style={styles.status}>
        {status}
      </Text>
      {withDetail ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.detail}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.warning },
  status: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.warning },
  cause: { fontFamily: fontFamily.native.mono, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.warning },
});
