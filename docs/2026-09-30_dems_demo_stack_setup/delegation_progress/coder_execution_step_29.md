# Delegation progress: coder-execution, step 29 (hero asset, W-05, SCR-04)

Parallel-run file (P8). The controller synthesises it into the shared files. This agent did not write `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`, `decisions/decisions.md`, `masterplan/01_specs.md` or `implementation/99_implementation_report.md`.

- **Status:** complete
- **Window:** 2026-10-01 02:10–02:17 WIB
- **Step log:** `implementation/10_hero_asset.md` (Tier 3)
- **Path taken:** primary (a licensed photo). The procedural SVG fallback (H-S19) was not built because a qualifying photo exists.

## Outcome

| Item | Value |
|---|---|
| Photo | Pexels 3906592 by Leandro Alamino, Pexels License. `https://www.pexels.com/photo/black-leather-office-rolling-chairs-beside-brown-wooden-table-3906592/`. Retrieved 2026-10-01. Original 6000×4000, SHA-256 `58b7f0d6…3d375ec0`; not stored in the repo |
| `packages/shared/assets/hero/room-2560.jpg` | 2560×1706, JPEG q80 (`sips`), sRGB, 1,082,103 B, SHA-256 `93d04e00…fcb676db` |
| `packages/shared/assets/hero/room-1600.jpg` | 1600×1066, JPEG q80 (`sips`), sRGB, 326,153 B, SHA-256 `c8f8721c…397066a3` |
| `THIRD_PARTY_NOTICES.md` | New `## Media assets` section (line 77 is the hero row: URL, author, licence, date, `apps/core-web` and `apps/mobile`). Lines 1–67 byte-identical (sha256 `1beb5b43…` before and after) |

## Verification (row 29)

| Check | Result | Evidence |
|---|---|---|
| AC-67, notices row | PASS | The single row contains `pexels.com/photo/`, `Leandro Alamino`, `Pexels License`, `2026-10-01`, `apps/mobile` and `apps/core-web` (each `grep -cF` = 1) |
| `sips -g pixelWidth packages/shared/assets/hero/*` | PASS | Prints `1600` and `2560` |
| No `ui_design/` or MB 1 derivative in the workspace assets | PASS | 56 image files scanned: 0 hash matches with `ui_design/*.png`. All other files are Expo template or icon-cache images. `tutorial-web.png` was viewed and is the Expo starter art |
| Content: no people, insignia, logos or readable text | PASS | Full-resolution crops checked. The flipchart clip label is defocused and unreadable |
| P1 (no npm), P6 (write paths), P7 (processes) | PASS | No npm or git command; no process started; only the row-29 paths plus this file and the step log were written |

## Decisions and drift to record (proposed)

1. **env: `sips` needs a per-command sandbox bypass.**
   - In the sandbox it fails with `Error 13: Cannot write to file /var/folders/…/T/<uuid>`, because it writes a scratch file in the per-user temp directory. `TMPDIR` and `--out` do not help.
   - All `sips` calls ran with the bypass. They wrote only to the scratch directory and `packages/shared/assets/hero/`.
   - **Heads-up:** step 28 (PNG exports) and the mobile brand-media row (M-05) will need the same bypass.
2. **process: bot checks not bypassed.**
   - Unsplash `/napi` (Anubis, 401) and the Pexels HTML pages (Cloudflare, 403) block curl. Neither was bypassed.
   - WebSearch and WebFetch supplied page metadata. `curl` was used only on `images.pexels.com` and `images.unsplash.com`, which returned 200.
   - All queries were generic; no project names or domain terms.
3. **spec (MINOR): AC-67's command in 01_specs (line 1957) still names `apps/core-web/src/assets/hero/*`.**
   - Under D40 it should be `packages/shared/assets/hero/*`.
   - This step verified at the D40 path and left the spec for the controller (P1 item "Correct … AC-67 (path)").
4. **plan: W-05 in 02_plan is superseded by row 29.**
   - Path: `apps/core-web/src/assets/hero/` → `packages/shared/assets/hero/`.
   - Artefact: `12_hero_asset.md` → `10_hero_asset.md`.
   - D37 and D40 already cover both changes; only the tracking needs updating.
5. **tech: aspect ratio.** The output is 3:2 (2560×1706), which meets the ≥ 2560×1440 minimum. The extra height helps the Login brand-side crop.
6. **advice for consumer rows** (W-08 CameraFeed, the Dashboard and Login page rows, M-05):
   - Focal point `object-position` ≈ `62% 45%`.
   - The source is already warm and dark, so the 04 §7 CSS grade applies as specified.
   - Crop the camera feeds from `room-2560.jpg`.
7. **mobile hand-over: SCR-04 is satisfied here.** The notices row already names `apps/mobile`. M-05 only copies `room-1600.jpg` into `apps/mobile/assets/images/hero/` and **needs no `THIRD_PARTY_NOTICES.md` write**. That removes one writer from the P6 single-writer scan.
8. **observation: `THIRD_PARTY_NOTICES.md` line 66 (`app/page.tsx` inside the Motion Primitives MIT block) is faithful to upstream.** `raw.githubusercontent.com/ibelick/motion-primitives/main/LICENCE.md` ends with the same line. No action needed.

## Files written

- `/Users/gsp-budi/Documents/DEMS/packages/shared/assets/hero/room-2560.jpg`
- `/Users/gsp-budi/Documents/DEMS/packages/shared/assets/hero/room-1600.jpg`
- `/Users/gsp-budi/Documents/DEMS/THIRD_PARTY_NOTICES.md` (append only)
- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/implementation/10_hero_asset.md`
- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/delegation_progress/coder_execution_step_29.md`

## Blockers

None.
