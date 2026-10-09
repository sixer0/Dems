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
 * exist holds zero packages — that is the state before the capture store lands (CS-02/CS-09), and
 * it says nothing about the database side, which is asked separately.
 *
 * NOTHING HERE IS LOGGED: a path and a session id are the most this file returns, and the caller
 * decides what it prints. No secret lives in a manifest, but the rule of NL-1 is that the guard
 * names counts and identifiers only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_DATA_DIR } from '../../plugins/config';

/** Where the sealed packages live below the data directory (`cap` §H: `<dataDir>/media/sessions`). */
export const EVIDENCE_STORE_SUBPATH = 'media/sessions';
/** The prefix of a sealed-package directory (`ev` §A.1: `SESSION-<sessionId>`). */
export const PACKAGE_DIRECTORY_PREFIX = 'SESSION-';
/** The manifest file of a package, the only file this reader opens. */
export const PACKAGE_MANIFEST_FILE = 'manifest.json';
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
}

export interface EvidenceStoreScan {
  /** The absolute store root that was read. */
  readonly root: string;
  /** False when the store root does not exist: no packages, nothing to disagree with. */
  readonly present: boolean;
  /** Every package directory found, in directory-name order. */
  readonly packages: readonly EvidencePackageEntry[];
}

/** The store root of one data directory: the evidence-store package directory of `dbc-3` §E.2. */
export function evidenceStoreRoot(dataDir: string = DEFAULT_DATA_DIR): string {
  return join(resolve(dataDir), EVIDENCE_STORE_SUBPATH);
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

/**
 * Reads the store root: every `SESSION-*` directory and what its manifest says. A root that is
 * missing or unreadable yields `present: false` with no packages; a root that cannot be listed
 * yields no packages either, and the guard's database side still has to agree with it.
 */
export function readEvidenceStore(root: string = evidenceStoreRoot()): EvidenceStoreScan {
  let names: string[];
  try {
    names = readdirSync(root);
  } catch {
    return Object.freeze({ root, present: false, packages: Object.freeze([]) });
  }
  const packages = names
    .filter((name) => name.startsWith(PACKAGE_DIRECTORY_PREFIX))
    .filter((name) => isDirectory(join(root, name)))
    .sort()
    .map(
      (name): EvidencePackageEntry =>
        Object.freeze({ sessionId: sessionIdOfPackageDirectory(name), directory: name, integrity: integrityOf(readManifest(join(root, name))) }),
    );
  return Object.freeze({ root, present: true, packages: Object.freeze(packages) });
}
