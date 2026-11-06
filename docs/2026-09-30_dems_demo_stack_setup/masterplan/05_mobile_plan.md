---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: data-analyst
type: implementation-plan (mobile lane)
narrative_tier: 1
based_on:
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/04_mobile_specs.md
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/02_plan.md (§4 W-rows; read-only)
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md (D32-D35)
decisions_applied: D6, D14, D17, D19, D23, D24, D28, D30, D32, D33, D34, D35
status: complete (pending the Mobile Approval Gate, D33)
last_updated: 2026-10-01 01:15 WIB
---

# Mobile Implementation Plan (D33, built in parallel per D34/D35)

## 0. How to read this plan

### 0.1 5W1H

| Dimension | Content |
|---|---|
| **What** | Ordered rows **M-01..M-22** that build `apps/mobile` per `04_mobile_specs.md`: agent, dependencies (including the shared web rows W-01..W-05 and the scaffold rows), owned write paths, log path, acceptance IDs, and whether the row needs a native rebuild or an emulator. Plus the combined wave table with agent counts, the resource-lock protocol, effort sizing, risks, rollback, verification, and the **Mobile Approval Gate** summary |
| **Who** | Executors: `coder-execution` (up to 3 in the mobile lane at once, D34), `test-expert`, `verifier`, `security-review`, `senior-code-reviewer`, `git-specialist`. Controller: gate, wave launch, lock files, lane and port assignment, decision records |
| **When** | After the Mobile Approval Gate (D33) and the stack baseline (Option C, D32). Under D34 the mobile lane runs **in the same waves** as the web lane |
| **Where** | Code: `/Users/gsp-budi/Documents/DEMS/apps/mobile/`. Logs: `docs/2026-09-30_dems_demo_stack_setup/implementation/40_…57_…`, `test/03_…`, `verification/07_…09_…`. Host: only the optional Maestro row writes outside the workspace (`~/.maestro`) |
| **Why** | D34 asks for maximised parallel waves; D35 adds resource guards. This plan turns both into concrete rows with disjoint write paths, so web and mobile coders never touch the same file at the same time |
| **How** | Rows are cut along the spec's ownership lines (04 §3.1 rules, §4.0 compositions, §5.2 runtime). Everything that must be serial (lockfile, Gradle, emulators, README, git) goes through one lock or one slot. Lock commands were tested on this host (`lockf`, 04 VM-18) |

### 0.2 Tags

| Tag | Meaning |
|---|---|
| **[NPM]** | Writes `package.json` or `package-lock.json`; holds `.locks/npm.lock` (the single lockfile-writer slot, D35 rule 1) |
| **[GRADLE]** | Runs `expo prebuild` or Gradle; holds `.locks/gradle.lock` (D35 rule 2) |
| **[AVD-P] / [AVD-T]** | Uses `dems_phone` / `dems_tablet`; holds that AVD's lock (D35 rule 3) |
| **[SB-OFF]** | Emulator and adb commands run outside the sandbox (D24) |
| **[HOST]** | Writes outside the workspace (rollback given) |
| **[JS]** | JavaScript-only: reuses the installed dev build through Metro; never rebuilds native code |

---

## 1. Current state (read-only check, 2026-10-01 01:05-01:15 WIB)

| Item | State | Evidence |
|---|---|---|
| Row 18 (mobile scaffold, full dependency set per D30) | In progress | `apps/mobile/package.json` is still the Expo template; no mobile `node_modules` yet (04 VM-21) |
| `packages/shared/src/sim` | Empty placeholder | `src/sim/index.ts` exports nothing (04 VM-19); W-02 fills it |
| Tokens | Rev 3 on disk; NEW motion tokens missing | 04 VM-20; W-01 adds them |
| `@dems/shared` exports | `./sim` declared; `./i18n` missing | 04 VM-19 (SCR-05) |
| AVDs | `dems_phone`, `dems_tablet` created and cold-booted | `initialization/05_avds.md` |
| Lock tooling | `flock` absent; `/usr/bin/lockf` works (exit 75 when locked) | 04 VM-18 |
| Web plan | W-01..W-24 proposed; row 6 is merging W- and M-rows into shared waves (D34) | `02_plan.md` §4, decisions D34 |

## 2. Target state

- `apps/mobile` implements every screen in 04 §1 on phone portrait and tablet multi-pane, unlocked orientation, simulator-driven, with motion per 04 §7.
- Verified against **MA-01..MA-30** (04 §11) plus the unchanged scaffold ACs (AC-16, AC-25..AC-34).
- Committed locally (no remote) together with, or right after, the web build.

---

## 3. Rows (M-01..M-22)

**Common rules for every M-row:**
1. **Never edit** `packages/shared/**`, `apps/core-web/**`, `apps/mock-core/**`, the root `package.json`, `README.md` or `THIRD_PARTY_NOTICES.md` (except where a row below says so, in its own serial slot). Missing shared pieces go to the controller as SCR items (04 §13).
2. **Never edit** `apps/mobile/package.json` or `package-lock.json` except in **M-01** (D35 rule 1).
3. Only **M-01** and **M-05** rebuild native code (D35 rule 2); all other rows are [JS].
4. Each row writes only its **owned paths**. Route files (`src/app/**`) are owned by M-03 after wave 1; screen rows write `src/features/<folder>/**` only.
5. Each row ends with `npm run typecheck -w @dems/mobile`, `npm run lint -w @dems/mobile` and its own tests (`npm test -w @dems/mobile -- <paths> --maxWorkers=2`), all exiting 0, and a device smoke on **both** AVDs under their locks (§5).
6. Each row writes `delegation_progress/coder_execution_<row>.md` (for example `coder_execution_m07.md`), never the shared progress files (CLAUDE.md §3.4).
7. Each agent stops every process it started (Metro, adb reverse rules) before returning (D35 rule 6).

