---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: data-analyst
blueprint_row: 5
type: implementation-plan
narrative_tier: 1
based_on:
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/01_specs.md (rev 3)
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/03_motion_spec.md
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/research/03_analysis.md (Host Impact Register)
decisions_applied: D1-D28
status: complete
last_updated: 2026-10-01 00:50 WIB
---

# Implementation Plan (Blueprint Row 5)

## 0. How to read this plan

### 5W1H

| Dimension | Content |
|---|---|
| **What** | The ordered steps, with exact pins, for every blueprint row 1-25: status, commands, host impact with a rollback for each host-modifying step, expected downloads, admin-prompt flags, and verification. Plus **proposed new rows W-01..W-24** for the 10-page web build, for row 6 (task-architect) to refine |
| **Who** | Executors: `coder-execution` (rows 12, 14-19, 21, W-rows), `test-expert` (row 20, W-20), `verifier` (rows 13, 22, W-21), `security-review` (row 23), `senior-code-reviewer` (row 24), `git-specialist` (row 25), `image-specialist` (W-04). Controller: gate D22 and the B.9 classification after row 6 |
| **When** | Written 2026-10-01 00:47-01:05 WIB. Rows 7-10 are done. Rows 12-16 are done and 17-18 are in progress in parallel (D27). The W-rows start after the second approval gate (D22) |
| **Where** | Workspace `/Users/gsp-budi/Documents/DEMS`; host paths per 03_analysis HI-1..HI-13, updated with actuals from the row 8-10 logs |
| **Why** | To give each row one unambiguous set of steps, and to make every host change reversible (NFR5) |
| **How** | Derived from 01_specs rev 3 (§0-§14), 03_motion_spec, D1-D28, and the executor logs in `initialization/` and `implementation/` (read-only) |

### Tags used in the steps

| Tag | Meaning |
|---|---|
| **[HOST]** | Writes outside the workspace. A rollback is given alongside |
| **[SB-OFF]** | Must run with sandbox bypass, approved per command. Reasons: host writes (D14), the emulator or process list (D24), or `adb`/`pgrep`/`lsof` needing the process list (05_avds) |
| **[NET]** | Downloads. The size given is sourced or labelled as a hypothesis |
| **[ADMIN]** | Could prompt for a macOS password. **No step in this plan carries this tag**: no casks, no `.pkg`, no `sudo` (03 F11) |
| `NPM` | Shorthand for `npm_config_cache="$PWD/.cache/npm" npm`, run from the workspace root (01_specs §1.4 R-4) |
| `EXPO` | Shorthand for `EXPO_NO_TELEMETRY=1 npx expo` |

---

## 1. Current state (2026-10-01 00:47 WIB, read-only check)

| Row | Task | Status | Evidence |
|---|---|---|---|
| 1 | Design-book digest | **done** | `research/01_explore.md` |
| 2 | Technology collection | **done** | `research/02_collection.md` |
| 3 | Stack decision record | **done** (accepted as D10-D14) | `research/03_analysis.md` |
| 4 | Stack specification | **done, rev 3** (this delegation) | `masterplan/01_specs.md` |
| 5 | Implementation plan | **this file** | — |
| 6 | Blueprint refinement | pending (after rows 4 and 5) | Inputs in §4 |
| 7 | Git init | **done** (D7) | `initialization/02_git_init.md` |
| 8 | JDK 17 | **done** | `initialization/03_jdk_install.md`: 17.0.20.1, 23 formulae, 502.6 MiB |
| 9 | Android SDK | **done** | `initialization/04_android_sdk_install.md`: 7 packages, 8.4 GB |
| 10 | AVDs | **done** | `initialization/05_avds.md`: `dems_tablet` (25 s boot), `dems_phone` (22 s) |
| 11 | Watchman | **dropped** (D12) | none |
| 12 | JS runtime check | **done** (D27) | `initialization/07_js_runtime.md` |
| 13 | Environment check | **done** | `initialization/01_env_check.md` |
| 14 | Workspace root | **done** (D23 scripts applied) | `implementation/01_workspace_root.md` |
| 15 | `packages/shared` | **done**, with the **rev-2 tokens** (follow-up §6.1) | `implementation/02_shared_package.md` |
| 16 | mock-core | **done** | `implementation/03_mock_core_service.md` |
| 17 | core-web proof | **in progress** (D27) | `apps/core-web/` exists |
| 18 | Mobile proof (both AVDs) | **not started / in progress** (D27) | `apps/mobile/` absent at 00:47 |
| 19-25 | Smoke, tests, run guide, verify, security, review, commit | pending | none |

## 2. Target state

