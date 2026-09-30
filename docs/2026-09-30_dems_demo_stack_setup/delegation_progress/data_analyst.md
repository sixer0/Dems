# Delegation Progress: data-analyst (Blueprint Row 3)

| Field | Value |
|---|---|
| Agent | data-analyst |
| Blueprint row | 3 (research, sequence S1: 3 → 4 → 5 → 6) |
| Status | **complete** |
| Started / finished | 2026-09-30 about 23:08 WIB / 2026-09-30 23:28 WIB |
| Output | `research/03_analysis.md` (Tier 1: 5W1H, evidence chain, 54 stack decisions SD-01 to SD-54, host impact register, risks R1 to R21) |
| Shared files touched | None. `delegation_progress_report.md` and `status_tasks.md` were not written (parallel isolation, CLAUDE.md §3.4) |
| masterplan/02_plan.md | Not created. Row 5 owns it (see "Plan Note" in 03_analysis.md) |

## Files created

- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/research/03_analysis.md`
- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/delegation_progress/data_analyst.md` (this file)

Nothing was installed and no host state was changed. The verification artefacts (tarballs, the SDK manifest, a throwaway npm workspace) live only in the session scratchpad and `$TMPDIR`.

## Row-3 verification self-check

| Criterion (from 02_structured.md row 3) | Result |
|---|---|
| Every decision area has exactly one choice and at least one rejected alternative, each citing 01 or 02 | Yes. SD-01 to SD-54 each have one choice, rejected alternatives, and 02 or 01 line citations or V-item evidence. Lottie is marked "deferred" (SD-13) rather than chosen or rejected |
| Impact register lists every host path with its rollback command | Yes. HI-1 to HI-13, with the baseline state taken from read-only probes (V17) |
| Unsourced claims labelled "hypothesis" | Yes. Size estimates, the Metro bind address, the `oklch` parsing behaviour, the `expo-dev-client` omission and others are labelled |
| Node verdict, package-manager verdict, React-alignment rule | SD-01, SD-02 and SD-04 |
| Both recorded source conflicts resolved | C1 (compileSdk resolved to 36) and C2 (Reanimated range moot for RN 0.86.3; semver PASS). Four new conflicts are also resolved (C3-C6) |

## Milestones for the controller to record

- M1: **Kit pair selected: HeroUI v3 (web) + HeroUI Native (mobile).** It scored 4.60 against 4.10 for the hybrid shadcn + HeroUI Native pair. 44 of 46 theme variables have the same name on both sides (V6), and the Native example app runs on the exact SDK 57 pins (V9).
- M2: **Node verdict: keep the system Node 26.8.2.** All engines ranges pass (V10). No version manager and no pnpm.
- M3: **React rule: 19.2.3 exact everywhere**, plus root `overrides` (SD-04).
- M4: **Toolchain:** `openjdk@17` formula; Google cmdline-tools 23.0 in `~/Library/Android/sdk`; seven sdkmanager IDs including `ndk;27.1.12297006` and `cmake;3.22.1`; `pixel_tablet` API 36 `google_apis` arm64 AVD. SDK downloads total 3,296 MiB (sourced).
- M5: **Host-baseline surprises:**
  - `~/.zshrc` does not exist, so profile lines go to `~/.zprofile` (V17, V18).
  - `~/.npm` has no root-owned files, so the collector's npm error was the sandbox (V17).

## Blockers

- None blocking this row.
- For downstream rows: **R13, sandbox write scope.** Rows 8-10 and 18 write outside the workspace and will need per-command sandbox bypass through the permission gate. npm commands should use a workspace-local cache.

## Decisions / items for the controller (for decisions.md and the row-6 B.9 classification)

All items are **MINOR** under B.9. No MAJOR trigger was hit.

1. The shell-profile target changes from `~/.zshrc` (absent) to `~/.zprofile` (existing), with a backup and marker blocks. Verification uses `zsh -l -c`.
2. Drop row 11 (watchman). It is not required on SDK 57 (V16).
3. Row 12 becomes verification only (Node kept; npm).
4. The web kit swaps from the shadcn/ui candidate to HeroUI v3. This is a library swap within one decision area.
5. Add `ndk;27.1.12297006` and `cmake;3.22.1` to row 9.
6. Add an Android 16 large-screen orientation opt-out config plugin to row 18 (R14).
7. Never run `shadcn init` in core-web. Copy in Magic UI / Motion Primitives items and record them in `THIRD_PARTY_NOTICES.md`.
8. Internal workspace dependencies use `"*"`, because `workspace:*` fails in npm 11.19.1 (V19).

---

# Row 4: Stack Specification

