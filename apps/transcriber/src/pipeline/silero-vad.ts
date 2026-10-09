/**
 * VAD ENGINE: Silero VAD, run by whisper.cpp (transcript spec §A.2 "Model file", "Runtime": the
 * ggml route runs inside whisper.cpp; OD-20; Q-INSTALL item 5).
 *
 * The program is whisper.cpp's own `vad-speech-segments` example, built from the SAME source tree
 * and with the SAME GPU-off configuration as the STT engine (row 107). The command is always
 *
 *     <nice> -n 10 <binary> -f <wav> -vm <model> -t 1 -vt 0.5 -vspd 250 -vsd 98 -vmsd 30 -vp 30 -vo 0.1 -np
 *
 * It never gets the switch that turns a GPU on (the build has no GPU backend, and the static rule
 * of this workspace forbids the flag). It is started through the ONE engine starter of
 * `backends/cpu-local.ts`: lowered priority from its first instruction, no shell, the fixed
 * environment, and the sibling rule against the capture worker (§C).
 *
 * WHAT IT ANSWERS: the speech runs of one WAV file, in milliseconds from the first sample of that
 * file. The program prints centiseconds; a line it prints that this module cannot read, or a count
 * that does not match its own header line, is a failure, never a shorter list.
 *
 * FAIL CLOSED INTO THE FALLBACK. Every failure here is `VAD_FAILED`; the pipeline then uses fixed
 * windows and flags the transcript `vad_fallback` (§A.2 "Failure behaviour"). Nothing here measures
 * or records how long a run took (D230).
 */
import { getPriority } from 'node:os';
import { isAbsolute } from 'node:path';
import { checkCpuLocalFiles, judgeAgainstCaptureWorker, probeEngineNice, runLoweredProcess, type CaptureWorkerPid } from '../backends/cpu-local';
import { DEFAULT_NICE_PATH, ENGINE_TIMEOUT_MS, resolveCpuModelPath, type EnginePriorityMode } from '../config';
import { STT_NICE, engineIsLowered } from '../cpu-priority';
import { blankText, type TranscriberLog } from '../log';
import { TranscriberError, TranscriberErrorCode } from '../types';
import { VAD_MAX_CHUNK_MS, VAD_MIN_SILENCE_MS, VAD_MIN_SPEECH_MS, VAD_OVERLAP_MS, VAD_SPEECH_PAD_MS, VAD_THRESHOLD } from './constants';

/** What the host knows about the VAD engine. Never an operator-edited value. */
export interface SileroVadRuntime {
  /** The absolute path of the `vad-speech-segments` executable of the GPU-off whisper.cpp build. */
  readonly binaryPath: string;
  /** The absolute directory of the model files (the same rule as the STT model: `<modelDir>/<id>.bin`). */
  readonly modelDir: string;
  /** The model IDENTIFIER of the Silero VAD model. */
  readonly model: string;
  readonly nicePath?: string;
  readonly priority?: EnginePriorityMode;
  /** Stops a hung engine. A bound, never a measurement. */
  readonly timeoutMs?: number;
}

export interface SileroVadConfig {
  readonly binaryPath: string;
  readonly modelDir: string;
  readonly model: string;
  readonly modelPath: string;
  readonly nicePath: string;
  readonly priority: EnginePriorityMode;
  readonly timeoutMs: number;
}

export function resolveSileroVadConfig(runtime: SileroVadRuntime): SileroVadConfig {
  const refuse = (message: string, reason: string): never => {
    throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, message, { reason });
  };
  if (!isAbsolute(runtime.binaryPath)) refuse('the VAD engine executable must be an absolute path', 'VAD_BINARY_PATH_NOT_ABSOLUTE');
  const nicePath = runtime.nicePath ?? DEFAULT_NICE_PATH;
  if (!isAbsolute(nicePath)) refuse('the nice program must be an absolute path', 'NICE_PATH_NOT_ABSOLUTE');
  const priority = runtime.priority ?? 'required';
  if (priority !== 'required' && priority !== 'best-effort') refuse('the engine priority mode is not one of the two', 'PRIORITY_MODE_UNKNOWN');
  return Object.freeze({
    binaryPath: runtime.binaryPath,
    modelDir: runtime.modelDir,
    model: runtime.model,
    modelPath: resolveCpuModelPath(runtime.modelDir, runtime.model),
    nicePath,
    priority,
    timeoutMs: runtime.timeoutMs ?? ENGINE_TIMEOUT_MS,
  });
}

/** A run of speech inside one WAV file: milliseconds from its first sample. */
export interface SpeechSpan {
  readonly fromMs: number;
  readonly toMs: number;
}

export interface VoiceActivityDetector {
  /** True when the composition stated the capture worker of the sibling rule (§C; N-10). In-process stand-ins start no engine and need not say. */
  readonly captureWorkerStated?: boolean;
  /** The speech runs of `wavPath`, in order. An empty list: the file holds no speech. */
  detect(wavPath: string, correlationId?: string): Promise<SpeechSpan[]>;
}