1. **Stack baseline** (rows 7-25): the toolchain is installed, the four packages are scaffolded and proven (SC1-SC7), and a baseline commit exists.
2. **Web build** (W-rows, after gate D22): 10 pages, the Start New Session flow and the in-browser simulator per 01_specs §14, with motion per 03_motion_spec, verified against AC-48..AC-75 and MS-01..MS-10.
3. **Mobile screens:** the next task (D20); out of scope here.

---

## 3. Row-by-row plan (one section per blueprint row)

### Row 1 · Row 2 · Row 3 · Row 4 (research and spec)

- **Status:** done.
- **Outputs:** `research/01_explore.md`, `research/02_collection.md`, `research/03_analysis.md`, `masterplan/01_specs.md` (rev 3).
- No host impact; no rollback needed.

### Row 5: Implementation plan (this file)

- **Status:** done with this artifact.

### Row 6: Blueprint refinement (task-architect)

Inputs:
- this plan's §4 (W-rows) and §5 (sequencing);
- 01_specs §13, §14 and §0 SPEC-C17..C27;
- 03_motion_spec.

**Classification hint (B.9):** D22 already classes D15-D20 plus D25-D26 as **MAJOR**. The W-rows are the MAJOR delta. Everything in §6 of this plan is MINOR.

### Row 7: Git init

- **Status:** done (`initialization/02_git_init.md`, D7).
- **Rollback (workspace):** `rm -rf /Users/gsp-budi/Documents/DEMS/.git` restores the no-repo state. **Destructive**: only on explicit user request (Red Lines).

### Row 8: JDK 17 [HOST]

- **Status:** done.
- **As run:** `HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ENV_HINTS=1 brew install openjdk@17 </dev/null` [SB-OFF][NET 186 MB bottle]
  - 23 formulae were added (502.6 MiB).
  - `~/.zprofile` was backed up to `~/.zprofile.bak.dems-2026-09-30-235451`, then block A was appended.
- **Verified:** AC-01 and AC-02 PASS (log).
- **Rollback** (verbatim from `03_jdk_install.md` "Rollback"):

```sh
cp -p ~/.zprofile.bak.dems-2026-09-30-235451 ~/.zprofile          # or: sed -i '' '/^# >>> dems-demo:/,/^# <<< dems-demo:/d' ~/.zprofile
HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall openjdk@17
HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall cairo fontconfig freetype giflib glib graphite2 harfbuzz icu4c@78 jpeg-turbo libpng libtiff libx11 libxau libxcb libxdmcp libxext libxrender little-cms2 lzo pixman webp xorgproto
brew cleanup openjdk@17
```

### Row 9: Android SDK [HOST]

- **Status:** done.
- **As run:**
  - cmdline-tools 23.0 zip (SHA-1 `ad03dc49…e830`, 155,384,151 bytes) unpacked to `~/Library/Android/sdk/cmdline-tools/latest`;
  - block B appended to `~/.zprofile`;
  - `android --no-metrics --sdk=… sdk install` of the 7 IDs (341 s) [SB-OFF][NET ≈3.3 GiB].
- **Findings (D23):**
  - `sdkmanager` is a shim over the Android CLI and prints IDs with `/`.
  - `--licenses` is a no-op.
  - Every later call adds `--no-metrics`.
- **Rollback** (verbatim from `04_android_sdk_install.md`):

```sh
sed -i '' '/^# >>> dems-demo: android sdk/,/^# <<< dems-demo: android sdk/d' ~/.zprofile   # block B only
~/Library/Android/sdk/platform-tools/adb kill-server 2>/dev/null
rm -rf ~/Library/Android        # absent at baseline (HI-4)
rm -rf ~/.android               # absent at baseline; also removes the AVDs and the Android CLI runtime (HI-5)
```

### Row 10: AVDs [HOST]

- **Status:** done. `dems_tablet` (pixel_tablet) and `dems_phone` (pixel_10), configured per 01_specs §6.3 rev 3. Quickboot snapshots saved: tablet 3.5 GB, phone 2.8 GB.
- **Rollback:**

```sh
~/Library/Android/sdk/platform-tools/adb -e emu kill 2>/dev/null; ~/Library/Android/sdk/platform-tools/adb kill-server 2>/dev/null
zsh -l -c 'avdmanager delete avd -n dems_tablet'; zsh -l -c 'avdmanager delete avd -n dems_phone'
```

### Row 11: Watchman

- **Status:** **dropped** (D12). Not required for Expo SDK 57 (03 SD-51).
- No steps and no rollback.

### Row 12: JS runtime check

- **Status:** done (`07_js_runtime.md`): system Node 26.8.2 kept, npm 11.19.1, `.node-version` written.
- No host change.

