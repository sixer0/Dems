/**
 * Refusals of the evidence-package unit (blueprint row 83). A code and a member name only: no
 * message of this unit ever carries a value of a manifest, so nothing of a package can reach a log
 * through an error text.
 */
export const EvidencePackageRefusal = {
  /** A value that canonical JSON cannot hold (undefined, a non-finite number, a class instance …). */
  NOT_CANONICAL: 'NOT_CANONICAL',
  /** The manifest does not satisfy the strict v2 schema. */
  MANIFEST_INVALID: 'MANIFEST_INVALID',
  /** `fragments.json` does not satisfy its schema. */
  FRAGMENTS_INVALID: 'FRAGMENTS_INVALID',
  /** `signature.sig` does not satisfy its schema. */
  SIGNATURE_FILE_INVALID: 'SIGNATURE_FILE_INVALID',
  /** The session-start source record is not exactly the four slots (database contract N.3 MR-S4). */
  SOURCE_RECORD_MISSING: 'SOURCE_RECORD_MISSING',
  /** An adapter kind without a source class: never written as PRODUCTION (spec §B.12 rule 2). */
  SOURCE_CLASS_UNMAPPED: 'SOURCE_CLASS_UNMAPPED',
  /** A track or interval names a device that the session-start record does not hold. */
  SOURCE_NOT_RECORDED: 'SOURCE_NOT_RECORDED',
  /** A signature of the wrong length or alphabet for its algorithm. */
  SIGNATURE_ENCODING: 'SIGNATURE_ENCODING',
} as const;
export type EvidencePackageRefusal = (typeof EvidencePackageRefusal)[keyof typeof EvidencePackageRefusal];

export class EvidencePackageError extends Error {
  readonly code: EvidencePackageRefusal;
  /** Dotted member paths (never values) that the refusal is about. */
  readonly members: readonly string[];
  constructor(code: EvidencePackageRefusal, members: readonly string[] = []) {
    super(members.length > 0 ? `${code}: ${members.join(', ')}` : code);
    this.name = 'EvidencePackageError';
    this.code = code;
    this.members = Object.freeze([...members]);
  }
}
