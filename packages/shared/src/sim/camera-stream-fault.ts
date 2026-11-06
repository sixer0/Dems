/**
 * A LOST CAMERA IS SAID TO BE LOST (task 4 row V7; finding E-01 of review 60e, Q-01 / Q-05 of 60d;
 * decisions C113, C115; the trace is `implementation/e1_slice_stream_state.md`).
 *
 * The slices every client reads (`captureDevices`, `captureConfig`) state a camera's stream with the
 * closed set `LIVE | LOST`. Until this row they changed through telemetry alone: a capture fault
 * about a camera's STREAM was raised (the alert, the audit entry) and both lines kept saying `LIVE` -
 * on a real Core for as long as the worker's ingest stayed connected, which it does while the relay
 * re-opens its camera. The Core itself published "live" for a camera it had just declared lost.
 *
 * THE RULE, in the same unit as the fault (so the revision that carries the alert carries the line):
 *
 *   raise   a `CAPTURE_FAULT` of the STREAM FAMILY (`CAMERA_STREAM_FAULT_REASONS`) keyed by a camera
 *           device  ->  `streamState: LOST` on that device's registry entry and on every selector
 *           line that names it;
 *   clear   the LAST active fault of the family on that camera is cleared  ->  `LIVE` again, on a
 *           device the Core holds as online. A device that is NOT online stays `LOST`: the fault was
 *           not the only statement about it (telemetry said its ingest waits), and telemetry is what
 *           says it is back;
 *   between telemetry never says `LIVE` over an active fault of the family (`applyCaptureTelemetry`
 *           asks `cameraStreamFaultActive`): the ingest of a relay that is re-opening its camera
 *           stays CONNECTED, and the next frame would otherwise undo the raise within a second.
 *
 * `online` is NOT touched: it is the registry flag of the device (finding JW-23), not a reading.
 *
 * THE FAMILY is the reasons that say "this camera delivers no stream to the recording": the stream
 * ended (`CAMERA_STREAM_ENDED`: the relay's loss report, row R1, and the camera watch's presence
 * fault), it never connected (`CAMERA_NOT_CONNECTED`), it connected and sent no picture
 * (`CAMERA_NO_PICTURE`). NOT in it: the two integrity refusals of the ingest gate
 * (`CAMERA_ANNOUNCE_NOT_MATCHED`, `CAMERA_ANNOUNCE_NOT_SEEN` - what was refused is a connection, and
 * whose it was is exactly what is not known), the clock reasons, and a `CAPTURE_FAULT` with no
 * reason. THE SIMULATOR raises no fault of this family itself (its own camera loss is the kind
 * `CAMERA_LOSS`, which moves the lines through its own telemetry): its behaviour is unchanged.
 *
 * ONE CONSEQUENCE, STATED: `LOST` is the condition under which a camera's PoE power cycle is legal
 * (task-3 rule OD-22; operation 48). A real camera that lost its stream therefore reads as a camera
 * an operator may power-cycle - which is what `LOST` has always meant. See the record of row V7 for
 * what the Core's operation 48 does with it today.
 *
 * AN IDLE CAMERA IS NOT READ (task 4 row V7c; decision C126 (b)): the selector line's member is
 * NULLABLE now, as the registry entry's always was, and NULL says "the Core reads no stream of this
 * camera". A REGISTERED camera (an entry with an `adapter`: operation 96 / an adoption) states NULL
 * at rest; `LIVE` only while a stream is read. What the engine knows of a read is the capture
 * ingest of an open session: telemetry `CONNECTED` (`capture-telemetry.ts` `cameraOfIngest`). Row
 * V7d (C141): a check that reached the camera (`capture-notices.ts` `withDeviceOnline`) read its
 * control service, not its stream - it says NOT READ, never `LIVE`, for a registered camera. So the clear
 * above restores `LIVE` for an online registered camera only while the session RECORDS (the state
 * in which the engine holds an ended ingest as a loss, `cameraOfIngest`) and NULL otherwise - the
 * next `CONNECTED` frame of a reading ingest says `LIVE` again. THE TWO BUILT-IN CAMERAS of the
 * demonstration model (no `adapter` member) keep the model's value: the clear restores `LIVE` for
 * them as before, and the simulator's behaviour is unchanged.
 */
