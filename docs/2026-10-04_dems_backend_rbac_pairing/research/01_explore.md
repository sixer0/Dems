---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: explore
step: 1 (blueprint row 1, FIRM)
scope: packages/shared/src/sim/ (33 files, read-only). Supporting reads for purity and Node use only - packages/shared/package.json, packages/shared/test/sim-platform-neutral.test.ts, packages/shared/test/i18n-vocabulary-sync.test.ts, packages/shared/scripts/gen-demo-evidence.ts, packages/shared/src/domain/, packages/shared/src/api/session-schema.ts
narrative_tier: 2
graft: used (CLI 0.18.0) - skeleton, callers, ask
web_calls: 0
files_modified_outside_docs: 0 tracked files (the Graft CLI may refresh its own git-ignored cache under graft/)
---

# Project Exploration Report: the shared simulator `packages/shared/src/sim/`

## 1. Overview

**What was explored.** The in-app simulator that both clients run today (`@dems/shared/sim`, exported through `packages/shared/package.json:12`). It was read-only inventoried for the backend specification (blueprint rows 14-17): every `SimActions` member, every exported selector, view and derive function, the engine subsystems and their rates, the error codes, the snapshot keys, the audit and event vocabulary, and the purity of each module.

**Why it matters for this task.** A backend will become the source of truth that replaces the in-app simulator. Row 15 must map every `SimActions` member to a server operation or to a recorded exclusion, and rows 16-17 need the slice list, the audit vocabulary, the engine rates and the purity map. This report states what exists; it designs nothing.

**Headline numbers (each re-derived mechanically, section 2).**

| Item | Count | Anchor |
|---|--:|---|
| Files in `src/sim/` | 33 | listing, V11 |
| `SimActions` members | **42** | `packages/shared/src/sim/types.ts:985-1094` |
| `createActions` entries (the only implementation) | **42** | `packages/shared/src/sim/actions.ts:129-236` |
| Actions that return a value synchronously / return void | 14 / 28 | `types.ts:988-1093` |
| Actions that name an audit type / write no audit row | 32 / 10 | section 6 |
| Actions with a permission check (thrown / returned) / without | 17 (13 / 4) / 25 | section 6 |
| Exports of `selectors.ts` / `views.ts` / `derive.ts` | **89 / 26 / 11** | `grep -cE '^export '` (V3) |
| Exports of `devices.ts` (outside the three-file count, re-exported by `index.ts:24`) | 24 | V3 |
| `SimState` slices / persisted snapshot keys | 33 / 30 | `types.ts:849-884`; `store.ts:24-55` |
| Engine subsystems | 7 | `engine.ts:152-162` |
| `AuditType` / `SimEventType` members | 44 / 46 | `vocabulary.ts:291-343`, `:395-442` |
| `SimErrorCode` members / distinct simulated-REST error codes | 15 / 17 | `errors.ts:10-41`; `api.ts` (section 12) |
| Roles / permissions | 3 / 9 | `vocabulary.ts:16-34` |

**Legend used in the tables.**

- `A3` = the three slices `audit`, `events`, `meta` that every activity append returns together (`events.ts:252`, `:258-279`; the event counter lives in `meta.counters.event`, `types.ts:168-185`). A slice that did not change keeps its reference.
- `D10` = the ten slices `deriveDeviceState` recomputes: `cameras, mics, network, ports, otherDevices, health, storage, time, security, services` (`derive.ts:217-311`, key list `:299-310`).
- `[W]` = the write goes through `withSession` (`session-machine.ts:143-145`): the `session` slice changes and `D10` is recomputed; `D10` slices change only when their inputs changed.
- "Throws" = the action throws a `Sim*Error`; "returns" = the refusal is part of the result type (`actions.ts:7-15`).
- Credential values are never quoted in this report (P19). The constants are cited by name: `DEMO_OPERATOR_PASSWORD` (`dataset.ts:153`), `DEMO_PAIRING_CODE` (`dataset.ts:157`), `SECURITY_KEY_OPERATOR_ID` (`dataset.ts:155`).

## 2. Verification record (commands run, output quoted)

All commands read files only. `d=/Users/gsp-budi/Documents/DEMS/packages/shared/src/sim`.

| ID | Check | Command | Output |
|---|---|---|---|
| V1 | `SimActions` member count | `awk 'NR>=985 && NR<=1094' $d/types.ts \| grep -nE '^  [a-zA-Z]+\(' \| wc -l` | `42` |
| V1b | Member names with their `types.ts` line | `awk 'NR>=985 && NR<=1094 {print NR": "$0}' $d/types.ts \| grep -E '^[0-9]+:   [a-zA-Z]+\('` (names only) | 988 signIn; 990 signInWithBiometric; 992 recordBiometricFailure; 994 signInWithSecurityKey; 995 signOut; 997 touch; 1005 createSession; 1011 beginPrecheck; 1012 acknowledgePrecheckWarnings; 1013 retryPrecheck; 1014 startRecording; 1016 stopRecording; 1018 cancel; 1024 scanCaseNumber; 1026 recover; 1027 addMarker; 1028 addNote; 1029 snapshot; 1031 acknowledgeSummary; 1034 verify; 1035 exportEvidence; 1036 archiveEvidence; 1042 exportAudit; 1048 exportLogs; 1050 verifyAuditChain; 1055 inject; 1056 clearFault; 1057 resetClip; 1058 acknowledgeAlert; 1059 loadScenario; 1061 resetDemo; 1065 runDiagnostics; 1071 deviceCommand; 1073 setStoragePolicy; 1075 startSoftwareUpdate; 1081 restartServices; 1082 setActiveCamera; 1086 setPresentationMode; 1087 updateSettings; 1090 pair; 1091 unpair; 1093 setTabletLink |
| V2 | `createActions` returned entries | `awk 'NR>=129 && NR<=236' $d/actions.ts \| grep -E '^    [a-zA-Z]+:' \| wc -l` | `42` (the same 42 names, `actions.ts:131-209`) |
| V3 | Export counts | `grep -cE '^export ' $d/selectors.ts` / `views.ts` / `derive.ts` / `devices.ts` | `89` / `26` / `11` / `24` |
| V4 | Export classification | per file: counts of `^export (const\|function) select*`, `interface`, `type`, other `const`, other `function` | selectors.ts: total=89 selectors=67 interfaces=8 types=4 other_consts=4 other_functions=6 sum=89; views.ts: total=26 selectors=7 interfaces=4 types=2 other_consts=4 other_functions=9 sum=26; derive.ts: total=11 selectors=0 interfaces=0 types=0 other_consts=6 other_functions=5 sum=11 |
| V5 | Table row counts in this report | rows numbered 1..N in sections 6, 8, 9 | actions 42; slices 33; selectors.ts 89; views.ts 26; derive.ts 11 (126 rows in section 9.1-9.3); devices.ts 24 |
| V6 | State and snapshot keys | `awk 'NR>=850 && NR<=883' $d/types.ts \| grep -cE '^  [a-zA-Z]+:'`; `awk 'NR>=25 && NR<=54' $d/store.ts \| grep -cE "^  '[a-zA-Z]+',"` | `33`; `30` (excluded: `audio`, `clock`, `auth`, `store.ts:74`) |
| V7 | Subsystems built by `createSubsystems` | `awk 'NR>=153 && NR<=161' $d/engine.ts \| grep -cE 'Subsystem\('`; `grep -nE "name: '" ...` | `7`: clock (`engine.ts:110`), auth-idle (`:125`), session-machine (`:138`), health (`health.ts:181`), generator (`generator.ts:177`), audio (`audio.ts:160`), maintenance (`maintenance.ts:446`) |
| V8 | Vocabulary sizes | `awk` over `vocabulary.ts` ranges; `errors.ts:10-41` | AuditType 44; SimEventType 46; AUDIT_TYPE_CATEGORY 44; SIM_EVENT_CATEGORY 46; Permission 9; OperatorRole 3; FaultKind 12; SimErrorCode 15; AuditCategory 8 |
| V9 | Permission call sites | `grep -nE "requirePermission\(\|requireSessionOperator\(\|roleHas\("` and `grep -nE "Permission\.[A-Z_]+"` over `src/sim` | action-level checks only at `maintenance.ts:116,206-207,252,293,336`; `evidence-actions.ts:124,195,244`; `session-machine.ts:126,362,400,521,528,629,651,687,726`; also `session-machine.ts:238` (the named investigator must hold SESSION_START), `api.ts:357` (REST pre-check) and `selectors.ts:50` (`selectCan`). `Permission.SESSION_NOTE` and `Permission.EVIDENCE_VIEW` appear only in `auth.ts:48-49,62` (the role table) |
| V10 | Throw sites | `grep -nE "throw new [A-Za-z]+" $d/*.ts` | 25 sites, listed in section 12 |
| V11 | Import scan | `grep -oE "from '[^']+'" $d/*.ts` per file; `ls $d/*.ts \| wc -l` | 33 files; the only imports outside `./` are `../domain`, `../api/session-schema`, `@noble/hashes/*`, `zustand*`, `react` (section 15) |
| V12 | Callers (Graft) | `graft callers` for `createActions`, `createSim`, `handleSimApiRequest`, `requirePermission`, `deriveDeviceState`, `tickMachine`, `loadScenarioState`, `createIdleState`, `appendAudit`, `appendAuditMany`, `verifyAuditChain`, `buildScenarioState`, `appendActivity`, `recordActivity` | results quoted in the findings |
| V13 | Web tool calls | none issued | `0` |

## 3. Method: graph versus direct inspection

- **From the Graft graph (CLI 0.18.0, repo indexed under `/Users/gsp-budi/Documents/DEMS/graft/`, git-ignored by `.gitignore:2`):** `graft skeleton packages/shared/src/sim/actions.ts`; `graft callers` for the 14 symbols in V12; one `graft ask "where is the audit hash chain appended and verified" --in packages/shared/src/sim/`. These gave the call topology (findings F2, F10, F18, F19, F22).
- **From direct inspection (Read, grep, awk, short Python text helpers):** all signatures, permission checks, slice writes, audit and event types, error codes, export lists, constants and the purity scan. The 42-row action table takes its signature, line numbers and return type mechanically from `types.ts` and `actions.ts`; the permission, slice, audit and event columns were transcribed from reading every transition module and cross-checked with the greps in V9, V10 and the vocabulary tables (section 13). The selector, view, derive and devices tables take names and line numbers mechanically from the `export` lines; the "slices read" column was transcribed from the function bodies.
- Helper scripts and intermediate tables were kept in the session scratchpad, outside the repository. No process other than short-lived read commands was started (P7).

## 4. Findings (Tier 2: found, why it matters, how verified, source)

