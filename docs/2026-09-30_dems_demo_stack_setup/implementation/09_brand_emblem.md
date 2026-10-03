---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 28
date: 2026-10-01
agent: image-specialist
narrative_tier: 3
status: complete
source_plan: masterplan/02_plan.md §4 W-04 (part a); identification/02_structured.md row 28
decisions: D28, D37 (SCR-03), D38, D40
---

# 09: Brand emblem, favicon and PNG exports (blueprint step 28)

Run on 2026-10-01 02:13–02:22 WIB, cwd `/Users/gsp-budi/Documents/DEMS`, macOS 27.0.1, libxml 20913.
No `npm install` was run and no `package.json` was touched (P1). No process was left running (P7).

## Result summary

| Item | Result | Evidence |
|---|---|---|
| `apps/core-web/src/assets/brand/emblem.svg`, hand-authored vector: double-stroke shield plus 6 fingerprint ridges, ids `emblem-shield` and `emblem-arc-1..6`, vertical gradient `#FFE2A6` → `#FFC86B` → `#C9802F` | done | §1, §4 |
| `apps/core-web/public/favicon.svg` replaces the Vite template, derived from the emblem | done | §2, §4 |
| Three 1024 px PNGs in `packages/shared/assets/brand/` (SCR-03) | done | §3, §4 |
| AC-68: id count 7; favicon exists | PASS | §4.1 |
| `grep -c FFC86B favicon.svg` ≥ 1 | PASS (2) | §4.1 |
| `xmllint --noout` on both SVGs | PASS (exit 0, exit 0) | §4.1 |
| `sips`: 1024x1024 ×3; `hasAlpha: yes` on the foreground | PASS | §4.1 |
| No raster copied from `ui_design/` | PASS | §4.2 |
| Visual check against the designer's crop (DS §01 BRAND & LOGO and D1 lockup) | done | §5 |

## 1. emblem.svg

`viewBox="0 0 128 128"`, `width/height 128`, `fill="none"`. All strokes use one gradient (`id="emblem-gradient"`, `gradientUnits="userSpaceOnUse"`, y 6 → 122), so the seven paths share one continuous vertical gold ramp. Round caps and joins. There is no glow in the file; the spec puts glow in CSS `drop-shadow` (§14.10).

| id | Geometry | stroke-width | Length (user units)* | Draw start |
|---|---|---|---|---|
| `emblem-shield` | **One path, two closed subpaths**: outer rim (x 14–114, y 6–121.5) and inner rim inset about 5 units. This is the "double stroke" | 3.2 | 669.3 | Both subpaths start at the top peak (64, y) |
| `emblem-arc-1` | Core: a narrow ∩ (r 2.6) with a long left stem to y 94 (the "P" core in the DS logo) | 2.6 | 40.2 | Bottom of the stem |
| `emblem-arc-2` | r 7.6 about (64, 64); left leg to y 84; wraps right to 40° | 2.6 | 49.2 | Bottom of the left leg |
| `emblem-arc-3` | r 12.6; left leg to y 90; wraps to 50° | 2.6 | 76.6 | Bottom of the left leg |
| `emblem-arc-4` | r 17.6; left leg to y 82; wraps to 55° | 2.6 | 90.2 | Bottom of the left leg |
| `emblem-arc-5` | r 22.6; left leg to y 88; wraps to 70° | 2.6 | 122.6 | Bottom of the left leg |
| `emblem-arc-6` | "Roof" ridge: a peaked chevron (peak y 35.8) with down-turned ends, echoing the shield top | 2.6 | 65.6 | Left end |

\* Measured in headless Chromium with `getTotalLength()` on the inlined file:
```
emblem-shield len=669.3 bbox=14.0,6.0,100.0,115.5
emblem-arc-1 len=40.2 bbox=61.4,61.4,5.2,32.6
emblem-arc-2 len=49.2 bbox=56.4,56.4,15.2,27.6
emblem-arc-3 len=76.6 bbox=51.4,51.4,25.2,38.6
emblem-arc-4 len=90.2 bbox=46.4,46.4,35.2,35.6
emblem-arc-5 len=122.6 bbox=41.4,41.4,45.2,46.6
emblem-arc-6 len=65.6 bbox=37.0,35.8,54.0,15.7
```
Arc end points lie exactly on their circles (computed as `64 + r·cos θ`, `64 + r·sin θ` to 2 decimals).

**Scan order** (for M-APP-03, M-PG-LOGIN and M-C-22): arc-1 (core) outward to arc-6 (roof). Each `d` is on one line so that step 35 (`packages/shared/src/brand/emblem.ts`, brand-sync test) can mirror it verbatim.

## 2. favicon.svg

At 16–48 px, six ridges and a double rim merge into one blur, so the favicon is a derived simplification (compared at 16, 32 and 48 px on light and dark tab strips; §5):
- the **outer rim subpath only**, stroke 9, filled with the canvas black `#0B0D0F` so it reads on light tab strips too;
- **three ridges**, the emblem's arc-1, arc-3 and arc-5 `d` values verbatim, at stroke 6.5;
- the same three gradient stops (`id="favicon-gradient"`).