/** The argument list of one run. Pure: the test of the command shape calls it directly. */
export function buildVadArgs(config: SileroVadConfig, wavPath: string): string[] {
  return [
    '-f',
    wavPath,
    '-vm',
    config.modelPath,
    '-t',
    '1',
    '-vt',
    String(VAD_THRESHOLD),
    '-vspd',
    String(VAD_MIN_SPEECH_MS),
    '-vsd',
    String(VAD_MIN_SILENCE_MS),
    '-vmsd',
    String(VAD_MAX_CHUNK_MS / 1000),
    '-vp',
    String(VAD_SPEECH_PAD_MS),
    '-vo',
    String(VAD_OVERLAP_MS / 1000),
    '-np',
  ];
}

const HEADER_LINE = /^Detected (\d+) speech segments:$/;
const SEGMENT_LINE = /^Speech segment (\d+): start = (-?\d+(?:\.\d+)?), end = (-?\d+(?:\.\d+)?)$/;
const CENTISECOND_MS = 10;

/**
 * Reads what the program printed. The header states how many runs follow; every run is numbered in
 * order, starts at or after 0 and ends after it starts. Anything else returns null: an output this
 * module does not fully understand is not used in part.
 */
export function parseVadOutput(printed: string): SpeechSpan[] | null {
  const lines = printed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const header = lines.findIndex((line) => HEADER_LINE.test(line));
  if (header < 0) return null;
  const stated = Number(HEADER_LINE.exec(lines[header] ?? '')?.[1]);
  const spans: SpeechSpan[] = [];
  for (const line of lines.slice(header + 1)) {
    const parts = SEGMENT_LINE.exec(line);
    if (parts === null || Number(parts[1]) !== spans.length) return null;
    const fromMs = Math.round(Number(parts[2]) * CENTISECOND_MS);
    const toMs = Math.round(Number(parts[3]) * CENTISECOND_MS);
    if (!(fromMs >= 0) || !(toMs > fromMs)) return null;
    spans.push({ fromMs, toMs });
  }
  return spans.length === stated ? spans : null;
}

export interface SileroVadDeps {
  readonly log: TranscriberLog;
  /** The capture worker the engine must stay below (§C). */
  readonly captureWorkerPid?: CaptureWorkerPid;
  readonly onEngineStart?: (engine: { readonly pid: number }) => void;
  /** Told the command of every finished run. No time. */
  readonly onEngineRun?: (run: { readonly argv: readonly string[]; readonly status: number | null; readonly spans: number | null }) => void;
}

const SOURCE = 'transcriber.sileroVad';

export function createSileroVad(config: SileroVadConfig, deps: SileroVadDeps): VoiceActivityDetector {
  const { log } = deps;
  let lowers: boolean | null = null;
  let engineNice: number | null = null;

  async function detect(wavPath: string, correlationId?: string): Promise<SpeechSpan[]> {
    const fail = (reason: string, detail: Record<string, string | number | boolean | null> = {}): TranscriberError => {
      const error = new TranscriberError(TranscriberErrorCode.VAD_FAILED, 'the VAD engine gave no usable answer', { reason, ...detail });
      log.error({ source: `${SOURCE}.detect`, message: 'voice activity detection failed', error, context: { reason, model: config.model, ...detail }, correlationId });
      return error;
    };
    try {
      checkCpuLocalFiles(config);
    } catch (error) {
      if (error instanceof TranscriberError) throw fail(String(error.detail['reason'] ?? error.code));
      throw error;
    }
    if (lowers === null) {
      engineNice = probeEngineNice(config.nicePath);
      lowers = engineNice !== null && engineIsLowered(getPriority(), engineNice);
    }
    if (!lowers) {
      if (config.priority === 'required') throw fail('PRIORITY_NOT_APPLIED');
      log.warn({ source: SOURCE, message: 'the VAD engine priority could not be lowered', context: { reason: 'PRIORITY_NOT_APPLIED', mode: config.priority }, correlationId });
    }
    const verdict = judgeAgainstCaptureWorker(deps.captureWorkerPid, lowers ? engineNice : null);
    if (!verdict.ok) throw fail('ENGINE_NOT_BELOW_CAPTURE_WORKER', { workerNice: verdict.workerNice, engineNice: verdict.engineNice });

    const args = buildVadArgs(config, wavPath);
    let exit: Awaited<ReturnType<typeof runLoweredProcess>>;
    try {
      exit = await runLoweredProcess(config, args, deps.onEngineStart, true);
    } catch {
      throw fail('SPAWN_FAILED');
    }
    const argv = [config.nicePath, '-n', String(STT_NICE), config.binaryPath, ...args];
    if (exit.timedOut) {
      deps.onEngineRun?.({ argv, status: null, spans: null });
      throw fail('ENGINE_TIMEOUT');
    }
    if (exit.code !== 0) {
      deps.onEngineRun?.({ argv, status: exit.code, spans: null });
      throw fail('ENGINE_EXIT_NON_ZERO', { exitCode: exit.code, signal: exit.signal, stderrTail: blankText(exit.stderrTail.replace(/\s+/g, ' ').trim().slice(-400)) });
    }
    const spans = parseVadOutput(exit.captured);
    deps.onEngineRun?.({ argv, status: exit.code, spans: spans?.length ?? null });
    if (spans === null) throw fail('OUTPUT_FORM_UNKNOWN');
    return spans;
  }

  return Object.freeze({ detect, captureWorkerStated: deps.captureWorkerPid !== undefined });
}
