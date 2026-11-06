// The attended run of the local microphone helper (blueprint row 135; checks M4-LOCAL-MIC-1,
// M4-LOCAL-WORKER-1, M4-SEC-PRIV-1). NOT RUN BY AN AGENT with `--source device`: the first open of the
// microphone makes macOS ask the USER for permission, and only the user answers (D74 (3)).
//
//   npx tsx apps/core-server/src/capture/adapters/local/__tests__/e2e/local-mic-capture.ts \
//        --program <absolute path of FFmpeg> --source device [--seconds 10] [--run-dir <absolute dir>]
//
//   --source generated   the SAME pipeline fed by a generated tone: no device, no permission prompt.
//
// What it does, in order: states whether the program path passes the production rule; reads the device
// list (opens nothing); runs the pre-check (THE FIRST OPEN: the macOS question appears here); prepares
// the pipe; reads the pipe for the given seconds (at most 10) COUNTED FROM THE FIRST SAMPLE; stops the
// helper. The microphone itself is open a little longer than that: from the helper's open (reported as
// `openingLatencyMs`, before the first sample) to the stop. It writes NOTHING to
// disk but the pipe and removes it. The samples are counted and measured as they arrive and are then
// discarded; the output is NUMBERS ONLY (one JSON line and a few labelled lines). Nothing is played,
// uploaded or described. Exit code: 0 pass, 1 a check failed, 2 refused before any open.
//
// THE DIAGNOSTIC (pass D3, D128 / D133 (3)): `--diagnose` in place of `--source` / `--seconds`.
//
//   npx tsx <this file> --program <absolute path of FFmpeg> --diagnose
//
// It runs the four argument variants of `mic-diagnose.ts` one after another, each reading for 5 s and
// killed at 5.75 s at the latest: THE MICROPHONE IS OPEN FOR AT MOST 23 SECONDS IN TOTAL, and the first
// printed line says so. It prints, per variant, one JSON line of numbers (declared rate, observed rate
// from the first to the last chunk, median arrival interval, modal chunk size, the count of FFmpeg's
// own diagnostic lines, the input format FFmpeg reports) and one closing line with the reading. No
// pipe, no file: the samples come over standard output, are counted and dropped. FFmpeg's text is
// counted, never printed. `--proof TRUE_48K | LOSSY_8_OF_9 | RELABEL_441` runs the same variants on a
// generated source: no device, an agent may run it. Exit code: 0 ran, 2 refused before any open.
//
// THE RATE (pass C2, D117) is judged by `judgeArrivalRate`: samples that arrived after the first chunk
// over the time since the first chunk, within 2 % of 48,000. The opening time is never charged to it.
// A generated input is judged from one second after its first chunk (the program's pacing burst).
import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIC_SILENCE_DBFS } from '@dems/shared/api';
import { createSystemTimers } from '../../../../timers';
import { MIC_TRANSPORTS } from '../../../mic-transport';
import { helperProgramRefusal } from '../../helper-program';
import { LOCAL_MIC_DEVICE_NAME, MicGeneratedTone, type MicSource } from '../../mic-helper-args';
import { createMicHelper } from '../../mic-helper';
import { inspectProgram, startHelperProcess } from '../../process-door';
import { MIC_DIAGNOSE_GENERATED, MIC_DIAGNOSE_KILL_MS, MIC_DIAGNOSE_MAX_OPEN_SECONDS, MIC_DIAGNOSE_READ_MS, micDiagnoseVariants, micVariantNumbers, readingOf, reportedInputOf, type ByteArrival, type MicDiagnoseGenerated, type MicDiagnoseSource, type MicVariantNumbers } from '../mic-diagnose';
import { judgeArrivalRate, streamFacts, streamRefusals, type ChunkArrival } from '../mic-stream-check';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPOSITORY = resolve(HERE, '../../../../../../../..');
const STATEMENT = MIC_TRANSPORTS.PCM_FIFO;
const MAX_SECONDS = 10;

