/**
 * Backend `cpu-local`: whisper.cpp on the CPU (transcript spec §B.3; D222; OD-24; W1-C3). THE
 * PRODUCT PATH.
 *
 * The command is always
 *
 *     <nice> -n 10 <binary> -m <model> -ng -t <threads> [-p <processors>] -l id -oj -of <out> [--prompt <text>] -f <audio>
 *
 * `-ng` (no GPU) is a constant of this module: there is no option, no configuration member and no
 * branch that leaves it out. There is no `-otype` flag in whisper.cpp; JSON is `-oj`.
 *
 * FAIL CLOSED. The executable and the model file are checked before anything is started; an absent
 * model is `MODEL_NOT_FOUND` and no process runs. A non-zero exit, a missing or malformed output
 * file and a language other than `id` are typed failures: no text is ever made up.
 *
 * LOWER PRIORITY FROM THE FIRST INSTRUCTION (fix round 1, N-5). The engine is started THROUGH the
 * `nice` program, with no shell: `nice` lowers its own priority and then becomes the engine (the
 * same process), so there is no moment in which the engine runs at the priority of capture. `nice`
 * goes on when the host refuses the call, so the host is asked first, once per backend. `nice -n`
 * is RELATIVE to the process that starts it, so the answer is judged against the niceness of this
 * process (a Core at 5 gets an engine at 15), never against a fixed number. When the host
 * cannot lower a priority, a `required` configuration (the default) starts NO engine
 * (`PRIORITY_NOT_APPLIED`). On Linux a niceness belongs to a thread; a process that starts already
 * lowered hands the value to every thread it creates, but that is NOT proven here: it is a class-C
 * check on the real Core device.
 *
 * ITS OWN ENVIRONMENT (N-6). The engine gets `ENGINE_ENVIRONMENT`, three fixed variables, and
 * nothing of the Core process: no variable of the parent can reach it.
 *
 * THE MODEL FILE STAYS INSIDE THE MODEL DIRECTORY (N-7): its real path, links followed, must lie
 * under the real path of the directory.
 *
 * The run is under the thread bound of the configuration (`threads * processors <= physical
 * cores`, re-checked here).
 * Nothing in this module measures or records how long a run took (D230).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { accessSync, closeSync, constants, mkdirSync, openSync, readFileSync, readSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { getPriority } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { z } from 'zod';
import type { CpuLocalConfig } from '../config';
import { STT_NICE, engineIsBelowCaptureWorker, engineIsLowered, threadPlanHolds } from '../cpu-priority';
import { blankText, type TranscriberLog } from '../log';
import {
  TRANSCRIBER_LANGUAGE,
  TranscribeResultSchema,
  TranscriberBackendId,
  TranscriberError,
  TranscriberErrorCode,
  type EngineRunRecord,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriberBackend,
  type TranscriberChunk,
} from '../types';
import { assertChunkAudio, encodeWavPcm16, WAV_HEAD_BYTES } from '../wav';

/** The flag that keeps the engine off every GPU backend. Passed on every run. */
export const NO_GPU_FLAG = '-ng';

/**
 * Everything the engine process finds in its environment. Fixed here: nothing is copied from the
 * process that starts it, so no variable of the Core (a token, a key, a proxy setting, a library
 * path) reaches the engine.
 */
