/**
 * The sealed-facts door of the engine host (task 3 wave H, driver C1; gate findings G94-01, G94-04,
 * G89-03, G89-04, G89-09, G75 "interrupted"; decision D200), reached beside the seam like the fact
 * doors (`sealedFactsDoorsOf(app.engine)`), and NOT a member of `EngineHost`:
 *
 *   applySealedItemFacts   what the SEALED MANIFEST of an item says and no stored column holds: the
 *                          audio-source intervals, the `interrupted` flag, the camera files with
 *                          their sealed hashes, whether the certificate the manifest names is a
 *                          development key - and that the package was read at all
 *                          (`sealedPackage`). Called by `src/evidence-facts` after a start of the
 *                          Core (a state the engine READ BACK carries none of them: no column) and
 *                          after a seal committed. One unit with no actor, no permission and no
 *                          audit row: a label, not a change of evidence.
 *
 * WHY A DOOR AND NOT A COLUMN. The brief of this wave forbids a migration, and none is needed: the
 * item's own sealed manifest is the record. It is read under the anchor the database holds
 * (`evidence_items.manifest_hash`) by `src/evidence-facts`; this file only puts what was read onto
 * the replicated item.
 *
 * NOTHING STORED IS TOUCHED. The transition sets members no row holds - and `files`, which the
 * mapping writes ONLY when it inserts an item (`db/mapping/changes.ts` compares track rows when the
 * `tracks` array changed; the transition never replaces that array). Status, custody, tracks, the
 * manifest hash and the four stored members of the signature are left exactly as they are, so the
 * write-through of the unit sends NO statement. `signature.developmentKey` is a fifth, unstored
 * member beside the four.
 *
 * THE ANCHOR. A fact list names the manifest digest it was read under. An item whose
 * `manifestHash` is another (or an unknown item) is skipped: a fact of another manifest states
 * nothing about it. A call that changes nothing returns the SAME state and sends no statement.
 */
import type { EvidenceItem, SimState } from '@dems/shared/sim';
import { EngineError } from './errors';
import type { EngineHost, EngineOutcome } from './types';

/** One audio-source interval as the item carries it (`EvidenceItemSchema.audioSourceIntervals`). */
export interface SealedAudioInterval {
  readonly seq: number;
  readonly inputId: string;
  readonly role: 'PRIMARY' | 'STANDBY';
  readonly fromMs: number;
  readonly toMs: number | null;
  readonly reason: 'START' | 'MANUAL' | 'STOP';
  readonly sourceClass?: 'PRODUCTION' | 'LOCAL_DEVICE' | 'FAKE';
}

/** One camera file as the sealed manifest records it (`EvidenceItemSchema.files`). */
export interface SealedFileFact {
  readonly trackId: 'VIDEO-01' | 'VIDEO-02';
  readonly fileName: string;
  readonly sizeBytes: number;
  /** SHA-256 of the STORED bytes of the whole file. */
  readonly sha256: string;
  readonly fragmentCount: number;
  readonly sha256Plain?: string;
  readonly fragmentChainHead?: string | null;
}

/** The model of a sealed transcript as the item carries it (`EvidenceItemSchema.transcriptModel`; operation 41's shape). */
export interface SealedTranscriptModel {
  readonly name: string;
  readonly version: string | null;
  readonly quantisation: string | null;
  readonly modelSha256: string | null;
  readonly reportedByServer: boolean;
  readonly report: string;
}

/** What was read of ONE item's sealed package. */
export type SealedItemFacts =
  | {
      readonly evidenceId: string;
      /** The digest the facts were read under: the item's `manifestHash`. */
      readonly manifestHash: string;
      readonly sealedPackage: 'PRESENT';
      readonly interrupted: boolean;
      readonly audioSourceIntervals: readonly SealedAudioInterval[];
      readonly files: readonly SealedFileFact[];
      /** true / false from the certificate the sealed manifest names; null: not established. */
      readonly developmentKey: boolean | null;
      /**
       * Fix wave K, driver S2 (G81b-06; D160): the model of the sealed transcript, as the ONE verifier
       * states it for a manifest whose signature held (`report.transcriptModel`). Null / absent: not
       * stated - no document sealed, or the signature did not hold. Never a default.
       */
      readonly transcriptModel?: SealedTranscriptModel | null;
    }
  | {
      readonly evidenceId: string;
      readonly manifestHash: string;
      /** The item has a sealed package here by its own facts, and its manifest could not be read as the one it was sealed with. */
      readonly sealedPackage: 'NOT_READABLE';
    };