| ID | Found | Why it matters for this task | How verified | Source |
|---|---|---|---|---|
| F1 | `SimActions` has 42 members. 14 return a value synchronously (4 `SignInResult`, 1 `CreateSessionResult`, 1 `PairResult`, 1 `EvidenceVerifyResult`, 3 `ExportResult`, 1 `ChainVerifyResult`, 2 `string`, 1 `number`); 28 return `void`. | Row 15 maps each member to an operation or a recorded exclusion; ADQ-3 counts the call sites that use a return value. | V1, V2; the table in section 6 | `types.ts:985-1094` |
| F2 | There is one implementation, `createActions`, and one caller, `createSim`. The object it returns has the same 42 entries. | There is no second implementation to inventory; each state-writing action applies its result with one `setState` (through `commit`, `commitWith` or `applyAuth`, or directly in `signOut`, `touch`, `setActiveCamera`, `setTabletLink`; `actions.ts:4-5,107-127`). | V2; `graft callers createActions` -> `createSim (engine.ts:166-363)` at `engine.ts:256` | `actions.ts:104-237` (`commit` `:115-119`, `commitWith` `:122-127`) |
| F3 | 17 of 42 actions check a permission: 13 throw (`beginPrecheck`, `acknowledgePrecheckWarnings`, `retryPrecheck`, `startRecording`, `stopRecording`, `cancel`, `scanCaseNumber`, `runDiagnostics`, `deviceCommand`, `setStoragePolicy`, `startSoftwareUpdate`, `restartServices`, `archiveEvidence`) and 4 return the refusal (`createSession`, `exportEvidence`, `exportAudit`, `exportLogs`). 25 actions check nothing, including `recover`, `addMarker`, `addNote`, `snapshot`, `acknowledgeSummary`, `verify`, `pair`, `unpair`, `setTabletLink`, the settings actions, `setActiveCamera` and the demo-control actions. | The blueprint (F-A7) names only the demo-control actions as unchecked. Server-side RBAC (FR3) meets three refusal shapes today (thrown error, result reason, silent allow); the spec decides which of the 25 unchecked actions gain a check. | V9; reading each transition in section 6 | `auth.ts:78-91`, `session-machine.ts:125-127`, `maintenance.ts`, `evidence-actions.ts` (lines in V9) |
| F4 | Only the three export paths write an audit row when they deny (`EXPORT_DENIED`): `exportEvidence` (`evidence-actions.ts:131`) and `exportAudit` / `exportLogs` (`:251`). The other 14 permission-checked actions refuse before any state change and write no row. | SC4 needs "the server refuses and audits"; the simulator has one precedent and no generic denial type (F11). | Reading `requirePermission` (`auth.ts:78-91`), `createSessionTransition` (`session-machine.ts:360-364`), `archiveEvidenceTransition` (`evidence-actions.ts:195-197`) | as listed |
| F5 | The role table grants `SESSION_NOTE` (INVESTIGATOR, SUPERVISOR) and `EVIDENCE_VIEW` (all three roles) but no code in `src/sim` checks either. Seven of the nine permissions are enforced: `SESSION_START`, `EVIDENCE_REVIEW`, `EVIDENCE_EXPORT`, `AUDIT_EXPORT`, `DEVICE_MANAGE`, `DIAGNOSTICS_RUN`, `MAINTENANCE`. `selectCan(state, permission)` exposes any permission to the UI. | The permission list and matrix (row 15) start from nine names of which two have no enforcement point in the simulator; whether the clients gate on them is for rows 3 and 4. | V9: no `Permission.SESSION_NOTE` or `Permission.EVIDENCE_VIEW` outside the role table | `auth.ts:46-67`, `vocabulary.ts:23-34`, `selectors.ts:49-50` |
| F6 | Roles and operators are static data. `ROLE_PERMISSIONS`: INVESTIGATOR 4 permissions, SUPERVISOR 7, TECHNICIAN 4. Three operators (OPR-001 INVESTIGATOR, OPR-002 SUPERVISOR, OPR-003 TECHNICIAN) come from a constant list; the `operators` slice is written only by the seed. No `SimActions` member creates, edits, enables or disables an operator or a role. | User administration and role assignment (FR4, Q9) have no simulator behaviour to mirror; the matrix is the baseline for Q10. | `grep -nE "operators:\|operators ="` shows the only writer at `initial-state.ts:167`; role table read in full | `auth.ts:46-67`, `dataset.ts:113-147`, `initial-state.ts:167` |
| F7 | Every permission check and every `actorId` reads one identity, `state.auth`. No action parameter names the caller. Actions without a check record the signed-in operator as actor, or `null` when nobody is signed in. | With several clients acting on one state, each call needs an actor from outside the action signature; the audit `actorId` can be `null` for the 25 unchecked actions today. | Reading `signedInOperatorId` and each caller | `auth.ts:78-91`, `session-machine.ts:116-118,1077,1092,1151`, `evidence-actions.ts:121-122,193-194,240-241`, `pairing.ts:24`, `types.ts:985-1094` |
| F8 | Sign-in model: one shared password constant for all operators (`DEMO_OPERATOR_PASSWORD`, compared at `auth.ts:292`); biometric sign-in trusts the operator id the caller passes (`auth.ts:296-299`); the security-key action takes no argument and always signs in the SUPERVISOR operator (`SECURITY_KEY_OPERATOR_ID`, `auth.ts:311-314`); the lockout is console-wide across usernames (5 failures in a rolling 5 min, 60 s lock; `constants.ts:51-53`, `auth.ts:5-7`); idle expiry 15 min (`constants.ts:54`); the signed-in record is `{operatorId, issuedAt}` under key `dems.auth` (`types.ts:92-95`, `constants.ts:16`). | Hashing, session or token model, lockout and expiry (IQ 11, 12, 17) replace all of this; the Live biometric and security-key paths (MJ-6) change behaviour. | Reading `auth.ts` in full | `auth.ts:173-314`, `dataset.ts:153-155`, `constants.ts:50-56` |
| F9 | Pairing model: one `PairingSlice` (state UNPAIRED / PAIRED / FAILED, `coreDeviceId`, `coreName`, `certificateFingerprint`, `pairedAt`, `failures`, `lockedUntil`) and one `TabletLinkSlice`; no device identity, no list of paired devices. `pair(code)` compares the code with the constant `DEMO_PAIRING_CODE` (`pairing.ts:47-51`), 3 failures in 5 min lock for 60 s (`constants.ts:59-60`), and needs no sign-in and no permission. `unpair()` also needs neither. A fresh store defaults to PAIRED unless `initialPairing` is passed. | The portal-issued code, the device registry, listing and revocation (FR5) are new behaviour; today's pairing is a client-held constant. | Reading `pairing.ts` in full; `types.ts:260-273`; `initial-state.ts:170-180` | `pairing.ts:19-140`, `types.ts:158` |
| F10 | All audit rows are appended through one function chain: `appendAudit` (`events.ts:117`) <- `appendActivity` (`:258`) <- `recordActivity` (`:286`) and the auth transitions. The hash is `sha256(prevHash ‖ canonicalJSON(body))` (`events.ts:64-66`); `seq = log.total + 1` (`:123`), so appends are inherently serial; the audit ring keeps 1000 rows and the event ring 500 (`constants.ts:35-36`); `verifyAuditChain` re-checks hash, link and sequence (`events.ts:166-191`). Row ids are `AUD-NNNNNN` and event ids `LOG-NNNNNN`. `details` values are flat `string \| number \| boolean \| null` (`types.ts:68-69`). | NFR3 and IQ 14: the chain, its serialisation and the ring cut-off are the behaviour the database contract must reproduce or replace (row 16). | `graft callers appendAudit` -> `appendActivity (events.ts:268)`, `appendAuditMany (events.ts:155)`; `graft callers appendActivity` -> `createActions, attempt, expireIfIdle, signOutTransition, recordActivity, createIdleState`; `graft callers appendAuditMany` -> none | `events.ts:64-191,258-294`, `constants.ts:35-44` |
| F11 | None of the 44 `AuditType` values names a generic permission denial, a pairing-code issue, a device revocation, a role change or a user enable/disable. The nearest are `EXPORT_DENIED` (`vocabulary.ts:320`), `PAIRING_SUCCESS`, `PAIRING_FAILED`, `PAIRING_LOCKED` (`:330-332`) and `UNPAIRED` (`:333`). A new `AuditType` must also appear in `AUDIT_TYPE_CATEGORY` (`satisfies Record<AuditType, AuditCategory>`, `vocabulary.ts:347-392`) and in the i18n key `common.auditType`; the same holds for `SimEventType` (`vocabulary.ts:488-535`, `common.eventType`) and `OperatorRole` (`common.roles`). `Permission` is not in that i18n sync test. | ADQ-9: additive vocabulary values touch three places and a sync test; the new feature areas need audit types that do not exist. | Reading `vocabulary.ts`; `grep` of `i18n-vocabulary-sync.test.ts` | `vocabulary.ts:291-392`, `i18n-vocabulary-sync.test.ts:50,64-65,71,73,109-112` |
| F12 | Three types are emitted only by the seed (`dataset.ts`), by no action or engine path: audit `EVIDENCE_REVIEW_OPENED` (`dataset.ts:725`), event `EVIDENCE_REVIEW` (`:731`), event `UPDATE_AVAILABLE` (`:857`). 9 audit types are emitted only by engine paths (no action): `AUTH_EXPIRED`, `PRECHECK_BLOCKED`, `EVIDENCE_SEALED`, `SESSION_INCOMPLETE`, `FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED`, `RECOVERY_COMPLETED`, `UPDATE_COMPLETED` (12 event types likewise, section 13). | The server's engine, not an endpoint, must emit those; the seed mapping (row 16) must reproduce the seed-only rows. | Section 13 tables, built from `type: '...'` emit sites with an `audit:` or `event:` look-back | `dataset.ts:590-861`, section 13 |
| F13 | The engine runs 7 subsystems in a fixed order on a 50 ms scheduler: clock (100 ms publish), auth-idle (1 s check), session-machine (every tick while a session exists), health (1 Hz), audio (20 Hz), generator (Poisson mean 8 s while RECORDING, else one event per 60 s), maintenance (every tick, work only while a diagnostics run or update runs). Each subsystem writes state on its own, independent of any action. A throw in one subsystem is reported, the others still run. | ADQ-1 and H-B1: the server-side engine is a set of timed state writers with defined rates; NFR4 and NFR5 (20 Hz meters, no per-frame writes) apply to the audio subsystem and the 1 Hz health step. | V7; section 10 | `engine.ts:152-162,263-279`, `constants.ts:20-32` |
| F14 | The four timed session transitions (precheck resolution, STOPPING -> FINALIZING, finalization -> SEALED, recovery end) are pure functions of `(state, now, rng)` that fire at their scheduled time, not at the tick that notices them, so a catch-up after a pause yields the same timestamps as a live run. | IQ 10 and E1 (backend stops while recording): the catch-up semantics are already defined in the shared code. | Reading `session-machine.ts:1-15`, `:560-625`, `:743-904`, `:979-988`, `:1160-1171` | `session-machine.ts` (lines as listed) |
| F15 | The persisted snapshot has 30 of the 33 `SimState` slices under key `dems.sim.v1`, version 1; it excludes `audio` (20 Hz), `clock` and `auth`. A snapshot is usable only with all required keys (29; `settings` is optional), the same schema version and the same seed; a different version is dropped, not migrated. Writes are throttled to one per second and flushed on hide and stop. | ADQ-4 and IQ 7 and 9: the snapshot is today's whole persistence model; the slice list is the starting inventory for the tables (row 16). | V6; reading `store.ts` in full | `store.ts:24-141`, `constants.ts:11-18` |
| F16 | Reads: `selectors.ts` has 89 exports (67 selectors, 6 pure helper functions, 4 constants, 8 interfaces, 4 types), `views.ts` 26 (7 selectors), `derive.ts` 11 (one state-writing function, `deriveDeviceState`, and 10 helpers and constants). Across the 126 exports of the three files, 31 of 33 slices are read by at least one function (`ports` only by `deriveDeviceState`); `audio` and `activeCameraId` are read by no exported selector, view or derive function. Four module-level caches exist (`selectors.ts:71,393,448`; `views.ts:286`). | The spec's read model (queries and realtime topics) maps from these read sets; the cached selectors are in-process memoisation only. | V3, V4; the tables in section 9 | section 9; `audio` is read in `react.ts:106` and `api.ts:218`, `activeCameraId` in `faults.ts:79`, `session-machine.ts:1122`, `actions.ts:198` |
| F17 | Error handling has four layers: 15 `SimErrorCode` members carried by `SimTransitionError`, `SimNotFoundError`, `SimPermissionError` (and a deprecated one); result-type reasons that are not `SimErrorCode` members (`INVALID_CREDENTIALS`, `LOCKED`, `INVALID_CODE`, `FORBIDDEN`, `NOT_SEALED`, `SECURITY_FAULT`, `INVALID_REASON`, chain reasons); uncoded throws (`RangeError` from `loadScenario`, `TypeError` from `canonicalJSON`); and a simulated REST layer with 17 distinct error codes. `INVALID_INPUT` is never thrown in `src/sim`. `archiveEvidence` reports NOT_PERMITTED even when nobody is signed in. | The server's error envelope and the clients' code-to-copy mapping (the UI picks i18n copy from `code`, `errors.ts:3-6`) must cover all four layers. | V10, `grep SimErrorCode`; section 12 | `errors.ts`, `api.ts:331-341,481-495`, `evidence-actions.ts:195-197` |
| F18 | The simulated REST layer answers 9 routes (`api.ts:42-52`) and reaches only 6 actions (`createSession`, `beginPrecheck`, `startRecording`, `acknowledgePrecheckWarnings`, `stopRecording`, `exportEvidence`; 7 call sites). `graft callers handleSimApiRequest` -> `request (engine.ts:352-361)` only. The three session routes check SESSION_START before anything else (`api.ts:354-361`); the evidence-export route has no pre-check and relies on the action. | 36 of 42 actions have no REST operation today; the 10-operation contract (F-A9) covers a small part of the action surface. | `grep -nE "actions\.[a-zA-Z]+\(" api.ts` -> lines 373, 408, 411, 415, 416, 443, 471 | `api.ts:42-52,347-479` |
| F19 | `loadScenario(name)` and `resetDemo()` rebuild every slice from `createIdleState` except `auth`, `authLockout`, `pairing`, `tabletLink`, `settings` and `meta.epoch`, so the audit chain restarts from a freshly built history, then one `SCENARIO_LOADED` row is appended. Neither action needs a sign-in or a permission. An unknown scenario name throws `RangeError`. | IQ 9 (reset to the seed) and E14 (demo controls need no sign-in in Simulated mode but a permission in Live mode); the reset rewrites the audit chain. | Reading `scenarios.ts:195-229` | `scenarios.ts:195-229`, `actions.ts:182-183` |
| F20 | Identifiers come from counters in state, never from a UUID source: audit `AUD-NNNNNN`, event `LOG-NNNNNN`, items `TL-/NOTE-/ALR-/DIAG-NNNNNN` (one shared `meta.counters.item`), session `SES-YYYYMMDD-NNNN`, evidence `EV-YYYYMMDD-NNNN`, case `LP/YYYY/MMDD-NNNN`, export `EXP-NNNNNN`. Times are epoch milliseconds on the sim clock, UTC+07:00. A static test forbids `Math.random`, `crypto`, `randomUUID`, `performance` and bare `Date.now` outside `clock.ts`. | The database contract's key and id rules (row 16) start from these formats and counters; "server clock authoritative" (Q15) replaces the injectable clock. | Section 14; `sim-platform-neutral.test.ts:206-213` | `events.ts:112-114,216-218,297-306`, `dataset.ts:196-204`, `constants.ts:46-48` |
| F21 | Purity: of 33 files, 7 modules hold pure state transitions (`auth`, `session-machine`, `faults`, `evidence-actions`, `pairing`, `scenarios`, `maintenance`; one function in `maintenance` mutates a transient runtime object and one `auth` transition asks the action layer for a storage write), 4 are pure derivations, 12 are pure data or helpers, 7 are stateful but platform-neutral (they take injected adapters), 1 is the platform adapter, 1 is React-bound, 1 is a barrel. Only `platform.ts` names web globals and only `react.ts` imports React; a static test enforces both over `src/sim`. | H-B1 (the shared transition code runs unchanged in Node): the source supports it; the one impurity and the two non-sim dependencies are listed in section 15. | Section 15 table; `sim-platform-neutral.test.ts:187-229`; V11 | section 15 |
| F22 | The shared code already runs in Node outside tests: `packages/shared/scripts/gen-demo-evidence.ts` calls `createIdleState`, `buildScenarioState`, `scenarioRng` and `tickMachine` (`:305,321,322,326`) and is run with `node --import tsx scripts/gen-demo-evidence.ts` (`gen-demo-evidence.ts:36`; it states "no package.json script", `:34`). The package exports TypeScript sources with no build step (`package.json:6-12`). | Evidence for H-B1 that the transition code is usable in a Node process without a browser; it does not prove a long-running server use. | `graft callers createIdleState` and `tickMachine` -> `loadSimulatorItems (gen-demo-evidence.ts:304-341)`; Read of the script | `gen-demo-evidence.ts:304-341`, `package.json:6-30` |
| F23 | `session-machine.ts` is not self-contained: it imports `sessionCreateSchema` from `../api/session-schema` (`:17`), which imports `zod` and `../sim/vocabulary` (`api/session-schema.ts:23-25`), and enum values from `../domain` (4 files, no external imports). `deviceCommandTransition` mutates the transient `AudioRuntime.testToneUntil` passed in (`maintenance.ts:218`), the one transition that writes outside the state. `AuthTransition.record` asks the action layer to write the operator record (`auth.ts:149-154`, `actions.ts:107-112`). | These are the three places where a transition is not a pure `(state) -> state` function; ADQ-1 must account for them. | V11; `grep` of `domain/` and `session-schema.ts` imports | `session-machine.ts:17,216-223`, `maintenance.ts:197-218`, `auth.ts:149-154` |

## 5. Source layout of `src/sim/` (33 files)

All paths relative to `/Users/gsp-budi/Documents/DEMS/packages/shared/src/sim/`. Class codes: **T** pure state transition, **R** pure read or derivation, **H** pure data or helper, **S** stateful but platform-neutral (injected adapters), **P** platform adapter, **X** React-bound, **B** barrel.

| File | Lines | Class | Role | Imports outside `./` |
|---|--:|---|---|---|
| `actions.ts` | 237 | S | binds `SimActions` to one store (`createActions`); `updateSettingsPatch` | none |
| `api.ts` | 527 | S | simulated REST handlers over a `SimApiTarget` (store, actions, clock) | `../domain` |
| `audio.ts` | 255 | S | 20 Hz meter ballistics (pure `stepMeter`) plus the audio subsystem closure | `../domain` |
| `auth.ts` | 387 | T | role table, `requirePermission`, sign-in, lockout, idle expiry transitions | none |
| `clock.ts` | 131 | H | sim clock, date arithmetic; `createSimClock` reads `Date.now` (`:23`), the only use | none |
| `constants.ts` | 136 | H | storage keys, rates, ring sizes, policies | none |
| `dataset.ts` | 882 | H | operators, services, ID formats, history builder `buildHistory` (`:551`) | `../domain` |
| `demo-alignment.ts` | 266 | H | demo package integrity data and join | `../domain` |
| `derive.ts` | 312 | R | `deriveDeviceState` (the only derived-state writer) and helpers | `../domain` |
| `devices.ts` | 351 | R | PoE, platform devices, front panel, per-device health series | `../domain` |
| `engine.ts` | 363 | S | `createSim`, scheduler, subsystem order, visibility and hydration handling | none |
| `errors.ts` | 135 | H | error classes and `SimErrorCode` | none |
| `events.ts` | 306 | H | canonical JSON, SHA-256 chain, ring buffers, `appendActivity`, `recordActivity` | `@noble/hashes/sha2.js`, `@noble/hashes/utils.js` |
| `evidence-actions.ts` | 305 | T | verify, export, archive, audit export transitions | `../domain` |
| `evidence.ts` | 365 | H | track and manifest hashes, `createEvidenceItem`, `verifyEvidenceItem` | `../domain` |
| `faults.ts` | 405 | T | inject, clear, reset clip, acknowledge alert transitions | `../domain` |
| `generator.ts` | 215 | S | pure recording and idle activity steps plus the generator subsystem closure | `../domain` |
| `health.ts` | 191 | S | pure `healthStep` plus the 1 Hz subsystem closure | `../domain` |
| `index.ts` | 39 | B | barrel: 32 `export * from` lines, one per other module (`index.ts:8-39`) | none |
| `initial-state.ts` | 420 | H | `createIdleState` (builds a full `SimState`), series back-fill | `@noble/hashes/sha2.js`, `@noble/hashes/utils.js` |
| `maintenance.ts` | 455 | T | diagnostics, device commands, services restart, storage policy, software update; subsystem factory at `:444` | `../domain` |
| `memo.ts` | 75 | H | `deepEqual`, `stableSelector`, `stableSelectorBy` | none |
| `pairing.ts` | 140 | T | `pairTransition`, `unpairTransition` | none |
| `platform.ts` | 278 | P | web storage, visibility, timers, scheduler defaults, throttled persist | `zustand/middleware` |
| `react.ts` | 112 | X | `SimProvider`, `useSim`, `useSimActions`, `useSimReady`, `useAudioChannel` | `../domain`, `react`, `zustand`, `zustand/react/shallow` |
| `rng.ts` | 166 | H | seeded streams (`mulberry32`, FNV-1a), no `Math.random` | none |
| `scenarios.ts` | 229 | T | `buildScenarioState`, `loadScenarioState` | `../domain` |
| `selectors.ts` | 563 | R | 67 selectors and helpers over `SimState` | `../domain` |
| `session-machine.ts` | 1171 | T | session transitions, precheck, finalization, recovery, `tickMachine` | `../api/session-schema`, `../domain` |
| `store.ts` | 141 | S | zustand vanilla store with `persist`, `SNAPSHOT_KEYS` | `zustand/middleware`, `zustand/vanilla` |
| `types.ts` | 1130 | H | state slices, `SimActions`, results, adapters (type-only imports) | `../domain`, `zustand/middleware` (types only) |
| `views.ts` | 324 | R | page-level views (domains, drives, services, release, log bundle) | `../domain` |
| `vocabulary.ts` | 598 | H | closed value sets, audit and event categories | none |

