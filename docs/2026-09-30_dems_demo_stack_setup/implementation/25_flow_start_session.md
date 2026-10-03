---
step: 46
agent: coder-execution
plan_row: 02_plan §4 W-12 (Start New Session flow)
tier: 3
lane: web, FAST LANE (D75), shared Vite 127.0.0.1:5178 (P14/D72)
status: complete
date: 2026-10-01
started: 06:58 WIB
finished: 09:26 WIB (paused 07:08–09:15 by a controller-side interruption)
---

# 25 Start New Session flow (`/session/new`)

## 1. Result against row 46

| Acceptance (02_structured row 46, D75 fast lane) | Result | Evidence |
|---|---|---|
| Step 2 blocks on a BLOCK check | **PASS** | `session-new.test.tsx` "blocks on a BLOCK check…": Core link OFFLINE gives outcome BLOCK, `sn-gate-blocked` reads "Core link offline", Next disabled, stepper devices `error`, audit PRECHECK_BLOCKED. After the link is restored, "Re-run checks" gives ARMED and enables Next |
| WARN needs the acknowledgement | **PASS** | "needs the acknowledgement for a WARN check…": MIC_NO_SIGNAL gives MIC 1 WARN ("MIC 1: no signal"), the session stays PRECHECK, and Next stays disabled until the box is ticked. Next then gives ARMED with PRECHECK_PASSED `{warnings:1, acknowledged:true}` |
| Start puts the sim in RECORDING with SESSION_CREATED, PRECHECK_PASSED and RECORDING_STARTED (AC-62 unit form) | **PASS** | "creates, checks 8 devices within 5 s…" (fake timers): 8/8 PASS within 5 s of simulator time. The 3-2-1 countdown runs, then RECORDING. The route lands on `/session` with `page-session-monitor` `data-phase="RECORDING"`. The audit has those 3 rows in order, and RECORDING_STARTED names OPR-001 as the actor |
| core-web typecheck, lint and tests exit 0 | **PASS** | `npm run typecheck -w @dems/core-web` exit 0 (09:24). `npx oxlint --format default`: "Found 0 warnings and 0 errors", 319 files, exit 0. `npx vitest run src/features/session-new src/test/routes.test.tsx --maxWorkers=2`: 3 files, **46/46**, exit 0 (own tests 15/15) |
| Browser check: one screenshot at 1920×1080 | **PASS** | `assets/25_flow_devices_check_1920.png`. Headless `chrome-headless-shell` 1243 over CDP, `dems.auth` seeded with OPR-001. In the browser: scan → `LP/2026/1001-0008`; Next → step 2 in 0.4 s; gate PASS 4.2 s after Next; 8 chips; no horizontal scroll and no `<main>` scroll (1000/1000). Step 3 → Start → countdown → `/session` RECORDING 3.25 s after Start. Second run: 0 console errors |
| Shared i18n | **PASS** | `packages/shared`: `npx vitest run test/i18n.test.ts test/session-schema.test.ts` 21/21; `tsc --noEmit` exit 0. A test asserts that all 10 `SESSION_CREATE_MESSAGES` keys exist (the 5 D62 additions included) |

## 2. Files (P6 write set only)

| File | Change |
|---|---|
| `apps/core-web/src/features/session-new/index.tsx` | Stub replaced; keeps `SessionNewPage` and `data-testid="page-session-new"`. Flow controller: `?step` guards, RHF + `zodResolver(sessionCreateSchema)`, create/precheck/acknowledge/retry/start/cancel with toasts and logs, Stepper `wizard`, TransitionPanel (direction-aware), footer |
| `…/session-new/model.ts` | Pure rules: `effectiveStep` / `maxStepFor`, `isLiveElsewhere` (R4 n5), `gateView`, `reasonKeyFor`, subject tones, schema-message guard |
| `…/session-new/info-step.tsx` | Step 1: Form, TextField + scan `Button isIconOnly`, ToggleButtonGroup (Tersangka red / Saksi blue / Lainnya neutral, EN gloss tooltips), ComboBox investigator (SESSION_START holders, defaults to the signed-in operator), Select room and profile, TextArea notes with counter, FieldError. Side column: Session Preview and a live Device Readiness glance (`evaluatePrecheck`, primitive selector, R1) |
| `…/session-new/devices-step.tsx` | Step 2: ListBox of 8 checks (Spinner → check-draw / WARN / BLOCK chip), progress bar, BLOCK `Alert danger`, WARN acknowledgement Checkbox, "Re-run checks", CameraFeed tiles ×2, DbfsMeter `panel` ×2 with "Speak to test", and a Gate Policy legend |
| `…/session-new/ready-step.tsx` | Step 3: summary Card, mini GlowRing (READY, or ATTENTION when warnings were acknowledged), "3-2-1 countdown" Switch (on by default), large primary "Start Recording" gated on SESSION_START with a reason text, and the centred countdown overlay (rack focus, scale 1.1 → 1 over 600 ms, 1 s apart) |
| `…/session-new/cancel-dialog.tsx`, `error-boundary.tsx`, `log.ts`, `sim-adapter.ts`, `session-new.css` | AlertDialog "Discard this session?"; a step boundary with rate-limited retry (3/6/12 s, max 3); a structured dev-console log record with correlation ID and no PII; SIM-GAP adapters; `.sn-` page styles (theme tokens; only transform and opacity animate) |
| `…/session-new/__tests__/session-new.test.tsx`, `session-new-model.test.tsx` | 7 router-level tests (real router and sim, manual clock, fake timers) and 8 model tests |
| `packages/shared/src/i18n/en/session-new.ts` | Additive: the 5 D62 keys (`info.subjectName.tooLong`, `info.room.required`, `info.room.tooLong`, `info.profile.required`, `info.notes.tooLong`), plus preview, gate progress, outcomes, reasons, policy, countdown, start, error and discard copy |

