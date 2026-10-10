import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Slider, Spinner } from '@heroui/react'
import { Pause, Play, RotateCcw, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Permission, selectCan, selectOperator, useSim, useSimInstance } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { deferEffectStart } from '@/lib/effect-start'
import { useWebLive } from '@/runtime'
import { AudioSourceBand } from './audio-source-band'
import { VerifiedSourceBadge } from './development-source'
import { CAMERA_FILE_IDS, type CameraFileId, type ItemV2 } from './item-v2'
import { logEvidence, newCorrelationId } from './log'
import { cameraFilesOf, mediaSessionStale, openMediaSessions, type MediaSession, type MediaSessionRefusal } from './media-session'
import { bandDurationMs, bandSegments, clampSeek, formatMediaTime, needsResync, permissionGate, type VerifiedSources } from './sealed-playback'
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
}

type Sessions = Partial<Record<CameraFileId, MediaSession>>
type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'opening' }
  /** `stoppedAtMs`: playback stopped there and did not resume by itself; null while it runs. `renewing`: new sessions are being asked for. */
  | { readonly kind: 'ready'; readonly sessions: Sessions; readonly stoppedAtMs: number | null; readonly renewing: boolean }
  | { readonly kind: 'refused'; readonly refusal: MediaSessionRefusal }

/** After a renewal the players go back to this place, and play again when they were playing. */
interface Resume {
  readonly seconds: number
  readonly play: boolean
}

/** A media error that comes back within this much media time of the last automatic renewal is not renewed again. */
const SAME_PLACE_MS = 1_500

const IDLE: Phase = { kind: 'idle' }

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
 * - **One camera or two.** The files asked for are the ones the item names (`files[]` of 1 or 2).
 * - **States** (UX §6.5): `409 MEDIA_NOT_AVAILABLE` is a fixed message with no player; a refusal for
 *   the role says so; anything else goes to the shared presenter first and offers a rate-limited
 *   "Open again" (3 s, 6 s, 12 s; three tries).
 */
