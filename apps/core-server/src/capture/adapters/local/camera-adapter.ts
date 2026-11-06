/**
 * The camera adapter of kind `LOCAL_DEVICE` (blueprint row 134; capture spec §A.6.0, §A.6.4;
 * R-11). Development only: this Mac's camera as a recording source, through the helper.
 *
 * It implements the `CameraAdapter` seam of row 65 (`../types`). What each member means for a
 * local device:
 *   - `openSource`  starts the helper toward the worker's loopback listener (`camera-helper.ts`);
 *   - `discover`    answers nothing: a local device is not found by a network search, and this
 *                   adapter opens no socket. "Search again" for it is `presence` (the device list);
 *   - `testConnection` is `UNREACHABLE`: there is no candidate of this kind and no credential;
 *   - `pullUrl`     is refused: nobody pulls from a local device, the helper pushes;
 *   - `ntpOffsetMs` is 0: the helper stamps frames with this host's own clock.
 *
 * WHAT IT DOES NOT DO. It registers nothing and reads no flag: the kind's boot fence, the device
 * row (`CAM-NN`) and the registration are row 136's, which builds this adapter with the device ID
 * it allotted, the helper program of the configuration, the server clock and the capture timers.
 * It never falls back to another source: an error is one of the five named ones (`errors.ts`).
 */
import type { CaptureTimers } from '../../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind } from '../kinds';
import { ConnectionTestOutcome, type CameraAdapter, type CameraSourceTarget, type ConnectionTestResult, type DiscoveryResult, type MediaProfile, type SourceHandle } from '../types';
import { LOCAL_CAMERA_PROFILE, type CameraHelperEncoder } from './camera-helper-args';
import { createCameraHelpers, type CameraHelperLimits, type CameraHelpers } from './camera-helper';
import type { LocalSourceError } from './errors';
import type { HelperDoor, ProgramInspector } from './process-door';

export interface LocalCameraAdapterOptions {
  /** The registry ID row 136 allotted (the next free `CAM-NN`). */
  readonly id: string;
  readonly label?: string;
  /** The helper program: an absolute path from the configuration. */
  readonly program: string;
  readonly deviceName?: string;
  readonly encoder?: CameraHelperEncoder;
  readonly now: () => number;
  readonly timers: CaptureTimers;
  readonly limits?: Partial<CameraHelperLimits>;
  readonly door?: HelperDoor;
  readonly inspect?: ProgramInspector;
  /** Told once when the helper of the device ends during a session (the camera-loss path of the layer above). */
  readonly onSourceLost?: (deviceId: string, error: LocalSourceError) => void;
}

export interface LocalCameraAdapter extends CameraAdapter {
  /** Null when the device is in the list under exactly its name; else the named error. Opens no device. */
  presence(): Promise<LocalSourceError | null>;
  /** One short open, nothing pushed (HL-12). THE FIRST OPEN AFTER BOOT IS WHERE macOS ASKS THE USER. */
  precheck(signal: AbortSignal): Promise<LocalSourceError | null>;
  /** The devices whose helper lives now: the "is on" indicator of the clients (`sourceOpen`, SEC35-44 (4)). */
  openSources(): readonly string[];
  /** Stops every helper: the shutdown hook. */
  closeAll(): Promise<void>;
}

export function createLocalCameraAdapter(options: LocalCameraAdapterOptions): LocalCameraAdapter {
  const helpers: CameraHelpers = createCameraHelpers(options);
  const open = new Set<string>();
  const profiles = Object.freeze([LOCAL_CAMERA_PROFILE]);

  const served = (deviceId: string): void => {
    if (deviceId !== options.id) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };

  return {
    seam: 'CAMERA',
    kind: CaptureAdapterKind.LOCAL_DEVICE,
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
      open.add(deviceId);
      helper.onExit((error) => {
        open.delete(deviceId);
        options.onSourceLost?.(deviceId, error);
      });
      return Object.freeze({
        deviceId,
        async close(): Promise<void> {
          await helper.close();
          open.delete(deviceId);
        },
      });
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

    presence: () => helpers.presence(options.id),
    precheck: (signal) => helpers.precheck(options.id, signal),
    openSources: () => Object.freeze([...open]),
    closeAll: () => helpers.closeAll(),
  };
}
