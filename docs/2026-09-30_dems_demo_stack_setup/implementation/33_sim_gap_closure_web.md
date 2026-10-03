---
task_id: 2026-09-30_dems_demo_stack_setup
step: 54
plan_row: 02_plan §4.1 W-02b (blueprint row 54; REQUIRED per D74; started before step 53 per D93)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
decisions: D52, D62, D67, D74, D79, D84, D93, D96, D101, D108, D109, D112
---

# Step 54: simulator gap closure (web)

**Outcome: COMPLETE.** The simulator (`packages/shared/src/sim`) now provides every web page SIM-GAP
as a selector or action; the web page adapters re-export or call it; `grep -rn SIM-GAP- apps/core-web/src`
finds nothing. Deferred items (below) become known issues for step 91.

## 1. Gates (fresh, 2026-10-01 WIB)

| Check | Command | Result |
|---|---|---|
| Shared typecheck | `npx tsc --noEmit -p packages/shared` | exit 0, no output |
| Shared lint | `npx oxlint` (packages/shared) | exit 0 |
| Shared tests | `npx vitest run --maxWorkers=2` (packages/shared) | **28 files, 508 tests passed** (baseline 23 / 393) |
| Core-web typecheck | `npx tsc -b` (apps/core-web) | exit 0, no output |
| Core-web lint | `npx oxlint -f json` | 0 diagnostics, exit 0 |
| Core-web tests | `npx vitest run --maxWorkers=2` (apps/core-web) | **39 files, 438 tests passed**, exit 0 (§6) |
| Mobile typecheck | `npx tsc --noEmit` (apps/mobile) | exit 0, no output (mobile files not edited) |
| OpenAPI | `node --import tsx scripts/gen-openapi.ts` | wrote openapi/openapi.json (10 operations, 95 021 bytes); drift test green |
| Marker grep | `grep -rn SIM-GAP- apps/core-web/src` | no output |
| i18n sync mutation check | delete `common.auditType.SYSTEM_BOOT` in a backup-restored copy | 1 failed (`common.auditType.SYSTEM_BOOT must be a non-empty string`); restored (`cmp` equal) → 34/34 passed |

Determinism holds: seed 20261001; Sealed Today = 7 (`sim-contract.test.ts`); the recording scenario is
session 0024 and seals into evidence 0014 (`sim-demo-data-alignment.test.ts`). AC-51 streams are
untouched: the new per-second variance and the load back-fill use `timeNoise` (FNV hash of the time),
not an RNG stream.

## 2. Closed gaps (simulator file:line → web adoption)

### Review 40 / foundation (scope A)

