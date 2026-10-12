import { RoleReason } from '@/components/role-reason'
import { publishPlaybackPosition, usePlaybackSeekRequests } from './playback-link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Slider, Spinner } from '@heroui/react'
import { Pause, Play, RotateCcw, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Permission, selectCan, selectOperator, selectRole, useSim, useSimInstance } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { deferEffectStart } from '@/lib/effect-start'
import { useWebLive } from '@/runtime'
import { DevelopmentSourceBadge } from '@/features/devices/source-badge'
import { AudioSourceBand } from './audio-source-band'
import { VerifiedSourceBadge } from './development-source'
import { CAMERA_FILE_IDS, cameraFileOf, itemDevelopmentBadge, type CameraFileId, type ItemV2 } from './item-v2'
import { logEvidence, newCorrelationId } from './log'
import { cameraFilesOf, mediaSessionStale, openMediaSessions, probeMediaSession, type MediaProbeOutcome, type MediaSession, type MediaSessionRefusal } from './media-session'
import { bandDurationMs, bandSegments, clampSeek, formatMediaTime, needsResync, permissionGate, probeStartByte, type VerifiedSources } from './sealed-playback'
import { useRetryCooldown } from './use-retry-cooldown'

export interface SealedPlayerProps {
  evidenceId: string
  /** The recorded duration of the item, in ms. */
  durationMs: number
  item: ItemV2
  /** The source classes of the last verify run on this page, or null. */
  sources: VerifiedSources | null
  /** The fragments the last verify run on this page named as failed (operation 41), if any. */
  failedFragments?: readonly { readonly trackId: string; readonly seq: number }[]
  /** Set by the header's Play button; the player opens (or starts) once and reports it handled. */
  playToken: number | null
  onPlayHandled: () => void
  /**
   * Wave H C2: the camera files the Core says the package holds (`media.files` of operation 40, else
   * the VIDEO entries the item names; `item-facts.ts`). null / absent: not reported - both files
   * are asked for and the player shows what operation 88 opens.
   */
  fileIds?: readonly CameraFileId[] | null
  /** Wave H C2 (G81-07): `access.play` of operation 40. `false`: operation 88 is never asked; the player says "not permitted". */
  mayPlay?: boolean | null
  /** Wave K (G94b-09): the item says its recording was interrupted (`interruptedFactOf`): the player says so where the sealed prefix ends. */
  interrupted?: boolean
}

/** Wave K (G94b-02): a camera file the Core's media route refused by name - the fragment that does not authenticate. */
interface IntegrityStop {
  /** The file and the fragment as the Core named them. `seq: null`: the Core named no fragment. */
  readonly fileId: string
  readonly seq: number | null
  /** The media position of the player when the Core's answer was read. */
  readonly atMs: number
}
type IntegrityStops = Partial<Record<CameraFileId, IntegrityStop>>
const NO_STOPS: IntegrityStops = {}

/** A file that received no data, or waits for data, this long after it was started is asked about (wave K, G94b-02). */
export const STALL_CHECK_MS = 4_000

/** `HTMLMediaElement.HAVE_METADATA` / `HAVE_FUTURE_DATA`: the element holds metadata / data beyond its playhead. */
const HAVE_METADATA = 1
const HAVE_FUTURE_DATA = 3

type Sessions = Partial<Record<CameraFileId, MediaSession>>
type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'opening' }
  /** `stoppedAtMs`: playback stopped there and did not resume by itself; null while it runs. `renewing`: new sessions are being asked for. */
  | { readonly kind: 'ready'; readonly sessions: Sessions; readonly stoppedAtMs: number | null; readonly renewing: boolean; readonly stopCause?: StopCause }
  | { readonly kind: 'refused'; readonly refusal: MediaSessionRefusal }

/**
 * Why playback stopped and did not resume (wave H C2, G94-07). `SESSION_ENDED`: the media session was
 * at its end on the Core's clock when the request was refused - a state of the session, never worded
 * as an integrity failure. `UNKNOWN`: refused on a session that was still alive (the media element
 * cannot read why): the stop names its place and points to Verify.
 */
type StopCause = 'SESSION_ENDED' | 'UNKNOWN'

/** After a renewal the players go back to this place, and play again when they were playing. */
interface Resume {
  readonly seconds: number
  readonly play: boolean
}

/** A media error that comes back within this much media time of the last automatic renewal is not renewed again. */
const SAME_PLACE_MS = 1_500

const IDLE: Phase = { kind: 'idle' }

/** The end of what a media element has buffered, in ms; 0 when it holds nothing. Never throws. */
function bufferedEndMs(element: HTMLMediaElement | null): number {
  try {
    const ranges = element?.buffered
    if (!ranges || ranges.length === 0) return 0
    const end = ranges.end(ranges.length - 1)
    return Number.isFinite(end) && end > 0 ? end * 1000 : 0
  } catch {
    return 0
  }
}

/**
 * Wave M (G94d-01): what an element HOLDS - metadata or media data it RECEIVED. Never its clock: a seek
 * (and the re-alignment to the leading file) moves the clock of a file that never loaded.
 */
function holdsData(element: HTMLMediaElement | null): boolean {
  if (!element) return false
  return element.readyState >= HAVE_METADATA || bufferedEndMs(element) > 0
}

