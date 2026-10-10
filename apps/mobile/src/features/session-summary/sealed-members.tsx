/**
 * MB-05 Session Summary: the sealed members of a schema-v2 item (blueprint row 92; UX spec flow 3,
 * §8f.2; evidence package spec §B; decisions D121, D124).
 *
 * What the Core's seal states and the Summary did not show: per camera file the hash of the stored
 * bytes and of the decrypted bytes, the transcript hash, whether the sealed transcript carries
 * speaker labels, and the note of a real signature (Ed25519 of the Core key). Every value is the item's, read by the
 * one defensive reader of the Evidence feature (`item-v2.ts`); a member the seal does not state is
 * said to be not stated, never guessed.
 *
 * A legacy v1 item draws NOTHING here: its four track hashes, manifest hash and simulated signature
 * stay in the card above, as before. Plain views, no entering animation: the card appears with the
 * commit that has the sealed item (E-13: nothing here holds Reanimated state through the hand-over).
 *
 * Wave H C2 (gate findings G81-02 / G89-03, MAJOR): the mark beside "Signature" in the hashes card
 * (`SummarySignatureMark`, `summarySignatureWording`). The chip "SIMULATED" is drawn ONLY for a
 * signature the item itself calls simulated. A REAL signature (`simulated === false`) names its
 * algorithm and Core key and is never called simulated; its only qualifier is the development-key
 * line (`SummarySignatureKeyLine`), from the item's `signature.developmentKey`; a key class the item
 * does not report reads "Signing key class: not reported".
 */
import { PressableFeedback } from 'heroui-native';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { selectEvidenceBySessionId, useSim } from '@dems/shared/sim';
import { derived, fontFamily, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { SectionCard, StatusChip } from '@/components/kit';
import { readItemFacts, signingKeyClassOf, type SignatureFacts } from '@/features/evidence/item-facts';
import { CAMERA_FILE_IDS, cameraFileOf, readItemV2 } from '@/features/evidence/item-v2';
import { shortHash } from './summary.model';

export interface SealedMembersCardProps {
  sessionId: string;
  /** Opens a full value in the Summary's hash sheet. */
  onOpen: (value: { label: string; value: string }) => void;
}

export function SealedMembersCard({ sessionId, onOpen }: SealedMembersCardProps) {
  const { t } = useTranslation();
  // The store-owned item (a stable reference); the reader takes it as `unknown`.
  const item = useSim((s) => selectEvidenceBySessionId(s, sessionId) ?? null);
  const v2 = readItemV2(item);
  if (!v2.isV2) return null;
  const hashes: { id: string; label: string; value: string }[] = [];
  for (const trackId of CAMERA_FILE_IDS) {
    const file = cameraFileOf(v2, trackId);
    if (file === null) continue;
    hashes.push({ id: `${trackId}-stored`, label: t('evidence.sealedMembers.storedHash', { track: trackId }), value: file.sha256 });
    if (file.sha256Plain !== null) hashes.push({ id: `${trackId}-plain`, label: t('evidence.sealedMembers.plainHash', { track: trackId }), value: file.sha256Plain });
  }
  if (v2.transcriptSha256 !== null) hashes.push({ id: 'transcript', label: t('evidence.sealedMembers.transcriptHash'), value: v2.transcriptSha256 });
  const signature = v2.signature;
  // The note of a REAL signature only (Ed25519 and not simulated, in so many words). A simulated one is
  // already marked SIMULATED on the signature row of the card above (D158 DC-4): nothing is said twice here.
  const realSignature = signature !== null && !signature.simulated && signature.algorithm === 'Ed25519';
  return (
    <View style={styles.root}>
      <SectionCard title={t('evidence.sealedMembers.title')} description={t('evidence.sealedMembers.hint')} testID="summary-sealed-members">
        <View>
          {hashes.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <View style={styles.separator} /> : null}
              <PressableFeedback
                testID={`summary-sealed-${row.id}`}
                onPress={() => onOpen({ label: row.label, value: row.value })}
                accessibilityRole="button"
                accessibilityLabel={`${row.label}, ${shortHash(row.value)}`}
                style={styles.row}
              >
                <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.label}>
                  {row.label}
                </Text>
                <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.value}>
                  {shortHash(row.value)}
                </Text>
                <ChevronRight size={16} color={palette.gray} />
              </PressableFeedback>
            </View>
          ))}
          {v2.transcriptSha256 === null ? (
            <>
              <View style={styles.separator} />
              <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="summary-sealed-no-transcript">
                {t('evidence.sealedMembers.noTranscript')}
              </Text>
            </>
          ) : null}
          <View style={styles.separator} />
          <View style={styles.row} testID="summary-sealed-labels">
            <Text maxFontSizeMultiplier={1.2} style={styles.label}>
              {t('evidence.sealedMembers.labels')}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={styles.text}>
              {t(`evidence.sealedMembers.labelsStatus.${v2.labelsStatus ?? 'NOT_STATED'}`)}
            </Text>
          </View>
          {realSignature ? (
            <>
              <View style={styles.separator} />
              <View style={styles.row} testID="summary-sealed-signature-real">
                <Text maxFontSizeMultiplier={1.2} style={styles.label}>
                  {t('evidence.sealedMembers.signature')}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={styles.text}>
                  {t('evidence.sealedMembers.signatureReal', { key: signature.keyId })}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </SectionCard>
    </View>
  );
}

