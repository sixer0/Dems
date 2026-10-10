/**
 * Test support of the capture boot checks (blueprint row 61; not a test file, imports no Vitest).
 *
 * A REAL fixture for a real-mode boot: a private directory below the repository's git-ignored
 * `.data/` (the system's temporary directory can be world-writable, which the path rule refuses),
 * with a media root, a provisioned evidence signing key and a STAND-IN worker program - a shell
 * script that says one `HELLO` and exits when its input ends. It records nothing, opens no port
 * and reads no device. Its version is a parameter, so that a proof build can be played.
 */
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { REPOSITORY } from '../../../../test/static/scan';
import { provisionSigningKey } from '../../signer';
import { CAPTURE_WORKER_VERSION, RELEASE_WORKER_VERSION, SIGNING_STORE_SUBPATH, type CaptureBootSinks } from '../checks';

export const FIXTURE_NOW = 1_760_000_000_000;

export interface RealBootFixture {
  readonly dataDir: string;
  readonly mediaStoreDir: string;
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
  /** Creates the evidence signing key of the fixture (valid from `FIXTURE_NOW`). */
  provisionKey(): void;
  remove(): void;
}

let serial = 0;

/** A shell script that says one `HELLO` and exits when its input ends. It takes any arguments and reads none. */
function standIn(dataDir: string, name: string, workerVersion: string, protocolVersion: number): string {
  const path = `${dataDir}/${name}`;
  const hello = JSON.stringify({ v: CAPTURE_PROTOCOL_VERSION, type: 'HELLO', protocolVersion, workerVersion });
  writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' '${hello}'\nexec /bin/cat > /dev/null\n`, { mode: 0o700 });
  chmodSync(path, 0o700);
  return path;
}

export function realBootFixture(label: string): RealBootFixture {
  serial += 1;
  const dataDir = resolve(REPOSITORY, '.data', `test-row61-${label}-${process.pid}-${serial}`);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  chmodSync(dataDir, 0o700);
  return {
    dataDir,
    mediaStoreDir: `${dataDir}/media/sessions`,
    worker(name, workerVersion = CAPTURE_WORKER_VERSION, protocolVersion = CAPTURE_PROTOCOL_VERSION) {
      return standIn(dataDir, name, RELEASE_WORKER_VERSION.test(workerVersion) ? CAPTURE_WORKER_VERSION : workerVersion, protocolVersion);
    },
    workerSaying(name, workerVersion, protocolVersion = CAPTURE_PROTOCOL_VERSION) {
      return standIn(dataDir, name, workerVersion, protocolVersion);
    },
    provisionKey() {
      provisionSigningKey({ dir: `${dataDir}/${SIGNING_STORE_SUBPATH}`, now: FIXTURE_NOW });
    },
    remove() {
      rmSync(dataDir, { recursive: true, force: true });
    },
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
