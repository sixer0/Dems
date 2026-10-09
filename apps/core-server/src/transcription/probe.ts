/**
 * THE PROBE OF OPERATION 92 IN PRODUCTION WIRING (blueprint row 115; C3 §2.5 "Test connection";
 * transcript spec §B.7; decisions D68(d), D70; pair-113 N-14).
 *
 * The STT configuration module opens no connection itself: it runs the probe handed to
 * `sttConfigControl(app).provideProbe`. This file builds that probe on `createConnectionProbe` of
 * `@dems/transcriber`, so the request of a test is made by the SAME HTTP client and the SAME
 * single key-loader as a transcription (SEC35-14). What that client holds, whatever is passed:
 *
 *   - the connection goes to the ADDRESS 127.0.0.1; an endpoint written `localhost` is never
 *     handed to a resolver;
 *   - a redirect is an error and is never followed;
 *   - the `Authorization` header is built in one function and sent to the configured endpoint
 *     only: no other port, no other host, no second request.
 *
 * WHAT THIS FILE ADDS:
 *
 *   `omlx-server`   the credential REFERENCE of the stored row is read through the one reveal
 *                   caller and handed to the key-loader. One model-list request; nothing is
 *                   started, stopped, restarted or upgraded (D7(d)); no audio; no speed (D230).
 *   `cpu-local`     the library's presence check (nice, engine, model inside the model directory),
 *                   then the CPU-ONLY BUILD CHECK below. No engine is started: no transcription.
 *   `ENCRYPTED`     the sealed envelope of the stored row is read through the one reveal caller
 *                   and opened by the OPENER the composition hands in (`openEncrypted`: in the
 *                   product the Core credential store's, `credential-opener.ts`). The opener is
 *                   called INSIDE the transcriber's key-loader, so the key goes straight into its
 *                   opaque holder, lives for the one request of the test and is never a value of
 *                   this file. Without an opener, with a store that is not ready, or with an
 *                   envelope that does not open: `CREDENTIAL_UNAVAILABLE` WITHOUT a connection.
 *
 * A probe answers `reachable: false` as a RESULT. Every refusal here is a code; a refusal is
 * logged by the transcriber's log (persistent), never with a value of the configuration.
 */
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { SttConnectionDetailCode } from '@dems/shared/api';
import { createConnectionProbe, TranscriberError, type EncryptedCredentialSource, type FetchLike, type SerialQueue, type TranscriberLog } from '@dems/transcriber';
import type { SttConnectionProbe, SttProbeResult } from '../modules/stt-config';
import type { SttEnvelopeOpener } from './credential-opener';
import type { RevealedSttCredential } from './credential-reveal';
import type { TranscriberHost } from './host';

/** Result codes this row adds to the open set of `detailCode` (C3 §2.5: "the runtime row may add"). */
export const SttProbeDetailCode = {
  /** The stored credential cannot be handed to the transcriber (an `ENCRYPTED` kind without an opener or that does not open; a row that changed under the test). */
  CREDENTIAL_UNAVAILABLE: 'CREDENTIAL_UNAVAILABLE',
  /** The host file of the transcriber cannot be used. */
  HOST_CONFIG_INVALID: 'HOST_CONFIG_INVALID',
  /** The stored configuration cannot be resolved for this host (for example `cpu-local` on a host that states no engine). */
  CONFIG_INVALID: 'CONFIG_INVALID',
  /** The engine executable names a GPU backend: it is not the CPU-only build (R-7, D229). */
  ENGINE_NOT_CPU_ONLY: 'ENGINE_NOT_CPU_ONLY',
} as const;

/**
 * What an executable built WITH a GPU backend names in its own bytes: the framework or library it
 * loads, or the backend's registration symbol. The CPU-only build of row 107 (static, GPU backends
 * off) holds none of them. Read as bytes, never executed.
 *
 * WHAT THIS CHECK IS NOT: it reads the executable file only. A build that loads its backends from
 * shared libraries beside it is not seen through; the product's engine is one static file.
 */
export const GPU_BACKEND_MARKERS: readonly string[] = [
  'Metal.framework',
  'MetalKit.framework',
  'CoreML.framework',
  'MTLCreateSystemDefaultDevice',
  'ggml_backend_metal',
  'ggml_backend_cuda',
  'ggml_backend_vk',
  'ggml_backend_opencl',
  'ggml_backend_sycl',
  'libcuda',
  'libcublas',
  'libvulkan',
  'libOpenCL',
];

