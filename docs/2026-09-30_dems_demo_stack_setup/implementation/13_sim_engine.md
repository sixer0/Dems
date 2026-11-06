---
task_id: 2026-09-30_dems_demo_stack_setup
step: 32
plan_row: 02_plan §4 W-02 part b (simulator engine; SCR-01 and SCR-02 behaviour)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 32: Simulator engine (`@dems/shared/sim`)

**Outcome: PASS.** All row-32 checks pass; the command output is in §4.

- **Files.** 11 new source files and 11 extended step-31 files under `packages/shared/src/sim/` (29 files, 9,181 lines).
- **Tests.** The seven row-32 test files (89 tests) plus two extra files (46 tests).
- **Actions.** Every action is implemented; none throws `SimNotImplementedError` any more.
- **D54 (b).** Sealed Today reads **7** at load: 7 follow-up sessions sealed today, spread over the hours before the sim clock's `now`.
- **Next owner.** Steps 54, then 91, own `src/sim/**` next (P6), one at a time. §2 is the updated contract for them, the web pages (42–53), the API steps (33, 53) and mobile step 73.

## 1. Files

| File | Change | Role |
|---|---|---|
| `session-machine.ts` | new | §14.7 transition table as pure `(state, …) → state` functions (create, precheck, arm, record, stop, finalize, seal, fault, recover, cancel, marker, note, snapshot, acknowledge summary) plus `tickMachine` for the timed transitions |
| `derive.ts` | new | Recomputes every fault- and session-derived field in one pure function. Covers camera, MIC and track REC states, the REC indicator, PoE and ports, the time tier, security posture and controls, the 16 services and the storage fill. Unchanged objects keep their identity |
| `faults.ts` | new | `inject` and `clearFault` for the 12 kinds (alert + audit row + event + timeline FAULT; critical kinds → FAULT), `resetClip`, `acknowledgeAlert` |
| `audio.ts` | new | The 20 Hz two-channel model (speaker turns, syllabic modulation, peaks, CLIP bursts, NO SIGNAL, test tone) and the pure ballistics `stepMeter` |
| `health.ts` | new | 1 Hz: CPU, temperatures and fan; storage bytes at 8.2 GB/h; time offset per tier; bandwidth |
| `generator.ts` | new | Recording integrity stream (Poisson, mean 8 s) and idle events (1 per 60 s) |
| `maintenance.ts` | new | Run Diagnostics (8 checks), device commands, retention policy, A/B software update 2.4.1 → 2.5.0 |
| `evidence-actions.ts` | new | `verify`, `exportEvidence`, `archiveEvidence`, `exportAudit` (RBAC + audit) |
| `pairing.ts` | new | `pair` and `unpair` (3 failures → 60 s lockout, audited, the code never stored) |
| `scenarios.ts` | new | `idle`, `recording`, `finalizing`, `fault-demo`, built with the real transitions; `loadScenarioState` |
| `api.ts` | new | The 9 simulated §21.2 handlers, response body types and `SIM_API_ROUTES` |
| `actions.ts` | rewritten | Every action is wired (one pure transition, one `setState`) |
| `engine.ts` | extended | 7 subsystems; shared audio runtime; `Sim.request()`; scenarios delegated to `scenarios.ts` |
| `dataset.ts` | extended | D54 (b): `TODAY_HISTORY` (7 items), `todaySchedule`, `bootTimeFor`, `usedBytesAt`. The recording scenario is session **0024**; idle counters are 24 / 8 / 14 |
| `initial-state.ts` | extended | Stepped 24 h usage history from the real sessions; `pairedAt` after today's boot; `lastSyncAt` 12 s before load; `simulatedFillBytes: 0` |
| `evidence.ts` | extended | `createEvidenceItem`, `verifyEvidenceItem`, `tamperEvidenceItem` / `restoreEvidenceItem` (EVT-13/14), `integrityInputOf`. The step-31 derivation is unchanged |
| `events.ts` | extended | `recordActivity` (monotonic time) and `nextItemId` |
| `selectors.ts` | extended | 13 selectors (§2.4); GlowRing flags POWER_FAIL and AUDIT_CHAIN |
| `types.ts` | extended (additive, optional) | See §2.7 |
| `errors.ts` | extended | `SimNotFoundError`, `SimPermissionError` |
| `constants.ts` | extended | Engine timing and model constants (§2.8) |
| `index.ts` | extended | Exports the 11 new modules |