## 3. SIM-GAPs (for step 54; `grep -rn SIM-GAP-W46 apps/core-web/src`)

| ID | Gap | Local handling |
|---|---|---|
| SIM-GAP-W46-1 | No scan action: `meta.counters.caseNumber` exists, but nothing reserves or advances it | `scanCaseNumber()` formats the counter with the sim's `caseNumberFor` at the sim clock. A repeat scan offers the same number |
| SIM-GAP-W46-2 | `PrecheckItem.reason` is EN prose with no reason code | `reasonKeyFor(id, status, value)` maps every WARN and BLOCK case of the §5.3 policy to an i18n key. The sim text is never shown (m8) |
| (M5, already step 54) | start, acknowledge and cancel do not check permissions | Start is gated on `selectCan(SESSION_START)` (R4). The route already redirects roles without SESSION_START |

## 4. Decisions and drift

| ID | Kind | Note |
|---|---|---|
| DR-46-1 | drift | No `layoutId="feed-VIDEO-01"` flight on Start (M-PG-NEW). The Session Monitor feed has no matching `layoutId` (DR-44-5), and P6 forbids editing step 44's folder. The shell route transition cross-fades instead. Step 45/58 may revisit |
| DR-46-2 | decision | A 300 ms "Creating session…" beat with a Spinner on Next (04 §5.7 "Creating the session shows a Spinner"). The sim create itself is synchronous |
| DR-46-3 | decision | Back keeps the setup session. Next with the same form reuses it (S26, `created:false`). A changed form cancels it (SESSION_CANCELLED) and creates a new one. A fresh page on a setup session resumes at the furthest allowed step, with the form prefilled from `session.input` ("Continue setup") |
| DR-46-4 | decision | The acknowledgement Checkbox is page state; `acknowledgePrecheckWarnings()` runs on Next, so the operator can untick before committing. A re-run clears the box |
| DR-46-5 | polish | Step 1 side column (Session Preview plus live Device Readiness) and the step 2 Gate Policy legend. Not in the spec; they use the kit Card and theme tokens only |
| DR-46-6 | decision | The step 2 camera previews play the live loops (CameraFeed default, "two live preview tiles" in 04 §5.7). This is the only page state with two decoders and no other feed. AC-71 fps belongs to step 58 (D70/D75) |
| DR-46-7 | decision | Cancel (with data or a setup session) → AlertDialog → `cancel()` → Dashboard plus a "Session discarded" toast. Without data it goes straight to the Dashboard |
| DR-46-8 | finding (relay) | The first browser load after this step hit Vite's dependency optimiser: `react-hook-form` and `@hookform/resolvers` are first used in core-web here. One "Invalid hook call" route error appeared, then Vite reloaded. The second run had 0 console errors. Dev-only (no `vite build` impact); steps 45, 58 and 61 on a cold 5173 cache may see the one reload. `optimizeDeps.include` lives in `vite.config.ts`, which this step does not own |

Error handling (D41(g)): no client log endpoint exists, so `log.ts` writes structured dev-console records (level, source, message, stack, context, correlation ID). The operator sees generic kit toasts. A failing step shows the retryable fallback.

## 5. Parallel-run notes

- **P1/P6:** no install, and no edit to a manifest, the lockfile, the shell, routes, the sim or other features. `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `99_implementation_report.md` were not edited (parallel run, P8).
- **P11:** the first typecheck (09:16) failed only in `features/system/*` (step 52 writing). The re-run at 09:19 and the final run at 09:24 both exited 0.
- **P14:** I registered `.locks/vite.users/step-46` while step 52's Vite was running. Step 52 then left. As the last user, under `.locks/vite.lock`, I stopped the recorded Vite (PID 55683, `vite --port 5178`). Port 5178 is free.
- **P7:** `chrome-headless-shell` PIDs 57461 and 58368 (port 9356) were started and killed. The scratch profile was deleted. Scripts are in `scratchpad/s46/`.
