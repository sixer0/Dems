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

/** `Integrity: PASS`, or `Integrity: FAIL (TAMPERED)`. */
export function integrityLineOf(result: Pick<PackageVerifyResult, 'ok' | 'overall'>): string {
  return result.ok ? 'Integrity: PASS' : `Integrity: FAIL (${result.overall})`;
}

/** The report of one run: the source line first, its entries, the verdict, the checks, the transcript state. */
export function verifyReportLines(result: PackageVerifyResult): readonly string[] {
  return Object.freeze([
    result.sources.report,
    ...result.sources.lines,
    integrityLineOf(result),
    ...result.checks.map((check) => `${check.id} ${check.name}: ${check.status}${check.failureClass === null ? '' : ` (${check.failureClass})`}${check.skipped === null ? '' : ` (${check.skipped})`}`),
    result.transcriptState.report,
    ...(result.interrupted ? ['Interrupted recording: the sealed durable prefix'] : []),
  ]);
}