export const ENGINE_ENVIRONMENT: Readonly<Record<string, string>> = Object.freeze({ PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' });

/** What the priority probe runs: it answers with the niceness it finds itself at. */
const NICE_PROBE = "require('node:fs').writeSync(1, String(require('node:os').getPriority()))";
const NICE_PROBE_TIMEOUT_MS = 10_000;

/**
 * The niceness a process started through `nicePath -n STT_NICE` finds itself at, or null when the
 * probe could not be run. A probe process started the same way as the engine reports it. No engine
 * is involved.
 */
export function probeEngineNice(nicePath: string): number | null {
  try {
    const probe = spawnSync(nicePath, ['-n', String(STT_NICE), process.execPath, '-e', NICE_PROBE], {
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: false,
      env: ENGINE_ENVIRONMENT,
      encoding: 'utf8',
      timeout: NICE_PROBE_TIMEOUT_MS,
    });
    const answer = probe.stdout.trim();
    return probe.status === 0 && /^-?[0-9]+$/.test(answer) ? Number(answer) : null;
  } catch {
    return null; // The probe could not be started: the host has not shown that it lowers a priority.
  }
}

/**
 * True when this host lowers the priority of a process started through `nicePath`. `nice -n` is
 * relative, so the answer of the probe is judged against the niceness of the process that starts
 * the engine, THIS one (`engineIsLowered`), never against a fixed number (fix round 2, R-1).
 */
export function hostLowersPriority(nicePath: string, parentNice: number = getPriority()): boolean {
  const engineNice = probeEngineNice(nicePath);
  return engineNice !== null && engineIsLowered(parentNice, engineNice);
}

const SOURCE = 'transcriber.cpuLocal';
const STDERR_TAIL_BYTES = 2_000;

/** What `whisper-cli -oj` writes: only the members this backend reads are named. */
const WhisperCliOutputSchema = z.looseObject({
  result: z.looseObject({ language: z.string() }),
  transcription: z.array(
    z.looseObject({
      offsets: z.looseObject({ from: z.number().nonnegative(), to: z.number().nonnegative() }),
      text: z.string(),
    }),
  ),
});

/**
 * The process id of the capture worker while one runs, or null. Given by the row that starts both
 * (the Core, row 115): the transcriber never looks a worker up by name.
 */
export type CaptureWorkerPid = () => number | null;

/**
 * The explicit statement "no capture worker runs beside this transcriber" (a test, a development
 * run, the functional checks on a finished file). A composition for a live session must state the
 * worker — a function, or this — so that the sibling rule is never off by omission (N-10).
 */
export const NO_CAPTURE_WORKER: CaptureWorkerPid = () => null;

export type CaptureWorkerVerdict =
  | { readonly ok: true; readonly workerNice: number | null }
  | { readonly ok: false; readonly workerNice: number; readonly engineNice: number | null };

/**
 * The sibling rule, from OBSERVATION: the niceness the operating system reports for the capture
 * worker against the niceness an engine started through `nice` gets on this host (`engineNice`,
 * the answer of the probe; null when the host does not lower a priority). No worker, or a worker
 * that has ended, leaves nothing to outrank.
 */
export function judgeAgainstCaptureWorker(captureWorkerPid: CaptureWorkerPid | undefined, engineNice: number | null): CaptureWorkerVerdict {
  const pid = captureWorkerPid?.() ?? null;
  if (pid === null) return { ok: true, workerNice: null };
  let workerNice: number;
  try {
    workerNice = getPriority(pid);
  } catch {
    return { ok: true, workerNice: null }; // The worker has ended between the question and the answer.
  }
  if (engineNice !== null && engineIsBelowCaptureWorker(workerNice, engineNice)) return { ok: true, workerNice };
  return { ok: false, workerNice, engineNice };
}

export interface CpuLocalDeps {
  readonly log: TranscriberLog;
  /** The capture worker to stay below (§C). Absent: no capture runs beside this transcriber. */
  readonly captureWorkerPid?: CaptureWorkerPid;
  /** Told about every finished engine run: the arguments and the hash of the raw output. No time. */
  readonly onEngineRun?: (record: EngineRunRecord) => void;
  /** Told the process id of an engine the moment it exists, so that a check can watch it from outside. */
  readonly onEngineStart?: (engine: { readonly pid: number }) => void;
}

/** The argument list of one run. Pure: the test of the command shape calls it directly. */
export function buildWhisperCliArgs(config: CpuLocalConfig, audioPath: string, outputBase: string, prompt?: string): string[] {
  const args = ['-m', config.modelPath, NO_GPU_FLAG, '-t', String(config.threadPlan.threads)];
  if (config.threadPlan.processors > 1) args.push('-p', String(config.threadPlan.processors));
  args.push('-l', config.language, '-oj', '-of', outputBase);
  if (prompt !== undefined && prompt !== '') args.push('--prompt', prompt);
  args.push('-f', audioPath);
  return args;
}

export function executableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * The boot-check half of CS-22 for this backend: `nice` and the engine can be run, the model file
 * is there, and it does not lead outside the model directory.
 */
export function checkCpuLocalFiles(config: Pick<CpuLocalConfig, 'nicePath' | 'binaryPath' | 'modelPath' | 'modelDir' | 'model'>): void {
  if (!executableFile(config.nicePath)) {
    throw new TranscriberError(TranscriberErrorCode.ENGINE_NOT_FOUND, 'the nice program the engine is started through is absent or not executable', { reason: 'NICE_NOT_FOUND' });
  }
  if (!executableFile(config.binaryPath)) {
    throw new TranscriberError(TranscriberErrorCode.ENGINE_NOT_FOUND, 'the cpu-local engine executable is absent or not executable', { reason: 'ENGINE_NOT_FOUND' });
  }
  try {
    accessSync(config.modelPath, constants.R_OK);
    if (!statSync(config.modelPath).isFile()) throw new Error('not a file');
  } catch {
    throw new TranscriberError(TranscriberErrorCode.MODEL_NOT_FOUND, 'the model file of the cpu-local backend is absent', { reason: 'MODEL_NOT_FOUND', model: config.model });
  }
  let inside = false;
  try {
    inside = realpathSync(config.modelPath).startsWith(`${realpathSync(config.modelDir)}${sep}`);
  } catch {
    inside = false;
  }
  if (!inside) {
    throw new TranscriberError(TranscriberErrorCode.MODEL_OUTSIDE_MODEL_DIR, 'the model file leads outside the model directory', { reason: 'MODEL_OUTSIDE_MODEL_DIR', model: config.model });
  }
}

/** The head of an audio file; a file that is not there is `AUDIO_NOT_FOUND`, not a format fault. */
function readHeadOrMissing(path: string): Uint8Array | null {
  try {
    if (!statSync(path).isFile()) throw new Error('not a file');
  } catch {
    throw new TranscriberError(TranscriberErrorCode.AUDIO_NOT_FOUND, 'the chunk audio could not be read or staged', { reason: 'AUDIO_NOT_FOUND' });
  }
  return readHead(path);
}

/** The first bytes of a file, for the header check. Null when it cannot be read. */
function readHead(path: string): Uint8Array | null {
  try {
    const descriptor = openSync(path, 'r');
    try {
      const head = Buffer.alloc(WAV_HEAD_BYTES);
      return head.subarray(0, readSync(descriptor, head, 0, WAV_HEAD_BYTES, 0));
    } finally {
      closeSync(descriptor);
    }
  } catch {
    return null;
  }
}

export interface EngineExit {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly stderrTail: string;
  /** What the process wrote to its standard output; empty unless `captureStdout` was asked for. */
  readonly captured: string;
}

/** What `runLoweredProcess` needs to know of a host: where `nice` and the program are, and the bound of one run. */
export interface LoweredProcessHost {
  readonly nicePath: string;
  readonly binaryPath: string;
  readonly timeoutMs: number;
}

const STDOUT_CAPTURE_BYTES = 4_000_000;

// ── The engine guard: no engine outlives the pipeline that started it (navigator finding N-2) ──

/** The record of the one engine a session may have running, under `<session scratch>/work`. */
export const ENGINE_RECORD_FILE = 'engine.json';

export interface EngineGuard {
  /** Hand this to every engine module as `onEngineStart`: the pid is on the disk before the engine has done any work. */
  readonly record: (engine: { readonly pid: number }) => void;
  /** The engine ended in the ordinary way: nothing is left to reap. */
  clear(): void;
  /**
   * Stops the engine a killed pipeline left behind, if it is still THAT process (same pid AND same
   * start instant as recorded — a pid that was given to another process is left alone), waits
   * until it is gone, and removes the record. Returns the pid it stopped, or null.
   */
  reap(): number | null;
}

/** When the operating system says the process started, as its own text; null when there is no such process. */
function processStart(pid: number): string | null {
  try {
    const answer = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { stdio: ['ignore', 'pipe', 'ignore'], shell: false, env: ENGINE_ENVIRONMENT, encoding: 'utf8', timeout: NICE_PROBE_TIMEOUT_MS });
    const text = answer.stdout.trim();
    return answer.status === 0 && text !== '' ? text : null;
  } catch {
    return null;
  }
}

const REAP_POLLS = 200;

export function createEngineGuard(sessionScratchDir: string): EngineGuard {
  const path = join(sessionScratchDir, 'work', ENGINE_RECORD_FILE);
  const clear = (): void => rmSync(path, { force: true });
  return Object.freeze({
    clear,
    record(engine: { readonly pid: number }): void {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify({ pid: engine.pid, started: processStart(engine.pid) }), { mode: 0o600 });
    },
    reap(): number | null {
      let stored: { pid?: unknown; started?: unknown };
      try {
        stored = JSON.parse(readFileSync(path, 'utf8')) as { pid?: unknown; started?: unknown };
      } catch {
        clear(); // no record, or one a kill tore: there is nothing that names a process
        return null;
      }
      const pid = typeof stored.pid === 'number' && Number.isInteger(stored.pid) && stored.pid > 1 ? stored.pid : null;
      let stopped: number | null = null;
      if (pid !== null && typeof stored.started === 'string' && processStart(pid) === stored.started) {
        try {
          process.kill(pid, 'SIGKILL');
          stopped = pid;
        } catch {
          stopped = null; // it ended between the question and the signal
        }
        for (let poll = 0; poll < REAP_POLLS && processStart(pid) === stored.started; poll += 1) spawnSync('sleep', ['0.05'], { stdio: 'ignore', shell: false, env: ENGINE_ENVIRONMENT });
      }
      clear();
      return stopped;
    },
  });
}

