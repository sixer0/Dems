/**
 * What the loader of the bulk fixture reports, and how it is printed (plan row W25; BF-5).
 *
 * The report holds names, counts and times. It holds no value of a row, and so no hash of
 * anything; the two integrity values it names (the fixture digest and the chain head) are not
 * secrets.
 */
import { compareWithMinimums, type MinimumComparison } from './minimums';

export interface BulkFixtureReport {
  readonly database: string;
  readonly role: string;
  /** The instant the fixture was built as of. */
  readonly now: number;
  readonly seed: number;
  readonly activeSession: boolean;
  /** The row count of each of the 30 tables after the load, by SQL name. */
  readonly counts: Readonly<Record<string, number>>;
  /** Rows the fixture inserted, by SQL name. */
  readonly added: Readonly<Record<string, number>>;
  /** "entity, minimum, loaded" for all 30 tables. */
  readonly minimums: readonly MinimumComparison[];
  /** True when every table holds at least its minimum. */
  readonly met: boolean;
  readonly auditHead: { readonly seq: number; readonly hash: string };
  /** SHA-256 of a stable dump of the fixture's rows: equal for equal seed, clock and base. */
  readonly digest: string;
  /** Milliseconds: reading the base and building the rows; the statements; everything. */
  readonly buildMs: number;
  readonly writeMs: number;
  readonly totalMs: number;
}

/** The report's minimum comparison for a set of counts. */
export function minimumReport(counts: Readonly<Record<string, number>>): { minimums: MinimumComparison[]; met: boolean } {
  const minimums = compareWithMinimums(counts);
  return { minimums, met: minimums.every((entry) => entry.met) };
}

/** The lines the loader prints: one header, the table "entity, minimum, loaded", one summary. */
export function formatBulkFixtureReport(report: BulkFixtureReport): string[] {
  const lines: string[] = [];
  lines.push(
    `bulk fixture: ${report.database} as ${report.role}; clock ${new Date(report.now).toISOString()}; seed ${report.seed}` +
      `${report.activeSession ? '; variant: one recording session' : ''}`,
  );
  lines.push(`  ${'table'.padEnd(22)} ${'minimum'.padStart(8)} ${'loaded'.padStart(8)}  ${'added'.padStart(6)}  met`);
  for (const entry of report.minimums) {
    lines.push(
      `  ${entry.table.padEnd(22)} ${String(entry.minimum).padStart(8)} ${String(entry.loaded).padStart(8)}  ` +
        `${String(report.added[entry.table] ?? 0).padStart(6)}  ${entry.met ? 'yes' : 'NO'}`,
    );
  }
  const below = report.minimums.filter((entry) => !entry.met).map((entry) => entry.table);
  lines.push(
    `bulk fixture: ${below.length === 0 ? 'every minimum of the 30 tables is met' : `BELOW THE MINIMUM: ${below.join(', ')}`}; ` +
      `audit head seq ${report.auditHead.seq}, hash ${report.auditHead.hash.slice(0, 16)}...; digest ${report.digest.slice(0, 16)}...; ` +
      `build ${Math.round(report.buildMs)} ms, write ${Math.round(report.writeMs)} ms, total ${Math.round(report.totalMs)} ms`,
  );
  return lines;
}