The template it replaced: 9522 bytes, sha256 `61bc9a16…fdac12043a66` (Vite logo). `apps/core-web/index.html:5` already points at `/favicon.svg`, so no HTML change was needed.

## 3. PNG exports (SCR-03)

All three are rendered **from the repo `emblem.svg` itself** (loaded via `file://` in a 1024×1024 transparent page), then copied into place.

| File | Content | Scale | Filter | Solid content radius / limit |
|---|---|---|---|---|
| `icon-foreground-1024.png` | Gradient emblem on transparent; subtle glow | 4.4 px/unit (563 px box) | `drop-shadow(0 0 8px #FFC86B4D) drop-shadow(0 0 32px #FF9F3D59)` | 301 px / 313 px (Android adaptive safe zone: a 66 dp circle on a 108 dp canvas) |
| `icon-monochrome-1024.png` | Same geometry, pure white (one RGB value, 255,255,255), alpha only, no glow; Android themed-icon input | 4.4 | `brightness(0) invert(1)` | 301 px / 313 px |
| `splash-1024.png` | Gradient emblem on transparent, stronger bronze bloom | 4.8 (614 px box) | `drop-shadow(0 0 10px #FFC86B66) drop-shadow(0 0 44px #FF9F3D66)` | 328 px / 341 px (central ⅔ circle; **hypothesis**: the Android 12+ splash icon mask) |

Pixel audit (PIL 12.3.0; radius from the canvas centre, alpha ≥ 200 counted as "solid"):
```
fg     corners_alpha [0, 0, 0, 0] solid_bbox (285, 250, 739, 772) max_r_solid 301 max_r_visible 328
mono   corners_alpha [0, 0, 0, 0] solid_bbox (285, 250, 739, 772) max_r_solid 301 max_r_visible 302 mono_rgb_set [(255, 255, 255)] n=1
splash corners_alpha [0, 0, 0, 0] solid_bbox (265, 226, 759, 795) max_r_solid 328 max_r_visible 368
```

### 3.1 Renderer