**Tests:**

| File | Tests | Proves |
|---|---|---|
| `test/sim-determinism.test.ts` | 8 | AC-51 |
| `test/session-machine.test.ts` | 27 | AC-52, plus AC-62 and AC-63 in unit form |
| `test/audio.test.ts` | 14 | AC-53 |
| `test/storage-math.test.ts` | 9 | AC-54 |
| `test/hash-chain.test.ts` | 14 | AC-55, EVT-13/14 |
| `test/sim-platform-neutral.test.ts` | 8 | SCR-01 |
| `test/sim-mobile-additions.test.ts` | 9 | SCR-02 |
| `test/sim-api.test.ts` (extra) | 12 | AC-58, sim side |
| `test/sim-faults-scenarios.test.ts` (extra) | 34 | Every fault kind, scenarios, maintenance, generator rates, AC-65 unit form |
| `test/sim-contract.test.ts` (step 31, **updated**) | 26 | 4 tests changed with the contract (S32-D1) |

**Not touched:**
- `package.json` and the lockfile (no `npm install`).
- `src/index.ts` (the root barrel still does not re-export the sim).
- `src/{i18n,brand,tokens,api}/**`, demo-media and demo-data paths.
- `test/auth.test.ts` and `test/sim-store.test.ts` (both still pass unchanged).

## 2. Contract for downstream steps (updated)

### 2.1 Creating and running a simulator

Unchanged from `12_sim_contract.md` §2, with these additions:

- **`sim.request({ method, path, body? })` → `{ status, headers, body }`.** The simulated REST surface for `simAwareFetch` (step 53). It never throws, and it reports 5xx as `api`.
- **`createSubsystems(engine, audioRuntime?)`** runs these subsystems in order:
  1. clock (100 ms)
  2. auth idle expiry
  3. session machine (timed transitions)
  4. health (1 Hz)
  5. audio (20 Hz)
  6. generator (events)
  7. maintenance (diagnostics and update)
- **Scenarios work in `createSim({ scenario })`** and in `loadScenario(name)`. Names: `idle`, `recording`, `finalizing`, `fault-demo`.
- **Timed transitions run at their scheduled times.** A catch-up after a hidden tab or a backgrounded app gives the same timestamps as a live run, because the Core kept running.

### 2.2 Actions: results and errors

UI callers wrap the throwing ones in try/catch and show a toast.