function argument(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

const say = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

function refuse(why: string): never {
  say(`REFUSED before any open: ${why}`);
  process.exit(2);
}

/**
 * The diagnostic run (see the header). Opens the microphone only with no `--proof`, for at most
 * `MIC_DIAGNOSE_MAX_OPEN_SECONDS` in total; never returns.
 */
async function diagnose(): Promise<never> {
  const programPath = argument('--program');
  const proof = argument('--proof');
  if (programPath === undefined || !programPath.startsWith('/')) refuse('--program must be an absolute path');
  if (proof !== undefined && !Object.hasOwn(MIC_DIAGNOSE_GENERATED, proof)) refuse(`--proof must be one of ${Object.keys(MIC_DIAGNOSE_GENERATED).join(', ')}`);
  const diagnosed: MicDiagnoseSource = proof === undefined ? { kind: 'DEVICE', name: LOCAL_MIC_DEVICE_NAME } : { kind: 'PROOF', generated: proof as MicDiagnoseGenerated };
  const variants = micDiagnoseVariants(diagnosed);
  // THE FIRST LINE: how long the microphone indicator will be on.
  say(
    diagnosed.kind === 'DEVICE'
      ? `MICROPHONE: open for at most ${MIC_DIAGNOSE_MAX_OPEN_SECONDS} seconds in total (${variants.length} variants one after another, each read for ${MIC_DIAGNOSE_READ_MS / 1000} s and stopped at ${MIC_DIAGNOSE_KILL_MS / 1000} s at the latest; the orange indicator may go off for a moment between them). Nothing is written to disk; numbers only.`
      : `PROOF on the generated source ${proof}: no device is opened, the microphone indicator stays off. ${variants.length} variants, ${MIC_DIAGNOSE_READ_MS / 1000} s each.`,
  );
  const programRule = helperProgramRefusal(inspectProgram(programPath));
  if (programRule !== null) refuse(`the program path fails the production rule (${programRule}). Copy the program into a private folder, e.g. .data/helpers/, and pass that path.`);
  const clock = createSystemTimers();
  if (diagnosed.kind === 'DEVICE') {
    // The list: it opens nothing and asks for nothing.
    const lister = createMicHelper({ program: programPath, runDir: resolve(REPOSITORY, '.data/run/capture'), timers: clock });
    const absent = await lister.presence('MIC-03', LOCAL_MIC_DEVICE_NAME);
    if (absent !== null) refuse(`the device is not in the audio device list (${absent.code}). If this command runs inside an agent sandbox the list is empty; run it in your own Terminal.`);
  }
  const results: MicVariantNumbers[] = [];
  for (const variant of variants) {
    const arrivals: ByteArrival[] = [];
    let zeros = 0;
    let zeroRun = 0;
    let longestZeroRun = 0;
    let carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    const startedAtMs = performance.now();
    const child = startHelperProcess({
      command: programPath,
      args: variant.args,
      env: {},
      onOutput: (chunk) => {
        arrivals.push({ atMs: performance.now(), bytes: chunk.length });
        if (!variant.float32Mono) return;
        // Counted as they arrive and dropped: exact zeros are what a resampler writes into a hole.
        const joined = carry.length === 0 ? chunk : Buffer.concat([carry, chunk]);
        const whole = joined.length - (joined.length % 4);
        for (let offset = 0; offset < whole; offset += 4) {
          if (joined.readFloatLE(offset) === 0) {
            zeros += 1;
            zeroRun += 1;
            if (zeroRun > longestZeroRun) longestZeroRun = zeroRun;
          } else zeroRun = 0;
        }
        carry = Buffer.from(joined.subarray(whole));
      },
    });
    const cancelStop = clock.after(MIC_DIAGNOSE_READ_MS, () => child.kill('SIGTERM'));
    const cancelKill = clock.after(MIC_DIAGNOSE_KILL_MS, () => child.kill('SIGKILL'));
    const exit = await child.ended;
    cancelStop();
    cancelKill();
    const numbers = micVariantNumbers({ variant, startedAtMs, arrivals, reported: reportedInputOf(exit.diagnostics), zeroSamples: zeros, longestZeroRunSamples: longestZeroRun });
    results.push(numbers);
    say(JSON.stringify({ letter: variant.letter, ...numbers, helperOpenMs: Math.round(performance.now() - startedAtMs), helperStarted: !exit.spawnFailed }));
    // A plain timer: it keeps the run alive between two helpers (the capture timers do not).
    await new Promise<void>((next) => setTimeout(next, 300));
  }
  say(JSON.stringify({ check: 'M4-LOCAL-MIC-1 diagnostic', source: diagnosed.kind === 'DEVICE' ? 'device' : proof, reading: readingOf(results), ratios: Object.fromEntries(results.map((result) => [result.variant, result.ratioIs ?? result.ratio])) }));
  if (diagnosed.kind === 'DEVICE' && results.every((result) => result.chunks === 0)) say('No sample arrived in any variant. If you refused the permission: System Settings > Privacy & Security > Microphone, switch the app on, then run this again. (An agent never does this for you.)');
  process.exit(0);
}
if (process.argv.includes('--diagnose')) await diagnose();

const program = argument('--program');
const sourceName = argument('--source');
const seconds = Math.min(Number(argument('--seconds') ?? MAX_SECONDS), MAX_SECONDS);
const runDir = argument('--run-dir') ?? resolve(REPOSITORY, '.data/run/capture');
if (program === undefined || !program.startsWith('/')) refuse('--program must be an absolute path');
if (sourceName !== 'device' && sourceName !== 'generated') refuse('--source must be device or generated');
if (!Number.isFinite(seconds) || seconds < 1) refuse('--seconds must be between 1 and 10');

const source: MicSource = sourceName === 'device' ? { kind: 'DEVICE', name: LOCAL_MIC_DEVICE_NAME } : { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 };
const timers = createSystemTimers();
const helper = createMicHelper({ program, runDir, timers, limits: { precheckTimeoutMs: 120_000, stopGraceMs: 3_000 } });
const result: Record<string, unknown> = { check: 'M4-LOCAL-MIC-1', source: sourceName, seconds };

// 1. The production program rule, on the real path. Never overridden here.
const rule = helperProgramRefusal(inspectProgram(program));
result.programRule = rule ?? 'OK';
if (rule !== null) {
  say(JSON.stringify(result));
  refuse(`the program path fails the production rule (${rule}): a directory on the way is writable by group or others, or the file is not the server's or root's. Copy the program into a private folder, e.g. .data/helpers/, and pass that path.`);
}

if (source.kind === 'DEVICE') {
  // 2. The list. It opens nothing and asks for nothing.
  const absent = await helper.presence('MIC-03', LOCAL_MIC_DEVICE_NAME);
  result.presence = absent === null ? 'OK' : `${absent.code}/${absent.reason}`;
  if (absent !== null) {
    say(JSON.stringify(result));
    refuse(`the device is not in the audio device list (${absent.code}). If this command runs inside an agent sandbox the list is empty; run it in your own Terminal.`);
  }
  // 3. THE FIRST OPEN. macOS asks the user here; the run waits for the answer (up to two minutes).
  say('Next: the microphone is opened once, for a fraction of a second. macOS may now show a permission question naming the app that started this command. Answer it yourself.');
  const denied = await helper.precheck('MIC-03', LOCAL_MIC_DEVICE_NAME);
  result.precheck = denied === null ? 'OK' : `${denied.code}/${denied.reason}`;
  if (denied !== null) {
    say(JSON.stringify(result));
    say('The microphone could not be opened. If you refused the permission: System Settings > Privacy & Security > Microphone, switch the app on, then run this again. (An agent never does this for you.)');
    process.exit(denied.code === 'PERMISSION_DENIED' ? 2 : 1);
  }
}

// 4. Prepare, read, stop. The samples are measured as they arrive and dropped.
const stream = await helper.prepare({ deviceId: 'MIC-03', sessionId: `SES-ATTENDED-${Date.now()}`, source });
const reader = createReadStream(stream.input.path);
let bytesTotal = 0;
let chunkCount = 0;
let minChunk = Number.POSITIVE_INFINITY;
let maxChunk = 0;
let firstAt = 0;
let lastAt = 0;
let maxGapMs = 0;
/** When each chunk arrived and how many samples it held: numbers only, for the rate judge. */
const arrivals: ChunkArrival[] = [];
let sumSquares = 0;
let peak = 0;
let finite = true;
let zeroRun = 0;
let longestZeroRun = 0;
let carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);
const kept: Array<Buffer<ArrayBufferLike>> = [];
let keptBytes = 0;
const done = new Promise<void>((finish) => {
  reader.on('data', (chunk: Buffer | string) => {
    const part = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    const now = performance.now();
    if (firstAt === 0) firstAt = now;
    else maxGapMs = Math.max(maxGapMs, now - lastAt);
    lastAt = now;
    bytesTotal += part.length;
    chunkCount += 1;
    minChunk = Math.min(minChunk, part.length);
    maxChunk = Math.max(maxChunk, part.length);
    // Samples are decoded across chunk borders; a few seconds of the generated tone are also kept to judge its format. Nothing is written anywhere.
    const joined = carry.length === 0 ? part : Buffer.concat([carry, part]);
    const whole = joined.length - (joined.length % 4);
    carry = joined.subarray(whole);
    for (let offset = 0; offset < whole; offset += 4) {
      const value = joined.readFloatLE(offset);
      if (!Number.isFinite(value)) {
        finite = false;
        continue;
      }
      const magnitude = Math.abs(value);
      if (magnitude > peak) peak = magnitude;
      sumSquares += value * value;
      if (value === 0) {
        zeroRun += 1;
        if (zeroRun > longestZeroRun) longestZeroRun = zeroRun;
      } else zeroRun = 0;
    }
    arrivals.push({ atMs: now, samples: whole / 4 });
    if (sourceName === 'generated' && keptBytes < 48_000 * 4 * 3) {
      kept.push(Buffer.from(joined.subarray(0, whole)));
      keptBytes += whole;
    }
    if (now - firstAt >= seconds * 1000) reader.destroy();
  });
  reader.on('close', () => finish());
  reader.on('error', () => finish());
});

