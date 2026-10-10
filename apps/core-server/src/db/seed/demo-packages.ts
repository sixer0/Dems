/**
 * THE v2 DEMO ITEMS OF A SEED (integration pass E3 item 6; row 82c's requests; evidence package
 * spec F.2 - F.4; decisions D155, D167). Pure: no file, no process, no connection, no clock.
 *
 * WHAT. A Core in development capture can hold REAL v2 packages. For such a Core the seed does not
 * leave every demonstration item as a row that points at one of the 14 frozen v1 packages: for TWO
 * items of the dataset it asks a port (`SeedDemoPackages`) to SEAL a small generated package into
 * that Core's own evidence store with the product pipeline and the development signing key, and
 * writes the item's row from what that seal returned:
 *
 *   the tamper item   evidence sequence `DEMO_TAMPERED_EVIDENCE_SEQ` (EV 0005): after its seal ONE
 *                     fragment is altered - `(DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_FRAGMENT_SEQ)`.
 *                     Operation 41 then answers TAMPERED and names exactly that fragment;
 *   one clean item    the first other demo item of the dataset that is SEALED and not tampered.
 *
 * NEVER A HALF ITEM. Both are sealed or neither: when the port answers `SKIPPED` (no helper
 * program, no development key, another capture operation, a folder in the way) the dataset is
 * written EXACTLY as it is without this file - every item in its v1 demo shape - and the reason is
 * named in the seed's report. A row is rewritten only from a seal the port returned.
 *
 * THE ROW OF A SEED-SEALED ITEM (what `withSeedSealedPackages` puts on the dataset's item):
 *   integritySource     stays `DEMO_PACKAGE` (it is no evidence; the manifest says `demo: true`)
 *   manifestVersion 2, developmentSources true, labelsStatus / transcriptSha256 as the seal says
 *   manifestHash, signature (Ed25519, NOT simulated, the development key's ID), the two camera
 *   files as `tracks` (VIDEO-01, VIDEO-02) with their sealed size and hash, the size of both
 *   sealedAt, endedAt, durationMs   what was sealed: a clip of `mediaMs`, sealed at the seed instant
 *   tampered / tamperedTrackId      true / `DEMO_TAMPERED_FRAGMENT_TRACK` for the tamper item
 * Everything else of the item - identity, case, subject, custody, markers, notes, status - is the
 * dataset's. The audit rows of the dataset are not touched (nothing is hashed again, SD-6).
 *
 * The item's session also gets its four `session_capture_sources` rows (all `FAKE`), as the port
 * returns them: the reset guard holds a development package to them (dbc-4 N.10 rule (2)).
 */
import { DEMO_TAMPERED_EVIDENCE_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK, type CompleteSealInput, type EvidenceItem, type EvidenceSignature, type SimState } from '@dems/shared/sim';
import type { NewSessionCaptureSourceRow } from '../schema';

/** One demo item as the seed hands it to the port. Nothing of it comes from a device. */
export interface SeedDemoItem {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly caseNumber: string;
  /** Epoch milliseconds of the dataset: when the session was created and when it started to record. */
  readonly createdAt: number;
  readonly startedAt: number;
  readonly device: { readonly deviceId: string; readonly name: string; readonly serialNumber: string; readonly hardwareUuid: string; readonly softwareVersion: string };
  readonly operator: { readonly investigatorId: string; readonly displayName: string; readonly role: 'INVESTIGATOR' | 'SUPERVISOR' | 'TECHNICIAN' };
  readonly subject: { readonly name: string; readonly type: 'TERSANGKA' | 'SAKSI' | 'LAINNYA' };
}

/** One sealed package, as the port returns it. */
export interface SeedDemoSeal {
  readonly evidenceId: string;
  readonly sessionId: string;
  /** What the product pipeline handed to `completeSeal`: the columns of the item's row. */
  readonly seal: CompleteSealInput;
  /** Milliseconds of media in each camera file. */
  readonly mediaMs: number;
  /** True for the item whose one fragment was altered after the seal. */
  readonly tampered: boolean;
  /** The four source rows of the item's session: slot, device and adapter kind, as the manifest states them. */
  readonly sourceRows: readonly { readonly slot: string; readonly deviceId: string; readonly adapterKind: string }[];
}

export type SeedDemoOutcome =
  | { readonly status: 'SEALED'; readonly packages: readonly SeedDemoSeal[] }
  /** Nothing was sealed and nothing is left behind. `reason` is a code, `message` one sentence a person reads. */
  | { readonly status: 'SKIPPED'; readonly reason: string; readonly message: string };

