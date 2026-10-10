// The transcript pipeline on the REAL `cpu-local` engine over the SPEECH FIXTURE of the development
// speech microphone (fix wave H, driver E; ruling D198), as its own process:
//   node --import tsx wave-h-speech-pipeline-child.ts <scratch> <report name>
// The row-77 child with another audio file: real Silero VAD chunking, `whisper-cli -ng` per chunk
// through the adapter, checkpoints. The journal carries commands, hashes and niceness values,
// never a time (D230). The audio is synthetic speech made on this machine; it is read, never played.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { getPriority } from 'node:os';
import { join } from 'node:path';
import { createTranscriberAdapter } from '../../src/adapter';
import { resolveTranscriberConfig } from '../../src/config';
import { detectPhysicalCores } from '../../src/host/physical-cores';
import { createFileLog } from '../../src/log';
import { openPcmSource } from '../../src/pipeline/audio-source';
import { decodedFileTimeline } from '../../src/pipeline/media-time';
import { createTranscriptRunner } from '../../src/pipeline/runner';
import { createSileroVad, resolveSileroVadConfig } from '../../src/pipeline/silero-vad';
import { CPU_MODEL_ID, MODEL_DIR, SPEECH_MIC_FIXTURE, SPEECH_MIC_RATE, VAD_BINARY, VAD_MODEL_ID, WHISPER_CLI } from './real-support';

const [scratch, reportName] = process.argv.slice(2);
if (scratch === undefined || reportName === undefined) throw new Error('usage: wave-h-speech-pipeline-child <scratch> <report name>');

const SESSION = 'SES-20261010-0125';
const THREADS = 8; // the rows 109/110 command on this 10-core host
mkdirSync(scratch, { recursive: true });
const journalPath = join(scratch, 'engine-journal.jsonl');
const journal = (entry: Record<string, unknown>): void => appendFileSync(journalPath, `${JSON.stringify(entry)}\n`);

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
  timeline: decodedFileTimeline(SPEECH_MIC_RATE),
  source: openPcmSource({ container: 'wav', path: SPEECH_MIC_FIXTURE, sampleRateHz: SPEECH_MIC_RATE }),
  vad,
  sessionScratchDir: scratch,
  log,
  onChunk: (event) => {
    if (event.phase === 'running') currentSeq = event.seq;
    journal({ event: `chunk-${event.phase}`, seq: event.seq, chunkIndex: event.chunkIndex });
  },
});
journal({ event: 'process', pid: process.pid, parentNice: getPriority(), physicalCores: cores.count });
const report = await runner.step({ final: true });
writeFileSync(join(scratch, reportName), JSON.stringify(report));
