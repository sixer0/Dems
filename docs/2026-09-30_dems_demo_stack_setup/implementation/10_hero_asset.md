---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 29
plan_row: W-05 (02_plan §4), SCR-04 (04_mobile_specs)
date: 2026-10-01
agent: coder-execution
narrative_tier: 3
status: complete
source_plan: identification/02_structured.md row 29; masterplan/02_plan.md W-05
spec: masterplan/01_specs.md rev 3 §14.10, H-S19, AC-67 (path per D40)
decisions: D28, D31, D37 (SCR-04), D38, D39, D40
---

# 10: Hero still (blueprint step 29)

Run on 2026-10-01, 02:10–02:17 WIB, cwd `/Users/gsp-budi/Documents/DEMS`. **Primary path taken:** a licensed Pexels photo. The procedural SVG fallback (H-S19) was **not needed**.

## Result summary

| Item | Result | Evidence |
|---|---|---|
| Photo selected | Pexels 3906592, "Leandro Alamino", Pexels License, original 6000×4000 sRGB | §2, §3 |
| Content rule: empty room, table and chairs, no people, no insignia or logos, no readable text | Pass. The only lettering is a clip label on a flipchart. It is out of focus and unreadable at full resolution and a few pixels wide at 2560 | §2.3 |
| `packages/shared/assets/hero/room-2560.jpg` | 2560×1706, JPEG q80, sRGB, 1,082,103 B | §4 |
| `packages/shared/assets/hero/room-1600.jpg` (mobile variant) | 1600×1066, JPEG q80, sRGB, 326,153 B | §4 |
| `THIRD_PARTY_NOTICES.md` hero row: URL, author, licence, date, and both `apps/core-web` and `apps/mobile` | Pass. Appended section; the 67 existing lines are byte-identical | §5 |
| AC-67 (at the shared path, D40) | Pass | §6 |
| No file derived from `ui_design/` or the MB 1 photo in the workspace assets | Pass | §6.3 |
| npm install, package.json edits, processes started | None | n/a |

## 1. Sourcing method and access limits

Search queries were generic only. No project name and no domain terms were used.

| Query / request | Tool | Outcome |
|---|---|---|
| `unsplash.com/napi/search/photos?query=empty meeting room` | curl | HTTP 401: Anubis "Making sure you're not a bot!" page. **Not bypassed** |
| `www.pexels.com/search/empty meeting room/` | curl | HTTP 403: Cloudflare "Just a moment..." page. **Not bypassed** |
| "unsplash empty meeting room table chairs dark" | WebSearch (unsplash.com) | 10 results |
| "pexels empty conference room table chairs warm light" | WebSearch (pexels.com) | 10 results |
| "unsplash empty boardroom warm light wooden table leather chairs" | WebSearch | 10 results |
| "pexels empty meeting room dark moody table chairs" | WebSearch | 10 results |
| "unsplash conference room table chairs night" | WebSearch | 10 results |
| `unsplash.com/s/photos/empty-boardroom`, `pexels.com/search/empty%20meeting%20room/`, and individual photo pages | WebFetch | Photographer, dimensions, licence label, CDN URL |
| `images.unsplash.com/…`, `images.pexels.com/…` (900 px previews, then one original) | curl | HTTP 200 for all 26 requests (24 previews and 2 originals). The CDNs serve files directly, with no challenge |

## 2. Candidate screening

### 2.1 Rejected

Each rejected candidate was previewed at 900 px wide.

| Candidate | Reason |
|---|---|
| Pexels 22718136 (Jason Hu) | Readable poster text on the glass wall; labelled bottles |
| Pexels 16859956 (Skills Media) | Seminar hall, not a meeting room; a logo on every chair back |
| Pexels 260689 | Bright, cool white; a branded desk phone; wall TV |
| Pexels 17739892 | Clean but bright white and cool; close-up without room context |
| Pexels 14462019, 15154651, 3767170, 3767172, 8574469; Unsplash rGAlkaB2da0 (Mat) | Portrait orientation: they cannot supply a ≥ 2560×1440 landscape frame |
| Unsplash e2YsciK_14E (Slidebean) | Branded computer and a figurine; blue feature wall; cool |
| Unsplash Y1Dd_ASy9tc, xpSUIK5oCUM (43 Clicks North) | Neon "#" sign (a glyph); teal and cool |
| Unsplash rr12y4qEbps (john renzzel) | Warm and on-theme, but a readable "EXIT" sign and a digital clock ("15:42") |
| Unsplash _-KLkj7on_c (Dane Deaner) | Framed print of an identifiable stadium and city; very bright |
| Unsplash ULh0i2txBCY (Pawel Chu) | Cool grey; labelled bottle |
| Unsplash 0sT9YhNgSEs (Benjamin Child) | Green glass wall, wall TV, bright daylight; cool |
| Pexels 29625510 | A classroom behind a fence reflection, not a meeting room |
| Pexels 8143709 | Living space, not a meeting room |
| Unsplash+ items (Getty Images and others) | Premium licence, not free |

