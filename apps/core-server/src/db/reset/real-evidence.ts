/**
 * The real-evidence guard of a demo reset (blueprint row 54 / CS-21; `dbc-3` §E.2; OD-19, RK-16,
 * SEC35-22).
 *
 * A demo reset rebuilds the database beside the old one and drops the old one last. While REAL
 * sealed evidence exists, that would destroy evidence, so the reset refuses with
 * `RESET_BLOCKED_REAL_EVIDENCE` instead. The server-side caller runs this BEFORE it quiesces
 * (operation 75 / `loadScenario`), so a refusal stops nothing that was running; the routine's own
 * authoritative pass runs as `dems_owner` at the start of R-3, still before any staging database
 * is created, so either way a refusal changes nothing.
 *
 * BOTH SIDES, FAIL-SAFE (`dbc-3` §E.2). The database side asks `evidence_items` for a row that is
 * REAL and sealed; the disk side reads the evidence-store package directory (the reader lives in
 * `../commands/evidence-store`, because this folder reads no file of its own). Any disagreement
 * blocks: a REAL row whose package is gone and a REAL package no row names are both half-deleted
 * evidence sets, which is exactly what the guard protects. Demo items — `DEMO_PACKAGE` and
 * `SIMULATED`, the regenerated v2 demo evidence among them — never block (D-DB-04); only `REAL`
 * does. A package whose manifest cannot be read cannot be cleared either.
 *
 * SELECT ONLY. The database question is a plain SELECT, so the same function serves as a
 * pre-flight preview for any role that may read `evidence_items` (the server's own refusal of
 * operation 75 and `loadScenario` calls it before it touches its pool), while the authoritative
 * run happens as `dems_owner` at the start of R-3 of the routine.
 *
 * WHAT A MESSAGE MAY HOLD: the database name, the store root, counts, and at most a few session
 * identifiers. Session identifiers are what the audit chain already names; no value of a kept
 * table, no credential, and nothing from a manifest beyond its integrity state reaches a message.
 */
import type { QueryResultRow } from 'pg';
import { evidenceStoreRoot, readEvidenceStore, type EvidenceStoreScan } from '../commands/evidence-store';
import { ResetError } from './errors';

/** What a caller may send the guard's statement with: a pool or a client checked out of one. */
export interface RealEvidenceQueryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

/**
 * The database side of the guard, the shape `dbc-3` §E.2 fixes: a REAL item that was sealed. The
 * session id is read as well because the disk side names packages by it.
 */
export const REAL_SEALED_EVIDENCE_STATEMENT =
  "SELECT e.session_id::text AS session_id FROM public.evidence_items AS e " +
  "WHERE e.integrity_source = 'REAL' AND e.sealed_at IS NOT NULL ORDER BY e.session_id";

/** How many identifiers a refusal names before it counts the rest. */
export const MAX_NAMED_SESSIONS = 5;

export interface RealEvidenceFacts {
  readonly database: string;
  readonly storeRoot: string;
  /** False when the store root does not exist at all. */
  readonly storePresent: boolean;
  /** Sessions of REAL sealed rows of `evidence_items`, in id order. */
  readonly dbSessions: readonly string[];
  /** Sessions of packages on disk whose manifest says `REAL`, in directory order. */
  readonly diskSessions: readonly string[];
  /** Package directories whose integrity could not be read from a manifest. */
  readonly unprovablePackages: readonly string[];
  /** REAL rows of the database whose package is not on disk. */
  readonly missingOnDisk: readonly string[];
  /** REAL packages on disk that no REAL sealed row of the database names. */
  readonly missingInDatabase: readonly string[];
  /** True when the reset must refuse. */
  readonly blocked: boolean;
}

export interface RealEvidenceOptions {
  /** The database the reset would rebuild: named in the message, never queried by this file. */
  readonly database: string;
  /** The evidence-store package directory. Default: `<dataDir>/media/sessions` of the data directory. */
  readonly storeRoot?: string | undefined;
  /** The data directory the store root is taken below when none is given. */
  readonly dataDir?: string | undefined;
  /** Another reader of the store, for tests. */
  readonly readStore?: ((root: string) => EvidenceStoreScan) | undefined;
}

function symmetricDifference(left: readonly string[], right: readonly string[]): string[] {
  const known = new Set(right);
  return left.filter((item) => !known.has(item));
}

function named(items: readonly string[]): string {
  if (items.length <= MAX_NAMED_SESSIONS) return items.join(', ');
  return `${items.slice(0, MAX_NAMED_SESSIONS).join(', ')}, and ${String(items.length - MAX_NAMED_SESSIONS)} more`;
}

