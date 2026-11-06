/**
 * THE ONE RULE OF THE MOBILE APP FOR "THIS SESSION IS A RECORDING OF THE CORE'S OWN CAPTURE" (wave H
 * closing pass Z2; driver A's decision 8, note 120): the session payload carries the member
 * `captureDurable` (`captureFactsOf` of `@dems/shared/sim` holds the rule of the state). A durable
 * recording of the simulator's own capture carries none and keeps its demonstration values.
 *
 * Beside it, the readers of what such a Core states and nothing else:
 *
 * | Fact | Member | Rule |
 * |---|---|---|
 * | the durable fragment checkpoints | `session.captureCheckpoints?: { fragments, bytes, lastAt, cameras: [{ deviceId, fragments, bytes }] }` (closing pass Z1, request line 10:30:00Z) | OPTIONAL: absent in simulated capture, before the first checkpoint and on a session read back after a Core restart. ABSENT = NOTHING IS DRAWN, never a zero |
 * | the time source | the `time` slice; `hostClock: true` (`isHostClockTime`) = the host system clock | worded as the Core states it; never "GNSS" from a constant |
 *
 * The checkpoint member is read by name from the payload, so this file compiles and behaves the same
 * before and after the shared type carries it.
 */
import { captureFactsOf, useSim } from '@dems/shared/sim';

type CaptureSession = { readonly state: string; readonly captureDurable?: boolean };

/** True when `session` carries the capture member (the Core's own capture). False without a session. */
export function ownCaptureOf(session: CaptureSession | null | undefined): boolean {
  return captureFactsOf(session) !== null;
}

/** `ownCaptureOf` of the open session (a boolean: the selector's result compares by value). */
export function useOwnCapture(): boolean {
  return useSim((s) => ownCaptureOf(s.session));
}

export interface CaptureCheckpointCamera {
  readonly deviceId: string;
  readonly fragments: number;
  readonly bytes: number;
}

export interface CaptureCheckpointFacts {
  readonly fragments: number;
  readonly bytes: number;
  /** Epoch ms of the newest checkpoint (the Core's clock). */
  readonly lastAt: number;
  readonly cameras: readonly CaptureCheckpointCamera[];
}

const count = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** The stated checkpoint facts of a session payload, or null (absent, malformed, or no fragment yet). */
export function captureCheckpointsOf(session: unknown): CaptureCheckpointFacts | null {
  if (typeof session !== 'object' || session === null) return null;
  const member = (session as { captureCheckpoints?: unknown }).captureCheckpoints;
  if (typeof member !== 'object' || member === null) return null;
  const { fragments, bytes, lastAt, cameras } = member as Record<string, unknown>;
  if (!count(fragments) || fragments < 1 || !count(bytes) || !count(lastAt)) return null;
  const perCamera = (Array.isArray(cameras) ? cameras : []).flatMap((entry: unknown): CaptureCheckpointCamera[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const camera = entry as Record<string, unknown>;
    return typeof camera.deviceId === 'string' && count(camera.fragments) && count(camera.bytes) ? [{ deviceId: camera.deviceId, fragments: camera.fragments, bytes: camera.bytes }] : [];
  });
  return { fragments, bytes, lastAt, cameras: perCamera };
}

/** "last 2 s ago" below two minutes, "last 3 min ago" from there. Never negative (a Core clock ahead of the client's reads 0 s). */
export function checkpointAge(nowMs: number, lastAt: number): { unit: 'lastSeconds'; seconds: number } | { unit: 'lastMinutes'; minutes: number } {
  const seconds = Math.max(0, Math.floor((nowMs - lastAt) / 1000));
  return seconds < 120 ? { unit: 'lastSeconds', seconds } : { unit: 'lastMinutes', minutes: Math.floor(seconds / 60) };
}