| Action | Result / behaviour | Throws |
|---|---|---|
| `createSession(input)` | `CreateSessionResult`. Same input while any non-SEALED session exists → `{ok:true, created:false}` (S26, §5.6 resync). Different input → `SESSION_ACTIVE`. Also `NOT_SIGNED_IN`, `NOT_PERMITTED` (TECHNICIAN), `INVALID_INPUT` (case ≤ 64, subject ≤ 120, room ≤ 80, notes ≤ 2000; investigator must hold SESSION_START) | never |
| `beginPrecheck()` | CREATE → PRECHECK. 8 checks, 300-700 ms each, seeded, ≤ 4.9 s in total | `SimTransitionError` outside CREATE |
| `acknowledgePrecheckWarnings()` | PRECHECK with outcome WARN → ARMED (audit PRECHECK_PASSED `{warnings, acknowledged}`) | other states or outcomes |
| `retryPrecheck()` | PRECHECK with a resolved outcome → a fresh run | while checks run, or outside PRECHECK |
| `startRecording()` | ARMED → RECORDING | outside ARMED |
| `stopRecording(reason)` | RECORDING → STOPPING (trimmed reason ≥ 5 characters). Then after 1.5 s FINALIZING, 6 steps of 0.6-1.2 s, then SEALED. SEALED is reached ≤ 8.7 s after the stop | outside RECORDING, or a short reason |
| `cancel()` | CREATE, PRECHECK or ARMED → no session | other states |
| `recover()` | FAULT → RECOVERY (RECOVERY_SCAN for 1.5 s, then INCOMPLETE_SESSION_ANALYSIS) → no session after 3 s. The session is kept INCOMPLETE in `sessionHistory`. A RECORDED, unsealed evidence item exists if recording had started. POWER_FAIL: SYSTEM_BOOT row first, and the fault clears itself | outside FAULT |
| `addMarker(label?)`, `addNote(text)`, `snapshot()` | Timeline item plus audit row, RECORDING only. The note text stays in `session.notes`; the audit row holds `{noteId, length}` | outside RECORDING; an empty or > 2000-character note |
| `acknowledgeSummary(id)` | Clears the pending summary once (audit SUMMARY_ACKNOWLEDGED). Other IDs and repeats are no-ops. Creating the next session also acknowledges it implicitly | never |
| `verify(evidenceId)` | `EvidenceVerifyResult`. Writes the verification status, a custody entry, and EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED | `SimNotFoundError` |
| `exportEvidence(id, {reason, destination})` | Checked in this order: 401 NOT_SIGNED_IN → 403 FORBIDDEN (audit EXPORT_DENIED, `eventKind` UNAUTHORIZED_EXPORT) → 404 → 409 NOT_SEALED (RECORDED or ARCHIVED) → 409 **SECURITY_FAULT** (new) → 422 INVALID_REASON (< 5 characters) → 202 `{exportId: EXP-…}` (status EXPORTED, custody, EVIDENCE_EXPORTED) | never |
| `archiveEvidence(id)` | SEALED, UNDER_REVIEW or EXPORTED → ARCHIVED | `SimPermissionError` (needs EVIDENCE_REVIEW); `SimTransitionError` for RECORDED; `SimNotFoundError` |
| `exportAudit()` | 401, 403 (audited) or 202 (AUDIT_EXPORTED with `rows`, `head`, `chainOk`) | never |
| `inject(kind, target?)` | §2.5 | `SimNotFoundError` for an unknown evidence target |
| `clearFault(kind, target?)` | Without a target: every fault of that kind. The CLIP latch stays until `resetClip` | never |
| `resetClip(channel)`, `acknowledgeAlert(id)` | No-op when there is nothing to change | never |
| `loadScenario(name)` | A fresh dataset at `now` plus the scenario. Keeps auth, lockout, pairing, tabletLink and epoch. Writes SCENARIO_LOADED | `RangeError` for an unknown name |
| `runDiagnostics()` | Returns `DIAG-…`; the same ID while a run is in progress. 8 checks of 0.3-0.6 s | never |
| `deviceCommand(deviceId, cmd)` | Audit DEVICE_COMMAND. TEST_SIGNAL on MIC-01 or MIC-02 plays −18 dBFS for 2 s | `SimNotFoundError` |
| `setStoragePolicy(partial)` | Days per policy: DAYS_30 30, DAYS_90 90, YEAR_1 365, CASE_CLOSURE 3650. A no-op writes nothing | `SimTransitionError` for days outside 1-3650 or an unknown policy |
| `startSoftwareUpdate()` | 6 steps (REBOOT 3 s, others 0.8-1.6 s). Writes UPDATE_STARTED, SYSTEM_BOOT and UPDATE_COMPLETED. Ends at 2.5.0 in slot B | `SimTransitionError` while a session is active |
| `pair(code)` | `PairResult`. Code `482913`. 3 failures in 5 min → LOCKED for 60 s. Rows PAIRING_SUCCESS, PAIRING_FAILED, PAIRING_LOCKED. Already paired → `{ok:true}`, no row | never |
| `unpair()` | PAIRED → UNPAIRED (audit UNPAIRED). Otherwise a no-op | never |
| `setTabletLink(state)` | As in step 31, plus derived device fields. **OFFLINE makes the precheck CORE check BLOCK** (MA-10) | never |

### 2.3 Precheck policy (§5.3; 01_specs §14.5.11, G8)

