/**
 * Media renderers (step 39; 01_specs §14.6 "not a UI primitive", §14.10 as amended by D50).
 * CameraFeed plays the step-92 demo videos with a procedural canvas fallback; RecIndicator is its
 * REC overlay (M-C-05), also usable on its own (Dashboard D recording thumbnail).
 */
export {
  CameraFeed,
  CAMERA_SWITCH_MS,
  DEFAULT_LOAD_TIMEOUT_MS,
  NO_SIGNAL_FADE_MS,
  type CameraFeedFallbackReason,
  type CameraFeedHandle,
  type CameraFeedMode,
  type CameraFeedProps,
  type CameraFeedVariant,
} from './camera-feed'
export { RecIndicator, type RecIndicatorProps } from './rec-indicator'
export {
  demoMediaPaths,
  demoMediaUrl,
  evidenceMedia,
  evidenceMediaSuffixes,
  evidenceSuffixOf,
  excerptPositionSec,
  liveAudio,
  liveVideo,
  type EvidenceMedia,
  type VideoMedia,
} from './demo-media'
export { useSimNowReader, useSimSecond } from './use-sim-clock'
export { activeFeedPainters, scheduleFeedPainter } from './feed-scheduler'
export {
  LIVE_DECODE_BUDGET,
  liveDecodersGranted,
  liveDecodersRequested,
  useLiveDecodeSlot,
  type LiveDecodePriority,
  type LiveDecodeSlot,
} from './live-decode-budget'