/**
 * THE ONE PLACE THAT STARTS AN ENGINE PROCESS (the STT engine here, the VAD engine of
 * `pipeline/silero-vad.ts`). Through `nice`, which lowers itself and then BECOMES the program: one
 * process, never un-lowered. No shell; the fixed environment; stdin closed. The standard output is
 * dropped unless the caller reads its result from it; the standard error is kept as a short tail.
 */
export function runLoweredProcess(
  host: LoweredProcessHost,
  args: readonly string[],
  onStart: ((engine: { readonly pid: number }) => void) | undefined,
  captureStdout = false,
): Promise<EngineExit> {
  return new Promise((resolve, reject) => {
    const child = spawn(host.nicePath, ['-n', String(STT_NICE), host.binaryPath, ...args], { stdio: ['ignore', captureStdout ? 'pipe' : 'ignore', 'pipe'], shell: false, env: ENGINE_ENVIRONMENT });
    let stderrTail = '';
    let captured = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, host.timeoutMs);
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (text: string) => {
      stderrTail = (stderrTail + text).slice(-STDERR_TAIL_BYTES);
    });
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (text: string) => {
      if (captured.length < STDOUT_CAPTURE_BYTES) captured += text;
    });
    child.once('spawn', () => {
      if (child.pid !== undefined) onStart?.({ pid: child.pid });
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, stderrTail, captured });
    });
  });
}

