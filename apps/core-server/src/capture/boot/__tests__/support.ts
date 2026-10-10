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
import { SIGNING_STORE_SUBPATH, type CaptureBootSinks } from '../checks';

export const FIXTURE_NOW = 1_760_000_000_000;

export interface RealBootFixture {
  readonly dataDir: string;
  readonly mediaStoreDir: string;
  /** Writes a stand-in worker that names `workerVersion` and returns its path. */
  worker(name: string, workerVersion: string, protocolVersion?: number): string;
  /** Creates the evidence signing key of the fixture (valid from `FIXTURE_NOW`). */
  provisionKey(): void;
  remove(): void;
}

let serial = 0;

export function realBootFixture(label: string): RealBootFixture {
  serial += 1;
  const dataDir = resolve(REPOSITORY, '.data', `test-row61-${label}-${process.pid}-${serial}`);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  chmodSync(dataDir, 0o700);
  return {
    dataDir,
    mediaStoreDir: `${dataDir}/media/sessions`,
    worker(name, workerVersion, protocolVersion = CAPTURE_PROTOCOL_VERSION) {
      const path = `${dataDir}/${name}`;
      const hello = JSON.stringify({ v: CAPTURE_PROTOCOL_VERSION, type: 'HELLO', protocolVersion, workerVersion });
      writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' '${hello}'\nexec /bin/cat > /dev/null\n`, { mode: 0o700 });
      chmodSync(path, 0o700);
      return path;
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