import { SessionState } from '../domain';
import type { CaptureDeviceStatus, SimState } from './types';
import { CaptureStreamState, FaultKind } from './vocabulary';

/**
 * True for a camera whose stream state is NULL at rest (task 4 row V7c): a REGISTERED camera - its
 * registry entry carries the `adapter` the registration fixed. False for the two built-in cameras of
 * the demonstration model (their entries carry no `adapter`; the Core's row mapping tells them by id,
 * `rows.ts` `BUILT_IN_CAPABILITIES`), whose `LIVE` / `LOST` is the model's, and for any other device.
 */
export function cameraNotReadAtRest(device: Pick<CaptureDeviceStatus, 'kind' | 'adapter'>): boolean {
  return device.kind === 'CAMERA' && device.adapter !== undefined;
}

/** The reasons of a capture fault that say a camera delivers no stream to the recording (see the header). */
export const CAMERA_STREAM_FAULT_REASONS: readonly string[] = ['CAMERA_STREAM_ENDED', 'CAMERA_NOT_CONNECTED', 'CAMERA_NO_PICTURE'];

type ActiveFault = SimState['faults']['active'][number];

const ofFamily = (fault: ActiveFault): boolean => fault.kind === FaultKind.CAPTURE_FAULT && fault.target !== null && fault.reason !== undefined && CAMERA_STREAM_FAULT_REASONS.includes(fault.reason);

/** True while a fault of the stream family is active for the capture device `deviceId`. */
export function cameraStreamFaultActive(state: Pick<SimState, 'faults'>, deviceId: string): boolean {
  return state.faults.active.some((fault) => fault.target === deviceId && ofFamily(fault));
}

/** The state in which the camera `deviceId` and every selector line that names it state `streamState`; the SAME state when they already do. */
function withStreamState(state: SimState, deviceId: string, streamState: CaptureStreamState | null): SimState {
  const devices = state.captureDevices.devices;
  const cameras = state.captureConfig.cameras;
  const staleDevice = devices.some((device) => device.id === deviceId && device.streamState !== streamState);
  const staleLine = cameras.some((camera) => camera.deviceId === deviceId && camera.streamState !== streamState);
  if (!staleDevice && !staleLine) return state;
  return {
    ...state,
    ...(staleDevice ? { captureDevices: { ...state.captureDevices, devices: devices.map((device) => (device.id === deviceId ? { ...device, streamState } : device)) } } : {}),
    ...(staleLine ? { captureConfig: { ...state.captureConfig, cameras: cameras.map((camera) => (camera.deviceId === deviceId ? { ...camera, streamState } : camera)) } } : {}),
  };
}

/**
 * The lines after a change of the fault list: `before` is the state the raise or the clear began
 * with, `after` what it made. Every camera with an active fault of the family in `after` states
 * `LOST`; every camera that had one in `before` and has none in `after` states `LIVE` again when
 * the Core holds it as online. The SAME `after` when no camera is concerned - every raise and clear
 * of another kind, of another reason, of a microphone, of the capture as a whole.
 */
export function cameraStreamStateAfterFaults(before: SimState, after: SimState): SimState {
  if (before.faults === after.faults) return after;
  let next = after;
  const concerned = new Set<string>();
  for (const fault of [...before.faults.active, ...after.faults.active]) if (ofFamily(fault) && fault.target !== null) concerned.add(fault.target);
  for (const deviceId of concerned) {
    const device = next.captureDevices.devices.find((candidate) => candidate.id === deviceId);
    if (device === undefined || device.kind !== 'CAMERA') continue;
    if (cameraStreamFaultActive(after, deviceId)) next = withStreamState(next, deviceId, CaptureStreamState.LOST);
    else if (device.online) {
      // Row V7c: a registered camera is said LIVE again only while the session records (its stream is read); else NOT READ.
      const read = !cameraNotReadAtRest(device) || after.session?.state === SessionState.RECORDING;
      next = withStreamState(next, deviceId, read ? CaptureStreamState.LIVE : null);
    }
  }
  return next;
}
