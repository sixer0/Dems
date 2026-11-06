---
task_id: 2026-09-30_dems_demo_stack_setup
step: 85
plan_row: 05_mobile_plan §3 M-14 (part a)
date: 2026-10-01
agent: coder-execution
lane: mobile, Metro 8089 (fast lane D75)
tier: 3
status: complete
decisions: D17, D28, D55, D58, D66, D73, D75, D77, D78, D83, D87, D100, D103, D105
---

# Step 85: mobile Storage screen (MB 8)

**Outcome: PASS.**

| Row-85 check | Result | Evidence |
|---|---|---|
| MA-11 MB 8 checklist, ring 20% USED, 3.2 TB free of 4.0 TB | **PASS** | §3, `85_dems_phone_storage_idle.png` (1080×2424) |
| Its tests pass | **PASS** | `npx jest --maxWorkers=2 --forceExit src/features/storage`: 2 suites, **13/13** (10:18) |
| Mobile typecheck | **exit 0** | `npm run typecheck -w @dems/mobile`, 10:18:02, whole app |
| Mobile lint | **exit 0** | `npm run lint -w @dems/mobile`, 10:18, whole app |

- Scope (P6): this step wrote only `apps/mobile/src/features/storage/**`, this log, 4 screencaps `assets/mobile/85_dems_phone_*.png`, and `delegation_progress/coder_execution_step_85.md`.
- Not touched: shared code, `package.json`, the jest config, routes, and the plan and status files (parallel run).
- No npm install, nothing committed.
- Fast lane (D75): no mutation checks, no tablet device run, no fps run, and no full jest run.

## 1. Files (`apps/mobile/src/features/storage/`)

| File | Role |
|---|---|
| `storage-screen.tsx` | `StorageScreen` (export and `SafeScreen id="storage"` kept). Header: back arrow on phones, title only on tablets. Panes per class. Manage Storage button. Apply hook: toast plus a runtime-log record with a correlation id |
| `capacity-card.tsx` | T2: ring, "3.2 TB Free" / "of 4.0 TB", legend (Used, Free, Sealed Evidence, Pending), the LOW/FULL inline `Alert`, and the phone KPI strip in the card footer |
| `capacity-ring.tsx` | Skia donut. Sweep 0 → share, 900 ms `luxe`, after the 200 ms beat. Colour morph gold → amber → red over 400 ms. One glow pulse (600 ms, `totalMs` passed, F74-02). Reduced motion: final frame. No `onSize` |
| `storage-kpis.tsx` | Write speed, session size and est. remaining at 8.2 GB/h. Phone: a strip. Tablet: 4 tiles, adding retention days |
| `storage-activity.tsx` | T3: 5 newest storage events (tone dot, WIB time in mono, text). "See All" → `/audit?category=storage` |
| `manage-storage-sheet.tsx` | T4: BottomSheet (mount on demand). Retention `RadioGroup`, auto-archive `Switch`, read-only thresholds (LOW 85% / FULL 98%), Apply. Role-gated |
| `storage-model.ts`, `storage-motion.ts`, `use-storage-data.ts`, `use-storage-alerts.ts` | Pure maths, §7.3 beats, flat `useSim` selectors (F74-13), escalation toast and haptic |
| `sim-adapter.ts` | SIM-GAP-M85-1 and SIM-GAP-M85-2 (§4) |
| `use-sheet-presence.tsx`, `use-held-value.ts`, `panel-boundary.tsx` | Local copies of the step-79 and step-77 patterns (P6) |
| `i18n.ts` | `features.storage.*`. Reuses the shared `common.storage.*`, `storage.*`, `common.eventType.*` and `common.roles.*` keys |
| `storage-screen.test.tsx` (7), `storage-model.test.ts` (6) | Tests (§2) |

## 2. Tests (13/13)

