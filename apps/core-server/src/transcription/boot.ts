/**
 * THE CS-22 BOOT STEP OF THE TRANSCRIBER (blueprint row 115; specs R-2 AC-3 / R-7 AC-1; transcript
 * spec §B.4, §B.7 "the boot check still requires the model files of the configured backend";
 * decisions D70, D71; pair-76 N-12).
 *
 * The transcriber configuration is RESOLVED AT BOOT, so that a wrong host value or a missing
 * engine stops the start of the server and not the first session of the day.
 *
 *   capture mode `simulated`   INERT: the step reads nothing and passes. No transcriber runs in
 *                              Simulated mode (the rule of the capture boot checks, dbc-4 §N.9).
 *   capture mode `real`        the step REFUSES THE BOOT when
 *                                - the host file is there and cannot be used;
 *                                - the table `stt_config` holds no row;
 *                                - STT is enabled and the stored selection cannot be resolved on
 *                                  this host (unknown backend, an endpoint that is not a clean
 *                                  loopback address, `cpu-local` on a host that states no engine);
 *                                - STT is enabled on `cpu-local` and nice, the engine executable
 *                                  or the model file is missing, the model leads outside the model
 *                                  directory, or the executable is not the CPU-only build;
 *                                - the host states a VAD engine that cannot be resolved.
 *                              It does NOT refuse for:
 *                                - STT disabled (nothing is needed; state STOPPED);
 *                                - `omlx-server` not answering: the server is a host service DEMS
 *                                  never starts (D7(d)); an unreachable backend is a WARNING at
 *                                  session start and a PARTIAL transcript, never a boot failure;
 *                                - a stated VAD engine whose files are absent: the pipeline falls
 *                                  back to fixed windows and flags it (§A.2) - logged as a warning.
 *
 * The step opens no connection and starts no process. A refusal is a `TranscriberBootError` with a
 * code and a reason; the readiness runner logs and persists it with the step ID.
 */
import { checkCpuLocalFiles, resolveSileroVadConfig, resolveTranscriberConfig, TranscriberBackendId, TranscriberError, type TranscriberLog } from '@dems/transcriber';
import { TranscriberHostError, type TranscriberHost } from './host';
import { cpuOnlyBuildOf, type CpuOnlyVerdict } from './probe';
import type { StoredSttSelection } from './snapshot';

export const TRANSCRIBER_BOOT_STEP = 'transcriber.config';

export const TranscriberBootFailure = {
  HOST_FILE_INVALID: 'TRANSCRIBER_HOST_FILE_INVALID',
  CONFIG_NOT_SEEDED: 'STT_CONFIG_NOT_SEEDED',
  CONFIG_UNRESOLVABLE: 'TRANSCRIBER_CONFIG_UNRESOLVABLE',
  ENGINE_FILES_MISSING: 'TRANSCRIBER_ENGINE_FILES_MISSING',
  ENGINE_NOT_CPU_ONLY: 'TRANSCRIBER_ENGINE_NOT_CPU_ONLY',
} as const;
export type TranscriberBootFailure = (typeof TranscriberBootFailure)[keyof typeof TranscriberBootFailure];

/** Stops the boot. `reason` is a code of the transcriber or of the host module, never a value. */
export class TranscriberBootError extends Error {
  readonly code: TranscriberBootFailure;
  readonly reason: string;
  constructor(code: TranscriberBootFailure, reason: string) {
    super('the transcriber configuration cannot be used: the server does not start in real capture mode');
    this.name = 'TranscriberBootError';
    this.code = code;
    this.reason = reason;
  }
}

export type TranscriberBootOutcome =
  /** Simulated capture, or an app without a data directory: nothing was read. */
  | { readonly outcome: 'INERT' }
  | { readonly outcome: 'DISABLED' }
  | { readonly outcome: 'RESOLVED'; readonly backend: string; readonly vad: 'READY' | 'ABSENT' | 'NOT_STATED' };

export interface TranscriberBootDeps {
  readonly captureMode: 'simulated' | 'real';
  /** False: the app has no data directory (an in-process test app); the step is inert. */
  readonly mounted: boolean;
  readonly host: () => TranscriberHost;
  readonly readConfig: () => Promise<StoredSttSelection | null>;
  /** The transcriber's own log (`log.ts`), NOT the server's logger: its entries are blanked and reduced to codes by the adapter. */
  readonly transcriberLog: TranscriberLog;
  readonly cpuOnly?: (binaryPath: string) => CpuOnlyVerdict;
}

const SOURCE = 'transcription.boot';
const reasonOf = (error: unknown): string => (error instanceof TranscriberError && typeof error.detail['reason'] === 'string' ? error.detail['reason'] : error instanceof TranscriberError ? error.code : 'UNKNOWN');

export async function runTranscriberBoot(deps: TranscriberBootDeps): Promise<TranscriberBootOutcome> {
  if (deps.captureMode !== 'real' || !deps.mounted) return { outcome: 'INERT' };
  // Named apart from the server's logger: the entry form is the transcriber's.
  const { transcriberLog } = deps;

  let host: TranscriberHost;
  try {
    host = deps.host();
  } catch (error) {
    throw new TranscriberBootError(TranscriberBootFailure.HOST_FILE_INVALID, error instanceof TranscriberHostError ? error.reason : 'UNKNOWN');
  }
  const stored = await deps.readConfig();
  if (stored === null) throw new TranscriberBootError(TranscriberBootFailure.CONFIG_NOT_SEEDED, 'NO_ROW');
  if (!stored.enabled) return { outcome: 'DISABLED' };

  let backend: string;
  try {
    // No credential is needed to resolve: a reference is read when a backend is built, not here.
    const config = resolveTranscriberConfig({ backend: stored.backend, endpoint: stored.endpoint, model: stored.model, language: stored.language, credentialRef: null }, host.runtime);
    backend = config.backend;
    if (config.backend === TranscriberBackendId.CPU_LOCAL) {
      try {
        checkCpuLocalFiles(config);
      } catch (error) {
        throw new TranscriberBootError(TranscriberBootFailure.ENGINE_FILES_MISSING, reasonOf(error));
      }
      const verdict = (deps.cpuOnly ?? cpuOnlyBuildOf)(config.binaryPath);
      if (!verdict.cpuOnly) throw new TranscriberBootError(TranscriberBootFailure.ENGINE_NOT_CPU_ONLY, verdict.reason);
    }
  } catch (error) {
    if (error instanceof TranscriberBootError) throw error;
    throw new TranscriberBootError(TranscriberBootFailure.CONFIG_UNRESOLVABLE, reasonOf(error));
  }

  let vad: 'READY' | 'ABSENT' | 'NOT_STATED' = 'NOT_STATED';
  if (host.vad !== null) {
    let vadConfig;
    try {
      vadConfig = resolveSileroVadConfig(host.vad);
    } catch (error) {
      throw new TranscriberBootError(TranscriberBootFailure.CONFIG_UNRESOLVABLE, reasonOf(error));
    }
    try {
      checkCpuLocalFiles({ nicePath: vadConfig.nicePath, binaryPath: vadConfig.binaryPath, modelPath: vadConfig.modelPath, modelDir: vadConfig.modelDir, model: vadConfig.model });
      vad = 'READY';
    } catch (error) {
      vad = 'ABSENT';
      transcriberLog.warn({ source: `${SOURCE}.vad`, message: 'the VAD engine the host states is not usable; chunks will be fixed windows, flagged', context: { reason: reasonOf(error) } });
    }
  }
  return { outcome: 'RESOLVED', backend, vad };
}
