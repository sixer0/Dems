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
 *   (2) the cross-check: the item's session holds EXACTLY six `session_capture_sources` rows and (D60, 2026-11-04; was four)
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
 * A RECORDING THAT IS NOT SEALED YET IS EVIDENCE TOO (fix pass F-M7, review row 88 R88-09; decision
 * D178). Such a session has no item row, so the three rules below are added, each fail-safe:
 *   (9)  a store root - or its quarantine folder - that is there and cannot be LISTED refuses the
 *        reset (`RESET_STORE_UNREADABLE` in the message, with the cause). Only a root that does not
 *        exist is "no store";
 *   (10) the database side also names every session that recorded from a production-class source
 *        (a `session_capture_sources` row whose kind is NOT a development kind - an unknown kind
 *        counts as production) and is neither sealed (no sealed item) nor terminally closed (no
 *        `session_history` entry). It blocks, is never exempt, and is counted apart
 *        (`unsealedSessions`). Its recording folder on disk blocks by the standing rule: a
 *        `SESSION-*` folder without a readable manifest is UNKNOWN;
 *   (11) every folder in `<store root>/.quarantine/` blocks (`quarantinedSessions`): recordings the
 *        Core could not seal and moved there (`sealing`, D178) are real evidence without a package.
 *
 * UNSEALED RECORDINGS OF GENERATED SOURCES, ON AN EXPLICIT WORD ONLY (fix wave I driver A1; re-gate
 * 75 finding G75b-01; ruling D216). A development lane whose seal failed kept the recording folder
 * of its session - a folder without a manifest, UNKNOWN to rule (5), blocking every reset: the lane
 * could never be reset again by the project's own tool. The same holds for the folder the terminal
 * UNSEALABLE outcome moves to the quarantine (rule (11)). Such a folder holds test pictures of the
 * FAKE (generated) sources and nothing else, and there is no signed manifest that could prove it.
 * So the proof is the DATABASE's, and the exemption is narrower than every other one:
 *   (12) the session holds EXACTLY six `session_capture_sources` rows (D60) and EVERY one is of kind
 *        `FAKE` - generated sources only. A `LOCAL_DEVICE` row (this computer's camera or
 *        microphone: a recording of a person) is NOT exempt, and no production kind ever is;
 *   (13) the session has NO sealed item (a sealed one is judged by rules (1) to (5));
 *   (14) on disk it is the folder `SESSION-<sessionId>` that holds NO manifest file of either
 *        version, or the folder `.quarantine/<sessionId>`. A folder with a manifest is a package
 *        and stays under rule (5);
 *   (15) THE CALLER ASKED FOR IT, by name (`discardUnsealedFake`: `db:reset
 *        --discard-unsealed-fake-recordings`, `scripts/lane/lane.sh reset <lane>
 *        --discard-unsealed-fake-recordings`). Without that word such a folder BLOCKS as before;
 *        the refusal then names the option and how many folders it would clear. The server's own
 *        reset (operation 75, `loadScenario`) never passes it.
 * None of the facts of (12) and (13) is writable by the runtime role (`session_capture_sources` is
 * INSERT-only, `adapter_kind` has no UPDATE grant). A permitted reset states the count
 * (`unsealedFakeMessage`) and removes these folders after the database was replaced
 * (`removeUnsealedFakeRecordings`: judged again at the moment of removal, containment rule of
 * `package-removal.ts`). A production Core records from no FAKE source (the capture fence refuses
 * one), so nothing of this applies to it: its unsealed recordings block by rules (10) and (11).
 *
 * WHAT A MESSAGE MAY HOLD: the database name, the store root, counts, and at most a few session
 * identifiers. Session identifiers are what the audit chain already names; no value of a kept
 * table, no credential, and nothing from a manifest beyond its integrity state reaches a message.
 */
