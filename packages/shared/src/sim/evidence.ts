/**
 * Evidence integrity derivation (masterplan/01_specs.md §14.7 `evidence.ts`).
 *
 * Step 31 (contract) provides the pure hash derivation that the canonical dataset needs:
 * - per-track SHA-256 over a synthetic segment descriptor;
 * - the manifest hash over the track list;
 * - the **simulated** signature: sha256(manifestHash ‖ keyId), labelled "simulated" in the
 *   UI and never called a real signature.
 * Step 32 adds sealing, `verify()` and the tamper hook (EVT-13/14) on top of these helpers,
 * so a verify of a dataset item recomputes exactly what the dataset stored.
 */
import { TrackId, type EvidenceLifecycleStage, type TimeSource } from '../domain';
import { demoPackageIntegrityFor, demoTrackHash, type DemoPackageIntegrity } from './demo-alignment';
import { canonicalJSON, sha256Hex } from './events';
import type {
  CustodyEntry,
  EpochMs,
  EvidenceItem,
  EvidenceMarker,
  EvidenceSignature,
  EvidenceTrack,
  EvidenceVerifyResult,
  SessionNote,
  TrackVerifyResult,
} from './types';
import { IntegritySource, type EvidenceStatus, type RecordingProfileId, type SubjectType } from './vocabulary';

/** Key ID the simulated signature binds to. */
export const SIMULATED_SIGNING_KEY_ID = 'KEY-EVSIGN-01';
/** Synthetic segment length for the track descriptors (5 min). */
export const TRACK_SEGMENT_MS = 5 * 60_000;

export const TRACK_LABELS = {
  'VIDEO-01': 'Camera 1',
  'VIDEO-02': 'Camera 2',
  'AUDIO-01': 'MIC 1 – Interviewer',
  'AUDIO-02': 'MIC 2 – Subject',
} as const satisfies Record<TrackId, string>;

/** Share of the recording bytes per track (two 1080p video tracks dominate). */
const TRACK_SHARE = {
  'VIDEO-01': 0.49,
  'VIDEO-02': 0.49,
  'AUDIO-01': 0.01,
  'AUDIO-02': 0.01,
} as const satisfies Record<TrackId, number>;

export const TRACK_ORDER = [
  TrackId.VIDEO_01,
  TrackId.VIDEO_02,
  TrackId.AUDIO_01,
  TrackId.AUDIO_02,
] as const satisfies readonly TrackId[];

export interface EvidenceIntegrityInput {
  evidenceId: string;
  sessionId: string;
  caseNumber: string;
  recordedAt: EpochMs;
  endedAt: EpochMs;
  sizeBytes: number;
}

/** The synthetic descriptor a track hash covers (stands in for the media bytes). */
export function trackDescriptor(input: EvidenceIntegrityInput, trackId: TrackId) {
  const durationMs = Math.max(0, input.endedAt - input.recordedAt);
  return {
    kind: 'dems.track.v1',
    evidenceId: input.evidenceId,
    sessionId: input.sessionId,
    trackId,
    startedAt: input.recordedAt,
    endedAt: input.endedAt,
    segments: Math.max(1, Math.ceil(durationMs / TRACK_SEGMENT_MS)),
    sizeBytes: trackSize(input.sizeBytes, trackId),
    codec: trackId.startsWith('VIDEO') ? 'H.264 1080p25' : 'PCM 48 kHz',
  };
}

export function trackSize(totalBytes: number, trackId: TrackId): number {
  return Math.round(totalBytes * TRACK_SHARE[trackId]);
}

export function computeTrackHash(input: EvidenceIntegrityInput, trackId: TrackId): string {
  return sha256Hex(canonicalJSON(trackDescriptor(input, trackId)));
}

export function computeManifestHash(
  input: EvidenceIntegrityInput,
  tracks: readonly EvidenceTrack[],
): string {
  return sha256Hex(
    canonicalJSON({
      kind: 'dems.manifest.v1',
      evidenceId: input.evidenceId,
      sessionId: input.sessionId,
      caseNumber: input.caseNumber,
      recordedAt: input.recordedAt,
      endedAt: input.endedAt,
      tracks: tracks.map((track) => ({
        trackId: track.trackId,
        sha256: track.sha256,
        sizeBytes: track.sizeBytes,
      })),
    }),
  );
}

export function computeSimulatedSignature(
  manifestHash: string,
  keyId: string = SIMULATED_SIGNING_KEY_ID,
): EvidenceSignature {
  return {
    value: sha256Hex(manifestHash + keyId),
    keyId,
    algorithm: 'SIMULATED-SHA256',
    simulated: true,
  };
}

/** Tracks, manifest hash and simulated signature for one evidence object. */
export function buildEvidenceIntegrity(input: EvidenceIntegrityInput): {
  tracks: EvidenceTrack[];
  manifestHash: string;
  signature: EvidenceSignature;
} {
  const tracks: EvidenceTrack[] = TRACK_ORDER.map((trackId) => ({
    trackId,
    label: TRACK_LABELS[trackId],
    sizeBytes: trackSize(input.sizeBytes, trackId),
    sha256: computeTrackHash(input, trackId),
  }));
  const manifestHash = computeManifestHash(input, tracks);
  return { tracks, manifestHash, signature: computeSimulatedSignature(manifestHash) };
}

