/**
 * A verify result as report lines (blueprint row 141; evidence package spec §D.1, §H.5).
 *
 * THE ORDER IS THE RULE. The source line is the FIRST line of every report, before the integrity
 * verdict and before the per-check results, and it is never collapsed:
 *
 *   development package    "DEVELOPMENT SOURCES \u2014 this package was not recorded from production
 *                          devices." followed by one entry per source
 *   all PRODUCTION         "Sources: declared as production devices by the Core that sealed this
 *                          package." - "declared": the verifier cannot tell such a manifest from a
 *                          package that truly came from production devices (§H.5)
 *   altered or unreadable  "Sources: not trustworthy \u2014 the manifest was altered" / "unknown": no
 *                          class of an unsigned manifest is printed as fact
 *
 * The verdict line follows unchanged: a development class never turns a pass into a failure and
 * never hides one. English; a client shows its own wording by the codes of the result.
 */
import type { PackageVerifyResult } from './types';

/**
 * THE DEVELOPMENT-KEY LINE (controller decision D147; row 82's `evidence:dev-key`). A signing key
 * made for development carries this unit in its certificate subject, which is manifest field 25
 * (`device.certificate.subject`, inside the signed digest) and the subject of
 * `device-certificate.pem`. A package signed with such a key prints the line below directly after
 * the source block (the source line and its entries), before the verdict. It is a statement about
 * the KEY: the signature check (V-09) and the verdict pass or fail on their own merits.
 */
export const DEVELOPMENT_KEY_SUBJECT_MARK = 'OU=DEVELOPMENT KEY - NOT FOR PRODUCTION';
export const DEVELOPMENT_KEY_REPORT_LINE = 'Signed with a DEVELOPMENT key \u2014 not a production signature.';
/**
 * THE LINE WHEN THE KEY IS NOT ESTABLISHED (fix pass F-M7, R88-08): the signature, the manifest or
 * its certificate did not verify (or the verifier could not read the certificate's subject), so
 * whether the key is a development key is NOT said as a fact - neither way.
 */
export const SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE = 'Signing key: not established \u2014 the signature or its certificate did not verify.';

/** True when a certificate subject text carries the development-key unit. */
export function isDevelopmentKeySubject(subject: string): boolean {
  return subject.includes(DEVELOPMENT_KEY_SUBJECT_MARK);
}

/** `Integrity: PASS`, or `Integrity: FAIL (TAMPERED)`. */
export function integrityLineOf(result: Pick<PackageVerifyResult, 'ok' | 'overall'>): string {
  return result.ok ? 'Integrity: PASS' : `Integrity: FAIL (${result.overall})`;
}

/** The report of one run: the source line first, its entries, the development-key line when it applies, the verdict, the checks, the transcript state, the transcript model when a document is sealed. */
export function verifyReportLines(result: PackageVerifyResult): readonly string[] {
  return Object.freeze([
    result.sources.report,
    ...result.sources.lines,
    ...(result.signature.developmentKey === true ? [DEVELOPMENT_KEY_REPORT_LINE] : result.signature.developmentKey === null ? [SIGNING_KEY_NOT_ESTABLISHED_REPORT_LINE] : []),
    integrityLineOf(result),
    ...result.checks.map((check) => `${check.id} ${check.name}: ${check.status}${check.failureClass === null ? '' : ` (${check.failureClass})`}${check.skipped === null ? '' : ` (${check.skipped})`}`),
    result.transcriptState.report,
    // D160: which model made the transcript, and whether the Core verified a file or repeats a server's word.
    ...(result.transcriptModel === null ? [] : [result.transcriptModel.report]),
    ...(result.interrupted ? ['Interrupted recording: the sealed durable prefix'] : []),
    // What the format does not cover (R88-06): said on every report, never collapsed.
    ...result.notices.map((notice) => notice.report),
  ]);
}
