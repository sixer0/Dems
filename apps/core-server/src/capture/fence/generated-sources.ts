/**
 * The development test sources: adapters of kind `FAKE` that really feed the worker (blueprint
 * row 136; capture spec §A.6.4 "Fake camera of slot 2", §A.7.1 "Fake microphone of slot 2";
 * decision D74(2)).
 *
 * The same helper program and the same argument tables as the local devices (`adapters/local/`),
 * with a GENERATED input in the place of a device: a test picture pushed to the worker's loopback
 * listener, a tone written to the worker's named pipe. No device is listed, opened or asked for:
 * these sources need no permission and work where the Mac has no camera.
 *
 * They are their OWN adapters with their own device ids (the seeded built-ins, which are `FAKE`).
 * A local device that cannot be opened is NEVER replaced by one of them (D80(11), static rule
 * G-R14): this file is not imported by `adapters/local/`, and nothing here is built in an error
 * path. Registered in `REAL_DEVELOPMENT` only; the registry refuses the kind in any other operation.
 *
 * The in-memory fakes of the adapter layer (`adapters/fake/`) are test doubles that feed nothing;
 * they are not what a development session records from.
 */
import type { CaptureTimers } from '../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../adapters/errors';
import { CaptureAdapterKind } from '../adapters/kinds';
import { ConnectionTestOutcome, type AudioInputAdapter, type AudioInputDescriptor, type AudioOpenTarget, type CameraAdapter, type CameraSourceTarget, type CaptureDeviceEntry, type ConnectionTestResult, type DiscoveryResult, type MediaProfile, type SourceHandle } from '../adapters/types';
import { LOCAL_CAMERA_PROFILE, MicGeneratedTone, createCameraHelpers, createMicHelper, type HelperDoor, type LocalMicStream, type LocalSourceError, type MicSource, type PipeFiles, type ProgramInspector } from '../adapters/local';

interface GeneratedSourceOptions {
  /** The registry id of the built-in device this source stands behind (`CAM-02`, `MIC-02`, ...). */
  readonly id: string;
  readonly label?: string;
  /** The helper program: the absolute path of the configuration, vouched for by the boot fence. */
  readonly program: string;
  readonly timers: CaptureTimers;
  readonly door?: HelperDoor;
  readonly inspect?: ProgramInspector;
  readonly onSourceLost?: (deviceId: string, error: LocalSourceError) => void;
}

export interface GeneratedCameraOptions extends GeneratedSourceOptions {
  /** The server clock, in milliseconds. */
  readonly now: () => number;
}

/**
 * THE profile of a generated camera source: what its adapter declares and what the helper's
 * argument table makes (`adapters/local/camera-helper-args.ts`: 1280 x 720 at 30 per second). The
 * selector line of such a source states it (`fake-profile.ts`).
 */
export const GENERATED_CAMERA_PROFILE = LOCAL_CAMERA_PROFILE;

export interface GeneratedCameraAdapter extends CameraAdapter {
  closeAll(): Promise<void>;
}