**Screen tests:**
- **MB 8 order and values:** header → capacity → activity → Manage. Ring "20% used, READY" (`accessibilityValue` 20), centre `20%` / `USED`. "3.2 TB Free", "of 4.0 TB". Legend 804 GB / 3.2 TB / 7 / 1. KPIs 0.0 Idle, —, **389h 45m** "at 8.2 GB/h". 1–5 activity rows with WIB times. 0 missing i18n keys.
- See All pushes `{ pathname: '/audit', params: { category: 'storage' } }`.
- LOW → FULL: one inline Alert per state, one toast and one haptic per escalation (Warning, then Error). Ring 86%, then 99%. Top row "Fault raised · Storage full".
- Investigator: the sheet is read-only, shows the reason, and Apply is disabled.
- Supervisor: Apply writes `{YEAR_1, 365, false}` to the simulator, raises the toast and adds the top row "Storage policy changed · 365 days · auto-archive off". The sheet closes.
- Recording: 2.3 MB/s, the "Recording" caption, a live session size.
- Tablet landscape: `pane-capacity` | `pane-activity`, the retention tile "90 days", no back arrow.

**Model tests:** units, AC-54 from a fresh simulator, ring geometry (the glow fades out inside the canvas), escalation rule, activity tone and detail, the adapter filter (store-owned objects), the role gate.

**Route tree (spot check, not a gate):** `routes.test.tsx` "/storage renders screen-<id>" and `chrome.test.tsx` More → `/storage` both pass. That run's 13 failures are other screens' stub assertions (sessions, evidence, devices, settings, session/new) mid-replacement (P11).

## 3. Device check (phone portrait)

All sessions ran through `device-session.sh` outside the sandbox on Metro 8089, with the app force-stopped first by the helper.

| Session | Result |
|---|---|
| 1 (09:50) | Exit 70: port 8089 was in use by another agent's helper-test copy (`scratchpad/h67b`, F-85-5) |
| 2 (09:57) | **Invalid.** The bundle failed (`maintenance.ts` imports a missing `./devices`: shared sim mid-write by another step, F-85-4). Its screencaps were overwritten later |
| 3 (10:11–10:15, phone) | Bundled 1,332 ms. Sign-in through the Login demo-operator picker (D103 arrived mid-session). `/storage?motion=off`: every T1–T4 id present. Simulator was in a RECORDING session left by another lane (`85_dems_phone_storage.png`). Manage sheet read-only for the Investigator, all 13 sheet ids present (`85_dems_phone_manage_sheet.png`). `inject("STORAGE_FULL")`: the FULL toast fired, then the route sync moved to Session Recovery (`85_dems_phone_full_during_recording.png`, F-85-1). Logcat: 0 E, 4 W, 0 FATAL |
| 4 (10:19, `any-phone` → emulator-5554, D105) | `&scenario=idle`, then debug-handle `signInWithBiometric("OPR-001")` → true (D103). **Final MB 8 capture `85_dems_phone_storage_idle.png`.** Simulator read back: session null, 804 GB, READY, no faults. Logcat 0 E, 4 W, 0 FATAL |

**MB 8 checklist (session 4, 1080×2424; uiautomator bounds):**

| Region | y (px) | Matches |
|---|---|---|
| T1 header | 63–210 | gold back arrow, "Storage" |
| T2 capacity | 210–881 | ring 84–473: **20% USED**; **3.2 TB Free** / of 4.0 TB; Used 804 GB, Free 3.2 TB, Sealed Evidence 7, Pending 1; KPI strip 0.0 MB/s Idle · — No session · **389h 45m** at 8.2 GB/h |
| T3 Recent Storage Activity | 923–1549 | 5 rows (sealed violet, recording started green, mono times), See All |
| T4 Manage Storage | 1591–1738 | gold-edged button with the Layers icon |
| Tab bar | below | step 70's chrome, More selected |

Recorded differences from the mockup:
- 20% USED (D28/Q1);
- the legend uses the web colours (gold used, violet sealed, D28/Q4);
- the KPI strip is an addition from the brief;
- dataset times.

The 4 warnings are a require cycle in shared `demo-data` and Reanimated's "Reduced motion … 'always'" (from `?motion=off`, F77-3). None comes from this step.

## 4. SIM-GAPs (for step 91)

