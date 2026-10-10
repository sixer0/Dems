import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Chip, toast } from '@heroui/react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type Transition,
} from 'motion/react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { AudioTrackId } from '@dems/shared/domain'
import { settle, useCoreActions, type CoreActions } from '@dems/shared/live'
import { captureMicLines, micInputOfChannel, noInputFrame, useAudioChannel, useSimInstance, type AudioFrame } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { reportMeterFrame, tween, useMotionPolicy } from '@/motion'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { cn } from '@/lib/utils'
import { webErrorSink } from '@/runtime'
import {
  ariaValueNow,
  createFrameGate,
  formatDbfsValue,
  METER_MAX_DB,
  METER_MIN_DB,
  METER_THRESHOLDS,
  peakPosition,
  segmentColor,
  segmentInputRange,
  SEGMENT_REST_OPACITY,
  staircaseHeight,
} from './dbfs-meter.math'

export type DbfsMeterVariant = 'tile' | 'panel' | 'large' | 'compact'
export type DbfsMeterOrientation = 'vertical' | 'horizontal'

export interface DbfsMeterProps {
  channel: AudioTrackId
  variant: DbfsMeterVariant
  /** Default: `vertical` for `large`, `horizontal` (a left-to-right staircase) otherwise. */
  orientation?: DbfsMeterOrientation
  /** Pause Monitoring (UI-only, D28/Q8; M-C-20): dims to 0.35; recording continues. */
  monitoringPaused?: boolean
  /** Accessible name. Default: the track name, e.g. "MIC 1 - Interviewer". */
  label?: string
  /** Show the dBFS readout (default true). */
  showReadout?: boolean
  className?: string
}

/** M-C-04 literals (D49): the CLIP flash, the NO SIGNAL fade and the monitoring-paused dim. */
export const CLIP_FLASH_MS = 180
export const NO_SIGNAL_FADE_MS = 400
const PAUSED_OPACITY = 0.35
/** P8: fast-changing number text at most 4 Hz; the ARIA value at 1 Hz (§14.6). */
const READOUT_GAP_MS = 1000 / tokens.threshold.numberTextMaxHz
const ARIA_GAP_MS = 1000
const NO_SIGNAL_DB = -90

const LAYOUT: Record<
  DbfsMeterVariant,
  { track: string; bar: string; gap: string; staircase: boolean; readout: string; stack: string }
> = {
  tile: { track: 'h-14', bar: 'w-1.5', gap: 'gap-[3px]', staircase: true, readout: 'text-body', stack: 'flex-col items-center gap-2' },
  panel: { track: 'h-16', bar: 'w-[7px]', gap: 'gap-[3px]', staircase: true, readout: 'text-h3', stack: 'flex-col items-center gap-2' },
  compact: { track: 'h-3.5', bar: 'w-1', gap: 'gap-0.5', staircase: false, readout: 'text-caption', stack: 'flex-row items-center gap-2' },
  large: { track: 'h-48 w-6', bar: 'h-full', gap: 'gap-1', staircase: false, readout: 'text-body', stack: 'flex-col items-center gap-2' },
}

/** Writes into the text node React rendered (so a later React update edits the same node). */
/** The fixed sentence of the meter's own record when a clip reset fails for a reason the presenter left to it. */
const CLIP_RESET_FAILED_RECORD = 'A clip latch reset from an audio meter was not carried out.'

/**
 * The CLIP chip's reset (plan row W0, item 4; decision D154 DN-3, finding F-3 of W65): the simulator's
 * action in Simulated mode, operation 52 `resetMicClip` in Live mode, consumed through `settle` in both
 * (rule 1 of the page rows). A refusal goes to the refusal presenter first (rule 2: a 403, an outage, a
 * time-out and a 429 have its words); what it leaves to the meter (a 400 or 422 the operator cannot
 * correct) gets the console's generic sentence and one record in the page's own log — a fixed
 * message and the cause's name, code and status, never its text (CPW1-8). A simulator never refuses a
 * reset, so Simulated mode is unchanged.
 */
