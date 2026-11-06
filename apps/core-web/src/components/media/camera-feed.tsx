import {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { Chip } from '@heroui/react'
import { DemoMark } from '@/components/demo-mark'
import { AnimatePresence, motion, useInView, usePageInView, type Transition } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { VideoTrackId } from '@dems/shared/domain'
import { CoreMode, coreModeOf } from '@dems/shared/live'
import { SimContext } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { GlowLayer, tween, useAmbientLoop, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { backingSize, CAMERA_FRAMING } from './camera-feed.math'
import './camera-feed.css'
import { liveVideo } from './demo-media'
import { scheduleFeedPainter } from './feed-scheduler'
import { useLiveDecodeSlot } from './live-decode-budget'
import { createNoisePainter, createProceduralFeed, type ProceduralFeed } from './procedural-feed'
import { RecIndicator } from './rec-indicator'
import { useSimNowReader } from './use-sim-clock'

/** M-C-12 literals (D49): camera switch cross-fade and the NO SIGNAL fade. */
export const CAMERA_SWITCH_MS = 320
export const NO_SIGNAL_FADE_MS = 400
/** Media that has not produced a frame after this long counts as "cannot load" (fallback). */
export const DEFAULT_LOAD_TIMEOUT_MS = 8000
/** M-C-20: the monitoring-paused dim. */
const DIMMED_OPACITY = 0.35

export type CameraFeedVariant = 'feed' | 'tile' | 'thumb'
export type CameraFeedMode = 'video' | 'procedural'
/** Why the procedural renderer is showing (`none` while the video plays). */
export type CameraFeedFallbackReason = 'none' | 'no-source' | 'error' | 'autoplay' | 'timeout'

export interface CameraFeedHandle {
  /** A JPEG data URL of the current frame (video or canvas), 640×360, or `null` (M-C-18). */
  snapshot(): string | null
}

export interface CameraFeedProps {
  cameraId: VideoTrackId
  /**
   * Video URL. Absent: the step-92 live loop of `cameraId` (muted, looped). `null`: the
   * procedural renderer only. Looped clips replace the canvas without an API change (§14.10).
   */
  src?: string | null
  /** Poster until the first frame. Absent: the matching live poster (or thumbnail for tiles). */
  poster?: string | null
  /** `feed`: Session Monitor L (framed, glow). `tile`: device tiles (hover lift). `thumb`: small. */
  variant?: CameraFeedVariant
  /** Top-left overlay, for example "Camera 1 - Interview Room 1". */
  label?: string | null
  /** Top-right REC chip with the elapsed timer, from this simulator time (epoch ms). */
  recordingSince?: number | null
  /** Bottom-left overlay, for example "1080p • 25 fps • H.264". */
  formatLabel?: string | null
  /** NO SIGNAL: grey noise and the label (camera loss). */
  noSignal?: boolean
  /** Monitoring paused (UI-only, M-C-20): the image dims; REC keeps pulsing. */
  dimmed?: boolean
  /** Overlay text while dimmed. Default `session.feed.monitoringPaused`. */
  dimmedLabel?: string
  /** Bottom-right slot (for example the page's fullscreen button). */
  actions?: ReactNode
  /**
   * `false`: show the poster (or a static procedural frame) instead of decoding the video, for
   * small thumbnails on pages that already play live feeds (decode budget, §9.3). Default true.
   * Even when `true`, a `tile` or `thumb` decodes only while it holds the page's one live decode
   * slot (`live-decode-budget.ts`, F45-01); otherwise it shows its standby frame.
   */
  live?: boolean
  /** Accessible name of the image. Default: the camera name and "LIVE SESSION FEED". */
  ariaLabel?: string
  /** Frame-less time to wait for the first video frame before falling back; ≤ 0 disables it. */
  loadTimeoutMs?: number
  onModeChange?: (mode: CameraFeedMode, reason: CameraFeedFallbackReason) => void
  className?: string
  ref?: Ref<CameraFeedHandle>
}

const OVERLAY_CHIP = 'border-0 bg-black/65 text-white'

function errorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') return error.name
  return 'Error'
}

/**
 * CameraFeed (01_specs §14.6 "not a UI primitive", §14.10 as amended by D50; 03_motion_spec
 * M-C-12, M-C-20; implementation/64_demo_media.md).
 *
 * - **Video first.** It plays the step-92 live loop of the camera (or `src`): muted, looped,
 *   inline, no controls. The loops carry no clock or REC; this component overlays kit `Chip`s.
 * - **Procedural fallback.** When the video errors, autoplay is refused, or no frame arrives
 *   within `loadTimeoutMs`, it switches (cross-fade) to the canvas renderer: the hero still with
 *   Ken Burns, grain, scanline and a burnt-in UTC+07:00 timestamp from the simulator clock.
 * - **Motion.** First paint eases from blur `mediaIn`; camera switches cross-fade 320 ms; NO
 *   SIGNAL fades to grey noise in 400 ms; tiles lift to `hover` scale with a glow step.
 * - **Idle respect (R10) and reduced motion (§8).** Video pauses off-screen, in a hidden tab and
 *   under reduced motion (the synthetic clip itself drifts). The canvas paints through one
 *   shared rAF scheduler at 25 fps, and its push-in is an ambient loop (group `camera-feeds`,
 *   one slot for every feed on the page); static frames repaint at 1 Hz for the timestamp.
 * - **One live decode per page (F45-01, D96).** Two concurrently decoding loops cap windowed GPU
 *   Chrome at 30 fps, so tiles and thumbs share one decode slot (`useLiveDecodeSlot`): the
 *   hovered or focused tile plays, else the first one; a `feed` always plays and keeps the slot.
 *   A tile without the slot holds its poster or last frame under a slow standby shimmer (an
 *   `idle` ambient loop in the `camera-feeds` slot, so it yields to every other loop).
 */
export function CameraFeed({
  cameraId,
  src,
  poster,
  variant = 'feed',
  label = null,
  recordingSince = null,
  formatLabel = null,
  noSignal = false,
  dimmed = false,
  dimmedLabel,
  actions,
  ariaLabel,
  live = true,
  loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
  onModeChange,
  className,
  ref,
}: CameraFeedProps) {
  const { t } = useTranslation()
  // Live mode (plan row W0, item 7; 04_client_integration_spec §3.2): the camera's state is the Core's,
  // the picture is still the bundled demo loop (decision MS-1). The component's own words say so: the
  // procedural OSD line and the default accessible name do not call that picture live. The line burnt
  // into the bundled loop's frames cannot be changed here (decision for the controller, W0 report).
  const sim = useContext(SimContext)
  const liveData = sim !== null && coreModeOf(sim) === CoreMode.LIVE
  const m = useMotionPolicy()
  const liveMedia = useMemo(() => liveVideo(cameraId), [cameraId])
  const videoSrc = src === undefined ? (liveMedia?.src ?? null) : src
  const posterSrc =
    poster !== undefined
      ? poster
      : src === undefined
        ? variant === 'feed'
          ? (liveMedia?.poster ?? null)
          : (liveMedia?.thumb ?? liveMedia?.poster ?? null)
        : null

  // A failure belongs to the source that failed: a new `src` gets a fresh try.
  const [failure, setFailure] = useState<{ src: string; reason: CameraFeedFallbackReason } | null>(null)
  const failed = failure !== null && failure.src === videoSrc
  const mode: CameraFeedMode = videoSrc && !failed ? 'video' : 'procedural'
  const reason: CameraFeedFallbackReason = !videoSrc ? 'no-source' : failed ? failure.reason : 'none'

  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const noiseRef = useRef<HTMLCanvasElement>(null)
  const feedRef = useRef<ProceduralFeed | null>(null)
  const pageVisible = usePageInView()
  const onScreen = useInView(rootRef, { initial: true })
  const visible = pageVisible && onScreen
  const readNow = useSimNowReader()
  const onModeChangeRef = useRef(onModeChange)
  useEffect(() => {
    onModeChangeRef.current = onModeChange
  }, [onModeChange])

  useEffect(() => {
    onModeChangeRef.current?.(mode, reason)
  }, [mode, reason])

  const fail = useCallback(
    (why: Exclude<CameraFeedFallbackReason, 'none' | 'no-source'>, error?: unknown) => {
      if (!videoSrc) return
      setFailure((current) => (current?.src === videoSrc ? current : { src: videoSrc, reason: why }))
      // No client log endpoint exists on mock-core (D41(g)); the fallback is the graceful path.
      if (import.meta.env.DEV) {
        console.warn('[core-web] camera feed fallback', {
          level: 'warn',
          source: 'CameraFeed',
          message: `video ${why}; showing the procedural feed`,
          context: { cameraId, src: videoSrc, error: error === undefined ? null : errorName(error) },
        })
      }
    },
    [cameraId, videoSrc],
  )

  // ── Video playback: plays only while visible, on screen, not NO SIGNAL and not reduced, ──
  // ── and (tiles and thumbs) only while this feed holds the page's live decode slot. ──────
  const wantsLive = mode === 'video' && live && visible && !noSignal && !m.reduced
  const decode = useLiveDecodeSlot(wantsLive, variant === 'feed' ? 'feed' : 'tile')
  const shouldPlay = decode.granted
  const standby = wantsLive && !decode.granted
  const claimFocus = decode.focus
  useEffect(() => {
    const video = videoRef.current
    if (!video || mode !== 'video') return undefined
    if (!shouldPlay) {
      video.pause()
      return undefined
    }
    let current = true
    video.muted = true
    const attempt = video.play() as Promise<void> | undefined
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch((error: unknown) => {
        const name = errorName(error)
        // A pause() or a source change interrupted play(): not a failure.
        if (!current || name === 'AbortError') return
        fail(name === 'NotAllowedError' ? 'autoplay' : 'error', error)
      })
    }
    return () => {
      current = false
    }
  }, [shouldPlay, mode, videoSrc, fail])

  useEffect(() => {
    if (mode !== 'video' || !shouldPlay || !(loadTimeoutMs > 0)) return undefined
    if ((videoRef.current?.readyState ?? 0) >= 2) return undefined
    const id = setTimeout(() => {
      if ((videoRef.current?.readyState ?? 0) < 2) fail('timeout')
    }, loadTimeoutMs)
    return () => clearTimeout(id)
  }, [mode, shouldPlay, videoSrc, loadTimeoutMs, fail])

  // ── Procedural renderer ──────────────────────────────────────────────────────────────────
  // `decor`: decoration yields first when the shell needs a slot for an escalation (F45-02).
  const kenBurns = useAmbientLoop('camera-feed', {
    ref: rootRef,
    priority: 'decor',
    group: 'camera-feeds',
    enabled: mode === 'procedural' && live && !noSignal,
  })
  const animate = kenBurns.running

  useEffect(() => {
    if (mode !== 'procedural') return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const feed = createProceduralFeed(
      canvas,
      cameraId,
      () => {
        feed?.paint(performance.now(), { animate: false, now: readNow() })
      },
      liveData,
    )
    if (!feed) return undefined
    feedRef.current = feed
    const applySize = () => {
      const size = backingSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio)
      if (size.width > 0) feed.resize(size.width, size.height)
    }
    applySize()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(applySize) : null
    observer?.observe(canvas)
    return () => {
      observer?.disconnect()
      feed.destroy()
      if (feedRef.current === feed) feedRef.current = null
    }
  }, [mode, cameraId, readNow, liveData])

  useEffect(() => {
    if (mode !== 'procedural' || !visible) return undefined
    return scheduleFeedPainter(
      (time) => feedRef.current?.paint(time, { animate, now: readNow() }),
      animate ? 25 : 1,
    )
  }, [mode, visible, animate, readNow])

  // ── NO SIGNAL noise (grey static at 12.5 fps; one frozen frame under reduced motion) ─────
  useEffect(() => {
    if (!noSignal || !visible) return undefined
    const canvas = noiseRef.current
    if (!canvas) return undefined
    const paint = createNoisePainter(canvas, CAMERA_FRAMING[cameraId].seed)
    if (!paint) return undefined
    const moving = !m.reduced
    return scheduleFeedPainter(() => paint(moving), moving ? 12.5 : 1)
  }, [noSignal, visible, cameraId, m.reduced])

  useImperativeHandle(
    ref,
    () => ({
      snapshot() {
        const out = document.createElement('canvas')
        out.width = 640
        out.height = 360
        const ctx = out.getContext('2d')
        if (!ctx) return null
        const video = videoRef.current
        if (mode === 'video' && video && video.readyState >= 2) ctx.drawImage(video, 0, 0, out.width, out.height)
        else if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0, out.width, out.height)
        else return null
        try {
          return out.toDataURL('image/jpeg', 0.82)
        } catch {
          return null
        }
      },
    }),
    [mode],
  )

  // Keyboard focus on the tile's host (for example the Devices tile button) claims the decode slot
  // the way a hover does (F45-01).
  useEffect(() => {
    if (variant === 'feed') return undefined
    const host = rootRef.current?.parentElement
    if (!host) return undefined
    host.addEventListener('focusin', claimFocus)
    return () => host.removeEventListener('focusin', claimFocus)
  }, [variant, claimFocus])

  // ── Motion ───────────────────────────────────────────────────────────────────────────────
  const [hovered, setHovered] = useState(false)
  const crossFade: Transition = m.reduced ? m.transitions.crossFade : tween(CAMERA_SWITCH_MS, 'standard', m.timeScale)
  const noSignalFade: Transition = tween(m.reduced ? tokens.duration.fast : NO_SIGNAL_FADE_MS, 'standard', m.timeScale)
  const dimTransition = m.transitions.crossFade
  const mediaHover = variant === 'tile' ? m.interactions.mediaTile.whileHover : undefined
  const recording = recordingSince !== null
  const imageLabel = ariaLabel ?? `${t(`common.tracks.${cameraId}`)} · ${t(liveData ? 'session.feed.bundledPicture' : 'session.feed.title')}`
  const chipSize = variant === 'feed' ? 'md' : 'sm'

  return (
    <motion.div
      ref={rootRef}
      data-testid="camera-feed"
      data-camera={cameraId}
      data-variant={variant}
      data-feed-mode={mode}
      data-feed-fallback={reason}
      data-live={live ? 'true' : 'false'}
      data-decode={shouldPlay ? 'live' : standby ? 'standby' : 'off'}
      data-motion={m.policy}
      className={cn(
        'relative isolate aspect-video w-full rounded-lg bg-black',
        variant === 'feed' && 'border-2 border-bronze/60',
        variant !== 'feed' && 'border border-border',
        className,
      )}
      variants={m.variants.mediaIn}
      initial="hidden"
      animate="visible"
      onHoverStart={
        variant === 'tile'
          ? () => {
              setHovered(true)
              claimFocus()
            }
          : undefined
      }
      onHoverEnd={variant === 'tile' ? () => setHovered(false) : undefined}
    >
      {variant !== 'thumb' ? (
        <GlowLayer
          level={variant === 'tile' ? (hovered ? 2 : 1) : 1}
          breathe={variant === 'feed' && recording}
          loopLabel="feed-frame-glow"
          loopGroup="feed-frame-glow"
        />
      ) : null}

      <motion.div
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        role="img"
        aria-label={imageLabel}
        initial={false}
        animate={{ opacity: dimmed ? DIMMED_OPACITY : 1 }}
        transition={dimTransition}
        whileHover={mediaHover}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={`${cameraId}:${mode}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={crossFade}
          >
            {mode === 'video' && videoSrc ? (
              <video
                ref={videoRef}
                data-testid="camera-feed-video"
                className="size-full object-cover"
                src={videoSrc}
                poster={posterSrc ?? undefined}
                muted
                loop
                playsInline
                autoPlay={shouldPlay}
                preload="auto"
                disablePictureInPicture
                disableRemotePlayback
                aria-hidden="true"
                tabIndex={-1}
                onError={() => fail('error')}
              />
            ) : (
              <canvas
                ref={canvasRef}
                data-testid="camera-feed-canvas"
                data-ambient={kenBurns.attrs['data-ambient']}
                // D60 (2026-11-04): a track with no demo loop falls back to this canvas, so it must carry
                // the policy attribute too — the dashboard's reduced-motion rule reads it on every [data-ambient].
                data-motion={kenBurns.attrs['data-motion']}
                className="size-full"
                aria-hidden="true"
              />
            )}
          </motion.div>
        </AnimatePresence>
        {standby ? <StandbySheen /> : null}
      </motion.div>

      <AnimatePresence>
        {noSignal ? (
          <motion.div
            key="no-signal"
            data-testid="camera-feed-no-signal"
            className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-neutral-800"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={noSignalFade}
          >
            <canvas
              ref={noiseRef}
              width={160}
              height={90}
              className="absolute inset-0 size-full opacity-70 [image-rendering:pixelated]"
              aria-hidden="true"
            />
            <Chip color="default" size={chipSize} className={cn('relative', OVERLAY_CHIP)}>
              <Chip.Label>{t('session.feed.noSignal')}</Chip.Label>
            </Chip>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {dimmed ? (
          <motion.div
            key="dimmed"
            className="absolute inset-0 flex items-center justify-center px-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={dimTransition}
          >
            <Chip color="default" size={chipSize} className={OVERLAY_CHIP}>
              <Chip.Label>{dimmedLabel ?? t('session.feed.monitoringPaused')}</Chip.Label>
            </Chip>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {label ? (
        <Chip color="default" size={chipSize} className={cn('absolute left-2 top-2', OVERLAY_CHIP)}>
          <Chip.Label data-testid="camera-feed-label">{label}</Chip.Label>
        </Chip>
      ) : null}
      {recording ? (
        <RecIndicator since={recordingSince} size={chipSize} className="absolute right-2 top-2" />
      ) : null}
      {formatLabel ? (
        <Chip color="default" size={chipSize} className={cn('absolute bottom-2 left-2 font-mono', OVERLAY_CHIP)}>
          <Chip.Label>{formatLabel}</Chip.Label>
        </Chip>
      ) : null}
      {actions ? <div className="absolute bottom-2 right-2 flex items-center gap-1">{actions}</div> : null}
      {/* Fix wave J (JW-07; truth rule 3f): the bundled loop is never shown as a camera's picture without its mark. */}
      {sim !== null ? <DemoMark block="feed" overlay className={cn('absolute', variant === 'feed' ? 'left-1/2 top-2 -translate-x-1/2' : 'bottom-2 right-2', OVERLAY_CHIP)} /> : null}
    </motion.div>
  )
}

/**
 * Standby treatment of a tile that wants to play but does not hold the page's live decode slot
 * (F45-01): the held poster or last frame, with a faint light sweep every 7.2 s. The sweep is a
 * CSS loop on `::after` (compositor-only transform) and an `idle` ambient loop in the
 * `camera-feeds` slot: it runs only in a slot no page, decor or shell loop wants, so on the
 * Dashboard (four slots taken) it simply stays still.
 */
function StandbySheen() {
  const ref = useRef<HTMLSpanElement>(null)
  const loop = useAmbientLoop('camera-standby', { ref, priority: 'idle', group: 'camera-feeds' })
  return <span ref={ref} className="dems-feed-standby" data-testid="camera-feed-standby" aria-hidden="true" {...loop.attrs} />
}