| Check | BLOCK | WARN | PASS `value` |
|---|---|---|---|
| CORE | tabletLink OFFLINE (`value` OFFLINE) | — | ONLINE |
| LENS_1, LENS_2 | camera lens FAULT or offline | — | READY |
| MIC_1, MIC_2 | — | NO_SIGNAL; CLIP or latched | READY |
| STORAGE | FULL | LOW | READY |
| TIME | — | RTC | GNSS or NTP |
| SECURITY | security state FAULT (TPM_FAILURE, SECURITY_FAULT) | enclosure TAMPER (S32-5) | READY |

Each item carries `status` (PENDING, then RUNNING, then PASS/WARN/BLOCK), `value`, `reason` and `resolvesAt`. `evaluatePrecheck(state, id)` is exported for live previews.

### 2.4 Selectors added

- `selectPrecheck`, `selectFinalization`, `selectRecovery`.
- `selectActiveFaults`, `selectIsFaultActive(s, kind, target?)`.
- `selectAlerts` (newest first), `selectDiagnostics`, `selectUpdate`, `selectStoragePolicy`.
- `selectLastSealedSession` (mobile Summary), `selectEvidenceBySessionId`.
- `selectAuditChainBreak` → `{seq, index, id}` for the EVT-30 Alert.
- `selectPowerFail` (the global power-fail overlay, 03 §7).
- `selectSystemState` gains CRITICAL flags `POWER_FAIL` and `AUDIT_CHAIN`.

### 2.5 Faults (`inject(kind, target?)`)

**Every inject:**
- adds the fault to `faults.active` (idempotent per kind and target);
- raises an alert (with `target`);
- writes an audit row and an event;
- adds a FAULT timeline node while recording.

The audit row is FAULT_RAISED, or AUDIT_CHAIN_DISCONTINUITY for AUDIT_TAMPER. Its `details` hold `{kind, evt, eventKind, target, fromState}`. `eventKind` is the book's `AuditEventKind`: MIC_CLIP → **AUDIO_CLIP** (AC-65).

**Critical kinds** (STORAGE_FULL, TPM_FAILURE, POWER_FAIL, SECURITY_FAULT) move PRECHECK, ARMED, RECORDING, STOPPING or FINALIZING to FAULT.

| Kind | Default target | Effect | Alert |
|---|---|---|---|
| CAMERA_LOSS | the active camera (`cameraId`) | lens FAULT, offline, REC LOST, PoE 3/4, its port down, Video Management DEGRADED | CRITICAL |
| MIC_NO_SIGNAL | AUDIO-01 (`channel`) | flat −90, NO_SIGNAL, REC LOST, MIC IN port down | WARNING |
| MIC_CLIP | AUDIO-02 (`channel`) | latched **at once**, then −0.2 dBFS bursts every 0.4-1.2 s | WARNING |
| STORAGE_LOW / STORAGE_FULL | — | fill to 86% LOW / 98.6% FULL (`storage.simulatedFillBytes`); clearing restores the exact usage | WARNING / CRITICAL |
| GNSS_LOSS | `fallback: 'NTP'` (or `'RTC'`) | NTP: stratum 3, locked. RTC: unlocked, NTP unreachable, the offset drifts. Only one fallback at a time: escalating replaces it | WARNING |
| TAMPER | none = enclosure (EVT-12) | posture ATTENTION, TAMPER control open, precheck SECURITY WARN | WARNING |
| TAMPER + `{evidenceId, trackId?}` | track AUDIO-02 | the evidence media tamper hook (EVT-13/14): `verify` fails on exactly that track; manifest and signature stay OK | WARNING |
| FAN_STALL | — | 0 rpm; temperatures climb towards 84 °C at 1 Hz | WARNING |
| POWER_FAIL | — | critical; Recording Engine STOPPED | CRITICAL |
| TPM_FAILURE / SECURITY_FAULT | — | security FAULT, posture CRITICAL, precheck BLOCK, export 409 | CRITICAL |
| AUDIT_TAMPER | row 5 from the end (`auditIndex`) | alters that row's message without re-hashing; `verifyAuditChain` fails at exactly that index; clearing restores it. An untargeted repeat is a no-op | CRITICAL |

