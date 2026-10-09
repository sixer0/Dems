/**
 * The configuration of the transcriber (transcript spec §B.4, §B.7; R-8).
 *
 * TWO SOURCES, kept apart:
 *
 *   - `SttSelection` is what the database row `stt_config` holds and operations 90 to 92 edit:
 *     `backend`, `endpoint`, `model`, `language`, and a credential held as a REFERENCE. Rows 113
 *     and 115 hand it over as it is stored; this module names its members the same way.
 *   - `TranscriberRuntime` is what the host knows and no operator edits: where the engine
 *     executable and the model directory are, how many physical cores there are, where the log
 *     goes. It comes from the Core's own configuration, never from a request.
 *
 * `resolveTranscriberConfig` checks both and returns a frozen value. NOTHING IS DEFAULTED FROM THE
 * SOURCE CODE: no model name, no model path, no endpoint and no port is written in this workspace
 * (static rule). Every refusal is fail-closed and typed.
 */
import { isAbsolute, join } from 'node:path';
import { isSttLoopbackEndpoint, isSttModelId } from '@dems/shared/api';
import { planSttThreads, type SttThreadPlan } from './cpu-priority';
import { TRANSCRIBER_BACKEND_IDS, TRANSCRIBER_LANGUAGE, TranscriberBackendId, TranscriberError, TranscriberErrorCode } from './types';

/** The members of `stt_config` a transcriber needs. `credentialRef` is a pointer, never a key. */
export interface SttSelection {
  readonly backend: string;
  /** `omlx-server` only; loopback only (OD-13). */
  readonly endpoint?: string | null;
  readonly model: string;
  readonly language?: string;
  /** For example `omlx-settings:auth.api_key`. Null or absent: no credential is sent. */
  readonly credentialRef?: string | null;
}

export interface CpuLocalRuntime {
  /** The absolute path of the `whisper-cli` executable built with the GPU backends off. */
  readonly binaryPath: string;
  /** The absolute directory of the model files. The model IDENTIFIER `x` is the file `<modelDir>/x.bin`. */
  readonly modelDir: string;
  /**
   * The absolute path of the `nice` program the engine is started through, so that it runs at a
   * lowered priority from its first instruction. Default: `DEFAULT_NICE_PATH`.
   */
  readonly nicePath?: string;
  /**
   * `required` (the default): a host that cannot lower the priority of the engine gets NO engine
   * run (`PRIORITY_NOT_APPLIED`). `best-effort`: the run goes on and the refusal is logged. Only a
   * development sandbox that forbids the system call has a reason for the second value.
   */
  readonly priority?: EnginePriorityMode;
  /** A scratch directory for the engine's output file. */
  readonly workDir: string;
  readonly threads?: number;
  readonly processors?: number;
  /** Stops a hung engine. A bound, never a measurement. */
  readonly timeoutMs?: number;
}

export type EnginePriorityMode = 'required' | 'best-effort';

export interface OmlxServerRuntime {
  /** Stops a hung request. */
  readonly timeoutMs?: number;
  /** The settings file the single key-loader reads. Absent: the loader's default. */
  readonly settingsPath?: string;
}

export interface TranscriberRuntime {
  readonly physicalCores: number;
  readonly cpuLocal?: CpuLocalRuntime;
  readonly omlxServer?: OmlxServerRuntime;
}

export interface CpuLocalConfig {
  readonly backend: typeof TranscriberBackendId.CPU_LOCAL;
  readonly model: string;
  readonly language: typeof TRANSCRIBER_LANGUAGE;
  readonly binaryPath: string;
  readonly modelDir: string;
  readonly modelPath: string;
  readonly workDir: string;
  readonly nicePath: string;
  readonly priority: EnginePriorityMode;
  readonly threadPlan: SttThreadPlan;
  readonly timeoutMs: number;
}

export interface OmlxServerConfig {
  readonly backend: typeof TranscriberBackendId.OMLX_SERVER;
  readonly model: string;
  readonly language: typeof TRANSCRIBER_LANGUAGE;
  readonly endpoint: string;
  readonly credentialRef: string | null;
  readonly settingsPath: string | null;
  readonly timeoutMs: number;
}

export type TranscriberConfig = CpuLocalConfig | OmlxServerConfig;

/** The bound of one engine run or request (the rows 109/110 bound). Never recorded as a duration. */
export const ENGINE_TIMEOUT_MS = 1_800_000;
/** The file of a model identifier: `<modelDir>/<id>` + this extension (controller ruling on D-76-1). */
export const CPU_MODEL_FILE_EXTENSION = '.bin';
/** Where `nice` is on macOS and on Linux. A host with another layout sets `CpuLocalRuntime.nicePath`. */
export const DEFAULT_NICE_PATH = '/usr/bin/nice';

function refuse(message: string, reason: string, extra: Record<string, string | number | boolean | null> = {}): never {
  throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, message, { reason, ...extra });
}