/** What an item's integrity fields hold, and where they came from (step 54). */
export interface ItemIntegrity {
  tracks: EvidenceTrack[];
  manifestHash: string;
  signature: EvidenceSignature;
  integritySource: IntegritySource;
}

/**
 * The integrity of one evidence item (step 54, review 40 §5.c): the step-93 DEMO package's sealed
 * track hashes and manifest digest when a package joins (`demoPackageIntegrityFor`), otherwise the
 * synthetic descriptor hashes. The signature stays the simulated one over the manifest hash.
 */
export function buildItemIntegrity(input: EvidenceIntegrityInput & { subjectName: string }): ItemIntegrity {
  const entry = demoPackageIntegrityFor({
    evidenceId: input.evidenceId,
    sessionId: input.sessionId,
    caseNumber: input.caseNumber,
    subjectName: input.subjectName,
  });
  if (!entry) return { ...buildEvidenceIntegrity(input), integritySource: IntegritySource.SIMULATED };
  const tracks: EvidenceTrack[] = TRACK_ORDER.map((trackId) => ({
    trackId,
    label: TRACK_LABELS[trackId],
    sizeBytes: trackSize(input.sizeBytes, trackId),
    sha256: demoTrackHash(entry, trackId),
  }));
  return {
    tracks,
    manifestHash: entry.manifestSha256,
    signature: computeSimulatedSignature(entry.manifestSha256),
    integritySource: IntegritySource.DEMO_PACKAGE,
  };
}

/** §19.1 lifecycle stage shown for each status (demo mapping). */
export const EVIDENCE_STATUS_STAGE = {
  RECORDED: 'RECORDING',
  SEALED: 'SEALED_LOCAL_EVIDENCE',
  UNDER_REVIEW: 'AUTHORIZED_REVIEW',
  EXPORTED: 'AUTHORIZED_EXPORT_TRANSFER',
  ARCHIVED: 'RETENTION_ARCHIVE_DISPOSITION',
} as const satisfies Record<EvidenceStatus, EvidenceLifecycleStage>;

// ── Step 32: sealing, verification and the tamper hook (EVT-13/14) ─────────────────────

/** The track the tamper hook alters when none is named (mirrors step 93's tampered package). */
export const DEFAULT_TAMPER_TRACK: TrackId = TrackId.AUDIO_02;

/** The integrity input stored on an evidence item (what `verify()` recomputes from). */
export function integrityInputOf(item: EvidenceItem): EvidenceIntegrityInput {
  return {
    evidenceId: item.id,
    sessionId: item.sessionId,
    caseNumber: item.caseNumber,
    recordedAt: item.recordedAt,
    endedAt: item.endedAt,
    sizeBytes: item.sizeBytes,
  };
}

export interface SealEvidenceInput extends EvidenceIntegrityInput {
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  room: string;
  profileId: RecordingProfileId;
  /** Null for the RECORDED item of an INCOMPLETE session (never sealed, SYS-008). */
  sealedAt: EpochMs | null;
  status: EvidenceStatus;
  custody: CustodyEntry[];
  /** Step 54 (SIM-GAP-W47-3): the session's markers and notes. */
  markers?: EvidenceMarker[];
  notes?: SessionNote[];
  /** Step 54 (SIM-GAP-M80-1): time source at the start and end of the recording. */
  startTimeSource?: TimeSource | null;
  endTimeSource?: TimeSource | null;
}

/**
 * Builds an evidence object with its per-track hashes, manifest hash and simulated signature
 * (the DEMO package's hashes when one joins, step 54).
 */
export function createEvidenceItem(input: SealEvidenceInput): EvidenceItem {
  const integrity = buildItemIntegrity(input);
  return {
    id: input.evidenceId,
    sessionId: input.sessionId,
    caseNumber: input.caseNumber,
    subjectName: input.subjectName,
    subjectType: input.subjectType,
    investigatorId: input.investigatorId,
    room: input.room,
    profileId: input.profileId,
    recordedAt: input.recordedAt,
    endedAt: input.endedAt,
    sealedAt: input.sealedAt,
    durationMs: Math.max(0, input.endedAt - input.recordedAt),
    sizeBytes: input.sizeBytes,
    status: input.status,
    lifecycleStage: EVIDENCE_STATUS_STAGE[input.status],
    tracks: integrity.tracks,
    manifestHash: integrity.manifestHash,
    signature: integrity.signature,
    custody: input.custody,
    verification: { status: 'NOT_RUN', at: null },
    tampered: false,
    tamperedTrackId: null,
    caseType: input.subjectType,
    markers: input.markers ?? [],
    notes: input.notes ?? [],
    integritySource: integrity.integritySource,
    startTimeSource: input.startTimeSource ?? null,
    endTimeSource: input.endTimeSource ?? null,
  };
}