/** The members the transition sets on an item. None is a stored column. */
export interface SealedItemMembers {
  sealedPackage?: 'PRESENT' | 'NOT_READABLE';
  interrupted?: boolean;
  interruptedCause?: string | null;
  audioSourceIntervals?: SealedAudioInterval[];
  transcriptModel?: SealedTranscriptModel;
}
export type ItemWithSealedFacts = EvidenceItem & SealedItemMembers & { signature: EvidenceItem['signature'] & { developmentKey?: boolean | null } };

export interface EngineSealedFactsDoors {
  applySealedItemFacts(facts: readonly SealedItemFacts[]): Promise<EngineOutcome<boolean>>;
}

/** Label of the unit (a label of the host is `engine.<what it does>`). */
export const SEALED_FACTS_DOOR_LABEL = { applied: 'engine.applySealedItemFacts' } as const;

const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The code the custody entry `RECORDING_INTERRUPTED` of the item names, or null. A stored fact of the item itself. */
function interruptedCauseOf(item: EvidenceItem): string | null {
  const entry = item.custody.find((candidate) => candidate.action === 'RECORDING_INTERRUPTED');
  return entry !== undefined && typeof entry.detail === 'string' && CODE.test(entry.detail) ? entry.detail : null;
}

/** The item with the facts on it, or the SAME item when it says all of them already. */
export function itemWithSealedFacts(item: EvidenceItem, facts: SealedItemFacts): EvidenceItem {
  const held = item as ItemWithSealedFacts;
  if (facts.sealedPackage === 'NOT_READABLE') {
    // Nothing that was read: only the state itself. Members an earlier reading put there are not kept as if they were read now.
    if (held.sealedPackage === 'NOT_READABLE') return item;
    const { interrupted: _interrupted, interruptedCause: _cause, audioSourceIntervals: _intervals, transcriptModel: _model, ...rest } = held;
    const { developmentKey: _key, ...signature } = held.signature;
    return { ...rest, signature, sealedPackage: 'NOT_READABLE' } as EvidenceItem;
  }
  const next: ItemWithSealedFacts = {
    ...held,
    sealedPackage: 'PRESENT',
    interrupted: facts.interrupted,
    audioSourceIntervals: facts.audioSourceIntervals.map((interval) => ({ ...interval })),
    signature: { ...held.signature, developmentKey: facts.developmentKey },
    files: facts.files.map((file) => ({ ...file })),
  };
  if (facts.interrupted) next.interruptedCause = interruptedCauseOf(item);
  else delete next.interruptedCause;
  // The model of THIS reading or none: a reading that states no model leaves no model of an earlier one.
  if (facts.transcriptModel !== undefined && facts.transcriptModel !== null) next.transcriptModel = { ...facts.transcriptModel };
  else delete next.transcriptModel;
  const unchanged =
    held.sealedPackage === next.sealedPackage &&
    held.interrupted === next.interrupted &&
    (held.interruptedCause ?? null) === (next.interruptedCause ?? null) &&
    held.signature.developmentKey === next.signature.developmentKey &&
    same(held.audioSourceIntervals, next.audioSourceIntervals) &&
    same(held.transcriptModel ?? null, next.transcriptModel ?? null) &&
    same(held.files, next.files);
  return unchanged ? item : (next as EvidenceItem);
}

/**
 * The pure transition. Every fact is held to the item's manifest digest; an item that is not in
 * the state, or was sealed with another manifest, is skipped. The `tracks` array of an item is
 * never replaced (the header says why).
 */
export function applySealedItemFactsTransition(state: SimState, facts: readonly SealedItemFacts[]): SimState {
  if (!Array.isArray(facts)) throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the sealed facts of evidence items were called with no list');
  const byId = new Map(facts.map((fact) => [fact.evidenceId, fact] as const));
  let changed = false;
  const evidence = state.evidence.map((item) => {
    const fact = byId.get(item.id);
    if (fact === undefined || fact.manifestHash !== item.manifestHash) return item;
    const next = itemWithSealedFacts(item, fact);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...state, evidence } : state;
}

/** Throws `ENGINE_ACTION_NOT_HOSTED` for an engine a test put behind the seam that has no such door. */
export function sealedFactsDoorsOf(engine: EngineHost): EngineSealedFactsDoors {
  const doors = engine as EngineHost & Partial<EngineSealedFactsDoors>;
  if (typeof doors.applySealedItemFacts !== 'function') {
    throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the engine behind the seam is not the host of src/engine: it has no sealed-facts door');
  }
  return doors as EngineHost & EngineSealedFactsDoors;
}
