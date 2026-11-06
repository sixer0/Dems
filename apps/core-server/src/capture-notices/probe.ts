/**
 * The reachability probe: how the pre-check and operation 97 ask the adapter layer whether a
 * registered camera or microphone answers (task 3 blueprint row 133; specs R-10 AC-2; contract C3
 * §2.6 "Microphones", §3.1; capture spec §A.1.1, §A.6.4 HL-10 / HL-11, §A.7).
 *
 * A SEAM, PROVIDED BY THE WIRING. The rows that build the adapters for the running capture
 * operation (71 / 136) hand the probe to `captureNotices(app).provideProbe(...)`. While none is
 * provided (the `SIMULATED` operation registers no adapter, rule RG-1) the pre-check gate does
 * nothing and operation 97 answers from the engine's state.
 *
 * `probeOfAdapters` is the probe of a set of adapters:
 *   - a microphone is what `AudioInputAdapter.enumerate()` says of it: it opens no device (ML-8),
 *     no socket and sends no probe (M4-MIC-RESCAN-1: 0 datagram sockets);
 *   - a camera is asked through a READ of its adapter (`profiles`, by default): an answer is
 *     "reachable", a rejection or no answer within the bound is "unreachable" with the named cause
 *     when the error carries one of the five codes of §A.6.4, else `UNREACHABLE`.
 * It never substitutes a fake for a device that does not answer (HL-11), and it reads no error
 * text: only a `code` member that is one of the known codes.
 */
import { CaptureUnreachableCause } from '@dems/shared/sim';
import { AudioInputErrorCode, sourceClassOf, type AudioInputAdapter, type CameraAdapter, type CaptureAdapterKind, type CaptureSourceClass } from '../capture/adapters';

export type DeviceReading = { readonly reachable: true } | { readonly reachable: false; readonly cause: CaptureUnreachableCause };

/** One registered microphone as a re-read of the local inputs found it. */
export interface MicrophoneReading {
  /** The microphone's registry ID (`MIC-NN`). */
  readonly deviceId: string;
  readonly present: boolean;
  /** The named cause of a local input that cannot be used; null otherwise. */
  readonly errorCode: AudioInputErrorCode | null;
  readonly adapterKind: CaptureAdapterKind;
  readonly sourceClass: CaptureSourceClass;
}

export interface InputReading {
  readonly microphones: readonly MicrophoneReading[];
  /** Local inputs that are no registered microphone: a count only (C3 op 97). */
  readonly unregisteredCount: number;
}

export interface CaptureReachabilityProbe {
  /** One registered camera. Resolves for an unreachable camera too: it rejects only for a mistake of the wiring. */
  camera(deviceId: string, signal: AbortSignal): Promise<DeviceReading>;
  /** Re-reads the local inputs (`AudioInputAdapter.enumerate()`). Opens no device and no socket. */
  microphones(): Promise<InputReading>;
}

/** How long one camera read may take at a pre-check before the camera counts as unreachable (ms). */
export const CAPTURE_PRECHECK_PROBE_TIMEOUT_MS = 2_000;

const NAMED_CAUSES: ReadonlySet<string> = new Set(Object.values(AudioInputErrorCode));

/** The cause a thrown value names: one of the five local-source codes when it carries one, else `UNREACHABLE`. */
export function causeOfProbeError(error: unknown): CaptureUnreachableCause {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : null;
  return typeof code === 'string' && NAMED_CAUSES.has(code) ? (code as CaptureUnreachableCause) : CaptureUnreachableCause.UNREACHABLE;
}

export interface AdapterProbeOptions {
  readonly cameras: readonly CameraAdapter[];
  readonly microphones: readonly AudioInputAdapter[];
  /** The read that asks a camera. Default: `adapter.profiles(deviceId)`. A local camera's wiring passes its short open (§A.6.4). */
  readonly readCamera?: (adapter: CameraAdapter, deviceId: string, signal: AbortSignal) => Promise<unknown>;
  /** Local inputs that are no registered microphone. Default: none counted. */
  readonly countUnregistered?: () => Promise<number>;
  readonly timeoutMs?: number;
  /** For the bound of a camera read; a test passes its own. */
  readonly setTimer?: (run: () => void, ms: number) => () => void;
}