export interface SeedDemoContext {
  /**
   * `SESSION-*` directory names of the store that the caller WILL remove before `place()` is called
   * (a reset: the folders of the demo packages its guard cleared). A target folder that exists and
   * is not named here stops the generation: nothing is ever written over a folder.
   */
  readonly replaceable: readonly string[];
  /** The store root the caller judged (a reset), when it knows one: the port refuses another root. */
  readonly storeRoot?: string | undefined;
}

export interface SeedDemoPlacement {
  /** Directory names now in the store. */
  readonly placed: readonly string[];
  /** Directory names that could not be put in place, each with a code. The rows of those items name a package that is not there. */
  readonly notPlaced: readonly { readonly directory: string; readonly reason: string }[];
}

/**
 * THE PORT. The seed calls `seal` before its transaction (the rows need the digests), `place`
 * after the commit (and, in a reset, after the old folders were removed), `discard` when anything
 * failed in between. Until `place`, nothing of a sealed package lies where a reader looks for it.
 */
export interface SeedDemoPackages {
  seal(items: readonly SeedDemoItem[], context: SeedDemoContext): Promise<SeedDemoOutcome>;
  place(): Promise<SeedDemoPlacement>;
  /** Removes what `seal` staged. Never rejects. */
  discard(): Promise<void>;
}

/** What a seed says of its v2 demo items. */
export interface SeedDemoReport {
  /** `NOT_ASKED`: no port was given (a test, a template). */
  readonly status: 'NOT_ASKED' | 'SEALED' | 'SKIPPED';
  readonly reason: string | null;
  readonly message: string | null;
  readonly items: readonly { readonly evidenceId: string; readonly sessionId: string; readonly tampered: boolean; readonly manifestSha256: string }[];
}

export const SEED_DEMO_NOT_ASKED: SeedDemoReport = Object.freeze({ status: 'NOT_ASKED', reason: null, message: null, items: Object.freeze([]) });
/** The dataset holds no pair of items the two demo packages can be made for (another scenario, another dataset). */
export const SEED_DEMO_NO_PAIR = 'DATASET_HAS_NO_DEMO_PAIR';

const EVIDENCE_SEQUENCE = /^EV-[0-9]{8}-([0-9]{4})$/;
const sequenceOf = (evidenceId: string): number | null => {
  const found = EVIDENCE_SEQUENCE.exec(evidenceId)?.[1];
  return found === undefined ? null : Number(found);
};
const OPERATOR_ROLES = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const;
const SUBJECT_TYPES = ['TERSANGKA', 'SAKSI', 'LAINNYA'] as const;

/**
 * The two demo items of a dataset: the tamper item, then one clean item - or NONE when either is
 * missing or cannot be described whole (never one alone).
 */
export function seedDemoItemsOf(state: SimState): SeedDemoItem[] {
  const candidates = state.evidence.filter((item) => item.integritySource === 'DEMO_PACKAGE' && item.status === 'SEALED' && item.sealedAt !== null && sequenceOf(item.id) !== null);
  const tamper = candidates.find((item) => sequenceOf(item.id) === DEMO_TAMPERED_EVIDENCE_SEQ);
  const clean = candidates.filter((item) => !item.tampered && sequenceOf(item.id) !== DEMO_TAMPERED_EVIDENCE_SEQ).sort((a, b) => (sequenceOf(a.id) ?? 0) - (sequenceOf(b.id) ?? 0))[0];
  if (tamper === undefined || clean === undefined) return [];
  const described: SeedDemoItem[] = [];
  for (const item of [tamper, clean]) {
    const session = state.sessionHistory.find((entry) => entry.id === item.sessionId);
    const operator = state.operators.find((entry) => entry.id === item.investigatorId);
    const role = OPERATOR_ROLES.find((known) => known === operator?.role);
    const type = SUBJECT_TYPES.find((known) => known === item.subjectType);
    if (session === undefined || session.startedAt === null || operator === undefined || role === undefined || type === undefined) return [];
    described.push({
      evidenceId: item.id,
      sessionId: item.sessionId,
      caseNumber: item.caseNumber,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      device: { deviceId: state.device.id, name: state.device.name, serialNumber: state.device.identity.serialNumber, hardwareUuid: state.device.identity.hardwareUuid, softwareVersion: state.device.softwareVersion },
      operator: { investigatorId: operator.id, displayName: operator.displayName, role },
      subject: { name: item.subjectName, type },
    });
  }
  return described;
}

