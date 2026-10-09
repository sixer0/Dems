// The VAD engine module (row 77; transcript spec §A.2): the command, the reading of what the
// program prints, and the failure behaviour, against a stand-in PROGRAM (a real process started
// through `nice`, exactly as the real one is). The real Silero model is exercised by
// `test/real/row77-*.real.test.ts`.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMemoryLog } from '../log';
import { openPcmSource } from '../pipeline/audio-source';
import { QaFlag } from '../pipeline/constants';
import { captureTapTimeline } from '../pipeline/media-time';
import { createTranscriptRunner } from '../pipeline/runner';
import { buildVadArgs, createSileroVad, parseVadOutput, resolveSileroVadConfig } from '../pipeline/silero-vad';
import { TranscriberError, TranscriberErrorCode } from '../types';
import { encodeWavPcm16 } from '../wav';
import { SESSION, TAP_RATE, createProgramHome, createStubAdapter, tonePcm, writeTap } from './pipeline-support';
import { EXPECTED_ENGINE_NICE, HOST_LOWERS_PRIORITY, errorRecords, scratchDir } from './support';

function vadFor(model: string): { home: ReturnType<typeof createProgramHome>; log: ReturnType<typeof createMemoryLog>; vad: ReturnType<typeof createSileroVad>; runs: { argv: readonly string[]; status: number | null; spans: number | null }[] } {
  const home = createProgramHome();
  const log = createMemoryLog();
  const runs: { argv: readonly string[]; status: number | null; spans: number | null }[] = [];
  const config = resolveSileroVadConfig({ binaryPath: home.vadBinary, modelDir: home.modelDir, model: home.model(model), priority: home.priority });
  return { home, log, runs, vad: createSileroVad(config, { log, onEngineRun: (run) => runs.push(run) }) };
}

function wavWithBursts(dir: string): string {
  const path = join(dir, 'window.wav');
  writeFileSync(path, encodeWavPcm16(tonePcm(TAP_RATE * 12, [{ from: TAP_RATE * 1, to: TAP_RATE * 3 }, { from: TAP_RATE * 6.5, to: TAP_RATE * 9.25 }]), TAP_RATE));
  return path;
}

describe('Silero VAD engine: the command (§A.2)', () => {
  it('the argument list carries the spec constants and never a switch that turns a GPU on', () => {
    const config = resolveSileroVadConfig({ binaryPath: '/opt/engine/vad', modelDir: '/opt/models', model: 'silero-v6.2.0' });
    expect(config).toMatchObject({ modelPath: '/opt/models/silero-v6.2.0.bin', nicePath: '/usr/bin/nice', priority: 'required' });
    expect(buildVadArgs(config, '/scratch/window.wav')).toEqual(['-f', '/scratch/window.wav', '-vm', '/opt/models/silero-v6.2.0.bin', '-t', '1', '-vt', '0.5', '-vspd', '250', '-vsd', '98', '-vmsd', '30', '-vp', '30', '-vo', '0.1', '-np']);
    expect(buildVadArgs(config, '/scratch/window.wav').filter((arg) => ['-ug', '--use-gpu'].includes(arg))).toEqual([]);
  });

  it('a model that is not an identifier, a relative engine path and an unknown priority mode are refused', () => {
    for (const runtime of [
      { binaryPath: '/opt/engine/vad', modelDir: '/opt/models', model: '../outside' },
      { binaryPath: '/opt/engine/vad', modelDir: '/opt/models', model: 'silero.bin' },
      { binaryPath: 'vad', modelDir: '/opt/models', model: 'silero' },
      { binaryPath: '/opt/engine/vad', modelDir: 'models', model: 'silero' },
      { binaryPath: '/opt/engine/vad', modelDir: '/opt/models', model: 'silero', priority: 'whenever' as never },
    ]) {
      expect(() => resolveSileroVadConfig(runtime)).toThrow(TranscriberError);
    }
  });
});

describe('Silero VAD engine: reading what the program prints', () => {
  it('centiseconds become milliseconds; the header count must match', () => {
    expect(parseVadOutput('\nDetected 2 speech segments:\nSpeech segment 0: start = 29.00, end = 221.00\nSpeech segment 1: start = 302.50, end = 6571.99\n\n')).toEqual([
      { fromMs: 290, toMs: 2210 },
      { fromMs: 3025, toMs: 65_720 },
    ]);
    expect(parseVadOutput('Detected 0 speech segments:\n')).toEqual([]);
  });

  it.each([
    ['no header', 'Speech segment 0: start = 1.00, end = 2.00\n'],
    ['fewer runs than the header states', 'Detected 2 speech segments:\nSpeech segment 0: start = 1.00, end = 2.00\n'],
    ['more runs than the header states', 'Detected 1 speech segments:\nSpeech segment 0: start = 1.00, end = 2.00\nSpeech segment 1: start = 3.00, end = 4.00\n'],
    ['runs out of order', 'Detected 2 speech segments:\nSpeech segment 1: start = 1.00, end = 2.00\nSpeech segment 0: start = 3.00, end = 4.00\n'],
    ['a run that ends before it starts', 'Detected 1 speech segments:\nSpeech segment 0: start = 9.00, end = 2.00\n'],
    ['a negative start', 'Detected 1 speech segments:\nSpeech segment 0: start = -1.00, end = 2.00\n'],
    ['a line that is something else', 'Detected 1 speech segments:\nSpeech segment 0: start = 1.00, end = 2.00\nwarning: something\n'],
    ['nothing', ''],
  ])('%s is not used in part: the answer is "no answer"', (_label, printed) => {
    expect(parseVadOutput(printed)).toBeNull();
  });
});