### Row 13: Environment readiness check

- **Status:** done (`01_env_check.md`).
- **Re-run trigger:** row 22 repeats the host checks from a fresh `zsh -l` (AC-01..AC-11).

### Row 14: Workspace root

- **Status:** done (`01_workspace_root.md`).
- **Canonical steps** (for reproducibility and the run guide): write `package.json` (01_specs §1.2 rev 3, including `emulator` and `emulator:phone`), `.npmrc`, `.node-version`, `tsconfig.base.json`; then `NPM install`.
- **Rollback (workspace):** delete the created root files (listed in the row log). No host impact.

### Row 15: `packages/shared`

- **Status:** done, built with **rev-2 tokens**.
- **Canonical steps:**
  1. Create `packages/shared` per 01_specs §2.1-§2.9.
  2. `NPM install --save-exact -w @dems/shared zod@4.6.5`
  3. `NPM install --save-exact -D -w @dems/shared typescript@6.0.3 tsx@4.23.15 vitest@5.0.3 oxlint@1.86.0 @types/node@26.6.3 react@19.2.3 @types/react@19.2.18`
  4. `NPM run build -w @dems/shared` (theme generation, then `tsc`), then `NPM test -w @dems/shared`.
- **Follow-up (§6.1):** apply the rev-3 token values and badge tones, regenerate the theme, and update the drift and contrast tests. Owner: the same coder (preferred), or W-01.

### Row 16: mock-core

- **Status:** done.
- **Canonical steps:**
  1. `NPM install --save-exact -w @dems/mock-core fastify@5.12.5 @fastify/websocket@11.3.1 @fastify/cors@11.3.0 tsx@4.23.15 @dems/shared@*`
  2. Dev dependencies per §1.4.
  3. `npm run dev:mock`
  4. `curl -s -i http://127.0.0.1:4400/api/v1/health` (AC-36), then `npm run probe:ws` (AC-38).
- No host impact beyond a loopback listener. **Stop:** `kill -TERM <pid>` (AC-42).

### Row 17: core-web proof (in progress, D27)