say(`Reading the pipe for ${seconds} s from the first sample${source.kind === 'DEVICE' ? ' (the orange microphone indicator is on from the open, a second or so earlier, until the stop)' : ''}.`);
let started = true;
/** The start of the helper, on the clock the arrivals are read on. */
const startedAtMs = performance.now();
try {
  await stream.start();
} catch (error) {
  started = false;
  result.start = `${(error as { code?: string }).code ?? 'ERROR'}/${(error as { reason?: string }).reason ?? ''}`;
}
const pid = stream.helperPid();
if (started) {
  result.start = 'OK';
  // The helper holds no socket at all (M4-LOCAL-WORKER-1).
  result.sockets = pid === null ? 'no pid' : await new Promise<number>((resolveSockets) => execFile('/usr/sbin/lsof', ['-nP', '-a', '-p', String(pid), '-i'], (_error, stdout) => resolveSockets(stdout.split('\n').filter((line) => line.trim() !== '').length)));
  await Promise.race([done, new Promise<void>((finish) => timers.after((seconds + 15) * 1000, finish))]);
}
reader.destroy();
await stream.close();

const windowSeconds = lastAt > firstAt ? (lastAt - firstAt) / 1000 : 0;
const samples = Math.floor(bytesTotal / 4);
const rate = judgeArrivalRate({ startedAtMs, arrivals, expectedSamplesPerSecond: STATEMENT.sampleRateHz, settleMs: sourceName === 'generated' ? 1_000 : 0 });
const observedRate = rate.observedSamplesPerSecond;
const dbfs = (linear: number): number | null => (linear > 0 ? Math.round(20 * Math.log10(linear) * 10) / 10 : null);
const rms = samples > 0 ? Math.sqrt(sumSquares / samples) : 0;
Object.assign(result, {
  windowSeconds: Math.round(windowSeconds * 100) / 100,
  bytes: bytesTotal,
  aligned: bytesTotal % 4 === 0,
  samples,
  expectedSamplesPerSecond: STATEMENT.sampleRateHz,
  observedSamplesPerSecond: observedRate,
  rateJudgedFrom: sourceName === 'generated' ? 'one second after the first chunk, to the last chunk' : 'the first chunk to the last chunk',
  rateTolerance: rate.toleranceFraction,
  openingLatencyMs: rate.openingLatencyMs,
  rateOverWindowFromStart_notJudged: rate.rateOverWindowFromStart,
  medianArrivalIntervalMs: rate.medianArrivalIntervalMs,
  expectedArrivalIntervalMsOfModalChunk: rate.modalChunkSamples === null ? null : Math.round((rate.modalChunkSamples / STATEMENT.sampleRateHz) * 100_000) / 100,
  modalChunkSamples: rate.modalChunkSamples,
  finite,
  peakDbfs: dbfs(peak),
  rmsDbfs: dbfs(rms),
  silenceThresholdDbfs: MIC_SILENCE_DBFS,
  aboveSilence: dbfs(peak) !== null && (dbfs(peak) as number) > MIC_SILENCE_DBFS,
  longestZeroRunMs: Math.round((longestZeroRun / STATEMENT.sampleRateHz) * 1000),
  chunks: { count: chunkCount, minBytes: Number.isFinite(minChunk) ? minChunk : null, maxBytes: maxChunk, maxArrivalGapMs: Math.round(maxGapMs) },
  helperGone: pid === null ? null : !(() => { try { process.kill(pid, 0); return true; } catch { return false; } })(),
});
const checks: string[] = [];
if (!started) checks.push('start');
if (bytesTotal === 0) checks.push('no samples arrived');
if (!rate.ratePass) checks.push('rate');
if (!finite || bytesTotal % 4 !== 0) checks.push('format');
if (result.aboveSilence !== true && sourceName === 'device') checks.push('level (speak or tap near the Mac during the run)');
if (longestZeroRun / STATEMENT.sampleRateHz > 0.02) checks.push('gap (a run of exact zeros longer than 20 ms)');
if (result.sockets !== 0 && started) checks.push('sockets');
if (sourceName === 'generated') {
  const refusals = streamRefusals(streamFacts(Buffer.concat(kept), 880), STATEMENT);
  result.formatRefusals = refusals;
  if (refusals.length > 0) checks.push('generated format');
}
result.failed = checks;
result.pass = checks.length === 0;
say(JSON.stringify(result));
say(result.pass === true ? 'PASS' : `FAIL: ${checks.join(', ')}`);
process.exit(result.pass === true ? 0 : 1);