Total 11 610 lines (`wc -l`). Class counts: T 7, R 4 (`derive`, `devices`, `selectors`, `views`), H 12, S 7 (`actions`, `api`, `audio`, `engine`, `generator`, `health`, `store`), P 1, X 1, B 1 = 33.

## 6. `SimActions`: all 42 members

Source of signature, line and return type: `types.ts:985-1094`. Implementation entry: `actions.ts:129-236`. Row count equals the member count (42, V1, V2).

| # | Member | Declared (types.ts:line) | Implemented (actions.ts:line) | Signature (types.ts) | Sync return | Permission check | Refusal and error codes | State slices written | Audit types emitted | Event types emitted | Transition (file:line) |
|--:|---|--:|--:|---|---|---|---|---|---|---|---|
| 1 | `signIn` | types.ts:988 | actions.ts:131 | `signIn(username: string, password: string): SignInResult;` | `SignInResult` | none (pre-auth) | result reasons INVALID_CREDENTIALS, LOCKED (types.ts:892-893); never throws | success: auth, authLockout, audit,events,meta; failure: authLockout, audit,events,meta; locked: audit,events,meta (auth.ts:198-207, 229-243, 272-282); side effect authStorage save/clear (actions.ts:107-112) | AUTH_SUCCESS (auth.ts:217) or AUTH_FAILED (auth.ts:252) or AUTH_LOCKED (auth.ts:185) | AUTH_LOGIN (auth.ts:223) or AUTH_FAILED (auth.ts:266) or AUTH_LOCKED (auth.ts:192) | auth.ts:285 passwordSignIn -> auth.ts:173 attempt |
| 2 | `signInWithBiometric` | types.ts:990 | actions.ts:132 | `signInWithBiometric(operatorId: string): SignInResult;` | `SignInResult` | none (pre-auth; the caller names the operator, auth.ts:296-299) | result reasons as signIn: a known operator id gives success or LOCKED, an unknown id gives INVALID_CREDENTIALS or LOCKED (auth.ts:296-299) | success: auth, authLockout, audit,events,meta; failure: authLockout, audit,events,meta; locked: audit,events,meta (as signIn); side effect authStorage save/clear (actions.ts:107-112) | as signIn, details.method BIOMETRIC | as signIn | auth.ts:296 biometricSignIn -> attempt |
| 3 | `recordBiometricFailure` | types.ts:992 | actions.ts:134 | `recordBiometricFailure(operatorId: string \| null): SignInResult;` | `SignInResult` | none (pre-auth) | result is always a failure: INVALID_CREDENTIALS or LOCKED (auth.ts:307) | authLockout, audit,events,meta (never auth) | AUTH_FAILED (auth.ts:252) or AUTH_LOCKED (auth.ts:185) | AUTH_FAILED (auth.ts:266) or AUTH_LOCKED (auth.ts:192) | auth.ts:302 biometricFailure -> attempt (verified=false) |
| 4 | `signInWithSecurityKey` | types.ts:994 | actions.ts:136 | `signInWithSecurityKey(): SignInResult;` | `SignInResult` | none (pre-auth; takes no argument) | as signIn | success: auth, authLockout, audit,events,meta; failure: authLockout, audit,events,meta; locked: audit,events,meta (as signIn); side effect authStorage save/clear (actions.ts:107-112) | as signIn, details.method SECURITY_KEY | as signIn | auth.ts:311 securityKeySignIn -> attempt |
| 5 | `signOut` | types.ts:995 | actions.ts:137 | `signOut(reason?: SignOutReason): void;` | `void` | none | none; no-op when SIGNED_OUT (auth.ts:323) | auth, audit,events,meta when SIGNED_IN; auth only when EXPIRED; authStorage.clear() always (actions.ts:140) | AUTH_SIGNED_OUT (auth.ts:327) | AUTH_LOGOUT (auth.ts:333) | auth.ts:316 signOutTransition |
| 6 | `touch` | types.ts:997 | actions.ts:142 | `touch(): void;` | `void` | none | none; no-op unless SIGNED_IN, at most one write per second (auth.ts:364-368; AUTH_TOUCH_MIN_INTERVAL_MS constants.ts:56) | auth (lastActivityAt) | none | none | auth.ts:363 touchTransition |
| 7 | `createSession` | types.ts:1005 | actions.ts:148 | `createSession(input: SessionCreateInput): CreateSessionResult;` | `CreateSessionResult` | SESSION_START, inline, returned in the result (session-machine.ts:360-364) | result reasons NOT_SIGNED_IN, NOT_PERMITTED, INVALID_INPUT, SESSION_ACTIVE (types.ts:899); idempotent for equal input (session-machine.ts:379-381) | session[W], meta (counters.session, counters.caseNumber), lastSealedAcknowledged, audit,events,meta (session-machine.ts:309-328, 388-391) | SESSION_CREATED (session-machine.ts:319) | SESSION_CREATED (session-machine.ts:325) | session-machine.ts:354 createSessionTransition -> :279 openSession |
| 8 | `beginPrecheck` | types.ts:1011 | actions.ts:150 | `beginPrecheck(): void;` | `void` | SESSION_START via requireSessionOperator (session-machine.ts:521) | throws SimPermissionError NOT_SIGNED_IN or NOT_PERMITTED; SimTransitionError ILLEGAL_STATE unless state CREATE (session-machine.ts:522) | session[W], events, meta (session-machine.ts:509-516); uses RNG stream precheck (session-machine.ts:503) | none | PRECHECK_STARTED (session-machine.ts:515) | session-machine.ts:520 beginPrecheckTransition -> :502 startPrecheck |
| 9 | `acknowledgePrecheckWarnings` | types.ts:1012 | actions.ts:151 | `acknowledgePrecheckWarnings(): void;` | `void` | SESSION_START via requireSessionOperator (session-machine.ts:629) | throws SimPermissionError; ILLEGAL_STATE unless PRECHECK; CHECKS_RUNNING (outcome pending) or NO_WARNINGS (outcome not WARN) (session-machine.ts:631-637) | session[W], audit,events,meta (session-machine.ts:640-644) | PRECHECK_PASSED (session-machine.ts:546; details.by operator) | PRECHECK_PASSED (session-machine.ts:553) | session-machine.ts:628 acknowledgePrecheckWarningsTransition -> :541 arm |
| 10 | `retryPrecheck` | types.ts:1013 | actions.ts:152 | `retryPrecheck(): void;` | `void` | SESSION_START via requireSessionOperator (session-machine.ts:528) | throws SimPermissionError; ILLEGAL_STATE unless PRECHECK; CHECKS_RUNNING while outcome pending (session-machine.ts:530-532) | session[W], events, meta | none | PRECHECK_STARTED (session-machine.ts:515) | session-machine.ts:527 retryPrecheckTransition -> :502 startPrecheck |
| 11 | `startRecording` | types.ts:1014 | actions.ts:153 | `startRecording(): void;` | `void` | SESSION_START via requireSessionOperator (session-machine.ts:651) | throws SimPermissionError; ILLEGAL_STATE unless ARMED (session-machine.ts:652) | session[W] (startedAt, startTimeSource, timeline START), meta (counters.item), audit,events,meta (session-machine.ts:653-682) | RECORDING_STARTED (session-machine.ts:669) | RECORDING_STARTED (session-machine.ts:676) | session-machine.ts:650 startRecordingTransition |
| 12 | `stopRecording` | types.ts:1016 | actions.ts:154 | `stopRecording(reason: string): void;` | `void` | SESSION_START via requireSessionOperator (session-machine.ts:687) | throws SimPermissionError; ILLEGAL_STATE unless RECORDING; REASON_TOO_SHORT below STOP_REASON_MIN_LENGTH 5 characters (session-machine.ts:689-697; constants.ts:71) | session[W] (STOPPING, stoppedAt, stopReason, stopTimeSource, bytesWritten), storage (evidence volume usedBytes via settleBytes), audit,events,meta (session-machine.ts:699-721) | RECORDING_STOPPED (session-machine.ts:709) | RECORDING_STOPPED (session-machine.ts:716) | session-machine.ts:686 stopRecordingTransition |
| 13 | `cancel` | types.ts:1018 | actions.ts:155 | `cancel(): void;` | `void` | SESSION_START via requireSessionOperator (session-machine.ts:726) | throws SimPermissionError; ILLEGAL_STATE unless CREATE, PRECHECK or ARMED (CANCELLABLE_STATES session-machine.ts:84-88) | session[W] (set to null), audit,events,meta (session-machine.ts:728) | SESSION_CANCELLED (session-machine.ts:730) | SESSION_CANCELLED (session-machine.ts:736) | session-machine.ts:725 cancelTransition |
| 14 | `scanCaseNumber` | types.ts:1024 | actions.ts:149 | `scanCaseNumber(): string;` | `string` | SESSION_START via requireSessionOperator (session-machine.ts:400) | throws SimPermissionError NOT_SIGNED_IN or NOT_PERMITTED | meta (counters.caseNumber) (session-machine.ts:401-405) | none | none | session-machine.ts:399 scanCaseNumberTransition |
| 15 | `recover` | types.ts:1026 | actions.ts:156 | `recover(): void;` | `void` | NONE (session-machine.ts:941-942 checks the session state only; actor is the signed-in operator or null, :959) | throws SimTransitionError ILLEGAL_STATE unless FAULT (session-machine.ts:942) | session[W] (RECOVERY), services (startedAt reset, POWER_FAIL only, :966-969), audit,events,meta; POWER_FAIL also clears: faults, alerts, D10 and adds one FAULT_CLEARED row | SYSTEM_BOOT (session-machine.ts:947, POWER_FAIL only) + RECOVERY_STARTED (session-machine.ts:957) [+ FAULT_CLEARED (faults.ts:373)] | SYSTEM_BOOT (session-machine.ts:952) + RECOVERY_STARTED (session-machine.ts:963) [+ FAULT_CLEARED (faults.ts:379)] | session-machine.ts:941 recoverTransition (+ faults.ts:339 clearFaultTransition when the fault is POWER_FAIL, actions.ts:158-161) |
| 16 | `addMarker` | types.ts:1027 | actions.ts:163 | `addMarker(label?: string): void;` | `void` | NONE (session-machine.ts:1067-1068; actor is the signed-in operator or null, :1077) | throws SimTransitionError ILLEGAL_STATE unless RECORDING | session (markerCount, timeline MARKER), meta (counters.item), audit,events,meta (session-machine.ts:1071-1082) | MARKER_ADDED (session-machine.ts:1075) | MARKER_ADDED (session-machine.ts:1081) | session-machine.ts:1067 addMarkerTransition |
| 17 | `addNote` | types.ts:1028 | actions.ts:164 | `addNote(text: string): void;` | `void` | NONE (session-machine.ts:1085-1086; SESSION_NOTE exists in the role table but no check reads it) | throws ILLEGAL_STATE unless RECORDING; NOTE_INVALID unless the trimmed text is 1-2000 characters (session-machine.ts:1087-1090) | session (notes, timeline NOTE), meta (counters.item), audit,events,meta (session-machine.ts:1091-1116) | NOTE_ADDED (session-machine.ts:1109) | NOTE_ADDED (session-machine.ts:1115) | session-machine.ts:1085 addNoteTransition |
| 18 | `snapshot` | types.ts:1029 | actions.ts:165 | `snapshot(): void;` | `void` | NONE (session-machine.ts:1119-1120) | throws ILLEGAL_STATE unless RECORDING | session (snapshotCount, timeline SNAPSHOT), meta (counters.item), audit,events,meta (session-machine.ts:1121-1141) | SNAPSHOT_TAKEN (session-machine.ts:1134) | SNAPSHOT_TAKEN (session-machine.ts:1140) | session-machine.ts:1119 snapshotTransition |
| 19 | `acknowledgeSummary` | types.ts:1031 | actions.ts:166 | `acknowledgeSummary(sessionId: string): void;` | `void` | NONE | none; a different id or a repeat is a no-op (session-machine.ts:1146) | lastSealedAcknowledged, audit (events and meta unchanged) | SUMMARY_ACKNOWLEDGED (session-machine.ts:1149) | none | session-machine.ts:1145 acknowledgeSummaryTransition |
| 20 | `verify` | types.ts:1034 | actions.ts:169 | `verify(evidenceId: string): EvidenceVerifyResult;` | `EvidenceVerifyResult` | NONE, no sign-in needed (evidence-actions.ts:55-62; actor is the signed-in operator or null) | throws SimNotFoundError (evidence-actions.ts:51) | evidence (verification, custody), audit,events,meta (evidence-actions.ts:64-105) | EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED (evidence-actions.ts:84) | EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED (evidence-actions.ts:99) | evidence-actions.ts:55 verifyEvidenceTransition -> evidence.ts:265 verifyEvidenceItem |
| 21 | `exportEvidence` | types.ts:1035 | actions.ts:170 | `exportEvidence(evidenceId: string, request: ExportRequest): ExportResult;` | `ExportResult` | EVIDENCE_EXPORT, inline, returned in the result (evidence-actions.ts:124) | result status/reason in check order: 401 NOT_SIGNED_IN (:123), 403 FORBIDDEN (:126, audited), 404 NOT_FOUND (:149), 409 NOT_SEALED (:150), 409 SECURITY_FAULT (:151), 422 INVALID_REASON (:154); success 202 (types.ts:943-949) | success: evidence (status EXPORTED, custody), meta (counters.export), audit,events,meta; 403: audit,events,meta | EVIDENCE_EXPORTED (evidence-actions.ts:174); denial EXPORT_DENIED (evidence-actions.ts:131) | EVIDENCE_EXPORTED (evidence-actions.ts:181); denial EXPORT_DENIED (evidence-actions.ts:139) | evidence-actions.ts:115 exportEvidenceTransition |
| 22 | `archiveEvidence` | types.ts:1036 | actions.ts:172 | `archiveEvidence(evidenceId: string): void;` | `void` | EVIDENCE_REVIEW, inline, THROWN (evidence-actions.ts:195-197) | throws SimPermissionError (code defaults to NOT_PERMITTED even when nobody is signed in, errors.ts:103 and evidence-actions.ts:196); SimNotFoundError; UNSEALED_EVIDENCE for RECORDED items (:200-202); already ARCHIVED is a no-op (:199) | evidence (status ARCHIVED, custody), audit,events,meta (evidence-actions.ts:203-222) | EVIDENCE_ARCHIVED (evidence-actions.ts:214) | EVIDENCE_ARCHIVED (evidence-actions.ts:220) | evidence-actions.ts:192 archiveEvidenceTransition |
| 23 | `exportAudit` | types.ts:1042 | actions.ts:173 | `exportAudit(request?: AuditExportRequest): ExportResult;` | `ExportResult` | AUDIT_EXPORT, inline, returned in the result (evidence-actions.ts:244) | 401 NOT_SIGNED_IN (:242), 403 FORBIDDEN (:246, audited), 422 INVALID_REASON (:269); success 202 | success: meta (counters.export), audit; 403: audit,events,meta | AUDIT_EXPORTED (evidence-actions.ts:286); denial EXPORT_DENIED (evidence-actions.ts:251) | none on success; denial EXPORT_DENIED (evidence-actions.ts:258) | evidence-actions.ts:234 exportAuditTransition |
| 24 | `exportLogs` | types.ts:1048 | actions.ts:174 | `exportLogs(request?: AuditExportRequest): ExportResult;` | `ExportResult` | AUDIT_EXPORT, inline (same function, scope LOGS, actions.ts:174) | as exportAudit | success: meta (counters.export), audit; 403: audit,events,meta (as exportAudit) | AUDIT_EXPORTED with details.scope LOGS (evidence-actions.ts:286, :298) | as exportAudit | evidence-actions.ts:234 exportAuditTransition(scope LOGS) |
| 25 | `verifyAuditChain` | types.ts:1050 | actions.ts:175 | `verifyAuditChain(): ChainVerifyResult;` | `ChainVerifyResult` | NONE | none; returns ok:false with reason HASH_MISMATCH or PREV_LINK_BROKEN or SEQ_GAP (types.ts:951-960) | none (read-only over audit) | none | none | events.ts:166 verifyAuditChain (called directly, actions.ts:175) |
| 26 | `inject` | types.ts:1055 | actions.ts:178 | `inject(kind: FaultKind, target?: FaultTarget): void;` | `void` | NONE, no sign-in needed (types.ts:1053-1054) | throws SimNotFoundError for an unknown evidence target (faults.ts:227-229); idempotent per kind and target (:213) | faults, alerts, meta (counters.item), D10, audit,events,meta; conditional: audio and mics (MIC_CLIP, MIC_NO_SIGNAL, :236-251), audit rows (AUDIT_TAMPER rewrites one stored row, :255), evidence (evidence TAMPER, :256-263), session[W] and storage (critical kinds via enterFault, session-machine.ts:913-938), session timeline (:325-334) | FAULT_RAISED (faults.ts:298) or AUDIT_CHAIN_DISCONTINUITY (faults.ts:277, AUDIT_TAMPER) | FAULT_RAISED (faults.ts:313) or AUDIT_CHAIN_BROKEN (faults.ts:290) | faults.ts:205 injectFaultTransition |
| 27 | `clearFault` | types.ts:1056 | actions.ts:179 | `clearFault(kind: FaultKind, target?: FaultTarget): void;` | `void` | NONE, no sign-in needed | none; no-op when nothing matches (faults.ts:345) | faults, alerts, D10, audit,events,meta; conditional: audit (un-alters a tampered row, :353), evidence (restores a tampered item, :356-360) | FAULT_CLEARED, one per cleared fault (faults.ts:373) | FAULT_CLEARED (faults.ts:379) | faults.ts:339 clearFaultTransition |
| 28 | `resetClip` | types.ts:1057 | actions.ts:180 | `resetClip(channel: AudioTrackId): void;` | `void` | NONE | none; no-op unless the mic is latched (faults.ts:393) | mics (clipLatched), audio (clip) | none | none | faults.ts:391 resetClipTransition |
| 29 | `acknowledgeAlert` | types.ts:1058 | actions.ts:181 | `acknowledgeAlert(alertId: string): void;` | `void` | NONE | none; unknown or acknowledged alert is a no-op (faults.ts:403) | alerts | none | none | faults.ts:401 acknowledgeAlertTransition |
| 30 | `loadScenario` | types.ts:1059 | actions.ts:182 | `loadScenario(name: ScenarioName): void;` | `void` | NONE, no sign-in needed | throws RangeError (no SimErrorCode) for an unknown name (scenarios.ts:201) | every slice is rebuilt from createIdleState except auth, authLockout, pairing, tabletLink, settings (kept) and meta.epoch (kept) (scenarios.ts:202-212); the audit chain restarts from a freshly built history, then one row is appended | SCENARIO_LOADED (scenarios.ts:217) | SCENARIO_LOADED (scenarios.ts:223) | scenarios.ts:195 loadScenarioState |
| 31 | `resetDemo` | types.ts:1061 | actions.ts:183 | `resetDemo(): void;` | `void` | NONE, no sign-in needed | none | every slice is rebuilt from createIdleState except auth, authLockout, pairing, tabletLink, settings (kept) and meta.epoch (kept) (as loadScenario) | SCENARIO_LOADED, details.reset true (scenarios.ts:217-220) | SCENARIO_LOADED (scenarios.ts:223) | scenarios.ts:195 loadScenarioState(name idle, reset true) (actions.ts:183) |
| 32 | `runDiagnostics` | types.ts:1065 | actions.ts:186 | `runDiagnostics(): string;` | `string` | DIAGNOSTICS_RUN via requirePermission (maintenance.ts:116) | throws SimPermissionError NOT_SIGNED_IN or NOT_PERMITTED; returns the running run id when one is in progress (:117-119) | diagnostics, meta (counters.item), audit,events,meta (maintenance.ts:127-143) | DIAGNOSTICS_RUN (maintenance.ts:134) | DIAGNOSTICS_STARTED (maintenance.ts:140) | maintenance.ts:111 runDiagnosticsTransition |
| 33 | `deviceCommand` | types.ts:1071 | actions.ts:191 | `deviceCommand(deviceId: string, command: DeviceCommand): void;` | `void` | DEVICE_MANAGE for RESTART, DIAGNOSTICS_RUN for TEST_SIGNAL and IDENTIFY (maintenance.ts:204-207) | throws SimPermissionError; SimNotFoundError (:210); COMMAND_UNSUPPORTED for a platform device other than IDENTIFY (:211-213); RECORDING_ACTIVE for RESTART while RECORDING (:214-216) | audit (events and meta unchanged); transient AudioRuntime.testToneUntil outside the store (maintenance.ts:218) | DEVICE_COMMAND (maintenance.ts:230) | none | maintenance.ts:197 deviceCommandTransition |
| 34 | `setStoragePolicy` | types.ts:1073 | actions.ts:193 | `setStoragePolicy(policy: Partial<StoragePolicy>): void;` | `void` | EVIDENCE_REVIEW or MAINTENANCE (either) via requirePermission (maintenance.ts:293) | throws SimPermissionError; POLICY_RANGE for an unknown policy or retentionDays outside 1-3650 (:296-303); no-op when unchanged (:305-311) | storagePolicy, audit,events,meta (maintenance.ts:312-329) | STORAGE_POLICY_CHANGED (maintenance.ts:317) | STORAGE_POLICY_CHANGED (maintenance.ts:324) | maintenance.ts:292 setStoragePolicyTransition |
| 35 | `startSoftwareUpdate` | types.ts:1075 | actions.ts:194 | `startSoftwareUpdate(): void;` | `void` | MAINTENANCE via requirePermission (maintenance.ts:336) | throws SimPermissionError; SESSION_ACTIVE while a session is active (:339-341); no-op when RUNNING or no availableVersion (:338) | update, audit,events,meta (maintenance.ts:348-364); uses RNG stream update (:342) | UPDATE_STARTED (maintenance.ts:353) | UPDATE_STARTED (maintenance.ts:360) | maintenance.ts:335 startSoftwareUpdateTransition |
| 36 | `restartServices` | types.ts:1081 | actions.ts:195 | `restartServices(): number;` | `number` | MAINTENANCE via requirePermission (maintenance.ts:252) | throws SimPermissionError; SESSION_ACTIVE while a session is active, SEALED excepted (:253-255) | services (startedAt), audit (events and meta unchanged) (maintenance.ts:257-275) | DEVICE_COMMAND with details.scope CORE_SERVICES (maintenance.ts:267; SERVICES_RESTART_SCOPE :244) | none | maintenance.ts:251 restartServicesTransition |
| 37 | `setActiveCamera` | types.ts:1082 | actions.ts:196 | `setActiveCamera(cameraId: VideoTrackId): void;` | `void` | NONE | none; an unknown camera id or the same id is silently ignored (actions.ts:198) | activeCameraId | none | none | actions.ts:196-200 (direct store write, no transition module) |
| 38 | `setPresentationMode` | types.ts:1086 | actions.ts:203 | `setPresentationMode(enabled: boolean): void;` | `void` | NONE, no sign-in needed (types.ts:1085) | none; wrong types are ignored (actions.ts:87-91) | settings | none (actions.ts:90) | none | actions.ts:92 updateSettingsPatch |
| 39 | `updateSettings` | types.ts:1087 | actions.ts:204 | `updateSettings(patch: Partial<SettingsSlice>): void;` | `void` | NONE | none; unknown keys and wrong types are ignored | settings | none | none | actions.ts:92 updateSettingsPatch |
| 40 | `pair` | types.ts:1090 | actions.ts:207 | `pair(code: string): PairResult;` | `PairResult` | NONE (no sign-in; actor is the signed-in operator or null, pairing.ts:24) | result reasons INVALID_CODE (attemptsRemaining), LOCKED (types.ts:905-906); already PAIRED is a no-op success (pairing.ts:21-23); policy PAIRING_MAX_FAILURES 3 within AUTH_FAILURE_WINDOW_MS, lock PAIRING_LOCKOUT_MS 60 s (constants.ts:59-60, 52); code compared with constant DEMO_PAIRING_CODE (pairing.ts:51; dataset.ts:157) | pairing, audit,events,meta; locked: audit only | PAIRING_SUCCESS (pairing.ts:64) or PAIRING_FAILED (pairing.ts:103) or PAIRING_LOCKED (pairing.ts:33) | PAIRED (pairing.ts:71) or PAIRING_FAILED (pairing.ts:111); none for LOCKED | pairing.ts:19 pairTransition |
| 41 | `unpair` | types.ts:1091 | actions.ts:208 | `unpair(): void;` | `void` | NONE | none; no-op unless PAIRED (pairing.ts:123) | pairing, audit,events,meta | UNPAIRED (pairing.ts:132) | UNPAIRED (pairing.ts:137) | pairing.ts:122 unpairTransition |
| 42 | `setTabletLink` | types.ts:1093 | actions.ts:209 | `setTabletLink(state: TabletLinkState): void;` | `void` | NONE | none; no-op when the state is unchanged (actions.ts:211) | tabletLink, otherDevices (via deriveDeviceState), audit,events,meta | TABLET_LINK_CHANGED (actions.ts:219) | TABLET_CONNECTED or TABLET_DISCONNECTED (actions.ts:226) | actions.ts:209-235 (inline in the action layer, no transition module) |

