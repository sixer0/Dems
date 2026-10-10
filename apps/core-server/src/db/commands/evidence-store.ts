/**
 * The evidence store as it stands on disk (blueprint row 54 / CS-21; `dbc-3` §E.2; the media root
 * is fixed by `cap` §H and `06_evidence_package_spec.md` §A.1).
 *
 * The demo reset must refuse while a REAL sealed package exists, and a database row alone does not
 * prove that: the guard reads BOTH sides and blocks when they disagree (`dbc-3` §E.2, RK-16). This
 * file answers only the disk side — what package directories the store holds and what each
 * manifest says about its integrity. It opens no connection and knows nothing about a reset: the
 * reset folder may read no file of its own (its static guard), so the reader lives here, next to
 * the other file readers of the database commands.
 *
 * WHAT COUNTS AS A PACKAGE. Below the store root, a directory named `SESSION-<sessionId>`: the v2
 * folder name of a sealed package (`ev` §A.1). A live session directory (the media root of
 * `cap` §H, named after the session alone) is not a package and is not read here.
 *
 * FAIL-SAFE. A package whose manifest is missing, unreadable, or carries no integrity value the
 * contract knows is reported as UNKNOWN, which the guard treats as evidence it cannot clear: an
 * unprovable package blocks the reset exactly as a REAL one does. A store root that does not
 * exist (`ENOENT`, and only that) holds zero packages — that is the state before the capture store
 * lands (CS-02/CS-09), and it says nothing about the database side, which is asked separately.
 *
 * A ROOT THAT CANNOT BE LISTED IS NOT AN EMPTY STORE (fix pass F-M7, review row 88 R88-09; decision
 * D178). Not mounted, no permission, an I/O error, a name that is no directory: the scan says
 * `unreadable` with the cause, and the guard REFUSES the reset - a recording that is not sealed
 * yet has no item row, so the disk is the only witness of it.
 *
 * THE QUARANTINE (`<root>/.quarantine/<sessionId>/`, `sealing` D178): recordings the Core could
 * not seal, MOVED there. Every folder in it is listed (`quarantined`) and blocks a reset: it is
 * real evidence that has no package.
 *
 * A v2 FOLDER IS NEVER JUDGED BY A v1 FILE (R88-11): a folder that holds `session-manifest.json`
 * is a v2 package, whatever a `manifest.json` beside it says - UNKNOWN here, and cleared only by
 * its SIGNED manifest (the guard's rule (5)).
 *
 * NOTHING HERE IS LOGGED: a path and a session id are the most this file returns, and the caller
 * decides what it prints. No secret lives in a manifest, but the rule of NL-1 is that the guard
 * names counts and identifiers only.
 */
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ENV_MEDIA_DIR, MEDIA_STORE_SUBPATH, parseCapturePath } from '../../config';
import { DEFAULT_DATA_DIR } from '../../plugins/config';

/**
 * Where the sealed packages live below the data directory WHEN NO MEDIA ROOT IS CONFIGURED
 * (`cap` §H: `<dataDir>/media/sessions`). The configuration's own constant: one value, not a copy.
 */
export const EVIDENCE_STORE_SUBPATH = MEDIA_STORE_SUBPATH;
/** The prefix of a sealed-package directory (`ev` §A.1: `SESSION-<sessionId>`). */
export const PACKAGE_DIRECTORY_PREFIX = 'SESSION-';
/** The manifest file of a package, the only file this reader opens. */
export const PACKAGE_MANIFEST_FILE = 'manifest.json';
/** The manifest of a v2 package (`ev` §A.1): its presence makes the folder a v2 package. Never opened here. */
export const PACKAGE_V2_MANIFEST_FILE = 'session-manifest.json';
/** The quarantine folder below the store root (the sealing unit's `SEALING_QUARANTINE_DIR`; the reset folder imports no sealing code). */
export const STORE_QUARANTINE_DIRECTORY = '.quarantine';
/** The integrity values `evidence_items.integrity_source` admits (`dbc-3` C.6; D-DB-04). */
const DEMO_INTEGRITY_VALUES: readonly string[] = ['DEMO_PACKAGE', 'SIMULATED'];
const REAL_INTEGRITY_VALUE = 'REAL';

/** What one package directory claims about itself. */
export type PackageIntegrity = 'REAL' | 'DEMO' | 'UNKNOWN';

export interface EvidencePackageEntry {
  /** The session id the directory name carries; empty when the name does not hold one. */
  readonly sessionId: string;
  /** The directory name, so a caller can name what it found without a path. */
  readonly directory: string;
  readonly integrity: PackageIntegrity;
  /**
   * Which manifest FILE the folder holds, by name only (fix wave I driver A1; G75b-01): `V2`
   * (`session-manifest.json`), `V1` (`manifest.json`) or `NONE`. A folder with NONE is no package
   * yet: the recording of a session that is not sealed. Absent on a scan a test built by hand.
   */
  readonly manifest?: 'V2' | 'V1' | 'NONE';
}