/** The signature facts of the item with this ID, as the item states them; null: no item, or a signature that cannot be read. */
export function useSummarySignature(evidenceId: string | null): SignatureFacts | null {
  // The store-owned item (a stable reference); the reader takes it as `unknown`.
  const item = useSim((s) => (evidenceId === null ? null : (s.evidence.find((entry) => entry.id === evidenceId) ?? null)));
  return item === null ? null : readItemFacts(item).signature;
}

export type SummarySignatureKind = 'SIMULATED' | 'REAL' | 'NOT_REPORTED';

/** What the signature row says: simulated only for a signature the item calls simulated (G81-02 / G89-03). */
export function summarySignatureKind(signature: SignatureFacts | null): SummarySignatureKind {
  if (signature === null) return 'NOT_REPORTED';
  return signature.simulated ? 'SIMULATED' : 'REAL';
}

/** The i18n key of the key-class line of a REAL signature, or null when nothing is to be said. */
export function summarySignatureKeyLine(signature: SignatureFacts | null): { readonly keyClass: 'DEVELOPMENT' | 'UNKNOWN'; readonly key: string } | null {
  if (signature === null || signature.simulated) return null;
  const keyClass = signingKeyClassOf(signature);
  if (keyClass === 'DEVELOPMENT') return { keyClass, key: 'evidence.itemFacts.signature.developmentKey' };
  if (keyClass === 'UNKNOWN') return { keyClass, key: 'evidence.itemFacts.signature.keyClassUnknown' };
  return null;
}

/** The mark beside "Signature": the SIMULATED chip, the algorithm and Core key of a real signature, or "not reported". */
export function SummarySignatureMark({ signature }: { signature: SignatureFacts | null }) {
  const { t } = useTranslation();
  const kind = summarySignatureKind(signature);
  if (kind === 'SIMULATED') return <StatusChip tone="warning" icon={null} size="sm" label={t('common.simulated.chip')} testID="summary-signature-simulated" />;
  return (
    <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.mark} testID={kind === 'REAL' ? 'summary-signature-real' : 'summary-signature-not-reported'}>
      {signature !== null ? t('evidence.itemFacts.signature.realShort', { algorithm: signature.algorithm, key: signature.keyId }) : t('evidence.itemFacts.signature.notReported')}
    </Text>
  );
}

/** Under the signature row of a REAL signature: the development-key line, or "Signing key class: not reported". */
export function SummarySignatureKeyLine({ signature }: { signature: SignatureFacts | null }) {
  const { t } = useTranslation();
  const line = summarySignatureKeyLine(signature);
  if (line === null) return null;
  return (
    <Text maxFontSizeMultiplier={1.2} accessibilityRole="text" style={[styles.note, line.keyClass === 'DEVELOPMENT' ? styles.development : null]} testID={`summary-signature-key-class-${line.keyClass}`}>
      {t(line.key)}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing[2] },
  mark: { flexShrink: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  development: { color: statusText.warning },
  separator: { height: 1, backgroundColor: derived.separator },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 48, paddingVertical: spacing[1] },
  label: { flex: 1, fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  value: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground },
  text: { flexShrink: 1, textAlign: 'right', fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  note: { paddingVertical: spacing[1], fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
});
