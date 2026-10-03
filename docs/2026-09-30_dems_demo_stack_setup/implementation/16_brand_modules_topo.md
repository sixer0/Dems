---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 35
date: 2026-10-01
agent: coder-execution
narrative_tier: 3
status: complete
source_plan: identification/02_structured.md row 35; masterplan/02_plan.md §4 W-04 (part b)
decisions: D37 (SCR-03, SCR-06), D38, D45, D48, D49
---

# 16: Brand modules and topographic texture (blueprint step 35)

Run on 2026-10-01 from 02:25 to 02:40 WIB. The working directory was `/Users/gsp-budi/Documents/DEMS`, on Node with `tsx` 4.23.15 and vitest 5.0.3.

- **P1:** no `npm install` was run, and no `package.json` was touched. The `gen:topo` script and the `./brand` export already existed from step 27.
- **P6:** only step-35 paths were written. Nothing under `src/sim/**` (step 31), `src/i18n/**` (step 34) or `apps/mobile/**` was touched.
- **P7:** no process was left running.
- **Git:** not committed.

## Result summary

| Item | Result | Evidence |
|---|---|---|
| `packages/shared/src/brand/emblem.ts`: viewBox, `shield`, `arcs[6]`, gradient stops, **stroke widths 3.2 and 2.6 (D48)**, path ids, plus `emblemGradientId()` and `emblemSvg({ gradientId, pathIds, size })` for a unique gradient id per instance | done | §1, §4.1 |
| `packages/shared/scripts/gen-topo.ts`: seeded value noise, then marching squares, then RDP simplification, output as SVG (01_specs §14.10) | done | §2 |
| `apps/core-web/src/assets/brand/topo.svg` and `packages/shared/src/brand/topo.ts` (`TOPO_SVG`, the same text byte for byte) | done, generated | §2, §4.2 |
| `packages/shared/src/brand/index.ts`, the `./brand` export target (D45) | done | §4.5 |
| `packages/shared/test/brand-sync.test.ts` (15 tests: emblem sync plus topo sync, drift and constraints) | PASS 15/15 | §4.1 |
| Row 35: brand-sync passes | PASS | §4.1 |
| Row 35: two `npm run gen:topo -w @dems/shared` runs give the same `shasum` | PASS (identical) | §4.2 |
| Row 35: `xmllint --noout` | PASS (topo.svg exit 0; emblem.svg exit 0, unchanged) | §4.3 |
| Row 35: shared typecheck exits 0 | PASS | §4.4 |
| Extra checks: shared lint (0 findings in step-35 files); full shared suite 156/156; mutation checks; the export resolves; visual check | PASS | §4.4–§4.6 |

## 1. emblem.ts (SCR-03 code part)

The module mirrors `emblem.svg` (step 28, sha256 `c1d8cd12…f277`, unchanged) path for path.

