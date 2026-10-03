---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 28
agent: image-specialist
status: complete
started: 2026-10-01 02:13 WIB
finished: 2026-10-01 02:24 WIB
---

# image-specialist, step 28: brand emblem, favicon, PNG exports

## Inputs read
- identification/02_structured.md: row 28; Parallel Execution Protocol P1-P12
- masterplan/01_specs.md rev 3 §14.10 (Assets), AC-68, SPEC-C11 (gold token), §2 tokens
- masterplan/03_motion_spec.md: M-APP-01/03, M-PG-LOGIN, M-C-22, §9.2 (pathLength on the emblem)
- masterplan/04_mobile_specs.md §8.1 and SCR-03; masterplan/05_mobile_plan.md M-05; row 35 (brand-sync test)
- research/04_ui_design_analysis.md §0, §7 (emblem regions, recreate-as-SVG)
- decisions/decisions.md D37, D40
- packages/shared/src/tokens/tokens.ts (`gold: '#FFC86B'`, `black: '#0B0D0F'`, bronze glow values)
- ui_design/DEMS-DesignSystem.png and DEMS-Dashboard1.png (viewed; reference crops kept in the session scratchpad only)

## Progress
- [x] Renderer probe: `qlmanage` and Chrome blocked by the sandbox; Playwright chrome-headless-shell 153 works with a per-command sandbox bypass (already installed; nothing installed)
- [x] Drafts v1 → v3 rendered next to the designer crops; v3 accepted (implementation/09 §5)
- [x] `apps/core-web/src/assets/brand/emblem.svg` written (7 target ids plus `emblem-gradient`)
- [x] `apps/core-web/public/favicon.svg` replaced (the Vite template; its sha256 is recorded in 09 §2)
- [x] Three PNGs rendered from the repo emblem.svg and placed in `packages/shared/assets/brand/`
- [x] Row 28 verification: AC-68 = 7; favicon exists; FFC86B count 2; xmllint exit 0 ×2; sips 1024x1024 ×3; hasAlpha yes (all three); no ui_design raster (0 hash duplicates, no `<image>`/`data:`)
- [x] getTotalLength > 0 for all 7 ids; PNG safe-zone audit
- [x] No headless-browser process left running (P7)
- [x] Report: implementation/09_brand_emblem.md

## Files created or updated
- `/Users/gsp-budi/Documents/DEMS/apps/core-web/src/assets/brand/emblem.svg` (new; directory created)
- `/Users/gsp-budi/Documents/DEMS/apps/core-web/public/favicon.svg` (replaced the template)
- `/Users/gsp-budi/Documents/DEMS/packages/shared/assets/brand/icon-foreground-1024.png` (new; directory created)
- `/Users/gsp-budi/Documents/DEMS/packages/shared/assets/brand/icon-monochrome-1024.png` (new)
- `/Users/gsp-budi/Documents/DEMS/packages/shared/assets/brand/splash-1024.png` (new)
- `docs/2026-09-30_dems_demo_stack_setup/implementation/09_brand_emblem.md` (new)
- `docs/2026-09-30_dems_demo_stack_setup/implementation/assets/09_brand_emblem_preview.png` (new; my renders only)
- `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/image_specialist_step_28.md` (this file)

Shared files NOT written (P6/P8): masterplan/02_plan.md, status_tasks.md, delegation_progress_report.md, implementation/99_implementation_report.md. No package.json or lockfile touched; no npm command run (P1). Not committed.

## For the controller
- S28-1 (step 35): `emblem.ts` should also export the stroke widths (shield 3.2, arcs 2.6), not only viewBox, shield, arcs[6] and stops. The `d` values are single-line for verbatim mirroring. `emblem-shield` is one path with two subpaths (the double stroke).
- S28-2 (steps 38 / Login): give the gradient id (and the path ids, if the SVG is inlined) a unique value per instance when two emblems coexist during the M-APP-01 flight. The scan order is arc-1 (core) outward to arc-6 (roof).
- S28-3 (step 72 / M-05): the PNGs are transparent. Use background `#0B0D0F` for the adaptive icon and splash. There is no dedicated opaque legacy `icon` PNG; reuse the foreground or request one.
- S28-4: row 28's `qlmanage` hypothesis fails in the sandbox. Future renders need the headless-browser fallback with a per-command sandbox bypass (the user can adjust this via `/sandbox`).
- S28-5: 04 §7's 16/32/180/512 px exports were superseded by row 28. No 180 px apple-touch-icon exists; add a row if the web app needs one.