/**
 * Refuses anything but `http://127.0.0.1` / `http://localhost` (the rule of op 91 and of the table
 * CHECK), and on top of it an address that carries a query, a fragment, a backslash, white space
 * or a control character: with `?` or `#` in it, the request path this client appends would become
 * part of the query or of the fragment and the request would go to another path (N-9).
 */
export function assertLoopbackEndpoint(endpoint: string): void {
  // The endpoint is never echoed: a URL may carry a user part.
  if (typeof endpoint !== 'string' || !isSttLoopbackEndpoint(endpoint)) {
    throw new TranscriberError(TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK, 'the transcriber endpoint must be a loopback http address', { reason: 'ENDPOINT_NOT_LOOPBACK' });
  }
  if (/[?#]/.test(endpoint)) {
    throw new TranscriberError(TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK, 'the transcriber endpoint must not carry a query or a fragment', { reason: 'ENDPOINT_HAS_QUERY_OR_FRAGMENT' });
  }
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused here
  if (/[\\\s\u0000-\u001f\u007f]/.test(endpoint)) {
    throw new TranscriberError(TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK, 'the transcriber endpoint holds a character an address may not hold', { reason: 'ENDPOINT_MALFORMED' });
  }
}

/**
 * The model file of a `cpu-local` selection: `<modelDir>/<id>.bin`. The model is an IDENTIFIER of
 * the one shared form (`STT_MODEL_ID_PATTERN` of `@dems/shared/api`): no separator, no `..`, no
 * leading `-`, no NUL, and never the file name itself (an id that ends in `.bin` is refused). So a
 * configuration row cannot name a path. That the file does not LEAD outside the directory through
 * a link is checked when the files are checked (`checkCpuLocalFiles`).
 */
export function resolveCpuModelPath(modelDir: string, model: string): string {
  if (!isAbsolute(modelDir)) refuse('the model directory must be an absolute path', 'MODEL_DIR_NOT_ABSOLUTE');
  if (!isSttModelId(model)) refuse('the model must be a model identifier, not a file name or a path', 'MODEL_ID_INVALID');
  return join(modelDir, `${model}${CPU_MODEL_FILE_EXTENSION}`);
}

export function resolveTranscriberConfig(selection: SttSelection, runtime: TranscriberRuntime): TranscriberConfig {
  if (!(TRANSCRIBER_BACKEND_IDS as readonly string[]).includes(selection.backend)) refuse('the backend is not one of the two transcriber backends', 'BACKEND_UNKNOWN');
  if ((selection.language ?? TRANSCRIBER_LANGUAGE) !== TRANSCRIBER_LANGUAGE) refuse('the transcriber transcribes Indonesian only', 'LANGUAGE_NOT_SUPPORTED');
  if (!isSttModelId(selection.model)) refuse('the model must be a model identifier, not a file name or a path', 'MODEL_ID_INVALID');

  if (selection.backend === TranscriberBackendId.CPU_LOCAL) {
    const local = runtime.cpuLocal;
    if (local === undefined) return refuse('the host configuration of the cpu-local backend is missing', 'CPU_LOCAL_RUNTIME_MISSING');
    if (!isAbsolute(local.binaryPath)) refuse('the engine executable must be an absolute path', 'BINARY_PATH_NOT_ABSOLUTE');
    if (!isAbsolute(local.workDir)) refuse('the work directory must be an absolute path', 'WORK_DIR_NOT_ABSOLUTE');
    const nicePath = local.nicePath ?? DEFAULT_NICE_PATH;
    if (!isAbsolute(nicePath)) refuse('the nice program must be an absolute path', 'NICE_PATH_NOT_ABSOLUTE');
    const priority = local.priority ?? 'required';
    if (priority !== 'required' && priority !== 'best-effort') refuse('the engine priority mode is not one of the two', 'PRIORITY_MODE_UNKNOWN');
    return Object.freeze({
      backend: TranscriberBackendId.CPU_LOCAL,
      model: selection.model,
      language: TRANSCRIBER_LANGUAGE,
      binaryPath: local.binaryPath,
      modelDir: local.modelDir,
      modelPath: resolveCpuModelPath(local.modelDir, selection.model),
      workDir: local.workDir,
      nicePath,
      priority,
      threadPlan: Object.freeze(planSttThreads({ threads: local.threads, processors: local.processors, physicalCores: runtime.physicalCores })),
      timeoutMs: local.timeoutMs ?? ENGINE_TIMEOUT_MS,
    });
  }

  const endpoint = selection.endpoint;
  if (endpoint === undefined || endpoint === null || endpoint === '') return refuse('the omlx-server backend needs an endpoint', 'ENDPOINT_REQUIRED');
  assertLoopbackEndpoint(endpoint);
  return Object.freeze({
    backend: TranscriberBackendId.OMLX_SERVER,
    model: selection.model,
    language: TRANSCRIBER_LANGUAGE,
    endpoint: endpoint.replace(/\/+$/, ''),
    credentialRef: selection.credentialRef ?? null,
    settingsPath: runtime.omlxServer?.settingsPath ?? null,
    timeoutMs: runtime.omlxServer?.timeoutMs ?? ENGINE_TIMEOUT_MS,
  });
}