| Gap | Simulator evidence | Web / tests |
|---|---|---|
| **M1** stable `selectSystemState`, `selectSystemStateValue`, `selectSystemFlagIds`, `SYSTEM_FLAG_IDS`, flag `params` | `sim/selectors.ts:385` (single-entry memo + structural sharing via `sim/memo.ts:42`), `:395`, `:317`; flag params `:296` | dashboard adapter re-exports; `test/sim-selector-stability.test.ts` (every arity-1 `select*` shallow-stable on idle/recording/fault-demo; clock and 1 Hz ticks keep the same object) |
| **D96** warnings visible during RECORDING | `SystemStatusDetail.severity`, `selectSystemSeverity` `sim/selectors.ts:392` (`SystemStatus` type unchanged for mobile) | `components/shell/integrity-checks.ts` (hand-over): pill = severity → recording + warning = ATTENTION, + critical = CRITICAL; `src/test/integrity-checks.test.ts` (7 tests) |
| **m5** POWER_FAIL checklist agrees with the ring | `selectIntegrityChecklist` `sim/selectors.ts:457`, `FLAG_CHECKLIST_ROW` (every flag → one row; POWER_FAIL → recording) | shell `selectIntegrityChecks` delegates; per-fault agreement test in `sim-selector-stability.test.ts` |
| **M3 / SIM-GAP-W1** Ed25519 keys, EV 0005 tampered on AUDIO-02, package hashes | `sim/demo-alignment.ts:60` (7 KB constant table; no demo-data import), `:250`; `sim/evidence.ts:150` `buildItemIntegrity`, `:304` package-backed verify, `:349` restore keeps the seeded tamper; `sim/dataset.ts:577` (EV 0005), `:96` cert fingerprint; `sim/initial-state.ts:327,336` keys | `test/sim-demo-data-alignment.test.ts` (12 tests: table rebuilt from the index = P13 guard, 13 DATASET items, verify FAIL on AUDIO-02 with the altered copy's hash, keys, recording scenario seals 0014 as DEMO_PACKAGE, presenter session stays SIMULATED, src/sim never imports demo-data) |
| **M5** session RBAC + actor | `sim/auth.ts:78` `requirePermission`; `sim/session-machine.ts:125` `requireSessionOperator` (beginPrecheck, acknowledge, retry, start, stop, cancel); engine-armed PASS names the creator with `details.by = 'system'` | `test/sim-api-validation.test.ts` (signed-out 401 / TECHNICIAN 403 / SUPERVISOR stop is the actor) |
| **M6 / D62** schema in createSession + API | `sim/session-machine.ts:216` `validateSessionInput`, `:354` order auth → schema → idempotency; `sim/api.ts:354` `sessionAccess`, 422 `'<path>: <i18n key>'` | `sim-api-validation.test.ts` (ABC → 422 `caseNumber: sessionNew.info.caseNumber.invalid`; API demands `room`, the action keeps its default) |
| **m8** machine-readable error codes | `sim/errors.ts:10` `SimErrorCode`, `:117` `simErrorCode`; every class carries `code` (constructors backward compatible) | `sim-gap-closure.test.ts` "machine-readable error codes" |
| **m6 / W53-1, W53-2** `sim.request` never throws; any method | `sim/api.ts:502` (whole handler in try; URIError → 400 INVALID_PATH; `SimApiRequest.method` admits every method → 405 / 404) | api-reference adapter reduced to a try/catch over `sim.request`; `test/sim-fetch.test.ts` W53 cases green |
| **m9** 10 Hz churn | `selectElapsedSeconds` `sim/selectors.ts:119`, `selectLockoutSeconds` `:57` | `sim-selector-stability.test.ts` 1 Hz tests |
| **D52** i18n ↔ vocabulary sync | — | `test/i18n-vocabulary-sync.test.ts` (34 tests: 31 pairs incl. `networkTime.domains.state`, `…avSync.state`, `storage.volumes.smart`, `shell.securePill.checks`; DeviceCommand and PrecheckReasonCode through explicit camelCase maps) |
| **W44-2, W46-2, m4** codes/params next to EN text | `TimelineEvent.params` (all producers), `PrecheckItem.reasonCode/params` (`session-machine.ts:467` …), `SimAlert.params` (`faults.ts:170`), `DiagnosticCheck.params` (`maintenance.ts`) | session-monitor adapter reads params (label fallback); session-new `REASON_KEY_BY_CODE` |
| **D101** 401/403 documented on start/stop | `api/core-api.ts` start/stop responses + `rbac`; `api/examples.ts` 401/403 examples; openapi.json regenerated | `test/openapi.test.ts` coverage flow extended (signed-out 401, TECHNICIAN 403 on start and stop) |

### Demo-day robustness (scope B, D84 / F-47-1)

| Gap | Evidence | Adoption |
|---|---|---|
| shared join on case SEQUENCE + subject + session suffix | `demo-data/join.ts:43` `matchDemoPackage`, `demoCaseSequence`; lookups moved to `demo-data/lookup.ts` so join imports concrete modules (D108: no index ↔ join require cycle) | evidence `model.ts` `joinDemoPackage`, security-audit `guardedPackageOf`, session-monitor `finalization-modal.tsx`; dashboard reads the simulator's aligned digest (no lazy demo-data import); test "joins on another calendar day" |

### Page SIM-GAPs (scope C)

| Gap | Simulator evidence | Web adoption |
|---|---|---|
| W42-1 / W42-2 | `selectSystemState`; item `manifestHash` + `integritySource` | `dashboard/sim-adapter.ts` |
| W43-1 / W52-5 presentation slice | `SettingsSlice` `types.ts`, `actions.setPresentationMode`, `selectPresentationMode` `selectors.ts:533` | login + system adapters read either the slice or `lib/presentation-mode` and write both |
| W43-2 last sign-out | `selectLastSignOut` `selectors.ts:78` (event ring, memoised) | `login/sim-adapter.ts` `readLastAuthEvent` |
| W44-1 write-rate history | `storage.writeRateHistory` (`health.ts:45` measured ±3 %, back-filled) `selectWriteRateHistory` | `session-monitor/sim-adapter.ts` (5 s sampling, ≤ 0.2 Hz re-render) |
| W46-1 / M78-1 next case number | `selectNextCaseNumber` `selectors.ts:136`; `actions.scanCaseNumber` `session-machine.ts:399` (reserves); create advances the counter | `session-new/sim-adapter.ts` |
| W47-1 | see M3 | evidence adapter mirror is now a no-op for EV 0005 |
| W47-2 case type | `EvidenceItem.caseType` | evidence table filter reads `caseType` |
| W47-3 markers/notes on stored evidence | `EvidenceItem.markers/notes` (`session-machine.ts:810`) | data only; UI follow-up deferred (§3) |
| W47-4 export counter | `nextExportId` `evidence-actions.ts:40` (EXP-000032 onwards); dataset row carries EXP-000031 (`dataset.ts:740`) | evidence comments; alignment test |
| W48-1 PoE 2 ports (D79) | `derive.ts:199,243`; `poe.poweredPorts/sparePorts`; `poeStatus` `devices.ts:37` | `devices/sim-adapter.ts` `bookPoe` |
| W48-2 GNSS + TPM devices | `platformDevices` `devices.ts:80`; IDENTIFY accepted | devices adapter |
| W48-3 front panel | `frontPanelLeds`, `frontPanel` `devices.ts:167` | devices adapter re-exports |
| W48-4 per-device health history | `deviceHealthSeries` `devices.ts:267`; `health.micLevels` (`health.ts:157`) | `healthSeries` delegates |
| W48-5 Identify + audit row | `deviceCommandTransition` `maintenance.ts:197` (IDENTIFY → DEVICE_COMMAND) | `devices/index.tsx` calls `deviceCommand(id, 'IDENTIFY')` |
| W49-1 per-drive SMART data | `driveHealth` `views.ts:206` | storage adapter re-exports |
| W49-2 storage activity | `selectStorageActivity` `selectors.ts:555` | storage adapter re-exports |
| F-49-1 storage policy RBAC | `maintenance.ts:293` (EVIDENCE_REVIEW or MAINTENANCE) | manage drawer disables Apply with "Requires the Supervisor / Technician role" |
| F-49-2 no fill spike | `health.ts:103` natural bytes | `sim-gap-closure.test.ts` |
| W50-1..4 | `domainState` `views.ts:102`, `selectAvSync` `:147`, `eventCategory` `:26`, `selectNetworkTimeEvents` `:74`; `backfillSeries` `initial-state.ts:106` | network-time adapter re-exports |
| W51-1 `exportAudit(request)` | `exportAuditTransition` `evidence-actions.ts:234` (422, details.reason) | security-audit `exportAuditWithReason` passes through |
| W52-1 uptime | `ServiceEntry.startedAt` (`initial-state.ts:360`; restart, update reboot, power-fail reboot), `selectServicesSince` `views.ts:252` | system adapter |
| W52-2 settings slice | `actions.updateSettings` `actions.ts:92` | `useConsolePrefs` (slice + localStorage mirror) |
| W52-3 restart services | `restartServicesTransition` `maintenance.ts:251` | `restartCoreServices` calls the action (direct audit write removed) |
| W52-4 release/SBOM | `releaseInfo` `views.ts:275` | re-exported |
| W52-6 RBAC | runDiagnostics `maintenance.ts:116`, update `:336`, storage policy, device commands; Demo Control Panel actions stay open to every role | page keeps its gates and `SimPermissionError` toasts |
| W52-7 export logs | `exportLogs` `actions.ts:174`, `logBundle` `views.ts:313` | Maintenance panel calls `exportLogs()` |
| W52-8 reset | `resetDemo` `actions.ts:183` (`details.reset`) | Demo panel reset |
| M80-1 time source on history | `startTimeSource/stopTimeSource` `session-machine.ts:657,705,925`; history + evidence entries | mobile adoption in step 91 |
| M83-1 | EV 0005 seeded tampered | mobile guard now agrees; adoption step 91 |

### Scope D

| Item | Evidence |
|---|---|
| BorderBeam on /stack-check registered with the ambient registry, unmounted under reduced motion | `apps/core-web/src/features/home/home-page.tsx` `StackCheckBeam` (`useAmbientLoop('stack-check-border-beam')`) |
| "Stop Session" comment | `packages/shared/src/tokens/tokens.ts:62` → "End Session" |

## 3. Deferred to step 91 (known issues)

| Item | Reason |
|---|---|
| W49-1 **HDD SMART fault kind** | A new `FaultKind` widens every `Record<FaultKind, …>` (web demo panel, mobile maps) and needs `common.faultKind` / `system.demo.faults` labels (i18n not in step 54's write set). The per-drive SMART data is in the sim |
| W47-3 **UI** for markers/notes (scrub-bar ticks, Metadata notes list) | Data is in `EvidenceItem.markers/notes`; rendering needs new i18n keys and page UI |
| `SYSTEM_FLAG_IDS` i18n namespace | No shared i18n map exists (mobile keeps `features.dashboard.flags`); needs a `common.systemFlag` hand-over |
| Mobile adoption of every new API (incl. removing the mobile regex flag parser `home-model.ts:100-102`) | Step 54 does not edit mobile (P6) |
| Step 53's own gaps beyond W53-1..4 | D93 |

## 4. API changes for step 91 (all backwards compatible; mobile typecheck green)

- **New optional fields:** `SystemFlag.params`; `TimelineEvent.params`; `PrecheckItem.reasonCode/params`;
  `SimAlert.params`; `DiagnosticCheck.params`; `EvidenceItem.caseType/markers/notes/integritySource/startTimeSource/endTimeSource`;
  `SessionHistoryEntry.startTimeSource/endTimeSource`; `ActiveSession.startTimeSource/stopTimeSource`;
  `ServiceEntry.startedAt`; `HealthSlice.micLevels`; `StorageSlice.writeRateHistory`; `network.poe.poweredPorts/sparePorts`;
  `PortStatus.spare`; `KeyRecord.demo/keyId`; `SimCounters.export`.
- **New slice:** `SimState.settings` (persisted; a stored snapshot without it still resumes: `store.ts:62`).
- **New actions:** `scanCaseNumber`, `exportLogs`, `resetDemo`, `restartServices`, `setPresentationMode`,
  `updateSettings`; `exportAudit(request?)` (optional reason); `DeviceCommand.IDENTIFY`.
- **RBAC now enforced (throws `SimPermissionError`):** beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck,
  startRecording, stopRecording, cancel, scanCaseNumber (SESSION_START); runDiagnostics and TEST_SIGNAL/IDENTIFY
  (DIAGNOSTICS_RUN); RESTART (DEVICE_MANAGE, refused while recording); startSoftwareUpdate and restartServices
  (MAINTENANCE); setStoragePolicy (EVIDENCE_REVIEW or MAINTENANCE). Demo Control Panel actions (inject, clearFault,
  loadScenario, resetDemo, resetClip) stay open.
- **Data changes:** dataset items carry the package hashes (`integritySource: 'DEMO_PACKAGE'`); EV 0005 tampered on
  AUDIO-02 at load; keys Ed25519; PoE 2 ports (`activePorts` = healthy ports: 2/2 at load, 1/2 with both lenses lost);
  POE-SWITCH status "2/2 Ports Active"; series back-filled at load; export IDs EXP-000032 onwards.
- **New selectors/views:** `selectSystemSeverity`, `selectSystemFlagIds`, `selectIntegrityChecklist`,
  `selectElapsedSeconds`, `selectLockoutSeconds`, `selectLastSignOut`, `selectNextCaseNumber`, `selectWriteRateHistory`,
  `selectPresentationMode`, `selectSettings`, `selectStorageActivity`, `selectPoeStatus`, `selectPlatformDevices`,
  `selectFrontPanel`, `deviceHealthSeries`, `selectDriveHealth`, `selectDomainStates`, `selectAvSync`, `eventCategory`,
  `selectNetworkTimeEvents`, `selectServicesSince`, `selectReleaseInfo`, `logBundle`, `matchDemoPackage` (demo-data).
- **Mobile tests expected to need step-91 updates** (not run here; mobile is typecheck-only): calls of session
  commands, `deviceCommand`, `runDiagnostics`, `setStoragePolicy` without a permitted sign-in
  (e.g. `session-live/back-guard.test.tsx`, `session-new/precheck.test.tsx`, `devices/devices-model.test.ts`), and
  pinned PoE values (`devices-model.test.ts:39` expects 4 ports).

## 5. Files

**Simulator (sole writer):** `packages/shared/src/sim/{errors,vocabulary,types,store,demo-alignment,memo,devices,views,evidence,dataset,initial-state,derive,health,auth,session-machine,generator,scenarios,audio,faults,maintenance,evidence-actions,actions,api,index,selectors}.ts`
(new: `demo-alignment.ts`, `memo.ts`, `devices.ts`, `views.ts`).
**Demo-data (hand-over):** new `demo-data/join.ts`, `demo-data/lookup.ts`; `demo-data/index.ts` re-exports.
**API (D101 hand-over):** `api/core-api.ts`, `api/examples.ts`, `openapi/openapi.json` (regenerated).
**Tokens:** `tokens/tokens.ts:62` comment.
**Shared tests:** new `test/{sim-demo-data-alignment,sim-api-validation,i18n-vocabulary-sync,sim-selector-stability,sim-gap-closure}.test.ts`;
updated `test/{audio,storage-math,sim-contract,sim-faults-scenarios,openapi}.test.ts` (sign-in for RBAC, PoE 2 ports,
package hashes, `severity`).
**Core-web:** `features/*/sim-adapter.ts` (dashboard, login, session-monitor, session-new, evidence, devices, storage,
network-time, security-audit, system, api-reference); direct call sites `dashboard/{active-session,system-ring}-panel.tsx`
(comments), `session-monitor/{timeline-panel,finalization-modal}.tsx`, `session-new/{model,devices-step}.ts(x)`,
`evidence/{model,use-evidence-table,toolbar,media-tab,metadata-tab,use-verification,export-download}.ts(x)`,
`devices/{index,device-menu,…}.tsx` (comments), `storage/{manage-drawer,volumes-panel,activity-panel}.tsx`,
`network-time/{offset-panel,domains-panel,events-panel,system-time-panel}.tsx` (comments),
`security-audit/{keys-panel,audit-log-panel,export-audit-dialog}.tsx` (comments), `system/{settings-panel,demo-panel,diagnostics,about-panel,services-panel}.tsx`,
`login/use-login-controller.ts` (comment), `lib/presentation-mode.ts` (comment), `components/shell/integrity-checks.ts` (D96 hand-over),
`features/home/home-page.tsx` (stack-check beam).
**Core-web tests:** new `src/test/integrity-checks.test.ts`; updated page tests per D109 (`evidence-integrity`, `devices-page`,
`network-time-page`, `storage-page`) plus titles/assertions in `system-model`, `session-monitor`, `security-audit`,
`network-time-model`, `storage-model`, `session-new*`, `login-model`, `sim-fetch`.

## 6. Core-web final run and the mobile spot check

- `cd apps/core-web && npx vitest run --maxWorkers=2` → **Test Files 39 passed (39), Tests 438 passed (438)**,
  Duration 60.08 s, exit 0 (after every adapter, page-test and shell edit; includes the 4 D109 page tests and the new
  `src/test/integrity-checks.test.ts`). The first run after the simulator change (before the adapter edits) had the
  5 expected failures D109 lists; each was fixed by asserting the new behaviour, never by weakening it.
- Mobile spot check (not required; mobile is typecheck-only): `npx jest src/features/evidence/{evidence-model,play-sheet,evidence-detail}.test.*`
  → 32 passed, **1 failed as expected**: `evidence-detail.test.tsx` "shows FAIL on AUDIO-02 for the tampered item (EV 0005)
  and writes no contradicting audit row" pinned the M83-1 gap (the guard used to write nothing because the sim
  disagreed). Now the sim agrees and the guard records EVIDENCE_VERIFY_FAILED, exactly the M83-1 fix ("the guard then
  records it unchanged"): step 91 updates that assertion. No Metro/jest require-cycle warning from demo-data (D108).
