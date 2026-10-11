/**
 * THE DEVELOPMENT SOURCE RIG OF A LANE (fix wave M, driver M-S; final re-check 70 finding G70d-01,
 * ruling D232: "a development SOURCE RIG beside the seal rig ... that makes one generated source
 * fail its open through the adapter's own failure path"). Test support; not a test file, and no
 * file under `src/` can load it.
 *
 * WHAT IT IS FOR. Notification B - a configured camera or microphone that does not answer at the
 * pre-check - could not be driven on a lane: the test sources of development capture are GENERATED
 * on this machine (`src/capture/fence/generated-sources.ts`), they dial nothing, so a stored `FAKE`
 * camera whose address answers nothing passed every pre-check. This rig stands behind the capture
 * fence's development source switch (`CaptureFenceControl.installDevelopmentSourceSwitch`) and,
 * while its switch file names a device, makes THAT generated source answer as a source that is not
 * there - through the adapter's own two doors:
 *
 *   its reachability read   a camera's read is refused (`GeneratedSourceUnreachableError`): the
 *                           product's probe reads the cause `UNREACHABLE`; a microphone's entry of
 *                           the input list says `present: false`, `errorCode: DEVICE_NOT_FOUND`.
 *                           The product's OWN pre-check then does everything else: the device
 *                           reads not online, the check row warns or blocks by the start rule, the
 *                           one pre-check search runs, ONE alert and ONE `CAPTURE_DEVICE_UNREACHABLE`
 *                           row are written per occurrence (notification B);
 *   its open                a session start that names the device is refused the source, as for
 *                           any source that cannot be opened (the degraded start, or the failed
 *                           start when no camera is left).
 *
 * The rig opens nothing, lists nothing, starts nothing and ends nothing: a source that is open
 * already (a running recording) is not touched.
 *
 * GENERATED (FAKE) DEVICES ONLY. The switch is asked by the generated adapters alone, each for its
 * own device: this computer's camera and microphone (LOCAL_DEVICE) and a production source never
 * reach this code. A switch file that names a device the running registry does not serve as `FAKE`
 * changes nothing for that device, and one warn line says so (`LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE`).
 *
 * REFUSED IN PRODUCTION, TWICE. `prepareLaneSourceRig` asks the capture fence before anything else
 * and throws for REAL_PRODUCTION (the launcher ends in the boot's final line, check
 * `capture.sourceRig`, code `DEV_SOURCE_RIG_IN_PRODUCTION`): such a Core is not started. And the
 * fence itself refuses a source switch in every operation but REAL_DEVELOPMENT.
 *
 * THE SWITCH FILE (`scripts/lane/lane.sh source-rig <lane> ...` writes it; mode 0600):
 *     OFF                              or no file: the rig does nothing
 *     UNREACHABLE <deviceId> [...]     at most `LANE_SOURCE_RIG_MAX_DEVICES` registry IDs
 *                                      (`CAM-NN` / `MIC-NN`), each a generated source
 * Anything else reads as OFF, with one warn line. The file is read at every reachability read and
 * every open of a generated source, so `unreachable` and `release` take effect on the running lane
 * without a restart - at the next pre-check run or session start, never by themselves.
 *
 * The rig holds no credential and reads none; the file holds a word and registry IDs.
 */
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { CaptureAdapterKind, CaptureOperation } from '../../src/capture/adapters';
import { captureFenceControl, captureOperationOf } from '../../src/capture/fence';
import { describeError } from '../../src/plugins/logger';

const SOURCE = 'laneSourceRig';
/** The boot check a refusal is named with in the launcher's final line. */
export const LANE_SOURCE_RIG_CHECK = 'capture.sourceRig';
export const LANE_SOURCE_RIG_IN_PRODUCTION = 'DEV_SOURCE_RIG_IN_PRODUCTION';
/** The word of the switch file. */
export const LANE_SOURCE_RIG_WORD = 'UNREACHABLE';
/** How many devices one switch may name: the four slots of the selector. */
export const LANE_SOURCE_RIG_MAX_DEVICES = 4;

export class LaneSourceRigError extends Error {
  readonly code = LANE_SOURCE_RIG_IN_PRODUCTION;
  constructor() {
    super('a development source rig is never started on a production capture configuration');
    this.name = 'LaneSourceRigError';
  }
}

/** A registry ID of a camera or a microphone. Nothing else is a device of the switch. */
const DEVICE_ID = /^(?:CAM|MIC)-\d{2,3}$/;

/** The devices a file text names. Empty: OFF. `unknown: true`: text that is no switch (read as OFF). */
export function laneSourceRigSwitchOf(text: string): { readonly devices: readonly string[]; readonly unknown: boolean } {
  const off = { devices: Object.freeze([]) as readonly string[], unknown: false };
  const words = text.trim().split(/\s+/).filter((word) => word !== '');
  if (words.length === 0 || (words.length === 1 && words[0] === 'OFF')) return off;
  const devices = words.slice(1);
  if (words[0] !== LANE_SOURCE_RIG_WORD || devices.length === 0 || devices.length > LANE_SOURCE_RIG_MAX_DEVICES || !devices.every((device) => DEVICE_ID.test(device))) return { ...off, unknown: true };
  return { devices: Object.freeze([...new Set(devices)]), unknown: false };
}

