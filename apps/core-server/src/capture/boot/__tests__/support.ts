/**
 * Test support of the capture boot checks (blueprint row 61; not a test file, imports no Vitest).
 *
 * A REAL fixture for a real-mode boot, in TWO directories (task 4 row 228b; review 221 C-4, review 230 R-4):
 *
 *   `dataDir`      the Core's data directory: a media root and, when asked, a provisioned evidence signing
 *                  key. A TEMPORARY directory of the operating system's temporary root, mode 0700, made by
 *                  `mkdtemp`. NO KEY OF A TEST IS EVER WRITTEN BELOW THE REPOSITORY (a static test of
 *                  `reserved-ids.test.ts` holds that): a folder a killed run leaves is not a place a Core
 *                  is ever pointed at.
 *   `programsDir`  the STAND-IN programs: shell scripts that say one `HELLO` and exit when their input
 *                  ends. They record nothing, open no port and read no device. They lie below the
 *                  repository's git-ignored cache folder and NOT in the temporary root, because the
 *                  temporary root can be world-writable, which the path rule of a program refuses. No key,
 *                  no media and no log is written there.
 *
 * `remove()` removes both; the test calls it in its teardown (`afterAll`), which runs after a failed case
 * too. A fixture a test did not remove is removed when the test process ends.
 */
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { REPOSITORY } from '../../../../test/static/scan';
import { provisionSigningKey } from '../../signer';
import { CAPTURE_WORKER_VERSION, RELEASE_WORKER_VERSION, ReservedInstallationId, SIGNING_STORE_SUBPATH, type CaptureBootSinks } from '../checks';
import { SIGNING_KEY_UNIT_PREFIX } from '../index';

export const FIXTURE_NOW = 1_760_000_000_000;

/**
 * The installation device id of the test configuration (`test/support/config.ts`) and of the key the fixture
 * makes by default. It is a RESERVED id, taken from the one closed list by import (row 228b): a production
 * Core refuses it (boot check 4b-3), so the default key of this fixture never starts one. A test that boots
 * `REAL_PRODUCTION` states a synthetic id of its own - `realBootFixture(label, id)` and its configuration.
 */
export const FIXTURE_INSTALLATION_ID = ReservedInstallationId.TEST_CONFIGURATION;

/** The name every temporary data directory of the fixture starts with, below the temporary root. */
export const FIXTURE_DIRECTORY_PREFIX = 'dems-test-row61-';
/** Where the stand-in programs of the fixtures lie: below the repository's cache folder, one folder per fixture. */
export const FIXTURE_PROGRAMS_ROOT = resolve(REPOSITORY, '.cache', 'test-row61-programs');

export interface RealBootFixture {
  /** The Core's data directory: a temporary directory of the operating system, mode 0700. The key store lies here. */
  readonly dataDir: string;
  readonly mediaStoreDir: string;
  /**
   * The directory of the stand-in programs (the workers of `worker`, and what a test writes itself or hands to
   * `testHostPrograms`): a place that passes the path rule of a program on every host. Made at the first ask.
   */
  readonly programsDir: string;
  /** The installation id the key of `provisionKey()` names: the second argument of `realBootFixture`, by default the reserved test id. */
  readonly installationId: string;
  /**
   * Writes a stand-in worker THE CORE BOOTS WITH and returns its path. Since wave H driver F (gate
   * 64 C7) the boot takes ONE version, the one this Core was built to drive, so this stand-in says
   * `CAPTURE_WORKER_VERSION`. `workerVersion` is optional and - when it is a plain release word
   * (`capture-worker/<n>.<n>.<n>`) - NOT written: the callers of other units name the word of the
   * tree they were written in (`capture-worker/0.3.0`, `0.4.0`) and mean "a worker that boots". A
   * word that is no plain release word (a proof mark, another program) is written as given, and so
   * is another protocol version: those are refusals a test asks for. A test that wants a RELEASE
   * word of another version on the wire uses `workerSaying`.
   */
  worker(name: string, workerVersion?: string, protocolVersion?: number): string;
  /** Writes a stand-in worker that names EXACTLY `workerVersion` (any word), and returns its path. */
  workerSaying(name: string, workerVersion: string, protocolVersion?: number): string;
  /**
   * Creates the evidence signing key of the fixture (valid from `FIXTURE_NOW`). Since task 4 row 228 (boot check
   * 4b-2) its certificate names an installation, as a production key does: the unit is `Evidence signing <id>`,
   * by default the id of THIS fixture (`installationId`). Since row 228b the default of a fixture is the RESERVED
   * test id, which a production Core refuses (check 4b-3): a test that boots `REAL_PRODUCTION` makes its fixture
   * with a synthetic id of its own and configures its Core with the same one. Another id is a key of another
   * installation; `null` is a key with the store's default subject (no installation named) - both are refused
   * by a production boot. The key is written below `dataDir`, a temporary directory, and nowhere else.
   */
  provisionKey(installationId?: string | null): void;
  /** Removes both directories. Called by the test in its teardown; safe to call twice. */
  remove(): void;
}

