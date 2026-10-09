// THE PROCESS THAT IS KILLED (M6-KR-1; not a test file). Started by `kill-resume.test.ts` as its
// own operating-system process: `node --import tsx kill-harness-child.ts <home> <scratch> <tap>`.
// It runs the real pipeline: the runner, the `cpu-local` backend with a stand-in engine PROGRAM,
// the VAD engine module with a stand-in VAD PROGRAM, the checkpoint file and a file-backed mirror.
// When the run ends it writes its report next to the checkpoint; a killed run writes none.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranscriberAdapter } from '../adapter';
import { resolveTranscriberConfig } from '../config';
import { createFileLog } from '../log';
import { openPcmSource } from '../pipeline/audio-source';
import { captureTapTimeline } from '../pipeline/media-time';
import { createTranscriptRunner } from '../pipeline/runner';
import { createSileroVad, resolveSileroVadConfig } from '../pipeline/silero-vad';
import { SESSION, TAP_RATE, createFileChunkMirror, createProgramHome } from './pipeline-support';

const [homeRoot, scratch, tapPath, reportName] = process.argv.slice(2);
if (homeRoot === undefined || scratch === undefined || tapPath === undefined || reportName === undefined) throw new Error('usage: kill-harness-child <home> <scratch> <tap> <report name>');

const home = createProgramHome(homeRoot);
const log = createFileLog({ dir: join(scratch, 'log') });
const adapter = createTranscriberAdapter(
  resolveTranscriberConfig(
    { backend: 'cpu-local', model: home.model('journal-model'), language: 'id' },
    { physicalCores: 8, cpuLocal: { binaryPath: home.engineBinary, modelDir: home.modelDir, workDir: home.workDir, priority: home.priority } },
  ),
  { log },
);
const vadRuns: number[] = [];
const vad = createSileroVad(resolveSileroVadConfig({ binaryPath: home.vadBinary, modelDir: home.modelDir, model: home.model('silero-ok'), priority: home.priority }), { log, onEngineRun: () => vadRuns.push(vadRuns.length) });
const runner = createTranscriptRunner({
  sessionId: SESSION,
  adapter,
  timeline: captureTapTimeline(),
  source: openPcmSource({ container: 'raw', path: tapPath, sampleRateHz: TAP_RATE }),
  vad,
  sessionScratchDir: scratch,
  log,
  mirror: createFileChunkMirror(join(scratch, 'mirror.json')),
});
const report = await runner.step({ final: true });
writeFileSync(join(scratch, reportName), JSON.stringify({ ...report, vadRuns: vadRuns.length }));
