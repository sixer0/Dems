---
task_id: 2026-09-30_dems_demo_stack_setup
step: 52
plan_row: 02_plan §4 W-18 (System & Maintenance page + Demo Control Panel)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
lane: FAST LANE (D75)
decisions: D28, D41(d), D49, D59, D61, D63, D64, D70, D71, D72, D74, D75
---

# Step 52: System & Maintenance page (`/system`) with the Demo Control Panel

**Outcome: PASS.** Every row-52 check is met. The fast-lane gates (D75) are below.

| Check | Result |
|---|---|
| Render test asserts the page and panel test IDs (§14.5.8) | `page-system` plus the 8 panels `system-panel-{quick, services, health, update, maintenance, about, settings, demo}`, the banner, 16 service rows, 0 missing i18n keys (AC-66) |
| AC-65 (unit form): Demo panel "MIC 2 clip", then "Storage full" | AUDIO-02 `clipLatched` true; audit FAULT_RAISED with `eventKind` AUDIO_CLIP; toast "MIC 2 clip injected · Audit: Fault raised · Audio clip"; Audio Capture Service DEGRADED and the banner "1 service needs attention". Then `storage.state` FULL, `evaluatePrecheck(STORAGE)` BLOCK (Start Session step 2), MIC_2 WARN, danger toast |
| `npm run typecheck -w @dems/core-web` | exit 0 (09:23 WIB) |
| `npm run lint -w @dems/core-web` | exit 0; `oxlint -f json`: 0 diagnostics in 317 files (16 files in the folder) |
| Own tests | `npx vitest run src/features/system --maxWorkers=2`: Test Files 2 passed, **Tests 18 passed** |
| Extra | shared `test/i18n.test.ts` 14/14; shared `tsc --noEmit` exit 0; `routes.test.tsx -t system` (AC-48) 1 passed |
| Screenshot (1920×1080, headless Chromium, shared Vite 5178) | `implementation/assets/31_1920_system_mic2_clip.png`: settled page after "MIC 2 clip" from the Demo panel. 12 grid columns; `main` and page horizontal overflow 0/0; no console errors |

**Scope (P6).** Written:
- `apps/core-web/src/features/system/**` (the stub replaced; export `SystemPage` and `data-testid="page-system"` kept);
- `packages/shared/src/i18n/en/system.ts` (additive: every step-34 key kept with its text);
- the two test files in the folder;
- this log, one screenshot, and `delegation_progress/coder_execution_step_52.md`.

Not written: `packages/shared/src/sim/**`, any `package.json` or lockfile, the shell, routes or other features. No `npm install`, no `vite build`, nothing committed.

## 1. Files (`apps/core-web/src/features/system/`)

