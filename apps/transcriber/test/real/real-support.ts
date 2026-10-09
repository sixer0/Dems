// Where the REAL engines of this Mac are (rows 107-110 for `cpu-local`; D7 for `omlx-server`), and
// where a real run leaves its evidence. These are test-side facts of this host; the production
// code reads every one of them from configuration.
//
// EVIDENCE IS NEVER OVERWRITTEN (fix round 1, N-14). Every run writes into its own new directory
// `.cache/stt/checks/row76/runs/<UTC stamp>-<pid>-<kind>/` (git-ignored); creating it fails when it
// exists, and every file in it is written with the exclusive flag.
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { STT_CONFIG_DEFAULT } from '@dems/shared/api';

export const REPO = resolve(import.meta.dirname, '..', '..', '..', '..');
export const WHISPER_CLI = join(REPO, '.cache/stt/whisper.cpp/build/bin/whisper-cli');
export const MODEL_DIR = join(REPO, '.cache/stt/models');
/** The model IDENTIFIER of the seeded `stt_config` row. Its file is `<MODEL_DIR>/<id>.bin`. */
export const CPU_MODEL_ID = STT_CONFIG_DEFAULT.model;
export const SEALED_FIXTURE = join(REPO, '.cache/spikes/stt-check/fixture-two-speaker-id.wav');
export const RUNS_DIR = join(REPO, '.cache/stt/checks/row76/runs');

/** The raw output of rows 109/110 on the sealed fixture: 14 segments, 3,717 bytes. */
export const ROW_109_RAW_SHA256 = '6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439';
export const ROW_109_RAW_BYTES = 3_717;
export const ROW_109_SEGMENTS = 14;

/** The oMLX server of this Mac (D7). The automated suite never touches it. */
export const OMLX_ENDPOINT = 'http://127.0.0.1:8000';
export const OMLX_STT_MODEL = 'whisper-large-v3-turbo';
export const OMLX_TTS_MODEL = 'omnivoice-bfloat16';
/** The row-12 answer of the same server to the same fixture (17 segments). */
export const ROW_12_ANSWER = join(REPO, '.cache/spikes/stt-check/runs/whisper-run1.json');
export const ROW_12_SEGMENTS = 17;

export type RunKind = 'cpu-local' | 'omlx-server' | 'shape' | 'omlx-log-excerpt';

/** A NEW directory for one run. Throws when it already exists: an earlier run is never written into. */
export function createRunDir(kind: RunKind, root: string = RUNS_DIR, now: Date = new Date()): string {
  mkdirSync(root, { recursive: true });
  const stamp = now.toISOString().replace(/[-:.]/g, '');
  const dir = join(root, `${stamp}-${process.pid}-${kind}`);
  mkdirSync(dir); // not recursive: EEXIST when it is there
  return dir;
}

/** Writes one evidence file. Exclusive: a file that exists is an error, never replaced. */
export function writeEvidence(dir: string, name: string, value: unknown): string {
  const path = join(dir, name);
  writeFileSync(path, typeof value === 'string' || value instanceof Uint8Array ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  return path;
}

/** The newest run directory that holds `file`, or null. Names sort by their UTC stamp. */
export function latestRunWith(file: string, root: string = RUNS_DIR): string | null {
  let names: string[];
  try {
    names = readdirSync(root).sort().reverse();
  } catch {
    return null;
  }
  for (const name of names) {
    try {
      if (statSync(join(root, name, file)).isFile()) return join(root, name);
    } catch {
      // This run has no such file: an older one may.
    }
  }
  return null;
}