function setTime(element: HTMLMediaElement, seconds: number): void {
  try {
    element.currentTime = seconds
  } catch {
    // Not seekable yet (metadata still loading); the next time update re-aligns it.
  }
}

/** `onRefused`: the element did not start (the autoplay rule after an awaited renewal, a source it cannot play). R93-14: the caller takes the Pause state back. */
function playSafely(element: HTMLMediaElement | null, source: string, context: Record<string, unknown>, onRefused: () => void): void {
  if (!element) return
  try {
    const result = element.play() as Promise<void> | undefined
    if (result && typeof result.catch === 'function') {
      result.catch((error: unknown) => {
        // A pause during load rejects play(); that is not worth a record, and the pause set the state itself.
        if (error instanceof DOMException && error.name === 'AbortError') return
        logEvidence('warn', source, error, context)
        onRefused()
      })
    }
  } catch (error) {
    logEvidence('warn', source, error, context)
    onRefused()
  }
}

/** The roles the Core lets play sealed media (operation 88): the reason beside a refused player names them. */
const PLAY_ROLES = ['INVESTIGATOR', 'SUPERVISOR'] as const

/**
 * Playback of the sealed camera files of a schema-v2 item (blueprint row 92, M8-W3; UX spec flow 5;
 * R-3, R-4; WB-04): one HTML media element per camera file, fed by a signed media session of
 * operation 88 (Range streaming is the element's own), synchronised on the one audio timeline, with
 * the audio-source band under the scrub bar.
 *
 * - **Opening is a press.** Each session is a bearer URL and writes an audit row on the Core, so the
 *   console asks for it when the operator presses Play, never on mount. G7: "Checking your
 *   permissions..." until the role is known.
 * - **The URL** is the same-origin PATH of the media route. It goes from the session object straight
 *   to `element.src` in an effect and is removed from the element when the player closes. It is in
 *   no state that is logged, cached or stored (`media-session.ts`). A media error is recorded by
 *   its numeric code only — never `currentSrc`.
 * - **Two files, one clock.** Both files carry the same audio track (R-4): the first one leads and
 *   is audible, the second follows it muted and is re-aligned when it drifts. The playhead and the
 *   band follow the leading element's media clock; no timer drives them (flow 5 §6.7).
 * - **The session lives 60 s.** An answer in flight is not cut, but every new range request after
 *   the end is refused. So the player renews ON DEMAND, never on a timer: before a Play or a seek
 *   on a session that is at its end (the Core's clock, 5 s margin), and once after a media error —
 *   then it goes back to the same position and plays on if it was playing. A second error at the
 *   same place is not renewed again: playback stops there with its position.
 * - **A failed fragment is an integrity failure, not a player error.** A media element cannot
 *   read the body of the media route's 409, and operation 88 opens no fragment (R93-12): the
 *   player itself never learns WHICH fragment failed. When playback stopped and the last verify
 *   run of this page names a failed fragment of an open file, the player says "This recording
 *   failed its integrity check (Verify: <file> fragment <n>)" - what Verify found, not a claim
 *   about where playback stopped (R93-13). Without a verify run the stop names the position and
 *   points to Verify.
 * - **Wave K (G94b-02): a file that stalls is asked about.** In a browser the media element of a
 *   file whose stream the Core stopped reports nothing at all (no error, `readyState 0`): a black
 *   tile. So a file that gives no sign of life, or waits for data, for `STALL_CHECK_MS` - and a file
 *   that reports an error on a live session - is asked about through `probeMediaSession`, which CAN
 *   read the route's `409`. `FRAGMENT_NOT_AUTHENTIC` stops THAT file with the Core's naming of the
 *   file and the fragment ("This recording failed its integrity check at VIDEO-02 fragment 3."),
 *   takes its path off its element and keeps it stopped through every renewal; the other file plays
 *   on and leads (it carries the same audio track, R-4). Any other answer leaves the rules above.
 *   Wave L (G94c-01): the question does not wait for a connection to close (the console's own origin
 *   keeps a stopped stream open): it is a few small bounded range requests from what the element
 *   holds, and the sentence and the "Stopped" tile stay through the end of the other file.
 *   Wave M (G94d-01): the watch rests on DATA RECEIVED (the element's ready state and buffered ranges,
 *   its `loadedmetadata` / `canplay` / `playing`), never on its clock; a file that waits for data stays
 *   watched until it can play again; and when the leading file ENDS, a file that has delivered no data,
 *   or still waits, is asked about at once - the end does not wait for the watch.
 * - **One camera or two.** The files asked for are the ones the item names (`files[]` of 1 or 2).
 * - **States** (UX §6.5): `409 MEDIA_NOT_AVAILABLE` is a fixed message with no player; a refusal for
 *   the role says so; anything else goes to the shared presenter first and offers a rate-limited
 *   "Open again" (3 s, 6 s, 12 s; three tries).
 */
