/**
 * Bundled demo media: the static require map (step 72; D50, D61, D64).
 *
 * `apps/mobile/assets/media/` holds a byte copy of step 92's 640 × 360 mobile subset
 * (`packages/shared/assets/demo-media/mobile/`, 84 files). Metro bundles only what is required
 * here, so the 720p desktop set never reaches the app. Requires must stay literal for Metro.
 *
 * - Join key (D61): the evidence number suffix, `'0001'` … `'0013'`. `DEMO_MEDIA_LIVE` is the
 *   recording scenario (session 0024): its loops repeat seamlessly and carry no clock and no REC
 *   (DR-92-7), so the UI overlays the time (CameraFeed) and REC (the screen's chip).
 * - Videos have no audio stream (DR-92-8). AUDIO-01 (MIC 1, interviewer) and AUDIO-02 (MIC 2,
 *   subject) are separate tracks and are never mixed.
 * - Clips are 31–47 s excerpts of each recording. A player that shows the full timeline maps a
 *   position p to p mod the clip duration and labels playback as a DEMO excerpt (64_demo_media §5).
 *   Durations and hashes live in `@dems/shared/demo-data` and `media-index.json`; this module
 *   holds no hash (P13).
 * - Evidence posters carry the burnt-in OSD of their clip; pass `showTimestamp={false}` and
 *   `showLabel={false}` when a CameraFeed shows one.
 *
 * Regenerating: run step 92's generator, then copy `packages/shared/assets/demo-media/mobile/*`
 * here unchanged (P6: only step 72 writes `apps/mobile/assets/media/**`). `demo-media.test.ts`
 * fails if a file is missing from this map, or if the map names a file that is not there.
 */
import type { VideoTrackId } from '@dems/shared/domain';

// D60 (2026-11-04): four simultaneous video tracks. The bundled corpus still ships VIDEO-01/02
// (step 92 regenerates it); tracks 3 and 4 join these records when their files arrive, exactly as
// core-web's resolver merges them (`demo-media.ts`, "join the set when the corpus carries them").
export type DemoVideoTrack = VideoTrackId;
export type DemoAudioTrack = 'AUDIO-01' | 'AUDIO-02';

/** A Metro asset id (the value of `require('…')`). */
export type DemoMediaAsset = number;

export interface DemoMediaItem {
  /** Partial: the corpus carries one entry per video track it ships (01/02 today, up to four since D60). */
  readonly video: Readonly<Partial<Record<DemoVideoTrack, DemoMediaAsset>>>;
  readonly audio: Readonly<Record<DemoAudioTrack, DemoMediaAsset>>;
  /** Frame at 1 s of each video the corpus ships (640 × 360 JPEG). */
  readonly poster: Readonly<Partial<Record<DemoVideoTrack, DemoMediaAsset>>>;
}

/** Evidence items with bundled media (EV 0001–0013; D61). */
export const DEMO_EVIDENCE_SUFFIXES = [
  '0001',
  '0002',
  '0003',
  '0004',
  '0005',
  '0006',
  '0007',
  '0008',
  '0009',
  '0010',
  '0011',
  '0012',
  '0013',
] as const;

export type DemoEvidenceSuffix = (typeof DEMO_EVIDENCE_SUFFIXES)[number];

export const DEMO_MEDIA_LIVE: DemoMediaItem = {
  video: {
    'VIDEO-01': require('../../../assets/media/live_video_01_loop.mp4'),
    'VIDEO-02': require('../../../assets/media/live_video_02_loop.mp4'),
  },
  audio: {
    'AUDIO-01': require('../../../assets/media/live_audio_01_loop.m4a'),
    'AUDIO-02': require('../../../assets/media/live_audio_02_loop.m4a'),
  },
  poster: {
    'VIDEO-01': require('../../../assets/media/live_video_01_poster.jpg'),
    'VIDEO-02': require('../../../assets/media/live_video_02_poster.jpg'),
  },
};

export const DEMO_MEDIA_EVIDENCE: Readonly<Record<DemoEvidenceSuffix, DemoMediaItem>> = {
  '0001': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0001_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0001_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0001_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0001_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0001_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0001_video_02_poster.jpg'),
    },
  },
  '0002': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0002_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0002_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0002_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0002_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0002_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0002_video_02_poster.jpg'),
    },
  },
  '0003': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0003_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0003_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0003_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0003_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0003_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0003_video_02_poster.jpg'),
    },
  },
  '0004': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0004_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0004_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0004_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0004_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0004_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0004_video_02_poster.jpg'),
    },
  },
  '0005': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0005_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0005_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0005_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0005_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0005_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0005_video_02_poster.jpg'),
    },
  },
  '0006': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0006_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0006_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0006_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0006_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0006_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0006_video_02_poster.jpg'),
    },
  },
  '0007': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0007_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0007_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0007_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0007_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0007_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0007_video_02_poster.jpg'),
    },
  },
  '0008': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0008_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0008_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0008_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0008_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0008_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0008_video_02_poster.jpg'),
    },
  },
  '0009': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0009_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0009_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0009_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0009_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0009_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0009_video_02_poster.jpg'),
    },
  },
  '0010': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0010_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0010_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0010_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0010_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0010_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0010_video_02_poster.jpg'),
    },
  },
  '0011': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0011_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0011_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0011_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0011_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0011_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0011_video_02_poster.jpg'),
    },
  },
  '0012': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0012_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0012_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0012_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0012_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0012_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0012_video_02_poster.jpg'),
    },
  },
  '0013': {
    video: {
      'VIDEO-01': require('../../../assets/media/evidence_0013_video_01.mp4'),
      'VIDEO-02': require('../../../assets/media/evidence_0013_video_02.mp4'),
    },
    audio: {
      'AUDIO-01': require('../../../assets/media/evidence_0013_audio_01.m4a'),
      'AUDIO-02': require('../../../assets/media/evidence_0013_audio_02.m4a'),
    },
    poster: {
      'VIDEO-01': require('../../../assets/media/evidence_0013_video_01_poster.jpg'),
      'VIDEO-02': require('../../../assets/media/evidence_0013_video_02_poster.jpg'),
    },
  },
};

/** Media of an evidence item by its number suffix (for example `'0007'` from `EV-20261001-0007`). */
export function demoMediaForEvidence(suffix: string): DemoMediaItem | undefined {
  return (DEMO_EVIDENCE_SUFFIXES as readonly string[]).includes(suffix)
    ? DEMO_MEDIA_EVIDENCE[suffix as DemoEvidenceSuffix]
    : undefined;
}

/** The live-feed loop of a camera (D60, 2026-11-04: four tracks). The corpus ships loops for 01/02
 * today; a track it does not ship yet shows the first loop — a placeholder, never a claim about the camera. */
export function liveLoopFor(cameraIndex: 1 | 2 | 3 | 4): DemoMediaAsset {
  return DEMO_MEDIA_LIVE.video[`VIDEO-0${cameraIndex}`] ?? DEMO_MEDIA_LIVE.video['VIDEO-01'] ?? 0;
}

/** The video or poster asset of a track, with the same D60 placeholder rule as `liveLoopFor`. */
export function demoVideoAssetOf(item: DemoMediaItem, kind: 'video' | 'poster', track: DemoVideoTrack): DemoMediaAsset {
  return item[kind][track] ?? item[kind]['VIDEO-01'] ?? 0;
}