function runEngine(config: CpuLocalConfig, args: readonly string[], onStart: ((engine: { readonly pid: number }) => void) | undefined): Promise<EngineExit> {
  return runLoweredProcess(config, args, onStart);
}

export function createCpuLocalBackend(config: CpuLocalConfig, deps: CpuLocalDeps): TranscriberBackend {
  const { log } = deps;
  /** Whether this host lowers a priority, and to what: asked once, before the first engine. */
  let lowers: boolean | null = null;
  let engineNice: number | null = null;

  async function transcribe(chunk: TranscriberChunk, options: TranscribeOptions): Promise<TranscribeResult> {
    const correlationId = options.correlationId;
    const fail = (code: TranscriberErrorCode, message: string, detail: Record<string, string | number | boolean | null>): TranscriberError => {
      const error = new TranscriberError(code, message, detail);
      log.error({ source: `${SOURCE}.transcribe`, message: 'cpu-local transcription failed', error, context: { code, model: config.model, ...detail }, correlationId });
      return error;
    };

    if (options.language !== TRANSCRIBER_LANGUAGE) throw fail(TranscriberErrorCode.CONFIG_INVALID, 'the transcriber transcribes Indonesian only', { reason: 'LANGUAGE_NOT_SUPPORTED' });
    if (!threadPlanHolds(config.threadPlan)) throw fail(TranscriberErrorCode.CONFIG_INVALID, 'the STT thread product is more than the physical cores', { reason: 'THREAD_PRODUCT_EXCEEDS_CORES' });
    try {
      checkCpuLocalFiles(config);
    } catch (error) {
      if (error instanceof TranscriberError) throw fail(error.code, error.message, { ...error.detail });
      throw error;
    }

    try {
      assertChunkAudio(chunk, chunk.audio.kind === 'file' ? readHeadOrMissing(chunk.audio.path) : null);
    } catch (error) {
      if (error instanceof TranscriberError) throw fail(error.code, error.message, { ...error.detail });
      throw error;
    }

    if (lowers === null) {
      engineNice = probeEngineNice(config.nicePath);
      lowers = engineNice !== null && engineIsLowered(getPriority(), engineNice);
    }
    if (!lowers) {
      if (config.priority === 'required') {
        throw fail(TranscriberErrorCode.PRIORITY_NOT_APPLIED, 'this host cannot lower the priority of the engine, so no engine is started', { reason: 'PRIORITY_NOT_APPLIED' });
      }
      log.warn({ source: SOURCE, message: 'the engine priority could not be lowered', context: { reason: 'PRIORITY_NOT_APPLIED', mode: config.priority }, correlationId });
    }

    // The sibling rule (§C): asked before EVERY engine, because a worker starts and ends with a session.
    const verdict = judgeAgainstCaptureWorker(deps.captureWorkerPid, lowers ? engineNice : null);
    if (!verdict.ok) {
      throw fail(TranscriberErrorCode.ENGINE_NOT_BELOW_CAPTURE_WORKER, 'the engine would not run below the capture worker, so no engine is started', {
        reason: 'ENGINE_NOT_BELOW_CAPTURE_WORKER',
        workerNice: verdict.workerNice,
        engineNice: verdict.engineNice,
      });
    }

    const runId = randomUUID();
    const outputBase = join(config.workDir, `stt-${runId}`);
    const outputFile = `${outputBase}.json`;
    let audioPath: string;
    let scratchAudio: string | null = null;
    try {
      mkdirSync(config.workDir, { recursive: true });
      if (chunk.audio.kind === 'file') {
        audioPath = chunk.audio.path;
        if (!statSync(audioPath).isFile()) throw new Error('not a file');
      } else {
        scratchAudio = `${outputBase}.wav`;
        writeFileSync(scratchAudio, encodeWavPcm16(chunk.audio.samples, chunk.sampleRateHz), { mode: 0o600 });
        audioPath = scratchAudio;
      }
    } catch {
      throw fail(TranscriberErrorCode.AUDIO_NOT_FOUND, 'the chunk audio could not be read or staged', { reason: 'AUDIO_NOT_FOUND' });
    }

    const args = buildWhisperCliArgs(config, audioPath, outputBase, options.prompt);
    try {
      let exit: EngineExit;
      try {
        exit = await runEngine(config, args, deps.onEngineStart);
      } catch {
        throw fail(TranscriberErrorCode.ENGINE_FAILED, 'the cpu-local engine could not be started', { reason: 'SPAWN_FAILED' });
      }
      if (exit.timedOut) throw fail(TranscriberErrorCode.TIMEOUT, 'the cpu-local engine was stopped at its time bound', { reason: 'ENGINE_TIMEOUT' });
      if (exit.code !== 0) {
        throw fail(TranscriberErrorCode.ENGINE_FAILED, 'the cpu-local engine ended with an error', {
          reason: 'ENGINE_EXIT_NON_ZERO',
          exitCode: exit.code,
          signal: exit.signal,
          // Blanked here as well as in the log: this text is handed back to the caller.
          stderrTail: blankText(exit.stderrTail.replace(/\s+/g, ' ').trim().slice(-400)),
        });
      }

      let raw: Buffer;
      try {
        raw = readFileSync(outputFile);
      } catch {
        throw fail(TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'the cpu-local engine wrote no output file', { reason: 'OUTPUT_FILE_MISSING' });
      }
      deps.onEngineRun?.({
        backend: TranscriberBackendId.CPU_LOCAL,
        argv: [config.nicePath, '-n', String(STT_NICE), config.binaryPath, ...args],
        requestPath: null,
        status: exit.code,
        rawSha256: createHash('sha256').update(raw).digest('hex'),
        rawBytes: raw.length,
        nice: lowers ? engineNice : null,
      });

      let json: unknown;
      try {
        json = JSON.parse(raw.toString('utf8'));
      } catch {
        throw fail(TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'the cpu-local engine output is not JSON', { reason: 'OUTPUT_NOT_JSON' });
      }
      const parsed = WhisperCliOutputSchema.safeParse(json);
      if (!parsed.success) throw fail(TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'the cpu-local engine output has an unknown form', { reason: 'OUTPUT_FORM_UNKNOWN' });
      if (parsed.data.result.language !== TRANSCRIBER_LANGUAGE) {
        throw fail(TranscriberErrorCode.LANGUAGE_MISMATCH, 'the cpu-local engine reported another language', { reason: 'LANGUAGE_MISMATCH' });
      }

      const segments = parsed.data.transcription.map((entry, index) => ({
        id: index,
        start: entry.offsets.from / 1000,
        end: entry.offsets.to / 1000,
        text: entry.text.trim(),
      }));
      return TranscribeResultSchema.parse({
        engine: TranscriberBackendId.CPU_LOCAL,
        model: config.model,
        language: TRANSCRIBER_LANGUAGE,
        text: segments.map((segment) => segment.text).filter((text) => text !== '').join(' '),
        segments,
      });
    } finally {
      rmSync(outputFile, { force: true });
      if (scratchAudio !== null) rmSync(scratchAudio, { force: true });
    }
  }

  return Object.freeze({ id: TranscriberBackendId.CPU_LOCAL, model: config.model, transcribe });
}