**Summary of the table (counts re-derivable from it).**

| Property | Count | Members |
|---|--:|---|
| Return a value synchronously | 14 | `signIn`, `signInWithBiometric`, `recordBiometricFailure`, `signInWithSecurityKey`, `createSession`, `scanCaseNumber`, `verify`, `exportEvidence`, `exportAudit`, `exportLogs`, `verifyAuditChain`, `runDiagnostics`, `restartServices`, `pair` |
| Return `void` | 28 | the rest |
| Permission check that throws | 13 | `beginPrecheck`, `acknowledgePrecheckWarnings`, `retryPrecheck`, `startRecording`, `stopRecording`, `cancel`, `scanCaseNumber`, `runDiagnostics`, `deviceCommand`, `setStoragePolicy`, `startSoftwareUpdate`, `restartServices`, `archiveEvidence` |
| Permission check that returns the refusal | 4 | `createSession`, `exportEvidence`, `exportAudit`, `exportLogs` |
| No permission check | 25 | `signIn`, `signInWithBiometric`, `recordBiometricFailure`, `signInWithSecurityKey`, `signOut`, `touch`, `recover`, `addMarker`, `addNote`, `snapshot`, `acknowledgeSummary`, `verify`, `verifyAuditChain`, `inject`, `clearFault`, `resetClip`, `acknowledgeAlert`, `loadScenario`, `resetDemo`, `setActiveCamera`, `setPresentationMode`, `updateSettings`, `pair`, `unpair`, `setTabletLink` |
| Name at least one audit type in the table | 32 | all except the 10 below |
| Write no audit row | 10 | `touch`, `beginPrecheck`, `retryPrecheck`, `scanCaseNumber`, `verifyAuditChain`, `resetClip`, `acknowledgeAlert`, `setActiveCamera`, `setPresentationMode`, `updateSettings` (`beginPrecheck` and `retryPrecheck` write only the `PRECHECK_STARTED` event; settings writes are documented as unaudited, `actions.ts:87-91`) |
| Reached by a simulated REST route | 6 | `createSession`, `beginPrecheck`, `startRecording`, `acknowledgePrecheckWarnings`, `stopRecording`, `exportEvidence` (`api.ts:373,408,411,415,416,443,471`) |

Permission and role matrix baseline (`auth.ts:46-67`): INVESTIGATOR = SESSION_START, SESSION_NOTE, EVIDENCE_VIEW, DIAGNOSTICS_RUN; SUPERVISOR = the four above plus EVIDENCE_REVIEW, EVIDENCE_EXPORT, AUDIT_EXPORT; TECHNICIAN = EVIDENCE_VIEW, DEVICE_MANAGE, DIAGNOSTICS_RUN, MAINTENANCE. `setStoragePolicy` accepts either EVIDENCE_REVIEW or MAINTENANCE (`maintenance.ts:293`).

**Session machine as a transition table.** `SessionState` has 9 values: CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING, SEALED, FAULT, RECOVERY (`../domain/enums.ts:14-24`). `session === null` means IDLE (`session-machine.ts:5`).

| From | To | Trigger | Driver | Guard or permission | Audit row | Source |
|---|---|---|---|---|---|---|
| IDLE or SEALED | CREATE | `createSession` | action | SESSION_START; no active session or equal input | `SESSION_CREATED` | `session-machine.ts:354-393`; SEALED is not "active" (`:107-109`) |
| CREATE | PRECHECK | `beginPrecheck` | action | SESSION_START | none (event `PRECHECK_STARTED`) | `:520-524` |
| PRECHECK | PRECHECK (fresh run) | `retryPrecheck` | action | SESSION_START; outcome resolved | none (event) | `:527-534` |
| PRECHECK | ARMED | all 8 checks resolve with outcome PASS | engine | none | `PRECHECK_PASSED` (`details.by` system) | `:563-598`, `:541-560` |
| PRECHECK | ARMED | `acknowledgePrecheckWarnings` (outcome WARN) | action | SESSION_START | `PRECHECK_PASSED` (`details.by` operator) | `:628-645` |
| PRECHECK | PRECHECK (outcome BLOCK) | all checks resolve with at least one BLOCK | engine | none | `PRECHECK_BLOCKED` | `:601-624` |
| ARMED | RECORDING | `startRecording` | action | SESSION_START | `RECORDING_STARTED` | `:650-683` |
| RECORDING | STOPPING | `stopRecording(reason)` | action | SESSION_START; reason at least 5 characters | `RECORDING_STOPPED` | `:686-722` |
| STOPPING | FINALIZING | 1.5 s after `stoppedAt` | engine | none | none (event `FINALIZATION_STARTED`) | `:743-778` |
| FINALIZING | SEALED | six steps of 0.6-1.2 s each | engine | none | `EVIDENCE_SEALED` | `:876-904`, `:820-873` |
| CREATE, PRECHECK, ARMED | IDLE | `cancel` | action | SESSION_START | `SESSION_CANCELLED` | `:725-738` |
| PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING | FAULT | `inject` of a critical fault (STORAGE_FULL, TPM_FAILURE, POWER_FAIL, SECURITY_FAULT) | action (`inject`) | none | `FAULT_RAISED` | `session-machine.ts:76-82,913-938`; `vocabulary.ts:204-209` |
| FAULT | RECOVERY | `recover` | action | none | `RECOVERY_STARTED` (+ `SYSTEM_BOOT` after POWER_FAIL) | `:941-976` |
| RECOVERY | IDLE (history entry INCOMPLETE; a RECORDED evidence item if a recording had started) | 3 s after the recovery started | engine | none | `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` | `:979-1063` |
| RECORDING | RECORDING | `addMarker`, `addNote`, `snapshot` | action | none | `MARKER_ADDED`, `NOTE_ADDED`, `SNAPSHOT_TAKEN` | `:1067-1142` |

## 7. Pure transition modules (what the action layer calls)