### 2.2 Runners-up (both qualify; not used)

- Unsplash GWe0dlVD9e0 (Benjamin Child, Unsplash License, 5184×3456): blown-out windows, a projector and a monitor on the table, and a very widely reused stock image.
- Unsplash eHD8Y1Znfpk (Nastuh Abootalebi, Unsplash License): a daylight loft, cooler.

### 2.3 Selected: Pexels 3906592

- **Page:** `https://www.pexels.com/photo/black-leather-office-rolling-chairs-beside-brown-wooden-table-3906592/`
- **Photographer:** Leandro Alamino, `https://www.pexels.com/@leandroalamino/`
- **Pexels page data (WebFetch, 2026-10-01):** 6000×4000; licence shown as "Free"; published 2020-03-10; Nikon D3500 at 18 mm, f/3.5, ISO 3200.
- **Content:** an empty boardroom at table height. Dark leather chairs, beige walls lit by a warm cove light, a blank projection screen and water glasses.
  - It matches 04_ui_design_analysis §7: an empty, warmly lit meeting room with a table and chairs, dark enough for the CSS grade.
  - The vanishing point (the screen) sits at about x = 62 %, y = 45 %, so both the wide Dashboard band and the square Login brand side keep the room's focal point.
- **Detail check:** full-resolution `sips` crops of the flipchart, the table-top projector, the cups and the wall plate.
  - The flipchart clip label is out-of-focus blur and cannot be read.
  - The projector and cups are defocused shapes with no visible mark.
  - There are no people, reflections of people, insignia or logos.
- **Metadata:** the original has no GPS tags (`strings | grep -i gps` returned no match). Its colour profile is sRGB IEC61966-2.1.

## 3. Download and licence

```
$ curl -sS -A "Mozilla/5.0 …" -o p_3906592_full.jpg https://images.pexels.com/photos/3906592/pexels-photo-3906592.jpeg
200 5801695
$ sips -g pixelWidth -g pixelHeight -g profile p_3906592_full.jpg
  pixelWidth: 6000   pixelHeight: 4000   profile: sRGB IEC61966-2.1
$ shasum -a 256 p_3906592_full.jpg
58b7f0d69e8ac390cb9fcb5bb277fdf1af876bd71600b61a925ec6ec3d375ec0
```

The original stays in the session scratch directory and is **not** stored in the repository.

The licence was read on 2026-10-01 with WebFetch from `https://www.pexels.com/license/` (V44):
- Free to use and to modify. Attribution is not required.
- Not allowed: selling unaltered copies; redistributing on stock or wallpaper platforms; implying endorsement by people or brands; using the photo in a trade mark or business name.

None of these applies to a UI background. This matches the §14.10 wording.

## 4. Variants (macOS `sips`)

```
$ SRC=…/p_3906592_full.jpg
$ sips --resampleWidth 2560 -s format jpeg -s formatOptions 80 "$SRC" --out packages/shared/assets/hero/room-2560.jpg
$ sips --resampleWidth 1600 -s format jpeg -s formatOptions 80 "$SRC" --out packages/shared/assets/hero/room-1600.jpg
```

| File | Size (px) | Bytes | Profile | SHA-256 |
|---|---|---|---|---|
| `packages/shared/assets/hero/room-2560.jpg` | 2560×1706 | 1,082,103 | sRGB IEC61966-2.1 | `93d04e0062f93710d426a45febb23ca471e7f953f8b873405f471108fcb676db` |
| `packages/shared/assets/hero/room-1600.jpg` | 1600×1066 | 326,153 | sRGB IEC61966-2.1 | `c8f8721cf737611f566532b6a2ac738e6bafd7dc0968655d457d4d06397066a3` |

Notes:
- Both files are resampled directly from the original, not chained.
- `sips` drops the EXIF block: `strings | grep -ci nikon` gives 0 on both, and there are no GPS tags.
- The 2560 file is about 1.1 MB because the source was shot at ISO 3200 and its grain costs bytes at q80. q80 is the spec value and was kept.

## 5. `THIRD_PARTY_NOTICES.md`

- **Change:** a new `## Media assets` section appended after the last licence block, containing one table row plus the provenance bullets (original hash, `sips` commands, variant hashes, licence summary).
- **Existing content:** lines 1–67 are unchanged:
  ```
  $ head -67 THIRD_PARTY_NOTICES.md | shasum -a 256
  1beb5b43c3450f2a5bec162609f46a6b43587e0b9e0b8f57330fc30664b543e4   (= whole-file hash before the edit)
  $ wc -l THIRD_PARTY_NOTICES.md
  87
  ```
- **Next writer:** step 37 can keep appending its code-copy rows to the top table. The two edits do not touch the same lines.
- **Observation:** line 66, `app/page.tsx`, sits inside the Motion Primitives MIT block. It is **not** a paste error: the upstream `https://raw.githubusercontent.com/ibelick/motion-primitives/main/LICENCE.md` ends with the same line (curl + `od -c`). It was left as is.

## 6. Acceptance (row 29 / AC-67 at the D40 path)

### 6.1 Notices row