function resetClip(
  actions: CoreActions,
  channel: AudioTrackId,
  presentCoreError: ReturnType<typeof useCoreErrorPresenter>,
  t: TFunction,
): void {
  settle(() => actions.resetClip(channel), {
    fail: (error) => {
      if (presentCoreError(error) !== null) return
      const { code, status } = typeof error === 'object' && error !== null ? (error as { code?: unknown; status?: unknown }) : {}
      webErrorSink.report({
        level: 'error',
        source: 'components/composed.DbfsMeter.resetClip',
        message: CLIP_RESET_FAILED_RECORD,
        at: Date.now(),
        context: {
          channel,
          errorName: error instanceof Error ? error.name : typeof error,
          ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
          ...(typeof status === 'number' ? { status } : {}),
        },
      })
      toast.danger(t('common.errors.generic'))
    },
  })
}

function setText(element: HTMLElement, text: string) {
  const node = element.firstChild
  if (node && node.nodeType === Node.TEXT_NODE) {
    if (node.nodeValue !== text) node.nodeValue = text
  } else {
    element.textContent = text
  }
}

interface SegmentProps {
  level: MotionValue<number>
  threshold: number
  index: number
  vertical: boolean
  staircase: boolean
  barClass: string
  /** Only the top segment: the CLIP latch locks it at full opacity. */
  clipLatch: MotionValue<number> | null
}

const MeterSegment = memo(function MeterSegment({
  level,
  threshold,
  index,
  vertical,
  staircase,
  barClass,
  clipLatch,
}: SegmentProps) {
  const ranged = useTransform(level, segmentInputRange(threshold), [SEGMENT_REST_OPACITY, 1])
  const locked = useTransform(() => (clipLatch && clipLatch.get() > 0 ? 1 : ranged.get()))
  const color = segmentColor(threshold)
  const size = staircase ? `${Math.round(staircaseHeight(index) * 100)}%` : '100%'
  return (
    <motion.span
      data-meter-segment={threshold}
      className={cn('block shrink-0 rounded-[2px]', vertical ? 'w-full flex-1' : barClass)}
      style={{
        opacity: clipLatch ? locked : ranged,
        backgroundColor: color,
        // Static inner glow on lit segments (M-C-04); only opacity ever animates.
        boxShadow: `inset 0 0 4px ${color}`,
        ...(vertical ? {} : { height: size }),
      }}
    />
  )
})

/**
 * DbfsMeter (01_specs §14.6; 03_motion_spec M-C-04).
 *
 * Ten segments (−60 … −20 green, −14 / −9 amber, −5 / −2 red), a peak-hold tick, a CLIP latch
 * `Chip` and a mono dBFS readout. It reads the **transient** audio channel (`useAudioChannel`,
 * 20 Hz) straight into Motion values, so audio frames never re-render React (§9.3, MS-08):
 * - level → `useSpring(meter)` (60 fps smoothing; set directly under reduced motion at 10 Hz);
 * - each segment's opacity is `useTransform(level, [t−1, t], [0.12, 1])`;
 * - the peak tick is a transform of the simulator's peak-hold value (1.5 s hold, 20 dB/s);
 * - the readout text is written at ≤ 4 Hz and `aria-valuenow` / `aria-valuetext` at 1 Hz,
 *   both straight to the DOM;
 * - React state changes only when CLIP or NO SIGNAL flips.
 * Every applied frame calls `reportMeterFrame(channel)` for the `?debug=1` overlay (AC-61).
 */