| File | Lines | Role |
|---|---|---|
| `index.tsx` | 69 | `SystemPage`: header with the banner, 12-column grid, Diagnostics Modal state |
| `panel.tsx` | 111 | `SystemPanel` (kit Card, M-PG-SYS beat) and the per-panel error boundary (3 s → 6 s → 12 s retry, at most 3) |
| `status-banner.tsx` | 66 | "All core services running" / "N services need attention" + "15 of 16 running · v2.4.1 · slot A"; one glow pulse per escalation |
| `quick-actions.tsx` | 124 | Run Diagnostics, Review Audit, Export Evidence, Software Update (MP Spotlight; RBAC Tooltip) |
| `services-panel.tsx` | 113 | Kit `Table`: 16 §6.1 services, the §6.1 responsibility, status Chip, uptime (1 Hz) |
| `health-panel.tsx` | 140 | CPU, zone temperatures (CPU/HDD/ambient), fan: 120-point SVG sparklines from `health.series`; FAN_STALL turns the fan red |
| `update-panel.tsx` | 231 | v2.4.1 → v2.5.0, Stepper `pipeline` of the 6 §20.2 steps + ProgressBar, A/B slots (ACTIVE / TARGET / last known good), rollback and recovery notes, §20.3 partition map |
| `diagnostics.tsx` | 310 | Diagnostics & Maintenance panel (last run, Run Diagnostics, Restart services, Export logs) and the Diagnostics `Modal` (one bar per check, summary `Alert` with one pulse) |
| `about-panel.tsx` | 135 | Device ID, room, model, release, hardware revision, slot, IP, zone; §24.1 identity (14 fields); SBOM / release summary; configuration drift Chip |
| `settings-panel.tsx` | 269 | Kit `Accordion` with the MB 10 rows: Account, App Preferences (**Reduce motion**, **Presentation mode**, clock format), Notifications, Security & Privacy, Device Settings (live camera = sim `setActiveCamera`), Storage Management, Network & Time, System Maintenance, About DEMS |
| `demo-panel.tsx` | 407 | Demo Control Panel (§2) |
| `model.ts` | 225 | Pure view models: RBAC role names, service counts and tones, uptime, sparkline path, update view, partitions, diagnostics summary, the fault catalogue, time-source choice, D64 as-of formatting |
| `sim-adapter.ts` | 175 | SIM-GAP-W52-1…8 (§3) |
| `use-sim-command.ts` | 59 | Runs a sim command with the error rules (§4); `useStartDiagnostics` |
| `choreography.ts` | 56 | M-PG-SYS beats, panel variants, capped row stagger |
| `log.ts` | 23 | Structured dev-console record (no client log endpoint, D41(g)) |
| `system.css` | 577 | Page styles in `@layer components` (`sys-` prefix; shell tiers xl/lg/md/sm/xs) |
| `__tests__/system-page.test.tsx` | 311 | 9 router-level tests |
| `__tests__/system-model.test.tsx` | 103 | 9 pure tests |

`packages/shared/src/i18n/en/system.ts`: 331 lines. `demo.faults` and `demo.scenarios` stay exact `FaultKind` / `ScenarioName` maps (review 40 §5.a); the per-fault hint copy lives in `demo.faultHints`.

## 2. Demo Control Panel (AC-65; C17)

- **Label:** a dashed amber card with a DEMO chip and the note "Demo only. Injected faults are simulated." It sits behind the "Demo controls" Switch, collapsed on entry (M-PG-SYS). The open state is kept per tab in `sessionStorage['dems.system.demoControls.v1']`.
- **Scenario loader:** a Select (idle / recording / finalizing / fault-demo) and "Load scenario" (`loadScenario`), plus "Current: …".
- **Reset:** `loadScenario('idle')` (SIM-GAP-W52-8). "Clear all faults" calls `clearFault` per active kind and `resetClip` on both channels. When the session is in FAULT, a "Recover session" button calls `recover()`.
- **Fault toggles:** one `ToggleButton` (`aria-pressed`) per kind, each with its EVT ID and a hint:
  - camera loss, MIC 1 no signal, **MIC 2 clip** (also resets the latch when turned off);
  - storage low, **storage full**, fan stall;
  - tamper (enclosure only; the evidence hook is never mistaken for it);
  - TPM failure, security fault, audit tamper, power fail.
- **Time source:** a three-way control, GNSS lock → NTP fallback → RTC fallback (`inject(GNSS_LOSS, {fallback})` / `clearFault`).
- **Audit:** every action writes its row in the sim (FAULT_RAISED / FAULT_CLEARED / AUDIT_CHAIN_DISCONTINUITY / SCENARIO_LOADED / RECOVERY_STARTED). The toast names the row and the book event kind. The newest 5 such rows are listed with time, type, kind, ID and hash prefix.
- **Presentation mode:** a Switch bound to `setPresentationMode` / `usePresentationMode` (`lib/presentation-mode.ts`, D74 M8). App Preferences has the same switch; both follow one store.
- **D64 dates:** "Demo media and evidence packages: as of 1 Oct 2026, 10:00 WIB", read from `DEMO_EVIDENCE_INDEX.asOf`. It is lazily imported when the panel opens, so the 270 kB demo-data module stays out of the page chunk. Below it: the live sim clock and a note that the dataset follows the simulator clock.
- **RBAC per the sim:** the panel is open to every role (demo tooling; the sim enforces nothing on these actions). Any `SimPermissionError` becomes a "Not permitted · Requires the … role" toast; a test proves no raw sim text reaches the user.