export interface EvidenceStoreScan {
  /** The absolute store root that was read. */
  readonly root: string;
  /** False when the store root does not exist: no packages, nothing to disagree with. */
  readonly present: boolean;
  /** Every package directory found, in directory-name order. */
  readonly packages: readonly EvidencePackageEntry[];
  /**
   * The cause (an errno name, or `UNKNOWN`) when the root - or its quarantine folder - is there and
   * could NOT be listed; null when it was listed or does not exist. The guard refuses on it (R88-09).
   */
  readonly unreadable?: string | null;
  /** The names in `<root>/.quarantine/`, in name order: recordings the Core could not seal. Each blocks a reset. */
  readonly quarantined?: readonly string[];
}

/** The store root of one data directory: the evidence-store package directory of `dbc-3` §E.2. */
export function evidenceStoreRoot(dataDir: string = DEFAULT_DATA_DIR): string {
  return join(resolve(dataDir), EVIDENCE_STORE_SUBPATH);
}

/**
 * THE store root of a process that holds no configuration object - the command line (`db:reset`):
 * the rule of the configuration itself (`createConfig`, `config.ts`), from the same variable. An
 * installation whose media store is configured elsewhere (`DEMS_MEDIA_DIR`) keeps its sealed
 * packages THERE; a guard that looked below the data directory would find no package and let a
 * reset run beside real evidence (controller decision D165). A value that is not an absolute path
 * is refused as the configuration refuses it (`CAPTURE_PATH_NOT_ABSOLUTE`): never a silent default.
 *
 * The SERVER does not call this: it hands the root of its own configuration
 * (`app.config.mediaStoreDir`, what the sealing composition writes to) to the guard and the routine.
 */
export function evidenceStoreRootOf(dataDir: string | undefined, environment: Readonly<Record<string, string | undefined>>): string {
  return parseCapturePath(ENV_MEDIA_DIR, environment[ENV_MEDIA_DIR]) ?? evidenceStoreRoot(dataDir);
}

/** The session id a package directory names, or the empty string when its name holds none. */
export function sessionIdOfPackageDirectory(name: string): string {
  return name.startsWith(PACKAGE_DIRECTORY_PREFIX) ? name.slice(PACKAGE_DIRECTORY_PREFIX.length) : '';
}

function integrityOf(manifestText: string | undefined): PackageIntegrity {
  if (manifestText === undefined) return 'UNKNOWN';
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    return 'UNKNOWN';
  }
  const value = typeof parsed === 'object' && parsed !== null ? (parsed as { integrity?: unknown }).integrity : undefined;
  if (value === REAL_INTEGRITY_VALUE) return 'REAL';
  return typeof value === 'string' && DEMO_INTEGRITY_VALUES.includes(value) ? 'DEMO' : 'UNKNOWN';
}

function readManifest(directory: string): string | undefined {
  try {
    return readFileSync(join(directory, PACKAGE_MANIFEST_FILE), 'utf8');
  } catch {
    // Missing, unreadable, or not a file: the caller reports UNKNOWN and the guard blocks.
    return undefined;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function present(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    // Anything but "no such name" is held as present: the folder is then UNKNOWN and blocks (fail-safe).
    return (error as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

const errnoOf = (error: unknown): string => {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return typeof code === 'string' && /^E[A-Z0-9]+$/.test(code) ? code : 'UNKNOWN';
};

/**
 * Reads the store root: every `SESSION-*` directory and what its manifest says, and the names in
 * its quarantine folder. A root that does NOT EXIST yields `present: false` with no packages. A
 * root (or a quarantine folder) that is there and cannot be listed yields `unreadable` with the
 * cause: the guard refuses, it never reads that as an empty store (R88-09).
 */
export function readEvidenceStore(root: string = evidenceStoreRoot()): EvidenceStoreScan {
  let names: string[];
  try {
    names = readdirSync(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return Object.freeze({ root, present: false, packages: Object.freeze([]), unreadable: null, quarantined: Object.freeze([]) });
    return Object.freeze({ root, present: true, packages: Object.freeze([]), unreadable: errnoOf(error), quarantined: Object.freeze([]) });
  }
  let unreadable: string | null = null;
  let quarantined: string[] = [];
  try {
    quarantined = readdirSync(join(root, STORE_QUARANTINE_DIRECTORY)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') unreadable = errnoOf(error);
  }
  const packages = names
    .filter((name) => name.startsWith(PACKAGE_DIRECTORY_PREFIX))
    .filter((name) => isDirectory(join(root, name)))
    .sort()
    .map(
      (name): EvidencePackageEntry =>
        Object.freeze({
          sessionId: sessionIdOfPackageDirectory(name),
          directory: name,
          // A v2 folder is never read from a v1 file beside its manifest (R88-11).
          integrity: present(join(root, name, PACKAGE_V2_MANIFEST_FILE)) ? 'UNKNOWN' : integrityOf(readManifest(join(root, name))),
          manifest: present(join(root, name, PACKAGE_V2_MANIFEST_FILE)) ? 'V2' : present(join(root, name, PACKAGE_MANIFEST_FILE)) ? 'V1' : 'NONE',
        }),
    );
  return Object.freeze({ root, present: true, packages: Object.freeze(packages), unreadable, quarantined: Object.freeze(quarantined) });
}