**Canonical steps:**
1. `NPM exec --yes create-vite@9.2.1 -- apps/core-web --template react-ts` [NET]. Adjust `package.json`:
   - name `@dems/core-web`;
   - React **19.2.3 exact** (the template's `^19.2.8` excludes it, 01_specs V25);
   - scripts per §1.5.
2. `NPM install --save-exact -w @dems/core-web` with the §1.4 dependency set: react, react-dom, react-is, @heroui/react, @heroui/styles, motion, @tanstack/*, recharts, lucide-react, the @fontsource-variable Orbitron/Inter/JetBrains Mono packages, the forms libraries, clsx, tailwind-merge, react-use-measure.
   - Dev dependencies: vite 8.3.1, @vitejs/plugin-react 6.1.1, @tanstack/router-plugin 1.168.41, tailwindcss and @tailwindcss/vite 4.3.3, typescript 6.0.3, the @types, oxlint 1.86.0, vitest 5.0.3, jsdom 30.1.1, and the Testing Library packages.
   - **[NET]** hypothesis: 100-200 MB into `.cache/npm`.
3. Copy in BorderBeam and SlidingNumber (01_specs §4.1) and record them in `THIRD_PARTY_NOTICES.md`.
4. Placeholder `/` per §4.4 with the rev-3 fonts and tokens.
5. `NPM run build -w @dems/core-web` (AC-19), then `npm run dev:web` and `curl http://127.0.0.1:5173/` (AC-21).

**Verification:** AC-19..AC-24.

### Row 18: mobile proof on both AVDs (D17, D20, D27)

**Canonical steps:**
1. `NPM exec --yes create-expo-app@5.0.0 -- apps/mobile --template expo-template-default@57.0.28 --no-install` [NET]. Check the exact flag syntax with `--help` first (01_specs SD-06 note).
2. Remove the template example files (01_specs §1.5).
3. `app.json` per §5.1 rev 3: `orientation: "default"`, **no local plugin** (D17).
4. From `apps/mobile`, SDK-managed packages (rule R-1): `EXPO install react-native-reanimated react-native-worklets react-native-gesture-handler react-native-screens react-native-safe-area-context react-native-svg @shopify/react-native-skia @shopify/flash-list expo-video expo-blur expo-linear-gradient expo-haptics expo-keep-awake expo-font expo-splash-screen expo-status-bar expo-system-ui expo-constants expo-linking jest-expo` [NET]
5. Exact pins (rule R-2): `NPM install --save-exact -w @dems/mobile heroui-native@1.0.10 uniwind@1.12.0 tailwindcss@4.3.3 tailwind-variants@3.3.1 tailwind-merge@3.7.0 @gorhom/bottom-sheet@5.2.14 victory-native@42.0.1 lucide-react-native@1.49.0 @expo-google-fonts/orbitron@0.4.2 @expo-google-fonts/inter@0.4.2 @expo-google-fonts/jetbrains-mono@0.4.1 @tanstack/react-query@5.104.0 react-hook-form@7.89.0 zod@4.6.5 @hookform/resolvers@5.9.1 @dems/shared@*`
   - Dev dependencies: `jest@29.7.0 @testing-library/react-native@13.3.3 react-test-renderer@19.2.3 eslint@9.39.5 eslint-config-expo@57.0.2 expo-doctor@1.20.4 typescript@6.0.3 @types/react@19.2.18`
   - **[NET]** hypothesis: 300-400 MB.
6. `metro.config.js`, `src/global.css`, `_layout.tsx` and the proof screen per §5.3-§5.5 (responsive; 900 dp breakpoint).
7. `npm run prebuild -w @dems/mobile`, then AC-25 and AC-26.
8. **[HOST][SB-OFF][NET]** `npm run build -w @dems/mobile` (Gradle 9.3.1 into `~/.gradle`; hypothesis 1.2-2.2 GB download, 2-3 GB on disk; HI-6). Expo CLI may create `~/.expo` (HI-7).
9. **[SB-OFF]** For each AVD, one at a time: `npm run emulator` (then later `npm run emulator:phone`), `npm run mobile:reverse`, `npm run android`, then the AC-29/AC-30 screenshots plus `adb emu rotate` on the tablet (AC-30 rev 3).

**Rollback:**
```sh
(cd apps/mobile/android && ./gradlew --stop) 2>/dev/null
rm -rf ~/.gradle        # absent at baseline (HI-6)
rm -rf ~/.expo          # absent at baseline (HI-7), if created
```
Workspace: `apps/mobile/android/` is git-ignored and regenerable.

**Verification:** AC-16, AC-25..AC-34.

### Row 19: Integration smoke

1. `npm run dev:mock &` → `npm run dev:web &`
2. [SB-OFF] `npm run emulator`, then `npm run mobile:reverse`, then `npm run dev:mobile &`, then launch the app.
3. Open `http://127.0.0.1:5173/` in the browser (agent-browser).
4. Checks: AC-40, AC-41 (the mock-core log shows `"clients":2`, and both clients' `seq` advances by at least 4 in 5 s).
5. Stop every process by PID (R10), then `adb reverse --remove-all`.

**Host impact:** adb reverse rules only (process state), removed at the end.

### Row 20: Scaffold tests (test-expert)

- The 7 smoke tests of 01_specs §8: S-1, S-2, M-1..M-3, W-1, N-1.
- `npm test` passes (AC-43).
- If HeroUI Native cannot render under jest, use the mock fallback (§8) and record it.

### Row 21: Run guide

- Write `/Users/gsp-budi/Documents/DEMS/README.md` with 8 sections (AC-44).
- Include D24 ("emulator commands must run outside the agent sandbox"), `--no-metrics`, both AVD scripts, and the rollback pointers above.
- **Graft line:** `graft build .` (never `graft init`).

### Row 22: End-to-end verification (verifier)

- From a fresh `zsh -l`: AC-01..AC-47 as revised in rev 3.
- Record the jank baseline (`dumpsys gfxinfo`) on **both** AVDs.

### Row 23: Security review

**Scope from blueprint row 23, plus rev 3 additions:**
- `~/.zprofile` diff limited to blocks A and B;
- loopback-only listeners (the emulator listeners are already confirmed loopback, 05_avds);
- no EAS or `expo-updates`;
- Metro binding (AC-45);
- no credentials in logs;
- dependency audit counts.

### Row 24: Code review

- React single-copy proof (AC-13);
- template leftovers;
- token reuse;
- `erasableSyntaxOnly` holding.

### Row 25: Baseline commit (git-specialist)

- The local commit of the **stack baseline** (rows 7-24 green), with no remote and no push.
- Whether `docs/` goes in follows D8.
- **Rollback:** `git reset --soft HEAD~1` (the local commit only; nothing has been pushed).

---

## 4. Proposed new rows for the web build (for row 6; they start after gate D22)

**Common rules for every W-row:**
- Run `NPM` with the workspace cache.
- **No host changes:** every W-row writes only inside the workspace. Assets are downloaded into `apps/core-web/src/assets/`.
- No `shadcn init`.
- Every row ends with typecheck, lint and test passing for the workspaces it touched.

| Row | Task | Agent | Depends on | Output log | Acceptance |
|---|---|---|---|---|---|
| **W-01** | **Dependencies and tokens rev 3 (one row, so later rows never touch `package.json` or `package-lock.json`).** (a) Install the §14.1 additions: shared `zustand@5.0.15 @noble/hashes@2.4.0`, dev `@scalar/openapi-parser@0.29.9`; core-web `zustand@5.0.15 @scalar/api-reference-react@0.9.76 i18next@26.4.2 react-i18next@17.0.15`. (b) If not already done as the §6.1 follow-up: tokens rev 3, badge tones, the **NEW motion tokens** (03_motion_spec §2.3), the third generator output `theme/scalar.css`, and the contrast test | coder-execution | Rows 15, 17 | `implementation/08_web_deps_tokens.md` | AC-18, AC-69; `npm ls` shows the pins |
| **W-02** | **Shared simulator** `packages/shared/src/sim/*` (01_specs §14.7): rng, clock, dataset, session-machine, audio, health, events (hash chain), evidence, auth, faults, api, scenarios, engine, store (zustand vanilla, `subscribeWithSelector`, `persist`), and React bindings. Tests: determinism, machine, audio, storage math, hash chain, auth | coder-execution | W-01 | `implementation/09_sim_core.md` | AC-50..AC-55 |
| **W-03** | **OpenAPI 3.1 document and generator, i18n resources, session schema** (`api/openapi.ts`, `scripts/gen-openapi.ts`, `openapi/openapi.json`, `i18n/en.ts`, `api/session-schema.ts`) | coder-execution | W-01 | `implementation/10_openapi_i18n.md` | AC-56, AC-66 (resources) |
| **W-04** | **Brand SVGs:** `emblem.svg` (7 path IDs), `favicon.svg`, `scripts/gen-topo.ts` plus `topo.svg` | image-specialist | W-01 | `implementation/11_brand_svgs.md` | AC-68 |
| **W-05** | **Hero still:** find one empty interview or meeting room photo on Pexels or Unsplash (generic query, no people, no insignia, no text, ≥ 2560 px). Download into `apps/core-web/src/assets/hero/`; resize and compress with macOS `sips`; record photographer, URL, licence and date in `THIRD_PARTY_NOTICES.md`. If none qualifies, build the procedural SVG fallback (01_specs §14.10, H-S19) | coder-execution | W-01 | `implementation/12_hero_asset.md` | AC-67 |
| **W-06** | **App shell and routing skeleton:** all route files of §14.2 with page **stubs** (so `routeTree.gen.ts` is final); `_app` guard; AppShell (top bar, sidebar with DEVELOPER group, rail, Drawer, page header template, focus ring); providers (Sim, i18n, MotionConfig, Heartbeat, Query); move the proof route to `/stack-check` | coder-execution | W-02, W-03, W-04 | `implementation/13_app_shell.md` | AC-48 (stubs), AC-49, AC-59 |
| **W-07** | **Motion system foundation** (03_motion_spec §2-§4, §8, §9): `src/motion/{variants,use-motion-policy,glow-layer,debug-overlay}.ts(x)`; route transitions M-APP-04; shell motions M-SH-01..08; reduced-motion switch | coder-execution | W-06 | `implementation/14_motion_system.md` | AC-70, AC-72, MS-01..MS-05 |
| **W-08** | **Custom compositions and media:** GlowRing, DbfsMeter, SessionTimeline, Stepper (§14.6) and CameraFeed. Copy in the MU/MP items of §14.5 (AnimatedNumber, TextEffect, TextShimmer, TextScramble, TransitionPanel, AnimatedBackground, Spotlight, AnimatedListItem with edited variants, Ripple, ShineBorder, OrbitingCircles, AnimatedBeam, Particles) and record them in `THIRD_PARTY_NOTICES.md` | coder-execution | W-07, W-05 | `implementation/15_compositions.md` | MS-08, component unit tests |
| **W-09** | **Login and hand-off** (§14.8; M-APP-01..03; M-C-22) | coder-execution | W-08 | `implementation/16_page_login.md` | AC-49, AC-50 (UI path), MS-07 |
| **W-10** | **Dashboard** (§14.5.1; M-PG-DASH) | coder-execution | W-08 | `implementation/17_page_dashboard.md` | AC-60, AC-74, AC-75 |
| **W-11** | **Session Monitor plus finalization** (§14.5.2; M-PG-SM) | coder-execution | W-08 | `implementation/18_page_session_monitor.md` | AC-61, AC-63 |
| **W-12** | **Start New Session flow** (§14.5.11; M-PG-NEW) | coder-execution | W-11 | `implementation/19_flow_start_session.md` | AC-62 |
| **W-13** | **Evidence list, detail and export wizard** (§14.5.3; M-PG-EVID) | coder-execution | W-08 | `implementation/20_page_evidence.md` | AC-63 (sealed row), AC-64 |
| **W-14** | **Devices & Inputs** (§14.5.4) | coder-execution | W-08 | `implementation/21_page_devices.md` | Page checks in W-21 |
| **W-15** | **Storage** (§14.5.5) | coder-execution | W-08 | `implementation/22_page_storage.md` | AC-75 |
| **W-16** | **Network & Time** (§14.5.6) | coder-execution | W-08 | `implementation/23_page_network_time.md` | Page checks in W-21 |
| **W-17** | **Security & Audit** (§14.5.7) | coder-execution | W-08 | `implementation/24_page_security_audit.md` | AC-55 (UI path) |
| **W-18** | **System & Maintenance plus Demo Control Panel** (§14.5.8) | coder-execution | W-08 | `implementation/25_page_system.md` | AC-65 |
| **W-19** | **API Reference** (§14.9): Scalar config, `simAwareFetch`, theme, Realtime panel, lazy route | coder-execution | W-03, W-08 | `implementation/26_page_api_reference.md` | AC-56..AC-58, AC-73 |
| **W-20** | **Web test suite** (01_specs §14.13) | test-expert | W-09..W-19 | `test/02_web_test_report.md` | AC-48..AC-58, AC-64, AC-66, AC-69, AC-70 automated |
| **W-21** | **Web verification** (browser, 1920×1080 and 1440×900 plus the breakpoints; motion and performance) | verifier | W-20 | `verification/04_web_verification.md` | AC-59..AC-75, MS-01..MS-10 |
| **W-22** | **Run guide update** (web pages, demo scenarios, Demo Control Panel, presentation mode, `?debug=1`) | coder-execution | W-21 | `README.md` (updated) | AC-44 (extended) |
| **W-23** | **Security and code review of the web build.** Focus: no external requests (AC-57), Scalar flags, credential handling in auth (§14.8), `THIRD_PARTY_NOTICES` completeness, bundle split | security-review, then senior-code-reviewer (parallel, read-only) | W-22 | `verification/05_web_security.md`, `verification/06_web_code_review.md` | PASS or CAUTION acknowledged; zero open blockers |
| **W-24** | **Web build commit** (local, no remote) | git-specialist | W-23 | `implementation/27_git_web_commit.md` | `git log` shows the commit; `git status` clean |

### 4.1 Parallelism and collision scan (CLAUDE.md §6: ≤ 2 of one agent type, ≤ 4 in flight)

| Wave | Rows | Why it is safe |
|---|---|---|
| WA | W-01 alone | It is the only row that edits `package.json` and `package-lock.json` in the W-phase |
| WB | W-02 ∥ W-03 (coder-execution ×2) ∥ W-04 (image-specialist). W-05 waits for wave WC, because a third coder would exceed the limit of 2 | Separate directories: `shared/src/sim`, `shared/src/{api,i18n}` + scripts, `core-web/src/assets/brand` + `shared/scripts/gen-topo.ts`. W-02 and W-03 both add tests in `shared/test/` with distinct file names |
| WC | W-05 ∥ W-06 | W-05 writes only `assets/hero/` and `THIRD_PARTY_NOTICES.md`. W-06 writes routes, shell and providers. **Collision risk:** `THIRD_PARTY_NOTICES.md` is touched by W-05 only in this wave (W-08 writes it later) |
| WD | W-07, then W-08 | Sequential. Both touch `src/components` and `src/motion` |
| WE | Pages in pairs: (W-09 ∥ W-10), (W-11 ∥ W-13), (W-12 ∥ W-14), (W-15 ∥ W-16), (W-17 ∥ W-18), W-19 | Each page writes only `src/features/<page>/` and its own route file (a stub from W-06, so `routeTree.gen.ts` does not change). **Rule:** pages do not edit `packages/shared/src/sim`. Missing selectors or actions are logged and batched into one follow-up, W-02b (sequential, coder-execution), before W-20 |
| WF | W-20 → W-21 → W-22 → (W-23a ∥ W-23b) → W-24 | Verification order |

### 4.2 Effort sizing (hypothesis, for row 6 planning only)

- **Large:** W-02, W-08, W-11, W-13, W-19.
- **Medium:** W-06, W-07, W-09, W-10, W-18, W-20, W-21.
- **Small:** the rest.

This is a relative judgement, not a measurement.

---

## 5. Sequencing across the two phases (recommendation for row 6)

**Option A (recommended): baseline first.** Finish rows 17-25 now (the stack baseline commit, SC1-SC7 proven), then gate D22, then the W-rows on top.
- **Pros:** SC1-SC7 are closed independently; the W-rows start from a verified, committed tree; rollback of the web build is `git reset` to the baseline.
- **Cons:** rows 20-24 run twice (baseline, then web via W-20..W-23).

**Option B:** pause rows 20-25 until the W-rows are done, and verify once.
- **Pros:** one verification pass.
- **Cons:** a failure in the baseline surfaces late, and the tree stays uncommitted for longer.

---

## 6. Follow-ups for the parallel coder (from spec rev 3)

**PIN CHANGE: none.** No version pin, package name, port or file path in 01_specs §0-§8 changed in rev 3. The only path change (the D17 plugin file) was never created, because row 18 had not started.

### 6.1 TOKEN CHANGE: needs coder follow-up (row 15 built the rev-2 values)

`packages/shared/src/tokens/tokens.ts` as built has `charcoal` as `surface`, `surfaceSecondary '#2A3138'`, `surfaceTertiary '#353C43'` and `border '#FFC86B2E'`. Rev 3 (01_specs §2.7, SPEC-C20/C21) requires:

| Token | Rev 2 (built) | Rev 3 |
|---|---|---|
| `surface` | `#1F262E` | `#191008` |
| `surface-secondary` / `field-background` | `#2A3138` / `#151A1F` | `#150E07` / `#150E07` |
| `surface-tertiary`, `segment` | `#353C43`, `#2A3138` | `#251C14`, `#251C14` |
| `default` | `#353C43` | `#2B231C` |
| `overlay` | `#1F262E` | `#1F262E` (unchanged; Charcoal kept for L5) |
| `border` | `#FFC86B2E` | `#FF9F3D59` |
| `--surface-shadow` / `shadow-glow-1` | `0 0 0 1px #FFC86B2E, 0 0 12px 0 #FFC86B1A` | `0 0 0 1px #FF9F3D59, 0 0 14px 0 #FF9F3D1F` |
| `shadow-glow-2` | `0 0 0 1px #FFC86B52, 0 0 20px 0 #FFC86B2E` | `0 0 0 1px #FF9F3D80, 0 0 20px 0 #FF9F3D38` |
| `--overlay-shadow` / `shadow-glow-3` | `0 0 0 1.5px #FFC86B8C, 0 0 32px 2px #FFC86B47` | `0 0 0 1.5px #FFC86BA6, 0 0 28px 2px #FF9F3D59` |
| NEW | none | `foreground-2 #D8CEC6`, `--color-charcoal #1F262E` |
| Badge tones (`status-tones.ts`) | Under Review default; IN REVIEW accent; EXPORTED success | Under Review **warning**; IN REVIEW **warning** (outline); EXPORTED **info** (outline) |

**Steps:**
1. Edit `tokens.ts` and `status-tones.ts`.
2. `npm run build -w @dems/shared` (regenerates `theme/*.css`).
3. `npm test -w @dems/shared`. Update the S-1 expectations only for the changed values; the contrast figures come from §2.7 rev 3 (V46).
4. If row 17 already imported the theme, rebuild core-web.

**Classification:** MINOR (token values). **If not done by the coder now, W-01 does it.**

### 6.2 D17 reminder for row 18 (the controller said D17 already overrides)

- `app.json` `orientation: "default"`.
- No `plugins/with-large-screen-orientation-optout.js`.
- Responsive proof screen (900 dp).
- AC-25/AC-29/AC-30 rev 3 (both AVDs; rotation proof).

### 6.3 Row 17 note

- Fonts are Orbitron, Inter and JetBrains Mono (rev 2).
- The web placeholder uses the rev-3 surfaces automatically once §6.1 regenerates the theme.
- No code change is needed in row 17 for rev 3 beyond the theme regeneration.

---

## 7. Dependencies

- **Gate D22** (second approval) before any W-row.
- **Internet** for npm (row 17, row 18, W-01), Gradle (row 18) and the hero image (W-05). The Android SDK is already installed.
- **Sandbox bypass approvals** for [SB-OFF] steps: Gradle, emulator and adb in rows 18, 19 and 22 (D14, D24).
- **A browser** for rows 17, 19, 22 and W-21 (agent-browser first; the Browser pane as fallback, CLAUDE.md §10).

## 8. Blockers / challenges

| Challenge | Resolution |
|---|---|
| The emulator aborts inside the sandbox ("Incompatible processor … neon") | Always [SB-OFF] (D24) |
| `sdkmanager` shim semantics (IDs use `/`; `--licenses` is a no-op) | Use `--no-metrics`; the AC-04 rev 3 wording |
| The cross-route shared element (Login → shell) may not be supported by the router plus AnimatePresence | The 03_motion_spec H-M1 fallback (two-phase flight) |
| Parallel page rows could regenerate `routeTree.gen.ts` | W-06 stubs every route first (§4.1) |
| Parallel rows editing `package.json` or the lockfile | All W-phase dependencies are installed in W-01 only |
| A qualifying free hero photo may not exist | Procedural fallback (H-S19) |

## 9. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The token follow-up (§6.1) is missed, so the theme stays cool charcoal | Medium | Visual mismatch with the mockups | W-01 re-applies it; AC-19 checks the gold token; W-21 compares visually against the D1 fill `#191008` |
| Scalar privacy flags regress (telemetry, CDN fonts, agent) | Low | External requests | Config unit test plus the runtime resource-host check (AC-57); the PostHog plugin is never imported |
| Performance under all animations (4 ambient loops plus canvases plus 20 Hz meters) | Medium | Jank in the demo | 03_motion_spec §9 caps; AC-71; MS-04/MS-08; the H-S18 fallback (12.5 fps feeds) |
| Simulator API churn during the page rows | Medium | Merge friction | The W-02b batching rule (§4.1) |
| Row 18 Gradle first build time | High (time) | Slow row | Record the duration; retry on network failure (E10) |
| A licence ambiguity on the chosen photo | Low | Compliance | Pexels/Unsplash only, with the record in `THIRD_PARTY_NOTICES.md`; procedural fallback |

## 10. Files to create or modify (summary)

| Path | Change | Row |
|---|---|---|
| `packages/shared/src/tokens/{tokens,status-tones}.ts`, `packages/shared/theme/*.css` | modify (rev 3 values), add `scalar.css` | §6.1 / W-01 |
| `packages/shared/src/sim/**`, `packages/shared/test/*` | create | W-02 |
| `packages/shared/src/{api/openapi.ts,api/session-schema.ts,i18n/en.ts}`, `scripts/gen-openapi.ts`, `openapi/openapi.json` | create | W-03 |
| `apps/core-web/src/assets/brand/{emblem,topo}.svg`, `apps/core-web/public/favicon.svg`, `packages/shared/scripts/gen-topo.ts` | create | W-04 |
| `apps/core-web/src/assets/hero/*`, `THIRD_PARTY_NOTICES.md` | create / append | W-05, W-08 |
| `apps/core-web/src/routes/**`, `src/components/shell/**`, `src/i18n.ts` | create / modify | W-06 |
| `apps/core-web/src/motion/**` | create | W-07 |
| `apps/core-web/src/components/{composed,media,ui}/**` | create | W-08 |
| `apps/core-web/src/features/<page>/**` | create | W-09..W-19 |
| `apps/core-web/src/test/**` | create | W-20 |
| `README.md` | modify | W-22 |

## 11. Verification approach

- **Unit and integration:** Vitest in shared, mock-core and core-web; jest-expo for mobile (01_specs §8, §14.13).
- **End to end:** the verifier follows the README from a fresh `zsh -l` (row 22), then the browser checks for the web build (W-21).
- **Motion and performance:** 03_motion_spec §11 (MS-01..MS-10), AC-70..AC-72.
- **Security:** row 23 and W-23a (external-request check, AC-57).

## 12. Rollback considerations

- **Host:** the rollbacks for rows 8, 9, 10 and 18 are above (§3). Each is taken verbatim from its executor log, or from 03_analysis HI-6/HI-7 for row 18.
  - The order for a full host rollback is reverse install order: row 18 (`~/.gradle`, `~/.expo`), then row 10 (AVDs), then row 9 (SDK, `~/.android`, block B), then row 8 (JDK formulae, block A, or restore the `~/.zprofile` backup).
  - **None of these are rehearsed:** uninstalling authorised tooling is destructive and was not requested (blueprint "Rollback & recovery").
- **Workspace:** `git reset --hard <baseline commit>` after row 25 undoes any W-row. It is destructive to uncommitted work, so it is only run on explicit request. Generated folders (`apps/mobile/android`, `dist/`, `.cache/`) are git-ignored and regenerable.

## 13. Next steps

1. The controller records this plan and the §6 follow-ups (the token change is MINOR), and lets the coder apply §6.1 now or defer it to W-01.
2. Row 6 (task-architect) refines rows 17-25 and adds W-01..W-24 per §4 and §5 (Option A recommended).
3. Second approval gate (D22) for the W-rows.

---
*Generated: 2026-10-01 00:50 WIB by data-analyst (Step C of the rev-3 delegation)*
