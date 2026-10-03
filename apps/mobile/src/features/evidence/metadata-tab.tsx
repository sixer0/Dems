/**
 * Metadata tab (04_mobile_specs §4.11 D5b; D50/D51): the 13 §11.3 manifest fields as a
 * `KeyValueList`, then the package's `manifest.json` in mono `Text selectable` inside a
 * `ScrollShadow` (S19). The text is `getDemoEvidenceDocuments(id).manifestJson`, byte-exact (hashing
 * it gives the signed digest). For an exported item, the §19.2 export entry of the package follows.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollShadow } from 'heroui-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MANIFEST_FIELDS, getDemoEvidenceDocuments, type DemoEvidencePackage } from '@dems/shared/demo-data';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { KeyValueList, type KeyValueItem } from '@/components/kit';
import { reportRuntimeIssue } from '@/runtime';
import { shortHash } from './evidence-model';

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
}
function asString(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/** One-line summaries of the §11.3 fields of a parsed manifest (pure; exported for tests). */
export function manifestSummaries(manifest: Json, t: (key: string, options?: Record<string, unknown>) => string): Record<string, string> {
  const device = asRecord(manifest.device);
  const certificate = asRecord(device?.certificate);
  const operator = asRecord(manifest.operator);
  const subject = asRecord(manifest.subject);
  const times = asRecord(manifest.timestamps);
  const time = asRecord(manifest.timeSource);
  const encryption = asRecord(manifest.encryption);
  const signature = asRecord(manifest.signature);
  const list = (value: unknown, key: string) =>
    Array.isArray(value)
      ? value
          .map((entry) => asString(asRecord(entry)?.[key]))
          .filter(Boolean)
          .join(', ')
      : '';
  const tracks = Array.isArray(manifest.tracks) ? manifest.tracks.length : 0;
  return {
    sessionId: asString(manifest.sessionId),
    device: [asString(device?.deviceId), certificate ? t('features.evidence.metadata.certShort', { serial: shortHash(asString(certificate.serialNumber), 6) }) : ''].filter(Boolean).join(' · '),
    operator: [asString(operator?.displayName), asString(operator?.investigatorId)].filter(Boolean).join(' · '),
    subject: [asString(subject?.name), t(`common.subjectType.${asString(subject?.type)}`, { defaultValue: asString(subject?.type) })]
      .filter(Boolean)
      .join(' · '),
    caseReference: asString(manifest.caseReference),
    timestamps: `${formatDate(asString(times?.startedAt), DATE_PATTERNS.dateTime)} – ${formatDate(asString(times?.stoppedAt), DATE_PATTERNS.time)}`,
    timeSource: [asString(time?.source), asString(time?.state)].filter(Boolean).join(' · '),
    cameras: list(manifest.cameras, 'deviceId'),
    microphones: list(manifest.microphones, 'deviceId'),
    tracks: t('features.evidence.metadata.tracksValue', { count: tracks }),
    encryption: [asString(encryption?.algorithm), encryption?.applied === false ? t('features.evidence.metadata.encryptionDemo') : ''].filter(Boolean).join(' · '),
    signature: [asString(signature?.algorithm), asString(signature?.keyId)].filter(Boolean).join(' · '),
    finalizationStatus: asString(manifest.finalizationStatus),
  };
}

export interface MetadataTabProps {
  evidenceId: string;
  pkg: DemoEvidencePackage | null;
}

export function MetadataTab({ evidenceId, pkg }: MetadataTabProps) {
  const { t } = useTranslation();
  const documents = useMemo(() => (pkg ? getDemoEvidenceDocuments(evidenceId) : null), [pkg, evidenceId]);
  const manifest = useMemo(() => {
    if (!documents) return null;
    try {
      return asRecord(JSON.parse(documents.manifestJson));
    } catch (error) {
      reportRuntimeIssue('error', 'evidence.metadata.parse', error, { evidenceId });
      return null;
    }
  }, [documents, evidenceId]);

  const items: KeyValueItem[] = useMemo(() => {
    if (!manifest) return [];
    const summaries = manifestSummaries(manifest, t);
    return MANIFEST_FIELDS.map((field) => ({
      id: field.key,
      label: `${field.n}. ${t(`features.evidence.metadata.fields.${field.key}`)}`,
      value: summaries[field.key] || '—',
      mono: field.key === 'sessionId' || field.key === 'caseReference',
      testID: `evidence-manifest-${field.key}`,
    }));
  }, [manifest, t]);

  if (!documents || !manifest) {
    return (
      <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="evidence-metadata-none">
        {t('features.evidence.metadata.notAvailable')}
      </Text>
    );
  }

  return (
    <View style={styles.root} testID="evidence-metadata">
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label}>
        {t('features.evidence.metadata.manifestTitle')}
      </Text>
      <KeyValueList items={items} />
      {pkg?.export ? (
        <>
          <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label}>
            {t('features.evidence.metadata.exportTitle')}
          </Text>
          <KeyValueList
            testID="evidence-metadata-export"
            items={[
              { id: 'exportId', label: t('features.evidence.metadata.exportId'), value: pkg.export.exportId, mono: true },
              {
                id: 'zip',
                label: t('features.evidence.metadata.exportZip', { file: pkg.export.zip.path.split('/').pop() ?? '' }),
                value: shortHash(pkg.export.zip.sha256),
                mono: true,
              },
              { id: 'by', label: t('features.evidence.metadata.exportBy'), value: pkg.export.exportedByName },
              { id: 'reason', label: t('features.evidence.metadata.exportReason'), value: pkg.export.reason },
            ]}
          />
        </>
      ) : null}
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label}>
        {t('features.evidence.metadata.jsonTitle')}
      </Text>
      <View style={styles.jsonBox}>
        <ScrollShadow LinearGradientComponent={LinearGradient}>
          <ScrollView nestedScrollEnabled style={styles.jsonScroll} contentContainerStyle={styles.jsonContent}>
            <Text maxFontSizeMultiplier={1.2} selectable style={styles.json} testID="evidence-manifest-json">
              {documents.manifestJson}
            </Text>
          </ScrollView>
        </ScrollShadow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  label: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.size * typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  note: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.gray },
  jsonBox: { borderRadius: radius.px.lg, overflow: 'hidden', backgroundColor: derived.surfaceSecondary, borderWidth: 1, borderColor: derived.separator },
  jsonScroll: { maxHeight: 320 },
  jsonContent: { padding: spacing[2] },
  json: { fontFamily: fontFamily.native.mono, fontSize: 11, lineHeight: 16, color: derived.foreground2 },
});