export function createGeneratedCameraAdapter(options: GeneratedCameraOptions): GeneratedCameraAdapter {
  const helpers = createCameraHelpers({
    program: options.program,
    source: 'GENERATED',
    now: options.now,
    timers: options.timers,
    ...(options.door === undefined ? {} : { door: options.door }),
    ...(options.inspect === undefined ? {} : { inspect: options.inspect }),
  });
  const profiles = Object.freeze([GENERATED_CAMERA_PROFILE]);
  const served = (deviceId: string): void => {
    if (deviceId !== options.id) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };
  return {
    seam: 'CAMERA',
    kind: CaptureAdapterKind.FAKE,
    devices: Object.freeze([Object.freeze({ id: options.id, deviceClass: 'CAMERA' as const, label: options.label ?? options.id, capabilities: Object.freeze(['VIDEO'] as const), profiles })]),
    hasOpener: true,

    async discover(search): Promise<DiscoveryResult> {
      if (search.signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED);
      return Object.freeze({ candidates: Object.freeze([]), responderCount: 0, interfaceCount: 0, truncated: false });
    },
    async testConnection(_candidate, sealed, signal): Promise<ConnectionTestResult> {
      if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED);
      return Object.freeze({ outcome: ConnectionTestOutcome.UNREACHABLE, authenticated: sealed !== null, usableProfiles: Object.freeze([]) });
    },
    async openSource(deviceId: string, target: CameraSourceTarget, signal: AbortSignal): Promise<SourceHandle> {
      served(deviceId);
      if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId);
      const helper = await helpers.open(deviceId, target.ingestUrl, signal);
      helper.onExit((error) => options.onSourceLost?.(deviceId, error));
      return Object.freeze({ deviceId, close: () => helper.close() });
    },
    async profiles(deviceId: string): Promise<MediaProfile[]> {
      served(deviceId);
      return profiles.map((code) => ({ code, codec: 'H264' as const }));
    },
    pullUrl(deviceId: string): string {
      served(deviceId);
      throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID, deviceId);
    },
    async ntpOffsetMs(deviceId: string): Promise<number> {
      served(deviceId);
      return 0;
    },
    closeAll: () => helpers.closeAll(),
  };
}

export interface GeneratedMicOptions extends GeneratedSourceOptions {
  /** `<dataDir>/run/capture`. */
  readonly runDir: string;
  /** Default: 880 Hz, the standby tone (audibly not a voice). */
  readonly tone?: MicGeneratedTone;
  /**
   * The speech fixture the boot fence vouched for (fix wave H; `fake-mic.ts`). When set, this
   * microphone plays the file - synthetic speech, in real time, started again at its end - in the
   * place of its tone. Still no device: a file input of the same helper, the same output line.
   */
  readonly speechFixture?: string;
  readonly files?: PipeFiles;
}

export interface GeneratedMicAdapter extends AudioInputAdapter {
  open(inputId: string, target: AudioOpenTarget): Promise<LocalMicStream>;
  closeAll(): Promise<void>;
}

export function createGeneratedMicAdapter(options: GeneratedMicOptions): GeneratedMicAdapter {
  const tone = options.tone ?? MicGeneratedTone.TONE_880;
  const source: MicSource = options.speechFixture === undefined ? { kind: 'GENERATED', tone } : { kind: 'FIXTURE', path: options.speechFixture };
  const helper = createMicHelper({
    program: options.program,
    runDir: options.runDir,
    timers: options.timers,
    ...(options.door === undefined ? {} : { door: options.door }),
    ...(options.inspect === undefined ? {} : { inspect: options.inspect }),
    ...(options.files === undefined ? {} : { files: options.files }),
  });
  const entry: CaptureDeviceEntry = Object.freeze({ id: options.id, deviceClass: 'MIC' as const, label: options.label ?? options.id, capabilities: Object.freeze(['AUDIO'] as const), profiles: Object.freeze([]) });
  const served = (inputId: string): void => {
    if (inputId !== options.id) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };
  return {
    seam: 'AUDIO',
    kind: CaptureAdapterKind.FAKE,
    devices: Object.freeze([entry]),
    hasOpener: true,
    /** A generated source is always there: nothing is listed. */
    async enumerate(): Promise<AudioInputDescriptor[]> {
      return [{ inputId: options.id, present: true, errorCode: null }];
    },
    async open(inputId: string, target: AudioOpenTarget): Promise<LocalMicStream> {
      served(inputId);
      if (target.signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, inputId);
      const stream = await helper.prepare({ deviceId: inputId, sessionId: target.sessionId, source, signal: target.signal });
      stream.onLost((error) => options.onSourceLost?.(inputId, error));
      return stream;
    },
    /** The helper has no meter: the level is the worker's telemetry for the device id. */
    async level(inputId: string): Promise<number | null> {
      served(inputId);
      return null;
    },
    closeAll: () => helper.closeAll(),
  };
}