let serial = 0;

/**
 * The removals of the fixtures that are still there: what the END OF THE TEST PROCESS runs for a fixture no teardown
 * removed (a file that failed while it was collected, a run that was interrupted). A test runner ends its worker
 * processes with a termination signal, on which the `exit` event is not raised (measured, row 228b): so the signals
 * are watched too, and after the removals the signal is raised again so that the process ends as it would have.
 * A process that is killed outright runs nothing; what it leaves is a temporary directory, never a folder of the
 * repository's data directory.
 */
const standing = new Set<() => void>();
let endWatched = false;
function removeStanding(): void {
  for (const pending of [...standing]) {
    try {
      pending();
    } catch {
      // The process is ending: one removal that fails does not stop the others.
    }
  }
}
function removeAtProcessEnd(remove: () => void): void {
  standing.add(remove);
  if (endWatched) return;
  endWatched = true;
  process.once('exit', removeStanding);
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    process.once(signal, () => {
      removeStanding();
      // Nobody else waits for this signal: end as the signal would have ended the process.
      if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
    });
  }
}

/** A shell script that says one `HELLO` and exits when its input ends. It takes any arguments and reads none. */
function standIn(directory: string, name: string, workerVersion: string, protocolVersion: number): string {
  const path = `${directory}/${name}`;
  const hello = JSON.stringify({ v: CAPTURE_PROTOCOL_VERSION, type: 'HELLO', protocolVersion, workerVersion });
  writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' '${hello}'\nexec /bin/cat > /dev/null\n`, { mode: 0o700 });
  chmodSync(path, 0o700);
  return path;
}

/**
 * A fixture of its own two directories. `installationId` is the id its key names (`provisionKey()`): by default
 * the reserved test id; a test that boots `REAL_PRODUCTION` states its own synthetic one here (row 228b).
 */
export function realBootFixture(label: string, installationId: string = FIXTURE_INSTALLATION_ID): RealBootFixture {
  serial += 1;
  // The real path of the temporary root: the checks of a store refuse a link on the way, and on macOS the root is one.
  const dataDir = mkdtempSync(join(realpathSync(tmpdir()), `${FIXTURE_DIRECTORY_PREFIX}${label}-${process.pid}-${serial}-`));
  chmodSync(dataDir, 0o700);
  const programsPath = join(FIXTURE_PROGRAMS_ROOT, `${label}-${process.pid}-${serial}`);
  let programsMade = false;
  const programsDir = (): string => {
    if (!programsMade) {
      mkdirSync(programsPath, { recursive: true, mode: 0o700 });
      chmodSync(programsPath, 0o700);
      programsMade = true;
    }
    return programsPath;
  };
  const remove = (): void => {
    standing.delete(remove);
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(programsPath, { recursive: true, force: true });
    programsMade = false;
    // The shared parent goes with its last fixture; another fixture's folder in it keeps it (the call then fails, and that is right).
    try {
      rmdirSync(FIXTURE_PROGRAMS_ROOT);
    } catch {
      // not empty, or already gone
    }
  };
  removeAtProcessEnd(remove);
  return {
    dataDir,
    mediaStoreDir: `${dataDir}/media/sessions`,
    get programsDir() {
      return programsDir();
    },
    installationId,
    worker(name, workerVersion = CAPTURE_WORKER_VERSION, protocolVersion = CAPTURE_PROTOCOL_VERSION) {
      return standIn(programsDir(), name, RELEASE_WORKER_VERSION.test(workerVersion) ? CAPTURE_WORKER_VERSION : workerVersion, protocolVersion);
    },
    workerSaying(name, workerVersion, protocolVersion = CAPTURE_PROTOCOL_VERSION) {
      return standIn(programsDir(), name, workerVersion, protocolVersion);
    },
    provisionKey(named = installationId) {
      provisionSigningKey({
        dir: `${dataDir}/${SIGNING_STORE_SUBPATH}`,
        now: FIXTURE_NOW,
        ...(named === null ? {} : { subject: { organizationalUnit: `${SIGNING_KEY_UNIT_PREFIX} ${named}` } }),
      });
    },
    remove,
  };
}

export interface RecordedSinks {
  readonly sinks: CaptureBootSinks;
  readonly lines: Array<{ readonly level: 'info' | 'warn' | 'error'; readonly fields: Record<string, unknown>; readonly message: string }>;
  readonly persisted: Array<{ readonly level: string; readonly source: string; readonly code: string }>;
}

export function recordedSinks(): RecordedSinks {
  const lines: RecordedSinks['lines'] = [];
  const persisted: RecordedSinks['persisted'] = [];
  return {
    lines,
    persisted,
    sinks: {
      info: (fields, message) => void lines.push({ level: 'info', fields, message }),
      warn: (fields, message) => void lines.push({ level: 'warn', fields, message }),
      error: (fields, message) => void lines.push({ level: 'error', fields, message }),
      persist: (entry) => void persisted.push({ level: entry.level, source: entry.source, code: entry.code }),
    },
  };
}