| ID | Gap | Local adapter | State at 10:15 |
|---|---|---|---|
| **SIM-GAP-M85-1** | No storage-activity selector (`SimEvent` had no category). Same need as web W49-2 | `selectStorageActivity(state, 5)`, a filter by type plus the STORAGE_LOW/FULL fault rows | Step 54 has since added a shared `selectStorageActivity` / `isStorageActivityEvent` with the same semantics. Step 91: import it with `count = 5` and delete the adapter block |
| **SIM-GAP-M85-2** | No role check on `setStoragePolicy` (web F-49-1) | `canManageStoragePolicy(role)` = EVIDENCE_REVIEW or MAINTENANCE (Supervisor, Technician). The UI disables the controls and shows the reason | Step 54 now enforces `requirePermission(EVIDENCE_REVIEW, MAINTENANCE)` in the simulator: the same rule. Step 91: keep the UI gate on a shared helper if one is added, or keep `roleHas` |

Thresholds stay read-only because the simulator has constants and no setter. That is the brief's rule, not a gap.

## 5. Decisions, drift, findings

| ID | Type | Item |
|---|---|---|
| DR-M85-1 | drift | The donut is a Skia trimmed arc, not victory-native `PolarChart` + `Pie` (§4.13, VM-12). It needs one arc, no layout measurement, and is driven by the motion kit (same primitives as GlowRing) |
| DR-M85-2 | drift | Retention uses `RadioGroup`, not `Select`. A Select opens its own overlay inside the sheet, which is the F-79-2 parking risk |
| DR-M85-3 | drift (scope) | Tablet layout: capacity + 4 KPI tiles \| activity + Manage, per the brief. §4.13 T5's 24 h `Area` and volume `HorizontalBar` charts were not built. Candidate for the end pass (step 59) or a follow-up |
| DR-M85-4 | drift | Legend colours follow the web page (gold, grey, violet, amber), not the mockup's grey, yellow, green, blue (D28/Q4) |
| S85-1 | decision | Phone KPIs sit in the capacity card footer, so MB 8's region order is unchanged |
| S85-2 | decision | Calm escalation: the inline Alert persists while LOW/FULL lasts. Toasts last 5 s (LOW) and 10 s (FULL), not persistent. One haptic each (`storageLow`, `criticalFault`). Nothing fires on mount or on recovery |
| S85-3 | decision | The pulse uses `animatePulseOnce(1, 0, m, 600)` on the ring glow (F74-02), not `GlowLayer`, whose internal call omits `totalMs` |
| S85-4 | decision | Centre % uses C-6 `slide` plus the held value (F77-1). Session size moves in 10 MB steps, so no per-tick re-render |
| S85-5 | decision | Manage Storage is `variant="outline"` with a gold border on the bronze tertiary surface (the MB 8 look). It is not the gradient primary button |
| F-85-1 | finding (env, repaired) | Session 3's `STORAGE_FULL` hit a RECORDING session another lane had left in the snapshot. The route sync then forced Session Recovery, which is correct system behaviour. Session 4 loaded `idle` on the same phone, and the read-back shows it clean. Lesson: read `session.state` before injecting faults |
| F-85-2 | finding, fixed | The blurred glow was clipped at the Skia canvas bounds, leaving a hard square edge (session 3). The ring is now inset by the glow's reach (`donutGeometry`), and the box grew to 148 dp. Session 4 shows no edge |
| F-85-3 | finding, fixed | "Recording · 8.2 GB/h" was cut off in the phone strip. The strip now shows "Recording"; the accessible label keeps the full text |
| F-85-4 | environment | Shared sim mid-write (missing `./devices`) broke every lane's bundle around 09:57. The driver now waits for the bundle result and the shared imports to resolve before it acts |
| F-85-5 | environment | Another agent's helper test used Metro 8089 at 09:50 |
| D103 | relay | Session 3 signed in through the Login demo picker, before the hint arrived. Session 4 used the debug-handle biometric sign-in |
| P12 | — | No new package, native module or shared-contract change |

## 6. Processes and rollback

- **Processes:** Metro 8089 started and stopped by the helper in each session; reverse rules were removed by the helper. No emulator was started or stopped (D78). The phone simulator is left at `idle`, signed in as OPR-001.
- **Rollback:** restore step 70's stubs of `storage-screen.tsx` (`ScreenStub id="storage"`) and `i18n.ts` (empty `storageEn`). Delete the other files in `features/storage/` and `assets/mobile/85_*.png`.

---
*Generated: 2026-10-01 10:25 WIB by coder-execution (step 85)*