import type { QueryResultRow } from 'pg';
import { join } from 'node:path';
import { readSealedSourceMark, type SealedSourceMark, type SealedSourceMarkAnchors } from '../../evidence-verify';
import { PACKAGE_DIRECTORY_PREFIX, STORE_QUARANTINE_DIRECTORY, evidenceStoreRoot, readEvidenceStore, type EvidenceStoreScan } from '../commands/evidence-store';
import { ResetError } from './errors';
import { removePackageFolder, removeQuarantineFolder, type PackageFolderRemover, type PackageRemoval, type PackageRemovalRefusal } from './package-removal';

/** What a caller may send the guard's statement with: a pool or a client checked out of one. */
export interface RealEvidenceQueryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

/** The source rows a session holds, exactly (`dbc-4` MR-S1): one per slot. D60: six slots; D61 (2026-11-04): the selector has EIGHT slots - four video tracks and four numbered microphone channels - so a session holds eight. */
export const SOURCE_ROWS_PER_SESSION = 8;
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
const DEVELOPMENT_KIND_LIST = DEVELOPMENT_ADAPTER_KINDS.map((kind) => `'${kind}'`).join(', ');
/** `integrity_source` of the rows of rule (10): a session that recorded from a production source and is not sealed. No item has it. */
export const UNSEALED_RECORDING_SOURCE = 'UNSEALED_RECORDING';
/** `integrity_source` of the rows of rules (12) + (13): a session of FOUR generated (FAKE) sources that has no sealed item. No item has it; such a row never blocks. */
export const UNSEALED_FAKE_SOURCE = 'UNSEALED_FAKE_RECORDING';
/** The ONE adapter kind of rule (12): generated sources. Never `LOCAL_DEVICE`. */
export const GENERATED_ADAPTER_KIND = 'FAKE';
export const REAL_SEALED_EVIDENCE_STATEMENT =
  "SELECT e.session_id::text AS session_id, e.id::text AS evidence_id, e.manifest_hash::text AS manifest_hash, e.integrity_source::text AS integrity_source, " +
  "(e.development_sources IS TRUE) AS development_flag, " +
  "(SELECT count(*)::int FROM public.session_capture_sources AS s WHERE s.session_id = e.session_id) AS source_rows, " +
  "(SELECT count(*)::int FROM public.session_capture_sources AS s WHERE s.session_id = e.session_id " +
  `AND s.adapter_kind IN (${DEVELOPMENT_KIND_LIST})) AS development_rows ` +
  "FROM public.evidence_items AS e " +
  // REAL items, and (pass E3) the demo items a seed really sealed: version 2 with a signature that is not the stand-in.
  "WHERE (e.integrity_source = 'REAL' OR (e.integrity_source = 'DEMO_PACKAGE' AND e.manifest_version = 2 AND e.signature_simulated IS FALSE)) " +
  "AND e.sealed_at IS NOT NULL " +
  // Rule (10) (F-M7 R88-09), in the SAME statement and so on the same snapshot: sessions that recorded
  // from a production-class source and have neither a sealed item nor a history entry.
  "UNION ALL " +
  `SELECT c.session_id::text, NULL::text, NULL::text, '${UNSEALED_RECORDING_SOURCE}'::text, false, count(*)::int, ` +
  `(count(*) FILTER (WHERE c.adapter_kind IN (${DEVELOPMENT_KIND_LIST})))::int ` +
  "FROM public.session_capture_sources AS c " +
  "WHERE NOT EXISTS (SELECT 1 FROM public.evidence_items AS i WHERE i.session_id = c.session_id AND i.sealed_at IS NOT NULL) " +
  "AND NOT EXISTS (SELECT 1 FROM public.session_history AS h WHERE h.id = c.session_id) " +
  "GROUP BY c.session_id " +
  `HAVING count(*) FILTER (WHERE c.adapter_kind NOT IN (${DEVELOPMENT_KIND_LIST})) > 0 ` +
  // Rules (12) + (13) (fix wave I, G75b-01), on the same snapshot: sessions of exactly four source rows, all of them
  // generated (FAKE), without a sealed item. They never block; they are what the explicit option may clear on disk.
  "UNION ALL " +
  `SELECT f.session_id::text, NULL::text, NULL::text, '${UNSEALED_FAKE_SOURCE}'::text, false, count(*)::int, ` +
  `(count(*) FILTER (WHERE f.adapter_kind = '${GENERATED_ADAPTER_KIND}'))::int ` +
  "FROM public.session_capture_sources AS f " +
  "WHERE NOT EXISTS (SELECT 1 FROM public.evidence_items AS j WHERE j.session_id = f.session_id AND j.sealed_at IS NOT NULL) " +
  "GROUP BY f.session_id " +
  `HAVING count(*) = ${String(SOURCE_ROWS_PER_SESSION)} AND count(*) FILTER (WHERE f.adapter_kind = '${GENERATED_ADAPTER_KIND}') = ${String(SOURCE_ROWS_PER_SESSION)} ` +
  "ORDER BY session_id";

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
  /** The subset of `blocking` that recorded from a production source and is not sealed (rule (10)). */
  readonly unsealed: readonly string[];
  /** Sessions of four generated (FAKE) sources without a sealed item (rules (12) + (13)): never blocking; absent on a split a test built by hand. */
  readonly unsealedFake?: readonly string[];
}