## 3. SIM-GAPs (for step 54; `grep -rn SIM-GAP- apps/core-web/src`)

| ID | Gap | Local answer (`sim-adapter.ts`) |
|---|---|---|
| SIM-GAP-W52-1 | `ServiceEntry` has no uptime (review 40 m3) | Derived from the last SYSTEM_BOOT audit row, or the later services-restart row; memoised on `audit.rows`. STOPPED shows "—" |
| SIM-GAP-W52-2 | No `settings` slice (m3) | UI-local prefs in localStorage `dems.system.prefs.v1` (labelled "Saved on this console only (demo)"). Reduce motion uses the motion `setReducedOverride` (D59) |
| SIM-GAP-W52-3 | No `restartServices()` action and no SERVICE_RESTART audit type | `restartCoreServices(sim)` refuses without MAINTENANCE (`SimPermissionError`) or during a session (`SimTransitionError`). It then appends one DEVICE_COMMAND row (`details.scope = CORE_SERVICES`) with the sim's own `recordActivity` and one `setState`. The hash chain verifies (test) |
| SIM-GAP-W52-4 | No release / SBOM metadata (§24.3) | `releaseInfo(version)`: synthetic deterministic build ID and checksum (`syntheticFingerprint`), 27 components (the §3.3 inventory in 01_explore Part B), format "SPDX 2.3 (synthetic)". The panel is labelled "Synthetic demo values" |
| SIM-GAP-W52-5 | Presentation mode has no sim slice (M8) | `lib/presentation-mode.ts` (step 43) is the store; this page only writes it |
| SIM-GAP-W52-6 | `inject`, `clearFault`, `loadScenario`, `runDiagnostics`, `startSoftwareUpdate` enforce no RBAC | The page gates Run Diagnostics on DIAGNOSTICS_RUN, update and restart on MAINTENANCE, and Export logs on AUDIT_EXPORT (`ROLE_PERMISSIONS`; disabled + Tooltip, S20). Every call still catches `SimPermissionError` |
| SIM-GAP-W52-7 | No `exportLogs()` action | "Export logs" calls `exportAudit()` (AUDIT_EXPORT RBAC; an AUDIT_EXPORTED or EXPORT_DENIED row in the sim) and builds the JSON bundle in the browser (audit rows + head, events, services, diagnostics; marked DEMO) |
| SIM-GAP-W52-8 | No `resetDemo()` action | Reset = `loadScenario('idle')` |

## 4. Error handling, motion, RBAC

- **Errors (three layers):**
  - `useSimCommand` maps `SimPermissionError` to a role toast, `SimTransitionError` to the caller's friendly warning (for example "Finish the active session before installing an update."), and anything else to a generic toast plus a structured `logSystemError` record.
  - Each panel has an error boundary with the rate-limited retry.
  - A failed log download gets a toast and a log record.
  - The as-of import failure is logged and the line shows "Loading…".
- **Motion (M-PG-SYS):**
  - Panels enter on beats 80–540 ms in reading order. Service rows stagger 30 ms (first 10, M-C-11). Chips and slot colours transition over 400 ms.
  - The hero moment is the Diagnostics Modal: bars fill with `scaleX` over 700 ms × time scale (the fill is pinned at 100 % width), then the summary Alert pulses once.
  - The update Stepper uses the composed M-C-09 pipeline.
  - No ambient loops: the sparklines stream without animation.
  - Reduced motion: opacity only, no delays, no bar transition.
- **RBAC (S20; ROLE_PERMISSIONS):**
  - INVESTIGATOR (OPR-001) can run diagnostics and use the Demo panel. Install update, Restart services and Export logs are disabled, with "Requires the Technician / Supervisor role" (test).
  - TECHNICIAN (OPR-003) restarts services (audited) and runs the A/B update to v2.5.0 on slot B; the slot A tile then shows v2.4.1 "Last known good" (test).

