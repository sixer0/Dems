/**
 * Live-mode parts of the Operator Audit view (backend task W80; 04_client_integration_spec §7.4,
 * §8.5 S1-7, §8.2 A9 in its mobile form, §3.5; 09b_m1_mobile_consolidation §8). Rendered only in
 * Live mode: in Simulated mode `LiveChainLines` is not mounted and `AuditLinkNotice` renders
 * nothing, so the Simulated screen is as before.
 *
 * - `LiveChainLines`: under the verdict of a chain verification, the Core server's check of its
 *   STORED table (`stored`: verified through entry n, or the first entry that does not verify) and,
 *   when the Core has discarded chains by a demo reset or a scenario load, how many (`lineageTotal`,
 *   the durable trace of SD-19). Both come from the same answer of operation 60 as the verdict: the
 *   Live source keeps them on its handle (`auditChain`, client spec §2.5) and they are read through
 *   `useLiveSelector`. Nothing is computed on the tablet. During the demo fault AUDIT_TAMPER the
 *   verdict (the Core's ring) breaks while the stored line stays verified, as the server spec
 *   defines (§12.3).
 * - `AuditLinkNotice`: "Core server unreachable" while the Core link is down, by the runtime's one
 *   rule in one call (`useCoreLinkNotice`, rows M0 and M1): the rows shown are the last the Core
 *   sent. A 429 is no link state (LB-10) and never reaches it.
 */
import { Alert } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLiveSelector } from '@dems/shared/live';
import { derived, fontFamily, statusText, typography } from '@dems/shared/tokens';
import { enterRise, useMotionSettings } from '@/motion';
import { useCoreLinkNotice, type MobileLiveSim } from '@/runtime';
import { storedChainLine } from './audit-model';

/** The stored-chain line and the earlier-chains line of the last verification (Live mode). */
export function LiveChainLines() {
  const { t } = useTranslation();
  const chain = useLiveSelector((live: MobileLiveSim | null) => live?.auditChain ?? null);
  if (chain === null) return null;
  const stored = storedChainLine(chain.stored);
  return (
    <View style={styles.lines} testID="audit-live-chain">
      <Text maxFontSizeMultiplier={1.2} style={[styles.line, chain.stored.ok ? null : styles.lineBroken]} testID={`audit-live-stored-${chain.stored.ok ? 'ok' : 'broken'}`}>
        {t(stored.key, stored.values)}
      </Text>
      {chain.lineageTotal > 0 ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.line} testID="audit-live-lineage">
          {t('features.audit.live.earlierChains', { count: chain.lineageTotal })}
        </Text>
      ) : null}
    </View>
  );
}

/** "Core server unreachable" while the Core link is down (Live mode); no element otherwise. */
export function AuditLinkNotice({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const { offline } = useCoreLinkNotice();
  if (!offline) return null;
  return (
    <Animated.View entering={enterRise(0, m)} style={style} testID="audit-link-offline">
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('features.audit.live.offlineTitle')}</Alert.Title>
          <Alert.Description>{t('features.audit.live.offlineBody')}</Alert.Description>
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: 2 },
  line: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: derived.foreground2 },
  lineBroken: { color: statusText.danger },
});
