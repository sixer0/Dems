/**
 * WHAT THE SEALED MANIFEST OF AN ITEM SAYS, read from the item's own package (task 3 wave H, driver
 * C1; gate findings G94-04, G89-03, G89-04, G89-09; decision D200).
 *
 * Reads the manifest, the signature file and the certificate of ONE package folder - no camera
 * byte, no key - through the ONE verifier of the Core (`verifyPackageV2`, scope `MANIFEST`) and
 * the package reader of `src/evidence-verify` (read only, no link followed, nothing outside the
 * folder). This file opens nothing itself.
 *
 * WHICH MANIFEST IS BELIEVED: only the one that hashes to the digest it states AND whose digest is
 * the one the database recorded when the item was sealed (`evidence_items.manifest_hash`) AND that
 * names this item and this session. Everything else answers `NOT_READABLE` - never a fact of
 * another manifest, never a guess.
 *
 * THE DEVELOPMENT KEY is the verifier's own statement (`report.signature.developmentKey`): true or
 * false from the certificate that VERIFIED the signature of that manifest, null when the
 * signature or its certificate did not hold. It is a label for the item's page before a
 * verification run; the verdict stays operation 41's.
 *
 * It never throws.
 */
import { MIC_INPUT_ID_PATTERN } from '@dems/shared/api';
import { PackageFile, cameraFilePath, manifestHashMatches, parseManifestV2 } from '@dems/shared/evidence-package';
import { VERIFY_MAX_MANIFEST_BYTES, verifyPackageV2 } from '@dems/shared/evidence-verify';
import type { SealedAudioInterval, SealedFileFact, SealedItemFacts, SealedTranscriptModel } from '../engine';
import { corePorts } from '../evidence-verify';

/** A track profile as the item's contract admits it (`EvidenceItemSchema.files[].profile`). */
const SEALED_PROFILE = /^[A-Za-z0-9_.-]{1,48}$/;

/** What the reader needs of an item: its three anchors. */
export interface SealedFactsAnchors {
  readonly id: string;
  readonly sessionId: string;
  /** `evidence_items.manifest_hash`. */
  readonly manifestHash: string;
}

export async function readSealedItemFacts(packageDir: string, item: SealedFactsAnchors): Promise<SealedItemFacts> {
  const notReadable: SealedItemFacts = { evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'NOT_READABLE' };
  try {
    const ports = corePorts(packageDir, null);
    const entry = await ports.reader.entry(PackageFile.MANIFEST);
    if (entry.kind !== 'FILE') return notReadable;
    const manifest = parseManifestV2(JSON.parse(await ports.reader.readText(PackageFile.MANIFEST, VERIFY_MAX_MANIFEST_BYTES)) as unknown);
    // The anchor from OUTSIDE the package first: a manifest that is consistent with itself proves nothing.
    if (manifest.manifestSha256 !== item.manifestHash || manifest.evidenceId !== item.id || manifest.sessionId !== item.sessionId || !manifestHashMatches(manifest)) return notReadable;

    const audioSourceIntervals: SealedAudioInterval[] = [];
    for (const interval of manifest.audio.sourceIntervals) {
      // The item's contract names a microphone input (`MIC-NN`): an interval that names anything else is not restated as one.
      if (!MIC_INPUT_ID_PATTERN.test(interval.micDeviceId)) return notReadable;
      audioSourceIntervals.push({ seq: interval.seq, inputId: interval.micDeviceId, role: interval.role, fromMs: interval.fromMs, toMs: interval.toMs, reason: interval.reason, sourceClass: interval.sourceClass });
    }
    const files: SealedFileFact[] = manifest.tracks.map((track) => ({
      trackId: track.trackId,
      fileName: cameraFilePath(track.trackId),
      sizeBytes: track.bytes,
      sha256: track.sha256,
      fragmentCount: track.fragmentCount ?? manifest.files.find((file) => file.trackId === track.trackId)?.fragments.length ?? 0,
      ...(track.sha256Plain === null ? {} : { sha256Plain: track.sha256Plain }),
      fragmentChainHead: track.fragmentChainHead,
      // Fix wave L (G89c-04; D229 (3)): the format as the manifest of record states it (field 36). A value outside the item's own pattern is not restated.
      ...(SEALED_PROFILE.test(track.profile) ? { profile: track.profile } : {}),
    }));

    let developmentKey: boolean | null = null;
    // Fix wave K, driver S2 (G81b-06; D160): the verifier's own statement of the transcript model - it makes one only for
    // a manifest whose signature held and that declares a document. Nothing is restated from an unsigned manifest.
    let transcriptModel: SealedTranscriptModel | null = null;
    try {
      const report = await verifyPackageV2(ports, { scope: 'MANIFEST', expected: { evidenceId: item.id, sessionId: item.sessionId, manifestSha256: item.manifestHash } });
      developmentKey = report.signature.developmentKey;
      transcriptModel = report.transcriptModel === null ? null : { ...report.transcriptModel };
    } catch {
      developmentKey = null;
      transcriptModel = null;
    }
    return { evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'PRESENT', interrupted: manifest.timeline.interrupted, audioSourceIntervals, files, developmentKey, transcriptModel };
  } catch {
    return notReadable;
  }
}