## 5. Verification (fresh, 2026-10-01 09:19–09:23 WIB)

`system-page.test.tsx` (9 tests):
1. Render: panels, banner, 16 services, identity, drift, collapsed DEMO panel, 0 missing keys.
2. **AC-65** (above), including clearing MIC 2 clip (latch reset, FAULT_CLEARED).
3. The other 9 toggles each add an audit row; NTP → RTC → GNSS; clear all.
4. Load the recording scenario (SCENARIO_LOADED), STORAGE_FULL → session FAULT → Recover shown, then Reset → idle with no faults.
5. `SimPermissionError` → role toast, no raw sim text.
6. Run Diagnostics with a manual clock: 8 checks in sequence → "All checks passed"; DIAGNOSTICS_RUN audit row.
7. Investigator gating.
8. Technician restart (DEVICE_COMMAND, chain OK, uptime 00:00:00) and the update to 2.5.0 / slot B with the completion toast.
9. Reduce motion → `html[data-motion=reduced]` and localStorage `dems.motion.reduced`. Presentation mode → `sessionStorage['dems.presentation.v1'] = '1'`, mirrored by the Demo panel switch.

`system-model.test.tsx` (9 tests): uptime format, counts and tones, role names, sparkline, diagnostics summary, every `FaultKind` covered (toggles + time source), targeted toggle keys, as-of format, the uptime anchor memo, deterministic release info.

**Browser (one screenshot):**
- Playwright's cached `chrome-headless-shell` 1243 over CDP (scratchpad script, Node's global `WebSocket`).
- `sessionStorage` was seeded with `dems.auth` = OPR-001 and `dems.shell.intro` = 1.
- In the page: Demo controls on, then "MIC 2 clip".
- Measured: banner "1 SERVICE NEEDS ATTENTION · 15 of 16 running", toast "MIC 2 clip injected · Audit: Fault raised · Audio clip", `aria-pressed` true, SVC-06 Degraded, 12 columns, overflow 0/0, 0 console errors.
- One fix came from the first capture: the health sparklines now fill their card height.

## 6. Decisions and drift

| ID | Decision |
|---|---|
| DR-52-1 | Health mini charts are plain-SVG sparklines, not Recharts `LineChart` (mini). They are streaming and unanimated per M-PG-SYS, keep Recharts out of the page chunk, and follow the step-49 volume-sparkline precedent |
| DR-52-2 | The brief asked for "Restart services" to be audited. There is no sim action, so the adapter writes the DEVICE_COMMAND row through the sim's exported `recordActivity` + `store.setState` (the pattern the sim documents for its slices). It is not a file write under `src/sim/**`, and step 54 should replace it with a real action (SIM-GAP-W52-3) |
| DR-52-3 | Presentation mode has a switch in App Preferences (brief, D74) and one in the Demo panel (§14.5.8). Both are bound to the one `lib/presentation-mode.ts` store |
| DR-52-4 | Maintenance actions are gated on the sim's `ROLE_PERMISSIONS` (MAINTENANCE is Technician-only), so OPR-001 sees Install / Restart disabled with the role Tooltip. The Demo panel stays ungated (DEMO tooling) |
| DR-52-5 | Diagnostics detail text is the sim's English `detail` string (data values such as "CPU 18%, 52 °C"); check labels and statuses are i18n |

**Processes (P14):**
- Shared Vite on 127.0.0.1:5178 was not listening, so I registered `.locks/vite.users/step-52` under `lockf .locks/vite.lock` and started it. PID 55683 is written to `.locks/vite.pid`; the log is `.locks/vite.5178.log`.
- After the capture I removed `step-52`. `step-46` had registered meanwhile, so I left the server running for it. At 09:23:59 WIB step 46, as the last user, stopped PID 55683 (logged in `.locks/vite.5178.log`). 5178 is now free and `.locks/vite.users/` is empty.
- The headless Chrome on port 9352 was stopped by the script; `pgrep` found none and the scratch profile was deleted.

**Blockers:** none.
