/**
 * A CORE IN ITS OWN CAPTURE STATES NO BITRATE OF A CAMERA (task 4 wave 12, row CB; review finding
 * R-01 of `060c`; decision C36: a default is never shown as a measured fact).
 *
 * `cameras[].bitrateMbps` has ONE writer of a number in the two trees: the simulator's initial
 * state, the literal 9 (`packages/shared/src/sim/initial-state.ts`). It is a figure of the
 * simulated device. On a Core in real capture no source states a bitrate - the stored stream
 * statement names a picture, a rate and a codec, the relay and the worker report none, no
 * telemetry writes the member - and yet the committed slice, and with it the state stream and
 * operation 47, served that 9 beside a real camera.
 *
 * The contract's member is nullable since integration pass I-9b: null = "no telemetry states a
 * bitrate for the track. Never a default". This transition says so in the state itself. The host
 * applies it at EVERY start of a Core in its own capture (boot, reset, reload, resync), beside the
 * host-clock, platform and updater statements, before anything reads the state - so a seed, a
 * reset or a state stored before this rule never reaches a reader with the number.
 *
 * A Core in capture mode `simulated` is never handed to it: the simulator keeps its own value.
 * The day a real source states a bitrate, its writer is a fact door of its own, and this
 * transition stays the statement of "none yet" at a start.
 *
 * Pure and local, like the transitions of `sealing-notice-doors.ts`: the simulator has no real
 * camera, so there is nothing for it to agree with. The SAME state when every track already says
 * null (no write, no statement, no revision).
 */
import type { SimState } from '@dems/shared/sim';

/** True when no track of the slice states a bitrate. */
export function isCameraBitrateNotStated(cameras: SimState['cameras']): boolean {
  return cameras.every((camera) => camera.bitrateMbps === null);
}

/** Every track says "no bitrate stated" (null). The same state when it already does. */
export function cameraBitrateNotStatedTransition(state: SimState): SimState {
  if (isCameraBitrateNotStated(state.cameras)) return state;
  return { ...state, cameras: state.cameras.map((camera) => (camera.bitrateMbps === null ? camera : { ...camera, bitrateMbps: null })) };
}
