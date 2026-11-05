import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { Video, VideoOff } from 'lucide-react'
import { sourceDeviceText } from './own-core-words'
import { cameraCaptureFaultOf, trackFaultText, useStatedFormat } from './stream-facts'
import { checkedAtOf, sourceLineState } from './source-state'
import { useTranslation } from 'react-i18next'
import { selectIsRecording, useSim, cameraLinesInForce } from '@dems/shared/sim'
import { CameraFeed, RecIndicator, type CameraFeedProps } from '@/components/media'
import { cn } from '@/lib/utils'
import { useRealCaptureCore, useTrackDevice } from './source-class'
import { useWebLive } from '@/runtime'
import { isLivePreviewDevice, isSessionStarting, PREVIEW_FIRST_FRAME_MS, previewPathOf, previewRefusalOf, previewRetryDelayMs, useAutoPreviewOpen } from './camera-live-preview'
import { reportDevicesError } from './report'
import { deferEffectStart } from '@/lib/effect-start'

/**
 * Where a camera picture stands on a page (wave H, driver D; gate 70 finding G70-03, repeated as
 * G75-13; ruling D196). ONE component for every surface - Devices & Inputs, the pre-check tiles of
 * Session New, the Dashboard, the Session Monitor - with the props of `CameraFeed`:
 *
 * | The Core this console shows | What is drawn |
 * |-----------------------------|---------------|
 * | Simulated client mode, or a Core in simulated capture | `CameraFeed`, exactly as before: the bundled demo loop with its own DEMO caption |
 * | A Core in real capture, `livePreview` set by the caller and a PRODUCTION camera on the track | `LivePreview`: the Core's live picture (operation 112, decisions D51 / D53) |
 * | A Core in real capture otherwise | The neutral "No preview" tile: a stock picture beside real evidence reads as the camera's picture |
 *
 * `livePreview` is set only by Devices & Inputs (camera tiles), Session New (camera previews) and the
 * Session Monitor (live session feed). The Dashboard and the inputs thumbnails keep the tile. (It is not
 * `live`: that prop of `CameraFeed` is the demo loop's decode switch, which the callers already set.)
 * D62 (2026-11-05) adds `autoPreview`, set only by the Devices tile: its session then opens by itself
 * while the track's selector line reads online (debounced ~1 s, at most the Core's global pipeline
 * cap of `CAMERA_PREVIEW_LIMITS.pipelines` sessions, closed on
 * offline or a hidden tab) - see `AutoLivePreview` and the D62 section of `camera-live-preview.ts`.
 *
 * The tile says only what the Core knows: the track, the device the selector names for it, and that
 * device's state as the selector line carries it (not assigned, offline, stream lost, online). Its
 * accessible name says that the live preview is not open. The REC state of a recording stays
 * (it is the session's, not the picture's). A snapshot of it is `null`: there is no frame.
 */
export type CameraPreviewProps = CameraFeedProps & {
  /** Show the Core's live picture where it has one (Live mode, real capture, a production camera). Default false. */
  livePreview?: boolean
  /**
   * D62 (2026-11-05): the Devices tile opens its preview BY ITSELF - gated on the selector line reading
   * online, debounced ~1 s, at most `CAMERA_PREVIEW_LIMITS.pipelines` auto sessions at once (the
   * Core's global bound), closed when the line goes offline or the
   * tab hides. Only Devices & Inputs sets it; the other surfaces keep the plain mount rule.
   */
  autoPreview?: boolean
}

export function CameraPreview({ livePreview = false, autoPreview = false, ...props }: CameraPreviewProps) {
  const realCapture = useRealCaptureCore()
  const device = useTrackDevice(props.cameraId)
  if (!realCapture) return <CameraFeed {...props} />
  // One preview per device: another camera on the track starts its own (the key), never the old stream.
  if (livePreview && device !== undefined && isLivePreviewDevice(device)) {
    // D62: the Devices tile gates its session (offline / hidden closes it back to the neutral tile).
    if (autoPreview) return <AutoLivePreview key={device.id} {...props} deviceId={device.id} />
    return <LivePreview key={device.id} {...props} deviceId={device.id} />
  }
  return <NoPreviewTile {...props} />
}

/**
 * D62 (2026-11-05): the auto-opened session of one Devices tile. The live preview stands only while the
 * track's selector line reads ONLINE; the session opens ~1 s after that (and after the tab is visible
 * again), yields to the cap of 4 concurrent auto sessions, and closes the moment the line goes offline or
 * the tab hides - the neutral tile states the condition meanwhile, and the click still opens the drawer.
 * The honest UNAVAILABLE / retry rule lives in `LivePreview` and is untouched.
 */