/** One exempt item: its session, and what its signed manifest must say it is. */
export interface DevelopmentItem {
  readonly sessionId: string;
  readonly evidenceId: string | null;
  readonly manifestSha256: string | null;
}

/**
 * The exemption, pure. Exempt only when the flag is strictly `true` AND the session holds exactly
 * six source rows AND all six are development kinds (D60); everything else blocks.
 */
export function classifyRealSealedRows(rows: readonly RealSealedEvidenceRow[]): RealSealedRows {
  const blocking: string[] = [];
  const unproven: string[] = [];
  const development: string[] = [];
  const developmentItems: DevelopmentItem[] = [];
  const seedSealedDemo: string[] = [];
  const unsealed: string[] = [];
  const unsealedFake: string[] = [];
  for (const row of rows) {
    // Rules (12) + (13): proven again here, on the counts of the row - exactly six rows (D60), all generated. Never blocking.
    if (row.integrity_source === UNSEALED_FAKE_SOURCE) {
      if (row.source_rows === SOURCE_ROWS_PER_SESSION && row.development_rows === SOURCE_ROWS_PER_SESSION) unsealedFake.push(row.session_id);
      continue;
    }
    // Rule (10): an unsealed real recording blocks, whatever else the row carries. Never exempt.
    if (row.integrity_source === UNSEALED_RECORDING_SOURCE) {
      blocking.push(row.session_id);
      unsealed.push(row.session_id);
      continue;
    }
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
  return Object.freeze({ blocking: Object.freeze(blocking), unproven: Object.freeze(unproven), development: Object.freeze(development), developmentItems: Object.freeze(developmentItems), seedSealedDemo: Object.freeze(seedSealedDemo), unsealed: Object.freeze(unsealed), unsealedFake: Object.freeze(unsealedFake) });
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
  /** The cause when the store root or its quarantine folder is there and could not be listed (rule (9)); null otherwise. It blocks. */
  readonly storeUnreadable: string | null;
  /** The blocking sessions that recorded from a production source and are not sealed (rule (10)). */
  readonly unsealedSessions: readonly string[];
  /** The names in the quarantine folder of the store (rule (11)). Each blocks. */
  readonly quarantinedSessions: readonly string[];
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
  /**
   * Rules (12) to (15): the unsealed recordings of generated (FAKE) sources this reset CLEARED on the
   * caller's explicit word - package-folder names (`SESSION-<id>`) and quarantine names (`<id>`).
   * They do not block and are in none of the lists above; the reset removes them after the swap.
   */
  readonly unsealedFakeFolders?: readonly string[];
  readonly unsealedFakeQuarantined?: readonly string[];
  /** The same folders when the caller did NOT ask (rule (15)): they BLOCK, and the refusal names the option. Count only. */
  readonly unsealedFakeOffered?: number;
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
  /** Rule (15): the caller's explicit word that unsealed recordings of generated (FAKE) sources may be erased. Default: false - they block. */
  readonly discardUnsealedFake?: boolean | undefined;
}

/** The option that says rule (15), as the command line and the lane tool spell it. */
export const DISCARD_UNSEALED_FAKE_OPTION = '--discard-unsealed-fake-recordings';

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
    readonly unsealed?: readonly string[];
    /** Rules (12) + (13): the sessions the database proved. */
    readonly unsealedFake?: readonly string[];
    /** Rule (15). */
    readonly discardUnsealedFake?: boolean;
  } = {},
): RealEvidenceFacts {
  const sorted = [...dbSessions].sort();
  // Only what `clearedDevelopmentPackages` cleared is left out; without it every package counts.
  const cleared = exemption.clearedOnDisk ?? [];
  // Rules (12) to (14): a folder WITHOUT a manifest file, named after a session the database proved to be of four generated sources
  // and which no blocking row names; a quarantine folder of such a session. Cleared only on the caller's word (rule (15)).
  const proven = new Set((exemption.unsealedFake ?? []).filter((sessionId) => !dbSessions.includes(sessionId)));
  const fakeFolders = scan.packages.filter((entry) => !cleared.includes(entry.directory) && entry.integrity === 'UNKNOWN' && entry.manifest === 'NONE' && entry.sessionId !== '' && entry.directory === `${PACKAGE_DIRECTORY_PREFIX}${entry.sessionId}` && proven.has(entry.sessionId)).map((entry) => entry.directory);
  const fakeQuarantined = (scan.quarantined ?? []).filter((name) => proven.has(name));
  const discard = exemption.discardUnsealedFake === true;
  const counted = scan.packages.filter((entry) => !cleared.includes(entry.directory) && !(discard && fakeFolders.includes(entry.directory)));
  const real = counted.filter((entry) => entry.integrity === 'REAL').map((entry) => entry.sessionId);
  const unprovable = counted.filter((entry) => entry.integrity === 'UNKNOWN').map((entry) => entry.directory);
  const facts: RealEvidenceFacts = Object.freeze({
    database,
    storeRoot,
    storePresent: scan.present,
    storeUnreadable: scan.unreadable ?? null,
    unsealedSessions: Object.freeze([...(exemption.unsealed ?? [])].sort()),
    quarantinedSessions: Object.freeze((scan.quarantined ?? []).filter((name) => !(discard && fakeQuarantined.includes(name)))),
    unsealedFakeFolders: Object.freeze(discard ? [...fakeFolders].sort() : []),
    unsealedFakeQuarantined: Object.freeze(discard ? [...fakeQuarantined].sort() : []),
    unsealedFakeOffered: discard ? 0 : fakeFolders.length + fakeQuarantined.length,
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
  return Object.freeze({ ...facts, blocked: sorted.length > 0 || real.length > 0 || unprovable.length > 0 || facts.storeUnreadable !== null || facts.quarantinedSessions.length > 0 });
}

/** One sentence for a log line and for the `ResetError`: counts, then the identifiers it names. */
export function realEvidenceMessage(facts: RealEvidenceFacts): string {
  const sides = [
    `${facts.database}: ${String(facts.dbSessions.length - facts.unsealedSessions.length)} REAL sealed item(s)` +
      (facts.unsealedSessions.length === 0 ? '' : `, ${String(facts.unsealedSessions.length)} session(s) that recorded from a production source and are not sealed (${named(facts.unsealedSessions)})`) +
      (facts.developmentUnproven.length === 0
        ? ''
        : `, ${String(facts.developmentUnproven.length)} of them flagged as development sources without eight development source rows`),
    `evidence store ${facts.storeRoot} ${facts.storePresent ? 'holds' : 'does not exist;'} ${String(facts.diskSessions.length)} REAL package(s)` +
      (facts.unprovablePackages.length === 0 ? '' : ` and ${String(facts.unprovablePackages.length)} unreadable package director(y/ies) [${named(facts.unprovablePackages)}]`) +
      (facts.quarantinedSessions.length === 0 ? '' : ` and ${String(facts.quarantinedSessions.length)} quarantined recording folder(s) [${named(facts.quarantinedSessions)}]`) +
      // Rule (9): an unlistable store is never an empty one.
      (facts.storeUnreadable === null ? '' : `; the store could not be listed (RESET_STORE_UNREADABLE, ${facts.storeUnreadable}): what it holds is unknown, so nothing may be reset`),
  ];
  const halves = [
    facts.missingOnDisk.length === 0 ? '' : `in the database without a package: ${named(facts.missingOnDisk)}`,
    facts.missingInDatabase.length === 0 ? '' : `on disk without a database row: ${named(facts.missingInDatabase)}`,
  ].filter((part) => part !== '');
  return (
    `refused: real sealed evidence exists and a reset would destroy it (RESET_BLOCKED_REAL_EVIDENCE). ` +
    `${sides.join('; ')}. ${halves.join('; ')}${halves.length > 0 ? '. ' : ''}` +
    // Rule (15): the way out a development lane has, said where the refusal is read.
    ((facts.unsealedFakeOffered ?? 0) === 0
      ? ''
      : `${String(facts.unsealedFakeOffered)} of the folders named above are unsealed recordings of generated (FAKE) sources only, by the source rows of their sessions: a reset erases them when it is asked to by name (${DISCARD_UNSEALED_FAKE_OPTION}). `) +
    `Nothing was changed.`
  );
}

/** The details of the log line that records a refusal (DC-7 shape: counts and names only). */
export function realEvidenceDetails(facts: RealEvidenceFacts): Record<string, string | number | boolean> {
  return {
    database: facts.database,
    storeRoot: facts.storeRoot,
    storePresent: facts.storePresent,
    realRows: facts.dbSessions.length - facts.unsealedSessions.length,
    unsealedSessions: facts.unsealedSessions.length,
    quarantinedFolders: facts.quarantinedSessions.length,
    ...(facts.storeUnreadable === null ? {} : { storeUnreadable: facts.storeUnreadable }),
    developmentUnproven: facts.developmentUnproven.length,
    developmentPackages: facts.developmentSessions.length,
    realPackages: facts.diskSessions.length,
    unreadablePackages: facts.unprovablePackages.length,
    // Rules (12) to (15): said only when there is such a folder.
    ...((facts.unsealedFakeFolders?.length ?? 0) + (facts.unsealedFakeQuarantined?.length ?? 0) === 0 ? {} : { unsealedFakeCleared: (facts.unsealedFakeFolders?.length ?? 0) + (facts.unsealedFakeQuarantined?.length ?? 0) }),
    ...((facts.unsealedFakeOffered ?? 0) === 0 ? {} : { unsealedFakeOffered: facts.unsealedFakeOffered ?? 0 }),
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
  return evaluateRealEvidence(options.database, storeRoot, split.blocking, scan, {
    unproven: split.unproven,
    development: split.development,
    clearedOnDisk,
    developmentItems: split.developmentItems,
    seedSealedDemo: split.seedSealedDemo,
    unsealed: split.unsealed,
    unsealedFake: split.unsealedFake ?? [],
    discardUnsealedFake: options.discardUnsealedFake === true,
  });
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

/** The sentence a permitted reset states before it erases unsealed recordings of generated sources (rule (15)). Empty when there is none. */
export function unsealedFakeMessage(facts: RealEvidenceFacts): string {
  const folders = facts.unsealedFakeFolders ?? [];
  const quarantined = facts.unsealedFakeQuarantined ?? [];
  if (folders.length + quarantined.length === 0) return '';
  return (
    `this reset erases ${String(folders.length + quarantined.length)} unsealed recording folder(s) of ${facts.database} that were recorded from generated (FAKE) sources only and were never sealed` +
    `${folders.length === 0 ? '' : ` [${named(folders)}]`}${quarantined.length === 0 ? '' : ` [quarantine: ${named(quarantined)}]`}: asked for by name (${DISCARD_UNSEALED_FAKE_OPTION}); the folders are removed once the database has been replaced.`
  );
}

export interface UnsealedFakeRemoval {
  /** What was removed: package-folder names and `.quarantine/<id>` names. */
  readonly removed: readonly string[];
  /** What was cleared at R-3 and left in place, each with its reason. It blocks the next reset. */
  readonly kept: readonly { readonly directory: string; readonly reason: PackageKeptReason }[];
}

export interface UnsealedFakeRemovalOptions {
  readonly readStore?: ((root: string) => EvidenceStoreScan) | undefined;
  readonly remove?: PackageFolderRemover | undefined;
  readonly removeQuarantined?: ((storeRoot: string, sessionId: string) => PackageRemoval) | undefined;
}

/**
 * Removes the unsealed recording folders of generated sources a PERMITTED reset cleared (rules (12)
 * to (15)). Called by the routine after the database was replaced. Each folder is judged AGAIN on
 * the disk as it is now: a `SESSION-<id>` folder that holds a manifest file by then, or is gone
 * from the listing, is left (`NOT_CLEARED_AT_REMOVAL`). Never throws.
 */
export function removeUnsealedFakeRecordings(facts: RealEvidenceFacts, options: UnsealedFakeRemovalOptions = {}): UnsealedFakeRemoval {
  const folders = facts.unsealedFakeFolders ?? [];
  const quarantined = facts.unsealedFakeQuarantined ?? [];
  if (facts.blocked || folders.length + quarantined.length === 0) return Object.freeze({ removed: Object.freeze([]), kept: Object.freeze([]) });
  let scan: EvidenceStoreScan | null;
  try {
    scan = (options.readStore ?? readEvidenceStore)(facts.storeRoot);
  } catch {
    scan = null;
  }
  const remove = options.remove ?? removePackageFolder;
  const removeQuarantined = options.removeQuarantined ?? ((storeRoot: string, sessionId: string) => removeQuarantineFolder(storeRoot, STORE_QUARANTINE_DIRECTORY, sessionId));
  const removed: string[] = [];
  const kept: { directory: string; reason: PackageKeptReason }[] = [];
  for (const directory of folders) {
    const entry = scan?.packages.find((found) => found.directory === directory);
    if (entry === undefined || entry.integrity !== 'UNKNOWN' || entry.manifest !== 'NONE') {
      kept.push(Object.freeze({ directory, reason: 'NOT_CLEARED_AT_REMOVAL' as const }));
      continue;
    }
    const outcome = remove(facts.storeRoot, directory);
    if (outcome.removed) removed.push(directory);
    else kept.push(Object.freeze({ directory, reason: outcome.refusal }));
  }
  for (const sessionId of quarantined) {
    const name = `${STORE_QUARANTINE_DIRECTORY}/${sessionId}`;
    if (scan === null || !(scan.quarantined ?? []).includes(sessionId)) {
      kept.push(Object.freeze({ directory: name, reason: 'NOT_CLEARED_AT_REMOVAL' as const }));
      continue;
    }
    const outcome = removeQuarantined(facts.storeRoot, sessionId);
    if (outcome.removed) removed.push(name);
    else kept.push(Object.freeze({ directory: name, reason: outcome.refusal }));
  }
  return Object.freeze({ removed: Object.freeze(removed), kept: Object.freeze(kept) });
}