| Tool | Result | Evidence |
|---|---|---|
| `qlmanage -t -s …` (row 28's hypothesis) | **Not usable in this sandbox** | `sandbox_extension_issue_file failed … Operation not permitted` / `sandbox initialization failed` |
| Google Chrome 154 headless | Not used | Blocked in the sandbox (`ProcessSingleton … Aborting`) |
| **Playwright `chrome-headless-shell` 153.0.8010.12** (already in `~/Library/Caches/ms-playwright/chromium_headless_shell-1243`; nothing installed) | **Used** (row 28's fallback, "a headless-browser render") | Inside the sandbox it fails with `bootstrap_check_in … Permission denied (1100)`. Run with a **per-command sandbox bypass**; each run is a foreground one-shot that reads the scratchpad and repo files and writes only to the session scratchpad. Flags: `--default-background-color=00000000 --force-device-scale-factor=1 --window-size=1024,1024 --screenshot` |

## 4. Verification

### 4.1 Row 28 checks (run with `/usr/bin/grep`; the shell `grep` is a ugrep wrapper, see S25-3)

```
$ /usr/bin/grep -oE 'id="emblem-(shield|arc-[1-6])"' apps/core-web/src/assets/brand/emblem.svg | wc -l
7
$ test -f apps/core-web/public/favicon.svg ; echo exit=$?
exit=0
$ /usr/bin/grep -c FFC86B apps/core-web/public/favicon.svg
2
$ xmllint --noout apps/core-web/src/assets/brand/emblem.svg ; echo exit=$?
exit=0
$ xmllint --noout apps/core-web/public/favicon.svg ; echo exit=$?
exit=0
$ sips -g pixelWidth -g pixelHeight packages/shared/assets/brand/{icon-foreground,icon-monochrome,splash}-1024.png
.../icon-foreground-1024.png   pixelWidth: 1024  pixelHeight: 1024
.../icon-monochrome-1024.png   pixelWidth: 1024  pixelHeight: 1024
.../splash-1024.png            pixelWidth: 1024  pixelHeight: 1024
$ sips -g hasAlpha packages/shared/assets/brand/icon-foreground-1024.png
  hasAlpha: yes
```
(`sips -g hasAlpha` also prints `yes` for the monochrome and splash files.)

All ids in `emblem.svg`: `emblem-arc-1..6`, `emblem-gradient`, `emblem-shield`, one each. `emblem-gradient` does not match the AC-68 pattern, so the count stays at 7.

### 4.2 Provenance: no raster from `ui_design/`

```
$ /usr/bin/grep -nE '<image|data:|\.png|\.jpe?g|href=' emblem.svg favicon.svg      → none
$ shasum -a 256 packages/shared/assets/brand/*.png ui_design/*.png | awk '{print $1}' | sort | uniq -d | wc -l
0
```
The designer crops used for comparison were made with PIL into the session scratchpad only (`scratchpad/ref/`). They are not in the repo, not in `/docs`, and not an input to any render. The `ui_design/*.png` mtimes are unchanged (Sep 30 22:57–23:29).

### 4.3 Checksums

| File | Bytes | sha256 |
|---|---|---|
| `apps/core-web/src/assets/brand/emblem.svg` | 2614 | `c1d8cd12c85758eb117cd6dd03f369bd56c91fc71b372f7cd65b0af7009ff277` |
| `apps/core-web/public/favicon.svg` | 1270 | `9cfe5ccb9acc31105397a8c41706a8e2b4a979169afe52974f466d99758243b2` |
| `packages/shared/assets/brand/icon-foreground-1024.png` | 195500 | `04c1a741c07f90dea50b910243b575e03527c0deebe7a10ab700f3a7aa99573d` |
| `packages/shared/assets/brand/icon-monochrome-1024.png` | 42457 | `3a3a49955c1bcb6b9f9f04f621a40b260f1525d8b4b26f4c3052b77d846b5a25` |
| `packages/shared/assets/brand/splash-1024.png` | 224419 | `3d3b7c2610b3a3473ebc42a8b363d520ebe79712c9eb1fc53c3488c36bf0a27c` |

## 5. Visual check against the designer

Three drafts were rendered side by side with crops of DS "01 BRAND & LOGO" (native region about (105–210, 98–208)) and the D1 lockup (about (20–92, 0–72)), on the canvas black at 520, 170, 85, 44, 32 and 16 px.

| Draft | Finding | Change |
|---|---|---|
| v1 | Readable, but the double rim looked like two separate shields; the shield was narrower than the designer's (w/h 0.82 vs about 0.88); no roof ridge | Rim gap about 5 units; shield widened to x 14–114; roof ridge and right-hand wraps added |
| v2 | Close to DS in anatomy; the fingerprint sat high and small (31–74 % of the shield height vs the designer's about 22–77 %); arc-1 and arc-2 nearly touched at the core | Ridges rescaled to radii 2.6–22.6 at 5-unit pitch, centred at (64, 64) |
| **v3 (final)** | Fingerprint spans 26–76 % of the height and 54 % of the width (designer about 56 %); the ∩ core with its long stem, the concentric ridges wrapping to the lower right and the peaked roof all match the DS logo's anatomy with original geometry | Kept |

A preview of the final assets (my renders only, no designer pixels): `implementation/assets/09_brand_emblem_preview.png` (1180×700). It shows the emblem at 340, 170 and 44 px with the CSS glow, the foreground under a circular mask, the monochrome with a themed tint and on a checker, the splash at 200 px, and the favicon at 16, 32 and 48 px on light and dark tab strips.

## 6. Decisions, drift and notes for downstream steps

| # | Item | Resolution |
|---|---|---|
| DEC-28-1 | "Double-stroke shield" with a single `emblem-shield` id | One `<path>` with two closed subpaths. This keeps exactly 7 animation targets (AC-68) and step 35's `emblem.ts` shape (`shield` is one string). **Hypothesis:** with a `pathLength` draw, both rims animate together, because browsers restart the dash pattern per subpath (not verified in this step) |
| DEC-28-2 | Ridge numbering | arc-1 = core, arc-6 = roof; the scan radiates outward. The motion spec only says "arc-1..6, 70 ms apart", so this fixes the direction |
| DEC-28-3 | Gradient id inside the file (`emblem-gradient`) | When the emblem is inlined twice on one page (Login plus TopBar during the M-APP-01 flight), consumers should give the gradient a unique id per instance (e.g. React `useId`). The same applies to the path ids if the whole file is inlined twice |
| DEC-28-4 | Stroke widths are part of the look (shield 3.2, arcs 2.6; user units at viewBox 128) | Step 35: SCR-03 lists viewBox, shield, arcs[6] and gradient stops for `emblem.ts`. Please also export these two widths, or mobile rendering will drift |
| DEC-28-5 | `#FFE2A6` and `#C9802F` are not in `packages/shared/src/tokens/tokens.ts`; only `#FFC86B` (`colors.gold`) is | Used as literals per 01_specs §14.10. Step 35 exports them as `emblem.ts` gradient stops |
| DEC-28-6 | Splash PNG is transparent (glow baked in) | Step 72 / M-05: set the splash and adaptive-icon `backgroundColor` to `#0B0D0F` (04_mobile_specs §8.1 row "App icon, adaptive icon, monochrome, splash"). App.json `icon` (legacy) has no dedicated PNG in row 28. Step 72 can use `icon-foreground-1024.png`, or ask for an opaque variant |
| DR-28-1 | 04_ui_design_analysis §7 suggested 16, 32, 180 and 512 px exports | Superseded by row 28 (three 1024 px PNGs plus an SVG favicon). No 180 px `apple-touch-icon` was produced. Flag it if the web app needs one |
| DR-28-2 | Row 28 names `qlmanage` (hypothesis) | Blocked by the sandbox; used the row's stated fallback (headless browser) with per-command sandbox bypasses (§3.1). The user can change sandbox settings with `/sandbox` |
| N-28-1 | Agent-level instruction to update `masterplan/02_plan.md` and write `99_implementation_report.md` | Not done: both are shared files (P6, P8, parallel run). The controller synthesises them |
