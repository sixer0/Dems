/**
 * Media lookup for the Evidence screens (D50, D61; step 72's bundled 640 × 360 subset).
 *
 * Join by the evidence number suffix: EV 0001–0013 use `DEMO_MEDIA_EVIDENCE`; the recording
 * scenario's item (evidence 0014, 65 §2) uses the live loops; any later item has no DEMO media.
 * Clip lengths come from the DEMO package (`excerptDurationMs`), never from literals (P13).
 */
import type { DemoEvidencePackage } from '@dems/shared/demo-data';
// Direct module imports: the media barrel also loads the Skia renderers, which pure code avoids.
import { HERO_STILL } from '@/components/media/brand-assets';
import { DEMO_MEDIA_LIVE, demoMediaForEvidence, type DemoMediaAsset, type DemoMediaItem } from '@/components/media/demo-media';
import { evidenceSuffixOf, isLiveLoopEvidence } from './evidence-model';

/** Bundled media of an evidence item, or null when this device has none for it. */
export function mediaForEvidence(evidenceId: string): DemoMediaItem | null {
  const suffix = evidenceSuffixOf(evidenceId);
  if (suffix === null) return null;
  return demoMediaForEvidence(suffix) ?? (isLiveLoopEvidence(suffix) ? DEMO_MEDIA_LIVE : null);
}

/** The poster for rows and the hero: Camera 1's poster, else the W-05 room still. */
export function posterForEvidence(evidenceId: string): DemoMediaAsset {
  return mediaForEvidence(evidenceId)?.poster['VIDEO-01'] ?? HERO_STILL;
}

/** Length of the DEMO excerpt every track covers, in ms (0 when there is no package). */
export function clipMsFor(pkg: DemoEvidencePackage | null): number {
  return pkg?.excerptDurationMs ?? 0;
}