export interface LaneSourceRigPorts {
  /** The text of the switch file, or null when there is none. */
  readonly read: () => string | null;
  /**
   * The devices the running registry serves through a GENERATED (`FAKE`) camera or microphone
   * adapter; null while there is no registry yet (before the boot step of the fence).
   */
  readonly generated: () => readonly string[] | null;
  readonly report: (level: 'warn' | 'error', code: string, message: string, context: Record<string, string | null>, error?: unknown) => void;
}

/**
 * THE RULE, without a file system or an app: whether a generated source is switched unreachable
 * now. Asked by the generated adapter of `deviceId` itself, at each read and each open. Never
 * throws: a switch that cannot be read switches nothing.
 */
export function createLaneSourceRig(ports: LaneSourceRigPorts): { unreachable(deviceId: string): boolean } {
  const said = new Set<string>();
  const once = (key: string, tell: () => void): void => {
    if (said.has(key)) return;
    said.add(key);
    tell();
  };
  return {
    unreachable(deviceId) {
      let text: string | null;
      try {
        text = ports.read();
      } catch (error) {
        once('unreadable', () => ports.report('error', 'LANE_SOURCE_RIG_UNREADABLE', 'the switch file of the source rig could not be read: the rig does nothing', {}, error));
        return false;
      }
      if (text === null) {
        said.clear();
        return false;
      }
      const parsed = laneSourceRigSwitchOf(text);
      if (parsed.unknown) once(`unknown:${text}`, () => ports.report('warn', 'LANE_SOURCE_RIG_SWITCH_UNKNOWN', 'the switch file of the source rig names no switch: the rig does nothing (OFF, or UNREACHABLE and up to four CAM-NN / MIC-NN)', {}));
      if (parsed.devices.length === 0) {
        // Released: the next arming is said again.
        if (!parsed.unknown) said.clear();
        return false;
      }
      // A device of the switch that is no generated source of this Core is never touched: said once per device.
      const generated = ports.generated();
      if (generated !== null) {
        for (const named of parsed.devices) {
          if (!generated.includes(named)) once(`not-fake:${named}`, () => ports.report('warn', 'LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE', 'the source rig names a device that is no generated (FAKE) test source of this Core: it is NOT touched', { deviceId: named }));
        }
      }
      if (!parsed.devices.includes(deviceId)) return false;
      once(`on:${deviceId}`, () => ports.report('warn', 'LANE_SOURCE_RIG_ON', 'the source rig makes this generated test source answer as unreachable, on purpose', { deviceId }));
      return true;
    },
  };
}

export interface LaneSourceRig {
  /** The operation the fence answered. */
  readonly operation: string;
  /** False on a SIMULATED lane (no generated source exists there) and without a switch file path. */
  readonly admitted: boolean;
  /** Hands the switch to the fence. AFTER `app.ready()` (the fence is mounted by then); before or after the boot. */
  install(): void;
}

/**
 * Asks the fence. REAL_PRODUCTION: throws `LaneSourceRigError` - call it BEFORE `app.ready()` so
 * that such a Core is not started at all. SIMULATED, or no file: an inert rig and one line that
 * says so.
 */
export function prepareLaneSourceRig(app: FastifyInstance, switchFile: string | null): LaneSourceRig {
  const operation = captureOperationOf(app.config);
  if (operation === CaptureOperation.REAL_PRODUCTION) throw new LaneSourceRigError();
  if (switchFile === null) return { operation, admitted: false, install: () => undefined };
  if (operation !== CaptureOperation.REAL_DEVELOPMENT) {
    return { operation, admitted: false, install: () => app.log.warn({ code: 'LANE_SOURCE_RIG_IGNORED', source: SOURCE, operation }, 'the source rig was asked for a Core that has no generated test source (simulated capture): it is not installed') };
  }
  return {
    operation,
    admitted: true,
    install() {
      const fence = captureFenceControl(app);
      const rig = createLaneSourceRig({
        read: () => {
          try {
            return readFileSync(switchFile, 'utf8');
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw error;
          }
        },
        generated: () =>
          fence
            .registry()
            ?.list()
            .filter((device) => device.adapterKind === CaptureAdapterKind.FAKE && (device.deviceClass === 'CAMERA' || device.deviceClass === 'MIC'))
            .map((device) => device.id) ?? null,
        report: (level, code, message, context, error) => {
          if (level === 'error') app.log.error({ err: error, code, source: SOURCE, ...context }, message);
          else app.log.warn({ code, source: SOURCE, ...context }, message);
          app.errorLog.append({ level, source: SOURCE, message, ...(error === undefined ? {} : describeError(error)), code, context });
        },
      });
      fence.installDevelopmentSourceSwitch((deviceId) => rig.unreachable(deviceId));
      app.log.info({ code: 'LANE_SOURCE_RIG_INSTALLED', source: SOURCE, operation }, 'the development source rig is installed and OFF until its switch file says otherwise');
    },
  };
}
