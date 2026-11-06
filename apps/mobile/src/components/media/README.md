# `apps/mobile/src/components/media`

Up: [`src/components/`](../README.md)

## Purpose

Asset renderers (not UI primitives): the brand emblem with its draw-on animation, the hero backdrop with the topographic texture, and `CameraFeed`, which plays the bundled demo media for the Simulated Core or a live video source. Brand data comes from the shared brand module; `demo-media.ts` maps the bundled media files.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `brand-assets.ts` | Brand data and stills for the mobile asset renderers. One source for web and mobile: - `EMBLEM_SHARED` |
| `brand-media.test.ts` | Test: The bundled brand PNGs, the hero still and the demo media are byte copies of their shared sources, the static require map covers exactly the bundled media, and app.json points the launcher icon ... |
| `camera-feed-video.test.tsx` | Test: CameraFeed video path: expo-video plays the bundled clip, a transparent overlay burns in the time and label, and the step-71 procedural renderer takes over when there is no clip or when the player fails. expo-video ... |
| `camera-feed.math.ts` | CameraFeed maths: framing per camera, Ken Burns, grain re-seeding, the scanline sweep and the burnt-in timestamp. Worklet-safe; the timestamp is plain arithmetic at UTC+07:00 (no `Intl`, H-MB-08). |
| `camera-feed.tsx` | CameraFeed asset renderer: two renderers (bundled demo media and a live video source) behind one API. |
| `color.ts` | Paint helpers for the Skia and SVG renderers. Every colour starts as a token from `@dems/shared/tokens`; these helpers only derive alpha and mixed variants, so no colour literal lives in `src/components`. |
| `demo-media.ts` | Bundled demo media: the static require map. `apps/mobile/assets/media/` holds a byte copy of step 92's 640 × 360 mobile subset (`packages/shared/assets/demo-media/mobile/`, 84 files). |
| `emblem-paths.ts` | Emblem path-data contract, the step-71 PLACEHOLDER shape and the boot draw timing. Since step 72 the renderers default to the shared brand module from step 35 (`@dems/shared/brand`, SCR-03) through `EMBLEM_SHARED` in ... |
| `emblem.tsx` | Emblem asset renderer: `Emblem` and the draw-on `EmblemDraw`. |
| `hero-backdrop.math.ts` | HeroBackdrop maths: a deterministic placeholder topographic texture until step 72 passes the shared `topo.svg` (SCR-06). |
| `hero-backdrop.tsx` | HeroBackdrop asset renderer. The licensed room still, graded black 45 % plus a bronze wash (`expo-linear-gradient`), the shared topographic texture with its brightest line at 15–30 %, and two static diagonal light ... |
| `index.ts` | Public surface of the asset renderers (re-exports). |
| `media.test.tsx` | Test: Asset renderers: CameraFeed, Emblem and HeroBackdrop maths plus render smoke. |

## Main exports

- Public surface (`index.ts`): `CameraFeed`, `Emblem`, `EmblemDraw`, `EMBLEM_PLACEHOLDER`, `EMBLEM_SHARED`, `HERO_FOCUS`, `HERO_STILL`, `TOPO_XML`, `DEMO_EVIDENCE_SUFFIXES`, `DEMO_MEDIA_EVIDENCE`, `DEMO_MEDIA_LIVE`, `demoMediaForEvidence`, `demoVideoAssetOf`, `liveLoopFor`, `HeroBackdrop`, `mixHex`, `withAlpha`.
- Components: `CameraFeed`, `Emblem`, `EmblemDraw`, `HeroBackdrop`.

## Tests

3 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D253: row 230: Home tiles pass their track to the camera preview; a stale `camera-feed.tsx` comment noted.