### 2.6 Dataset (D54 b) and scenarios

| Item | Value |
|---|---|
| Previous-day history (step 31, **unchanged**) | EV 0001–0006 / SES 0011–0016, same subjects, statuses, dates, hashes |
| Today (new) | EV **0007–0013** / SES **0017–0023**, all SEALED, follow-up interviews in the existing cases LP/…-0001…0006. Subjects: Rahmat Hidayat, Nur Aini, Yusuf Pratomo, Sri Wahyuni, Fajar Nugroho, Indah Permata, Wahyu Saputra |
| Today's schedule | `todaySchedule(now)`. The newest ends 25 min before `now`. Office hours first (from 07:00 WIB) when each slot gets ≥ 20 min, otherwise from 00:30. At 10:00 WIB the items are sealed at 07:22 … 09:35 (buckets 07:2, 08:3, 09:2) |
| At load | 13 evidence items. Stats: total 13, sealed 10, recorded 1, exported 1, under review 1, **pending 1, sealedToday 7**. 13 session-history entries (1 INCOMPLETE). 82 audit rows, 59 events (10:00 WIB) |
| Idle counters | next session **0024**, next Scan case 0008, next evidence **0014** |
| Boot | `bootTimeFor(now)`: before today's first session (06:32:42 at 10:00 WIB) |
| `recording` scenario | **SES-…-0024**, case LP/{YYYY}/{MMDD}-0007, Ahmad Fauzi (TERSANGKA), OPR-001, 00:18:42 in. Its timeline has START, NOTE, MARKER, AUDIO_PEAK, SNAPSHOT, AUTOSAVE, CHECK and HEALTH. About 130 integrity rows (218 audit rows in total at 10:00 WIB), and 20% used (806.6 GB) |
| `finalizing` scenario | The same session, stopped 1.6 s before `now`; step 1 of 6 active; seals within at most 7.2 s of ticks (EV-…-0014) |
| `fault-demo` scenario | Still RECORDING with CAMERA_LOSS VIDEO-02, MIC_CLIP AUDIO-02 and GNSS_LOSS (NTP) → system CRITICAL, 3 FAULT timeline nodes |

### 2.7 Type additions (all optional, additive)

- `EvidenceItem.tamperedTrackId`
- `StorageSlice.simulatedFillBytes`
- `DiagnosticCheck.resolvesAt`
- `UpdateSlice.steps[].resolvesAt`
- `SimAlert.target`
- `FaultTarget.{fallback, evidenceId, trackId}`
- `ExportResult` reason `SECURITY_FAULT` (status 409)

The snapshot stays schema version 1.

### 2.8 Constants added

- `PRECHECK_TOTAL_MAX_MS` 4900, `RECOVERY_SCAN_MS`.
- `EXPORT_REASON_MIN_LENGTH` 5. Step 33 already imports it; keep it stable.
- `GENERATOR_CATCH_UP_MAX`.
- `TIMELINE_{AUTOSAVE,CHECK,HEALTH}_MS`.
- `AUDIO_PEAK_{MIN,MAX}_INTERVAL_MS`, `AUDIO_CLIP_BURST_DBFS`, `AUDIO_TEST_TONE_{DBFS,MS}`.
- `DIAGNOSTIC_CHECK_{MIN,MAX}_MS`.
- `UPDATE_STEP_{MIN,MAX}_MS`, `UPDATE_REBOOT_MS`.
- `STORAGE_{LOW,FULL}_FILL_PERCENT`.

### 2.9 Simulated API (`api.ts`; for steps 33 and 53)