describe('Silero VAD engine: a real process, started through nice', () => {
  it('finds the speech runs of a WAV file and reports the command it ran', async () => {
    const { home, vad, runs, log } = vadFor('silero-ok');
    const spans = await vad.detect(wavWithBursts(scratchDir('vad')));
    expect(spans).toEqual([
      { fromMs: 1000, toMs: 3000 },
      { fromMs: 6500, toMs: 9250 },
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: 0, spans: 2 });
    expect(runs[0]!.argv.slice(0, 4)).toEqual(['/usr/bin/nice', '-n', '10', home.vadBinary]);
    expect(home.vadLastArgv()).toEqual(runs[0]!.argv.slice(4));
    expect(errorRecords(log)).toEqual([]);
    // The VAD engine is lowered like the STT engine wherever the host lowers a priority.
    if (HOST_LOWERS_PRIORITY) expect(home.vadLastNice()).toBe(EXPECTED_ENGINE_NICE);
  });

  it.each([
    ['a non-zero exit', 'silero-exit3', 'ENGINE_EXIT_NON_ZERO'],
    ['an output with fewer runs than it states', 'silero-garbage', 'OUTPUT_FORM_UNKNOWN'],
    ['an output with a run that ends before it starts', 'silero-backwards', 'OUTPUT_FORM_UNKNOWN'],
  ])('%s is VAD_FAILED (%s %s), logged, and never a shorter list', async (_label, model, reason) => {
    const { vad, log } = vadFor(model);
    await expect(vad.detect(wavWithBursts(scratchDir('vad')))).rejects.toMatchObject({ code: TranscriberErrorCode.VAD_FAILED, detail: { reason } });
    expect(errorRecords(log)).toHaveLength(1);
  });

  it('a model file that is absent, and an engine that is absent, are VAD_FAILED before anything is started', async () => {
    const home = createProgramHome();
    const log = createMemoryLog();
    const absentModel = createSileroVad(resolveSileroVadConfig({ binaryPath: home.vadBinary, modelDir: home.modelDir, model: 'never-downloaded', priority: home.priority }), { log });
    await expect(absentModel.detect(wavWithBursts(scratchDir('vad')))).rejects.toMatchObject({ code: TranscriberErrorCode.VAD_FAILED, detail: { reason: 'MODEL_NOT_FOUND' } });
    const absentEngine = createSileroVad(resolveSileroVadConfig({ binaryPath: join(home.root, 'no-such-program'), modelDir: home.modelDir, model: home.model('silero-ok'), priority: home.priority }), { log });
    await expect(absentEngine.detect(wavWithBursts(scratchDir('vad')))).rejects.toMatchObject({ code: TranscriberErrorCode.VAD_FAILED, detail: { reason: 'ENGINE_NOT_FOUND' } });
    expect(home.vadLastArgv()).toBeNull();
  });

  it('through the runner: the program plans the chunks; with its model missing the runner falls back to fixed windows and says so', async () => {
    const samples = tonePcm(TAP_RATE * 50, [{ from: TAP_RATE * 2, to: TAP_RATE * 12 }, { from: TAP_RATE * 30, to: TAP_RATE * 44 }]);
    const run = async (model: string, create: boolean): Promise<{ flags: readonly string[]; chunks: [number, number][] }> => {
      const home = createProgramHome();
      const dir = scratchDir('vad-runner');
      const log = createMemoryLog();
      const config = resolveSileroVadConfig({ binaryPath: home.vadBinary, modelDir: home.modelDir, model: create ? home.model(model) : model, priority: home.priority });
      const runner = createTranscriptRunner({
        sessionId: SESSION,
        adapter: createStubAdapter(),
        timeline: captureTapTimeline(),
        source: openPcmSource({ container: 'raw', path: writeTap(dir, samples), sampleRateHz: TAP_RATE }),
        vad: createSileroVad(config, { log }),
        sessionScratchDir: dir,
        log,
      });
      const report = await runner.step({ final: true });
      return { flags: report.qaFlags, chunks: runner.checkpoint().chunks.map((chunk) => [chunk.startMs, chunk.endMs]) };
    };
    const withModel = await run('silero-ok', true);
    expect(withModel.flags).not.toContain(QaFlag.VAD_FALLBACK);
    expect(withModel.chunks).toEqual([[2005, 12_032], [30_016, 44_032]]);
    const withoutModel = await run('silero-absent', false);
    expect(withoutModel.flags).toContain(QaFlag.VAD_FALLBACK);
    expect(withoutModel.chunks).toHaveLength(2);
    expect(withoutModel.chunks[0]![0]).toBe(21); // fixed windows start at tap sample 0 = 21 ms of the file
  });
});
