/**
 * The local microphone as an `AudioInputAdapter` (blueprint row 135; capture spec §A.7.1, §A.1.1;
 * adapter kind `LOCAL_DEVICE`, DEVELOPMENT source class). The sibling of `camera-adapter.ts`.
 *
 * `open()` returns the transport the worker already reads - the row-58 named pipe, as
 * `AudioStreamHandle.input` - and starts NO helper: the pipe exists, the device name has been found
 * as exactly one listed AUDIO entry, the program path has been vouched for. The helper is started by
 * `stream.start()` when the worker has accepted the plan (ML-5). Whoever wires the session (rows 66,
 * 71, 136) calls `open` for the microphone of the plan, builds the plan with `stream.input`, calls
 * `start` after the worker's accept, and `close` on every exit path.
 *
 * NOTHING HERE STANDS IN FOR A MISSING DEVICE. A microphone that cannot be used is reported with one
 * of the five named errors (`enumerate` says so without opening anything; `open` / `start` throw it)
 * and the layer above decides what to raise (spec §A.6.5 row 5; ML-7). This file imports no fake
 * adapter and builds none (static rule G-R14).
 *
 * TO WIRE WHEN ROW 136 / 71 LAND: registering this adapter (the registry accepts the kind
 * `LOCAL_DEVICE` in `REAL_DEVELOPMENT` only) with the device ID row 136 allots (`MIC-03` on a fresh
 * seed); the program path (`DEMS_CAPTURE_HELPER_FFMPEG`) and the run directory from the boot step;
 * `onSourceLost` into the microphone-loss path; `helper.livePids()` into `leftoverHelperPids` as the
 * set of its own; `level` is the worker's telemetry for the device ID (ML-6) - the helper itself has
 * no meter, so without it `level` answers null.
 */
import type { CaptureTimers } from '../../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import { AudioInputErrorCode, type AudioInputAdapter, type AudioInputDescriptor, type AudioOpenTarget, type CaptureDeviceEntry } from '../types';
import { LocalSourceError } from './errors';
import { LOCAL_MIC_DEVICE_NAME } from './mic-helper-args';
import { createMicHelper, type LocalMicStream, type MicHelper, type MicHelperLimits } from './mic-helper';
import type { PipeFiles } from './pipe-files';
import type { HelperDoor, ProgramInspector } from './process-door';

export interface LocalMicAdapterOptions {
  /** The registry ID row 136 allots (the next free `MIC-NN`). */
  readonly id: string;
  readonly label?: string;
  /** Default: `MacBook Air Microphone`. Held to the exact-name rule before every open. */
  readonly deviceName?: string;
  /** The helper program: an absolute path from the configuration. */
  readonly program: string;
  /** `<dataDir>/run/capture`. */
  readonly runDir: string;
  readonly timers: CaptureTimers;
  readonly limits?: Partial<MicHelperLimits>;
  readonly door?: HelperDoor;
  readonly inspect?: ProgramInspector;
  readonly files?: PipeFiles;
  /** dBFS from the worker's telemetry for this device ID, or null for no signal. Default: always null (the helper has no meter). */
  readonly level?: (inputId: string) => number | null;
  /** Told once when the helper of a started microphone ends during a session (the microphone-loss path of the layer above). */
  readonly onSourceLost?: (deviceId: string, error: LocalSourceError) => void;
}

export interface LocalMicAdapter extends AudioInputAdapter {
  /** The typed form of `open`: the stream also starts and stops the helper. */
  open(inputId: string, target: AudioOpenTarget): Promise<LocalMicStream>;
  /** Null when the device is in the list under exactly its name; else the named error. Opens no device. */
  presence(): Promise<LocalSourceError | null>;
  /** One short open, nothing written (HL-12). THE FIRST OPEN AFTER BOOT IS WHERE macOS ASKS THE USER. */
  precheck(signal: AbortSignal): Promise<LocalSourceError | null>;
  /** The microphones whose pipe is prepared or whose helper runs: the "is on" indicator of the clients (`sourceOpen`, SEC35-44 (4)). */
  openSources(): readonly string[];
  /** The helper functions behind the adapter, for the leftover check and the shutdown hook. */
  readonly helper: MicHelper;
  /** Stops every helper and removes every pipe: the shutdown hook. */
  closeAll(): Promise<void>;
}

export function createLocalMicAdapter(options: LocalMicAdapterOptions): LocalMicAdapter {
  const deviceName = options.deviceName ?? LOCAL_MIC_DEVICE_NAME;
  const helper = createMicHelper({
    program: options.program,
    runDir: options.runDir,
    timers: options.timers,
    ...(options.limits === undefined ? {} : { limits: options.limits }),
    ...(options.door === undefined ? {} : { door: options.door }),
    ...(options.inspect === undefined ? {} : { inspect: options.inspect }),
    ...(options.files === undefined ? {} : { files: options.files }),
  });
  const entry: CaptureDeviceEntry = Object.freeze({
    id: options.id,
    deviceClass: 'MIC' as const,
    label: options.label ?? options.id,
    capabilities: Object.freeze(['AUDIO'] as const),
    profiles: Object.freeze([]),
  });

  const served = (inputId: string): void => {
    if (inputId !== options.id) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };

  return {
    seam: 'AUDIO',
    kind: CaptureAdapterKind.LOCAL_DEVICE,
    devices: Object.freeze([entry]),
    hasOpener: true,
    helper,

    /** ML-8: the device-list call. It opens no device and asks for no permission. */
    async enumerate(): Promise<AudioInputDescriptor[]> {
      const error = await helper.presence(options.id, deviceName);
      return [{ inputId: options.id, present: error === null, errorCode: error === null ? null : AudioInputErrorCode[error.code] }];
    },

    async open(inputId: string, target: AudioOpenTarget): Promise<LocalMicStream> {
      served(inputId);
      if (target.signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, inputId);
      const stream = await helper.prepare({ deviceId: inputId, sessionId: target.sessionId, source: { kind: 'DEVICE', name: deviceName }, signal: target.signal });
      stream.onLost((error) => options.onSourceLost?.(inputId, error));
      return stream;
    },

    async level(inputId: string): Promise<number | null> {
      served(inputId);
      return options.level?.(inputId) ?? null;
    },

    presence: () => helper.presence(options.id, deviceName),
    precheck: (signal) => helper.precheck(options.id, deviceName, signal),
    openSources: () => helper.openIds(),
    closeAll: () => helper.closeAll(),
  };
}