| Export | Content |
|---|---|
| `EMBLEM_VIEWBOX`, `EMBLEM_SIZE` | `'0 0 128 128'`, 128 |
| `EMBLEM_SHIELD_PATH` | The `emblem-shield` `d`: outer and inner rim as two closed subpaths of one path |
| `EMBLEM_ARC_PATHS` | A 6-tuple in scan order. `arcs[0]` is the core (`emblem-arc-1`); `arcs[5]` is the roof ridge (`emblem-arc-6`) |
| `EMBLEM_STROKE_WIDTH` | `{ shield: 3.2, arc: 2.6 }` (D48, DEC-28-4) |
| `EMBLEM_STROKE_LINECAP` / `_LINEJOIN` | `'round'` / `'round'` |
| `EMBLEM_GRADIENT` | `userSpaceOnUse`, x1 0, y1 6, x2 0, y2 122; stops `#FFE2A6` @0, `palette.gold` (#FFC86B) @0.5, `#C9802F` @1 |
| `EMBLEM_PATH_IDS`, `EMBLEM_GRADIENT_ID` | The 7 AC-68 ids; `'emblem-gradient'` |
| `emblem` | Everything above in one object, for renderers |
| `emblemGradientId(key)` | `emblem-gradient-<key>` with characters outside `[A-Za-z0-9_-]` replaced by `_`. `emblemGradientId(useId())` gives each inline instance its own id (the Login → top bar flight shows two) |
| `emblemSvg(opts)` | Standalone markup built from the data: `gradientId` (sanitised), `pathIds` (default true; false for a second inline copy), `size`. Use it for react-native-svg `SvgXml`, a CSS data URI, or tests |

The module is framework-free: no DOM, no React. It imports only `palette` from `../tokens/tokens`.

## 2. Topographic texture (SCR-06)

`scripts/gen-topo.ts` (exports `generateTopo`, `renderTopoModule`, `mulberry32`, `createValueNoise` and the path constants):

1. **Noise.** `mulberry32(seed)` fills a 64×64 periodic value-noise lattice (quintic fade), summed as fBm. There is no Date, no `Math.random` and no Intl, and the iteration order is fixed.
2. **Massif field.** `y − k(y)·|x − ridge(y)| + noise`. The flank slopes ease from 0.9/0.74 at the peak to 0.62/0.52 at the foot. The ridge drifts right by 0.1 per unit of depth. Noise ramps in over 44 units from the peak, so the apex stays crisp. Its contours are nested "Λ" ridgelines:
   - 7 index levels, starting at the peak (y 50), with spacing 25 that grows by 4 per level;
   - 6 intermediate levels, half-way between the index levels.
3. **Strata field.** `y − 0.09·|x − 176| + noise` gives horizon lines at y 60–130 (shoulder height). A segment is kept only where it lies above the massif silhouette, so the mountain occludes the horizon. One strata level is fully occluded, so 7 are drawn.
4. **Tracing.** Marching squares on a 2-unit grid with a 6-unit bleed and saddle disambiguation by the cell-centre average. Segments are chained by shared grid edge (open chains first, then loops), simplified with RDP at ε = 0.45 (the faceted, low-poly look of the mockup), and polylines shorter than 8 units are dropped.
5. **Spine.** A polyline through the apexes of the first 3 index contours: the lit ridge crease visible in the mockup.
6. **Output SVG.**
   - viewBox `0 0 240 280`, matching the aspect of the sidebar foot (about 200×235 at mockup scale, 04 §7).
   - One `<g>` with 1 px strokes on a `userSpaceOnUse` radial gradient centred on the peak: `#FFE2A6` → `palette.gold` → `palette.bronze` → `#C9802F`.
   - Every line carries `vector-effect="non-scaling-stroke"`, so it stays 1 px at any rendered size.
   - `stroke-opacity`:
     - strata 0.15–0.20;
     - intermediate levels 0.18–0.15;
     - index levels 0.40–0.22;
     - spine 0.40.
   - Glows:
     - a bottom-up radial glow (04 §7);
     - a peak glow, a halo ellipse kept inside the viewBox, and a two-ellipse flare at the apex (the mockup's spark).
   - One generated-by XML comment inside `<svg>`.

**Composition of the committed file:** 21 `<path>`, 5 `<radialGradient>`, 14 `<stop>`, 1 `<rect>`, 1 `<circle>`, 3 `<ellipse>`, 1 `<g>`. Size is **5,241 bytes**. The stroke-opacity histogram (0.15 ×2, 0.16 ×4, 0.17 ×3, 0.18 ×2, 0.19 ×2, 0.22, 0.25, 0.28, 0.31, 0.34, 0.37, 0.40 ×2) stays within 0.15–0.40.

`src/brand/topo.ts` is **generated**. Its header says do not edit. It exports:
- `TOPO_SVG`, the exact text of `topo.svg`, embedded in a template literal (the generator asserts there are no backticks, backslashes, `${` or `--` inside the comment);
- `TOPO_SEED` 20261001, `TOPO_VIEWBOX`, `TOPO_WIDTH`, `TOPO_HEIGHT`, `TOPO_PEAK` {96, 50}, `TOPO_STROKE_OPACITY` {0.15, 0.4}, `TOPO_CONTOUR_COUNT` 21, `TOPO_ID_PREFIX` `'topo-'`;
- `topoSvgWithIdPrefix(prefix)`, which renames every id and `url(#…)` reference for a second inline copy in one HTML document.

**Consumer notes:**
- **Web:** CSS `background-image` via the asset URL, `?raw`, or inline.
- **Mobile:** `<SvgXml xml={TOPO_SVG} />`.
- **Element set:** limited to what react-native-svg 15.15.4 `SvgXml` maps: svg, defs, radialGradient, stop, rect, g, path, circle, ellipse. Its parser skips comments (`node_modules/react-native-svg/src/xml.tsx` lines 318–319 and 378–386) and camelCases attributes (line ~476). `vectorEffect: 'non-scaling-stroke'` is supported (`src/lib/extract/extractStroke.ts` line 22).

## 3. Visual check

The texture was compared with the designer's sidebar-foot crop, D1 (0–240, 560–830). The crop lives **in the session scratchpad only**; no designer pixels are in the repo or `/docs`. Four rounds:

| Round | Finding | Change |
|---|---|---|
| v1 | 15 dense, evenly spaced chevrons; strata above the peak; no ridge crease | Fewer, wider index levels with growing spacing; strata moved to shoulder height; spine added; steeper upper slopes |
| v2 | Right anatomy; lower lines too dark | Stroke ramp brightened (bronze reached at 60 %); warm halo added |
| v3 | A faint hard edge at the texture's top in the 232 px sidebar mock (the r = 100 halo was clipped at y = 0) | Halo made an ellipse kept inside the viewBox (top at y ≈ 16) |
| **v4 (final)** | Clean top edge. Reads as the lit peak with nested ridgelines and horizon strata. Seeds 7 and 424242 give different but equally clean textures | Kept |

Evidence image (my renders only): `implementation/assets/16_brand_topo_preview.png` (880×820). It shows:
- `topo.svg` at 1.5×;
- a 232 px sidebar-foot mock;
- a cover-cropped backdrop (strokes stay 1 px);
- `emblem.svg` next to `emblemSvg()` built from `emblem.ts` with the gradient id `emblem-gradient-_r1_`.

Pixel diff of the two emblem tiles (PIL, 170×170): the difference bbox is a single pixel at (145, 29), and the maximum channel difference is 1 (anti-aliasing).

**Honest gap:** the designer's lines glow more strongly than ours. The spec caps contour alpha at 40 % (01_specs §14.10). A consumer-side CSS `drop-shadow` on the layer would bring it closer; that is a **hypothesis**, not rendered in the app here.

## 4. Verification

### 4.1 brand-sync.test.ts

```
$ npx vitest run test/brand-sync.test.ts --maxWorkers=2      (cwd packages/shared)
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

The tests cover:
- **Emblem:** every `emblem.ts` path equals the matching `d` in emblem.svg (7 paths); stroke widths; viewBox, gradient vector, units, stops and caps; the aggregate object; the `emblemSvg()` rebuild equals the asset's ids, `d` and widths; unique and sanitised gradient ids (a hostile id yields no `<script`).
- **Topo:** `TOPO_SVG` equals `topo.svg`; generator output equals both committed files (no drift); deterministic per seed and different across seeds; 1 px non-scaling lines within 0.15–0.40; palette gold and bronze in the stroke ramp; under 16 KB and RN-safe elements only (no style, class or filter); every `url(#…)` resolves and every id is `topo-` prefixed; `topoSvgWithIdPrefix`.
- **Barrel:** re-exports both modules.

**Mutation checks** (each restored afterwards):
- In `emblem.ts`, changing arc-3 `90`→`91` and the arc width `2.6`→`2.4` gives 3 failures ("emblem-arc-3: expected … to be …", "expected { shield: 3.2, arc: 2.4 } to deeply equal …"). Restored; sha256 back to `f87a39f6…8be9`.
- Hand-editing one `stroke-opacity` in `topo.svg` gives 2 failures (the sync test and the no-drift test). Regenerating restored sha256 `235de70a…f558`.

### 4.2 Determinism: two `npm run gen:topo` runs

Inside the sandbox, the tsx CLI fails with `Error: listen EPERM: operation not permitted /tmp/claude-501/tsx-501/75896.pipe`, the known D49 case. The row check was therefore run with a **per-command sandbox bypass** (P10). The in-sandbox equivalent is `node --import tsx scripts/gen-topo.ts`, which was used during development.

```
--- run 1
wrote …/apps/core-web/src/assets/brand/topo.svg (5240 bytes, 21 contours, seed 20261001)
wrote …/packages/shared/src/brand/topo.ts (7445 bytes)
235de70afe14cf8a26ef65883b946175fd8c70c9541160f51bd5ef6ffcb0f558  apps/core-web/src/assets/brand/topo.svg
782a7cb0f54cce8ea17232fe50b734fb239b7c1912c75db032e42ed132834d3e  packages/shared/src/brand/topo.ts
--- run 2
(same two lines)
235de70afe14cf8a26ef65883b946175fd8c70c9541160f51bd5ef6ffcb0f558  apps/core-web/src/assets/brand/topo.svg
782a7cb0f54cce8ea17232fe50b734fb239b7c1912c75db032e42ed132834d3e  packages/shared/src/brand/topo.ts
IDENTICAL
```
The "bytes" in the log are characters. The file is 5,241 bytes because `§` is 2 bytes in UTF-8.

### 4.3 xmllint

```
xmllint apps/core-web/src/assets/brand/topo.svg exit=0
xmllint apps/core-web/src/assets/brand/emblem.svg exit=0
c1d8cd12c85758eb117cd6dd03f369bd56c91fc71b372f7cd65b0af7009ff277  apps/core-web/src/assets/brand/emblem.svg   (= step 28, unchanged)
```

### 4.4 Typecheck, lint, full suite

```
$ npm run typecheck -w @dems/shared        → tsc --noEmit, exit=0
$ npm run lint -w @dems/shared             → exit=0; one warning in src/sim/selectors.ts:179 (step 31's file, not step 35)
$ oxlint src/brand scripts/gen-topo.ts test/brand-sync.test.ts
Found 0 warnings and 0 errors.
Finished in 5ms on 5 files with 96 rules using 10 threads.
$ npm test -w @dems/shared -- --maxWorkers=2
 Test Files  8 passed (8)
      Tests  156 passed (156)
```
P11: steps 31 and 34 were running at the same time. Every command passed on its first run, so no re-run was needed.

### 4.5 The `@dems/shared/brand` export resolves (consumer view, from apps/core-web)

```
exports EMBLEM_ARC_PATHS,EMBLEM_GRADIENT,EMBLEM_GRADIENT_ID,EMBLEM_PATH_IDS,EMBLEM_SHIELD_PATH,EMBLEM_SIZE,EMBLEM_STROKE_LINECAP,
        EMBLEM_STROKE_LINEJOIN,EMBLEM_STROKE_WIDTH,EMBLEM_VIEWBOX,TOPO_CONTOUR_COUNT,TOPO_HEIGHT,TOPO_ID_PREFIX,TOPO_PEAK,TOPO_SEED,
        TOPO_STROKE_OPACITY,TOPO_SVG,TOPO_VIEWBOX,TOPO_WIDTH,emblem,emblemGradientId,emblemSvg,topoSvgWithIdPrefix
TOPO_SVG bytes 5241 arcs 6 widths {"shield":3.2,"arc":2.6}
```

### 4.6 Files and checksums

| File | Change | Bytes | sha256 |
|---|---|---|---|
| `packages/shared/src/brand/emblem.ts` | create | 7306 | `f87a39f6189e4d4a5c7e6b2e2cbcea93a880e76d17265e54a21b05f784328be9` |
| `packages/shared/src/brand/topo.ts` | create (generated) | 7456 | `782a7cb0f54cce8ea17232fe50b734fb239b7c1912c75db032e42ed132834d3e` |
| `packages/shared/src/brand/index.ts` | create | 323 | `f929b1b184e17b19f5d242f17d9530b8697dad3309ec830d5e64b015bba929d3` |
| `packages/shared/scripts/gen-topo.ts` | create | 27543 | `3fdba5be5e6a211c81dddba42383b501c2dc5cdc8c4b31552348783c50429c21` |
| `packages/shared/test/brand-sync.test.ts` | create | 10697 | `94227619123feb266f0974ccf134be6a580e09af1f452fe25a386db0ff8b4539` |
| `apps/core-web/src/assets/brand/topo.svg` | create (generated) | 5241 | `235de70afe14cf8a26ef65883b946175fd8c70c9541160f51bd5ef6ffcb0f558` |
| `docs/…/implementation/assets/16_brand_topo_preview.png` | create (evidence) | 393439 | n/a |

`git status` for these paths shows them untracked (`??`). `packages/shared/package.json` shows `M` from step 27 (mtime 02:13, before this step); it was not touched here.

## 5. Decisions, drift and notes for downstream steps

| # | Item | Resolution |
|---|---|---|
| DEC-35-1 | `topo.ts` must export "the same SVG string" as `topo.svg`, and the file should say it is generated | The provenance comment sits **inside** `<svg>`, so the file and `TOPO_SVG` are byte-identical. The RN parser skips comments (source cited in §2). |
| DEC-35-2 | Canvas | viewBox 240×280, the aspect of the mockup's sidebar foot (04 §7). Strokes use `non-scaling-stroke`, so 1 px holds from the 232 px sidebar to a mobile Login backdrop. |
| DEC-35-3 | Mood beyond "contours" | Added a ridge **spine** (a polyline through contour apexes) and occluded **horizon strata**, both from the mockup. Also added a peak glow, halo and flare alongside the 04 §7 bottom-up glow. Every line stays at 1 px and 15–40 % alpha. The spine is counted in `TOPO_CONTOUR_COUNT` (21 line paths). |
| DEC-35-4 | PRNG source | The generator has its own `mulberry32`, not `src/sim` rng (step 31 is writing `src/sim` now, P6; the generator stays independent of the simulator). Seed 20261001 is the canonical demo seed (AC-51). |
| DEC-35-5 | Colour sources | The emblem's middle stop is `palette.gold`; its outer stops are the §14.10 literals (DEC-28-5). Topo strokes use `palette.gold` and `palette.bronze` plus the two emblem stops. |
| DEC-35-6 | Unique ids (D48) | `emblemGradientId(useId())` plus `emblemSvg({ gradientId, pathIds: false })` for the emblem; `topoSvgWithIdPrefix()` for a second inline topo copy. Neither is needed for CSS backgrounds, `<img>` or react-native-svg, which scope ids per image. |
| DEC-35-7 | Where the topo tests live | In `test/brand-sync.test.ts`, the only test path row 35 names (P6). |
| DEC-35-8 | Root barrel | `src/index.ts` does **not** re-export `./brand`. That keeps the texture string out of mock-core, and `src/index.ts` is not a step-35 path. Consumers import `@dems/shared/brand`. |
| DEC-35-9 | Emblem path lengths | Not exported. Web draws with `pathLength`; mobile uses Skia `end` (04_mobile_specs §8.1), so neither needs lengths. The step-28 Chromium lengths are in 09 §1 if ever needed. |
| REC-35-1 (steps 38, 41; mobile 72) | M-SH-07 shimmer "contour opacity 0.25 ↔ 0.4" | The contours carry their own alpha (max 0.40). Animate the **layer** opacity 0.625 ↔ 1, so the brightest line spans 0.25 ↔ 0.4. This is documented in the `topo.ts` header and is a recommendation; the motion owner decides. |
| REC-35-2 (step 72 / M-05) | Mobile wiring | SCR-03 and SCR-06 are delivered, so the "copy path data / copy topo.svg" fallbacks in 04_mobile_specs §13 are not needed. Use `import { emblem, TOPO_SVG } from '@dems/shared/brand'`. **Hypothesis:** `SvgXml` renders the texture on device. This is supported by the parser and props source (§2), not rendered on an emulator in this step. |
| DR-35-1 | Row 35 names `npm run gen:topo` | It fails inside the sandbox with listen EPERM (D49). The row check ran with a per-command bypass (§4.2). The user can change sandbox settings with `/sandbox`. |
| DR-35-2 | Visual check renderer | No local SVG rasteriser (rsvg-convert, ImageMagick, inkscape and cairosvg are all absent). Used the existing Playwright `chrome-headless-shell` 1243 with a per-command sandbox bypass, as step 28 did (D48). Each run was a foreground one-shot that wrote to the scratchpad only. |
| DR-35-3 | Brightness against the mockup | Subtler than the designer's glowing lines because of the §14.10 alpha cap (§3, honest gap). |
| N-35-1 | Agent-level instruction to update `masterplan/02_plan.md` and write `99_implementation_report.md` | Not done: both are shared files (P6, P8, parallel run). The controller synthesises them. Progress is in `delegation_progress/coder_execution_step_35.md`. |