export function SealedPlayer({ evidenceId, durationMs, item, sources, failedFragments = [], playToken, onPlayHandled }: SealedPlayerProps) {
  const { t } = useTranslation()
  const live = useWebLive()
  const sim = useSimInstance()
  const presentCoreError = useCoreErrorPresenter()
  const retry = useRetryCooldown()
  const operatorKnown = useSim((s) => selectOperator(s) !== null)
  const canView = useSim((s) => selectCan(s, Permission.EVIDENCE_VIEW))
  const gate = permissionGate({ operatorKnown, permitted: canView })
  const [phase, setPhase] = useState<Phase>(IDLE)
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const videos = useRef<Partial<Record<CameraFileId, HTMLVideoElement | null>>>({})
  const resume = useRef<Resume | null>(null)
  const busy = useRef(false)
  /** The media position of the last AUTOMATIC renewal after an error; null: none since the last progress. */
  const renewedAtMs = useRef<number | null>(null)

  const segments = useMemo(() => bandSegments(item.audioIntervals, durationMs), [item.audioIntervals, durationMs])
  const totalMs = bandDurationMs(item.audioIntervals, durationMs)
  const totalSeconds = totalMs / 1000

  const sessions = phase.kind === 'ready' ? phase.sessions : null
  /** The camera files this item has: one or two. */
  const expected = useMemo(() => cameraFilesOf(item), [item])
  const opened = sessions === null ? [] : CAMERA_FILE_IDS.filter((fileId) => sessions[fileId] !== undefined)
  const leading = opened[0] ?? null

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
      if (then === null) setPositionMs(0)
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

  /** Starts the elements that are open, the followers aligned to the leading one. Sets no state. */
  const startElements = () => {
    const lead = leading === null ? null : (videos.current[leading] ?? null)
    if (lead === null) return
    for (const fileId of opened) {
      const element = videos.current[fileId] ?? null
      if (element !== null && element !== lead && needsResync(lead.currentTime, element.currentTime, 0)) setTime(element, lead.currentTime)
      // R93-14: a LEADING element that does not start takes the Pause icon back; a follower that does not start is re-aligned by the next time update.
      playSafely(element, 'playback.play', { evidenceId, fileId }, () => {
        if (element === lead) setPlaying(false)
      })
    }
  }
  const startPlayers = () => {
    startElements()
    setPlaying(true)
  }

  /** True when a session is at its end on the Core's clock: a new request on it would be refused. */
  const stale = (): boolean => {
    const coreNow = sim.store.getState().clock.now
    return sessions !== null && opened.some((fileId) => mediaSessionStale(sessions[fileId] as MediaSession, coreNow))
  }

  const play = () => {
    if (stale()) void open({ seconds: positionMs / 1000, play: true }, true)
    else startPlayers()
  }

  // The bearer path goes to the element here and is taken off it when the session or the player goes.
  useEffect(() => {
    if (sessions === null) return undefined
    const elements = videos.current
    const target = resume.current
    resume.current = null
    // The nodes themselves: at unmount the refs are already empty, and the path must still come off.
    const assigned: HTMLVideoElement[] = []
    for (const fileId of CAMERA_FILE_IDS) {
      const element = elements[fileId]
      const session = sessions[fileId]
      if (!element || !session) continue
      assigned.push(element)
      element.src = session.takeUrl()
      // Back to the same place on the new session (a no-op for a first open at 0).
      if (target !== null && target.seconds > 0) setTime(element, target.seconds)
    }
    if (target?.play === true) startElements()
    return () => {
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
    // Playback moved on past the place of the last renewal: the next error may be renewed again.
    if (renewedAtMs.current !== null && nowMs - renewedAtMs.current > SAME_PLACE_MS) {
      renewedAtMs.current = null
      retry.reset()
    }
    for (const other of opened) {
      const element = videos.current[other]
      // R93-14: a follower that is still seeking (it buffers) is not seeked again on every time update.
      if (other !== fileId && element && !element.seeking && needsResync(lead.currentTime, element.currentTime)) setTime(element, lead.currentTime)
    }
  }

  const seekTo = (seconds: number) => {
    const target = clampSeek(seconds, totalSeconds)
    setPositionMs(target * 1000)
    if (stale()) {
      // The seek would be a new range request on a session at its end: renew first, then go there.
      void open({ seconds: target, play: playing }, true)
      return
    }
    for (const fileId of opened) {
      const element = videos.current[fileId]
      if (element) setTime(element, target)
    }
  }

  const onMediaError = (fileId: CameraFileId) => {
    const element = videos.current[fileId]
    // The numeric code of the element's error and nothing else: its message and its source are never read.
    logEvidence('warn', 'playback.mediaError', null, { evidenceId, fileId, mediaErrorCode: element?.error?.code ?? null, positionMs: Math.round(positionMs) })
    const wasPlaying = playing
    pause()
    const samePlace = renewedAtMs.current !== null && Math.abs(positionMs - renewedAtMs.current) <= SAME_PLACE_MS
    if (!samePlace && !busy.current && retry.consume()) {
      // Once per place: a new session, the same position, and on with it.
      renewedAtMs.current = positionMs
      void open({ seconds: positionMs / 1000, play: wasPlaying }, true)
      return
    }
    setPhase((current) => (current.kind === 'ready' ? { ...current, stoppedAtMs: positionMs, renewing: false } : current))
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
        <p className="evi-caption">{gate === 'REFUSED' ? t('evidence.playback.notPermitted') : t('evidence.playback.note')}</p>
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
  // The fragment of an open file the last verify run of this page named as failed, if any.
  const verifiedFailure = stopped ? (failedFragments.find((fragment) => (opened as readonly string[]).includes(fragment.trackId)) ?? null) : null
  return (
    <div className="evi-sealed" data-testid="evidence-playback" data-phase="ready" data-playing={playing ? 'true' : 'false'} data-files={opened.join(' ')} aria-busy={phase.renewing || undefined}>
      <div className="evi-sealed-stages" data-files={opened.length}>
        {opened.map((fileId) => {
          const track = sources?.state === 'DEVELOPMENT' ? sources.tracks.find((entry) => entry.trackId === fileId) : undefined
          return (
            <div key={fileId} className="evi-sealed-file">
              <div className="evi-player-caption">
                <span className="evi-player-camera">
                  <Video className="size-3.5" aria-hidden="true" />
                  {t('evidence.playback.file', { track: t(`common.tracks.${fileId}`) })}
                </span>
                {track ? <VerifiedSourceBadge sourceClass={track.sourceClass} kind="CAMERA" testId={`evidence-playback-development-${fileId}`} /> : null}
              </div>
              <div className="evi-player-stage">
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
                  onTimeUpdate={() => onTimeUpdate(fileId)}
                  onEnded={fileId === leading ? pause : undefined}
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
      {phase.renewing ? (
        <p className="evi-caption" role="status" data-testid="evidence-playback-renewing">
          {t('evidence.playback.renewing')}
        </p>
      ) : null}
      {stopped ? (
        <Alert status={verifiedFailure ? 'danger' : 'warning'} role="alert" data-testid="evidence-playback-stopped" data-integrity={verifiedFailure ? 'true' : 'false'}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {verifiedFailure ? integrityText({ fileId: verifiedFailure.trackId, seq: verifiedFailure.seq }) : t('evidence.playback.stoppedAt', { at: formatMediaTime(phase.stoppedAtMs ?? 0) })}
            </Alert.Title>
            {verifiedFailure ? null : <Alert.Description>{reopenButton}</Alert.Description>}
          </Alert.Content>
        </Alert>
      ) : null}

      <div className="evi-player-controls">
        <Button
          isIconOnly
          size="sm"
          variant="primary"
          isDisabled={stopped || phase.renewing}
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
      <AudioSourceBand segments={segments} totalMs={totalMs} positionMs={positionMs} sources={sources} />
      <p className="evi-caption">{t('evidence.playback.note')}</p>
    </div>
  )
}
