// The pipeline of row 77 on the REAL `cpu-local` engine, as its OWN PROCESS (not a test file), so
// that a check can kill it: `node --import tsx row77-pipeline-child.ts <scratch> <report name>`.
// It chunks the sealed two-voice fixture (a decoded file: file time, no origin) with the real
// Silero VAD, decodes every chunk with `whisper-cli -ng` through the adapter, and keeps a journal
// of what it started. The journal carries commands, hashes and niceness values, never a time.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { getPriority } from 'node:os';
import { join } from 'node:path';
import { createTranscriberAdapter } from '../../src/adapter';
import { resolveTranscriberConfig } from '../../src/config';
import { createTtsFixtureProvider } from '../../src/fixtures/tts-fixture-provider';
import { detectPhysicalCores } from '../../src/host/physical-cores';
import { createFileLog } from '../../src/log';
import { openPcmSource } from '../../src/pipeline/audio-source';
import { decodedFileTimeline } from '../../src/pipeline/media-time';
import { createTranscriptRunner } from '../../src/pipeline/runner';
import { createSileroVad, resolveSileroVadConfig } from '../../src/pipeline/silero-vad';
import { CPU_MODEL_ID, FIXTURE_RATE, MODEL_DIR, SEALED_FIXTURE, VAD_BINARY, VAD_MODEL_ID, WHISPER_CLI } from './real-support';

const [scratch, reportName] = process.argv.slice(2);
if (scratch === undefined || reportName === undefined) throw new Error('usage: row77-pipeline-child <scratch> <report name>');

const SESSION = 'SES-20261009-0077';
const THREADS = 8; // the rows 109/110 command on this 10-core host
mkdirSync(scratch, { recursive: true });
const journalPath = join(scratch, 'engine-journal.jsonl');
const journal = (entry: Record<string, unknown>): void => appendFileSync(journalPath, `${JSON.stringify(entry)}\n`);

const fixture = await createTtsFixtureProvider({ fixturePath: SEALED_FIXTURE }).provide();
const cores = detectPhysicalCores();
const log = createFileLog({ dir: join(scratch, 'log') });
let currentSeq = 0;
const adapter = createTranscriberAdapter(
  resolveTranscriberConfig({ backend: 'cpu-local', model: CPU_MODEL_ID, language: 'id' }, { physicalCores: cores.count, cpuLocal: { binaryPath: WHISPER_CLI, modelDir: MODEL_DIR, workDir: join(scratch, 'engine-work'), threads: THREADS } }),
  {
    log,
    onEngineStart: (engine) => journal({ event: 'stt-start', seq: currentSeq, pid: engine.pid }),
    onEngineRun: (run) => journal({ event: 'stt-run', seq: currentSeq, argv: run.argv, status: run.status, rawSha256: run.rawSha256, rawBytes: run.rawBytes, nice: run.nice }),
  },
);
const vad = createSileroVad(resolveSileroVadConfig({ binaryPath: VAD_BINARY, modelDir: MODEL_DIR, model: VAD_MODEL_ID }), {
  log,
  onEngineRun: (run) => journal({ event: 'vad-run', argv: run.argv, status: run.status, spans: run.spans }),
});
const runner = createTranscriptRunner({
  sessionId: SESSION,
  adapter,
  timeline: decodedFileTimeline(FIXTURE_RATE),
  source: openPcmSource({ container: 'wav', path: fixture.path, sampleRateHz: FIXTURE_RATE }),
  vad,
  sessionScratchDir: scratch,
  log,
  onChunk: (event) => {
    if (event.phase === 'running') currentSeq = event.seq;
    journal({ event: `chunk-${event.phase}`, seq: event.seq, chunkIndex: event.chunkIndex });
  },
});
journal({ event: 'process', pid: process.pid, parentNice: getPriority(), fixtureSha256: fixture.sha256, physicalCores: cores.count });
const report = await runner.step({ final: true });
writeFileSync(join(scratch, reportName), JSON.stringify(report));