| Operation | Success | Errors |
|---|---|---|
| `POST /api/v1/session` | 201 `{sessionId, state, created:true}`; 200 with `created:false` for the same body | 401, 403, 409 SESSION_ACTIVE, 422 |
| `POST /api/v1/session/{id}/start` | CREATE → 202 `{state:'PRECHECK'}`; ARMED → 200 `{state:'RECORDING'}`; WARN + `{acknowledgeWarnings:true}` → 200 | 404, 409 PRECHECK_RUNNING / PRECHECK_BLOCKED / PRECHECK_WARNINGS / INVALID_STATE |
| `POST /api/v1/session/{id}/stop` | 202 `{state:'STOPPING'}` | 404, 409, 422 |
| `GET /session/current` | `{session: ApiSession \| null, serverTime}` | — |
| `GET /device/health` | `ApiDeviceHealth` | — |
| `GET /audio/status` | `{channels}` | — |
| `GET /video/status` | `{tracks}` | — |
| `GET /storage/status` | `ApiStorageStatus` | — |
| `POST /evidence/{id}/export` | 202 `{exportId, evidenceId, status:'EXPORTED'}` | 401, 403, 404, 409 NOT_SEALED / SECURITY_FAULT, 422 |

**Common rules:**
- Headers are always `x-dems-simulated: 1` and `content-type: application/json`.
- Errors use `{error:{code, message}}`.
- Times are ISO-8601 at `+07:00`.
- Other paths return 404; `GET /api/v1/health` is LIVE and not simulated. A wrong method returns 405 with `allow`; bad JSON returns 400.
- A full URL with an origin and a query string is accepted.

## 3. Rates and timing (as built)

**Rates:**
- clock 100 ms;
- audio 20 frames/s per channel, one per 50 ms slot;
- health 1 Hz;
- recording integrity rows: Poisson, mean 8 s;
- AUTOSAVE timeline item and event: at most 1 per minute;
- CHECK: every 2 min; HEALTH: every 5 min;
- idle events: 1 per 60 s, starting 60 s after the first tick.

**Audio model:**
- Speech plays only while people are in the room (CREATE … STOPPING). With no session, both channels sit at the −52 ± 2 floor.
- An AUDIO_PEAK near −3.1 dBFS comes every 90-180 s while recording.

**Measured** (Node, `node --import tsx`, 1,200 ticks):

| Scenario | Per tick | Snapshot | `JSON.stringify` |
|---|---|---|---|
| idle | 0.008 ms | 88.7 KB | 0.29 ms |
| recording | 0.006 ms | 166.6 KB | 0.48 ms |

## 4. Verification (fresh, 2026-10-01 03:31-03:32 WIB)

| Row-32 check | Command | Result |
|---|---|---|
| `npm test -w @dems/shared` exits 0 with the seven files passing (AC-51..AC-55, SCR-01, SCR-02) | `npm test -w @dems/shared -- --maxWorkers=2` (plus `--reporter=verbose` for the counts) | exit 0; `Test Files 20 passed (20)`, `Tests 347 passed (347)`. sim-determinism 8/8, session-machine 27/27, audio 14/14, storage-math 9/9, hash-chain 14/14, sim-platform-neutral 8/8, sim-mobile-additions 9/9. Extras: sim-api 12/12, sim-faults-scenarios 34/34, sim-contract 26/26, sim-store 16/16, auth 14/14 |
| sim-platform-neutral runs in Node with no `document` or `sessionStorage` | same run | The test stubs `sessionStorage` and `localStorage` to `undefined` and asserts that `document`, `window`, `sessionStorage` and `localStorage` are all undefined. It then runs a full session on an AsyncStorage-like storage, an AppState-like visibility adapter and its own scheduler (hydration gate, background pause, catch-up, relaunch resume). A static scan shows only `platform.ts` names web globals; the positive control matched |
| Shared typecheck exits 0 | `npm run typecheck -w @dems/shared` | exit 0 |

**Extra checks:**

