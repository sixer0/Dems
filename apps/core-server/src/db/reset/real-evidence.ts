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
 * DEVELOPMENT PACKAGES ARE EXEMPT, NARROWLY (`dbc-4` §N.10 and §E.2 erratum PE-128-40; D83 O-5,
 * confirmed by the user D87(3); SEC35-42). A package recorded from development sources (this
 * Mac's camera and microphone, the fake sources) is `REAL` and yet not protected evidence. A REAL
 * sealed item is exempt from the database side only when ALL of these hold:
 *   (1) `development_sources IS TRUE` - the predicate is `IS TRUE`, so `NULL` (every v1 item and
 *       every row older than migration 0008) and `false` BLOCK. A "not false" form would unprotect
 *       every legacy item; it is the one mistake this guard must never make.
 *   (2) the cross-check: the item's session holds EXACTLY four `session_capture_sources` rows and
 *       every one of them is a development kind (`FAKE`, `LOCAL_DEVICE`). The count is of
 *       development kinds, not of "non-production" ones, so an adapter kind added later blocks
 *       until this list names it (fail closed). A single summary column never decides destruction.
 *   (3) the reset states how many development packages it will erase (`developmentPackages`, the
 *       routine's `RESET_DEVELOPMENT_PACKAGES` line) and runs only on the caller's existing
 *       confirmation - the command line itself, or the confirmation of operation 75.
 * An item that claims (1) and fails (2) blocks and is counted (`developmentUnproven`). None of the
 * three facts is writable by the runtime role: `development_sources` and `adapter_kind` have no
 * UPDATE grant and `session_capture_sources` is INSERT-only (`0009`).
 *
 * THE DISK SIDE FOLLOWS THE ROW SIDE, AND ONLY IT (decision D98(1); blueprint row 141). A package
 * folder that would block (its integrity reads `REAL`, or cannot be read by the store scan) is
 * cleared when BOTH hold:
 *   (4) its session's item row is exempt by (1) and (2), and that session has exactly one such row;
 *   (5) the folder's SIGNED manifest verifies - structure, manifest hash, signature, certificate and
 *       the source mark (verify checks V-01, V-03, V-09, V-13, V-15) - it is the manifest of that
 *       session and item with the digest the row recorded at the seal (`manifest_hash`), and its
 *       mark, recomputed from the per-source classes, says development sources.
 * Everything else on disk blocks as before: an unsigned, edited or re-hashed manifest, a manifest
 * whose classes are all `PRODUCTION` although the row says development, a folder no exempt row
 * names, a v1 package. The manifest is read by the verify unit (`../../evidence-verify`): this
 * folder still opens no file.
 *
 * SEED-SEALED DEMO PACKAGES (integration pass E3; `ev` F.2 - F.4; row 82c). A development-capture
 * Core's seed SEALS two demo items into its store with the product pipeline and the development key
 * (`db/seed/demo-packages.ts`). Their rows are `DEMO_PACKAGE` - which never blocks on the database
 * side (D-DB-04) - but their folders are v2 packages the store scan cannot read, so without a rule
 * they would block every reset as "unprovable". They are held to EXACTLY the rules of a development
 * item, no looser:
 *   the row     `DEMO_PACKAGE`, `manifest_version` 2, a signature that is NOT simulated, sealed;
 *               then (1) `development_sources IS TRUE` and (2) exactly four source rows, all of a
 *               development kind. A row that fails either gives its folder no anchor.
 *   the folder  rules (4) and (5) unchanged: one such row names the session, and the SIGNED
 *               manifest verifies, is the manifest of that item with the digest the row recorded,
 *               and its recomputed mark says development sources. The one altered fragment of the
 *               tamper item does not touch what rule (5) reads (manifest, signature, certificate).
 *   removal     rules (6) to (8) unchanged; the reseed of the same reset seals them again.
 * They are counted apart (`seedSealedDemoSessions`): they are no "development-source package
 * record" a reset erases for good, and the reset says so in its own sentence.
 *
 * THE LAYOUT (decision D133 (2); `ev` §A.1). A package is a folder `SESSION-<sessionId>` directly
 * below the store root: a v2 package holds `session-manifest.json` (read by the verify unit for
 * rule (5)), a v1 package `manifest.json` (read by the store scan). A folder named after the
 * session alone (`<sessionId>/`, the live media directory of `cap` §H) is NOT a package: the scan
 * does not list it, the guard never asks its manifest and never removes it.
 *
 * A PERMITTED RESET REMOVES THE FOLDERS IT CLEARED (decision D133 (2)), so that the folder of an
 * erased development record does not block the next reset as a package no row names.
 * `removeClearedDevelopmentPackages` runs after the database was replaced and removes ONLY:
 *   (6) directories this guard cleared in this run (`developmentPackagesOnDisk`) - never one that
 *       blocked, never one the scan did not list, never a demo package;
 *   (7) that STILL verify, at the moment of removal, as the signed development package of the
 *       erased item (rule (5) asked again with the anchors read at R-3): a folder that was
 *       replaced in between is left and blocks the next reset;
 *   (8) below the configured store root, by the containment rule of `package-removal.ts` (one
 *       `SESSION-*` path segment, a real directory, resolved inside the root).
 * A folder that is not removed is reported and left: it blocks the next reset (fail-safe).
 *
 * WHAT A MESSAGE MAY HOLD: the database name, the store root, counts, and at most a few session
 * identifiers. Session identifiers are what the audit chain already names; no value of a kept
 * table, no credential, and nothing from a manifest beyond its integrity state reaches a message.
 */
import type { QueryResultRow } from 'pg';
import { join } from 'node:path';
import { readSealedSourceMark, type SealedSourceMark, type SealedSourceMarkAnchors } from '../../evidence-verify';
import { evidenceStoreRoot, readEvidenceStore, type EvidenceStoreScan } from '../commands/evidence-store';
import { ResetError } from './errors';
import { removePackageFolder, type PackageFolderRemover, type PackageRemovalRefusal } from './package-removal';

/** What a caller may send the guard's statement with: a pool or a client checked out of one. */
export interface RealEvidenceQueryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

/** The source rows a session holds, exactly (`dbc-4` MR-S1): one per slot. */
export const SOURCE_ROWS_PER_SESSION = 4;
/**
 * The adapter kinds that make a source a DEVELOPMENT source (`dbc-4` §N.2). The cross-check counts
 * these, never "everything that is not production": an unknown kind is not exempt.
 */
export const DEVELOPMENT_ADAPTER_KINDS = ['FAKE', 'LOCAL_DEVICE'] as const;

/**
 * The database side of the guard: every REAL item that was sealed (the shape `dbc-3` §E.2 fixes),
 * with the three facts the `dbc-4` exemption reads. `development_flag` is the SQL predicate
 * `development_sources IS TRUE` - false for `NULL` and for `false`. The session id is read because
 * the disk side names packages by it. One statement, so both the block and the exemption are
 * decided on one snapshot.
 */
export const REAL_SEALED_EVIDENCE_STATEMENT =
  "SELECT e.session_id::text AS session_id, e.id::text AS evidence_id, e.manifest_hash::text AS manifest_hash, e.integrity_source::text AS integrity_source, " +
  "(e.development_sources IS TRUE) AS development_flag, " +
  "(SELECT count(*)::int FROM public.session_capture_sources AS s WHERE s.session_id = e.session_id) AS source_rows, " +
  "(SELECT count(*)::int FROM public.session_capture_sources AS s WHERE s.session_id = e.session_id " +
  `AND s.adapter_kind IN (${DEVELOPMENT_ADAPTER_KINDS.map((kind) => `'${kind}'`).join(', ')})) AS development_rows ` +
  "FROM public.evidence_items AS e " +
  // REAL items, and (pass E3) the demo items a seed really sealed: version 2 with a signature that is not the stand-in.
  "WHERE (e.integrity_source = 'REAL' OR (e.integrity_source = 'DEMO_PACKAGE' AND e.manifest_version = 2 AND e.signature_simulated IS FALSE)) " +
  "AND e.sealed_at IS NOT NULL ORDER BY e.session_id";

/** `integrity_source` of a demo item: it never blocks on the database side. */
const DEMO_PACKAGE_SOURCE = 'DEMO_PACKAGE';

/** One row of `REAL_SEALED_EVIDENCE_STATEMENT`. A member that is missing reads as "not exempt". */
export interface RealSealedEvidenceRow {
  readonly session_id: string;
  /** The item and the digest recorded at its seal: the anchors of the disk side (D98(1)). */
  readonly evidence_id?: string | null;
  readonly manifest_hash?: string | null;
  /** `REAL`, or `DEMO_PACKAGE` for a seed-sealed demo item. A member that is missing reads as `REAL` (it blocks). */
  readonly integrity_source?: string | null;
  readonly development_flag?: boolean | null;
  readonly source_rows?: number | null;
  readonly development_rows?: number | null;
}

/** What the database side says, split by the exemption of `dbc-4` §N.10. */
export interface RealSealedRows {
  /** Sessions of the items that block: not flagged, or flagged without the proof. */
  readonly blocking: readonly string[];
  /** The subset of `blocking` that is flagged `development_sources` and fails the cross-check. */
  readonly unproven: readonly string[];
  /** Sessions of the exempt development packages: what a permitted reset erases. */
  readonly development: readonly string[];
  /** The exempt items with the anchors the disk side holds their package folder to (the seed-sealed demo items among them). */
  readonly developmentItems: readonly DevelopmentItem[];
  /** Sessions of the seed-sealed demo items that pass the same two rules: never blocking, never in `development`. */
  readonly seedSealedDemo: readonly string[];
}

/** One exempt item: its session, and what its signed manifest must say it is. */
export interface DevelopmentItem {
  readonly sessionId: string;
  readonly evidenceId: string | null;
  readonly manifestSha256: string | null;
}

/**
 * The exemption, pure. Exempt only when the flag is strictly `true` AND the session holds exactly
 * four source rows AND all four are development kinds; everything else blocks.
 */
export function classifyRealSealedRows(rows: readonly RealSealedEvidenceRow[]): RealSealedRows {
  const blocking: string[] = [];
  const unproven: string[] = [];
  const development: string[] = [];
  const developmentItems: DevelopmentItem[] = [];
  const seedSealedDemo: string[] = [];
  for (const row of rows) {
    const flagged = row.development_flag === true;
    const proven = row.source_rows === SOURCE_ROWS_PER_SESSION && row.development_rows === SOURCE_ROWS_PER_SESSION;
    // A demo row never blocks on this side (D-DB-04). It gives its folder an anchor only under the
    // SAME two rules as a development item; without them the folder stays unprovable and blocks.
    if (row.integrity_source === DEMO_PACKAGE_SOURCE) {
      if (flagged && proven) {
        seedSealedDemo.push(row.session_id);
        developmentItems.push(Object.freeze({ sessionId: row.session_id, evidenceId: row.evidence_id ?? null, manifestSha256: row.manifest_hash ?? null }));
      }
      continue;
    }
    if (flagged && proven) {
      development.push(row.session_id);
      developmentItems.push(Object.freeze({ sessionId: row.session_id, evidenceId: row.evidence_id ?? null, manifestSha256: row.manifest_hash ?? null }));
    } else {
      blocking.push(row.session_id);
      if (flagged) unproven.push(row.session_id);
    }
  }
  return Object.freeze({ blocking: Object.freeze(blocking), unproven: Object.freeze(unproven), development: Object.freeze(development), developmentItems: Object.freeze(developmentItems), seedSealedDemo: Object.freeze(seedSealedDemo) });
}

/** Reads the signed source mark of one package folder. Default: the verify unit's reader. */
export type SealedSourceMarkReader = (packageDir: string, anchors: SealedSourceMarkAnchors) => Promise<SealedSourceMark>;

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * The disk side of the exemption (D98(1)): the directories of the scan that would block and are
 * cleared by rules (4) and (5) of the header. A folder is asked only when exactly one exempt item
 * names its session, no blocking row does, and that item carries the digest of its seal; the
 * answer clears it only for `signed && development`. A reader that rejects clears nothing.
 */
export async function clearedDevelopmentPackages(
  storeRoot: string,
  scan: EvidenceStoreScan,
  split: Pick<RealSealedRows, 'blocking' | 'developmentItems'>,
  readMark: SealedSourceMarkReader,
): Promise<readonly string[]> {
  const cleared: string[] = [];
  for (const entry of scan.packages) {
    if (entry.integrity === 'DEMO' || entry.sessionId === '' || split.blocking.includes(entry.sessionId)) continue;
    const items = split.developmentItems.filter((item) => item.sessionId === entry.sessionId);
    const item = items[0];
    if (items.length !== 1 || item === undefined || item.evidenceId === null || item.manifestSha256 === null || !HEX64.test(item.manifestSha256)) continue;
    let mark: SealedSourceMark;
    try {
      mark = await readMark(join(storeRoot, entry.directory), { sessionId: item.sessionId, evidenceId: item.evidenceId, manifestSha256: item.manifestSha256 });
    } catch {
      continue;
    }
    if (mark.signed === true && mark.development === true) cleared.push(entry.directory);
  }
  return Object.freeze(cleared);
}

/** How many identifiers a refusal names before it counts the rest. */
export const MAX_NAMED_SESSIONS = 5;

export interface RealEvidenceFacts {
  readonly database: string;
  readonly storeRoot: string;
  /** False when the store root does not exist at all. */
  readonly storePresent: boolean;
  /** Sessions of the REAL sealed rows of `evidence_items` that BLOCK, in id order (exempt ones are not here). */
  readonly dbSessions: readonly string[];
  /** The blocking sessions that claim `development_sources` and fail the cross-check (SEC35-42 (2)). */
  readonly developmentUnproven: readonly string[];
  /** Sessions of the exempt development packages: what a permitted reset erases (SEC35-42 (3)). */
  readonly developmentSessions: readonly string[];
  /** Sessions of the seed-sealed demo items (pass E3): their rows never block; their folders are among `developmentPackagesOnDisk` when cleared. */
  readonly seedSealedDemoSessions: readonly string[];
  /** Package directories cleared by their signed development mark (D98(1)): they do not block and are in none of the lists below. */
  readonly developmentPackagesOnDisk: readonly string[];
  /** The exempt items with the anchors of their signed manifest: what a removal is held to again (D133 (2)). */
  readonly developmentItems: readonly DevelopmentItem[];
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
  /** Another reader of a folder's signed source mark, for tests. Default: `readSealedSourceMark` of the verify unit. */
  readonly readSourceMark?: SealedSourceMarkReader | undefined;
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
  exemption: {
    readonly unproven?: readonly string[];
    readonly development?: readonly string[];
    readonly clearedOnDisk?: readonly string[];
    readonly developmentItems?: readonly DevelopmentItem[];
    readonly seedSealedDemo?: readonly string[];
  } = {},
): RealEvidenceFacts {
  const sorted = [...dbSessions].sort();
  // Only what `clearedDevelopmentPackages` cleared is left out; without it every package counts.
  const cleared = exemption.clearedOnDisk ?? [];
  const counted = scan.packages.filter((entry) => !cleared.includes(entry.directory));
  const real = counted.filter((entry) => entry.integrity === 'REAL').map((entry) => entry.sessionId);
  const unprovable = counted.filter((entry) => entry.integrity === 'UNKNOWN').map((entry) => entry.directory);
  const facts: RealEvidenceFacts = Object.freeze({
    database,
    storeRoot,
    storePresent: scan.present,
    dbSessions: Object.freeze(sorted),
    developmentUnproven: Object.freeze([...(exemption.unproven ?? [])].sort()),
    developmentSessions: Object.freeze([...(exemption.development ?? [])].sort()),
    seedSealedDemoSessions: Object.freeze([...(exemption.seedSealedDemo ?? [])].sort()),
    developmentPackagesOnDisk: Object.freeze([...cleared].sort()),
    developmentItems: Object.freeze([...(exemption.developmentItems ?? [])]),
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
    `${facts.database}: ${String(facts.dbSessions.length)} REAL sealed item(s)` +
      (facts.developmentUnproven.length === 0
        ? ''
        : `, ${String(facts.developmentUnproven.length)} of them flagged as development sources without four development source rows`),
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
    developmentUnproven: facts.developmentUnproven.length,
    developmentPackages: facts.developmentSessions.length,
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
  const { rows } = await client.query<RealSealedEvidenceRow>(REAL_SEALED_EVIDENCE_STATEMENT);
  const split = classifyRealSealedRows(rows);
  const scan = (options.readStore ?? readEvidenceStore)(storeRoot);
  const clearedOnDisk = await clearedDevelopmentPackages(storeRoot, scan, split, options.readSourceMark ?? readSealedSourceMark);
  return evaluateRealEvidence(options.database, storeRoot, split.blocking, scan, { unproven: split.unproven, development: split.development, clearedOnDisk, developmentItems: split.developmentItems, seedSealedDemo: split.seedSealedDemo });
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

/**
 * The sentence a permitted reset states before it erases development packages (SEC35-42 (3)):
 * the count, and at most a few session identifiers. Empty when there is none.
 */
export function developmentPackagesMessage(facts: RealEvidenceFacts): string {
  const count = facts.developmentSessions.length;
  const demo = facts.seedSealedDemoSessions.length;
  const onDisk = facts.developmentPackagesOnDisk.length;
  // The seed-sealed demo packages (pass E3): removed with the database they belong to, and sealed again by a reseed for a development-capture Core.
  const demoSentence =
    demo === 0
      ? ''
      : `this reset replaces ${String(demo)} seed-sealed demo package record(s) of ${facts.database} (${named(facts.seedSealedDemoSessions)}): generated sources, development key, not evidence; their folders are removed once the database has been replaced.`;
  if (count === 0) return demoSentence;
  return (
    (demoSentence === '' ? '' : `${demoSentence} `) +
    `this reset erases ${String(count)} development-source package record(s) of ${facts.database} (${named(facts.developmentSessions)}): sealed from development sources only, exempt from the real-evidence guard (dbc-4 §N.10).` +
    (onDisk === 0 ? '' : ` ${String(onDisk)} package folder(s) on disk carry the signed development mark of such a record and did not block (D98(1)); the reset removes these folders once the database has been replaced (D133 (2)).`)
  );
}

/** Why a cleared folder was left in place: the removal's own refusal, or the second judgement. */
export type PackageKeptReason = PackageRemovalRefusal | 'NOT_CLEARED_AT_REMOVAL';

export interface DevelopmentPackageRemoval {
  /** Directory names that were removed, in name order. */
  readonly removed: readonly string[];
  /** Directory names that were cleared at R-3 and left in place, each with its reason. They block the next reset. */
  readonly kept: readonly { readonly directory: string; readonly reason: PackageKeptReason }[];
}

export interface DevelopmentPackageRemovalOptions {
  /** Another reader of the store, for tests. */
  readonly readStore?: ((root: string) => EvidenceStoreScan) | undefined;
  /** Another reader of a folder's signed source mark, for tests. */
  readonly readSourceMark?: SealedSourceMarkReader | undefined;
  /** Another remover, for tests. Default: `removePackageFolder` (the containment rule). */
  readonly remove?: PackageFolderRemover | undefined;
}

/**
 * Removes the package folders a PERMITTED reset cleared (rules (6) to (8) of the header). Called
 * by the routine after the database was replaced; `facts` are the facts its own guard read at R-3.
 * A blocked run removes nothing. Never throws: a folder that is not removed is in `kept`.
 */
export async function removeClearedDevelopmentPackages(facts: RealEvidenceFacts, options: DevelopmentPackageRemovalOptions = {}): Promise<DevelopmentPackageRemoval> {
  if (facts.blocked || facts.developmentPackagesOnDisk.length === 0) return Object.freeze({ removed: Object.freeze([]), kept: Object.freeze([]) });
  // Rule (7): the same judgement again, on the disk as it is NOW, with the anchors read at R-3.
  let still: readonly string[];
  try {
    const scan = (options.readStore ?? readEvidenceStore)(facts.storeRoot);
    still = await clearedDevelopmentPackages(facts.storeRoot, scan, { blocking: facts.dbSessions, developmentItems: facts.developmentItems }, options.readSourceMark ?? readSealedSourceMark);
  } catch {
    still = [];
  }
  const remove = options.remove ?? removePackageFolder;
  const removed: string[] = [];
  const kept: { directory: string; reason: PackageKeptReason }[] = [];
  for (const directory of facts.developmentPackagesOnDisk) {
    if (!still.includes(directory)) {
      kept.push(Object.freeze({ directory, reason: 'NOT_CLEARED_AT_REMOVAL' as const }));
      continue;
    }
    const outcome = remove(facts.storeRoot, directory);
    if (outcome.removed) removed.push(directory);
    else kept.push(Object.freeze({ directory, reason: outcome.refusal }));
  }
  return Object.freeze({ removed: Object.freeze(removed), kept: Object.freeze(kept) });
}