export function DbfsMeter({
  channel,
  variant,
  orientation,
  monitoringPaused = false,
  label,
  showReadout = true,
  className,
}: DbfsMeterProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const sim = useSimInstance()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const vertical = (orientation ?? (variant === 'large' ? 'vertical' : 'horizontal')) === 'vertical'
  const layout = LAYOUT[variant]

  // The frame at mount seeds the attributes React renders; later values go straight to the DOM.
  // The meters slice is keyed by mic input since schema v2 (SH-17); the channel a caller names maps
  // to the input that feeds it, the same input `useAudioChannel` subscribes below.
  // Ruling D137: the input is the microphone line at the channel's position; an input that has
  // delivered no frame yet (a pair beyond the built-in inputs, just selected) starts at NO SIGNAL.
  const initial = useMemo((): AudioFrame => {
    const state = sim.store.getState()
    const frame: AudioFrame | undefined = state.audio.inputs[micInputOfChannel(captureMicLines(state), channel)]
    return frame ?? noInputFrame(state.clock.now)
  }, [sim, channel])
  const initialDb = initial.noSignal ? NO_SIGNAL_DB : initial.dbfs

  const level = useMotionValue(initialDb)
  const peak = useMotionValue(initial.noSignal ? NO_SIGNAL_DB : initial.peak)
  const clipLatch = useMotionValue(initial.clip ? 1 : 0)
  const springOptions = m.flags.meterSpring ?? m.springOptions('meter')
  const smoothed = useSpring(level, springOptions)
  const driven = m.flags.meterSpring ? smoothed : level

  const peakPos = useTransform(peak, (db) => peakPosition(db))
  const peakOffset = useTransform(peakPos, (p) => `${(vertical ? -1 : 1) * Math.max(0, p) * 100}%`)
  const peakOpacity = useTransform(peakPos, (p) => (p < 0 ? 0 : 0.9))

  const [clip, setClip] = useState(initial.clip)
  const [noSignal, setNoSignal] = useState(initial.noSignal)
  const flags = useRef({ clip: initial.clip, noSignal: initial.noSignal })

  const meterRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  const minVisualGap = m.flags.meterMaxHz ? 1000 / m.flags.meterMaxHz : 0
  const gates = useMemo(
    () => ({
      visual: createFrameGate(minVisualGap),
      readout: createFrameGate(READOUT_GAP_MS),
      aria: createFrameGate(ARIA_GAP_MS),
    }),
    [minVisualGap],
  )

  const writeText = useCallback((frame: AudioFrame, force: boolean) => {
    const translate = tRef.current
    if (force || gates.readout.take(frame.at)) {
      const readout = readoutRef.current
      if (readout) {
        setText(readout, frame.noSignal ? '—' : translate('common.units.dbfs', { value: formatDbfsValue(frame.dbfs) }))
      }
    }
    if (force || gates.aria.take(frame.at)) {
      const meter = meterRef.current
      if (meter) {
        const db = frame.noSignal ? METER_MIN_DB : frame.dbfs
        meter.setAttribute('aria-valuenow', String(ariaValueNow(db)))
        meter.setAttribute(
          'aria-valuetext',
          frame.noSignal
            ? translate('common.status.noSignal')
            : translate('common.units.dbfs', { value: formatDbfsValue(frame.dbfs) }),
        )
      }
    }
  }, [gates])

  const onFrame = useCallback(
    (frame: AudioFrame) => {
      const flipped = frame.clip !== flags.current.clip || frame.noSignal !== flags.current.noSignal
      if (!flipped && !gates.visual.take(frame.at)) return
      level.set(frame.noSignal ? NO_SIGNAL_DB : frame.dbfs)
      peak.set(frame.noSignal ? NO_SIGNAL_DB : frame.peak)
      clipLatch.set(frame.clip ? 1 : 0)
      reportMeterFrame(channel)
      writeText(frame, flipped)
      if (frame.clip !== flags.current.clip) {
        flags.current.clip = frame.clip
        setClip(frame.clip)
      }
      if (frame.noSignal !== flags.current.noSignal) {
        flags.current.noSignal = frame.noSignal
        setNoSignal(frame.noSignal)
      }
    },
    [channel, clipLatch, gates, level, peak, writeText],
  )
  useAudioChannel(channel, onFrame)

  const accessibleName = label ?? t(`common.tracks.${channel}`)
  const initialText = initial.noSignal
    ? t('common.status.noSignal')
    : t('common.units.dbfs', { value: formatDbfsValue(initial.dbfs) })
  const initialReadout = initial.noSignal ? '—' : initialText
  const clipTransition: Transition = m.flags.flashes
    ? { scale: m.transitions.completion, opacity: tween(CLIP_FLASH_MS, 'standard', m.timeScale) }
    : m.transitions.crossFade
  const fade = tween(m.reduced ? tokens.duration.fast : NO_SIGNAL_FADE_MS, 'standard', m.timeScale)

  return (
    <div
      data-testid="dbfs-meter"
      data-channel={channel}
      data-variant={variant}
      data-orientation={vertical ? 'vertical' : 'horizontal'}
      data-motion={m.policy}
      data-clip={clip ? 'latched' : undefined}
      data-no-signal={noSignal ? 'true' : undefined}
      className={cn('relative inline-flex', layout.stack, className)}
    >
      <motion.div
        className={cn('relative inline-flex', layout.stack)}
        initial={false}
        animate={{ opacity: monitoringPaused ? PAUSED_OPACITY : 1 }}
        transition={m.transitions.crossFade}
      >
        <div
          ref={meterRef}
          role="meter"
          aria-label={accessibleName}
          aria-valuemin={METER_MIN_DB}
          aria-valuemax={METER_MAX_DB}
          aria-valuenow={ariaValueNow(initial.noSignal ? METER_MIN_DB : initialDb)}
          aria-valuetext={initialText}
          className={cn(
            'relative flex',
            vertical ? 'flex-col-reverse' : 'flex-row items-end',
            layout.track,
            layout.gap,
          )}
        >
          {METER_THRESHOLDS.map((threshold, index) => (
            <MeterSegment
              key={`${m.policy}-${threshold}`}
              level={driven}
              threshold={threshold}
              index={index}
              vertical={vertical}
              staircase={layout.staircase && !vertical}
              barClass={layout.bar}
              clipLatch={index === METER_THRESHOLDS.length - 1 ? clipLatch : null}
            />
          ))}

          {/* Peak-hold tick: a full-size layer moved by a percentage of its own size (no layout). */}
          <motion.span
            aria-hidden="true"
            data-meter-peak=""
            className="pointer-events-none absolute inset-0"
            style={vertical ? { y: peakOffset, opacity: peakOpacity } : { x: peakOffset, opacity: peakOpacity }}
          >
            <span
              className={cn(
                'absolute bg-foreground/90',
                vertical ? 'inset-x-0 bottom-0 h-0.5' : 'inset-y-0 left-0 -ml-px w-0.5',
              )}
            />
          </motion.span>

          <AnimatePresence>
            {noSignal ? (
              <motion.span
                key="flat"
                aria-hidden="true"
                data-meter-flat=""
                className={cn(
                  'pointer-events-none absolute border-dashed border-muted',
                  vertical ? 'inset-y-0 left-1/2 border-l' : 'inset-x-0 bottom-0 border-t',
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fade}
              />
            ) : null}
          </AnimatePresence>
        </div>

        {showReadout ? (
          <span className="relative inline-flex items-center">
            <AnimatePresence initial={false} mode="popLayout">
              {noSignal ? (
                <motion.span
                  key="no-signal"
                  className={cn('font-mono uppercase text-muted', layout.readout)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                >
                  {t('session.feed.noSignal')}
                </motion.span>
              ) : null}
            </AnimatePresence>
            <span
              ref={readoutRef}
              aria-hidden="true"
              data-meter-readout=""
              className={cn('font-mono tabular-nums text-foreground', layout.readout, noSignal && 'sr-only')}
            >
              {initialReadout}
            </span>
          </span>
        ) : null}
      </motion.div>

      <AnimatePresence>
        {clip ? (
          <motion.span
            key="clip"
            className="inline-flex"
            initial={m.flags.flashes ? { scale: 0.8, opacity: 1 } : { opacity: 0 }}
            animate={m.flags.flashes ? { scale: 1, opacity: [1, 0.4, 1] } : { opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={clipTransition}
          >
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${t('session.audio.clipReset')}: ${accessibleName}`}
              className="h-auto min-w-0 p-0"
              onPress={() => resetClip(actions, channel, presentCoreError, t)}
            >
              <Chip
                color="danger"
                variant="soft"
                size="sm"
                className={cn('font-mono font-semibold', !m.flags.flashes && 'border border-danger')}
              >
                <Chip.Label>{t('common.enums.micState.CLIP')}</Chip.Label>
              </Chip>
            </Button>
          </motion.span>
        ) : null}
      </AnimatePresence>

      {monitoringPaused && (variant === 'panel' || variant === 'large') ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-caption text-foreground-2">
          {t('session.feed.monitoringPaused')}
        </span>
      ) : null}
    </div>
  )
}