/**
 * The two sides of one instant, compared. Pure: it is given the rows it would ask for and the
 * scan it would read, so the same comparison is tested without a database and without a disk.
 */
export function evaluateRealEvidence(
  database: string,
  storeRoot: string,
  dbSessions: readonly string[],
  scan: EvidenceStoreScan,
): RealEvidenceFacts {
  const sorted = [...dbSessions].sort();
  const real = scan.packages.filter((entry) => entry.integrity === 'REAL').map((entry) => entry.sessionId);
  const unprovable = scan.packages.filter((entry) => entry.integrity === 'UNKNOWN').map((entry) => entry.directory);
  const facts: RealEvidenceFacts = Object.freeze({
    database,
    storeRoot,
    storePresent: scan.present,
    dbSessions: Object.freeze(sorted),
    diskSessions: Object.freeze(real),
    unprovablePackages: Object.freeze(unprovable),
    missingOnDisk: Object.freeze(symmetricDifference(sorted, real)),
    missingInDatabase: Object.freeze(symmetricDifference(real, sorted)),
    blocked: false,
  });
  // `blocked` is derived, so it is set where the object is built and nowhere else.
  return Object.freeze({ ...facts, blocked: sorted.length > 0 || real.length > 0 || unprovable.length > 0 });
}

/** One sentence for a log line and for the `ResetError`: counts, then the identifiers it names. */
export function realEvidenceMessage(facts: RealEvidenceFacts): string {
  const sides = [
    `${facts.database}: ${String(facts.dbSessions.length)} REAL sealed item(s)`,
    `evidence store ${facts.storeRoot} ${facts.storePresent ? 'holds' : 'does not exist;'} ${String(facts.diskSessions.length)} REAL package(s)` +
      (facts.unprovablePackages.length === 0 ? '' : ` and ${String(facts.unprovablePackages.length)} unreadable package director(y/ies) [${named(facts.unprovablePackages)}]`),
  ];
  const halves = [
    facts.missingOnDisk.length === 0 ? '' : `in the database without a package: ${named(facts.missingOnDisk)}`,
    facts.missingInDatabase.length === 0 ? '' : `on disk without a database row: ${named(facts.missingInDatabase)}`,
  ].filter((part) => part !== '');
  return (
    `refused: real sealed evidence exists and a reset would destroy it (RESET_BLOCKED_REAL_EVIDENCE). ` +
    `${sides.join('; ')}. ${halves.join('; ')}${halves.length > 0 ? '. ' : ''}Nothing was changed.`
  );
}

/** The details of the log line that records a refusal (DC-7 shape: counts and names only). */
export function realEvidenceDetails(facts: RealEvidenceFacts): Record<string, string | number | boolean> {
  return {
    database: facts.database,
    storeRoot: facts.storeRoot,
    storePresent: facts.storePresent,
    realRows: facts.dbSessions.length,
    realPackages: facts.diskSessions.length,
    unreadablePackages: facts.unprovablePackages.length,
    rowsWithoutPackage: facts.missingOnDisk.length,
    packagesWithoutRow: facts.missingInDatabase.length,
  };
}

/**
 * Asks both sides. The database question is the SELECT of `dbc-3` §E.2 and nothing else; the disk
 * side is a directory listing. A connection failure is thrown as it is: the routine's R-3 turn of
 * the question surfaces it through its own step, and a pre-flight caller decides what to show.
 */
export async function findRealSealedEvidence(client: RealEvidenceQueryable, options: RealEvidenceOptions): Promise<RealEvidenceFacts> {
  const storeRoot = options.storeRoot ?? evidenceStoreRoot(options.dataDir);
  const { rows } = await client.query<{ session_id: string }>(REAL_SEALED_EVIDENCE_STATEMENT);
  return evaluateRealEvidence(options.database, storeRoot, rows.map((row) => row.session_id), (options.readStore ?? readEvidenceStore)(storeRoot));
}

/**
 * The guard itself: resolves with the facts when a reset may go on, and throws
 * `RESET_BLOCKED_REAL_EVIDENCE` (step R-0, target untouched) when it may not.
 */
export async function assertNoRealSealedEvidence(client: RealEvidenceQueryable, options: RealEvidenceOptions): Promise<RealEvidenceFacts> {
  const facts = await findRealSealedEvidence(client, options);
  if (facts.blocked) throw new ResetError('RESET_BLOCKED_REAL_EVIDENCE', 'R-0', realEvidenceMessage(facts));
  return facts;
}