```
$ grep -nE 'hero' THIRD_PARTY_NOTICES.md | grep '| Hero'
77:| Hero room still: an empty meeting room with a table and chairs (no people, no insignia, no readable text) | Pexels, …
```

Each field was checked on that single row (`grep -cF`, one line each):

| Field | Count |
|---|---|
| `pexels.com/photo/` | 1 |
| `Leandro Alamino` | 1 |
| `Pexels License` | 1 |
| `2026-10-01` | 1 |
| `apps/mobile` | 1 |
| `apps/core-web` | 1 |
| `packages/shared/assets/hero/room-2560.jpg` | 1 |
| `packages/shared/assets/hero/room-1600.jpg` | 1 |

### 6.2 Widths

```
$ sips -g pixelWidth packages/shared/assets/hero/*
/Users/gsp-budi/Documents/DEMS/packages/shared/assets/hero/room-1600.jpg
  pixelWidth: 1600
/Users/gsp-budi/Documents/DEMS/packages/shared/assets/hero/room-2560.jpg
  pixelWidth: 2560
```

Heights are 1066 and 1706, so the 2560 file meets ≥ 2560×1440.

### 6.3 No `ui_design/` or MB 1 derivative

- **Scan:** every `png/jpg/jpeg/webp/gif/svg` in the workspace, excluding `node_modules`, `android/`, `.git`, `docs`, `ui_design`, `graft` and `.cache`. That is 56 files:
  - `apps/core-web/{public,dist}/favicon.svg`
  - the Expo template images in `apps/mobile/assets/**`
  - the Expo icon cache in `apps/mobile/.expo/web/cache/**`
  - the two hero files
- **Hash comparison with the five `ui_design/*.png`:** 0 matches (`comm -12 … | wc -l` → 0).
- **Dimensions:** every `apps/mobile/assets` file is an icon or badge size (48–1024 px squares, 371×72, 228×213). The largest, `tutorial-web.png` (1480×855), was viewed: it is the Expo starter "Welcome to Expo" illustration, not a photo.
- **Hero provenance:** downloaded from the Pexels CDN (hash in §3), not from `ui_design/`.

## 7. Decisions and drift (for the controller to record)

| # | Type | Item |
|---|---|---|
| 1 | env | **`sips` needs a per-command sandbox bypass.** Every `sips` write fails in the sandbox with `Error 13: Cannot write to file /var/folders/…/T/<uuid>`: it writes a scratch file in the macOS per-user temp directory, and neither `TMPDIR` nor `--out` changes that. The `sips` crop, resample and `-g` calls ran with the sandbox bypass. They touched only the scratch directory and `packages/shared/assets/hero/`. Steps 28 (PNG exports) and the mobile brand-media row (M-05) will hit the same issue |
| 2 | process | **Access route:** Unsplash (`/napi`, Anubis) and Pexels (HTML, Cloudflare) block scripted requests. These checks were not bypassed. Page metadata came from WebSearch and WebFetch; `curl` was used only for the image CDNs, which answer directly |
| 3 | spec | **AC-67 command still names `apps/core-web/src/assets/hero/*`** (01_specs line 1957). Under D40 it should read `sips -g pixelWidth packages/shared/assets/hero/*`. This step verified against the D40 path and did not edit 01_specs (outside row 29's write paths). This is the MINOR correction listed under P1 "Correct … AC-67 (path)" |
| 4 | plan | **The 02_plan W-05 text is superseded by row 29:** path `apps/core-web/src/assets/hero/` → `packages/shared/assets/hero/`; artefact `12_hero_asset.md` → `10_hero_asset.md`. D37/D40 already cover both changes |
| 5 | tech | **Aspect 3:2 (2560×1706), not 16:9.** This meets the spec minimum of ≥ 2560×1440, and the extra height gives headroom for the Login brand-side crop |
| 6 | tech (advice to consumers) | Suggested `object-position` is about `62% 45%`, the vanishing point at the projection screen. The CSS grade from 04 §7 (brightness .55, sepia .35, saturate .8, warm overlay) should be enough, because the source is already warm and dark. CameraFeed Cam 1 (wide) and Cam 2 (mirrored crop) can take their crops from `room-2560.jpg` |
| 7 | mobile hand-over | SCR-04 is satisfied in this row: the shared location exists, the ≤ 1600 px variant exists, and the notices row already names `apps/mobile`. The mobile brand-media row (M-05) only copies `room-1600.jpg` to `apps/mobile/assets/images/hero/` and **does not** need to append to `THIRD_PARTY_NOTICES.md` |

## 8. Files written by this step

- `packages/shared/assets/hero/room-2560.jpg` (new)
- `packages/shared/assets/hero/room-1600.jpg` (new)
- `THIRD_PARTY_NOTICES.md` (append only)
- `docs/2026-09-30_dems_demo_stack_setup/implementation/10_hero_asset.md` (this file)
- `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/coder_execution_step_29.md`

Not written (P8 / parallel run): `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md`, `01_specs.md`. No npm command and no git command was run, and no process was started.
