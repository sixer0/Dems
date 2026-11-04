// Asset renderers (04_mobile_specs §4.0, §8). Not UI primitives; the kit and the six compositions
// (src/components/composed) cover the UI (D6). Step 72 wired the real brand data, the W-05 still,
// the shared topographic texture and the bundled demo media (D50).
export { CameraFeed, type CameraFeedProps, type CameraFeedVideoSource } from './camera-feed';
export { Emblem, EmblemDraw, type EmblemDrawProps, type EmblemProps } from './emblem';
export { EMBLEM_PLACEHOLDER, type EmblemPathData } from './emblem-paths';
export { EMBLEM_SHARED, HERO_FOCUS, HERO_STILL, TOPO_XML } from './brand-assets';
export {
  DEMO_EVIDENCE_SUFFIXES,
  DEMO_MEDIA_EVIDENCE,
  DEMO_MEDIA_LIVE,
  demoMediaForEvidence,
  demoVideoAssetOf,
  liveLoopFor,
  type DemoAudioTrack,
  type DemoEvidenceSuffix,
  type DemoMediaAsset,
  type DemoMediaItem,
  type DemoVideoTrack,
} from './demo-media';
export { HeroBackdrop, type HeroBackdropProps } from './hero-backdrop';
export { mixHex, withAlpha } from './color';