function AutoLivePreview({ deviceId, ...feed }: CameraPreviewProps & { deviceId: string }) {
  const online = useSim((state) => cameraLinesInForce(state).find((line) => line.trackId === feed.cameraId)?.online === true)
  const open = useAutoPreviewOpen(online)
  if (!open) return <NoPreviewTile {...feed} />
  return <LivePreview {...feed} deviceId={deviceId} />
}

/**
 * 2026-11-03 (bench, the principal's CAM-03): an `<img>` cannot read a status code, so every
 * refusal the Core makes at stream time (409 `PREVIEW_NOT_AVAILABLE` for a camera it cannot
 * reach, the credential refused, the limit) arrives here as a bare `error`. Retrying is right -
 * the camera may come back - but SAYING "Connecting…" forever is not: the Core knows more. After
 * this many failed attempts without ONE frame, the tile states the unavailable sentence and keeps
 * retrying at the backoff; the first frame of a returning camera says LIVE again as before.
 */
const HONEST_AFTER_FAILURES = 3

/** The state of a live preview as the tile says it. */
type LivePhase = 'CONNECTING' | 'LIVE' | 'UNAVAILABLE' | 'LIMIT'
type ShownPhase = LivePhase | 'PAUSED'

/** The fixed sentences of the page's own record (never the URL: it is a bearer value). */
const PREVIEW_REFUSED_RECORD = 'The live preview of a camera was not opened.'
const PREVIEW_THREW_RECORD = 'The live preview of a camera could not be asked for.'

const PHASE_TEXT = {
  CONNECTING: 'devices.preview.connecting',
  LIVE: 'devices.preview.live',
  PAUSED: 'devices.preview.pausedForRecording',
  UNAVAILABLE: 'devices.preview.unavailable',
  LIMIT: 'devices.preview.limit',
} as const satisfies Record<ShownPhase, string>

/**
 * THE LIVE PREVIEW OF ONE PRODUCTION CAMERA (decisions D51 / D53; plan D53 part (d)). Operation 112 issues a
 * short-lived token; its PATH is the `src` of an `<img>` that the Core streams as motion JPEG.
 *
 * | Event | What happens |
 * |-------|--------------|
 * | Mount, or a retry is due | ONE call of operation 112; the answer's path becomes the picture's `src` |
 * | The first picture arrives (`load`) | "Live preview"; the failure count goes back to 0 |
 * | The picture fails (`error`) | the `src` goes, and a new token is asked for after 2 s, 4 s, 8 s … at most 30 s |
 * | `429 PREVIEW_LIMIT` / `409` | the limit or the not-available sentence, and a new token later (`previewRefusalOf`) |
 * | A session is being started (CREATE, PRECHECK, ARMED) | "Preview paused: the recording has the camera" - the Core yields the camera first; a failing picture is asked for again as above |
 * | Unmount, or a new token | the old picture's `src` is removed, so the browser ends that stream |
 *
 * The accessible name is `devices.preview.aria` (the track, the device, the state). The REC badge and the
 * caller's actions stay where `NoPreviewTile` has them. A snapshot is `null` (no frame is kept).
 */
