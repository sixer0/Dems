# src/components/media

Up: [src/components](../README.md)

## Purpose

Media renderers (step 39). `CameraFeed` plays the demo videos with a procedural canvas fallback and is the frame for camera tiles; `RecIndicator` is its REC overlay and can also be used on its own. The folder also holds the page-wide live video decode budget and the simulator clock readers used by overlays.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit tests of the camera feed and the decode budget |
| [`camera-feed.css`](camera-feed.css) | Standby sweep of a tile that waits for the page's live decode slot; only `transform` moves, none under reduced motion |
| [`camera-feed.math.ts`](camera-feed.math.ts) | Pure maths of the procedural feed: still size, per-camera framing, Ken Burns scale and source rectangle, scanline position, OSD timestamp and label, backing size |
| [`camera-feed.tsx`](camera-feed.tsx) | `CameraFeed`: video, procedural fallback or NO SIGNAL, with camera switch cross-fade and a load timeout |
| [`demo-media.ts`](demo-media.ts) | Demo media resolver: turns the shared `demo-media` asset folder into URL strings (live video and audio, evidence media, excerpt position) |
| [`feed-scheduler.ts`](feed-scheduler.ts) | One shared animation-frame loop for every procedural canvas; each painter declares its own rate; runs only while a painter is registered |
| [`index.ts`](index.ts) | Barrel export of the folder |
| [`live-decode-budget.ts`](live-decode-budget.ts) | Page-wide rule that at most one live tile video decodes at a time; `useLiveDecodeSlot` grants the slot by priority |
| [`procedural-feed.ts`](procedural-feed.ts) | Procedural camera renderer: graded crop of the hero still with Ken Burns, film grain, scanline band and vignette; noise painter for NO SIGNAL |
| [`rec-indicator.tsx`](rec-indicator.tsx) | `RecIndicator`: REC chip with a pulsing halo and, when given a start time on the simulator clock, a timer |
| [`use-sim-clock.ts`](use-sim-clock.ts) | `useSimSecond` (re-render once per simulator second) and `useSimNowReader` (render-free time reader); fall back to the wall clock outside a simulator provider |

## Main exports

| Export | Used by |
|---|---|
| `CameraFeed`, `CameraFeedProps` | [devices](../../features/devices/) (camera preview) |
| `CameraFeedHandle` (type) | [session-monitor](../../features/session-monitor/) (page, action bar, live feed panel) |
| `RecIndicator` | devices (camera preview), session-monitor (live feed panel), [composed](../composed/README.md) (glow ring) |
| `useSimSecond` | devices (LCD display, health chart), session-monitor (details and live feed panels) |
| `evidenceMedia` and other demo media helpers (`demo-media.ts`) | [evidence](../../features/evidence/) |

## Core operations, state and shared modules

- No Core operation is called here.
- Shared package modules: `@dems/shared/domain`, `@dems/shared/live`, `@dems/shared/sim` (simulator clock), `@dems/shared/realtime`, `@dems/shared/tokens`, and the asset `@dems/shared/assets/hero/room-2560.jpg` (procedural still).
- Console modules: [`demo-mark.tsx`](../demo-mark.tsx), [ui](../ui/README.md) (`SlidingNumber` in the REC indicator), [src/motion](../../motion/), `src/lib/utils`.

## Tests

- [`__tests__/`](__tests__/): `camera-feed.test.tsx`, `live-decode-budget.test.tsx`.
- In [src/test](../../test/): `live-w0-camera-words.test.tsx` (camera feed maths and procedural feed).

## Related decisions

- D253 (M3 row 230): names `components/media/camera-feed.tsx` line 85 comment ("CAM-1 or CAM-2") as a later hygiene leftover.