| Module | Exported transitions (pure `(state, now, ...) -> state or {state, result}`) | Impurity |
|---|---|---|
| `auth.ts` | `passwordSignIn` (`:285`), `biometricSignIn` (`:296`), `biometricFailure` (`:302`), `securityKeySignIn` (`:311`), `signOutTransition` (`:316`), `expireIfIdle` (`:342`), `touchTransition` (`:363`), `restoreAuth` (`:373`); helpers `requirePermission` (`:78`), `roleHas` (`:69`), `lockoutStatus` (`:128`) | `AuthTransition.record` instructs the action layer to write the operator record (`:149-154`) |
| `session-machine.ts` | `createSessionTransition` (`:354`), `scanCaseNumberTransition` (`:399`), `beginPrecheckTransition` (`:520`), `retryPrecheckTransition` (`:527`), `acknowledgePrecheckWarningsTransition` (`:628`), `startRecordingTransition` (`:650`), `stopRecordingTransition` (`:686`), `cancelTransition` (`:725`), `recoverTransition` (`:941`), `addMarkerTransition` (`:1067`), `addNoteTransition` (`:1085`), `snapshotTransition` (`:1119`), `acknowledgeSummaryTransition` (`:1145`); engine steps `advancePrecheck` (`:563`), `advanceStopping` (`:743`), `advanceFinalization` (`:876`), `advanceRecovery` (`:979`), `tickMachine` (`:1160`); `enterFault` (`:913`), `openSession` (`:279`) | none; depends on `zod` through `../api/session-schema` (`:17`) |
| `faults.ts` | `injectFaultTransition` (`:205`), `clearFaultTransition` (`:339`), `resetClipTransition` (`:391`), `acknowledgeAlertTransition` (`:401`) | none |
| `evidence-actions.ts` | `verifyEvidenceTransition` (`:55`), `exportEvidenceTransition` (`:115`), `archiveEvidenceTransition` (`:192`), `exportAuditTransition` (`:234`) | none |
| `pairing.ts` | `pairTransition` (`:19`), `unpairTransition` (`:122`) | none |
| `scenarios.ts` | `buildScenarioState` (`:160`), `loadScenarioState` (`:195`) | none |
| `maintenance.ts` | `runDiagnosticsTransition` (`:111`), `advanceDiagnostics` (`:146`), `deviceCommandTransition` (`:197`), `restartServicesTransition` (`:251`), `setStoragePolicyTransition` (`:292`), `startSoftwareUpdateTransition` (`:335`), `advanceUpdate` (`:368`) | `deviceCommandTransition` mutates `audio.testToneUntil` (`:218`) |
| `actions.ts` (inline, no transition module) | `setActiveCamera` (`:196-200`), `setTabletLink` (`:209-235`), `updateSettingsPatch` (`:92-102`) | direct `store.setState` |

## 8. `SimState` slices (33) and who writes them