export function SealedPlayer({ evidenceId, durationMs, item, sources, failedFragments = [], playToken, onPlayHandled, fileIds = null, mayPlay = null, interrupted = false }: SealedPlayerProps) {
  const { t } = useTranslation()
  const live = useWebLive()
  const sim = useSimInstance()
  const presentCoreError = useCoreErrorPresenter()
  const retry = useRetryCooldown()
  const operatorKnown = useSim((s) => selectOperator(s) !== null)
  const canView = useSim((s) => selectCan(s, Permission.EVIDENCE_VIEW))
  // The Core's own word for this caller and this item wins over the role hint (a case scope is not a role).
  const gate = mayPlay === false ? 'REFUSED' : permissionGate({ operatorKnown, permitted: canView })
  // Wave J (JW-14): a role that plays in general but may not play THIS item (the Core's case scope) is not told "requires the role".
  const rolePlays = useSim((s) => { const role = selectRole(s); return role === 'INVESTIGATOR' || role === 'SUPERVISOR' })
  const [phase, setPhase] = useState<Phase>(IDLE)
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const videos = useRef<Partial<Record<CameraFileId, HTMLVideoElement | null>>>({})
  const resume = useRef<Resume | null>(null)
  const busy = useRef(false)
  /** The media position of the last AUTOMATIC renewal after an error; null: none since the last progress. */
  const renewedAtMs = useRef<number | null>(null)
  /** G94-08: the path was taken off the elements after a refused request; the next start asks for a new session first. */
  const detached = useRef(false)
  // Wave K (G94b-02): the files the Core's media route refused by name. They stay stopped through every renewal of this player.
  const [integrityStops, setIntegrityStops] = useState<IntegrityStops>(NO_STOPS)
  const stopsRef = useRef<IntegrityStops>(NO_STOPS)
  /** Files that showed no sign of life although the Core serves them (or could not be asked). */
  const [notLoaded, setNotLoaded] = useState<readonly CameraFileId[]>([])
  /** G94b-09: the leading file reached its end. */
  const [ended, setEnded] = useState(false)
  /** Files that RECEIVED data (metadata or media) since their path was put on. Never set from a clock. */
  const alive = useRef(new Set<CameraFileId>())
  /** Wave M (G94d-01): files whose element said it waits for data (`waiting` / `stalled`) and has not said since that it can play. */
  const waitingFor = useRef(new Set<CameraFileId>())
  const watches = useRef(new Map<CameraFileId, ReturnType<typeof setTimeout>>())
  const probing = useRef(new Set<CameraFileId>())
  /** The files a STALL was already asked about on the sessions that are open: one question per file and session (each is a request the Core records). */
  const stallAsked = useRef(new Set<CameraFileId>())
  const sessionsRef = useRef<Sessions | null>(null)
  const positionRef = useRef(0)
  const mounted = useRef(true)

  const segments = useMemo(() => bandSegments(item.audioIntervals, durationMs), [item.audioIntervals, durationMs])
  const totalMs = bandDurationMs(item.audioIntervals, durationMs)
  const totalSeconds = totalMs / 1000

  const sessions = phase.kind === 'ready' ? phase.sessions : null
  /** The camera files this item has: one or two. */
  const expected = useMemo(() => (fileIds !== null && fileIds.length > 0 ? fileIds : cameraFilesOf(item)), [fileIds, item])
  const opened = sessions === null ? [] : CAMERA_FILE_IDS.filter((fileId) => sessions[fileId] !== undefined)
  /** The open files that play: a file stopped at a fragment that does not authenticate is not one of them. */
  const playable = opened.filter((fileId) => integrityStops[fileId] === undefined)
  const leading = playable[0] ?? null
  // Fix wave J (JT-10 / JW-12): the transcript of this item follows the playback and a press on a segment seeks
  // (`playback-link.ts`). The position is published while a playback is open; a request before that opens it there.
  const linkPhase = phase.kind
  useEffect(() => {
    publishPlaybackPosition(evidenceId, linkPhase === 'ready' ? positionMs : null)
  }, [evidenceId, linkPhase, positionMs])
  // What the handlers that outlive a render (the stall watch, the Core's answer) read: kept after each commit.
  useEffect(() => {
    sessionsRef.current = sessions
    positionRef.current = positionMs
  })

  /** Asks for the sessions of both files. `then`: where the players go once the new URLs are on them. */
  const open = useCallback(
    async (then: Resume | null, renewal: boolean) => {
      if (live === null || busy.current) return
      busy.current = true
      setPhase((current) => (renewal && current.kind === 'ready' ? { ...current, renewing: true } : { kind: 'opening' }))
      const correlationId = newCorrelationId('media')
      let result: Awaited<ReturnType<typeof openMediaSessions>>
      try {
        result = await openMediaSessions(live, evidenceId, expected)
      } catch {
        // The client returns failures as values; a throw is a defect. The player is not latched by it (R93-21).
        result = { sessions: {}, failure: null }
      } finally {
        busy.current = false
      }
      if (Object.keys(result.sessions).length === 0) {
        const failure = result.failure
        const refusal = failure?.refusal ?? 'FAILED'
        // The presenter speaks first (an outage, a time-out, a 403); the page records the rest by its codes.
        if (refusal === 'FAILED' || refusal === 'NOT_PERMITTED') {
          if (failure?.failure == null || presentCoreError(failure.failure, { permission: Permission.EVIDENCE_VIEW }) === null) {
            logEvidence('warn', 'playback.openSession', null, { evidenceId, correlationId, status: failure?.status ?? null, code: failure?.code ?? 'NO_SESSION' })
          }
        }
        resume.current = null
        setPlaying(false)
        setPhase({ kind: 'refused', refusal })
        return
      }
      resume.current = then
      detached.current = false
      if (then === null) setPositionMs(0)
      if (!renewal) {
        // A fresh opening asks the Core again: nothing of the last one is carried over.
        stopsRef.current = NO_STOPS
        setIntegrityStops(NO_STOPS)
        setNotLoaded([])
      }
      setEnded(false)
      // The players are started by the effect that puts the new paths on them.
      if (then?.play === true) setPlaying(true)
      setPhase({ kind: 'ready', sessions: result.sessions, stoppedAtMs: null, renewing: false })
    },
    [evidenceId, expected, live, presentCoreError],
  )

  const pause = useCallback(() => {
    for (const fileId of CAMERA_FILE_IDS) videos.current[fileId]?.pause()
    setPlaying(false)
  }, [])

  const unwatch = (fileId: CameraFileId) => {
    const timer = watches.current.get(fileId)
    if (timer !== undefined) clearTimeout(timer)
    watches.current.delete(fileId)
  }

  /** Takes one file out of playback: its path comes off its element, so no byte of it is asked again. */
  const stopFile = (fileId: CameraFileId) => {
    unwatch(fileId)
    const element = videos.current[fileId]
    if (!element) return
    element.pause()
    element.removeAttribute('src')
    element.load()
  }

  /**
   * Wave K (G94b-02): asks the Core's media route about one open file (`probeMediaSession`). A
   * fragment that does not authenticate stops THAT file with the Core's own naming of it; the
   * other file plays on. Returns the outcome; null when nothing was asked.
   */
  const askCore = async (fileId: CameraFileId): Promise<MediaProbeOutcome | null> => {
    const session = sessionsRef.current?.[fileId]
    if (session === undefined || probing.current.has(fileId) || stopsRef.current[fileId] !== undefined) return null
    probing.current.add(fileId)
    const atMs = positionRef.current
    const file = cameraFileOf(item, fileId)
    // Wave L (G94c-01): the question starts from what the media element HOLDS - the end of what it buffered,
    // or the playhead when that is further - moved back three fragments; a file that never loaded is asked from its start.
    const heldMs = Math.max(atMs, bufferedEndMs(videos.current[fileId] ?? null))
    const startByte = alive.current.has(fileId) ? probeStartByte({ sizeBytes: file?.sizeBytes ?? 0, fragmentCount: file?.fragmentCount ?? 0, positionMs: heldMs, totalMs }) : 0
    const outcome = await probeMediaSession(session, { startByte })
    probing.current.delete(fileId)
    if (!mounted.current) return null
    if (outcome.kind === 'NOT_AUTHENTIC') {
      // The Core's codes only: the file, the fragment, the place. Never the path.
      logEvidence('warn', 'playback.integrityStop', null, { evidenceId, fileId, namedFile: outcome.fileId, seq: outcome.seq, positionMs: Math.round(atMs) })
      const next: IntegrityStops = { ...stopsRef.current, [fileId]: { fileId: outcome.fileId, seq: outcome.seq, atMs } }
      stopsRef.current = next
      stopFile(fileId)
      setIntegrityStops(next)
      setNotLoaded((current) => current.filter((entry) => entry !== fileId))
      // Nothing is left to play: the toggle goes back to Play.
      if (CAMERA_FILE_IDS.every((entry) => sessionsRef.current?.[entry] === undefined || next[entry] !== undefined)) setPlaying(false)
    } else if (!alive.current.has(fileId)) {
      logEvidence('warn', 'playback.notLoaded', null, { evidenceId, fileId, probe: outcome.kind, ...(outcome.kind === 'REFUSED' ? { status: outcome.status, reason: outcome.reason } : {}) })
      setNotLoaded((current) => (current.includes(fileId) ? current : [...current, fileId]))
    }
    return outcome
  }

  /** A file is settled when it received data and does not wait for more: only then its watch goes. */
  const settled = (fileId: CameraFileId): boolean => alive.current.has(fileId) && !waitingFor.current.has(fileId)

  const markAlive = (fileId: CameraFileId) => {
    if (alive.current.has(fileId)) return
    alive.current.add(fileId)
    setNotLoaded((current) => (current.includes(fileId) ? current.filter((entry) => entry !== fileId) : current))
  }

  /**
   * Wave M (G94d-01): reads what the element of one file HOLDS now. Data it received makes it alive;
   * data beyond its playhead ends its wait. Its clock is never read: a `timeupdate` of a file that
   * holds nothing (fired by the pause at the end of the other file, with the clock a seek put there)
   * changes nothing, and a `timeupdate` of a file that still waits does not end its watch.
   */
  const refresh = (fileId: CameraFileId) => {
    const element = videos.current[fileId] ?? null
    if (holdsData(element)) markAlive(fileId)
    if (element !== null && element.readyState >= HAVE_FUTURE_DATA) waitingFor.current.delete(fileId)
    if (settled(fileId)) unwatch(fileId)
  }

  /** The element's own word that data arrived: `loadedmetadata` (it may still wait for media data), `canplay` / `playing` (it does not wait). */
  const onReceived = (fileId: CameraFileId, canPlay: boolean) => {
    markAlive(fileId)
    if (canPlay) waitingFor.current.delete(fileId)
    if (settled(fileId)) unwatch(fileId)
  }

  /** One question per file and session (each is a request the Core records). */
  const askOnce = (fileId: CameraFileId) => {
    if (stallAsked.current.has(fileId)) return
    stallAsked.current.add(fileId)
    void askCore(fileId)
  }

  /** Starts the watch of one file: if it has still received nothing (or still waits) after `STALL_CHECK_MS`, the Core is asked. */
  const watch = (fileId: CameraFileId) => {
    if (stopsRef.current[fileId] !== undefined) return
    if (settled(fileId)) return
    // Wave L (G94c-01): a watch that runs keeps its time. A Play or a seek soon after the opening must not
    // push the question back - on a short recording the other file ended before it was ever asked.
    if (watches.current.has(fileId)) return
    watches.current.set(
      fileId,
      setTimeout(() => {
        watches.current.delete(fileId)
        refresh(fileId)
        if (!settled(fileId)) askOnce(fileId)
      }, STALL_CHECK_MS),
    )
  }

  /** The element of one file says it waits for data: it is watched until it says it can play again. */
  const onWaitingFor = (fileId: CameraFileId) => {
    waitingFor.current.add(fileId)
    watch(fileId)
  }

  /**
   * Wave M (G94d-01): the leading file ENDED. A file that has delivered no data by now, or still waits
   * for data, is asked about at once: on a short recording (or after a seek close to the end) the
   * end comes before the watch runs out, and the pause that follows says nothing about that file.
   */
  const askUnsettledAtEnd = (endedFile: CameraFileId) => {
    for (const fileId of playable) {
      if (fileId === endedFile || stopsRef.current[fileId] !== undefined) continue
      refresh(fileId)
      if (settled(fileId)) continue
      unwatch(fileId)
      askOnce(fileId)
    }
  }

  useEffect(() => {
    mounted.current = true
    const timers = watches.current
    return () => {
      mounted.current = false
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  /** Starts the elements that are open, the followers aligned to the leading one. Sets no state. */
  const startElements = () => {
    const lead = leading === null ? null : (videos.current[leading] ?? null)
    if (lead === null) return
    for (const fileId of playable) {
      if (stopsRef.current[fileId] !== undefined) continue
      const element = videos.current[fileId] ?? null
      if (element !== null && element !== lead && needsResync(lead.currentTime, element.currentTime, 0)) setTime(element, lead.currentTime)
      // R93-14: a LEADING element that does not start takes the Pause icon back; a follower that does not start is re-aligned by the next time update.
      playSafely(element, 'playback.play', { evidenceId, fileId }, () => {
        if (element === lead) setPlaying(false)
      })
      // Wave K: a file that was started and receives nothing is asked about.
      watch(fileId)
    }
  }
  const startPlayers = () => {
    setEnded(false)
    startElements()
    setPlaying(true)
  }

  /** True when a session is at its end on the Core's clock: a new request on it would be refused. */
  const stale = (): boolean => {
    const coreNow = sim.store.getState().clock.now
    return sessions !== null && opened.some((fileId) => mediaSessionStale(sessions[fileId] as MediaSession, coreNow))
  }

  /**
   * G94-08: takes the bearer path off every element at once. A refused request leaves a dead path
   * on the element; with no `src` the browser has nothing to ask again (and nothing to print again).
   */
  const detach = () => {
    detached.current = true
    for (const fileId of CAMERA_FILE_IDS) {
      const element = videos.current[fileId]
      if (!element) continue
      element.removeAttribute('src')
      element.load()
    }
  }

  const play = () => {
    // A session at its end, or elements without a path (after a refused request): a new session first.
    if (stale() || detached.current) {
      renewedAtMs.current = null
      void open({ seconds: positionMs / 1000, play: true }, true)
    } else startPlayers()
  }

  // The bearer path goes to the element here and is taken off it when the session or the player goes.
  useEffect(() => {
    if (sessions === null) return undefined
    const elements = videos.current
    const target = resume.current
    resume.current = null
    // The nodes themselves: at unmount the refs are already empty, and the path must still come off.
    const assigned: HTMLVideoElement[] = []
    alive.current = new Set()
    waitingFor.current = new Set()
    stallAsked.current = new Set()
    for (const fileId of CAMERA_FILE_IDS) {
      const element = elements[fileId]
      const session = sessions[fileId]
      // Wave K: a file the Core refused by name gets no path again.
      if (!element || !session || stopsRef.current[fileId] !== undefined) continue
      assigned.push(element)
      element.src = session.takeUrl()
      // Back to the same place on the new session (a no-op for a first open at 0).
      if (target !== null && target.seconds > 0) setTime(element, target.seconds)
      // Wave K (G94b-02): a file that never becomes ready says nothing by itself - it is watched from the moment it has a path.
      watch(fileId)
    }
    if (target?.play === true) startElements()
    return () => {
      for (const fileId of CAMERA_FILE_IDS) unwatch(fileId)
      for (const element of assigned) {
        element.pause()
        element.removeAttribute('src')
        element.load()
      }
    }
    // One assignment per set of sessions; `startElements` reads the elements of this render.
  }, [sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Header "Play": open the sessions first, or start the players that are open.
  // The start waits one task (the shared helper): StrictMode's simulated unmount cancels the first
  // start instead of asking the Core for the sessions twice.
  useEffect(() => {
    if (playToken === null) return undefined
    return deferEffectStart(() => {
      onPlayHandled()
      if (gate !== 'ALLOWED') return
      if (phase.kind === 'ready') play()
      else if (phase.kind === 'idle') void open({ seconds: 0, play: true }, false)
    })
  }, [playToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const onTimeUpdate = (fileId: CameraFileId) => {
    if (fileId !== leading) return
    const lead = videos.current[fileId]
    if (!lead) return
    const nowMs = Math.min(lead.currentTime * 1000, totalMs)
    setPositionMs(nowMs)
    positionRef.current = nowMs
    // G94-08: renew BEFORE the end while it plays, so no range request is ever sent on a dead session
    // (the browser prints the path of a refused request itself). Driven by the media clock, once per end.
    if (playing && !busy.current && !detached.current && stale()) {
      void open({ seconds: lead.currentTime, play: true }, true)
      return
    }
    // Playback moved on past the place of the last renewal: the next error may be renewed again.
    if (renewedAtMs.current !== null && nowMs - renewedAtMs.current > SAME_PLACE_MS) {
      renewedAtMs.current = null
      retry.reset()
    }
    for (const other of playable) {
      const element = videos.current[other]
      // R93-14: a follower that is still seeking (it buffers) is not seeked again on every time update.
      if (other !== fileId && element && !element.seeking && needsResync(lead.currentTime, element.currentTime)) setTime(element, lead.currentTime)
    }
  }

  const seekTo = (seconds: number) => {
    const target = clampSeek(seconds, totalSeconds)
    setPositionMs(target * 1000)
    setEnded(false)
    if (stale() || detached.current) {
      // The seek would be a new range request on a session at its end: renew first, then go there.
      void open({ seconds: target, play: playing }, true)
      return
    }
    for (const fileId of playable) {
      const element = videos.current[fileId]
      if (element) setTime(element, target)
    }
  }
  usePlaybackSeekRequests(evidenceId, (ms) => {
    if (gate !== 'ALLOWED') return
    if (linkPhase === 'ready') seekTo(ms / 1000)
    else void open({ seconds: ms / 1000, play: true }, false)
  })

  const onMediaError = (fileId: CameraFileId) => {
    // A file this player stopped itself holds no path: nothing it reports is a new fact.
    if (stopsRef.current[fileId] !== undefined) return
    const element = videos.current[fileId]
    // The numeric code of the element's error and nothing else: its message and its source are never read.
    logEvidence('warn', 'playback.mediaError', null, { evidenceId, fileId, mediaErrorCode: element?.error?.code ?? null, positionMs: Math.round(positionMs) })
    const wasPlaying = playing
    // G94-07: was the session at its end on the Core's clock when the request was refused?
    const sessionEnded = stale()
    // The session object the refused request was made on: the Core is asked about THAT one (its path is still alive).
    const session = sessions?.[fileId]
    pause()
    // G94-08: the dead path comes off the elements now; the renewal below (or the next press) puts a new one on.
    detach()
    const renewOrStop = () => {
      const samePlace = renewedAtMs.current !== null && Math.abs(positionMs - renewedAtMs.current) <= SAME_PLACE_MS
      if (!samePlace && !busy.current && retry.consume()) {
        // Once per place: a new session, the same position, and on with it.
        renewedAtMs.current = positionMs
        void open({ seconds: positionMs / 1000, play: wasPlaying }, true)
        return
      }
      setPhase((current) => (current.kind === 'ready' ? { ...current, stoppedAtMs: positionMs, renewing: false, stopCause: sessionEnded ? 'SESSION_ENDED' : 'UNKNOWN' } : current))
    }
    // A session at its end explains the refusal by itself (G94-07): nothing is asked on it.
    if (sessionEnded || session === undefined) {
      renewOrStop()
      return
    }
    // Wave K (G94b-02): the element cannot read WHY it was refused. The Core is asked, once, before anything is renewed.
    void askCore(fileId).then((outcome) => {
      if (!mounted.current) return
      if (outcome?.kind !== 'NOT_AUTHENTIC') {
        renewOrStop()
        return
      }
      // The refused file stays stopped. The other file gets a new session and goes on from the same place.
      const left = CAMERA_FILE_IDS.some((entry) => sessionsRef.current?.[entry] !== undefined && stopsRef.current[entry] === undefined)
      if (left && !busy.current) void open({ seconds: positionMs / 1000, play: wasPlaying }, true)
    })
  }

  const reopen = () => {
    if (!retry.consume()) return
    renewedAtMs.current = null
    void open(phase.kind === 'ready' ? { seconds: positionMs / 1000, play: false } : null, phase.kind === 'ready')
  }
  const reopenLabel = retry.exhausted
    ? t('evidence.playback.reopenExhausted')
    : retry.cooldownSeconds > 0
      ? t('evidence.playback.reopenIn', { seconds: retry.cooldownSeconds })
      : t('evidence.playback.reopen')
  const reopenButton = (
    <Button size="sm" variant="outline" onPress={reopen} isDisabled={!retry.canRetry} data-testid="evidence-playback-reopen">
      <RotateCcw className="size-4" aria-hidden="true" />
      {reopenLabel}
    </Button>
  )
  // R93-13: what the page's last Verify run found, said as that - not as the place where playback stopped.
  const integrityText = (place: { readonly fileId: string; readonly seq: number }): string => t('evidence.playback.integrityVerify', { file: place.fileId, seq: place.seq })

  if (phase.kind === 'refused') {
    const text = t(`evidence.playback.${phase.refusal === 'NOT_AVAILABLE' ? 'notAvailable' : phase.refusal === 'NOT_PERMITTED' ? 'notPermitted' : 'failed'}`)
    return (
      <div className="evi-sealed" data-testid="evidence-playback" data-phase="refused" data-refusal={phase.refusal}>
        <Alert status={phase.refusal === 'FAILED' ? 'danger' : 'warning'} role="alert" data-testid="evidence-playback-refused">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{text}</Alert.Title>
          </Alert.Content>
        </Alert>
        {phase.refusal === 'FAILED' ? <div>{reopenButton}</div> : null}
      </div>
    )
  }

  if (phase.kind !== 'ready') {
    const opening = phase.kind === 'opening'
    return (
      <div className="evi-sealed" data-testid="evidence-playback" data-phase={phase.kind} aria-busy={opening || undefined}>
        <span className="evi-strong">{t('evidence.playback.title')}</span>
        <p className="evi-caption" data-testid={gate === 'REFUSED' ? 'evidence-playback-not-permitted' : undefined}>
          {mayPlay === false ? t('evidence.itemFacts.media.mayNotPlay') : gate === 'REFUSED' ? t('evidence.playback.notPermitted') : t('evidence.playback.note')}
          {/* Fix wave J (JW-14): the disabled "Open playback" names the role that may play. */}
          {gate === 'REFUSED' && !rolePlays ? (
            <>
              {' '}
              <RoleReason permission={PLAY_ROLES} />
            </>
          ) : null}
        </p>
        <div>
          <Button variant="primary" onPress={() => void open(null, false)} isDisabled={gate !== 'ALLOWED' || opening} isPending={opening} data-testid="evidence-playback-open" data-gate={gate}>
            {opening ? <Spinner size="sm" color="current" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {gate === 'CHECKING' ? t('evidence.playback.checking') : opening ? t('evidence.playback.opening') : t('evidence.playback.open')}
          </Button>
        </div>
      </div>
    )
  }

  // A file the item HAS and that did not open; a package of one camera misses nothing.
  const missing = expected.find((fileId) => phase.sessions[fileId] === undefined) ?? null
  const stopped = phase.stoppedAtMs !== null
  // G94-07: a stop that is only the end of the media session: "Press Play to continue" (Play renews).
  const sessionEnded = stopped && phase.stopCause === 'SESSION_ENDED'
  // The fragment of an open file the last verify run of this page named as failed, if any.
  const verifiedFailure = stopped && !sessionEnded ? (failedFragments.find((fragment) => (opened as readonly string[]).includes(fragment.trackId)) ?? null) : null
  // Wave K (G94b-02): the files the Core's media route refused by name, in file order.
  const refusedFiles = opened.filter((fileId) => integrityStops[fileId] !== undefined)
  const nothingPlays = playable.length === 0
  // Wave K (G94b-07): the item's own mark (`developmentSources === true`, Live data only) where no verify result states a class per file.
  const developmentItem = itemDevelopmentBadge(item, live !== null)
  const trackName = (fileId: string): string => (fileId === 'VIDEO-01' || fileId === 'VIDEO-02' ? t(`common.tracks.${fileId}`) : fileId)
  return (
    <div className="evi-sealed" data-testid="evidence-playback" data-phase="ready" data-playing={playing ? 'true' : 'false'} data-files={opened.join(' ')} data-leading={leading ?? undefined} aria-busy={phase.renewing || undefined}>
      <div className="evi-sealed-stages" data-files={opened.length}>
        {opened.map((fileId) => {
          const track = sources?.state === 'DEVELOPMENT' ? sources.tracks.find((entry) => entry.trackId === fileId) : undefined
          const refused = integrityStops[fileId]
          const waitingForFile = refused === undefined && notLoaded.includes(fileId)
          return (
            <div key={fileId} className="evi-sealed-file" data-integrity={refused ? 'failed' : undefined} data-loaded={waitingForFile ? 'false' : undefined}>
              <div className="evi-player-caption">
                <span className="evi-player-camera">
                  <Video className="size-3.5" aria-hidden="true" />
                  {t('evidence.playback.file', { track: t(`common.tracks.${fileId}`) })}
                </span>
                {track ? (
                  <VerifiedSourceBadge sourceClass={track.sourceClass} kind="CAMERA" testId={`evidence-playback-development-${fileId}`} />
                ) : developmentItem && sources === null ? (
                  // G94b-07: the item says it was recorded from development sources; no verify run of this page has stated the class of each file yet.
                  <DevelopmentSourceBadge adapter={null} kind="CAMERA" testId={`evidence-playback-development-${fileId}`} />
                ) : null}
              </div>
              <div className="evi-player-stage">
                {refused ? (
                  <p className="evi-sealed-file-note" data-testid={`evidence-sealed-integrity-${fileId}`}>
                    {refused.seq === null ? t('web.player.fileStoppedNoPlace') : t('web.player.fileStopped', { seq: refused.seq })}
                  </p>
                ) : waitingForFile ? (
                  <p className="evi-sealed-file-note" role="status" data-testid={`evidence-sealed-not-loaded-${fileId}`}>
                    {t('web.player.notLoaded')}
                  </p>
                ) : null}
                <video
                  ref={(element) => {
                    videos.current[fileId] = element
                  }}
                  className="evi-player-video"
                  // Both files carry the one audio track (R-4): only the leading one is heard.
                  muted={fileId !== leading}
                  playsInline
                  preload="metadata"
                  data-testid={`evidence-sealed-video-${fileId}`}
                  data-sealed-file={fileId}
                  data-leading={fileId === leading ? 'true' : 'false'}
                  aria-label={t('evidence.media.videoLabel', { track: t(`common.tracks.${fileId}`) })}
                  onLoadedMetadata={() => onReceived(fileId, false)}
                  onCanPlay={() => onReceived(fileId, true)}
                  onPlaying={() => onReceived(fileId, true)}
                  onWaiting={() => onWaitingFor(fileId)}
                  onStalled={() => onWaitingFor(fileId)}
                  onProgress={() => refresh(fileId)}
                  onTimeUpdate={() => {
                    // Wave M (G94d-01): a `timeupdate` is read for what the element HOLDS, never for its clock (a seek moves the clock of a file that never loaded).
                    refresh(fileId)
                    onTimeUpdate(fileId)
                  }}
                  onEnded={
                    fileId === leading
                      ? () => {
                          // Before the pause: the files that delivered nothing, or still wait, are asked about now.
                          askUnsettledAtEnd(fileId)
                          pause()
                          setEnded(true)
                        }
                      : undefined
                  }
                  onError={() => onMediaError(fileId)}
                />
              </div>
            </div>
          )
        })}
      </div>
      {missing !== null ? (
        <p className="evi-caption" data-testid="evidence-playback-one-file">
          {t('evidence.playback.oneFile', { track: t(`common.tracks.${opened[0] ?? missing}`) })}
        </p>
      ) : null}
      {fileIds !== null && fileIds.length === 1 && missing === null ? (
        <p className="evi-caption" data-testid="evidence-playback-one-camera">
          {t('evidence.itemFacts.media.oneCamera', { track: fileIds[0] })}
        </p>
      ) : null}
      {refusedFiles.length > 0 ? (
        <Alert status="danger" role="alert" data-testid="evidence-playback-integrity" data-files={refusedFiles.join(' ')}>
          <Alert.Indicator />
          <Alert.Content>
            {refusedFiles.map((fileId) => {
              const refused = integrityStops[fileId] as IntegrityStop
              return (
                <Alert.Title key={fileId} data-testid={`evidence-playback-integrity-${fileId}`} data-seq={refused.seq ?? undefined}>
                  {refused.seq === null ? t('evidence.playback.integrityNoPlace') : t('evidence.playback.integrity', { file: refused.fileId, seq: refused.seq })}
                </Alert.Title>
              )
            })}
            <Alert.Description>
              {t('web.player.refusedByCore')}{' '}
              {nothingPlays ? t('web.player.nothingPlays') : t('web.player.otherPlays', { stopped: refusedFiles.map(trackName).join(', '), playing: playable.map(trackName).join(', ') })}{' '}
              {t('web.player.runVerify')}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {interrupted && ended ? (
        <p className="evi-caption" role="status" data-testid="evidence-playback-interrupted-end">
          {t('web.player.interruptedEnd', { at: formatMediaTime(positionMs) })}
        </p>
      ) : null}
      {phase.renewing ? (
        <p className="evi-caption" role="status" data-testid="evidence-playback-renewing">
          {t('evidence.playback.renewing')}
        </p>
      ) : null}
      {stopped ? (
        <Alert status={verifiedFailure ? 'danger' : 'warning'} role="alert" data-testid="evidence-playback-stopped" data-integrity={verifiedFailure ? 'true' : 'false'} data-cause={phase.stopCause ?? 'UNKNOWN'}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {sessionEnded
                ? t('evidence.itemFacts.playback.sessionEnded')
                : verifiedFailure
                  ? integrityText({ fileId: verifiedFailure.trackId, seq: verifiedFailure.seq })
                  : t('evidence.playback.stoppedAt', { at: formatMediaTime(phase.stoppedAtMs ?? 0) })}
            </Alert.Title>
            {verifiedFailure || sessionEnded ? null : <Alert.Description>{reopenButton}</Alert.Description>}
          </Alert.Content>
        </Alert>
      ) : null}

      <div className="evi-player-controls">
        <Button
          isIconOnly
          size="sm"
          variant="primary"
          isDisabled={(stopped && !sessionEnded) || phase.renewing || nothingPlays}
          aria-label={playing ? t('evidence.media.pause') : t('evidence.media.play')}
          onPress={() => (playing ? pause() : play())}
          data-testid="evidence-sealed-play-toggle"
        >
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        </Button>
        <span className="evi-mono evi-player-time" aria-live="off" data-testid="evidence-sealed-time">
          {formatMediaTime(positionMs)} / {formatMediaTime(totalMs)}
        </span>
        <Slider
          aria-label={t('evidence.media.scrub')}
          minValue={0}
          maxValue={Math.max(1, Math.floor(totalSeconds))}
          step={1}
          value={Math.floor(positionMs / 1000)}
          onChange={(value) => seekTo(Array.isArray(value) ? (value[0] ?? 0) : value)}
          className="evi-player-scrub"
          data-testid="evidence-sealed-scrub"
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
      </div>
      <AudioSourceBand segments={segments} totalMs={totalMs} positionMs={positionMs} sources={sources} developmentItem={developmentItem} />
      <p className="evi-caption">{t('evidence.playback.note')}</p>
    </div>
  )
}
