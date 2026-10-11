/**
 * THE PURE RULES BOTH CLIENTS APPLY TO AN EVIDENCE ANSWER (batch N; final code review R101-03,
 * ruling D241: "ONE rule"). The web console and the mobile apps each read operation 41's answer,
 * an item's `transcriptModel` and a transcript revision with a file of their own, and those files
 * had diverged without a reason: the same answer of the same package read "FAIL" on one client and
 * "Not run" on the other. What decides a WORD on the screen is here, once; each client keeps its
 * rendering and imports the rule (`@dems/shared/evidence-rules`).
 *
 *   1. `v2FilePartOutcome`   what one part of a camera-file row of operation 41 says
 *   2. `readTranscriptModel` the member `transcriptModel` (operations 40 / 41, slice `evidence`)
 *   3. `readRevisionReason`  the member `reason` of a transcript revision (operations 85 / 86)
 *
 * NO DEPENDENCY, by design: no zod, no schema of the package, no React. The verifier
 * (`../evidence-verify`) and the contract (`../api`) are not imported - a client bundle that takes
 * this file takes nothing else with it. That the bounds below are the contract's is held by the
 * test of this module (`test/evidence-verify.test.ts`), which reads the contract's schemas and
 * examples.
 *
 * Every reader takes `unknown`, never throws, and answers "not stated" (null) for a value that is
 * not the contract's shape: never a default, never a guess.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

// ── 1. A part of a camera-file row ─────────────────────────────────────────────────────────────

/** The parts of a camera-file row: stored bytes, plaintext after decryption, chain continuity. */
export type V2FilePart = 'stored' | 'plain' | 'chain';

/** The check of operation 41's report that judges each part (evidence package spec §D). */
export const V2_FILE_PART_CHECK = { stored: 'V-04', plain: 'V-05', chain: 'V-06' } as const satisfies Record<V2FilePart, string>;

/**
 * What one part says. `NOT_RUN` is "the check did not run for this part": it is drawn "Not run" by
 * both clients (`evidence.verifyV2.outcome.SKIPPED`) and is never a pass and never a failure.
 */
export type V2PartOutcome = 'PASS' | 'FAIL' | 'NOT_RUN';

/**
 * The members of a file row the rule reads, by name. `plainChecked` is the contract's optional
 * member (a boolean there): the Core writes `false` or nothing, and ONLY the value `false` says
 * "not run" - `true` and an absent member both mean `plainOk` is the result of the check.
 */
export interface V2FilePartFacts {
  readonly storedOk: boolean;
  readonly plainOk: boolean;
  readonly chainOk: boolean;
  readonly plainChecked?: boolean | undefined;
}

/**
 * THE ONE RULE (R101-03, ruling D241), for all three parts alike:
 *
 *   1. the answer states the part passed                               -> `PASS`
 *   2. the answer states the check did not run for this part           -> `NOT_RUN`, never `FAIL`:
 *      a. the file row says so itself: `plainChecked === false` (the plaintext part only; per
 *         FILE - check V-05 can fail for one file while another file was not checked), or
 *      b. the check of that part (`V2_FILE_PART_CHECK`) is `SKIPPED` in the per-check report of
 *         the SAME result
 *   3. else                                                             -> `FAIL`: the part's own
 *      flag is the result of a check that ran.
 *
 * NEVER A GUESS: `NOT_RUN` needs one of the two statements of the answer. A result without the
 * per-check report, or whose report does not name the check, says nothing about "not run"; the
 * part's flag stands. A part that passed stays `PASS` whatever else is said.
 */
export function v2FilePartOutcome(file: V2FilePartFacts, part: V2FilePart, checks: readonly { readonly id: string; readonly status: string }[] | null | undefined): V2PartOutcome {
  const ok = part === 'stored' ? file.storedOk : part === 'plain' ? file.plainOk : file.chainOk;
  if (ok === true) return 'PASS';
  if (part === 'plain' && file.plainChecked === false) return 'NOT_RUN';
  const check = checks?.find((entry) => entry.id === V2_FILE_PART_CHECK[part]);
  return check !== undefined && check.status === 'SKIPPED' ? 'NOT_RUN' : 'FAIL';
}

// ── 2. The transcript model ────────────────────────────────────────────────────────────────────

/** The member of an item and of operation 41's answer that states the transcript model. */
export const TRANSCRIPT_MODEL_MEMBER = 'transcriptModel';

/**
 * The longest text member of `transcriptModel` (`EvidenceTranscriptModelSchema` and operation 41's
 * member: `name`, `version`, `quantisation` and `report` are 1 to 256 characters). ONE bound for
 * both clients: the web read 256 / 256 / 64 / 1,024 and the mobile apps 200 / 200 / 64 / 1,000.
 */
export const TRANSCRIPT_MODEL_TEXT_MAX = 256;

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** The model of a sealed transcript as a client holds it (decision D160). */
export interface ItemTranscriptModel {
  readonly name: string;
  /** The version the installation DECLARED (PE-D9-01); null with a server backend. */
  readonly version: string | null;
  readonly quantisation: string | null;
  readonly modelSha256: string | null;
  /** A server backend reported the name; the Core verified nothing of the model. */
  readonly reportedByServer: boolean;
  /** The Core's own line about the model (D160's sentence for a server backend). */
  readonly report: string;
}

/** A text member of the model: a string with something in it, within the contract's bound; else not stated. Returned as it came. */
const modelText = (value: unknown): string | null => (typeof value === 'string' && value.trim().length > 0 && value.length <= TRANSCRIPT_MODEL_TEXT_MAX ? value : null);

/**
 * Reads `transcriptModel`. The model is NOT STATED (null) unless `name`, `report` and
 * `reportedByServer` all read: never a default name, never "verified". An optional member that does
 * not read (`version`, `quantisation`, `modelSha256`) is null on its own.
 */
export function readTranscriptModel(value: unknown): ItemTranscriptModel | null {
  if (!isRecord(value)) return null;
  const name = modelText(value['name']);
  const report = modelText(value['report']);
  const reportedByServer = value['reportedByServer'];
  if (name === null || report === null || typeof reportedByServer !== 'boolean') return null;
  const modelSha256 = value['modelSha256'];
  return {
    name,
    version: modelText(value['version']),
    quantisation: modelText(value['quantisation']),
    modelSha256: typeof modelSha256 === 'string' && SHA256_HEX.test(modelSha256) ? modelSha256 : null,
    reportedByServer,
    report,
  };
}

// ── 3. The reason of a transcript revision ─────────────────────────────────────────────────────

/** The member of a revision (operations 85 and 86) that carries the note its author gave. */
export const REVISION_REASON_MEMBER = 'reason';

/** The longest reason the Core stores (operation 85 `note`: 5 to 500 characters after trimming). */
export const REVISION_REASON_MAX = 500;

/**
 * Reads the reason of a revision: the member's text, TRIMMED, when it has 1 to
 * `REVISION_REASON_MAX` characters after trimming; else null ("not reported"). ONE reading for both
 * clients: the web bounded the untrimmed text and kept its blanks, the mobile apps trimmed.
 */
export function readRevisionReason(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const reason = value[REVISION_REASON_MEMBER];
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  return trimmed.length > 0 && trimmed.length <= REVISION_REASON_MAX ? trimmed : null;
}