/** A seal the item row cannot be written from: the caller treats the whole outcome as not sealed. */
export function seedDemoSealProblem(items: readonly SeedDemoItem[], packages: readonly SeedDemoSeal[]): string | null {
  if (packages.length !== items.length) return 'the port returned another number of packages than items';
  for (const [index, item] of items.entries()) {
    const sealed = packages[index];
    if (sealed === undefined || sealed.evidenceId !== item.evidenceId || sealed.sessionId !== item.sessionId || sealed.seal.sessionId !== item.sessionId) return 'a package is not the package of its item';
    if (sealed.seal.developmentSources !== true) return 'a package is not marked as recorded from development sources';
    if (sealed.seal.tracks.length !== 2 || sealed.seal.tracks[0]?.trackId !== 'VIDEO-01' || sealed.seal.tracks[1]?.trackId !== 'VIDEO-02') return 'a package does not hold the two camera files';
    if (!Number.isSafeInteger(sealed.mediaMs) || sealed.mediaMs < 1) return 'a package states no media length';
    if (sealed.sourceRows.length !== 4) return 'a package does not state its four sources';
    if (sealed.tampered !== (sequenceOf(item.evidenceId) === DEMO_TAMPERED_EVIDENCE_SEQ)) return 'the tamper mark is on the wrong item';
  }
  return null;
}

/** The dataset with the rows of the sealed packages (see the header). Items the port did not seal are untouched. */
export function withSeedSealedPackages(state: SimState, packages: readonly SeedDemoSeal[]): SimState {
  const sealedOf = new Map(packages.map((entry) => [entry.evidenceId, entry] as const));
  const bySession = new Map(packages.map((entry) => [entry.sessionId, entry] as const));
  const sizeOf = (entry: SeedDemoSeal): number => entry.seal.tracks.reduce((sum, track) => sum + track.sizeBytes, 0);
  return {
    ...state,
    evidence: state.evidence.map((item): EvidenceItem => {
      const sealed = sealedOf.get(item.id);
      if (sealed === undefined) return item;
      const { files: _files, fragmentChainHead: _head, ...kept } = item;
      return {
        ...kept,
        endedAt: item.recordedAt + sealed.mediaMs,
        durationMs: sealed.mediaMs,
        sealedAt: sealed.seal.sealedAt,
        sizeBytes: sizeOf(sealed),
        tracks: sealed.seal.tracks.map((track) => ({ trackId: track.trackId, label: track.trackId === 'VIDEO-01' ? 'Camera 1' : 'Camera 2', sizeBytes: track.sizeBytes, sha256: track.sha256 })),
        manifestHash: sealed.seal.manifestSha256,
        // A REAL signature of the development key. The shared type names the stand-in pair only (the
        // slice schema and the mapping admit this one; `session-machine.ts` casts the same way).
        signature: { value: sealed.seal.signature.value, keyId: sealed.seal.signature.keyId, algorithm: sealed.seal.signature.algorithm, simulated: false } as unknown as EvidenceSignature,
        tampered: sealed.tampered,
        tamperedTrackId: sealed.tampered ? DEMO_TAMPERED_FRAGMENT_TRACK : null,
        transcriptSha256: sealed.seal.transcriptSha256,
        manifestVersion: 2,
        labelsStatus: sealed.seal.labelsStatus,
        developmentSources: true,
      };
    }),
    sessionHistory: state.sessionHistory.map((entry) => {
      const sealed = bySession.get(entry.id);
      if (sealed === undefined || entry.startedAt === null) return entry;
      return { ...entry, endedAt: entry.startedAt + sealed.mediaMs, durationMs: sealed.mediaMs, sizeBytes: sizeOf(sealed) };
    }),
  };
}

/** The `session_capture_sources` rows of the sealed items' sessions, recorded at the seed instant. */
export function seedDemoSourceRows(packages: readonly SeedDemoSeal[], at: number): NewSessionCaptureSourceRow[] {
  return packages.flatMap((entry) =>
    entry.sourceRows.map((row) => ({ sessionId: entry.sessionId, slot: row.slot as NewSessionCaptureSourceRow['slot'], deviceId: row.deviceId, adapterKind: row.adapterKind as NewSessionCaptureSourceRow['adapterKind'], recordedAt: at })),
  );
}