/** What the stored media of an altered track now hashes to (anything but the sealed hash). */
export function tamperedTrackHash(input: EvidenceIntegrityInput, trackId: TrackId): string {
  return sha256Hex(canonicalJSON({ ...trackDescriptor(input, trackId), altered: 'dems.tamper.v1' }));
}

/**
 * `verify()`: recomputes every track hash from the (simulated) stored media, the manifest hash
 * from the stored track list, and the simulated signature from the manifest hash.
 * A tampered item fails on exactly its altered track; the manifest and signature still match,
 * because the attacker changed media, not the sealed manifest.
 */
export function verifyEvidenceItem(item: EvidenceItem, at: EpochMs): EvidenceVerifyResult {
  const input = integrityInputOf(item);
  const alteredTrack = item.tampered ? (item.tamperedTrackId ?? DEFAULT_TAMPER_TRACK) : null;
  const entry =
    item.integritySource === IntegritySource.DEMO_PACKAGE
      ? demoPackageIntegrityFor({
          evidenceId: item.id,
          sessionId: item.sessionId,
          caseNumber: item.caseNumber,
          subjectName: item.subjectName,
        })
      : null;
  if (entry) return verifyPackageBackedItem(item, entry, alteredTrack, at);
  const tracks: TrackVerifyResult[] = item.tracks.map((track) => {
    const actual =
      track.trackId === alteredTrack
        ? tamperedTrackHash(input, track.trackId)
        : computeTrackHash(input, track.trackId);
    return { trackId: track.trackId, expected: track.sha256, actual, ok: actual === track.sha256 };
  });
  const manifestOk = computeManifestHash(input, item.tracks) === item.manifestHash;
  const signatureOk =
    computeSimulatedSignature(item.manifestHash, item.signature.keyId).value === item.signature.value;
  return {
    evidenceId: item.id,
    ok: manifestOk && signatureOk && tracks.every((track) => track.ok),
    at,
    tracks,
    manifestOk,
    signatureOk,
  };
}

/**
 * `verify()` of an item whose hashes are the DEMO package's (step 54): the stored media of an
 * untouched track still hashes to its sealed value; the altered track hashes to the package's
 * altered copy (EV 0005 AUDIO-02), or to a synthetic altered hash for a Demo Control Panel tamper.
 * The manifest digest and the track list must equal the package's sealed values.
 */
function verifyPackageBackedItem(
  item: EvidenceItem,
  entry: DemoPackageIntegrity,
  alteredTrack: TrackId | null,
  at: EpochMs,
): EvidenceVerifyResult {
  const input = integrityInputOf(item);
  const tracks: TrackVerifyResult[] = item.tracks.map((track) => {
    const sealed = demoTrackHash(entry, track.trackId);
    let actual = sealed;
    if (track.trackId === alteredTrack) {
      actual = entry.altered?.trackId === track.trackId ? entry.altered.sha256 : tamperedTrackHash(input, track.trackId);
    }
    return { trackId: track.trackId, expected: track.sha256, actual, ok: actual === track.sha256 };
  });
  const manifestOk =
    item.manifestHash === entry.manifestSha256 &&
    item.tracks.every((track) => track.sha256 === demoTrackHash(entry, track.trackId));
  const signatureOk =
    computeSimulatedSignature(item.manifestHash, item.signature.keyId).value === item.signature.value;
  return {
    evidenceId: item.id,
    ok: manifestOk && signatureOk && tracks.every((track) => track.ok),
    at,
    tracks,
    manifestOk,
    signatureOk,
  };
}

/** The tamper hook (EVT-13/14): the media of `trackId` is altered after sealing. */
export function tamperEvidenceItem(item: EvidenceItem, trackId: TrackId = DEFAULT_TAMPER_TRACK): EvidenceItem {
  return {
    ...item,
    tampered: true,
    tamperedTrackId: trackId,
    verification: { status: 'NOT_RUN', at: null },
  };
}

/**
 * Undoes the tamper hook (Demo Control Panel reset of the fault). An item whose DEMO package is
 * itself TAMPERED (EV 0005) returns to that package state, not to pristine: its stored media stays
 * altered (step 54, SIM-GAP-W47-1).
 */
export function restoreEvidenceItem(item: EvidenceItem): EvidenceItem {
  if (!item.tampered) return item;
  const packaged =
    item.integritySource === IntegritySource.DEMO_PACKAGE
      ? demoPackageIntegrityFor({
          evidenceId: item.id,
          sessionId: item.sessionId,
          caseNumber: item.caseNumber,
          subjectName: item.subjectName,
        })
      : null;
  if (packaged?.altered) {
    if (item.tamperedTrackId === packaged.altered.trackId) return item;
    return { ...item, tampered: true, tamperedTrackId: packaged.altered.trackId, verification: { status: 'NOT_RUN', at: null } };
  }
  return { ...item, tampered: false, tamperedTrackId: null, verification: { status: 'NOT_RUN', at: null } };
}