| Field | Value |
|---|---|
| Blueprint row | 4 (masterplan; sequential run) |
| Status | **complete** |
| Started / finished | 2026-09-30 about 23:30 WIB / 2026-09-30 23:49 WIB |
| Output | `masterplan/01_specs.md` (Tier 1; 1,240 lines; 47 acceptance criteria AC-01 to AC-47 mapped to SC1-SC7; verification items V22-V35) |
| Shared files touched | `delegation_progress_report.md` (append only: rows 3 and 4, as permitted by the controller). `status_tasks.md` not touched |
| masterplan/02_plan.md | Not created (row 5, delegated separately) |

## Files created or updated in row 4

- Created: `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/01_specs.md`
- Updated: `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/delegation_progress/data_analyst.md` (this section)
- Updated (append): `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/delegation_progress_report.md`

Nothing was installed and no host state changed. The read-only probes were `system_profiler` (hardware) and registry, tarball and vendor-repository reads kept in the scratchpad.

## Row-4 verification self-check

| Criterion (02_structured.md row 4) | Result |
|---|---|
| Each of SC1-SC7 maps to at least one AC with a command-level check | Yes. SC1: 11 ACs; SC2: 7; SC3: 6; SC4: 11; SC5: 10; SC6: 1; SC7: 7 (§9 coverage table) |
| No TBD values | Yes. A grep for TBD or TODO returns 0. Every hypothesis (H-S1 to H-S12) has a deterministic fallback |
| Every library chosen in 03 appears | Yes. The 63-term grep reports all present, and the §11 traceability table covers SD-01..SD-54 |
| Controller's content list (layout, shared contract, theme, mock-core, core-web, mobile, networking, AVD, ports, telemetry, tests, ACs) | All present, in §1-§9 |

## Row-4 decisions for the controller (all MINOR; see spec "Changes relative to 03")

- SPEC-C1: **CORS on mock-core** (`@fastify/cors 11.3.0`, allowlist `http://127.0.0.1:5173` and `http://localhost:5173`) replaces SD-42's Vite proxy, following the controller's row-4 directive. The web app calls `127.0.0.1:4400` directly.
- SPEC-C2: `react-is` is removed from root `overrides` (direct dependency of core-web only).
- SPEC-C3: Linters are oxlint 1.86.0 (web, shared, mock; the create-vite template default) and ESLint 9.39.5 + eslint-config-expo 57.0.2 (mobile).
- SPEC-C4: Vite binds explicitly to `127.0.0.1:5173` with `strictPort`.
- SPEC-C5: The WS Origin allowlist is enforced in `preValidation` (403 otherwise).
- SPEC-C6: `@types/react` 19.2.18 and `@types/react-dom` 19.2.7 are pinned exactly.
- SPEC-C7: Proof elements are Magic UI `BorderBeam` and Motion Primitives `SlidingNumber`.
- SPEC-C8: "motion=slow" proof mode on both apps, so the enter-transition evidence is deterministic.
- SPEC-C9: Mobile fonts use HeroUI Native `--font-*` variables (vendor example pattern).
- SPEC-C10: The AVD disables mic input and cameras (to avoid macOS privacy prompts).

## Row-4 blockers

- None. Carried forward for rows 8-10 and 18: sandbox bypass per host command (D14).

## Row-4 revision for D15/D16 (controller update, finished 2026-10-01 00:00 WIB)

**Status: complete.** `masterplan/01_specs.md` was revised in place (now 1,453 lines).

| Change | Where |
|---|---|
| The designer's DesignSystem tokens replace the palette, typography, radius and elevation. Gold `#FFC86B`, bronze `#FF9F3D`, status colours, charcoal `#1F262E`, black `#0B0D0F`; Orbitron, Inter and JetBrains Mono; spacing 4-48; radius 4/8/12/16/full; stroke 1/1.5/2; glow elevation 0-3 | §2.7, §2.9 (SPEC-C11, C12) |
| Sampled values that need designer confirmation: Sealed purple `#8B5CF6` (hue ≈258°), foreground `#F9FAFB`, and the gold hairline measured at 18% alpha | §2.7, V36 (SPEC-C13) |
| AA contrast checked. Status text uses the 400 step; white on red is AA-large only | §2.7, V39 |
| Badge and tag tone map from DesignSystem §06 and AssetSample | §2.8 |
| Kit theming capability check: variables cover canvas, surfaces, gold primary, status colours, radius, fonts and level-1 glow (both kits route Card and Surface shadows through `--surface-shadow`). Gaps (bronze, info, sealed, glow levels 2 and 3, Card radius, gradient CTAs) close with Tailwind utilities on kit components. Rings, charts and meters come from the chosen libraries. No hand-built primitives | §2.10, V38 (SPEC-C14..C16) |
| Font packages swapped in the pins, app wiring and ACs (AC-19, AC-33) | §1.4, §4.1, §5.4, §9 |
| New §13 "Pending scope change (D15)": (a) phone portrait or tablet landscape, (b) web screens to build, (c) mock-core simulator depth. It lists the dependent spec items **without answering them**, plus design questions Q-D1..Q-D7 | §13 |
| New hypotheses H-S13..H-S16, each with a fallback | §10 |

