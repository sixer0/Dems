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
  EvidenceFileEntry,
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
  'VIDEO-03': 'Camera 3', // D60 (2026-11-04)
  'VIDEO-04': 'Camera 4',
  'AUDIO-01': 'MIC 1 – Interviewer',
  'AUDIO-02': 'MIC 2 – Subject',
} as const satisfies Record<TrackId, string>;

/** Share of the recording bytes per track (two 1080p video tracks dominate). */
const TRACK_SHARE = {
  'VIDEO-01': 0.245,
  'VIDEO-02': 0.245,
  'VIDEO-03': 0.245, // D60: four 1080p video tracks dominate
  'VIDEO-04': 0.245,
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

// ── A recording that was NEVER SEALED (fix wave J; truth rule 3a; findings JA2-01 / JW-01) ─────────
// An item is sealed exactly when `sealedAt` is set. The item of an INCOMPLETE session (interrupted,
// recovered, never sealed - SYS-008) is a RECORD: it has no track hash, no manifest and no signature,
// and there is nothing a verification could compare. Until wave J such an item was built with the
// full integrity block of a seal, and `verify()` answered PASS for it on every lane.

/**
 * The digest of nothing: what the REQUIRED members `manifestHash` and `signature.value` of a
 * never-sealed item hold (the closed item shape and the table need 64 hex characters there). It is
 * no hash of anything and is never shown; `hasSealedValues` is the reader.
 */
export const EVIDENCE_NOT_SEALED_DIGEST = '0'.repeat(64);
/** The key id of that placeholder: no key signed anything. */
export const EVIDENCE_NOT_SEALED_KEY_ID = 'NOT-SEALED';
/** The placeholder of the required member `signature` of a never-sealed item. Never shown. */
export const EVIDENCE_NOT_SEALED_SIGNATURE: EvidenceSignature = Object.freeze({
  value: EVIDENCE_NOT_SEALED_DIGEST,
  keyId: EVIDENCE_NOT_SEALED_KEY_ID,
  algorithm: 'SIMULATED-SHA256',
  simulated: true,
});

/**
 * THE ONE READER (both clients, the Core, the simulator): does this item carry sealed values?
 * True exactly when `sealedAt` is a number. Takes `unknown`, never throws; anything that is no
 * item answers false - an absent fact is never the favourable value.
 */
export function hasSealedValues(item: unknown): boolean {
  return typeof item === 'object' && item !== null && !Array.isArray(item) && typeof (item as Record<string, unknown>)['sealedAt'] === 'number';
}

/**
 * The shape of a never-sealed item: no track, the null digest in the two required members, no v2
 * file list, no chain head, no transcript hash, and no verification of record. The identity for an
 * item that already has it, and for every sealed item (returned as it is).
 *
 * The Core applies it to what it READS from its store too (`evidenceItemFromRows`), so that a row
 * written before wave J - with the integrity block of a seal, perhaps with a stored PASS - is
 * answered without them.
 */
export function neverSealedShape<Item extends EvidenceItem>(item: Item): Item {
  if (item.sealedAt !== null) return item;
  const shaped =
    item.tracks.length === 0 &&
    item.manifestHash === EVIDENCE_NOT_SEALED_DIGEST &&
    item.signature.value === EVIDENCE_NOT_SEALED_DIGEST &&
    item.verification.status === 'NOT_RUN' &&
    item.files === undefined &&
    item.fragmentChainHead === undefined &&
    item.transcriptSha256 === undefined &&
    item.transcript === undefined;
  if (shaped) return item;
  const { files: _files, fragmentChainHead: _head, transcriptSha256: _transcriptSha256, transcript: _transcript, ...rest } = item;
  return {
    ...rest,
    tracks: [],
    manifestHash: EVIDENCE_NOT_SEALED_DIGEST,
    signature: { ...EVIDENCE_NOT_SEALED_SIGNATURE },
    verification: { status: 'NOT_RUN', at: null },
    tampered: false,
    tamperedTrackId: null,
  } as unknown as Item;
}

/**
 * THE VERIFICATION OF RECORD FAILED (truth rule 3b; findings JT-04 / JW-09): the member every list
 * entry and every item carries. A client that reads true never shows a plain "Sealed".
 */
export function verificationOfRecordFailed(item: unknown): boolean {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
  const verification = (item as Record<string, unknown>)['verification'];
  return typeof verification === 'object' && verification !== null && (verification as Record<string, unknown>)['status'] === 'FAIL';
}

/**
 * The sealed FILES of a v2 item (register SH-07; D224/D225; C3 §3 row 39: "`files[]` (one whole
 * fMP4 per camera ...)"; evidence package spec §A.1: the package holds `fragments/VIDEO-01.mp4`
 * through `fragments/VIDEO-04.mp4` and no audio file - the session audio track is muxed into the
 * camera files). So the list is the camera files and nothing else.
 *
 * D60 (2026-11-04): FOUR tracks. A simulated session records all four camera lines its default
 * selector assigns, and seals the four files at once; the byte shares of `TRACK_SHARE` already
 * carry four 1080p streams (0.245 each).
 *
 * Until integration pass D4 this list also held `AUDIO-01` as a third "file": a file no v2
 * package has, and the one member of an answer that listed half of an audio pair (AC-B-70). The
 * session audio is reported by `tracks` (v1 view) and `audioSourceIntervals`, never by `files`.
 */
export const EVIDENCE_FILE_TRACKS = [TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.VIDEO_03, TrackId.VIDEO_04] as const satisfies readonly TrackId[]; // D60 (2026-11-04): was the two-track pair

/** The fragment quantum used to derive a synthetic fragment count for the running chain. */
const FRAGMENT_MS = 2_000;

/** One fragment descriptor of a file's append-only chain (stands in for the stored fragment bytes). */
function fragmentDescriptor(input: EvidenceIntegrityInput, trackId: TrackId, index: number) {
  return {
    kind: 'dems.fragment.v1',
    evidenceId: input.evidenceId,
    sessionId: input.sessionId,
    trackId,
    index,
    startedAt: input.recordedAt + index * FRAGMENT_MS,
  };
}

/**
 * The running SHA-256 head over a file's fragment checkpoints (register SH-07; `ev §B.6`; the S1
 * append-only-hash pattern). Each fragment folds into the running value: `h = sha256(h ‖ fragment)`.
 * Deterministic from the integrity input alone, so a re-seal of the same session yields the same head.
 */
export function fragmentChainHead(input: EvidenceIntegrityInput, trackId: TrackId): string {
  const durationMs = Math.max(0, input.endedAt - input.recordedAt);
  const fragments = Math.max(1, Math.ceil(durationMs / FRAGMENT_MS));
  let head = sha256Hex(canonicalJSON({ kind: 'dems.chain.genesis', trackId }));
  for (let index = 0; index < fragments; index += 1) {
    head = sha256Hex(head + sha256Hex(canonicalJSON(fragmentDescriptor(input, trackId, index))));
  }
  return head;
}

/** The synthetic canonical transcript document hash bound inside the seal (SH-07; D222). */
export function transcriptSha256(input: EvidenceIntegrityInput): string {
  return sha256Hex(
    canonicalJSON({
      kind: 'dems.transcript/1',
      evidenceId: input.evidenceId,
      sessionId: input.sessionId,
      language: 'id',
      state: 'READY',
    }),
  );
}

/**
 * The package-level fragment-chain head (register SH-07): the running fold of the per-file heads in
 * file order. Each camera file keeps its own append-only chain (`fragmentChainHead` above); this is
 * the single value the manifest records so a verifier can recompute every file's chain from one head.
 */
export function packageFragmentChainHead(input: EvidenceIntegrityInput): string {
  return EVIDENCE_FILE_TRACKS.reduce(
    (head, trackId) => sha256Hex(head + fragmentChainHead(input, trackId)),
    sha256Hex(canonicalJSON({ kind: 'dems.chain.package.genesis', evidenceId: input.evidenceId })),
  );
}

/** The per-file entries of a v2 item (whole-file SHA-256 + fragment count + chain head). */
export function buildEvidenceFilesV2(input: EvidenceIntegrityInput): EvidenceFileEntry[] {
  return EVIDENCE_FILE_TRACKS.map((trackId) => {
    const durationMs = Math.max(0, input.endedAt - input.recordedAt);
    return {
      trackId,
      fileName: `${input.evidenceId.toLowerCase()}/${trackId.toLowerCase()}.m4${trackId.startsWith('VIDEO') ? 'v' : 'a'}`,
      sizeBytes: trackSize(input.sizeBytes, trackId),
      sha256: computeTrackHash(input, trackId),
      fragmentCount: Math.max(1, Math.ceil(durationMs / FRAGMENT_MS)),
    };
  });
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
  /**
   * Schema v2 (register SH-07; OD-02 L2): when true, the item also carries the v2 file list, the
   * fragment-chain head and a transcript hash. The live seal sets it; the pre-built dataset items
   * stay on the v1 shape so their sealed hashes remain byte-identical.
   */
  schemaV2?: boolean;
}

/**
 * Builds an evidence object with its per-track hashes, manifest hash and simulated signature
 * (the DEMO package's hashes when one joins, step 54).
 */
export function createEvidenceItem(input: SealEvidenceInput): EvidenceItem {
  const integrity = buildItemIntegrity(input);
  // Fix wave J (truth rule 3a): a never-sealed item has no v2 seal members either.
  const v2 = input.schemaV2 === true && input.sealedAt !== null;
  return neverSealedShape({
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
    // Schema v2 (SH-07): only a live seal carries the file list, the fragment-chain head and the
    // transcript hash; the pre-built dataset items keep their byte-identical v1 shape.
    ...(v2
      ? {
          files: buildEvidenceFilesV2(input),
          fragmentChainHead: packageFragmentChainHead(input),
          transcriptSha256: transcriptSha256(input),
        }
      : {}),
  });
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
  // Fix wave J (JA2-02): every verdict of the simulator is a demonstration - it compared the hashes of a
  // demonstration record and read no stored media. The member says so on the answer itself.
  return { ...simulatedVerdictOf(item, at), demonstration: true };
}

function simulatedVerdictOf(item: EvidenceItem, at: EpochMs): EvidenceVerifyResult {
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

// ── What kind of item is on screen (reconcile pass R; decisions D205, D207) ─────────────────────
// ONE rule for both clients, built on the Core's own members. Every reader takes `unknown`, never
// throws, and an absent member is NOT REPORTED - never the favourable value.

const isFactRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** `sealedPackage` as the Core states it; null: not stated (Simulated mode, a v1 item, a simulated item). */
export type SealedPackageFact = 'PRESENT' | 'NOT_READABLE';

export function sealedPackageOf(item: unknown): SealedPackageFact | null {
  const value = isFactRecord(item) ? item['sealedPackage'] : undefined;
  return value === 'PRESENT' || value === 'NOT_READABLE' ? value : null;
}

/**
 * THE KIND OF AN EVIDENCE ITEM, by its own members:
 *   SEALED_HERE  the Core states `sealedPackage` (PRESENT or NOT_READABLE): a v2 package sealed on
 *                this Core - a product seal (REAL) or a seed-sealed demonstration item
 *                (DEMO_PACKAGE). Nothing bundled is ever drawn for it;
 *   DEMO         `integritySource` DEMO_PACKAGE or SIMULATED and no `sealedPackage`: a v1 /
 *                simulated demonstration item - the only kind bundled demo media may be drawn for;
 *   RECORD       a REAL item for which the Core states no sealed package (never sealed, or the
 *                answer came before the sealed facts were read): a record of this Core, no media;
 *   UNKNOWN      no integrity source this client can read: nothing is assumed.
 */
export type EvidenceItemKind = 'SEALED_HERE' | 'DEMO' | 'RECORD' | 'UNKNOWN';

export function evidenceItemKindOf(item: unknown): EvidenceItemKind {
  if (!isFactRecord(item)) return 'UNKNOWN';
  if (sealedPackageOf(item) !== null) return 'SEALED_HERE';
  const source = item['integritySource'];
  if (source === 'DEMO_PACKAGE' || source === 'SIMULATED') return 'DEMO';
  return source === 'REAL' ? 'RECORD' : 'UNKNOWN';
}

/** A package sealed on this Core (the Core says so itself). */
export const isSealedOnThisCore = (item: unknown): boolean => evidenceItemKindOf(item) === 'SEALED_HERE';
/** A v1 / simulated demonstration item: the only kind bundled media belongs to. */
export const isBundledDemoItem = (item: unknown): boolean => evidenceItemKindOf(item) === 'DEMO';

/** The custody action the seal of an interrupted recording writes (`capture-session.ts` holds the same word). */
const CUSTODY_INTERRUPTED_ACTION = 'RECORDING_INTERRUPTED';
const FACT_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

export interface InterruptedFact {
  /** true / false as stated; null: nothing states it. */
  readonly interrupted: boolean | null;
  /** The cause as a code, or null (none named / not interrupted). */
  readonly cause: string | null;
  /** Which member said it. */
  readonly source: 'MANIFEST' | 'CUSTODY' | null;
}

/**
 * THE INTERRUPTED FACT OF AN ITEM ON SCREEN (decision D207) - one answer for the evidence list
 * row, the item header, the seal dialog, the Monitor and the Summary.
 *
 * The truth of a sealed package is its signed manifest: when the Core states `interrupted` (it
 * reads `timeline.interrupted` of the sealed manifest), THAT is the answer, true or false. Only
 * when the member is absent (Simulated mode, a client that holds the replicated item before the
 * sealed facts were read) the item's custody entry `RECORDING_INTERRUPTED` answers - the member
 * `interruptedSealOfItem` reads. The product's own seal writes both from ONE value
 * (`closedTracks.interrupted` feeds the manifest and `completeSealTransition`), so the two never
 * differ for an item it sealed; if they ever do, the manifest wins and `source` says which spoke.
 * The cause is the Core's `interruptedCause`, else the custody entry's `detail`.
 */
export function interruptedFactOf(item: unknown): InterruptedFact {
  if (!isFactRecord(item)) return { interrupted: null, cause: null, source: null };
  const custody = item['custody'];
  const entry = Array.isArray(custody) ? custody.find((candidate) => isFactRecord(candidate) && candidate['action'] === CUSTODY_INTERRUPTED_ACTION) : undefined;
  const code = (value: unknown): string | null => (typeof value === 'string' && FACT_CODE.test(value) ? value : null);
  const custodyCause = isFactRecord(entry) ? code(entry['detail']) : null;
  const stated = item['interrupted'];
  if (typeof stated === 'boolean') return { interrupted: stated, cause: stated ? (code(item['interruptedCause']) ?? custodyCause) : null, source: 'MANIFEST' };
  if (entry !== undefined) return { interrupted: true, cause: custodyCause, source: 'CUSTODY' };
  return { interrupted: null, cause: null, source: null };
}

/**
 * The mapping table of the rule, as a vector both clients' tests and the shared test read: an item
 * (its relevant members only) and what every reader must say of it.
 */
export const EVIDENCE_ITEM_KIND_VECTORS: readonly { readonly name: string; readonly item: unknown; readonly kind: EvidenceItemKind; readonly interrupted: boolean | null; readonly cause: string | null }[] = [
  { name: 'product seal', item: { integritySource: 'REAL', sealedPackage: 'PRESENT', interrupted: false, custody: [] }, kind: 'SEALED_HERE', interrupted: false, cause: null },
  { name: 'product seal, package not readable', item: { integritySource: 'REAL', sealedPackage: 'NOT_READABLE', custody: [] }, kind: 'SEALED_HERE', interrupted: null, cause: null },
  { name: 'seed-sealed demonstration item', item: { integritySource: 'DEMO_PACKAGE', manifestVersion: 2, developmentSources: true, sealedPackage: 'PRESENT', interrupted: false }, kind: 'SEALED_HERE', interrupted: false, cause: null },
  { name: 'v1 demonstration item', item: { integritySource: 'DEMO_PACKAGE', custody: [] }, kind: 'DEMO', interrupted: null, cause: null },
  { name: 'v1 demonstration item that reads version 2 (D-85-1)', item: { integritySource: 'DEMO_PACKAGE', manifestVersion: 2 }, kind: 'DEMO', interrupted: null, cause: null },
  { name: 'a real signature alone is not the Core saying "sealed here"', item: { integritySource: 'DEMO_PACKAGE', manifestVersion: 2, developmentSources: true, signature: { algorithm: 'Ed25519', simulated: false } }, kind: 'DEMO', interrupted: null, cause: null },
  { name: 'simulated item', item: { integritySource: 'SIMULATED' }, kind: 'DEMO', interrupted: null, cause: null },
  { name: 'REAL item, no sealed package stated', item: { integritySource: 'REAL' }, kind: 'RECORD', interrupted: null, cause: null },
  { name: 'no integrity source', item: {}, kind: 'UNKNOWN', interrupted: null, cause: null },
  { name: 'not an item', item: null, kind: 'UNKNOWN', interrupted: null, cause: null },
  { name: 'an unknown value of sealedPackage is not stated', item: { integritySource: 'DEMO_PACKAGE', sealedPackage: 'YES' }, kind: 'DEMO', interrupted: null, cause: null },
  { name: 'interrupted: manifest flag and custody entry (the product seal)', item: { integritySource: 'REAL', sealedPackage: 'PRESENT', interrupted: true, interruptedCause: 'CAPTURE_FAULT', custody: [{ action: 'RECORDING_INTERRUPTED', detail: 'CAPTURE_FAULT' }] }, kind: 'SEALED_HERE', interrupted: true, cause: 'CAPTURE_FAULT' },
  { name: 'interrupted: custody entry only (the member is not stated yet)', item: { integritySource: 'REAL', custody: [{ action: 'RECORDING_INTERRUPTED', detail: 'CAPTURE_FAULT' }] }, kind: 'RECORD', interrupted: true, cause: 'CAPTURE_FAULT' },
  { name: 'interrupted: manifest flag without a cause member - the custody names it', item: { integritySource: 'REAL', sealedPackage: 'PRESENT', interrupted: true, custody: [{ action: 'RECORDING_INTERRUPTED', detail: 'CAMERA_LOST' }] }, kind: 'SEALED_HERE', interrupted: true, cause: 'CAMERA_LOST' },
  { name: 'disagreement: the manifest says NOT interrupted, a custody entry says it - the manifest wins', item: { integritySource: 'REAL', sealedPackage: 'PRESENT', interrupted: false, custody: [{ action: 'RECORDING_INTERRUPTED', detail: 'CAPTURE_FAULT' }] }, kind: 'SEALED_HERE', interrupted: false, cause: null },
  { name: 'disagreement: the manifest says interrupted, no custody entry - the manifest wins, no cause', item: { integritySource: 'REAL', sealedPackage: 'PRESENT', interrupted: true, custody: [{ action: 'RECORDING_STOPPED', detail: null }] }, kind: 'SEALED_HERE', interrupted: true, cause: null },
];

// ── What an INCOMPLETE session of the history is (fix wave J; finding JW-22) ────────────────────────
// ONE rule over the members of a history entry (operation 38 `listSessionHistory`, slice
// `sessionHistory`), so that the web console and the devices' Sessions hub say the same thing.

export type IncompleteSessionKind = 'QUARANTINED' | 'RECORDED_NOT_SEALED' | 'NEVER_RECORDED';

export interface IncompleteSessionFact {
  readonly kind: IncompleteSessionKind;
  /** The fault that ended the session (`faultKind`), or null when the entry names none. */
  readonly cause: string | null;
  /** The never-sealed record of the session, when it has one. */
  readonly evidenceId: string | null;
}

/**
 * Null for a session that is not INCOMPLETE (and for anything that is no entry). Else:
 *   QUARANTINED          it recorded and has NO evidence item: the seal was not possible, nothing of
 *                        it is presented as evidence, and the Core moved its recordings to its
 *                        quarantine folder (`endUnsealableTransition` is the only writer of such an entry);
 *   RECORDED_NOT_SEALED  it recorded and has an item: a never-sealed record (`hasSealedValues` false);
 *   NEVER_RECORDED       it ended before a recording started.
 */
/**
 * WHY THE SEAL OF A QUARANTINED SESSION WAS GIVEN UP (fix wave J round two; JW-22 remainder), as the Core's
 * code - or null. Two sources that exist, no column: the entry's own `unsealableCause` (operation 38 states it
 * from the audit row `SESSION_INCOMPLETE`), and - for a reader of the replicated slices - the alert the Core
 * raised for the session (`target` = the session, `params.reason: 'UNSEALABLE'`, `params.cause`). The alert
 * list is a ring: an old session whose alert has left it reads null from the slices and still has its cause
 * on operation 38. Takes `unknown`, never throws.
 */
export function unsealableCauseOf(entry: unknown, alerts?: unknown): string | null {
  if (!isFactRecord(entry) || entry['outcome'] !== 'INCOMPLETE') return null;
  const own = entry['unsealableCause'];
  if (typeof own === 'string' && FACT_CODE.test(own)) return own;
  const sessionId = entry['id'];
  if (typeof sessionId !== 'string' || !Array.isArray(alerts)) return null;
  for (const alert of alerts) {
    if (!isFactRecord(alert) || alert['target'] !== sessionId) continue;
    const params = alert['params'];
    if (!isFactRecord(params) || params['reason'] !== 'UNSEALABLE') continue;
    const cause = params['cause'];
    if (typeof cause === 'string' && FACT_CODE.test(cause)) return cause;
  }
  return null;
}

export function incompleteSessionFactOf(entry: unknown): IncompleteSessionFact | null {
  if (!isFactRecord(entry) || entry['outcome'] !== 'INCOMPLETE') return null;
  const cause = typeof entry['faultKind'] === 'string' && FACT_CODE.test(entry['faultKind']) ? entry['faultKind'] : null;
  const evidenceId = typeof entry['evidenceId'] === 'string' ? entry['evidenceId'] : null;
  if (evidenceId !== null) return { kind: 'RECORDED_NOT_SEALED', cause, evidenceId };
  return { kind: typeof entry['startedAt'] === 'number' ? 'QUARANTINED' : 'NEVER_RECORDED', cause, evidenceId: null };
}
