/**
 * `transcript/transcript-revisions.json` as verify V-11 reads it (blueprint row 85; evidence spec
 * §A.1, §C.3, §D V-11; SEC35-20; database contract §B.9).
 *
 * NO SPEC FIXES THIS FILE'S MEMBERS, and no writer of it exists yet (the transcript spec §A.6
 * calls its record "a proposal" and hands the placement to the evidence spec, which names the
 * file only). The shape below is this row's reading: the columns of `transcript_revisions`
 * (database contract §B.9) in the camelCase of the package, one record per revision. The unit
 * that will write the file (the transcript revision path, operation 85) must write exactly this,
 * or this schema is changed with it — see the note of row 85, "to wire".
 *
 * THE RETAINED CERTIFICATE SET (SEC35-20; spec §C.3 "the package retains the certificate set")
 * has no stated place either. This row reads a revision's certificate from
 * `device-certificate.pem` when its SHA-256 is the revision's `certificateSha256`, and otherwise
 * from `certificates/<sha256>.pem`.
 */
import { z } from 'zod';

export const TRANSCRIPT_REVISIONS_SCHEMA_ID = 'dems.transcript-revisions/1';
export const RETAINED_CERTIFICATES_DIR = 'certificates';

/** `certificates/<sha256>.pem`: a certificate of the retained set other than the sealing one. */
export function retainedCertificatePath(certificateSha256: string): string {
  return `${RETAINED_CERTIFICATES_DIR}/${certificateSha256}.pem`;
}

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);

export const TranscriptRevisionRecordSchema = z.strictObject({
  revisionNo: z.number().int().min(1),
  /** Revision 1: the sealed machine transcript's hash. Later: the `sha256` of the revision before. */
  parentSha256: hex64,
  /** SHA-256 of the canonical revision body: the 32 bytes the signature covers (spec §C.1). */
  sha256: hex64,
  authorId: z.string().min(1),
  reason: z.string().min(1),
  createdAt: z.number().int().min(0),
  signature: z.strictObject({
    algorithm: z.enum(['Ed25519', 'ECDSA-P256-SHA256']),
    keyId: z.string().min(1),
    value: z.string().regex(/^([0-9a-f]{2})+$/),
    /** SEC35-20. null (a revision written before the column existed) cannot be verified and fails V-11. */
    certificateSha256: hex64.nullable(),
  }),
  /**
   * The canonical revision body. REQUIRED by verify V-11 (pass D6, erratum PE-D6-01): its hash is
   * recomputed against `sha256`, and its own members `REVISION_BOUND_MEMBERS` must equal what this
   * record and the list say. Optional in the SCHEMA only so that a record whose body was removed
   * is reported by its revision number (`REVISION_BODY_MISSING`), not as an unreadable file.
   */
  body: z.record(z.string(), z.json()).optional(),
});
export type TranscriptRevisionRecord = z.output<typeof TranscriptRevisionRecordSchema>;

/**
 * The members every revision body carries, each equal to the record's (`revisionNo`,
 * `parentSha256`, `authorId`, `reason`, `createdAt`) or the sealed manifest's (`evidenceId`,
 * `machineTranscriptSha256` = `transcript.sha256`) value. The body is what is hashed and signed (spec
 * §C.1), so through it the signature covers who revised, why, when, on what and for which item.
 */
export const REVISION_BOUND_MEMBERS = ['evidenceId', 'machineTranscriptSha256', 'revisionNo', 'parentSha256', 'authorId', 'reason', 'createdAt'] as const;

export const TranscriptRevisionsFileSchema = z.strictObject({
  schema: z.literal(TRANSCRIPT_REVISIONS_SCHEMA_ID),
  evidenceId: z.string().min(1),
  /** = the manifest's `transcript.sha256`: binds the list to the immutable original (OD-15). */
  machineTranscriptSha256: hex64,
  revisions: z.array(TranscriptRevisionRecordSchema),
});
export type TranscriptRevisionsFile = z.output<typeof TranscriptRevisionsFileSchema>;