Source: `types.ts:849-884`. "Actions that write it" is computed from the action table in section 6 (a slice appears when its name occurs in that row's "State slices written", with `A3`, `D10` and `[W]` expanded); engine writers were read from the subsystem sources.

| # | Slice (types.ts:line in SimState) | Declared type (types.ts:line) | In snapshot (dems.sim.v1) | Actions that write it (from the action table) | Engine subsystems that write it |
|--:|---|---|---|---|---|
| 1 | `meta` (types.ts:850) | `MetaSlice` (types.ts:187) | yes | signIn, signInWithBiometric, recordBiometricFailure, signInWithSecurityKey, signOut, createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, scanCaseNumber, recover, addMarker, addNote, snapshot, verify, exportEvidence, archiveEvidence, exportAudit, exportLogs, inject, clearFault, loadScenario, resetDemo, runDiagnostics, setStoragePolicy, startSoftwareUpdate, pair, unpair, setTabletLink | auth-idle, session-machine, generator, maintenance (event counter; evidence counter at session-machine.ts:762 and :1031); audio (counters.item via addTimelineItem, session-machine.ts:169-178); section 10 rows 2, 3, 5, 6, 7 |
| 2 | `clock` (types.ts:851) | `ClockSlice` (types.ts:197) | no | loadScenario, resetDemo | clock (engine.ts:108-119) |
| 3 | `device` (types.ts:852) | `DeviceSlice` (types.ts:222) | yes | loadScenario, resetDemo | maintenance (softwareVersion after update, maintenance.ts:412-416) |
| 4 | `operators` (types.ts:853) | `SimOperator[]` (types.ts:231) | yes | loadScenario, resetDemo | - |
| 5 | `auth` (types.ts:854) | `AuthSlice` (types.ts:244) | no | signIn, signInWithBiometric, signInWithSecurityKey, signOut, touch | auth-idle (engine.ts:129-130; auth.ts:342-360) |
| 6 | `authLockout` (types.ts:855) | `AuthLockoutSlice` (types.ts:254) | yes | signIn, signInWithBiometric, recordBiometricFailure, signInWithSecurityKey | - |
| 7 | `pairing` (types.ts:856) | `PairingSlice` (types.ts:260) | yes | pair, unpair | - |
| 8 | `tabletLink` (types.ts:857) | `TabletLinkSlice` (types.ts:270) | yes | setTabletLink | - |
| 9 | `session` (types.ts:858) | `ActiveSession \| null` (types.ts:369) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, addMarker, addNote, snapshot, inject, loadScenario, resetDemo | session-machine (tickMachine, session-machine.ts:1160-1171); health (bytesWritten, health.ts:81-98); audio (timeline AUDIO_PEAK, audio.ts:241-251); generator (timeline AUTOSAVE, CHECK, HEALTH, generator.ts:75-124) |
| 10 | `lastSealedSessionId` (types.ts:859) | `string \| null` | yes | loadScenario, resetDemo | session-machine (seal, session-machine.ts:853) |
| 11 | `lastSealedAcknowledged` (types.ts:860) | `boolean` | yes | createSession, acknowledgeSummary, loadScenario, resetDemo | session-machine (seal, session-machine.ts:854) |
| 12 | `sessionHistory` (types.ts:861) | `SessionHistoryEntry[]` (types.ts:397) | yes | loadScenario, resetDemo | session-machine (seal, session-machine.ts:855; finishIncomplete, session-machine.ts:1036) |
| 13 | `activeCameraId` (types.ts:862) | `VideoTrackId` | yes | loadScenario, resetDemo, setActiveCamera | - |
| 14 | `cameras` (types.ts:863) | `CameraStatus[]` (types.ts:420) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo | - |
| 15 | `mics` (types.ts:864) | `MicStatus[]` (types.ts:437) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, resetClip, loadScenario, resetDemo | audio (clipLatched, audio.ts:226-228) |
| 16 | `audio` (types.ts:865) | `AudioSlice` (types.ts:471) | no | inject, resetClip, loadScenario, resetDemo | audio (20 Hz frames, audio.ts:240) |
| 17 | `storage` (types.ts:866) | `StorageSlice` (types.ts:496) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo | health (usedBytes, state, writeBytesPerSec, history, writeRateHistory, health.ts:81-119); generator (lastWriteVerifiedAt, generator.ts:60) |
| 18 | `storagePolicy` (types.ts:867) | `StoragePolicy` (types.ts:513) | yes | loadScenario, resetDemo, setStoragePolicy | - |
| 19 | `time` (types.ts:868) | `TimeSlice` (types.ts:525) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo | health (health.ts:121-141) |
| 20 | `network` (types.ts:869) | `NetworkSlice` (types.ts:549) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo | health (bandwidth, health.ts:143-154) |
| 21 | `security` (types.ts:870) | `SecuritySlice` (types.ts:594) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo | maintenance (SIGNED_FIRMWARE control detail after update, maintenance.ts:417-422) |
| 22 | `services` (types.ts:871) | `ServiceEntry[]` (types.ts:606) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo, restartServices | maintenance (update REBOOT resets startedAt, maintenance.ts:387-391) |
| 23 | `health` (types.ts:872) | `HealthSlice` (types.ts:634) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo | health (health.ts:63-79, 163-175) |
| 24 | `otherDevices` (types.ts:873) | `OtherDevice[]` (types.ts:646) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo, setTabletLink | - |
| 25 | `ports` (types.ts:874) | `PortStatus[]` (types.ts:654) | yes | createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, inject, clearFault, loadScenario, resetDemo | - |
| 26 | `evidence` (types.ts:875) | `EvidenceItem[]` (types.ts:699) | yes | verify, exportEvidence, archiveEvidence, inject, clearFault, loadScenario, resetDemo | session-machine (seal, session-machine.ts:849-856; finishIncomplete, session-machine.ts:1029-1033) |
| 27 | `events` (types.ts:876) | `SimEvent[]` (types.ts:740) | yes | signIn, signInWithBiometric, recordBiometricFailure, signInWithSecurityKey, signOut, createSession, beginPrecheck, acknowledgePrecheckWarnings, retryPrecheck, startRecording, stopRecording, cancel, recover, addMarker, addNote, snapshot, verify, exportEvidence, archiveEvidence, exportAudit, exportLogs, inject, clearFault, loadScenario, resetDemo, runDiagnostics, setStoragePolicy, startSoftwareUpdate, pair, unpair, setTabletLink | auth-idle (AUTH_EXPIRED, auth.ts:353); session-machine (PRECHECK_PASSED :553, PRECHECK_BLOCKED :618, FINALIZATION_STARTED :772, EVIDENCE_SEALED :866, SESSION_INCOMPLETE :1048, RECOVERY_COMPLETED :1060; session-machine.ts); generator (AUTOSAVE generator.ts:87, HEALTH_CHECK_OK :136, TIME_SYNC :147, STORAGE_WRITE_VERIFIED :155); maintenance (DIAGNOSTICS_COMPLETED maintenance.ts:172, SYSTEM_BOOT :397, UPDATE_COMPLETED :434) |
| 28 | `alerts` (types.ts:877) | `SimAlert[]` (types.ts:753) | yes | recover, inject, clearFault, acknowledgeAlert, loadScenario, resetDemo | - |
| 29 | `audit` (types.ts:878) | `AuditLogSlice` (types.ts:791) | yes | signIn, signInWithBiometric, recordBiometricFailure, signInWithSecurityKey, signOut, createSession, acknowledgePrecheckWarnings, startRecording, stopRecording, cancel, recover, addMarker, addNote, snapshot, acknowledgeSummary, verify, exportEvidence, archiveEvidence, exportAudit, exportLogs, inject, clearFault, loadScenario, resetDemo, runDiagnostics, deviceCommand, setStoragePolicy, startSoftwareUpdate, restartServices, pair, unpair, setTabletLink | auth-idle (AUTH_EXPIRED, auth.ts:348); session-machine (PRECHECK_PASSED :546, PRECHECK_BLOCKED :604, EVIDENCE_SEALED :859, SESSION_INCOMPLETE :1040, RECOVERY_COMPLETED :1056; session-machine.ts); generator (FRAME_HASH generator.ts:49, WRITE_VERIFIED :63, TIMESTAMP_CONFIRMED :100); maintenance (SYSTEM_BOOT maintenance.ts:392, UPDATE_COMPLETED :428) |
| 30 | `faults` (types.ts:879) | `FaultsSlice` (types.ts:844) | yes | recover, inject, clearFault, loadScenario, resetDemo | - |
| 31 | `diagnostics` (types.ts:880) | `DiagnosticsRun \| null` (types.ts:814) | yes | loadScenario, resetDemo, runDiagnostics | maintenance (advanceDiagnostics, maintenance.ts:146-180) |
| 32 | `update` (types.ts:881) | `UpdateSlice` (types.ts:821) | yes | loadScenario, resetDemo, startSoftwareUpdate | maintenance (advanceUpdate, maintenance.ts:368-441) |
| 33 | `settings` (types.ts:883) | `SettingsSlice` (types.ts:836) | yes | setPresentationMode, updateSettings | - |

Observations (all derivable from the table): `operators` and `device` are written only by `loadScenario` / `resetDemo` (seed rebuild) and, for `device`, by the engine after a software update; `pairing` is written only by `pair` and `unpair`; `cameras`, `ports` and `otherDevices` have no engine writer of their own and change only through `D10`; `audio`, `clock` and `auth` are the three slices outside the snapshot.

## 9. Selectors, views and derive functions

Names and line numbers come from the `export` lines (V3, V4). "Slices read" is transcribed from each function body. All are pure reads of `SimState` (or of a slice passed in); none performs I/O. Kind: *selector* = named `select*`; *pure function* = other exported function; interfaces, types and constants are listed so each export has a row.

### 9.1 `selectors.ts`: 89 exports

| # | Export (file:line) | Kind | Slices read | Note |
|--:|---|---|---|---|
| 1 | `selectAuth` (selectors.ts:44) | selector | auth |  |
| 2 | `selectIsSignedIn` (selectors.ts:45) | selector | auth |  |
| 3 | `selectOperator` (selectors.ts:46) | selector | auth, operators |  |
| 4 | `selectRole` (selectors.ts:48) | selector | auth, operators |  |
| 5 | `selectCan` (selectors.ts:49) | selector | auth, operators (+ static ROLE_PERMISSIONS, auth.ts:53) |  |
| 6 | `selectLockout` (selectors.ts:55) | selector | authLockout, clock |  |
| 7 | `selectLockoutSeconds` (selectors.ts:57) | selector | authLockout, clock |  |
| 8 | `selectIsLocked` (selectors.ts:59) | selector | authLockout, clock |  |
| 9 | `selectAttemptsRemaining` (selectors.ts:61) | selector | authLockout, clock |  |
| 10 | `LastSignOut` (selectors.ts:64) | interface | - |  |
| 11 | `selectLastSignOut` (selectors.ts:78) | selector | events | module-level WeakMap cache keyed on the events array (selectors.ts:71) |
| 12 | `selectOperatorById` (selectors.ts:100) | selector | operators |  |
| 13 | `selectSession` (selectors.ts:104) | selector | session |  |
| 14 | `selectSessionState` (selectors.ts:105) | selector | session |  |
| 15 | `selectIsRecording` (selectors.ts:106) | selector | session |  |
| 16 | `selectElapsedMs` (selectors.ts:112) | selector | session, clock | changes at 10 Hz (selectors.ts:109-111) |
| 17 | `selectElapsedSeconds` (selectors.ts:119) | selector | session, clock | 1 Hz |
| 18 | `selectTimeline` (selectors.ts:120) | selector | session |  |
| 19 | `selectPendingSummaryId` (selectors.ts:122) | selector | lastSealedSessionId, lastSealedAcknowledged |  |
| 20 | `selectSessionHistory` (selectors.ts:125) | selector | sessionHistory |  |
| 21 | `selectRecentSessions` (selectors.ts:127) | selector | sessionHistory |  |
| 22 | `selectSessionHistoryById` (selectors.ts:129) | selector | sessionHistory |  |
| 23 | `selectNextCaseNumber` (selectors.ts:136) | selector | meta (counters.caseNumber), clock |  |
| 24 | `selectHistoryTimeSources` (selectors.ts:138) | selector | sessionHistory |  |
| 25 | `selectCameras` (selectors.ts:147) | selector | cameras |  |
| 26 | `selectMics` (selectors.ts:148) | selector | mics |  |
| 27 | `selectCameraById` (selectors.ts:149) | selector | cameras |  |
| 28 | `selectMicById` (selectors.ts:150) | selector | mics |  |
| 29 | `selectDeviceById` (selectors.ts:152) | selector | cameras, mics, otherDevices |  |
| 30 | `DeviceStats` (selectors.ts:158) | interface | - |  |
| 31 | `selectDeviceStats` (selectors.ts:166) | selector | cameras, mics, otherDevices |  |
| 32 | `evidenceVolume` (selectors.ts:176) | pure function | storage (argument Pick<SimState,'storage'>) |  |
| 33 | `StorageSummary` (selectors.ts:180) | interface | - |  |
| 34 | `storageSummary` (selectors.ts:193) | pure function | storage (argument Pick<SimState,'storage'>) |  |
| 35 | `selectStorage` (selectors.ts:209) | selector | storage |  |
| 36 | `storageStateFor` (selectors.ts:212) | pure function | - (pure function of a percentage) |  |
| 37 | `selectEvidence` (selectors.ts:219) | selector | evidence |  |
| 38 | `selectEvidenceById` (selectors.ts:220) | selector | evidence |  |
| 39 | `EvidenceStats` (selectors.ts:223) | interface | - |  |
| 40 | `selectEvidenceStats` (selectors.ts:234) | selector | evidence, clock |  |
| 41 | `sealedHourly` (selectors.ts:249) | pure function | evidence, clock (argument Pick) |  |
| 42 | `selectSealedHourly` (selectors.ts:260) | selector | evidence, clock |  |
| 43 | `selectSealedToday` (selectors.ts:261) | selector | evidence, clock |  |
| 44 | `selectRecentEvents` (selectors.ts:266) | selector | events |  |
| 45 | `selectActiveAlerts` (selectors.ts:268) | selector | alerts |  |
| 46 | `selectWorstAlert` (selectors.ts:270) | selector | alerts |  |
| 47 | `selectUnacknowledgedAlertCount` (selectors.ts:275) | selector | alerts |  |
| 48 | `selectAuditTail` (selectors.ts:278) | selector | audit |  |
| 49 | `selectChainHead` (selectors.ts:279) | selector | audit |  |
| 50 | `SystemFlagParams` (selectors.ts:283) | interface | - |  |
| 51 | `SystemFlag` (selectors.ts:290) | interface | - |  |
| 52 | `SystemStatus` (selectors.ts:299) | interface | - |  |
| 53 | `SystemSeverity` (selectors.ts:305) | type | - |  |
| 54 | `SystemStatusDetail` (selectors.ts:312) | interface | - |  |
| 55 | `SYSTEM_FLAG_IDS` (selectors.ts:317) | constant | - (17 flag ids, selectors.ts:317-335) |  |
| 56 | `SystemFlagId` (selectors.ts:336) | type | - |  |
| 57 | `systemStatus` (selectors.ts:339) | pure function | session, faults, storage, security, cameras, mics, time, health, tabletLink (selectors.ts:346-367) |  |
| 58 | `selectSystemState` (selectors.ts:385) | selector | session, faults, storage, security, cameras, mics, time, health, tabletLink (memo deps, selectors.ts:386) | stableSelector closure (module-level single-entry memo) |
| 59 | `selectSystemStateValue` (selectors.ts:390) | selector | as selectSystemState |  |
| 60 | `selectSystemSeverity` (selectors.ts:392) | selector | as selectSystemState |  |
| 61 | `selectSystemFlagIds` (selectors.ts:395) | selector | as selectSystemState | WeakMap cache (selectors.ts:393) |
| 62 | `INTEGRITY_CHECKLIST_IDS` (selectors.ts:407) | constant | - (9 ids) |  |
| 63 | `IntegrityChecklistId` (selectors.ts:418) | type | - |  |
| 64 | `IntegrityCheckStatus` (selectors.ts:419) | type | - |  |
| 65 | `FLAG_CHECKLIST_ROW` (selectors.ts:426) | constant | - (flag id to checklist row map) |  |
| 66 | `selectIntegrityChecklist` (selectors.ts:457) | selector | as selectSystemState (flags only) | WeakMap cache (selectors.ts:448) |
| 67 | `selectClockNow` (selectors.ts:486) | selector | clock |  |
| 68 | `selectClockSecond` (selectors.ts:488) | selector | clock |  |
| 69 | `selectTabletLink` (selectors.ts:489) | selector | tabletLink |  |
| 70 | `selectPairing` (selectors.ts:490) | selector | pairing |  |
| 71 | `selectPrecheck` (selectors.ts:494) | selector | session |  |
| 72 | `selectFinalization` (selectors.ts:496) | selector | session |  |
| 73 | `selectRecovery` (selectors.ts:498) | selector | session |  |
| 74 | `selectActiveFaults` (selectors.ts:499) | selector | faults |  |
| 75 | `selectIsFaultActive` (selectors.ts:501) | selector | faults |  |
| 76 | `selectAlerts` (selectors.ts:504) | selector | alerts |  |
| 77 | `selectDiagnostics` (selectors.ts:505) | selector | diagnostics |  |
| 78 | `selectUpdate` (selectors.ts:506) | selector | update |  |
| 79 | `selectStoragePolicy` (selectors.ts:507) | selector | storagePolicy |  |
| 80 | `selectLastSealedSession` (selectors.ts:509) | selector | lastSealedSessionId, sessionHistory |  |
| 81 | `selectEvidenceBySessionId` (selectors.ts:512) | selector | evidence |  |
| 82 | `selectAuditChainBreak` (selectors.ts:515) | selector | faults, audit |  |
| 83 | `selectPowerFail` (selectors.ts:524) | selector | faults |  |
| 84 | `selectWriteRateHistory` (selectors.ts:529) | selector | storage (writeRateHistory) |  |
| 85 | `selectSettings` (selectors.ts:531) | selector | settings |  |
| 86 | `selectPresentationMode` (selectors.ts:533) | selector | settings |  |
| 87 | `STORAGE_ACTIVITY_EVENT_TYPES` (selectors.ts:535) | constant | - (10 event types, selectors.ts:535-546) |  |
| 88 | `isStorageActivityEvent` (selectors.ts:549) | pure function | - (argument: one SimEvent) |  |
| 89 | `selectStorageActivity` (selectors.ts:555) | selector | events |  |

### 9.2 `views.ts`: 26 exports

| # | Export (file:line) | Kind | Slices read | Note |
|--:|---|---|---|---|
| 1 | `eventCategory` (views.ts:26) | pure function | - (argument: one event; uses SIM_EVENT_CATEGORY, FAULT_EVENT_CATEGORY) |  |
| 2 | `selectEventsByCategory` (views.ts:35) | selector | events |  |
| 3 | `NetworkTimeSource` (views.ts:46) | type | - |  |
| 4 | `networkTimeSource` (views.ts:65) | pure function | - (argument: one event) |  |
| 5 | `selectNetworkTimeEvents` (views.ts:74) | selector | events |  |
| 6 | `EXPORT_TRANSFER_WINDOW_MS` (views.ts:86) | constant | - (20 000 ms) |  |
| 7 | `lastExportAt` (views.ts:89) | pure function | events (argument: the events array) |  |
| 8 | `domainState` (views.ts:102) | pure function | cameras, network, tabletLink, update, events |  |
| 9 | `selectDomainStates` (views.ts:124) | selector | clock, cameras, network, tabletLink, update, events |  |
| 10 | `AvSyncView` (views.ts:136) | interface | - |  |
| 11 | `selectAvSync` (views.ts:147) | selector | cameras, mics, time |  |
| 12 | `DriveTempLevel` (views.ts:160) | type | - |  |
| 13 | `DRIVE_TEMP_LIMITS` (views.ts:163) | constant | - |  |
| 14 | `DRIVE_POWER_ON_HOURS_AT_LOAD` (views.ts:169) | constant | - (2 184) |  |
| 15 | `DriveHealth` (views.ts:173) | interface | - |  |
| 16 | `driveTemperature` (views.ts:197) | pure function | - (arguments from health) |  |
| 17 | `driveHealth` (views.ts:206) | pure function | health (storageTempC, cpuTempC), clock, meta (createdAt) |  |
| 18 | `selectDriveHealth` (views.ts:224) | selector | storage (volumes), health (storageTempC, cpuTempC), clock, meta (createdAt) | stableSelector (views.ts:224) |
| 19 | `serviceStartedAt` (views.ts:239) | pure function | audit, meta (+ one service entry) |  |
| 20 | `selectServicesSince` (views.ts:252) | selector | services, audit, meta |  |
| 21 | `ReleaseInfo` (views.ts:263) | interface | - |  |
| 22 | `SBOM_COMPONENT_COUNT` (views.ts:272) | constant | - (27) |  |
| 23 | `releaseInfo` (views.ts:275) | pure function | - (pure function of a version string) |  |
| 24 | `selectReleaseInfo` (views.ts:288) | selector | update (currentVersion) | module-level Map cache per version (views.ts:286) |
| 25 | `LogBundle` (views.ts:300) | interface | - |  |
| 26 | `logBundle` (views.ts:313) | pure function | device, clock, audit, events |  |

### 9.3 `derive.ts`: 11 exports

| # | Export (file:line) | Kind | Slices read | Note |
|--:|---|---|---|---|
| 1 | `EVIDENCE_TAMPER_PREFIX` (derive.ts:35) | constant | - |  |
| 2 | `GNSS_SATELLITES_LOCKED` (derive.ts:38) | constant | - (11) |  |
| 3 | `patchIfChanged` (derive.ts:41) | pure function | - (generic helper) |  |
| 4 | `mapIfChanged` (derive.ts:49) | pure function | - (generic helper) |  |
| 5 | `isFaultActive` (derive.ts:59) | pure function | faults (argument FaultsSlice) |  |
| 6 | `isEnclosureTamper` (derive.ts:72) | pure function | - (argument: one active fault) |  |
| 7 | `CAMERA_PORT` (derive.ts:199) | constant | - |  |
| 8 | `CAMERA_POE_DRAW_W` (derive.ts:208) | constant | - (18.6 W) |  |
| 9 | `POE_TOTAL_PORTS` (derive.ts:210) | constant | - (2) |  |
| 10 | `POE_SPARE_PORTS` (derive.ts:211) | constant | - (1) |  |
| 11 | `deriveDeviceState` (derive.ts:217) | pure function | reads faults, session, cameras, mics, network, ports, otherDevices, tabletLink, health, storage, time, security, services; WRITES D10: cameras, mics, network, ports, otherDevices, health, storage, time, security, services (derive.ts:217-311) | the only function that derives device state from faults and the session |

### 9.4 `devices.ts`: 24 exports (outside the three-file count; re-exported by `index.ts:24`)

| # | Export (file:line) | Kind | Slices read |
|--:|---|---|---|
| 1 | `PoeStatus` (devices.ts:18) | interface | - |
| 2 | `POE_PORT_BUDGET_W` (devices.ts:35) | constant | - (30 W) |
| 3 | `poeStatus` (devices.ts:37) | pure function | network (poe), cameras |
| 4 | `selectPoeStatus` (devices.ts:53) | selector | network (poe), cameras |
| 5 | `PlatformDeviceId` (devices.ts:57) | type | - |
| 6 | `PLATFORM_DEVICE_NAMES` (devices.ts:60) | constant | - |
| 7 | `PlatformDevice` (devices.ts:66) | interface | - |
| 8 | `platformDevices` (devices.ts:80) | pure function | time (gnss), security (tpm), faults |
| 9 | `selectPlatformDevices` (devices.ts:106) | selector | time (gnss), security (tpm), faults |
| 10 | `LED_IDS` (devices.ts:110) | constant | - |
| 11 | `FrontPanelLeds` (devices.ts:117) | type | - |
| 12 | `LED_RANK` (devices.ts:120) | constant | - |
| 13 | `frontPanelLeds` (devices.ts:125) | pure function | session, faults, network, tabletLink, storage, alerts |
| 14 | `FrontPanelLcd` (devices.ts:147) | interface | - |
| 15 | `FrontPanel` (devices.ts:162) | interface | - |
| 16 | `frontPanel` (devices.ts:167) | pure function | session, faults, network, tabletLink, storage, alerts, cameras, mics, time (source) |
| 17 | `selectFrontPanel` (devices.ts:194) | selector | session, faults, network, tabletLink, storage, alerts, cameras, mics, time (source) |
| 18 | `DeviceHealthMetric` (devices.ts:201) | type | - |
| 19 | `DeviceHealthPoint` (devices.ts:203) | interface | - |
| 20 | `DeviceHealthSeries` (devices.ts:209) | interface | - |
| 21 | `DEVICE_HEALTH_METRIC` (devices.ts:219) | constant | - |
| 22 | `DEVICE_HEALTH_POINTS` (devices.ts:233) | constant | - (90) |
| 23 | `deviceHealthSeries` (devices.ts:267) | pure function | cameras, network (bandwidth.history, poe), time (history, offsetMs), health (series, micLevels), faults, tabletLink, security (tpm), session, clock |
| 24 | `selectDeviceHealthSeries` (devices.ts:337) | selector | cameras, network (bandwidth.history), time (history), health (series, micLevels), faults, tabletLink, security (tpm), session (state), clock (1 s bucket, GNSS only); keyed by device id |

## 10. Engine subsystems and tick rates

Scheduler: `setInterval`-style tick every `ENGINE_INTERVAL_MS` 50 ms (`constants.ts:22`, `engine.ts:283`). Each tick builds `{now, dtMs, tickIndex}` (`engine.ts:263-272`) and runs the subsystems in the order below; a throw is reported through `report` and the next subsystem still runs (`engine.ts:272-278`). Hidden host: the scheduler pauses and the snapshot flushes; visible again: one catch-up tick with the elapsed `dtMs` (`engine.ts:292-300`). The scheduler starts only after hydration (`engine.ts:282`).

| # | Subsystem | Defined | Rate or trigger | Slices it writes | Audit and event types it emits |
|--:|---|---|---|---|---|
| 1 | `clock` | `engine.ts:108-119` | publishes `clock.now` when it moved by at least `CLOCK_TICK_MS` 100 ms (`constants.ts:24`; `engine.ts:113-115`) | `clock` | none |
| 2 | `auth-idle` | `engine.ts:122-133` | at most once per `HEALTH_TICK_MS` 1 s (`:127`); expires after `AUTH_IDLE_TIMEOUT_MS` 15 min (`constants.ts:54`; `auth.ts:345`) | `auth` (EXPIRED), A3 | audit `AUTH_EXPIRED` (`auth.ts:348`); event `AUTH_EXPIRED` (`:353`) |
| 3 | `session-machine` | `engine.ts:136-146` | every tick while `state.session !== null` (`:141`); due transitions fire at their scheduled time (`session-machine.ts:11-13`); at most 8 passes per call (`:1162`) | `session`, D10, `evidence`, `sessionHistory`, `lastSealedSessionId`, `lastSealedAcknowledged`, A3 | audit and event `PRECHECK_PASSED` (system-armed, `:546,553`), `PRECHECK_BLOCKED` (`:604,618`), `EVIDENCE_SEALED` (`:859,866`), `SESSION_INCOMPLETE` (`:1040,1048`), `RECOVERY_COMPLETED` (`:1056,1060`); event `FINALIZATION_STARTED` (`:772`) |
| 4 | `health` | `health.ts:177-191` | 1 Hz: one step per new whole second of the sim clock (`:183-190`); a catch-up appends one series point (`:14-15`) | `health`, `storage`, `session` (`bytesWritten`), `time`, `network` | none |
| 5 | `audio` | `audio.ts:153-255` | 20 Hz: one frame per 50 ms slot, `AUDIO_FRAME_MS` (`constants.ts:26`; `audio.ts:162-165`); one peak near -3.1 dBFS every 90-180 s on the speaking channel (`constants.ts:91-92`) | `audio`, `mics` (`clipLatched`), `session` (timeline `AUDIO_PEAK`), `meta` (item counter) | none (timeline item only) |
| 6 | `generator` | `generator.ts:171-215` | while RECORDING: Poisson process, mean `RECORDING_EVENT_MEAN_MS` 8 s (`constants.ts:30`; `generator.ts:188-198`); otherwise one event per `IDLE_EVENT_INTERVAL_MS` 60 s (`constants.ts:32`; `generator.ts:203-209`); catch-up at most `GENERATOR_CATCH_UP_MAX` 120 rows (`constants.ts:84`; `generator.ts:192`) | `audit`, `events`, `meta`, `storage` (`lastWriteVerifiedAt`), `session` (timeline `AUTOSAVE`, `CHECK`, `HEALTH`) | audit `FRAME_HASH` (`:49`), `WRITE_VERIFIED` (`:63`), `TIMESTAMP_CONFIRMED` (`:100`); events `AUTOSAVE` (`:87`), `HEALTH_CHECK_OK` (`:136`), `TIME_SYNC` (`:147-148`), `STORAGE_WRITE_VERIFIED` (`:155`) |
| 7 | `maintenance` | `maintenance.ts:444-454` | every tick, returns at once unless a diagnostics run is incomplete or an update is RUNNING (`:449`) | `diagnostics`, `update`, `services`, `device`, `security`, A3 | event `DIAGNOSTICS_COMPLETED` (`:172`); audit and event `SYSTEM_BOOT` (`:392,397`), `UPDATE_COMPLETED` (`:428,434`) |

Timing constants (all in `constants.ts`): precheck 8 checks of 300-700 ms each, gate at most 4 900 ms (`:64-65,78`); STOPPING 1 500 ms (`:66`); 6 finalization steps of 600-1 200 ms (`:67-68`; order `session-machine.ts:97-104`); recovery 3 000 ms with the scan stage 1 500 ms (`:69,80`); 8 diagnostics checks of 300-600 ms (`:100-101`; `maintenance.ts:35-44`); update steps 800-1 600 ms, REBOOT 3 000 ms (`:102-105`); session timeline AUTOSAVE at most once per minute, CHECK every 2 min, HEALTH every 5 min (`:86-88`); snapshot write throttle 1 000 ms (`:18`).

Determinism: streams are seeded from `DEFAULT_SEED` (`constants.ts:9`) through `createRngStreams(seed, 0)` (`engine.ts:225`), re-derived by epoch after hydration (`engine.ts:239`); stream names `rng.ts:120-134` plus `audio:turns` (`audio.ts:166`) and `update` (`maintenance.ts:342`). `SimClock` is injected: `createSimClock` follows real time times a `speed` factor (`clock.ts:22-32`), `createManualClock` is the test clock (`:34-47`). `Sim` exposes 16 members (`engine.ts:63-92`): `store, actions, clock, rng, seed, ready, isReady, wasRestored, start, stop, isRunning, tick, flush, destroy, errors, request`. `createSim` takes 11 options (`types.ts:139-162`): `seed, scenario, clock, scheduler, storage, authStorage, visibility, timers, persistThrottleMs, initialPairing, onError`.

## 11. Snapshot keys and persistence

| Item | Value | Source |
|---|---|---|
| Snapshot storage key | `dems.sim.v1` (`SIM_STORAGE_KEY`); schema version 1 (`SIM_SNAPSHOT_VERSION`) | `constants.ts:12,14` |
| Operator record key | `dems.auth` (`AUTH_STORAGE_KEY`); value `{operatorId, issuedAt}`, never a password; web default session storage, mobile memory only | `constants.ts:16`; `types.ts:92-105` |
| Snapshot = state minus | `audio`, `clock`, `auth` | `store.ts:73-76`; `types.ts:76` |
| `SNAPSHOT_KEYS` (30, state order) | `meta, device, operators, authLockout, pairing, tabletLink, session, lastSealedSessionId, lastSealedAcknowledged, sessionHistory, activeCameraId, cameras, mics, storage, storagePolicy, time, network, security, services, health, otherDevices, ports, evidence, events, alerts, audit, faults, diagnostics, update, settings` | `store.ts:24-55` |
| Required keys | 29 (`settings` is optional: `ADDED_SNAPSHOT_KEYS`) | `store.ts:62-65` |
| Usable snapshot | every required key; `meta.schemaVersion` equals the current version; `meta.seed` equals the current seed; numeric `meta.epoch`; `evidence` is an array; `audit` is an object | `store.ts:79-94` |
| Merge on hydration | persisted slices win; `meta.epoch` + 1; `audio`, `clock`, `auth` come from the live state; another version -> `migrate` returns `{}` (dropped, not migrated); a rejected snapshot is reported and the fresh state stands | `store.ts:115-134`; `engine.ts:244-250` |
| Write policy | zustand `persist` with `partialize`; throttled to one write per second; flushed on hide, stop and `flush()`; writes stay off until hydration finished | `store.ts:109-138`; `engine.ts:206-210,295,328,349`; `constants.ts:18` |
| Credentials in storage | the test asserts the pairing code and the demo password never reach the stored snapshot (values withheld here) | `sim-platform-neutral.test.ts:146,148-149` |

## 12. Error codes

### 12.1 `SimErrorCode` (15 members, `errors.ts:10-41`) and where each is produced

| Code | Produced at | Class |
|---|---|---|
| `ILLEGAL_STATE` | default code (`errors.ts:67`); `requireSession` `session-machine.ts:135-141` | `SimTransitionError` |
| `REASON_TOO_SHORT` | `session-machine.ts:695` | `SimTransitionError` |
| `NOTE_INVALID` | `session-machine.ts:1089` | `SimTransitionError` |
| `CHECKS_RUNNING` | `session-machine.ts:531,636` | `SimTransitionError` |
| `NO_WARNINGS` | `session-machine.ts:636` | `SimTransitionError` |
| `SESSION_ACTIVE` | `maintenance.ts:254,340` | `SimTransitionError` |
| `RECORDING_ACTIVE` | `maintenance.ts:215` | `SimTransitionError` |
| `POLICY_RANGE` | `maintenance.ts:297,302` | `SimTransitionError` |
| `UNSEALED_EVIDENCE` | `evidence-actions.ts:201` | `SimTransitionError` |
| `COMMAND_UNSUPPORTED` | `maintenance.ts:212` | `SimTransitionError` |
| `NOT_FOUND` | `evidence-actions.ts:51`, `faults.ts:228`, `maintenance.ts:210` | `SimNotFoundError` (`errors.ts:79-90`) |
| `NOT_SIGNED_IN` | `auth.ts:86` | `SimPermissionError` |
| `NOT_PERMITTED` | `auth.ts:88`; default code (`errors.ts:103`), used by `evidence-actions.ts:196` | `SimPermissionError` |
| `INVALID_INPUT` | no throw site in `src/sim`; appears as a result reason (`session-machine.ts:373,385`) and an HTTP code (`api.ts:372,375`) | none |
| `NOT_IMPLEMENTED` | deprecated, no action throws it (`errors.ts:39,44-59`) | `SimNotImplementedError` |

Classes: `SimNotImplementedError` (`errors.ts:48`), `SimTransitionError` (`:62`), `SimNotFoundError` (`:79`), `SimPermissionError` (`:98`); `simErrorCode(error)` (`:117-127`) returns the code or `null`; `describeError` (`:130-135`). Uncoded throws (`simErrorCode` gives `null`): `RangeError` for an unknown scenario (`scenarios.ts:162,201`) and for `Rng.pick` on an empty array (`rng.ts:82`); `TypeError` in `canonicalJSON` (`events.ts:39,54`); `Error` in `platform.ts:82` and `react.ts:62`. The 25 throw sites are the V10 output.

### 12.2 Result-type reasons (not `SimErrorCode` members)

| Result type | Reasons | Source |
|---|---|---|
| `SignInResult` | `INVALID_CREDENTIALS` (with `attemptsRemaining`), `LOCKED` (with `lockedUntil`, `retryInMs`) | `types.ts:890-893` |
| `CreateSessionResult` | `SESSION_ACTIVE`, `NOT_SIGNED_IN`, `NOT_PERMITTED`, `INVALID_INPUT` | `types.ts:895-901` |
| `PairResult` | `INVALID_CODE` (with `attemptsRemaining`), `LOCKED` | `types.ts:903-906` |
| `ExportResult` | status 202 ok; 401 `NOT_SIGNED_IN`; 403 `FORBIDDEN`; 404 `NOT_FOUND`; 409 `NOT_SEALED`; 409 `SECURITY_FAULT`; 422 `INVALID_REASON` | `types.ts:943-949` |
| `ChainVerifyResult` | `HASH_MISMATCH`, `PREV_LINK_BROKEN`, `SEQ_GAP` (with `index`, `seq`) | `types.ts:951-960` |

### 12.3 Simulated REST error codes (17 distinct, `api.ts`)

Routes: 9 (`SIM_API_ROUTES`, `api.ts:42-52`); `GET /api/v1/health` is served by mock-core, not here (`api.ts:13`). Error envelope `{ error: { code, message } }` (`api.ts:56-58`).

| Code | HTTP status | Source |
|---|--:|---|
| `NOT_SIGNED_IN` | 401 | `api.ts:356,485` |
| `NOT_PERMITTED` | 403 | `api.ts:358,486` |
| `FORBIDDEN` | 403 (export refusal) | `api.ts:331-341` via `result.status` |
| `INVALID_INPUT` | 422 | `api.ts:372,375` |
| `INVALID_REASON` | 422 | `api.ts:442,489`; export refusal `:340` |
| `NOT_FOUND` | 404 | `api.ts:404,439,492,508` |
| `PRECHECK_BLOCKED` | 409 | `api.ts:421` |
| `PRECHECK_WARNINGS` | 409 | `api.ts:424` |
| `PRECHECK_RUNNING` | 409 | `api.ts:426` |
| `INVALID_STATE` | 409 | `api.ts:428,440,490` |
| `SESSION_ACTIVE` | 409 | `api.ts:375` |
| `NOT_SEALED` | 409 | `api.ts:331-341` |
| `SECURITY_FAULT` | 409 | `api.ts:331-341` |
| `METHOD_NOT_ALLOWED` | 405 (header `allow`) | `api.ts:511` |
| `INVALID_PATH` | 400 | `api.ts:493,504` |
| `INVALID_JSON` | 400 | `api.ts:516` |
| `SIMULATOR_ERROR` | 500 | `api.ts:494` |

Thrown-error mapping (`api.ts:481-495`): `SimPermissionError` -> 401 `NOT_SIGNED_IN` or 403 `NOT_PERMITTED`; `SimTransitionError` -> 422 `INVALID_REASON` for `REASON_TOO_SHORT`, else 409 `INVALID_STATE`; `SimNotFoundError` -> 404; `URIError` -> 400 `INVALID_PATH`; anything else -> 500 `SIMULATOR_ERROR`. The request handler never throws (`api.ts:498-522`).

## 13. Audit and event vocabulary: every type, its category and its emit sites

Categories: `AuditCategory` 8 values (`vocabulary.ts:279-288`: AUTH, SESSION, EVIDENCE, DEVICE, SECURITY, STORAGE, PAIRING, SYSTEM); `SimEventCategory` 10 values (`vocabulary.ts:473-484`). Emit sites were found as `type: '<NAME>'` literals inside an `audit:` or `event:` block (two ternary sites added by hand: `evidence-actions.ts:84,99` and `actions.ts:226`). "Emitted by": *action* (reached from a `SimActions` member), *engine (...)* (a subsystem), *seed* (`dataset.ts`, `buildHistory`), *scenario build* (`scenarios.ts:89,95`).

Counts: 34 audit types have an action emit site, 9 are engine-only (`AUTH_EXPIRED`, `PRECHECK_BLOCKED`, `EVIDENCE_SEALED`, `SESSION_INCOMPLETE`, `FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED`, `RECOVERY_COMPLETED`, `UPDATE_COMPLETED`), 1 is seed-only (`EVIDENCE_REVIEW_OPENED`): 34 + 9 + 1 = 44. For events: 32 action, 12 engine-only (`HEALTH_CHECK_OK`, `TIME_SYNC`, `AUTH_EXPIRED`, `PRECHECK_BLOCKED`, `FINALIZATION_STARTED`, `EVIDENCE_SEALED`, `SESSION_INCOMPLETE`, `AUTOSAVE`, `RECOVERY_COMPLETED`, `STORAGE_WRITE_VERIFIED`, `DIAGNOSTICS_COMPLETED`, `UPDATE_COMPLETED`), 2 seed-only (`EVIDENCE_REVIEW`, `UPDATE_AVAILABLE`): 32 + 12 + 2 = 46. Every audit type and every event type has at least one emit site.

### 13.1 AuditType: 44 members (vocabulary.ts:291-343), category map vocabulary.ts:347-392

| # | AuditType (vocabulary.ts:line) | Category | Audit emit sites (file:line) | Emitted by |
|--:|---|---|---|---|
| 1 | `AUTH_SUCCESS` (vocabulary.ts:293) | AUTH | auth.ts:217, dataset.ts:590, scenarios.ts:89 | action, scenario build, seed |
| 2 | `AUTH_FAILED` (vocabulary.ts:294) | AUTH | auth.ts:252 | action |
| 3 | `AUTH_LOCKED` (vocabulary.ts:295) | AUTH | auth.ts:185 | action |
| 4 | `AUTH_SIGNED_OUT` (vocabulary.ts:296) | AUTH | auth.ts:327 | action |
| 5 | `AUTH_EXPIRED` (vocabulary.ts:297) | AUTH | auth.ts:348 | engine (auth-idle) |
| 6 | `SESSION_CREATED` (vocabulary.ts:299) | SESSION | dataset.ts:604, session-machine.ts:319 | action, seed |
| 7 | `PRECHECK_PASSED` (vocabulary.ts:300) | SESSION | dataset.ts:619, session-machine.ts:546 | action + engine, seed |
| 8 | `PRECHECK_BLOCKED` (vocabulary.ts:301) | SESSION | session-machine.ts:604 | engine (session-machine) |
| 9 | `RECORDING_STARTED` (vocabulary.ts:302) | SESSION | dataset.ts:628, session-machine.ts:669 | action, seed |
| 10 | `RECORDING_STOPPED` (vocabulary.ts:303) | SESSION | dataset.ts:692, session-machine.ts:709 | action, seed |
| 11 | `SESSION_CANCELLED` (vocabulary.ts:304) | SESSION | session-machine.ts:730 | action |
| 12 | `EVIDENCE_SEALED` (vocabulary.ts:305) | EVIDENCE | dataset.ts:702, session-machine.ts:859 | engine (session-machine), seed |
| 13 | `SESSION_INCOMPLETE` (vocabulary.ts:306) | SESSION | dataset.ts:673, session-machine.ts:1040 | engine (session-machine), seed |
| 14 | `SUMMARY_ACKNOWLEDGED` (vocabulary.ts:307) | SESSION | session-machine.ts:1149 | action |
| 15 | `MARKER_ADDED` (vocabulary.ts:308) | SESSION | session-machine.ts:1075 | action |
| 16 | `NOTE_ADDED` (vocabulary.ts:309) | SESSION | session-machine.ts:1109 | action |
| 17 | `SNAPSHOT_TAKEN` (vocabulary.ts:310) | SESSION | session-machine.ts:1134 | action |
| 18 | `FRAME_HASH` (vocabulary.ts:312) | EVIDENCE | generator.ts:49 | engine (generator) |
| 19 | `WRITE_VERIFIED` (vocabulary.ts:313) | STORAGE | generator.ts:63 | engine (generator) |
| 20 | `TIMESTAMP_CONFIRMED` (vocabulary.ts:314) | SECURITY | generator.ts:100 | engine (generator) |
| 21 | `EVIDENCE_VERIFIED` (vocabulary.ts:316) | EVIDENCE | evidence-actions.ts:84 | action |
| 22 | `EVIDENCE_VERIFY_FAILED` (vocabulary.ts:317) | EVIDENCE | evidence-actions.ts:84 | action |
| 23 | `EVIDENCE_REVIEW_OPENED` (vocabulary.ts:318) | EVIDENCE | dataset.ts:725 | seed |
| 24 | `EVIDENCE_EXPORTED` (vocabulary.ts:319) | EVIDENCE | dataset.ts:750, evidence-actions.ts:174 | action, seed |
| 25 | `EXPORT_DENIED` (vocabulary.ts:320) | SECURITY | evidence-actions.ts:131, evidence-actions.ts:251 | action |
| 26 | `EVIDENCE_ARCHIVED` (vocabulary.ts:321) | EVIDENCE | evidence-actions.ts:214 | action |
| 27 | `AUDIT_EXPORTED` (vocabulary.ts:322) | SECURITY | evidence-actions.ts:286 | action |
| 28 | `FAULT_RAISED` (vocabulary.ts:324) | DEVICE | dataset.ts:647, faults.ts:298 | action, seed |
| 29 | `FAULT_CLEARED` (vocabulary.ts:325) | DEVICE | faults.ts:373 | action |
| 30 | `RECOVERY_STARTED` (vocabulary.ts:326) | SYSTEM | dataset.ts:665, session-machine.ts:957 | action, seed |
| 31 | `RECOVERY_COMPLETED` (vocabulary.ts:327) | SYSTEM | session-machine.ts:1056 | engine (session-machine) |
| 32 | `AUDIT_CHAIN_DISCONTINUITY` (vocabulary.ts:328) | SECURITY | faults.ts:277 | action |
| 33 | `PAIRING_SUCCESS` (vocabulary.ts:330) | PAIRING | pairing.ts:64 | action |
| 34 | `PAIRING_FAILED` (vocabulary.ts:331) | PAIRING | pairing.ts:103 | action |
| 35 | `PAIRING_LOCKED` (vocabulary.ts:332) | PAIRING | pairing.ts:33 | action |
| 36 | `UNPAIRED` (vocabulary.ts:333) | PAIRING | pairing.ts:132 | action |
| 37 | `TABLET_LINK_CHANGED` (vocabulary.ts:335) | DEVICE | actions.ts:219 | action |
| 38 | `DEVICE_COMMAND` (vocabulary.ts:336) | DEVICE | maintenance.ts:230, maintenance.ts:267 | action |
| 39 | `DIAGNOSTICS_RUN` (vocabulary.ts:337) | DEVICE | maintenance.ts:134 | action |
| 40 | `STORAGE_POLICY_CHANGED` (vocabulary.ts:338) | STORAGE | maintenance.ts:317 | action |
| 41 | `UPDATE_STARTED` (vocabulary.ts:339) | SYSTEM | maintenance.ts:353 | action |
| 42 | `UPDATE_COMPLETED` (vocabulary.ts:340) | SYSTEM | maintenance.ts:428 | engine (maintenance) |
| 43 | `SCENARIO_LOADED` (vocabulary.ts:341) | SYSTEM | scenarios.ts:217 | action |
| 44 | `SYSTEM_BOOT` (vocabulary.ts:342) | SYSTEM | dataset.ts:827, maintenance.ts:392, session-machine.ts:947 | action, engine (maintenance), seed |

### 13.2 SimEventType: 46 members (vocabulary.ts:395-442), category map vocabulary.ts:488-535

| # | SimEventType (vocabulary.ts:line) | Category | Event emit sites (file:line) | Emitted by |
|--:|---|---|---|---|
| 1 | `SYSTEM_BOOT` (vocabulary.ts:396) | SYSTEM | dataset.ts:832, maintenance.ts:397, session-machine.ts:952 | action, engine (maintenance), seed |
| 2 | `HEALTH_CHECK_OK` (vocabulary.ts:397) | SYSTEM | dataset.ts:849, generator.ts:136 | engine (generator), seed |
| 3 | `TIME_SYNC` (vocabulary.ts:398) | TIME | dataset.ts:840, generator.ts:147, generator.ts:148 | engine (generator), seed |
| 4 | `AUTH_LOGIN` (vocabulary.ts:399) | AUTH | auth.ts:223, dataset.ts:596, scenarios.ts:95 | action, scenario build, seed |
| 5 | `AUTH_LOGOUT` (vocabulary.ts:400) | AUTH | auth.ts:333 | action |
| 6 | `AUTH_FAILED` (vocabulary.ts:401) | AUTH | auth.ts:266 | action |
| 7 | `AUTH_LOCKED` (vocabulary.ts:402) | AUTH | auth.ts:192 | action |
| 8 | `AUTH_EXPIRED` (vocabulary.ts:403) | AUTH | auth.ts:353 | engine (auth-idle) |
| 9 | `SESSION_CREATED` (vocabulary.ts:404) | SESSION | dataset.ts:611, session-machine.ts:325 | action, seed |
| 10 | `PRECHECK_STARTED` (vocabulary.ts:405) | SESSION | session-machine.ts:515 | action |
| 11 | `PRECHECK_PASSED` (vocabulary.ts:406) | SESSION | session-machine.ts:553 | action + engine |
| 12 | `PRECHECK_BLOCKED` (vocabulary.ts:407) | SESSION | session-machine.ts:618 | engine (session-machine) |
| 13 | `RECORDING_STARTED` (vocabulary.ts:408) | SESSION | dataset.ts:634, session-machine.ts:676 | action, seed |
| 14 | `RECORDING_STOPPED` (vocabulary.ts:409) | SESSION | session-machine.ts:716 | action |
| 15 | `SESSION_CANCELLED` (vocabulary.ts:410) | SESSION | session-machine.ts:736 | action |
| 16 | `FINALIZATION_STARTED` (vocabulary.ts:411) | EVIDENCE | session-machine.ts:772 | engine (session-machine) |
| 17 | `EVIDENCE_SEALED` (vocabulary.ts:412) | EVIDENCE | dataset.ts:709, session-machine.ts:866 | engine (session-machine), seed |
| 18 | `SESSION_INCOMPLETE` (vocabulary.ts:413) | SESSION | dataset.ts:680, session-machine.ts:1048 | engine (session-machine), seed |
| 19 | `EVIDENCE_EXPORTED` (vocabulary.ts:414) | EXPORT | dataset.ts:761, evidence-actions.ts:181 | action, seed |
| 20 | `EXPORT_DENIED` (vocabulary.ts:415) | EXPORT | evidence-actions.ts:139, evidence-actions.ts:258 | action |
| 21 | `EVIDENCE_VERIFIED` (vocabulary.ts:416) | EVIDENCE | evidence-actions.ts:99 | action |
| 22 | `EVIDENCE_VERIFY_FAILED` (vocabulary.ts:417) | EVIDENCE | evidence-actions.ts:99 | action |
| 23 | `EVIDENCE_REVIEW` (vocabulary.ts:418) | EVIDENCE | dataset.ts:731 | seed |
| 24 | `EVIDENCE_ARCHIVED` (vocabulary.ts:419) | EVIDENCE | evidence-actions.ts:220 | action |
| 25 | `MARKER_ADDED` (vocabulary.ts:420) | SESSION | session-machine.ts:1081 | action |
| 26 | `NOTE_ADDED` (vocabulary.ts:421) | SESSION | session-machine.ts:1115 | action |
| 27 | `SNAPSHOT_TAKEN` (vocabulary.ts:422) | SESSION | session-machine.ts:1140 | action |
| 28 | `AUTOSAVE` (vocabulary.ts:423) | STORAGE | generator.ts:87 | engine (generator) |
| 29 | `FAULT_RAISED` (vocabulary.ts:424) | DEVICE | dataset.ts:655, faults.ts:313 | action, seed |
| 30 | `FAULT_CLEARED` (vocabulary.ts:425) | DEVICE | faults.ts:379 | action |
| 31 | `RECOVERY_STARTED` (vocabulary.ts:426) | SYSTEM | session-machine.ts:963 | action |
| 32 | `RECOVERY_COMPLETED` (vocabulary.ts:427) | SYSTEM | session-machine.ts:1060 | engine (session-machine) |
| 33 | `STORAGE_WRITE_VERIFIED` (vocabulary.ts:428) | STORAGE | generator.ts:155 | engine (generator) |
| 34 | `STORAGE_POLICY_CHANGED` (vocabulary.ts:429) | STORAGE | maintenance.ts:324 | action |
| 35 | `DIAGNOSTICS_STARTED` (vocabulary.ts:430) | DEVICE | maintenance.ts:140 | action |
| 36 | `DIAGNOSTICS_COMPLETED` (vocabulary.ts:431) | DEVICE | maintenance.ts:172 | engine (maintenance) |
| 37 | `UPDATE_AVAILABLE` (vocabulary.ts:432) | SYSTEM | dataset.ts:857 | seed |
| 38 | `UPDATE_STARTED` (vocabulary.ts:433) | SYSTEM | maintenance.ts:360 | action |
| 39 | `UPDATE_COMPLETED` (vocabulary.ts:434) | SYSTEM | maintenance.ts:434 | engine (maintenance) |
| 40 | `PAIRED` (vocabulary.ts:435) | NETWORK | pairing.ts:71 | action |
| 41 | `UNPAIRED` (vocabulary.ts:436) | NETWORK | pairing.ts:137 | action |
| 42 | `PAIRING_FAILED` (vocabulary.ts:437) | NETWORK | pairing.ts:111 | action |
| 43 | `TABLET_CONNECTED` (vocabulary.ts:438) | NETWORK | actions.ts:226 | action |
| 44 | `TABLET_DISCONNECTED` (vocabulary.ts:439) | NETWORK | actions.ts:226 | action |
| 45 | `SCENARIO_LOADED` (vocabulary.ts:440) | SYSTEM | scenarios.ts:223 | action |
| 46 | `AUDIT_CHAIN_BROKEN` (vocabulary.ts:441) | SECURITY | faults.ts:290 | action |

## 14. Identifier generators and counters

| Identifier | Format | Generator | Counter or source |
|---|---|---|---|
| Audit row id | `AUD-NNNNNN` | `events.ts:112-114` | `audit.total + 1` (`events.ts:123`); also the row `seq` |
| Event id | `LOG-NNNNNN` | `events.ts:216-218` | `meta.counters.event` (`types.ts:169-170`) |
| Timeline, note, alert, diagnostics run | `TL-`, `NOTE-`, `ALR-`, `DIAG-` + `NNNNNN` | `events.ts:297-306` (`nextItemId`); prefixes at `session-machine.ts:172,1091`, `faults.ts:158`, `maintenance.ts:121` | one shared `meta.counters.item` (`types.ts:177-178`) |
| Session | `SES-YYYYMMDD-NNNN` | `dataset.ts:196-198` | `meta.counters.session` |
| Evidence item | `EV-YYYYMMDD-NNNN` | `dataset.ts:202-204` | `meta.counters.evidence` |
| Case number | `LP/YYYY/MMDD-NNNN` | `dataset.ts:199-201` | `meta.counters.caseNumber` (advanced by `scanCaseNumber` and by `createSession`, `session-machine.ts:388-391`) |
| Export | `EXP-NNNNNN` | `dataset.ts:105-107`; `nextExportId` `evidence-actions.ts:40-43` | `meta.counters.export`, continuing after `DATASET_EXPORT_SEQ` (`demo-alignment.ts:44`) |
| Fresh-store counters | event 1, item 1, session, caseNumber, evidence from `IDLE_COUNTERS` | `initial-state.ts:150-156`; `dataset.ts:228-232` | |

Ring and list bounds: events 500, audit 1 000 (`constants.ts:35-36`); alerts 100, series points 120, storage history points 24, session timeline 200 (`:38-41`). The audit row body hashed per row: `seq, id, at, type, category, severity, actorId, message, sessionId, evidenceId, deviceId, details` (`events.ts:69-84`); genesis hash is 64 zero digits (`constants.ts:44`). Time zone UTC+07:00 (`constants.ts:47-48`); all times are epoch milliseconds on the sim clock (`types.ts:65`).

## 15. Purity and platform neutrality

**Static guarantees already in the repository** (`packages/shared/test/sim-platform-neutral.test.ts`, run over every file of `src/sim`, `:187-229`): only `platform.ts` names web globals (`document`, `window`, `sessionStorage`, `localStorage`, `navigator`, `globalThis`; `:199-204`); no `Math.random`, `crypto`, `randomUUID`, `performance`, and `Date.now` only in `clock.ts`; bare `setTimeout`/`setInterval` only in `platform.ts` and `types.ts` (`:206-213`); only `react.ts` imports React and nothing imports `node:`, `react-native` or `expo` (`:215-229`). The same file runs a full session on injected async storage, visibility and scheduler with no web globals (`:90-152`).

**Pure and platform-neutral transition modules (class T, section 5):** `auth.ts`, `session-machine.ts`, `faults.ts`, `evidence-actions.ts`, `pairing.ts`, `scenarios.ts`, `maintenance.ts`. Pure derivations (R): `derive.ts`, `selectors.ts`, `views.ts`, `devices.ts`. Pure data and helpers (H): `clock.ts`, `constants.ts`, `dataset.ts`, `demo-alignment.ts`, `errors.ts`, `events.ts`, `evidence.ts`, `initial-state.ts`, `memo.ts`, `rng.ts`, `types.ts`, `vocabulary.ts`.

**Not pure but platform-neutral (S):** `actions.ts` (store and operator-record writes), `engine.ts` (scheduler, visibility, hydration; adapters injected), `store.ts` (zustand `persist` over an injected storage), `api.ts` (handler over a target), `audio.ts`, `generator.ts`, `health.ts` (pure step functions plus subsystem closures that hold timing state).

**Bound to a platform:** `platform.ts` (web storage, visibility, timers; every access guarded, `platform.ts:34-52,188-196`) and `react.ts` (React and zustand hooks).

**The exceptions to "pure" inside the transition modules:**

| Exception | Where | Effect |
|---|---|---|
| Operator record write requested by the transition | `auth.ts:149-154`; applied at `actions.ts:107-112` | `signIn` and related actions write `dems.auth` outside the state |
| Mutation of a transient runtime object | `maintenance.ts:197-218` (`audio.testToneUntil`) | `deviceCommand(TEST_SIGNAL)` changes audio behaviour without a state write |
| Dependency outside `src/sim` | `session-machine.ts:17` -> `../api/session-schema` -> `zod` and `../sim/vocabulary` (`api/session-schema.ts:23-25`); enums from `../domain` (4 files, no external imports) | the neutrality test scans `src/sim` only, so these two are checked by import reading, not by that test (no web or node globals found in them) |
| Module-level caches | `selectors.ts:71,393,448`; `views.ts:286`; `stableSelector` closures (`memo.ts:42-56`) | in-process memoisation, no effect on state |
| Seeded randomness | `rng.ts` (mulberry32, FNV-1a), stream names `rng.ts:120-134` | deterministic given seed and epoch |

**Package dependencies of `@dems/shared`** (`packages/shared/package.json:44-48`): `@noble/hashes` 2.4.0, `zod` 4.6.5, `zustand` 5.0.15; peer `react` 19.2.3. Node use outside tests: `packages/shared/scripts/gen-demo-evidence.ts:304-341` (F22).

## 16. Gaps / needs investigation

1. **Slice field shapes.** Section 8 gives slice names, the declared type and its `types.ts` line, not the field-level shapes (`types.ts:168-884`). Row 16 needs them; they were not reproduced here.
2. **Client use.** Which of the 126 + 24 exports and which of the 42 actions each page reads or calls, and which call sites use a return value, is for rows 3 and 4. Whether the clients gate on `SESSION_NOTE` and `EVIDENCE_VIEW` through `selectCan` (`selectors.ts:49`) is likewise open.
3. **Seeded entities.** `dataset.ts` (882 lines), `initial-state.ts`, `generator.ts` and `src/demo-data/` content, counts and date-relative rules are row 2. Only the seed-only audit and event types are noted here (F12).
4. **No execution.** No test, script or process was run (P7). Counts and behaviours come from source reading and static commands; the pass state of the 17 test files in `packages/shared/test/` that match `sim-*`, `session-machine`, `hash-chain`, `audio`, `auth`, `storage-math` and `openapi` (a heuristic selection, not a list the repository defines) is row 13. Behaviours such as "a catch-up tick yields the same timestamps" are quoted from comments and code, not observed.
5. **Node use is partial evidence.** `gen-demo-evidence.ts` uses the transition functions in a Node script (F22); no run of it was made, and no long-running Node process hosts the engine today.
6. **Non-sim dependencies.** `../domain` (4 files) and `../api/session-schema.ts` were checked for imports and for web or node globals only; their contents belong to row 2.
7. **Operator-facing copy.** Messages in transitions are English fallback text; the clients take copy from i18n by code (`errors.ts:3-6`, `selectors.ts:290-297`). The i18n catalogues were not inventoried.
8. **Credential handling.** Values of `DEMO_OPERATOR_PASSWORD` and `DEMO_PAIRING_CODE` appeared in tool output (a source listing and a test file) while this report was prepared and were not recorded in this file. Whether the 0.1.0 packages or the design extract reference those values elsewhere is not examined here.

---
*Generated: 2026-10-04 01:49*
*Last Updated: 2026-10-04 01:49*
