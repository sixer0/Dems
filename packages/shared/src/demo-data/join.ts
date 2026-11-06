/**
 * The one demo-package join (step 54; D84 ruling on F-47-1; review 40 M4, R2, R9).
 *
 * A simulator evidence item and a step-93 DEMO package describe the same interview when:
 * - the evidence suffix matches (`EV-…-NNNN`, the D61 join key);
 * - the session suffix matches (`SES-…-NNNN`);
 * - the case SEQUENCE matches (the `NNNN` of `LP/YYYY/MMDD-NNNN`), and
 * - the subject name matches.
 *
 * The dated parts of the IDs and of the case number are ignored on purpose: the simulator dates
 * its dataset relative to its clock, the packages carry the generator's `--as-of` day. So media,
 * hashes and verification join on ANY demo day, with no step-92/93 regeneration (F-47-1).
 * A session the presenter records live also seals into evidence 0014 (the recording scenario's
 * package), but with another case sequence or subject it joins nothing (M4).
 *
 * Pure and platform-neutral; it reads only the generated index (no Node built-ins).
 */
import { demoIdSuffix, getDemoEvidencePackage } from './lookup';
import type { DemoEvidencePackage } from './types';

const CASE_SEQUENCE = /-(\d{1,4})\s*$/;

/** The `NNNN` of a case number `LP/YYYY/MMDD-NNNN` as a number, or null. */
export function demoCaseSequence(caseNumber: string | null | undefined): number | null {
  const match = CASE_SEQUENCE.exec(String(caseNumber ?? ''));
  return match?.[1] ? Number(match[1]) : null;
}

/** The fields of a simulator evidence item (or session history entry) the join reads. */
export interface DemoJoinEvidence {
  /** Evidence ID (`EV-…-NNNN`) or suffix. */
  id: string;
  caseNumber: string;
  subjectName: string;
  /** Session ID; may be given as the second argument instead. */
  sessionId?: string | null;
}

/**
 * The DEMO package of an evidence item, or null. `session` (an ID or `{ id }`) overrides
 * `evidence.sessionId`; without any session ID nothing joins.
 */
export function matchDemoPackage(
  evidence: DemoJoinEvidence,
  session?: string | { id: string } | null,
): DemoEvidencePackage | null {
  const pkg = getDemoEvidencePackage(evidence.id);
  if (!pkg) return null;
  const sessionId = typeof session === 'string' ? session : (session?.id ?? evidence.sessionId ?? null);
  if (!sessionId || demoIdSuffix(sessionId, 'SES') !== pkg.sessionSuffix) return null;
  const caseSeq = demoCaseSequence(evidence.caseNumber);
  if (caseSeq === null || caseSeq !== demoCaseSequence(pkg.caseNumber)) return null;
  return pkg.subjectName === evidence.subjectName.trim() ? pkg : null;
}