function LivePreview({ cameraId, deviceId, variant = 'feed', recordingSince = null, actions, className, dimmed = false, dimmedLabel, ref }: CameraFeedProps & { deviceId: string }) {
  const { t } = useTranslation()
  const live = useWebLive()
  const [path, setPath] = useState<string | null>(null)
  const [phase, setPhase] = useState<LivePhase>('CONNECTING')
  // A new value asks for a new token (the issue effect depends on it).
  const [attempt, setAttempt] = useState(0)
  // Failures in a row (refusals and failed pictures): the backoff step.
  const failures = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useImperativeHandle(ref, () => ({ snapshot: () => null }), [])
  const sessionState = useSim((state) => state.session?.state ?? null)
  const starting = isSessionStarting(sessionState)
  const device = useTrackDevice(cameraId)
  const track = t(`common.tracks.${cameraId}`)
  const name = device === undefined ? track : `${track} · ${sourceDeviceText(t, device, true)}`

  const clearRetry = useCallback(() => {
    if (retryTimer.current !== null) clearTimeout(retryTimer.current)
    retryTimer.current = null
  }, [])
  const retryLater = useCallback(
    (ms: number) => {
      clearRetry()
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null
        setAttempt((value) => value + 1)
      }, ms)
    },
    [clearRetry],
  )
  // The component is mounted, and which issue is the current one: an answer of an earlier issue, or one that
  // arrives after the unmount, changes nothing (and arms no retry).
  const mounted = useRef(false)
  const currentIssue = useRef<object | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearRetry()
    }
  }, [clearRetry])

  useEffect(() => {
    if (live === null) return undefined
    const issue = {}
    currentIssue.current = issue
    const stale = () => !mounted.current || currentIssue.current !== issue
    // StrictMode runs a mount effect twice: the helper leaves ONE token request (`lib/effect-start.ts`).
    return deferEffectStart(() => {
      live.client.call('createCameraPreviewSession', { params: { id: deviceId } }).then(
        (answer) => {
          if (stale()) return
          if (answer.ok) {
            const issued = previewPathOf(answer.data.url)
            if (issued !== null) {
              setPhase(failures.current >= HONEST_AFTER_FAILURES ? 'UNAVAILABLE' : 'CONNECTING')
              setPath(issued)
              return
            }
            failures.current += 1
            reportDevicesError('features/devices.livePreview', null, PREVIEW_REFUSED_RECORD, { operationId: 'createCameraPreviewSession', deviceId, status: answer.status, code: 'PREVIEW_PATH_UNUSABLE' }, 'warn')
            setPhase('UNAVAILABLE')
            retryLater(previewRetryDelayMs(failures.current))
            return
          }
          failures.current += 1
          const refusal = previewRefusalOf(answer, failures.current)
          setPhase(refusal.kind === 'LIMIT' ? 'LIMIT' : 'UNAVAILABLE')
          // One record per run of failures, not one per retry (a retry loop would fill the page's log).
          if (failures.current === 1) {
            reportDevicesError('features/devices.livePreview', null, PREVIEW_REFUSED_RECORD, { operationId: 'createCameraPreviewSession', deviceId, status: answer.status, code: answer.error.code, refusal: refusal.kind }, 'warn')
          }
          retryLater(refusal.retryMs)
        },
        (error: unknown) => {
          if (stale()) return
          failures.current += 1
          reportDevicesError('features/devices.livePreview', error, PREVIEW_THREW_RECORD, { operationId: 'createCameraPreviewSession', deviceId })
          setPhase('UNAVAILABLE')
          retryLater(previewRetryDelayMs(failures.current))
        },
      )
    })
  }, [live, deviceId, attempt, retryLater])

  // The picture's own element per token (`key`). The `src` is applied IN the ref, not only by React:
  // StrictMode's fake unmount runs this cleanup and re-attaches the SAME node without re-applying the
  // attribute (React never re-sets an unchanged prop) — a src owned only by React would stay removed,
  // no request would ever go out, neither `load` nor `error` would ever fire, and the tile would say
  // "Connecting…" forever over a perfectly issued token (the bench finding of 2026-11-04). Setting it
  // here makes every attach complete; the cleanup still ends the stream at every detach.
  const releaseOnUnmount = useCallback((node: HTMLImageElement | null) => {
    if (node === null) return
    if (path !== null) node.setAttribute('src', path)
    return () => {
      node.removeAttribute('src')
    }
  }, [path])
  const onLoad = () => {
    failures.current = 0
    setPhase('LIVE')
  }
  // One failed picture, whoever reported it: the `error` event, or the silence of a host that never
  // answers at all (the watchdog below) — the bench's CAM-03 of 2026-11-04 proved the event alone is
  // not enough: a silent TCP keeps the `<img>` pending for minutes over a stream the Core ended.
  const failPicture = useCallback(() => {
    failures.current += 1
    setPath(null)
    setPhase(failures.current >= HONEST_AFTER_FAILURES ? 'UNAVAILABLE' : 'CONNECTING')
    retryLater(previewRetryDelayMs(failures.current))
  }, [retryLater])
  const onError = () => {
    failPicture()
  }
  // The first-frame watchdog: armed while a src stands set and no frame has arrived; disarmed by the
  // first frame (the phase leaves CONNECTING), by its removal, and by the unmount.
  useEffect(() => {
    if (path === null || phase !== 'CONNECTING') return undefined
    const timer = setTimeout(failPicture, PREVIEW_FIRST_FRAME_MS)
    return () => clearTimeout(timer)
  }, [path, phase, failPicture])

  const shown: ShownPhase = starting && phase !== 'LIMIT' ? 'PAUSED' : phase
  const stateText = t(PHASE_TEXT[shown])
  const aria = t('devices.preview.aria', { name, state: stateText })
  const small = variant === 'thumb'
  return (
    <div
      className={cn('relative isolate aspect-video w-full overflow-hidden rounded-lg border border-border bg-neutral-900 text-neutral-200', className)}
      data-testid="camera-live-preview-frame"
      data-camera={cameraId}
      data-variant={variant}
    >
      <div role="img" aria-label={aria} title={small ? aria : undefined} data-testid="camera-live-preview" data-camera={cameraId} data-state={shown} className="absolute inset-0 rounded-[inherit]">
        {path === null ? null : (
          <img
            key={path}
            ref={releaseOnUnmount}
            src={path}
            alt=""
            aria-hidden="true"
            decoding="async"
            data-testid="camera-live-preview-image"
            onLoad={onLoad}
            onError={onError}
            className={cn('h-full w-full object-contain transition-opacity', phase === 'LIVE' ? (dimmed ? 'opacity-40' : 'opacity-100') : 'opacity-0')}
          />
        )}
        {shown === 'LIVE' ? null : (
          <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center', phase === 'LIVE' && 'bg-neutral-900/70')}>
            {shown === 'CONNECTING' || shown === 'PAUSED' ? <Video aria-hidden="true" size={small ? 14 : 24} strokeWidth={1.75} /> : <VideoOff aria-hidden="true" size={small ? 14 : 24} strokeWidth={1.75} />}
            <span data-part="state" className={cn('font-semibold', small ? 'sr-only' : 'text-sm')}>
              {stateText}
            </span>
            <span data-part="name" className={cn('max-w-full break-words text-[11px] leading-4 text-neutral-400', small && 'sr-only')}>
              {name}
            </span>
          </div>
        )}
        {shown === 'LIVE' && dimmed ? (
          <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-sm font-semibold" data-part="dimmed">
            {dimmedLabel ?? t('session.feed.monitoringPaused')}
          </div>
        ) : null}
      </div>
      {recordingSince !== null ? <RecIndicator since={recordingSince} size={variant === 'feed' ? 'md' : 'sm'} className="absolute right-2 top-2" /> : null}
      {actions ? <div className="absolute bottom-2 right-2 flex items-center gap-1">{actions}</div> : null}
    </div>
  )
}