const systemTimer = (run: () => void, ms: number): (() => void) => {
  const handle = setTimeout(run, ms);
  handle.unref?.();
  return () => clearTimeout(handle);
};

/**
 * The devices an adapter serves NOW: the list it was built with, then those admitted after the
 * build (row 85d `admitDevice`; finding D47). An adapter keeps `devices` as its first list, so a
 * camera adopted or a microphone registered after the boot is only in `admittedDevices()`.
 */
function servedDevices(adapter: { readonly devices: readonly { readonly id: string }[] }): readonly { readonly id: string }[] {
  const later = (adapter as { admittedDevices?: unknown }).admittedDevices;
  return typeof later === 'function' ? [...adapter.devices, ...(later.call(adapter) as readonly { readonly id: string }[])] : adapter.devices;
}

export function probeOfAdapters(options: AdapterProbeOptions): CaptureReachabilityProbe {
  const timeoutMs = options.timeoutMs ?? CAPTURE_PRECHECK_PROBE_TIMEOUT_MS;
  const setTimer = options.setTimer ?? systemTimer;
  const readCamera = options.readCamera ?? ((adapter: CameraAdapter, deviceId: string): Promise<unknown> => adapter.profiles(deviceId));

  return {
    async camera(deviceId, signal) {
      const adapter = options.cameras.find((candidate) => servedDevices(candidate).some((device) => device.id === deviceId));
      // No adapter of the running operation serves it: it cannot answer, and nothing stands in for it.
      if (adapter === undefined) return { reachable: false, cause: CaptureUnreachableCause.UNREACHABLE };
      if (signal.aborted) return { reachable: false, cause: CaptureUnreachableCause.UNREACHABLE };
      const bound = new AbortController();
      const onAbort = (): void => bound.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      let cancelTimer: () => void = () => {};
      try {
        const late = new Promise<DeviceReading>((resolve) => {
          const give = (): void => resolve({ reachable: false, cause: CaptureUnreachableCause.UNREACHABLE });
          cancelTimer = setTimer(() => {
            bound.abort();
            give();
          }, timeoutMs);
          bound.signal.addEventListener('abort', give, { once: true });
        });
        const read = Promise.resolve()
          .then(() => readCamera(adapter, deviceId, bound.signal))
          .then(
            (): DeviceReading => ({ reachable: true }),
            (error: unknown): DeviceReading => ({ reachable: false, cause: causeOfProbeError(error) }),
          );
        return await Promise.race([read, late]);
      } finally {
        cancelTimer();
        signal.removeEventListener('abort', onAbort);
      }
    },

    async microphones() {
      const microphones: MicrophoneReading[] = [];
      for (const adapter of options.microphones) {
        const sourceClass = sourceClassOf(adapter.kind);
        let listed: Awaited<ReturnType<AudioInputAdapter['enumerate']>>;
        try {
          listed = await adapter.enumerate();
        } catch (error) {
          // The list itself could not be read: every microphone of this adapter is absent, with the cause the error names.
          const cause = causeOfProbeError(error);
          const errorCode = cause === CaptureUnreachableCause.UNREACHABLE ? AudioInputErrorCode.OPEN_FAILED : (cause as AudioInputErrorCode);
          for (const device of servedDevices(adapter)) microphones.push({ deviceId: device.id, present: false, errorCode, adapterKind: adapter.kind, sourceClass });
          continue;
        }
        for (const device of servedDevices(adapter)) {
          const found = listed.find((entry) => entry.inputId === device.id);
          microphones.push({
            deviceId: device.id,
            present: found?.present === true,
            errorCode: found === undefined ? AudioInputErrorCode.DEVICE_NOT_FOUND : found.present ? null : found.errorCode,
            adapterKind: adapter.kind,
            sourceClass,
          });
        }
      }
      microphones.sort((left, right) => (left.deviceId < right.deviceId ? -1 : left.deviceId > right.deviceId ? 1 : 0));
      const unregisteredCount = options.countUnregistered === undefined ? 0 : Math.max(0, Math.trunc(await options.countUnregistered()));
      return { microphones, unregisteredCount };
    },
  };
}
