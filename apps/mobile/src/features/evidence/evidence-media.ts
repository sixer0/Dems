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

/**
 * The poster for rows and the hero: Camera 1's poster, else the W-05 room still.
 *
 * RESIDUAL-W74-2 (W83 ledger #50) (backend task W74; 01_specs MS-2): in Live mode a row of the list still joins
 * its poster by the evidence number, because an item of operation 39's `EvidencePage` carries no
 * `EvidenceMediaRef`; only operation 40 does, one item per call. The detail asks operation 40 and
 * uses `posterOf` with the media the Core named. A media reference on the list's items (or on the
 * replicated `evidence` slice) would let the rows follow MS-2 as well.
 */
export function posterForEvidence(evidenceId: string): DemoMediaAsset {
  return posterOf(mediaForEvidence(evidenceId));
}

/** Camera 1's poster of the bundled media given, else the W-05 room still (Live: media the Core named, W74). */
export function posterOf(media: DemoMediaItem | null): DemoMediaAsset {
  return media?.poster['VIDEO-01'] ?? HERO_STILL;
}

/** Length of the DEMO excerpt every track covers, in ms (0 when there is no package). */
export function clipMsFor(pkg: DemoEvidencePackage | null): number {
  return pkg?.excerptDurationMs ?? 0;
}
