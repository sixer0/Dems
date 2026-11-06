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

export type RunKind = 'cpu-local' | 'omlx-server' | 'shape' | 'omlx-log-excerpt' | 'row77-cpu-local' | 'row77-omlx-server' | 'row77-df1' | 'wave-h-speech-fixture';

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

// ── Row 77 (M6-W2): the pipeline on the real engines ─────────────────────────────────────────

/** whisper.cpp's own `vad-speech-segments`, built in the row-107 GPU-off build tree by row 77. */
export const VAD_BINARY = join(REPO, '.cache/stt/whisper.cpp/build/bin/whisper-vad-speech-segments');
/** The Silero VAD model IDENTIFIER; its file is `<MODEL_DIR>/<id>.bin` (OD-20; Q-INSTALL item 5). */
export const VAD_MODEL_ID = 'ggml-silero-v6.2.0';
export const VAD_MODEL_SHA256 = '2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987';
export const ROW77_RUNS_DIR = join(REPO, '.cache/stt/checks/row77/runs');
/** The sealed fixture: 1,577,297 samples at 24 kHz. Its last sample is at 65.7207… s: 65,721 ms rounded. */
export const FIXTURE_SAMPLES = 1_577_297;
export const FIXTURE_RATE = 24_000;
export const FIXTURE_END_MS = 65_721;
export const SCRIPTED_SENTENCES = 13;

// ── Fix wave H (driver E; ruling D198): the speech fixture of the development speech microphone ──

/** What `npm run capture:dev-setup` writes: synthetic speech made on this machine, and its reference text (git-ignored). */
export const SPEECH_MIC_FIXTURE = join(REPO, '.data/dev-fixtures/speech-mic/dialogue.wav');
export const SPEECH_MIC_REFERENCE = join(REPO, '.data/dev-fixtures/speech-mic/dialogue.reference.json');
export const SPEECH_MIC_RATE = 48_000;
export const WAVE_H_RUNS_DIR = join(REPO, '.cache/stt/checks/wave-h-e/runs');