| Row | Task | Agent | Depends on | Owned write paths | Tags | Output log | Acceptance |
|---|---|---|---|---|---|---|---|
| **M-01** | **Mobile dependency + native config row.** (a) Diff installed packages against 01S §1.4 and 04 §8.4; install only what is missing (`npx expo install` for R-1: `expo-local-authentication`, `@react-native-async-storage/async-storage`, `react-native-keyboard-controller`; `npm install --save-exact` for R-2: `zustand@5.0.15`, `i18next@26.4.2`, `react-i18next@17.0.15`). (b) Move the jest config out of `package.json` into `jest.config.js` with the 04 §10.1 additions (`@noble/.*` allowlist, mocks in `jest.setup.ts`). (c) Add package scripts: `start:lane` (`EXPO_NO_TELEMETRY=1 expo start --localhost --port ${METRO_PORT:-8081}`) and, if Maestro is approved, `e2e` (with `MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true`). (d) `app.json`: add the `expo-local-authentication` plugin; confirm `scheme: "demsdemo"` and `orientation: "default"`. (e) Add `apps/mobile/scripts/device-session.sh` (the §5.4 lock-and-lane helper). (f) Prebuild + Gradle once; install on both AVDs; prove the lane-port reverse (04 H-MB-09) | coder-execution | Row 18 done; baseline commit (D32); **after W-01 releases `npm.lock`** | `apps/mobile/{package.json,app.json,jest.config.js,jest.setup.ts,scripts/**}`, root `package-lock.json`, `apps/mobile/android/` (generated, git-ignored) | [NPM] [GRADLE] [AVD-P] [AVD-T] [SB-OFF] | `implementation/40_mobile_deps_native.md` | MA-01, MA-02, MA-26 (AC-27 part), AC-16, AC-25, AC-26 still PASS |
| **M-02** | **Foundation (no simulator):** layout classes and `SafeScreen`/`PaneLayout` (04 §2.2); `AppProviders` without simulator or auth, wired into the existing `src/app/_layout.tsx` (edit, not rename); the **runtime contract stub** `src/runtime/index.ts` (typed no-op `SimRuntimeProvider`, `useCoreLink`, `SessionRouteSync`, `KeepAwakeController`, `useAuth`) so M-03 and M-06 can work in parallel; motion kit (`src/motion/`: token → Reanimated mapping, builders, `useMotionPolicy` + `ReducedMotionConfig` + kit `animation: 'disable-all'`, GlowLayer, haptics service, `?debug=1` overlay); kit recipes (`StatusChip`, `SubjectTypeChip`, `SectionCard`, `KeyValueList`); i18n init with the mobile namespace only; `src/global.css` additions if needed. Tests T-M01, T-M12, T-M14 | coder-execution | Gate; row 18 (W-01 soft: NEW motion tokens are read if present, else the SCR-07 fallback constants) | `apps/mobile/src/{layout,motion,providers,components/kit,i18n,runtime/index.ts}/**`, `src/app/_layout.tsx` (wave 1 only), `src/global.css` | [JS] [AVD-P] [AVD-T] | `implementation/41_mobile_foundation.md` | MA-18 (T-M12 part), MA-20, MA-22 (part) |
| **M-03** | **Navigation shell:** the full Expo Router tree of 04 §3.1 with **stub screens for every route** (each stub renders `screen-<id>` from `src/features/<folder>/<name>-screen.tsx`, created empty here and then owned by the screen rows); `Stack.Protected` guard bound to the `useAuth` contract; headless `Tabs` with `ResponsiveTabList` (C-5: `BottomTabBar`, `NavRail`, `LiveMiniBar`); hidden triggers for More destinations (H-MB-01); boot router `src/app/index.tsx` that keeps `?motion=` on the row-18 proof screen (AC-31); `/stack-check`, `/pair` public; back-guard infrastructure (`usePreventRemove` hook in `src/navigation/`); deep-link parsing (zod search params). Tests T-M02 (stubs), T-M03 (with a fake auth contract) | coder-execution | M-02 | `apps/mobile/src/app/**` (from wave 2 on), `src/navigation/**`, `src/components/composed/nav/**`, **creation only** of empty `src/features/<folder>/<name>-screen.tsx` stubs | [JS] [AVD-P] [AVD-T] | `implementation/42_mobile_navigation_shell.md` | MA-04 (stubs), MA-05, MA-12 (chrome part), MA-13 (chrome part), MA-14, MA-15 |
| **M-04** | **Compositions and asset renderers (no simulator):** C-1 GlowRing, C-2 DbfsMeter (input = shared values), C-3 SessionTimeline, C-4 Stepper, C-6 RollingNumber (04 §4.0); `CameraFeed`, `Emblem`, `HeroBackdrop` with **placeholder** image and path data until M-05; pure-maths modules with tests (segment opacity, peak decay, ring sweep); a debug-only gallery route `src/app/dev-gallery.tsx` (new file; M-03 keeps it). Compositions take the motion policy as a prop, so they do not wait for M-02 | coder-execution | Gate; row 18 (W-01 soft, as M-02) | `apps/mobile/src/components/{composed/*.tsx (not nav/),media/**}`, `src/app/dev-gallery.tsx` (create only) | [JS] [AVD-P] [AVD-T] | `implementation/43_mobile_compositions.md` | MA-16, MA-23 (part), T-M09 |
| **M-05** | **Brand and media wiring:** real emblem path data (SCR-03 or the copy fallback) into `Emblem`; app icon, adaptive icon, monochrome and splash PNGs into `apps/mobile/assets/images/brand/` and `app.json`; the hero still's mobile variant (≤ 1600 px, `sips`, SCR-04 or copy fallback) into `CameraFeed`/`HeroBackdrop`/thumbnails; topographic SVG (SCR-06 or copy); **one** native rebuild and reinstall on both AVDs. If SCR-04's fallback applies, this row appends the mobile-use line to `THIRD_PARTY_NOTICES.md` only in a slot where no web row writes that file (after W-05 and W-08) | coder-execution | M-01, M-04, **W-04**, **W-05** | `apps/mobile/assets/images/{brand,hero}/**`, `apps/mobile/app.json` (icon and splash keys only), `src/components/media/**` (asset wiring), optionally one line in `THIRD_PARTY_NOTICES.md` | [GRADLE] [AVD-P] [AVD-T] [SB-OFF] | `implementation/44_mobile_brand_media.md` | MA-24, MA-11 (icon/splash part) |
| **M-06** | **Runtime and simulator wiring:** replace the M-02 stubs in `src/runtime/**`: `SimRuntimeProvider` (shared `createSim` + AsyncStorage storage + AppState visibility + hydration gate, 04 §5.2), `useAudioSharedValues` (04 §5.4), Core link (simulated or heartbeat), `SessionRouteSync` (pure `resyncTarget` + triggers, 04 §3.7), `KeepAwakeController`, `AuthProvider` over the simulator's `auth.ts`, idle lock, `ConnectionBanner` logic; merge the shared i18n resources. Tests T-M06, T-M07 | coder-execution | M-02; **W-02** (simulator, including SCR-01/02 or W-02b); **W-03** (i18n, `sessionCreateSchema`, SCR-05) | `apps/mobile/src/{runtime,auth}/**`, `src/i18n/**` (merge), `src/providers/app-providers.tsx` (add providers) | [JS] [AVD-P] [AVD-T] | `implementation/45_mobile_runtime_sim.md` | MA-08, MA-10 (runtime part), MA-19, MA-28 |
| **M-07** | **Login + Pairing + biometric** (04 §4.1, §4.2, §6); biometric enrolment on both AVDs per 04 §6.3 if approved (Q-M3). Tests T-M04, T-M05 | coder-execution | M-03, M-05, M-06 | `src/features/{login,pairing}/**` | [JS] [AVD-P] [AVD-T] [SB-OFF] | `implementation/46_mobile_login_pairing.md` | MA-06, MA-07, MA-15 (login part) |
| **M-08** | **Home (Dashboard)** (04 §4.3) | coder-execution | M-03, M-04, M-06 | `src/features/dashboard/**` | [JS] [AVD-P] [AVD-T] | `implementation/47_mobile_home.md` | MA-11 (MB 2), MA-12 (home), MA-18 (ring) |
| **M-09** | **Start New Session** (04 §4.4, including the §5.3 gate and ARMED). Test T-M10 | coder-execution | M-03, M-04, M-06 | `src/features/session-new/**` | [JS] [AVD-P] [AVD-T] | `implementation/48_mobile_start_session.md` | MA-11 (MB 3), MA-29 (steps 1-3), MA-30 (step 2 part) |
| **M-10** | **Session Monitor** (04 §4.5: feed, meters, actions, End Session hold + reason, sheets, back guard, banner). Test T-M08 | coder-execution | M-03, M-04, M-06 | `src/features/session-live/**` | [JS] [AVD-P] [AVD-T] | `implementation/49_mobile_session_live.md` | MA-09, MA-11 (MB 4), MA-12 (live), MA-17, MA-30 (monitor part) |
| **M-11** | **Finalization, Summary, Recovery and the Sessions hub** (04 §4.6-§4.9) | coder-execution | M-03, M-04, M-06 | `src/features/{session-finalizing,session-summary,session-recovery,sessions}/**` | [JS] [AVD-P] [AVD-T] | `implementation/50_mobile_finalize_summary_sessions.md` | MA-29 (finalize to summary) |
| **M-12** | **Evidence list, detail, export and play sheets** (04 §4.10, §4.11). Test T-M15 | coder-execution | M-03, M-04, M-05, M-06 | `src/features/evidence/**` | [JS] [AVD-P] [AVD-T] | `implementation/51_mobile_evidence.md` | MA-11 (MB 5, MB 6), MA-12 (evidence), MA-13 (selection) |
| **M-13** | **Devices & Inputs and device detail** (04 §4.12) | coder-execution | M-03, M-04, M-06 | `src/features/devices/**` | [JS] [AVD-P] [AVD-T] | `implementation/52_mobile_devices.md` | MA-11 (MB 7) |
| **M-14** | **Storage and Network & Time** (04 §4.13, §4.14) | coder-execution | M-03, M-04, M-06 | `src/features/{storage,network-time}/**` | [JS] [AVD-P] [AVD-T] | `implementation/53_mobile_storage_network.md` | MA-11 (MB 8, MB 9) |
| **M-15** | **Audit, Settings (all sections incl. Demo controls), More** (04 §4.15-§4.17). Test T-M11 once all screens exist is left to M-16 | coder-execution | M-03, M-06 | `src/features/{audit,settings,more}/**` | [JS] [AVD-P] [AVD-T] | `implementation/54_mobile_audit_settings_more.md` | MA-11 (MB 10), MA-30 (demo controls) |
| **M-16** | **Mobile test suite completion:** T-M02 (all real screens), T-M11 (missing keys), cross-cutting tests; Maestro flows `apps/mobile/e2e/maestro/01..04_*.yaml` if approved, run on both AVDs | test-expert | M-07..M-15; M-17 (if Maestro) | `apps/mobile/src/**/__tests__/**`, `apps/mobile/src/test/**`, `apps/mobile/e2e/**` | [JS] [AVD-P] [AVD-T] [SB-OFF] | `test/03_mobile_test_report.md` | MA-03, MA-04, MA-21, MA-27 |
| **M-17** | **Optional: Maestro CLI install** (only if Q-M2 is approved): download `cli-2.11.0/maestro.zip`, verify sha256 `5384593c…1283a` against `checksums_sha256.txt`, unzip into `~/.maestro`, run `~/.maestro/bin/maestro --version` with the analytics opt-outs; **no shell-profile edit**; `test ! -e ~/.zshrc` still holds | coder-execution | Gate (Q-M2) | `~/.maestro/**` | [HOST] [SB-OFF] (network download) | `implementation/55_maestro_install.md` | MA-27 precondition; AC-10 still PASS |
| **M-18** | **Mobile verification half** on both AVDs: MA-01..MA-30 plus the scaffold mobile ACs (AC-16, AC-25..AC-34); screenshots and the contact sheet | verifier | M-16 | `docs/…/verification/07_mobile_verification.md`, `docs/…/implementation/assets/mobile/**` | [AVD-P] [AVD-T] [SB-OFF] (read-only on code) | `verification/07_mobile_verification.md` | MA-01..MA-30 |
| **M-19** | **Mobile security review:** no credentials in storage or logs, AsyncStorage keys (04 §5.3), loopback-only traffic (MA-25), no EAS, Maestro telemetry off, biometric handling, `THIRD_PARTY_NOTICES` for mobile assets | security-review | M-18 | `verification/08_mobile_security.md` | read-only | `verification/08_mobile_security.md` | PASS or CAUTION acknowledged |
| **M-20** | **Mobile code review:** D6 compliance (MA-23), shared-contract use (MA-28), single React/zustand copies, UI-thread discipline, ownership rules held | senior-code-reviewer | M-18 | `verification/09_mobile_code_review.md` | read-only | `verification/09_mobile_code_review.md` | 0 open blockers |
| **M-21** | **Run guide, mobile section** (lanes, locks, AVD boot with fixed ports, deep links, scenarios, biometric enrolment, Maestro) | coder-execution | M-19, M-20; **after W-22** (single README writer) | `README.md` (mobile section only) | — | `implementation/56_mobile_run_guide.md` | AC-44 (extended) |
| **M-22** | **Commit** (local, no remote). Preferably folded into W-24 as one combined web + mobile commit | git-specialist | M-21; **with or after W-24** (single git writer) | git index | — | `implementation/57_git_mobile_commit.md` (or W-24's log) | `git status` clean; no remote |

**Log numbering:** mobile logs use `implementation/40…57`, `test/03`, `verification/07…09`. They do not collide with rows 01-07, the web rows' `08…27` (02P §4), `test/01-02` or `verification/01-06`.

---

## 4. Waves (D34: ≤ 6 agents of one type, ≤ 8 in flight)

### 4.1 Combined wave table

The web column follows `02_plan.md` §4 as adapted to D34 (up to 3 web coders). **Row 6 owns the final web sequencing**; the web figures here are assumptions used only to check the limits.

| Wave | Web lane (assumed, row 6 decides) | Mobile lane | coder-execution in flight | Other agents | Total in flight | Serial slots used |
|---|---|---|---|---|---|---|
| **G** | — | **Mobile Approval Gate** (D33), together with or after gate D22 | 0 | 0 | 0 | — |
| **1** | W-01 first (npm.lock), then W-02, W-03, W-05 | M-01 (waits for `npm.lock` after W-01), M-02, M-04 | ≤ 6 (3 web + 3 mobile) | image-specialist ×1 (W-04) | ≤ 7 | npm.lock: W-01 → M-01. gradle.lock: M-01 |
| **2** | W-06 → W-07 → W-08 (1-2 coders) | M-03, M-05, M-06; M-17 (optional) | ≤ 6 (2 web + 3 mobile + M-17) | 0 | ≤ 6 | gradle.lock: M-05. M-06 needs W-02 and W-03 done |
| **3** | 3 page rows (for example W-09, W-10, W-13) | M-07, M-08, M-09 | 6 | 0 | 6 | emulator locks shared by up to 3 mobile coders (§5.4) |
| **4** | 3 page rows (for example W-11, W-14, W-15) | M-10, M-12, M-13 | 6 | 0 | 6 | same |
| **5** | 3 page rows (for example W-12, W-16..W-19 as they fit) | M-11, M-14, M-15 | 6 | 0 | 6 | same |
| **5b** | remaining web page rows, W-02b if needed | (idle, or mobile fix-ups) | ≤ 3 | 0 | ≤ 3 | — |
| **6a** | W-20 (test-expert) | M-16 (test-expert) | 0 | test-expert ×2 | 2 | both AVD locks for Maestro runs |
| **6b** | W-21 (verifier) | M-18 (verifier) | 0 | verifier ×2 | 2 | M-18 holds both AVD locks while it runs device checks |
| **7** | W-23a (security-review), W-23b (senior-code-reviewer) | M-19 (security-review), M-20 (senior-code-reviewer) | 0 | security-review ×2, senior-code-reviewer ×2 | 4 | — |
| **8** | W-22 (README) → W-24 (commit) | M-21 (README, after W-22) → M-22 (with or after W-24) | 1 at a time | git-specialist ×1 | ≤ 2 | README and git: one writer each |

**Limit check:** coder-execution never exceeds 6; no wave exceeds 7 agents in flight; every other type stays at ≤ 2.

### 4.2 Why the mobile lane can start in wave 1

- **M-01, M-02 and M-04 need no simulator.** M-02 and M-04 only read tokens that exist today (04 VM-20). The NEW motion tokens from W-01 are picked up when W-01 lands early in wave 1; until then the SCR-07 fallback constants apply.
- **The runtime contract stub** (M-02) lets M-03 (routes, guard) and M-06 (simulator wiring) run **in parallel** in wave 2: M-03 imports the contract, M-06 replaces its implementation, and neither edits the other's files.
- **Screen rows start after the shell (M-03) and the simulator (W-02 via M-06)**, as the controller required. Each owns one feature folder.

### 4.3 Collision scan: shared files and their single writer

| Shared path | Writers | How the collision is avoided |
|---|---|---|
| `package-lock.json` (root) | W-01, M-01 | `.locks/npm.lock`; W-01 first, M-01 second, both in wave 1 |
| `apps/mobile/package.json` | M-01 only | Rule 2 |
| `apps/mobile/app.json` | M-01 (plugins, wave 1), M-05 (icon and splash keys, wave 2) | Different waves |
| `apps/mobile/android/` (generated) | M-01, M-05 | `.locks/gradle.lock`; different waves anyway |
| `src/app/_layout.tsx` | M-02 (wave 1), M-03 (wave 2 on) | Ownership passes at the wave boundary |
| `src/app/**` (all other route files) | M-03 (and M-04 creates `dev-gallery.tsx` once in wave 1) | Distinct files; M-03 owns the tree from wave 2 |
| `src/runtime/index.ts` | M-02 (stub, wave 1), M-06 (implementation, wave 2) | Different waves; M-03 only reads it |
| `src/providers/app-providers.tsx` | M-02 (wave 1), M-06 (wave 2) | Different waves |
| `src/features/<folder>/*-screen.tsx` stubs | M-03 creates; screen row edits | Created in wave 2, edited from wave 3 |
| `src/features/**` | One screen row per folder (M-07..M-15) | Disjoint folders (§3 table) |
| `THIRD_PARTY_NOTICES.md` | W-05, W-08, optionally M-05 (one line) | M-05 appends only after W-05 and W-08 have finished, or SCR-04 moves the line into W-05 |
| `packages/shared/**` | Web rows only | M-rows never write it (SCR route) |
| `README.md` | W-22, M-21 | M-21 after W-22 |
| git index | W-24, M-22 | Combined commit, or M-22 after W-24 |

### 4.4 Which mobile rows run beside which web rows

| Mobile row | Can run concurrently with | Must not overlap |
|---|---|---|
| M-01 | W-02, W-03, W-04, W-05 | W-01 (lockfile), any other npm install |
| M-02, M-04 | all of wave 1 | — |
| M-03, M-06, M-05, M-17 | W-06, W-07, W-08 | M-05 with any other Gradle build |
| M-07..M-15 | web page rows W-09..W-19 | two mobile rows on the same AVD at the same time (locks) |
| M-16, M-18 | W-20, W-21 | each other's AVD sessions (locks) |
| M-19, M-20 | W-23a, W-23b | — |
| M-21, M-22 | — | W-22 (README), W-24 (git) |

---

## 5. Resource guards (D35), made concrete

### 5.1 Lock files (controller creates once, before wave 1)

```sh
cd /Users/gsp-budi/Documents/DEMS
mkdir -p .locks && touch .locks/{npm,gradle,dems_phone,dems_tablet}.lock
grep -qxF '.locks/' .gitignore || echo '.locks/' >> .gitignore   # controller-owned append (D35 says git-ignored)
```

**`flock` is not installed on this Mac; use `/usr/bin/lockf`** (04 VM-18). D35 names `flock`, so the controller should record this substitution.

| Lock | Command pattern | Held by |
|---|---|---|
| npm | `lockf -k -t 3600 .locks/npm.lock sh -c 'npm_config_cache="$PWD/.cache/npm" npm install …'` | W-01, M-01 |
| Gradle | `lockf -k -t 3600 .locks/gradle.lock sh -c 'cd apps/mobile && npm run prebuild && cd android && ./gradlew assembleDebug'` | M-01, M-05, M-18 (if it rebuilds) |
| AVD | `lockf -k -t 1800 .locks/dems_phone.lock sh -c '<device session>'` | every row tagged [AVD-P]/[AVD-T] |

- `lockf -k -t 0 …` exits **75** immediately if the lock is taken. `-t <secs>` waits.
- Locks are released when the command ends, including on failure, because `lockf` holds the lock only for the lifetime of the child process.

### 5.2 AVD boot with fixed serials (controller, once per session, outside the sandbox, D24)

```sh
emulator -avd dems_phone  -port 5554 -no-metrics -gpu host -no-boot-anim &   # serial emulator-5554
emulator -avd dems_tablet -port 5556 -no-metrics -gpu host -no-boot-anim &   # serial emulator-5556
adb -s emulator-5554 wait-for-device; adb -s emulator-5556 wait-for-device
```

Fixed `-port` values make the serials deterministic, so rows can use `adb -s emulator-5554` (phone) and `adb -s emulator-5556` (tablet) without discovery. Both AVDs together use about 7 GB of guest RAM (4 GB + 3 GB, 01S §6.3).

### 5.3 Lanes and ports

| Lane | Metro port | Assigned to |
|---|---|---|
| mobile-A | 8081 | the first mobile coder slot in each wave |
| mobile-B | 8082 | the second |
| mobile-C | 8083 | the third |
| M-17 / spare | 8084 | optional Maestro row |
| test-expert (M-16) | 8085 | Maestro runs |
| verifier (M-18) | 8086 | verification |

- The web lane uses Vite 5173–5178 (D35). mock-core 4400 is shared and read-only.
- **Device side stays on 8081.** The debug build loads its bundle from device `localhost:8081` (04 H-MB-09), so each lane maps it to its own host port: `adb -s <serial> reverse tcp:8081 tcp:$METRO_PORT`. If M-01 disproves H-MB-09, all lanes share one Metro on 8081 while holding the AVD lock (fallback).
- **Metro runs only while the lane holds an AVD lock** (at most 2 Metro processes at once), which caps memory use.

### 5.4 Device-session protocol (per row; `apps/mobile/scripts/device-session.sh` from M-01)

Sketch (M-01 finalises and tests it; run from `apps/mobile`, outside the sandbox):

```sh
#!/bin/sh
# usage: METRO_PORT=8082 scripts/device-session.sh phone 'adb -s "$SERIAL" shell am start -W -a android.intent.action.VIEW -d "demsdemo:///home" com.dems.demo.tablet'
AVD="$1"; CMDS="$2"
case "$AVD" in phone) SERIAL=emulator-5554 ;; tablet) SERIAL=emulator-5556 ;; *) echo "phone|tablet" >&2; exit 64 ;; esac
LOCK="$(git rev-parse --show-toplevel)/.locks/dems_${AVD}.lock"
export SERIAL METRO_PORT CMDS
exec lockf -k -t 1800 "$LOCK" sh -c '
  adb -s "$SERIAL" reverse tcp:8081 "tcp:$METRO_PORT" && adb -s "$SERIAL" reverse tcp:4400 tcp:4400 || exit 1
  EXPO_NO_TELEMETRY=1 npx expo start --localhost --port "$METRO_PORT" >"${TMPDIR:-/tmp}/metro-$METRO_PORT.log" 2>&1 &
  M=$!
  trap "kill $M 2>/dev/null; adb -s \"$SERIAL\" reverse --remove tcp:8081" EXIT
  i=0; until curl -s "http://127.0.0.1:$METRO_PORT/status" | grep -q "packager-status:running"; do
    i=$((i+1)); [ $i -gt 60 ] && { echo "Metro did not start" >&2; exit 1; }; sleep 1; done
  eval "$CMDS"
'
```

- Waiting on Metro's `/status` endpoint (`packager-status:running`) is a hypothesis about the Expo SDK 57 dev server; the fallback is a fixed 15 s wait.

**Rules:**
1. **Lock ordering:** always phone before tablet; never wait for the phone lock while holding the tablet lock. Only M-18 holds both at once (phone first). This prevents deadlock.
2. A device session lasts at most 30 minutes; code changes happen outside the lock.
3. JS-only rows never run Gradle; they reload the JS through Metro (`adb -s $SERIAL shell am start -W -a android.intent.action.VIEW -d "demsdemo:///…" com.dems.demo.tablet`).
4. Screenshots: `adb -s $SERIAL exec-out screencap -p > docs/…/implementation/assets/mobile/<row>_<avd>_<name>.png`.
5. The session script cleans up Metro and the reverse rule on exit (the `trap`), satisfying D35 rule 6.

### 5.5 Test-runner limits

- Mobile jest: `--maxWorkers=2` in every row (6 coders × default workers would exhaust the 10-core, 24 GB host).
- One Gradle build at a time (lock), and never while M-18 measures performance.

---

## 6. Row steps (condensed)

| Row | Steps |
|---|---|
| M-01 | 1. `npm ls -w @dems/mobile --depth=0` and compare with 01S §1.4 + 04 §8.4. 2. Under `npm.lock`: install only the missing packages (R-1 from `apps/mobile` with `EXPO_NO_TELEMETRY=1 npx expo install …`; R-2 with `npm install --save-exact … -w @dems/mobile`). 3. `jest.config.js` + `jest.setup.ts`; remove the `jest` key from `package.json`. 4. Scripts and `scripts/device-session.sh`. 5. `app.json` plugin. 6. Under `gradle.lock`: `npm run deps:check`, `npm run doctor`, `npm run prebuild`, `npm run build -w @dems/mobile`. 7. Under each AVD lock: install, launch `/stack-check`, test the lane-port reverse on 8082. 8. MA-01, MA-02, AC-25/26/27 |
| M-02 | Layout hooks (T-M01) → providers and `_layout.tsx` wiring → runtime contract stub → motion kit (T-M12, T-M14) → recipes → i18n mobile namespace → device smoke on `/stack-check` and `/dev-gallery` |
| M-03 | Route tree + stubs → guard → headless tabs + chrome → boot router (AC-31 kept) → back-guard hook → deep links → T-M02 (stubs), T-M03 → device: chrome on both AVDs, rotation (MA-13 chrome part), cutout (MA-14), proof mode (MA-15) |
| M-04 | Pure maths + tests → C-4, C-6, C-3 → C-1, C-2 (Skia) → CameraFeed, Emblem, HeroBackdrop placeholders → gallery route → device gallery screenshots, one `gfxinfo` sample |
| M-05 | Take W-04/W-05 outputs (or SCR fallbacks) → PNGs into assets → `app.json` icon and splash → wire media components → under `gradle.lock` prebuild + build → reinstall on both AVDs → screenshots of the launcher icon and splash |
| M-06 | Adapters → `SimRuntimeProvider` + hydration gate → audio shared values → Core link → route sync (T-M06) → keep-awake → auth provider → idle lock → i18n merge → T-M07 → device: MA-08, MA-19 |
| M-07..M-15 | Screen per the 04 §4 table → states (loading, empty, error) → motion per 04 §7.3 → haptics → a11y (labels, 48 dp targets, meter values) → row tests → device: compact and expanded screenshots, rotation where the screen has panes |
| M-16 | Fill every route test with the real screens → missing-keys test → run the full suite (`--maxWorkers=2`) → Maestro flows on both AVDs if approved |
| M-17 | `curl -L -o $TMPDIR/maestro.zip …/cli-2.11.0/maestro.zip` and `checksums_sha256.txt` → `shasum -a 256` must equal the published value → `unzip -q -d ~/.maestro-tmp` → move to `~/.maestro` → `MAESTRO_CLI_NO_ANALYTICS=true ~/.maestro/bin/maestro --version` → `test ! -e ~/.zshrc` |
| M-18 | Fresh `zsh -l`; boot per §5.2; MA-01..MA-30 in order; contact sheet (MA-11); `gfxinfo` on both AVDs; list every FAIL with its owning row |
| M-19, M-20 | Read-only reviews against their focus lists |
| M-21 | Append a "Mobile" section to `README.md`: lanes, locks, AVD boot, deep links, scenarios, biometric enrolment, Maestro, troubleshooting |
| M-22 | `git add apps/mobile docs/…` per D8; commit; no remote |

---

## 7. Effort sizing (relative; hypothesis, for scheduling only)

| Size | Rows |
|---|---|
| **Large** | M-03 (routes, guard, responsive chrome), M-04 (Skia and Reanimated compositions), M-10 (live monitor), M-12 (evidence, export, play) |
| **Medium** | M-02, M-06, M-07, M-08, M-09, M-11, M-13, M-14, M-15, M-16, M-18 |
| **Small** | M-01, M-05, M-17, M-19, M-20, M-21, M-22 |

This is a relative judgement, not a measurement. The mobile lane is roughly comparable to the web lane in total size (02P §4.2): four large rows each.

---

## 8. Dependencies

- **Gates:** the Mobile Approval Gate (D33) and the stack baseline per Option C (D32).
- **Web shared rows:** W-01 (motion tokens, npm order), W-02 (simulator, SCR-01/02), W-03 (i18n, `sessionCreateSchema`, SCR-05), W-04 (emblem, PNGs, topographic SVG; SCR-03/06), W-05 (hero still; SCR-04).
- **Row 18** complete (D30 dependency set installed) and **row 19** smoke passed.
- **Controller setup:** `.locks/` files and the `.gitignore` entry (§5.1); AVD boot with fixed ports (§5.2); lane assignment per wave (§5.3).
- **Sandbox-bypass approvals** for [SB-OFF] steps (D24) and [HOST] for M-17.
- **Internet** for M-01 (npm, Gradle cache already warm from row 18) and M-17 (Maestro zip).

## 9. Blockers and challenges

| Challenge | Resolution |
|---|---|
| `flock` named in D35 is not installed | Use `/usr/bin/lockf` (04 VM-18); the controller records the substitution |
| W-02 simulator not platform-neutral | SCR-01 in W-02's first pass; otherwise W-02b before M-06; last resort the polyfill fallback (04 §13) |
| Two coders want the same AVD | Locks with a 30 min cap and phone-before-tablet ordering (§5.4) |
| Debug APK bound to device port 8081 | Per-lane `adb reverse tcp:8081 tcp:<lane>` (H-MB-09); fallback: one shared Metro |
| Route files needed by screen rows | M-03 creates every route and screen stub first; screen rows never touch `src/app/**` |
| Late native need discovered in a screen row | Not allowed in that row: log it, and the controller schedules one extra [NPM]/[GRADLE] slot (MINOR) |
| Biometric enrolment fails on `pixel_tablet` | Hide the button on that AVD and record it (04 H-MB-04) |

## 10. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Memory and CPU pressure (2 AVDs, ≤ 2 Metro, 3 Vite, 6 jest runs) on 10 cores / 24 GB | Medium | Slow or flaky runs | `--maxWorkers=2`; Metro only under an AVD lock; one Gradle build at a time; the controller may pause the tablet AVD when not needed |
| Shared-contract requests land late | Medium | M-06 and screens wait | SCR fallbacks keep the lane moving (04 §13); W-02b batch |
| Kit gaps on native (glow shadow, soft colours) | Medium | Visual drift | 01S §2.10 fallbacks; MA-11 contact-sheet review |
| Skia performance on the emulator | Medium | Janky monitor | Canvas caps, 12.5 fps grain, pause when unfocused (04 §7.8); physical-device judgement deferred |
| Two independent simulators confuse the two-screen demo | Medium | Demo narrative | Gate decision Q-M4; presenter script in M-21 |
| Maestro install side effects | Low | Host clutter | Pinned zip, checksum, no profile edit, `rm -rf ~/.maestro` rollback |
| Scope creep from screen rows editing shared files | Low | Collisions | Rules 1-4, MA-28, M-20 review |

## 11. Files to create or modify

| Path | Change | Row |
|---|---|---|
| `apps/mobile/package.json`, root `package-lock.json`, `apps/mobile/{app.json,jest.config.js,jest.setup.ts,scripts/device-session.sh}` | modify / create | M-01 |
| `apps/mobile/src/{layout,motion,providers,components/kit,i18n}/**`, `src/runtime/index.ts`, `src/app/_layout.tsx`, `src/global.css` | create / modify | M-02 |
| `apps/mobile/src/app/**`, `src/navigation/**`, `src/components/composed/nav/**`, feature stubs | create / modify | M-03 |
| `apps/mobile/src/components/{composed,media}/**`, `src/app/dev-gallery.tsx` | create | M-04 |
| `apps/mobile/assets/images/{brand,hero}/**`, `app.json` (icon/splash) | create / modify | M-05 |
| `apps/mobile/src/{runtime,auth}/**`, `src/i18n/**`, `src/providers/app-providers.tsx` | create / modify | M-06 |
| `apps/mobile/src/features/<folder>/**` | create | M-07..M-15 |
| `apps/mobile/src/**/__tests__/**`, `src/test/**`, `e2e/maestro/**` | create | M-16 |
| `~/.maestro/**` | create [HOST] | M-17 |
| `README.md` (mobile section) | modify | M-21 |
| `docs/…/implementation/40…57_*.md`, `test/03_*.md`, `verification/07…09_*.md`, `implementation/assets/mobile/**` | create | all |

## 12. Verification approach (the mobile half)

- **Per row:** typecheck, lint, the row's jest tests, and a device smoke on both AVDs with screenshots in the row log.
- **Suite (M-16):** all T-M tests plus Maestro flows (if approved) on both AVDs.
- **Acceptance (M-18):** MA-01..MA-30 on both AVDs, plus the unchanged scaffold mobile ACs (AC-16, AC-25..AC-34, with AC-31 still valid through the boot router).
- **Reviews (M-19, M-20):** in parallel with the web reviews (wave 7).
- Every FAIL goes back to the owning M-row with the failing check, the artifact and the expected correction; M-18 then re-runs that check.

## 13. Rollback

| Scope | Rollback |
|---|---|
| Workspace (any M-row) | `git checkout -- apps/mobile` to the baseline commit, or `git reset --hard <baseline>` on explicit request (destructive to uncommitted work) |
| Native build | `apps/mobile/android/` is git-ignored and regenerable (`npm run prebuild`) |
| Dependencies (M-01) | `git checkout -- apps/mobile/package.json package-lock.json` then `npm ci` under `npm.lock` |
| AVD user data (M-07 biometric enrolment) | `adb -s <serial> shell locksettings clear --old 1234` (04 §6.3, hypothesis) |
| Maestro (M-17) | `rm -rf ~/.maestro ~/.maestro-tmp`; `adb -s <serial> uninstall dev.mobile.maestro dev.mobile.maestro.test` (package names are a hypothesis) |
| Locks | `.locks/` is git-ignored; delete it after the build if wanted |

---

## 14. Mobile Approval Gate (for the controller to present)

**What the user approves:** building the mobile app now, in parallel with the web build (D34), per `04_mobile_specs.md` and this plan.

**Scope.**
- All 10 designer screens on phone portrait, plus tablet multi-pane layouts (rail instead of bottom tabs, list/detail for Evidence, Devices and Settings, a three-column Session Monitor). Orientation unlocked on both AVDs.
- Derived screens where the mockup has none: Pairing, Pre-Recording gate, Ready/Armed, Finalization, Session Summary, Recovery, Sessions hub, More, Operator Audit, Settings sections.
- Every §5.1 module of the design book has a home (04 §1.2).

**Decisions needed (yes/no):**

| # | Question | Recommendation |
|---|---|---|
| Q-M1 | Install up to 6 additive packages (zustand, i18next, react-i18next, expo-local-authentication, AsyncStorage 2.2.0, react-native-keyboard-controller 1.21.9), only if row 18 has not, in one lockfile slot with one native rebuild | **Yes** |
| Q-M2 | Maestro end-to-end tests: pinned zip (~300 MiB) into `~/.maestro`, analytics off, no shell-profile change, driver apps installed on the AVDs | **Yes** (optional; the adb-only fallback exists) |
| Q-M3 | Biometric demo: set PIN 1234 and enrol a virtual fingerprint on both AVDs | **Yes** |
| Q-M4 | Accept that web and mobile each run their own simulator (a session started on the tablet does not appear on the web console) | **Accept for this demo**; a shared session needs a mock-core relay (MAJOR, later) |
| Q-M5 | Button label "End Session" (web convention) instead of the mockup's "Stop Session" | **End Session** |
| Q-M6 | Accept the interpretations of unexplained mockup icons (history → timeline; download → last profile; list → sort) | **Accept** as hypotheses |
| Q-M7 | Route the 7 shared-contract requests (SCR-01..SCR-07) into W-01..W-05 | **Yes** (controller) |
| Q-M8 | Default Core link source = Simulated (the heartbeat mode is a switch in Settings) | **Yes** |

**Already decided, applied without asking again:** D28 defaults (violet Sealed, 20% used, dark text on gold, UTC+07:00, one dataset, UI-only Pause Monitoring, 3 demo operators, **no officer photo**), D17, D30, D31.

**Resources (D35, made concrete).** Waves 1-8 with at most 6 coders and 7 agents in flight (§4.1). Locks via `lockf` because `flock` is absent (VM-18). Metro lanes 8081-8086. AVD serials fixed by boot ports. Only 2 native rebuilds (M-01, M-05).

**Unchanged:** 01S pins, `02_plan.md`, `03_motion_spec.md`, AC-01..AC-75 (AC-31 kept valid).

**Effort:** 22 rows (4 large, 11 medium, 7 small; hypothesis).

**Classification suggestion:** new build scope already authorised in principle by D33/D34, subject to this gate. The controller classifies it (B.9).

## 15. Next steps

1. The controller records the SCR items, the `lockf` substitution for D35, and Q-M1..Q-M8 at the gate.
2. Row 6 merges M-rows into the shared waves (§4.1) and assigns lanes.
3. On approval: create `.locks/`, boot both AVDs with fixed ports, launch wave 1.

---
*Generated: 2026-10-01 01:15 WIB by data-analyst (D33; D34/D35 controller update applied)*
*Last Updated: 2026-10-01 01:15 WIB*
