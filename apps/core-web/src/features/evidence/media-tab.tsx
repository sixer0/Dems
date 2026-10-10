import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Chip, EmptyState, Slider, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import type { Key } from '@heroui/react'
import { motion } from 'motion/react'
import { AudioLines, Film, Mic, Pause, Play, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import type { DemoTrackEntry } from '@dems/shared/demo-data'
import { excerptPositionSec } from '@/components/media/demo-media'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { useEvidenceAssets } from './demo-assets'
import { logEvidence } from './log'
import { formatPlayerTime, type EvidenceRow } from './model'

const VIDEO_TRACKS: VideoTrackId[] = ['VIDEO-01', 'VIDEO-02']
const AUDIO_TRACKS: AudioTrackId[] = ['AUDIO-01', 'AUDIO-02']
/** Drift beyond this (s) re-aligns a MIC track to the video. */
export const AUDIO_SYNC_TOLERANCE_S = 0.25
/** M-C-12 camera switch cross-fade (spec literal). */
export const CAMERA_SWITCH_FADE_MS = 320

export interface MediaTabProps {
  row: EvidenceRow
  /** Set by the header's Play button; the tab starts playback once and reports it handled. */
  playToken: number | null
  onPlayHandled: () => void
  /**
   * Live mode: the Core's media reference (operation 40) did not answer, so whether a DEMO package
   * belongs to the item is not known. The empty state then says so in the header chip's words
   * (`evidence.live.mediaUnavailable`), as the Metadata tab does (W83 ledger #95), and claims no
   * absence. False in Simulated mode and whenever the Core answered.
   */
  mediaUnavailable?: boolean
}

function playSafely(element: HTMLMediaElement | null, source: string): void {
  if (!element) return
  try {
    const result = element.play() as Promise<void> | undefined
    if (result && typeof result.catch === 'function') {
      result.catch((error: unknown) => {
        // A pause during load rejects play(); that is not an error worth a toast.
        if (!(error instanceof DOMException && error.name === 'AbortError')) logEvidence('warn', source, error)
      })
    }
  } catch (error) {
    logEvidence('warn', source, error)
  }
}

/**
 * Media tab (01_specs §14.5.3 "Media: track list + player"; research/04 §5.1; D50; review 40 R2).
 *
 * - Plays VIDEO-01 or VIDEO-02 from the package's `tracks[].stored.path` (muted: the videos carry no
 *   audio stream) and the separate MIC tracks AUDIO-01 and AUDIO-02, both loaded and kept in sync
 *   with the video; the MIC switch unmutes one of them (a gapless switch). For EV 0005 the AUDIO-02
 *   file is the package's stored (altered) copy.
 * - **Excerpt rule (step 92).** The clips are 31–47 s excerpts of a recording that lasted minutes. The
 *   scrub bar spans the full recording; a position p plays the clip at `p mod excerpt`
 *   (`excerptPositionSec`), and the clip loops as the full-recording clock runs on. Labelled
 *   "DEMO excerpt". Markers: the dataset items keep none; the live session's markers
 *   (`EvidenceItem.markers`, step 54) are a scrub-bar follow-up (step 91).
 * - Camera switch: the new camera fades in over 320 ms at the same position (M-C-12).
 * - Items without a package show an EmptyState (simulated evidence has no media). Its words follow the
 *   mode (closing fix CF-W, O-RT-1): Simulated mode says the record comes from the simulator; Live mode
 *   says what the preview card says (plan row W0 item 9, D158) — no DEMO package, the Core server's
 *   record only — or, when operation 40 did not answer, only that the media reference is unavailable.
 */
export function MediaTab({ row, playToken, onPlayHandled, mediaUnavailable = false }: MediaTabProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const live = useCoreMode() === CoreMode.LIVE
  const { urlFor } = useEvidenceAssets()
  const pkg = row.pkg
  const [camera, setCamera] = useState<VideoTrackId>('VIDEO-01')
  const [mic, setMic] = useState<AudioTrackId>('AUDIO-01')
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRefs = useRef<Partial<Record<AudioTrackId, HTMLAudioElement | null>>>({})
  const base = useRef(0)
  const lastMediaTime = useRef(0)
  const pendingSeek = useRef<number | null>(null)

  const excerptSec = pkg ? pkg.excerptDurationMs / 1000 : 0
  const totalSec = Math.max(row.item.durationMs / 1000, excerptSec)
  const track = (id: string): DemoTrackEntry | undefined => pkg?.tracks.find((entry) => entry.trackId === id)
  const videoTrack = track(camera)
  const videoSrc = urlFor(videoTrack?.stored.path)
  const poster = urlFor(videoTrack?.poster?.path)

  const syncAudio = useCallback((mediaTime: number, force = false) => {
    for (const audio of AUDIO_TRACKS.map((id) => audioRefs.current[id])) {
      if (!audio) continue
      if (force || Math.abs(audio.currentTime - mediaTime) > AUDIO_SYNC_TOLERANCE_S) {
        try {
          audio.currentTime = mediaTime
        } catch {
          // Not seekable yet (metadata still loading); the next time update re-aligns it.
        }
      }
    }
  }, [])

  const play = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    syncAudio(video.currentTime, true)
    playSafely(video, 'media.playVideo')
    for (const id of AUDIO_TRACKS) playSafely(audioRefs.current[id] ?? null, 'media.playAudio')
    setPlaying(true)
  }, [syncAudio])

  const pause = useCallback(() => {
    videoRef.current?.pause()
    for (const id of AUDIO_TRACKS) audioRefs.current[id]?.pause()
    setPlaying(false)
  }, [])

  // Header "Play" button (it may have switched to this tab first).
  useEffect(() => {
    if (playToken === null) return
    play()
    onPlayHandled()
  }, [playToken, play, onPlayHandled])

  // Stop everything on unmount (tab change, navigation).
  useEffect(() => {
    const audios = audioRefs.current
    const videoHolder = videoRef
    return () => {
      videoHolder.current?.pause()
      for (const id of AUDIO_TRACKS) audios[id]?.pause()
    }
  }, [])

  const seekTo = (fullSec: number) => {
    const clamped = Math.min(Math.max(fullSec, 0), totalSec)
    const local = excerptPositionSec(clamped, excerptSec)
    base.current = clamped - local
    lastMediaTime.current = local
    setPosition(clamped)
    const video = videoRef.current
    if (video) {
      try {
        video.currentTime = local
      } catch {
        pendingSeek.current = local
      }
    }
    syncAudio(local, true)
  }

  const onTimeUpdate = () => {
    const video = videoRef.current
    if (!video || !excerptSec) return
    const mediaTime = video.currentTime
    // The clip looped: the full-recording clock carries on into the next excerpt window.
    if (playing && mediaTime + 1 < lastMediaTime.current) base.current += excerptSec
    lastMediaTime.current = mediaTime
    const full = base.current + mediaTime
    if (full >= totalSec) {
      pause()
      setPosition(totalSec)
      return
    }
    setPosition(full)
    syncAudio(mediaTime)
  }

  const onCamera = (keys: Set<Key>) => {
    const [next] = [...keys]
    if (next === undefined || next === camera) return
    pendingSeek.current = videoRef.current?.currentTime ?? lastMediaTime.current
    setCamera(next as VideoTrackId)
  }

  const onLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    if (pendingSeek.current !== null) {
      try {
        video.currentTime = pendingSeek.current
      } catch {
        // ignore: the next time update re-aligns
      }
      pendingSeek.current = null
    }
    if (playing) playSafely(video, 'media.resumeAfterSwitch')
  }

  const onMic = (keys: Set<Key>) => {
    const [next] = [...keys]
    if (next !== undefined) setMic(next as AudioTrackId)
  }

  if (!pkg) {
    // O-RT-1: the record is the simulator's only in Simulated mode; in Live mode it is the Core server's.
    const source = !live ? 'simulated' : mediaUnavailable ? 'unavailable' : 'core'
    return (
      <EmptyState className="evi-empty" data-testid="evidence-media-empty" data-source={source}>
        <Film className="size-8 text-foreground-2" aria-hidden="true" />
        <p className="evi-empty-title">{t(source === 'unavailable' ? 'evidence.live.mediaUnavailable' : 'evidence.media.noMedia')}</p>
        {source === 'unavailable' ? null : <p className="evi-empty-body">{t(source === 'core' ? 'evidence.live.noPackage' : 'evidence.media.noMediaBody')}</p>}
      </EmptyState>
    )
  }

  return (
    <div className="evi-media" data-testid="evidence-media" data-camera={camera} data-mic={mic} data-playing={playing ? 'true' : 'false'}>
      <div className="evi-player">
        <div className="evi-player-caption">
          <span className="evi-player-camera">
            <Video className="size-3.5" aria-hidden="true" />
            {t(`common.tracks.${camera}`)}
          </span>
          <Chip size="sm" variant="secondary" className="evi-demo-chip" data-testid="evidence-excerpt-chip">
            <Chip.Label>{t('evidence.media.excerptChip')}</Chip.Label>
          </Chip>
        </div>
        {/* Wave H C2 (G94-02): on a Core, bundled media is drawn for a demo item only, and always under its label. */}
        {live ? (
          <p className="evi-caption evi-strong" role="note" data-testid="evidence-demo-label">
            {t('evidence.itemFacts.media.demoLabel')}
          </p>
        ) : null}
        <div className="evi-player-stage">
          {poster ? <img src={poster} alt="" className="evi-player-poster" aria-hidden="true" /> : null}
          <motion.video
            key={camera}
            ref={videoRef}
            src={videoSrc ?? undefined}
            poster={poster ?? undefined}
            className="evi-player-video"
            muted
            playsInline
            loop
            preload="metadata"
            data-testid="evidence-video"
            data-track={camera}
            aria-label={t('evidence.media.videoLabel', { track: t(`common.tracks.${camera}`) })}
            initial={m.reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: m.seconds(CAMERA_SWITCH_FADE_MS), ease: 'linear' }}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
          />
          {AUDIO_TRACKS.map((id) => {
            const entry = track(id)
            return (
              <audio
                key={id}
                ref={(element) => {
                  audioRefs.current[id] = element
                }}
                src={urlFor(entry?.stored.path) ?? undefined}
                muted={mic !== id}
                loop
                preload="metadata"
                data-testid={`evidence-audio-${id}`}
                data-track={id}
                data-active={mic === id ? 'true' : 'false'}
              />
            )
          })}
        </div>

        <div className="evi-player-controls">
          <Button
            isIconOnly
            size="sm"
            variant="primary"
            aria-label={playing ? t('evidence.media.pause') : t('evidence.media.play')}
            onPress={() => (playing ? pause() : play())}
            data-testid="evidence-play-toggle"
          >
            {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          </Button>
          <span className="evi-mono evi-player-time" aria-live="off">
            {formatPlayerTime(position)} / {formatPlayerTime(totalSec)}
          </span>
          <Slider
            aria-label={t('evidence.media.scrub')}
            minValue={0}
            maxValue={Math.max(1, Math.floor(totalSec))}
            step={1}
            value={Math.floor(position)}
            onChange={(value) => seekTo(Array.isArray(value) ? (value[0] ?? 0) : value)}
            className="evi-player-scrub"
          >
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
        </div>

        <div className="evi-player-switches">
          <div className="evi-switch-group">
            <span className="evi-label">{t('evidence.media.camera')}</span>
            <ToggleButtonGroup aria-label={t('evidence.media.camera')} selectionMode="single" disallowEmptySelection selectedKeys={new Set<Key>([camera])} onSelectionChange={onCamera} size="sm">
              {VIDEO_TRACKS.map((id) => (
                <ToggleButton key={id} id={id} data-testid={`evidence-camera-${id}`}>
                  <Video className="size-3.5" aria-hidden="true" />
                  {t(`common.tracks.${id}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
          <div className="evi-switch-group">
            <span className="evi-label">{t('evidence.media.audio')}</span>
            <ToggleButtonGroup aria-label={t('evidence.media.audio')} selectionMode="single" disallowEmptySelection selectedKeys={new Set<Key>([mic])} onSelectionChange={onMic} size="sm" data-testid="evidence-mic-switch">
              {AUDIO_TRACKS.map((id) => (
                <ToggleButton key={id} id={id} data-testid={`evidence-mic-${id}`}>
                  <Mic className="size-3.5" aria-hidden="true" />
                  {id === 'AUDIO-01' ? t('common.devices.mic1') : t('common.devices.mic2')}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        </div>
        <p className="evi-caption" data-testid="evidence-excerpt-note">
          {t('evidence.media.excerptNote', { excerpt: formatPlayerTime(excerptSec), total: formatPlayerTime(totalSec) })}
        </p>
      </div>

      <ol className="evi-tracks" aria-label={t('evidence.detail.media.tracks')}>
        {pkg.tracks.map((entry) => {
          const isVideo = entry.trackId === 'VIDEO-01' || entry.trackId === 'VIDEO-02'
          const active = entry.trackId === camera || entry.trackId === mic
          const thumb = urlFor(entry.thumbnail?.path)
          return (
            <li key={entry.trackId}>
              <button
                type="button"
                className={cn('evi-track', active && 'evi-track-active')}
                aria-pressed={active}
                data-testid={`evidence-track-${entry.trackId}`}
                onClick={() => {
                  if (isVideo) onCamera(new Set<Key>([entry.trackId]))
                  else setMic(entry.trackId as AudioTrackId)
                }}
              >
                <span className="evi-track-thumb">
                  {isVideo && thumb ? <img src={thumb} alt="" width={64} height={36} decoding="async" /> : <AudioLines className="size-5" aria-hidden="true" />}
                </span>
                <span className="evi-track-text">
                  <span className="evi-strong">
                    {entry.trackId} · {t(`common.tracks.${entry.trackId}`)}
                  </span>
                  <span className="evi-caption">
                    {entry.file} · {t('evidence.media.excerptLength', { length: formatPlayerTime(entry.durationSec) })}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