export type CpuOnlyVerdict = { readonly cpuOnly: true } | { readonly cpuOnly: false; readonly reason: 'GPU_BACKEND_NAMED' | 'ENGINE_NOT_READABLE'; readonly marker?: string };

const SCAN_BLOCK_BYTES = 1 << 20;
const ENGINE_MAX_BYTES = 512 * 1024 * 1024;
const verdicts = new Map<string, CpuOnlyVerdict>();

/** Scans the executable once per (path, size, change instant). */
export function cpuOnlyBuildOf(binaryPath: string): CpuOnlyVerdict {
  let key: string;
  let size: number;
  try {
    const facts = statSync(binaryPath);
    if (!facts.isFile() || facts.size > ENGINE_MAX_BYTES) return { cpuOnly: false, reason: 'ENGINE_NOT_READABLE' };
    size = facts.size;
    key = `${binaryPath}|${facts.size}|${facts.mtimeMs}`;
  } catch {
    return { cpuOnly: false, reason: 'ENGINE_NOT_READABLE' };
  }
  const known = verdicts.get(key);
  if (known !== undefined) return known;
  const markers = GPU_BACKEND_MARKERS.map((marker) => ({ marker, bytes: Buffer.from(marker, 'latin1') }));
  const overlap = Math.max(...markers.map((entry) => entry.bytes.length)) - 1;
  let verdict: CpuOnlyVerdict = { cpuOnly: true };
  let descriptor: number;
  try {
    descriptor = openSync(binaryPath, 'r');
  } catch {
    return { cpuOnly: false, reason: 'ENGINE_NOT_READABLE' };
  }
  try {
    const block = Buffer.alloc(SCAN_BLOCK_BYTES + overlap);
    let carried = 0;
    for (let position = 0; position < size; ) {
      const read = readSync(descriptor, block, carried, SCAN_BLOCK_BYTES, position);
      if (read <= 0) break;
      const window = block.subarray(0, carried + read);
      const found = markers.find((entry) => window.includes(entry.bytes));
      if (found !== undefined) {
        verdict = { cpuOnly: false, reason: 'GPU_BACKEND_NAMED', marker: found.marker };
        break;
      }
      position += read;
      // The tail of this block is read again with the next one: a marker across the boundary is found.
      carried = Math.min(overlap, window.length);
      window.copy(block, 0, window.length - carried);
    }
  } catch {
    verdict = { cpuOnly: false, reason: 'ENGINE_NOT_READABLE' };
  } finally {
    closeSync(descriptor);
  }
  verdicts.set(key, verdict);
  return verdict;
}

export interface CoreProbeDeps {
  /** The host's statement. Throws `TranscriberHostError` for a host file that cannot be used. */
  readonly host: () => TranscriberHost;
  /** The one reveal caller (`credential-reveal.ts`), on the runtime pool. Asked for a stored `REFERENCE`, and for `ENCRYPTED` when there is an opener. */
  readonly reveal: () => Promise<RevealedSttCredential>;
  /** The opener of a stored `ENCRYPTED` credential (`coreSttEnvelopeOpener`). Absent: that kind is unavailable and the envelope is never asked for. */
  readonly openEncrypted?: SttEnvelopeOpener;
  /** The transcriber's own log (`log.ts`), NOT the server's logger: its entries are blanked and reduced to codes by the adapter. */
  readonly transcriberLog: TranscriberLog;
  /** The queue of the oMLX calls of this process: a test is serialised with transcriptions (D7(d)). */
  readonly queue: SerialQueue;
  /** The transport. Default: the transcriber's own (`fetch`, redirect refused). A test hands in an answerer. */
  readonly fetchImpl?: FetchLike;
  /** The CPU-only build check. Default: `cpuOnlyBuildOf`. */
  readonly cpuOnly?: (binaryPath: string) => CpuOnlyVerdict;
}

const SOURCE = 'transcription.probe';
const refused = (detailCode: string): SttProbeResult => ({ reachable: false, modelAvailable: false, detailCode });