| Check | Result |
|---|---|
| `npm run lint -w @dems/shared`; `oxlint --format default src test` | exit 0; "Found 0 warnings and 0 errors" |
| Consumer-strict flags: `tsc -p packages/shared --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch` | exit 0 |
| `src/sim/index.ts` under core-web settings (DOM lib, bundler, strict, unused checks) | exit 0 |
| The same under Expo `tsconfig.base` (`customConditions: ["react-native"]`, `module: preserve`) | exit 0 |
| `/usr/bin/grep -rnwE "document\|window\|sessionStorage\|localStorage\|navigator" packages/shared/src/sim` | the same 4 guarded `platform.ts` lines as step 31 (34, 35, 41, 52) |
| `grep -rnE "randomUUID\|crypto\.\|Math\.random" packages/shared/src/sim` | exit 1 (none) |
| `grep -n sim packages/shared/src/index.ts` | exit 1 (the root barrel does not re-export the sim) |
| core-web: `npm run typecheck` (tsc -b); `vitest run` (includes the step-38 `routes.test.tsx`, which now runs the real engine behind `SimProvider`) | exit 0; 6 files, 64/64 |
| mock-core typecheck | exit 0 |
| mobile: `jest` | 18 suites, 210/210 |
| mobile typecheck | exit 2, 4 errors, only in `src/navigation/{app-tabs,back-guard,master-detail}` and `src/components/composed/nav/live-mini-bar.tsx`. These are concurrent mobile steps' files (P11), and mobile imports nothing from the sim yet |
| Cross-check with step 33 (in progress, read-only): each of 15 `sim.request` responses validated with step 33's `validateCoreApiResponse` (scratch script, 03:30 WIB). Covers 200, 201, 202, 403, 404, 409 and 422 | 15/15 OK |

## 5. Decisions, drift and findings

