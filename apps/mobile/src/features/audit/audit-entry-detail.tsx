/**
 * One audit entry in full (04_mobile_specs §4.16 "Row → BottomSheet with the event JSON (mono,
 * selectable) and the previous and current hashes"). Rendered inside the phone BottomSheet
 * (`audit-sheet.tsx`) and inside the tablet detail pane.
 *
 * Props only, no simulator hooks: the kit portals sheet content above the simulator's provider
 * (step 79 F-79-2), so the screen passes the translated actor and label in.
 */
import { Alert } from 'heroui-native';
import { CircleCheck, CircleX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime';
import { faultKindLabelKey, type AuditRow } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { KeyValueList, StatusChip, type KeyValueItem } from '@/components/kit';
import { authMethodOf, captureChangeOf, eventRecordJson, faultKindOf, type ChainLink } from './audit-model';
import { SEVERITY_TONE } from './audit-tones';

export interface AuditEntryDetailProps {
  row: AuditRow;
  chain: ChainLink;
  /** Translated event label (by code). */
  label: string;
  /** Operator name, "System" or "Unverified user"; in Live mode "Username typed: <name>" for a failed or locked sign-in (W80). */
  actor: string;
  /** `sheet` omits the title (the sheet header shows it). */
  variant: 'sheet' | 'pane';
}

/** "1 Oct 2026 14:08:50 UTC+07:00" (the fixed WIB display offset, D28). */
export function entryTime(at: number): string {
  return `${formatDate(at, DATE_PATTERNS.dateTime)} UTC${formatUtcOffset()}`;
}

export function AuditEntryDetail({ row, chain, label, actor, variant }: AuditEntryDetailProps) {
  const { t } = useTranslation();
  const broken = chain === 'BROKEN';
  const method = authMethodOf(row);
  const fault = faultKindOf(row);

  const items: KeyValueItem[] = [
    { id: 'entry', label: t('features.audit.detail.entry'), value: `#${row.seq}`, mono: true, testID: 'audit-detail-seq' },
    { id: 'entryId', label: t('features.audit.detail.entryId'), value: row.id, mono: true },
    { id: 'time', label: t('features.audit.detail.time'), value: entryTime(row.at), mono: true, testID: 'audit-detail-time' },
    { id: 'actor', label: t('features.audit.detail.actor'), value: actor, testID: 'audit-detail-actor' },
  ];
  if (method) items.push({ id: 'method', label: t('features.audit.detail.method'), value: t(`common.authMethod.${method}`), testID: 'audit-detail-method' });
  if (fault) items.push({ id: 'fault', label: t('features.audit.detail.fault'), value: t(faultKindLabelKey(fault, row.details)) });
  // Task 3 row 68 (MB-12): what a capture-configuration change moved, from the row's own detail keys.
  const change = captureChangeOf(row);
  if (change) {
    const values = change.from === null ? change.to : t('features.capture-selector.audit.changeValue', { from: change.from, to: change.to });
    items.push({
      id: 'change',
      label: t('features.capture-selector.audit.change'),
      value: change.target === null ? values : `${change.target}: ${values}`,
      mono: true,
      testID: 'audit-detail-change',
    });
  }
  if (row.sessionId) items.push({ id: 'session', label: t('features.audit.detail.session'), value: row.sessionId, mono: true });
  if (row.evidenceId) items.push({ id: 'evidence', label: t('features.audit.detail.evidence'), value: row.evidenceId, mono: true });
  if (row.deviceId) items.push({ id: 'device', label: t('features.audit.detail.device'), value: row.deviceId, mono: true });

  return (
    <View style={styles.wrap} testID={`audit-detail-${row.seq}`}>
      {variant === 'pane' ? (
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title} testID="audit-detail-title">
          {label}
        </Text>
      ) : null}
      <View style={styles.chips}>
        <StatusChip size="sm" tone="default" icon={null} label={t(`common.auditCategory.${row.category}`)} />
        <StatusChip size="sm" tone={SEVERITY_TONE[row.severity]} icon={null} label={t(`common.severity.${row.severity}`)} />
        <StatusChip
          size="sm"
          tone={broken ? 'danger' : 'success'}
          icon={broken ? CircleX : CircleCheck}
          label={broken ? t('securityAudit.audit.chainBroken') : t('securityAudit.audit.chainLinked')}
          testID="audit-detail-chain"
        />
      </View>
      {broken ? (
        <Alert status="danger" testID="audit-detail-broken">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('securityAudit.chain.reason.HASH_MISMATCH')}</Alert.Title>
            <Alert.Description>{t('features.audit.detail.brokenNote')}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <KeyValueList items={items} />

      <View style={styles.block}>
        <Text maxFontSizeMultiplier={1.2} style={styles.blockLabel}>
          {t('features.audit.detail.record')}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.blockHint}>
          {t('features.audit.detail.recordHint')}
        </Text>
        <View style={styles.inset}>
          <Text selectable style={styles.code} testID="audit-detail-json">
            {eventRecordJson(row)}
          </Text>
        </View>
      </View>

      <HashBlock label={t('securityAudit.chain.prevHash')} value={row.prevHash} testID="audit-detail-prev-hash" />
      <HashBlock label={t('securityAudit.chain.hash')} value={row.hash} broken={broken} testID="audit-detail-hash" />
    </View>
  );
}

function HashBlock({ label, value, broken = false, testID }: { label: string; value: string; broken?: boolean; testID: string }) {
  return (
    <View style={styles.block}>
      <Text maxFontSizeMultiplier={1.2} style={styles.blockLabel}>
        {label}
      </Text>
      <View style={[styles.inset, broken ? styles.insetBroken : null]}>
        <Text selectable style={styles.hash} testID={testID}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  title: { fontFamily: fontFamily.native.semibold, fontSize: typography.h3.size, lineHeight: typography.h3.lineHeight, color: palette.foreground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  block: { gap: spacing[0] + 2 },
  blockLabel: { fontFamily: fontFamily.native.semibold, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gold, textTransform: 'uppercase', letterSpacing: 0.6 },
  blockHint: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  inset: { backgroundColor: derived.surfaceSecondary, borderRadius: radius.px.lg, borderWidth: 1, borderColor: derived.border, padding: spacing[2] },
  insetBroken: { borderColor: palette.danger },
  code: { fontFamily: fontFamily.native.mono, fontSize: 12, lineHeight: 18, color: derived.foreground2 },
  hash: { fontFamily: fontFamily.native.mono, fontSize: 13, lineHeight: 20, color: palette.foreground },
});
