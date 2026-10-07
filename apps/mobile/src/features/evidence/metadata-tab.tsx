/**
 * Metadata tab (04_mobile_specs §4.11 D5b; D50/D51): the 13 §11.3 manifest fields as a
 * `KeyValueList`, then the package's `manifest.json` in mono `Text selectable` inside a
 * `ScrollShadow` (S19). The text is `getDemoEvidenceDocuments(id).manifestJson`, byte-exact (hashing
 * it gives the signed digest). For an exported item, the §19.2 export entry of the package follows.
 *
 * E2E-T-6 (E-fix row FX-M2; decision D200/D201): an item without a bundled DEMO package (in Live mode
 * every item the Core recorded today, `media.source NONE`) showed only "No DEMO package for this item",
 * while the web's Metadata tab shows the record. The tab now shows the same record as the web
 * (`apps/core-web/src/features/evidence/metadata-tab.tsx`): the item's values as JSON, labelled "Core
 * record" in Live mode (the Core server's record, never "simulated") and "Simulated evidence record"
 * in Simulated mode, under a line that says why there is no manifest. While Live mode still asks the
 * Core for the media reference, or when it got no answer, the line says that instead of claiming that
 * no package exists (the web's W83 ledger #95 wording).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollShadow } from 'heroui-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MANIFEST_FIELDS, getDemoEvidenceDocuments, type DemoEvidencePackage } from '@dems/shared/demo-data';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { toWibIso, type EvidenceItem } from '@dems/shared/sim';
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

/** What Live mode knows of the item's media reference (operation 40); `ready` in Simulated mode. */
export type MetadataMediaStatus = 'loading' | 'ready' | 'unavailable';

/**
 * The item's record as the web's Metadata tab prints it for an item without a package (the same keys
 * in the same order, times in WIB ISO form). Pure; exported for tests.
 */
export function evidenceRecordJson(item: EvidenceItem, options: { live: boolean; mediaStatus: MetadataMediaStatus }): string {
  const { live, mediaStatus } = options;
  return JSON.stringify(
    {
      ...(live
        ? {
            record: 'CORE',
            note:
              mediaStatus === 'ready'
                ? "The Core server's record of this item; no DEMO package joins it."
                : "The Core server's record of this item; its media reference is unavailable, so no DEMO package is shown.",
          }
        : { simulated: true, note: 'SIMULATED record from the in-app simulator; no DEMO package joins this item.' }),
      evidenceId: item.id,
      sessionId: item.sessionId,
      caseNumber: item.caseNumber,
      subject: { name: item.subjectName, type: item.subjectType },
      investigatorId: item.investigatorId,
      room: item.room,
      recordedAt: toWibIso(item.recordedAt),
      endedAt: toWibIso(item.endedAt),
      sealedAt: item.sealedAt === null ? null : toWibIso(item.sealedAt),
      status: item.status,
      lifecycleStage: item.lifecycleStage,
      manifestHash: item.manifestHash,
      tracks: item.tracks,
      signature: item.signature,
    },
    null,
    2,
  );
}

export interface MetadataTabProps {
  evidenceId: string;
  pkg: DemoEvidencePackage | null;
  /** The item; with it, an item without a package shows its record (E2E-T-6). */
  item?: EvidenceItem | null;
  /** Live mode (the evidence detail reads `useCoreLink().source`): the record is the Core server's. */
  live?: boolean;
  /** Live mode: the state of the Core's media reference (operation 40). */
  mediaStatus?: MetadataMediaStatus;
}

export function MetadataTab({ evidenceId, pkg, item = null, live = false, mediaStatus = 'ready' }: MetadataTabProps) {
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
    const why = !live
      ? t('features.evidence.metadata.notAvailable')
      : mediaStatus === 'loading'
        ? t('features.evidence.media.checking')
        : mediaStatus === 'unavailable'
          ? t('evidence.live.mediaUnavailable')
          : t('evidence.live.noPackage');
    if (item === null) {
      return (
        <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="evidence-metadata-none">
          {why}
        </Text>
      );
    }
    return (
      <View style={styles.root} testID="evidence-metadata-record">
        <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="evidence-metadata-none">
          {why}
        </Text>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.label} testID="evidence-record-title">
          {t(live ? 'evidence.live.coreRecord' : 'evidence.metadata.simulatedRecord')}
        </Text>
        <View style={styles.jsonBox}>
          <ScrollShadow LinearGradientComponent={LinearGradient}>
            <ScrollView nestedScrollEnabled style={styles.jsonScroll} contentContainerStyle={styles.jsonContent}>
              <Text maxFontSizeMultiplier={1.2} selectable style={styles.json} testID="evidence-record-json">
                {evidenceRecordJson(item, { live, mediaStatus })}
              </Text>
            </ScrollView>
          </ScrollShadow>
        </View>
      </View>
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