export function createCoreSttProbe(deps: CoreProbeDeps): SttConnectionProbe {
  // Named apart from the server's logger: the entry form (`error`, `context.reason`) is the transcriber's.
  const { transcriberLog } = deps;
  const cpuOnly = deps.cpuOnly ?? cpuOnlyBuildOf;
  return async (target, options) => {
    if (!target.enabled) return refused(SttConnectionDetailCode.DISABLED);

    let host: TranscriberHost;
    try {
      host = deps.host();
    } catch (error) {
      transcriberLog.error({ source: `${SOURCE}.host`, message: 'the transcriber host file cannot be used; the test is answered as not reachable', context: { reason: (error as { reason?: string }).reason ?? 'UNKNOWN' } });
      return refused(SttProbeDetailCode.HOST_CONFIG_INVALID);
    }

    let credentialRef: string | null = null;
    let encryptedCredential: EncryptedCredentialSource | undefined;
    /** True once the opener was asked and refused: the library answered without a connection. */
    let openFailed = false;
    if (target.backend === 'omlx-server' && target.credentialKind !== null) {
      const openEncrypted = deps.openEncrypted;
      if (target.credentialKind !== 'REFERENCE' && (target.credentialKind !== 'ENCRYPTED' || openEncrypted === undefined)) {
        // No opener in this composition: nothing is revealed, opened or connected.
        transcriberLog.warn({ source: `${SOURCE}.credential`, message: 'the stored credential kind cannot be handed to the transcriber; the test is answered without a connection', context: { reason: 'ENCRYPTED_NO_OPENER', credentialKind: target.credentialKind } });
        return refused(SttProbeDetailCode.CREDENTIAL_UNAVAILABLE);
      }
      const revealed = await deps.reveal();
      if (revealed.kind !== target.credentialKind) {
        transcriberLog.warn({ source: `${SOURCE}.credential`, message: 'the stored credential changed while it was tested; the test is answered without a connection', context: { reason: 'CREDENTIAL_KIND_CHANGED' } });
        return refused(SttProbeDetailCode.CREDENTIAL_UNAVAILABLE);
      }
      if (revealed.kind === 'REFERENCE') credentialRef = revealed.ref;
      else if (revealed.kind === 'ENCRYPTED' && openEncrypted !== undefined) {
        const { sealed } = revealed;
        encryptedCredential = {
          // Called by the transcriber's key-loader, which holds what it returns; never called here.
          open: () => {
            try {
              return openEncrypted(sealed);
            } catch (error) {
              openFailed = true;
              throw error;
            }
          },
        };
      }
    }

    const probe = createConnectionProbe({ runtime: host.runtime, log: transcriberLog, credentialRef: () => credentialRef, fetchImpl: deps.fetchImpl, queue: deps.queue, ...(encryptedCredential === undefined ? {} : { encryptedCredential }) });
    let result: SttProbeResult;
    try {
      result = await probe({ enabled: target.enabled, backend: target.backend, endpoint: target.endpoint, model: target.model }, options);
      // The library logged the refusal by its code; the answer of the Core names what it was.
      if (openFailed) return refused(SttProbeDetailCode.CREDENTIAL_UNAVAILABLE);
    } catch (error) {
      if (!(error instanceof TranscriberError)) throw error;
      // The library throws only for a configuration it cannot read on this host.
      transcriberLog.warn({ source: `${SOURCE}.config`, message: 'the stored STT configuration cannot be resolved on this host', error, context: { backend: target.backend } });
      return refused(SttProbeDetailCode.CONFIG_INVALID);
    }

    if (target.backend === 'cpu-local' && result.reachable) {
      const binaryPath = host.runtime.cpuLocal?.binaryPath;
      const verdict: CpuOnlyVerdict = binaryPath === undefined ? { cpuOnly: false, reason: 'ENGINE_NOT_READABLE' } : cpuOnly(binaryPath);
      if (!verdict.cpuOnly) {
        transcriberLog.error({ source: `${SOURCE}.cpuLocal`, message: 'the cpu-local engine is not the CPU-only build; it is not used', context: { reason: verdict.reason, marker: verdict.marker ?? null } });
        return refused(SttProbeDetailCode.ENGINE_NOT_CPU_ONLY);
      }
    }
    return result;
  };
}