Checks: 47 ACs, contiguous, each mapped to SC1-SC7; 0 TBD; all library and design-token terms present; no leftover old-palette hexes; no emoji.

Design inconsistencies for the controller to relay:
- In the mobile mockup, Sealed is a gold chip and Exported is blue; DesignSystem shows purple and green.
- Panels render near-black over imagery rather than charcoal.
- White on red fails AA for small text.
- Eurostile licensing (Orbitron is the free stand-in).

---
*Generated: 2026-09-30 23:28 WIB (row 3); row 4 section added 2026-09-30 23:49 WIB*

---

# Rev-3 delegation: Steps A → B → C (D17-D28; parallel run with coder-execution, D27)

| Step | Artifact | Status | Size |
|---|---|---|---|
| A | `masterplan/01_specs.md` rev 3 | **complete** | 1,996 lines; 75 ACs (AC-01..AC-75, contiguous, each mapped) |
| B | `masterplan/03_motion_spec.md` | **complete** | 53/53 04 §8 opportunities realised (Appendix B); MS-01..MS-10 |
| C | `masterplan/02_plan.md` (row 5) | **complete** | Rows 1-25 mapped one-to-one; W-01..W-24 proposed for row 6 |

**Shared files:** this is a parallel run, so `delegation_progress_report.md` and `status_tasks.md` were **not** written.

## What changed in 01_specs (rev 3)

| Change | Where |
|---|---|
| D17: `orientation: "default"`; Android 16 opt-out plugin removed; responsive 900 dp layout | §5.1, §5.2, §5.5 |
| D23/D24: two AVDs (`dems_tablet`, `dems_phone`, values from `05_avds.md`); `--no-metrics`; emulator outside the sandbox | §6.3, §7; AC-04, AC-06, AC-07, AC-08, AC-25, AC-29, AC-30 |
| Tokens rev 3 (D28/Q6 plus pixel measurements V40): warm `--surface #191008`, inset `#150E07`, bronze 35% border `#FF9F3D59`, bronze-tinted glow, Charcoal for L5 only, `foreground-2 #D8CEC6` | §2.7, §2.9 |
| Badge tones: Under Review / IN REVIEW amber; EXPORTED Info Blue (04 §9 #10, #11) | §2.8 |
| §13 resolved against D17-D28 | §13 |
| New §14: 10 pages plus the Start Session flow — routes, shell, per-panel component mapping, five custom compositions, simulator on zustand 5.0.15, simulated auth, API Reference on Scalar 0.9.76, assets, i18n on i18next, D28 defaults, AC-48..AC-75 | §14 |

## Evidence gathered (V40-V46)

- **V40:** pixel sampling of D1 and SM.
- **V41:** Scalar vs Swagger UI.
  - Swagger UI depends on `@scarf/scarf` install analytics and defaults to an external `validatorUrl`.
  - Scalar's `telemetry` and `withDefaultFonts` default to `true` but can be switched off; its PostHog plugin is opt-in; it never proxies local URLs; it supports `customFetch` and `x-badges`.
- **V42:** registry facts for zustand, @noble/hashes, i18next and the OpenAPI parser.
- **V43:** Magic UI and Motion Primitives items, props and dependencies.
- **V44:** Pexels and Unsplash licence terms.
- **V45:** row 8-10 logs.
- **V46:** contrast on the warm surfaces.

## Flags for the controller

- **PIN CHANGE — needs coder follow-up:** **none.** No version pin, package name, port or file path in §0-§8 changed. The D17 plugin path was never created, because row 18 had not started.
- **TOKEN CHANGE — needs coder follow-up (MINOR):** row 15 built `tokens.ts` with the rev-2 values. The rev-3 value table is in `02_plan.md` §6.1. The coder applies it now, or W-01 does.
- **D17 reminder for row 18:** `02_plan.md` §6.2.

## Decisions to record (all MINOR, except the MAJOR scope already recorded as D22)

1. Scalar renderer chosen; Swagger UI rejected.
2. zustand simulator store.
3. i18next.
4. @noble/hashes.
5. Tokens rev 3.
6. Badge tones.
7. Asset sourcing (Pexels/Unsplash still plus procedural camera feeds).
8. No mock-core extension proposed (D26 open point closed).
9. Sequencing Option A (baseline commit first).