/**
 * THE LABEL AND THE FORMAT ON A CORE IN REAL CAPTURE (task 4 row W4; review `verification/060c` finding R-03).
 * `label` and `formatLabel` are the caller's words for the demo picture; they come from the `cameras` slice, which on
 * a real Core still holds the simulator's record. The tile therefore takes neither and states the two itself:
 *
 * | What the caller's chip said | What the tile says, from the Core's own data |
 * |---|---|
 * | `label` (the camera's name and room) | the track and the device its selector line names (`name`, as before) |
 * | `formatLabel` / the format in `label` | the STORED stream statement of that line (`useStatedFormat`): "Format: 1080p • 25 fps", "Format: Not stated" where the line names none. Not drawn where the Core reports the camera's fault - the state line says the fault, and a stored fact is not shown as if the stream were live |
 *
 * Not drawn twice: a caller that states the format beside the tile hands `formatLabel=""` (the Devices tile's fact
 * row) and the thumb of the Session Monitor's input card has it on the card (`inputs-panel.tsx`).
 */
function NoPreviewTile({ cameraId, variant = 'feed', recordingSince = null, formatLabel, actions, className, ref }: CameraFeedProps) {
  const { t } = useTranslation()
  const formatId = useId()
  const stated = useStatedFormat(cameraId, 'chip')
  const format = stated === null || stated.fault !== null || formatLabel === '' || variant === 'thumb' ? null : t('web.source.format', { format: stated.text })
  // No frame exists, so no snapshot does: the caller's "no image" path, never a made-up picture.
  useImperativeHandle(ref, () => ({ snapshot: () => null }), [])
  // The selector the OPEN session was created under, else the stored one (`selector-in-force.ts` of the shared package: a sealed session's snapshot names nothing).
  const line = useSim((state) => cameraLinesInForce(state).find((camera) => camera.trackId === cameraId))
  const device = useTrackDevice(cameraId)
  const track = t(`common.tracks.${cameraId}`)
  // Fix wave L (G75d-06): a generated source is named as generated, never by the dataset's product name.
  const source = device === undefined ? (line?.deviceId ?? null) : sourceDeviceText(t, device, true)
  const recording = useSim(selectIsRecording)
  const name = source === null ? track : `${track} · ${source}`
  // Fix wave L (G70c-02): the word under "No preview" follows the rule of a source line - "Online" was said of sources nobody opened.
  const reach = line === undefined ? null : sourceLineState({ realCapture: true, recording, online: line.online, streamState: line.streamState, checkedAt: checkedAtOf(device) })
  // Task 4 row W5 (review 060d Q-01): a camera the Core holds an ACTIVE capture fault about (it stopped delivering
  // inside the session) is not "Stream live" - its line still reads LIVE while the relay re-opens it. The fault is
  // said in the state's place and goes when the Core resolves it.
  const lineDeviceId = line?.deviceId ?? null
  const raised = useSim((simState) => (lineDeviceId === null ? null : cameraCaptureFaultOf(simState.alerts, lineDeviceId)))
  const state =
    line === undefined || reach === null
      ? t('devices.selector.notAssigned')
      : reach.stream === 'LOST'
        ? t('devices.selector.stream.LOST')
        : raised !== null
          ? trackFaultText(t, raised)
        : reach.reach === 'NOT_REACHABLE'
          ? t('common.developmentRoster.notReachable')
          : reach.reach === 'NOT_CHECKED'
            ? t('web.source.notChecked')
            : reach.stream === 'LIVE'
              ? t('devices.selector.stream.LIVE')
              : reach.stream === 'NOT_READ'
                ? t('web.source.streamNotRead')
                : t('common.developmentRoster.reachable')
  const small = variant === 'thumb'
  return (
    <div
      // Fix wave Q (CW-02): in a Dashboard tile the frame is as tall as its four lines at least (`data-variant="tile"`:
      // the lines are in the flow, not laid over a box of whatever height the row left - 44 px for 64 px of text at 1440;
      // `min-h-fit shrink-0` after the caller's classes, so the caller's `min-h-0` cannot shrink it under its text).
      className={cn('relative isolate aspect-video w-full rounded-lg border border-border bg-neutral-900 text-neutral-200', className, variant === 'tile' && 'flex min-h-fit shrink-0 flex-col')}
      data-testid="camera-no-preview-frame"
      data-camera={cameraId}
      data-variant={variant}
    >
      <div
        role="img"
        aria-label={t('devices.noPreview.aria', { name, state })}
        aria-describedby={format === null ? undefined : formatId}
        title={small ? t('devices.noPreview.aria', { name, state }) : undefined}
        data-testid="camera-no-preview"
        data-camera={cameraId}
        // Row W6 (line 569): the Core's null stream state has its own value - an unread stream is not 'ONLINE'.
        data-state={line === undefined ? 'NOT_ASSIGNED' : !line.online ? 'OFFLINE' : line.streamState === 'LOST' ? 'LOST' : line.streamState === null ? 'NOT_READ' : 'ONLINE'}
        data-fault={line === undefined ? undefined : (raised ?? undefined)}
        // Fix wave L (G89c-08): in a Dashboard tile (variant `tile`) the four lines fit the short stage at 1440 x 900 - a small icon and tight lines.
        className={cn(
          'flex flex-col items-center justify-center rounded-[inherit] px-2 text-center',
          variant === 'tile' ? 'relative min-h-fit flex-1 gap-0 py-1' : 'absolute inset-0 gap-1 overflow-hidden',
        )}
      >
        <VideoOff aria-hidden="true" size={small || variant === 'tile' ? 14 : 24} strokeWidth={1.75} />
        {/* Fix wave Q (CW-02 sweep): a thumb (59 x 33 px in the Monitor's inputs card) has no room for the icon AND the
            words - "No / preview" was cut by the frame. The thumb draws the icon; its words stay for assistive technology
            (the frame's name) and as the hover title. */}
        <span className={cn('font-semibold', small ? 'sr-only' : variant === 'tile' ? 'text-xs leading-4' : 'text-sm')}>{t('devices.noPreview.title')}</span>
        <span data-part="name" className={cn('max-w-full break-words text-[11px] leading-4', small && 'sr-only')}>
          {name}
        </span>
        <span data-part="state" className={cn('text-[11px] leading-4 text-neutral-400', small && 'sr-only')}>
          {state}
          {/* On the state's line, so that a Dashboard tile keeps its four lines (fix waves L and Q measured that box). */}
          {format === null ? null : (
            <span id={formatId} data-part="format" data-testid="camera-no-preview-format">
              {` · ${format}`}
            </span>
          )}
        </span>
      </div>
      {recordingSince !== null ? <RecIndicator since={recordingSince} size={variant === 'feed' ? 'md' : 'sm'} className="absolute right-2 top-2" /> : null}
      {actions ? <div className="absolute bottom-2 right-2 flex items-center gap-1">{actions}</div> : null}
    </div>
  )
}
