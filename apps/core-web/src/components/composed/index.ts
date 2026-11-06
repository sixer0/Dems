/**
 * The custom compositions (01_specs §14.6; D6: the only non-kit UI besides the AppShell).
 * Motion follows 03_motion_spec §5 (M-C-01, M-C-04, M-C-08, M-C-09).
 */
export { GlowRing, type GlowRingMode, type GlowRingProps, type GlowRingState } from './glow-ring'
export { isEscalation, RING_COLOURS, RING_MODE_SIZE, stateRank } from './glow-ring.math'
export {
  CLIP_FLASH_MS,
  DbfsMeter,
  NO_SIGNAL_FADE_MS as METER_NO_SIGNAL_FADE_MS,
  type DbfsMeterOrientation,
  type DbfsMeterProps,
  type DbfsMeterVariant,
} from './dbfs-meter'
export {
  ariaValueNow,
  formatDbfsValue,
  litSegments,
  METER_THRESHOLDS,
  peakPosition,
  segmentOpacity,
  segmentTone,
} from './dbfs-meter.math'
export { AudioSourceBand, type AudioSourceBandInterval, type AudioSourceBandMark, type AudioSourceBandProps, type AudioSourceBandSegment } from './audio-source-band'
export { audioSourceBandSegments, formatMediaMs } from './audio-source-band.math'
export { timelineNodeStyle } from './session-timeline.math'
export {
  SessionTimeline,
  TIMELINE_LINE_MS,
  TIMELINE_TEXT_MS,
  USER_SCROLL_QUIET_MS,
  type SessionTimelineProps,
  type TimelineEvent,
  type TimelineNodeStyle,
} from './session-timeline'
export {
  CHECK_DRAW_MS,
  CONNECTOR_FILL_MS,
  STAMP_GLOW_MS,
  STAMP_RING_MS,
  Stepper,
  StepperStamp,
  type StepperProps,
  type StepperStampProps,
  type StepperStatus,
  type StepperStep,
} from './stepper'
