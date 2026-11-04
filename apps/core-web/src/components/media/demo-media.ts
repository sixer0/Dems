/**
 * Demo media resolver (D50; implementation/64_demo_media.md §5, §10).
 *
 * Step 92 generated the demo videos, posters and MIC tracks under
 * `packages/shared/assets/demo-media/` (desktop: 1280×720 H.264, 25 fps, no audio stream; MIC
 * tracks are separate AAC files). This module turns that folder into URL strings with one Vite
 * `import.meta.glob` (eager, `?url`): Vite serves the files in development and copies them into
 * `dist/assets` on build, and the module itself carries only the URL strings.
 *
 * Why a workspace-relative glob: Vite 8 rejects a bare package specifier in a glob
 * (`Invalid glob: "@dems/shared/assets/demo-media/…" … It must start with '/' or './'`), so the
 * pattern names the same folder relative to this file. The single hero still keeps the package
 * export (`@dems/shared/assets/*`) in `procedural-feed.ts`.
 *
 * Rules kept from step 92 (P13, D61):
 * - Join media to the simulator by the evidence number (the `NNNN` suffix of `EV-YYYYMMDD-NNNN`).
 *   Items without media return `null`, and the caller falls back (procedural feed, no player).
 * - Never hard-code hashes; `media-index.json` is not imported (81 KB), only file URLs.
 * - Live loops (the recording scenario) repeat seamlessly and carry no clock or REC: the UI
 *   overlays them. Evidence clips are 31–47 s excerpts: map a position p on the full recording
 *   to `p mod excerptDuration` (`excerptPositionSec`) and label playback as a DEMO excerpt.
 * - The mobile subset (`demo-media/mobile/`) is not globbed: the web never ships it.
 */
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain'

const FILES = import.meta.glob<string>(
  [
    '../../../../../packages/shared/assets/demo-media/live/*.{mp4,m4a,jpg}',
    '../../../../../packages/shared/assets/demo-media/evidence/*/*.{mp4,m4a,jpg}',
  ],
  { query: '?url', import: 'default', eager: true },
)

const MARKER = '/demo-media/'

/** `live/VIDEO-01.loop.mp4` → URL, keyed by the path under `demo-media/`. */
const URLS: ReadonlyMap<string, string> = new Map(
  Object.entries(FILES).map(([key, url]) => [key.slice(key.lastIndexOf(MARKER) + MARKER.length), url]),
)

/** URL of a file under `demo-media/` (for example `live/VIDEO-01.loop.mp4`), or `null`. */
export function demoMediaUrl(relativePath: string): string | null {
  return URLS.get(relativePath) ?? null
}

/** Every resolved relative path, sorted (diagnostics and tests). */
export function demoMediaPaths(): string[] {
  return [...URLS.keys()].sort()
}

export interface VideoMedia {
  /** The MP4 (no audio stream). */
  src: string
  /** 1280×720 frame at 1 s. */
  poster: string | null
  /** 320×180 frame at 1 s. */
  thumb: string | null
}

/** Live-feed loop of a camera for the recording scenario (muted, looped, seamless). */
export function liveVideo(cameraId: VideoTrackId): VideoMedia | null {
  const src = demoMediaUrl(`live/${cameraId}.loop.mp4`)
  if (!src) return null
  return {
    src,
    poster: demoMediaUrl(`live/${cameraId}.poster.jpg`),
    thumb: demoMediaUrl(`live/${cameraId}.thumb.jpg`),
  }
}

/** Live MIC loop of a channel (a separate AAC track; played beside the video when wanted). */
export function liveAudio(channel: AudioTrackId): string | null {
  return demoMediaUrl(`live/${channel}.loop.m4a`)
}

export interface EvidenceMedia {
  evidenceSuffix: string
  /** D60 (2026-11-04): one entry per video track the demo corpus carries; the generator ships 01/02 today. */
  video: Partial<Record<VideoTrackId, VideoMedia>>
  audio: Record<AudioTrackId, string>
}

const SUFFIX_PATTERN = /^EV-\d{8}-(\d{4})$/

/**
 * The join key of an evidence item: the four-digit suffix of `EV-YYYYMMDD-NNNN` (D61). A bare
 * four-digit suffix is returned as it is; anything else gives `null`.
 */
export function evidenceSuffixOf(evidenceIdOrSuffix: string): string | null {
  if (/^\d{4}$/.test(evidenceIdOrSuffix)) return evidenceIdOrSuffix
  return SUFFIX_PATTERN.exec(evidenceIdOrSuffix)?.[1] ?? null
}

/**
 * The four tracks and the posters of one evidence item, or `null` when the item has no complete
 * media set (the caller then shows its fallback). Accepts `EV-…-0001` or `0001`.
 */
export function evidenceMedia(evidenceIdOrSuffix: string): EvidenceMedia | null {
  const suffix = evidenceSuffixOf(evidenceIdOrSuffix)
  if (!suffix) return null
  const video = (track: VideoTrackId): VideoMedia | null => {
    const src = demoMediaUrl(`evidence/${suffix}/${track}.mp4`)
    if (!src) return null
    return {
      src,
      poster: demoMediaUrl(`evidence/${suffix}/${track}.poster.jpg`),
      thumb: demoMediaUrl(`evidence/${suffix}/${track}.thumb.jpg`),
    }
  }
  const v1 = video('VIDEO-01')
  const v2 = video('VIDEO-02')
  // D60 (2026-11-04): tracks 3 and 4 join the set when the corpus carries their files; the demo
  // baseline (01/02 + both MIC tracks) stays the completeness bound.
  const v3 = video('VIDEO-03')
  const v4 = video('VIDEO-04')
  const a1 = demoMediaUrl(`evidence/${suffix}/AUDIO-01.m4a`)
  const a2 = demoMediaUrl(`evidence/${suffix}/AUDIO-02.m4a`)
  if (!v1 || !v2 || !a1 || !a2) return null
  return {
    evidenceSuffix: suffix,
    video: { 'VIDEO-01': v1, 'VIDEO-02': v2, ...(v3 ? { 'VIDEO-03': v3 } : {}), ...(v4 ? { 'VIDEO-04': v4 } : {}) },
    audio: { 'AUDIO-01': a1, 'AUDIO-02': a2 },
  }
}

/** Evidence suffixes that have a complete media set, ascending. */
export function evidenceMediaSuffixes(): string[] {
  const suffixes = new Set<string>()
  for (const path of URLS.keys()) {
    const match = /^evidence\/(\d{4})\//.exec(path)
    if (match?.[1]) suffixes.add(match[1])
  }
  return [...suffixes].filter((suffix) => evidenceMedia(suffix) !== null).sort()
}

/**
 * Step 92's excerpt rule: a position on the full recording maps into the excerpt that the demo
 * clip covers (`p mod excerptDuration`). Both values in seconds; a non-positive duration gives 0.
 */
export function excerptPositionSec(positionSec: number, excerptDurationSec: number): number {
  if (!(excerptDurationSec > 0) || !Number.isFinite(positionSec)) return 0
  const wrapped = positionSec % excerptDurationSec
  return wrapped < 0 ? wrapped + excerptDurationSec : wrapped
}