| ID | Kind | Item |
|---|---|---|
| **S32-1** | decision (D54 b) | Shifting the six step-31 items cannot reach "about 7": only 5 can be sealed, and sessions 0011–0016 must precede the recording session. Instead, 7 follow-up sessions sealed today were added (EV 0007–0013, SES 0017–0023) and the six step-31 items are kept byte-stable, because steps 92 and 93 join on them. Consequences: the recording scenario becomes **session 0024** (case 0007 unchanged); idle counters are 24 / 8 / 14; the Evidence list has 13 rows, so page 2 exists at 10 per page. This matches the mockup's "7 sealed today • 1 pending" exactly |
| S32-2 | decision | Today's schedule depends on `now` alone. The boot moved before the first session; `pairedAt` is 4 min after the boot; `lastSyncAt` is 12 s before load; the 24 h usage curve steps at the real session ends |
| S32-3 | decision | Timed transitions happen at their scheduled time. Audit and event rows are clamped to be monotonic (`recordActivity`) |
| S32-4 | drift (additive) | STOPPING is added to the states a critical fault moves to FAULT. The §14.7 table lists four states; a power fail during the 1.5 s stop must not be lost |
| S32-5 | decision | Precheck: the Core check follows `tabletLink` (MA-10). An enclosure tamper warns on SECURITY. The durations are budgeted to ≤ 4.9 s in total while each check stays 300-700 ms, because AC-62 says "within 5 s" and 8 × 700 would be 5.6 s |
| S32-6 | drift (additive) | `createSession` is idempotent for the same input while **any** non-SEALED session exists; the spec comment says "while CREATE". This is the §5.6 "resync never creates a second session" behaviour. A different input is still refused (AC-52) |
| S32-7 | decision | A SEALED session stays in `session` until the next `createSession`, which implicitly acknowledges a pending summary |
| S32-8 | decision | Adopts S31-7: a recovered session that had recorded keeps a RECORDED, unsealed evidence item. A pre-recording fault produces only a history entry (`evidenceId: null`) |
| S32-9 | decision | `recover()` after POWER_FAIL writes SYSTEM_BOOT, then RECOVERY_STARTED, and clears POWER_FAIL (the reboot restores power) |
| S32-10 | drift (additive) | Fault targets: GNSS `fallback` NTP or RTC (the only route to the RTC WARN); TAMPER with `evidenceId` is the EVT-13/14 hook. Defaults and idempotency are as in §2.5 |
| S32-11 | decision | Fault rows carry the `evt` and the book `eventKind` (AC-65 "audit AUDIO_CLIP" without a new AuditType, so step 34's i18n keys stay complete). A CAMERA_LOSS alert is CRITICAL, matching the GlowRing flags |
| S32-12 | drift (additive) | `ExportResult` 409 `SECURITY_FAULT`: a TPM or security fault blocks export (FMEA §23.1). The export reason needs at least 5 characters |
| S32-13 | decision | Archive needs EVIDENCE_REVIEW (SUPERVISOR); otherwise it throws `SimPermissionError` |
| S32-14 | decision | API contract as in §2.9. Step 33's schemas already match (15/15) |
| S32-15 | decision | The CLIP latch sets at inject (AC-65 unit form needs no tick). `frame.clip` shows the latch |
| S32-16 | decision | While STORAGE_LOW is active, a transition re-derives the fill so usage shows `max(86%, real)`. Clearing always restores the real usage exactly |
| S32-17 | decision | Every type change is optional; the snapshot stays version 1. No real v1 snapshot exists yet (steps 38 and 73 had not persisted one), and old snapshots are tolerated |
| S32-18 | decision | New errors `SimNotFoundError` and `SimPermissionError`. `SimNotImplementedError` stays exported but is no longer thrown |
| S32-19 | decision | The recording integrity stream writes audit rows only. Operational events come only with AUTOSAVE (≤ 1 per minute), so Recent Events stays readable |
| S32-20 | decision | A precheck ending in WARN writes no event; PRECHECK_PASSED is written on acknowledgement. The first draft emitted a misleading "passed" event; it was fixed |
| S32-21 | decision | At stop and at a fault the evidence volume takes the bytes the 1 Hz tick had not counted, so volume growth equals the evidence size exactly (tested) |
| **S32-D1** | drift (test file) | `test/sim-contract.test.ts` (step 31's file) was updated in 4 tests: 13 items, 13 history entries, counters 24/8/14, 7 sealed today, and the stub test replaced by an "every action implemented" test. The step-32 changes altered exactly what those tests pinned |
| S32-D2 | drift (files) | Additional files beyond the §14.7 list: `derive.ts`, `generator.ts` (the generator stays out of the pure `events.ts`), `maintenance.ts`, `evidence-actions.ts` (avoids an `evidence → auth → dataset → evidence` cycle), `pairing.ts`. There are also two extra test files |
| **F-32-1** | finding (steps 92, 93, 47, 53) | Steps 92 and 93 generate "for each step-31 dataset session", which covers EV 0001–0006 / SES 0011–0016, unchanged. **The 7 new items (EV 0007–0013) have no media or package** unless those steps include them; consumers then fall back (procedural feed, no package). Join by the evidence suffix. The recording scenario's live-feed loop must be keyed by `RECORDING_SCENARIO.sessionSeq` (**24**), not a literal 17. The controller should relay this to step 92 now |
| F-32-2 | finding (P11) | Mobile typecheck fails only in concurrent mobile files (see §4); re-run after steps 69–71 land. core-web typecheck is back to 0 (its `components/ui/*` errors cleared during the run) |
| F-32-3 | finding (step 73) | The mobile stub fixture `providers/runtime-contract.test.tsx` uses `SES-20261001-0017`. It is a local literal with no sim dependency; step 73 should take IDs from the sim. Consider `persistThrottleMs` 2000-5000 on AsyncStorage if snapshot writes cause jank (hypothesis H-32-2; the snapshot is 89-167 KB now, about 600 KB with a full audit ring) |
| F-32-4 | finding (step 33) | Step 33 imports `EXPORT_REASON_MIN_LENGTH` and `STOP_REASON_MIN_LENGTH` from `sim/constants` and mirrors the `isValidSessionInput` bounds (64 / 120 / 80 / 2000). Steps 54 and 91 must keep these stable |
| H-32-1 | hypothesis | A demo before about 02:50 WIB shows fewer than 7 sealed today, because the oldest slots fall on the previous day. This is documented, not tested |

**Blockers: none.**
- No `npm install`; no `package.json` or lockfile change.
- No process started; nothing committed.
- Only P6 paths were written: `src/sim/**`, the seven row-32 tests plus two extra test files, the updated `sim-contract.test.ts`, and this report and the progress file.
