/**
 * `TranscriberAdapter`: one seam, two backends (transcript spec §B; D7; W1-C12).
 *
 * SELECTION IS CONFIGURATION, NEVER AUTOMATIC (§B.4). The backend is chosen once, when the adapter
 * is built from a resolved configuration, and cannot be changed afterwards: there is no setter and
 * the value is frozen. A session builds its adapter from the `stt_config` snapshot taken at its
 * start (§B.7) and keeps it. When the selected backend fails, the failure is returned: the other
 * backend is NEVER tried in its place, because a document that changes engine half-way is not
 * deterministic and its checkpoints are not valid.
 *
 * ONE CALL AT A TIME (§C). Every call passes the adapter's queue, so one chunk is decoded at a
 * time and calls to the shared oMLX server are serialised (D7(d)).
 */
import { createCpuLocalBackend, type CaptureWorkerPid } from './backends/cpu-local';
import { createOmlxHttp, type FetchLike } from './backends/omlx-http';
import { createOmlxServerBackend } from './backends/omlx-server';
import type { TranscriberConfig } from './config';
import { SerialQueue } from './cpu-priority';
import { credentialOf, type EncryptedCredentialSource } from './key-loader';
import type { TranscriberLog } from './log';
import {
  TranscriberBackendId,
  type EngineRunRecord,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriberBackend,
  type TranscriberChunk,
} from './types';

export interface TranscriberAdapterDeps {
  readonly log: TranscriberLog;
  readonly onEngineRun?: (record: EngineRunRecord) => void;
  /** `cpu-local`: told the process id of an engine the moment it exists. */
  readonly onEngineStart?: (engine: { readonly pid: number }) => void;
  /**
   * `cpu-local`: the capture worker the engine must stay below (§C). The `omlx-server` backend
   * starts no process (the server is a host service DEMS never starts, D7(d)), so it has no use
   * for it: that backend is a development tool and gives no evidence about CPU priority (AU3-01).
   */
  readonly captureWorkerPid?: CaptureWorkerPid;
  /** The transport of the `omlx-server` backend. Default: the global `fetch`. */
  readonly fetchImpl?: FetchLike;
  /** One queue may be shared by every adapter of a process that talks to the same server. */
  readonly queue?: SerialQueue;
  /**
   * `omlx-server`: stated when the stored credential is an ENCRYPTED one. Its `open` is the
   * composition's opener; without it the adapter is not built (`CREDENTIAL_UNAVAILABLE`).
   */
  readonly encryptedCredential?: EncryptedCredentialSource;
}

export interface TranscriberAdapter {
  /** The backend this adapter was built with. Fixed for its lifetime. */
  readonly backend: TranscriberBackendId;
  readonly model: string;
  readonly queue: SerialQueue;
  /**
   * True when the composition STATED the capture worker of the sibling rule (§C): a function, or
   * the explicit `NO_CAPTURE_WORKER`; always true for `omlx-server`, which starts no process. The
   * runner of a live session (a tap timeline) refuses an adapter that does not say so (N-10).
   */
  readonly captureWorkerStated?: boolean;
  transcribe(chunk: TranscriberChunk, options: TranscribeOptions): Promise<TranscribeResult>;
}

function buildBackend(config: TranscriberConfig, deps: TranscriberAdapterDeps): TranscriberBackend {
  if (config.backend === TranscriberBackendId.CPU_LOCAL) {
    return createCpuLocalBackend(config, { log: deps.log, onEngineRun: deps.onEngineRun, onEngineStart: deps.onEngineStart, captureWorkerPid: deps.captureWorkerPid });
  }
  // The key is read here, once, through the single key-loader, into memory only.
  const credential = credentialOf(config, deps.encryptedCredential);
  deps.log.protect(credential);
  const http = createOmlxHttp({ endpoint: config.endpoint, credential, timeoutMs: config.timeoutMs, fetchImpl: deps.fetchImpl });
  return createOmlxServerBackend(config, { http, log: deps.log, onEngineRun: deps.onEngineRun });
}

export function createTranscriberAdapter(config: TranscriberConfig, deps: TranscriberAdapterDeps): TranscriberAdapter {
  let backend: TranscriberBackend;
  try {
    backend = buildBackend(config, deps);
  } catch (error) {
    deps.log.error({ source: 'transcriber.adapter.create', message: 'the transcriber backend could not be built', error, context: { backend: config.backend, model: config.model } });
    throw error;
  }
  const queue = deps.queue ?? new SerialQueue();
  return Object.freeze({
    backend: backend.id,
    model: backend.model,
    queue,
    captureWorkerStated: config.backend !== TranscriberBackendId.CPU_LOCAL || deps.captureWorkerPid !== undefined,
    // A backend logs its own failure with its code; the adapter adds nothing and tries nothing else.
    transcribe: (chunk: TranscriberChunk, options: TranscribeOptions) => queue.run(() => backend.transcribe(chunk, options)),
  });
}
