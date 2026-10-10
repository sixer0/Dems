/**
 * THE CAPTURE CHECKPOINT FACTS of a recording of the Core's own capture (wave H closing pass Z2;
 * driver A's decision 3, ruling D203 (3); member names by closing pass Z1, request line 10:30:00Z):
 *
 *   session.captureCheckpoints?: { fragments, bytes, lastAt, cameras: [{ deviceId, fragments, bytes }] }
 *
 * `fragments` / `bytes`: the durable fragment checkpoints and the stored bytes they cover (plaintext
 * on the evidence volume until the seal); `lastAt`: the Core's clock at the newest checkpoint. The
 * member is OPTIONAL: absent in simulated capture, before the first checkpoint and on a session read
 * back after a Core restart. ABSENT = NOTHING IS DRAWN, never a zero.
 *
 * The reader is defensive (`captureCheckpointsOf`): the member is read by name from the payload, so
 * this module compiles and behaves the same before and after the shared type carries it.
 */
export interface CaptureCheckpointCamera {
  readonly deviceId: string
  readonly fragments: number
  readonly bytes: number
}

export interface CaptureCheckpointFacts {
  readonly fragments: number
  readonly bytes: number
  /** Epoch ms of the newest checkpoint (the Core's clock). */
  readonly lastAt: number
  readonly cameras: readonly CaptureCheckpointCamera[]
}

const count = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

/** The stated checkpoint facts of a session payload, or null (absent, malformed, or no fragment yet). */
export function captureCheckpointsOf(session: unknown): CaptureCheckpointFacts | null {
  if (typeof session !== 'object' || session === null) return null
  const member = (session as { captureCheckpoints?: unknown }).captureCheckpoints
  if (typeof member !== 'object' || member === null) return null
  const { fragments, bytes, lastAt, cameras } = member as Record<string, unknown>
  if (!count(fragments) || fragments < 1 || !count(bytes) || !count(lastAt)) return null
  const perCamera = (Array.isArray(cameras) ? cameras : []).flatMap((entry: unknown): CaptureCheckpointCamera[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const camera = entry as Record<string, unknown>
    return typeof camera.deviceId === 'string' && count(camera.fragments) && count(camera.bytes) ? [{ deviceId: camera.deviceId, fragments: camera.fragments, bytes: camera.bytes }] : []
  })
  return { fragments, bytes, lastAt, cameras: perCamera }
}

/** "last 2 s ago" below two minutes, "last 3 min ago" from there. Never negative (a Core clock ahead of the console's reads 0 s). */
export function checkpointAge(nowMs: number, lastAt: number): { unit: 'lastSeconds'; seconds: number } | { unit: 'lastMinutes'; minutes: number } {
  const seconds = Math.max(0, Math.floor((nowMs - lastAt) / 1000))
  return seconds < 120 ? { unit: 'lastSeconds', seconds } : { unit: 'lastMinutes', minutes: Math.floor(seconds / 60) }
}
