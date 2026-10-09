/**
 * The connection test of the configured backend (transcript spec §B.7 "Test connection"; op 92).
 *
 * `createConnectionProbe` returns a function with the form of the Core's `SttConnectionProbe`
 * (`apps/core-server/src/modules/stt-config/seams.ts`): the row that mounts the transcriber
 * (row 115) hands it to `provideProbe`. The probe:
 *
 *   - `omlx-server`: asks the model list ONCE (`GET /v1/models`), on loopback, through the same
 *     HTTP client and the same single key-loader as a transcription;
 *   - `cpu-local`: checks that the engine executable and the model file are present;
 *   - sends no audio, starts nothing, and measures no speed (D230; D7(d));
 *   - answers `reachable: false` as a RESULT. It throws only for a configuration it cannot read.
 */
import { SttConnectionDetailCode } from '@dems/shared/api';
import { checkCpuLocalFiles } from './backends/cpu-local';
import { createOmlxHttp, OMLX_PATHS, type FetchLike } from './backends/omlx-http';
import { resolveTranscriberConfig, type SttSelection, type TranscriberRuntime } from './config';
import type { SerialQueue } from './cpu-priority';
import { loadCredential } from './key-loader';
import type { TranscriberLog } from './log';
import { TranscriberBackendId, TranscriberError, TranscriberErrorCode } from './types';

export interface ProbeTarget {
  readonly enabled: boolean;
  readonly backend: string;
  readonly endpoint: string | null;
  readonly model: string;
}

export interface ProbeOptions {
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
}

export interface ProbeResult {
  readonly reachable: boolean;
  readonly modelAvailable: boolean;
  readonly detailCode: string;
}

export interface ProbeDeps {
  readonly runtime: TranscriberRuntime;
  readonly log: TranscriberLog;
  /** The stored credential reference of the configuration row: the target never carries it. */
  readonly credentialRef: () => string | null;
  readonly fetchImpl?: FetchLike;
  /** The queue of the oMLX calls of this process: a probe is serialised with them (D7(d)). */
  readonly queue?: SerialQueue;
}

const result = (reachable: boolean, modelAvailable: boolean, detailCode: string): ProbeResult => ({ reachable, modelAvailable, detailCode });

function modelIds(body: Uint8Array): string[] | null {
  try {
    const json = JSON.parse(Buffer.from(body).toString('utf8')) as { data?: unknown };
    if (!Array.isArray(json.data)) return null;
    return json.data.flatMap((entry) => (typeof entry === 'object' && entry !== null && typeof (entry as { id?: unknown }).id === 'string' ? [(entry as { id: string }).id] : []));
  } catch {
    return null;
  }
}

export function createConnectionProbe(deps: ProbeDeps): (target: ProbeTarget, options: ProbeOptions) => Promise<ProbeResult> {
  const { log } = deps;
  return async (target, options) => {
    if (!target.enabled) return result(false, false, SttConnectionDetailCode.DISABLED);
    const selection: SttSelection = { backend: target.backend, endpoint: target.endpoint, model: target.model, credentialRef: deps.credentialRef() };
    const config = resolveTranscriberConfig(selection, deps.runtime);

    if (config.backend === TranscriberBackendId.CPU_LOCAL) {
      try {
        checkCpuLocalFiles(config);
        return result(true, true, SttConnectionDetailCode.OK);
      } catch (error) {
        log.warn({ source: 'transcriber.probe.cpuLocal', message: 'cpu-local presence check failed', error, context: { model: config.model } });
        if (error instanceof TranscriberError && (error.code === TranscriberErrorCode.MODEL_NOT_FOUND || error.code === TranscriberErrorCode.MODEL_OUTSIDE_MODEL_DIR)) return result(true, false, SttConnectionDetailCode.MODEL_NOT_AVAILABLE);
        return result(false, false, SttConnectionDetailCode.UNREACHABLE);
      }
    }

    const ask = async (): Promise<ProbeResult> => {
      try {
        const credential = config.credentialRef === null ? null : loadCredential(config.credentialRef, config.settingsPath === null ? {} : { settingsPath: config.settingsPath });
        log.protect(credential);
        const http = createOmlxHttp({ endpoint: config.endpoint, credential, timeoutMs: options.timeoutMs, fetchImpl: deps.fetchImpl });
        const response = await http.get(OMLX_PATHS.MODELS, options.signal);
        if (response.status === 401 || response.status === 403) return result(true, false, SttConnectionDetailCode.CREDENTIAL_REJECTED);
        const ids = response.status === 200 ? modelIds(response.body) : null;
        if (ids === null) return result(false, false, SttConnectionDetailCode.UNREACHABLE);
        return ids.includes(config.model) ? result(true, true, SttConnectionDetailCode.OK) : result(true, false, SttConnectionDetailCode.MODEL_NOT_AVAILABLE);
      } catch (error) {
        log.warn({ source: 'transcriber.probe.omlxServer', message: 'omlx-server probe failed', error, context: { model: config.model } });
        if (error instanceof TranscriberError && error.code === TranscriberErrorCode.TIMEOUT) return result(false, false, SttConnectionDetailCode.TIMEOUT);
        if (error instanceof TranscriberError && (error.code === TranscriberErrorCode.CREDENTIAL_UNAVAILABLE || error.code === TranscriberErrorCode.CREDENTIAL_REF_UNSUPPORTED)) {
          return result(false, false, SttConnectionDetailCode.CREDENTIAL_REJECTED);
        }
        return result(false, false, SttConnectionDetailCode.UNREACHABLE);
      }
    };
    return deps.queue === undefined ? ask() : deps.queue.run(ask);
  };
}
