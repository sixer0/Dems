---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave J - driver J-S (packages/shared: simulator `src/sim`, the API contract; apps/core-server)
date: 2026-10-12
agent: coder-execution
source_brief: delegation_progress/fix_brief_wave_j.md (decision D243)
tree: 035150b + this wave's working tree (no git write)
status: complete - 1 BLOCKER, 9 MAJOR (server / shared halves), 5 MINOR, 1 NOTE fixed; 2 MAJOR-class and 6 MINOR items listed as not fixed, each with its reason
---

# Fix wave J, driver J-S - the simulator, the contract and the Core

Contract for the three client drivers: `delegation_progress/contract_wave_j.md` (sections J-S 1 to
J-S 13). Totals unmoved: **97 operations (36 GET / 61 POST), 67 audit types, schema 6 / dbc-7, no
migration** (the generator printed `97 operations`; counted from the document: 97 / 36 / 61).
Everything added is an optional member, a new value of an open code set, a refusal on a status an
operation already declares (or, for operation 41, one new documented status), or a reader over
members that exist.

The run was interrupted once by an API limit. On resume `git status`, `git diff --stat` and the
typecheck of both workspaces were clean of half-written edits: **no file of mine was left
half-applied.** The one thing found stale was `packages/shared/openapi/openapi.json` (generated
before the last schema member, `notMeasured` on the audio answers): regenerated under
`.locks/npm.lock`.

## 1. Every finding of this area

Severity as the reports give it. "Test" names the EXISTING test file that took the failing-first
test (one new test file exists, for the one new module `sim/system-truth.ts`).

### Fixed

| Id | Sev. | Cause (file:line before) | Fix (file:line now) | Test |
|---|---|---|---|---|
| JA2-01 / JW-01 | BLOCKER | `createEvidenceItem` built the item of an INCOMPLETE session with the whole integrity block of a seal (`sim/evidence.ts`, `buildItemIntegrity` for every status), and the hosted `verify` compared those values with themselves: PASS 6 of 6. The real Core hands such an item to the same hosted action (`sealing-host` answers null for an item without a package), so it had no other answer either | `neverSealedShape` (`packages/shared/src/sim/evidence.ts:213`): `sealedAt: null` = no track, the null digest (`EVIDENCE_NOT_SEALED_DIGEST`) in the two REQUIRED members, a placeholder signature, no v2 seal member, verification NOT_RUN. Applied where the item is made (`createEvidenceItem`, the seed `sim/dataset.ts`) AND where a stored row is read (`apps/core-server/src/db/mapping/rows.ts:638`: a kept database holds rows with the old block, some with a stored PASS). `verify` refuses a never-sealed item (`sim/evidence-actions.ts:88`, `UNSEALED_EVIDENCE` -> `409 NOT_SEALED`, the refusal operations 42 / 43 already give), no row, no custody entry; the Core words it for operation 41 (`modules/evidence/index.ts:107`). Readers `hasSealedValues`, `verificationOfRecordFailed` | shared `test/session-machine.test.ts` ("FAULT -> recover ... never sealed": shape, no 64-hex but the null digest, verify refused, nothing written; + a CONTROL case: a sealed session keeps its values; cancelled / failed start / recording / finalizing make no item), `test/sim-evidence-item-kind.test.ts`, `test/sim-contract.test.ts`, `test/sim-demo-data-alignment.test.ts`, `test/api-domain-operations.test.ts`; core-server `db/mapping/__tests__/from-rows.test.ts` (a row written BEFORE the wave comes back without any sealed value), `modules/evidence/__tests__/routes.test.ts`, `commands.db.test.ts`, `db/fixtures/__tests__/build.test.ts` |
| JA2-02 | MAJOR | A session sealed on a simulated Core has no media (the 14 bundled DEMO packages join the SEED items only) and operation 40 answered the reason of a missing package, `NOT_A_SEALED_PACKAGE`; its verdict was a bare PASS | CHOICE: a simulated session is a **demonstration record without media**, said by its own code: `media.reason: 'DEMONSTRATION_RECORD'` (`apps/core-server/src/evidence-facts/index.ts:239`), and every verdict the simulator computes carries `demonstration: true` (`sim/evidence.ts:441`; new optional member of `EvidenceVerifyResult`). The item and the list already say `integritySource: SIMULATED` | shared `test/sim-evidence-item-kind.test.ts`, `test/api-domain-operations.test.ts`; core-server `modules/evidence/__tests__/reads.db.test.ts` (MS-2), `bulk.db.test.ts`, `commands.db.test.ts`, `routes.test.ts` |
| JA2-03 / JW-03 | MAJOR | Operation 42 took `kind: COMPOSITE`, committed the request (export id, `EVIDENCE_EXPORTED` row and event) and only the job failed `COMPOSITE_ENCODER_NOT_SELECTED`; the simulator ignored the kind and completed a "Package"; no member said which outputs exist | Refused BEFORE the ticket, the hosted action and any job: `409 COMMAND_UNSUPPORTED`, `details.reason: COMPOSITE_ENCODER_NOT_SELECTED` (`evidence-export/service.ts:228`, in `admitRequest`, after the refusals of access; an unknown item stays 404). The simulator's own action refuses too (`sim/evidence-actions.ts:258`). Capability: ONE optional member of operation 40, `exportKinds` (`evidence-export/composite.ts:77` `exportKindsOf`). The event of a request that only queued a job says `params.exportPhase: 'REQUESTED'`, the completion `'COMPLETED'` (`exportPhaseOfEvent`, `sim/evidence-actions.ts:183`). The Live binding throws the refusal instead of reading it as NOT_SEALED (`live/source/bindings.ts:281`) | shared `test/sim-export-completion.test.ts`, `test/api-domain-operations.test.ts`, `test/live-source-bindings.test.ts`, `test/api-registry.test.ts`; core-server `modules/evidence-export/__tests__/routes.test.ts` (refused: no ticket, no command; CONTROL as PACKAGE), `modules/evidence/__tests__/commands.db.test.ts` (no command, no row, no event, no export record), `evidence-export/__tests__/export.test.ts`, `engine/__tests__/errors.test.ts` |
| JW-02 | MAJOR (server half: an answer) | `apps/core-web/.../detail-page.tsx:189-196` builds the file in the browser; it calls no operation | No operation returns the signed manifest alone and none may be added. Written into the contract (J-S 4): J-W removes the action for an item sealed on this Core and points to Export (the PACKAGE archive holds `manifest.json` and its signature). Wording `common.truth.manifestInExport` | - (no server change) |
| JW-04 / JT-03 | MAJOR (server half) | The Core's own answers stated a PASS over hardware it does not read: pre-check `SECURITY` -> `PASS READY` (`sim/session-machine.ts` `evaluatePrecheck`), diagnostics rows `STORAGE` / `FAN` / `NETWORK` / `SECURITY` -> PASS (`sim/maintenance.ts` `evaluateDiagnostic`), the platform device `TPM` -> `OK`, operation 44 `tpmOk: true` with no statement | On a Core that states `security.platformNotReported`: the pre-check row is a NOTE `NOT_REPORTED` (`sim/session-machine.ts:569`; `isPrecheckNote` covers the rule: never counted, never acknowledged; a security FAULT still blocks); the four diagnostics rows say "Not reported by this Core" (`sim/maintenance.ts:54`, `isDiagnosticNotReported`; the completion event counts them apart and is no "all passed"); `TPM` -> `NOT_REPORTED` (`sim/devices.ts:95`); operation 44 carries `security.platformNotReported: true` (`modules/devices/status.ts:277`, `sim/api.ts`). These are the three readers wave I batch J left (note 135, decision 1) | shared `test/sim-own-capture.test.ts` (block "fix wave J: no answer ... states a platform PASS", each with its CONTROL on the simulated device); core-server `modules/devices/__tests__/status.test.ts` |
| JW-08 | MAJOR | `sim/audio.ts`: with an external level source every frame without a fresh measured level was `noSignal: true` - also when no capture is open | At rest the frame says `notMeasured: true`, `noSignal: false` (`sim/audio.ts:321`); while a capture is open (RECORDING) a missing level IS no signal. New optional member of the audio frame and of the entries of operations 44 / 45; reader `isLevelNotMeasured` | shared `test/sim-own-capture.test.ts` (rest, open capture, CONTROL); core-server `modules/devices/__tests__/status.test.ts` |
| JW-07 | MAJOR (server half: named members) | No new member needed | ONE reader, `isOwnCaptureCoreState(state)` (`sim/core-facts.ts:230`): false in Live mode = the Core is SIMULATED. Finer members named in the contract (J-S 7) | shared `test/sim-own-capture.test.ts` |
| JT-04 / JW-09 | MAJOR (server half) | The member exists on the list entry and the item: `evidence.verification.status` (required member of `EvidenceItem`; operations 39 / 40, slice `evidence`); nothing was missing on the Core | Reader `verificationOfRecordFailed(item)` (`sim/evidence.ts:241`); wording `common.truth.sealedVerificationFailed` | shared `test/sim-evidence-item-kind.test.ts` |
| GM-02 | MINOR | The web counted over the newest 1,000 audit rows | Operation 58 `getSecurityStatus`: optional `evidenceVerification { sealed, passed, failed, neverVerified }` over EVERY item (`modules/security-audit/index.ts:90`) | core-server `modules/security-audit/__tests__/routes.test.ts`, `reads.db.test.ts`, `static.test.ts` (the folder now reads three slices); shared `test/sim-evidence-item-kind.test.ts` |
| JW-22 | MINOR | The web has no session list; the operation exists | Operation 38 `listSessionHistory` named; reader `incompleteSessionFactOf(entry)` (`sim/evidence.ts:669`): QUARANTINED / RECORDED_NOT_SEALED / NEVER_RECORDED from the entry's own members | shared `test/sim-evidence-item-kind.test.ts`, `test/sim-seal-blocked-unsealable.test.ts` (the entry `endUnsealableTransition` writes reads QUARANTINED) |
| JT-06 / JW-06 | MAJOR (server half) | Operation 67 ran the simulator's demonstration update on a real-capture Core (lane 2 reads "Installed v2.5.0 - slot B") | `update.updaterNotAvailable: true` on a Core in its own capture (`sim/core-facts.ts:213`, in `ownCaptureCoreFactsTransition`; stated at every start, `engine/host.ts:1007`, and every health tick; a run found in flight is ended); `startSoftwareUpdate` refuses (`sim/maintenance.ts:353`): `409 COMMAND_UNSUPPORTED`, `details.reason: UPDATER_NOT_AVAILABLE`, worded by the engine host (`engine/errors.ts:113`). The simulated lane keeps the demonstration | shared `test/sim-own-capture.test.ts` (refused, nothing started, no row; a running demonstration is ended; CONTROL), `test/api-registry.test.ts`, `test/live-source-bindings.test.ts`; core-server `engine/__tests__/errors.test.ts` |
| JT-01 / JW-05 / JA2-04 | MAJOR (shared half) | `systemStatus` knows the device slices and the fault list only: a retried / blocked seal, an unreachable source and a lost link were no part of the one statement | NEW module `sim/system-truth.ts`: `systemTruthOf(state, { coreLinkLost })` (`:106`) - flags unchanged (no `SystemFlagId` added), plus the Core's active SYSTEM alerts and the retried seal as facts; UNKNOWN on a lost link; `allOperational` | shared `test/sim-system-truth.test.ts` (the new module's own file; every "not READY" case has its READY control) |
| JA2-24 / N-16 | MINOR (server half) | The refusal of the camera that feeds the other track named no reason | `details.reason: CAMERA_ON_BOTH_TRACKS` (and `MIC_ON_BOTH_INPUTS`) on the `422 INVALID_INPUT` (`sim/capture-config.ts:59`) | shared `test/sim-capture-config.test.ts` |
| JA2-29 / N-02 (A1) / N-05 (B1), shared part | MINOR | Specification ids in operator copy of `packages/shared/src/i18n/en` | Texts only, key names unchanged: `session.ts` "(SYS-008)"; `evidence.ts` "(design book §11.3)", "(design book §19.3)"; `login.ts` "§20.1"; `security-audit.ts` "(§19.3)"; `storage.ts` "§10.1", "§10.2" x2; `system.ts` "§6.1", "§20.2", "§20.3", "§24.1", "§24", "(OD-11)", "(NM-07)", "(EVT-10)"; `network-time.ts` "(§22.2)"; `devices.ts` "this phase shows no live preview"; `common.ts` "(v1 package)" | shared `test/i18n.test.ts` (whole-tree rules) |
| JA2-13 / N-04 (B1), shared part | MINOR | "tablet" in SHARED sentences a phone shows | `common.ts` event / audit titles ("Device paired", "Device unpaired", "Device link changed", "Device connected", "Device disconnected"); `devices.ts` "Operator device", "Operator device offline", "Reconnect the device ..."; `network-time.ts` "Operator device link", "... paired operator device", "The device resyncs ...", "Operator device link lost"; `session-new.ts` "No paired device ... paired tablet or phone"; `shell.ts` "Operator device link"; `system.ts` "DEMS device app" | as above |
| JA2-N10 / N-16 | NOTE | "Camera search is not available on this Core yet." | "... on this Core." (`i18n/en/common.ts`) | - |

### Not fixed, with the reason

| Id | Sev. | Reason |
|---|---|---|
| JW-22, the remainder: WHY a seal was unsealable, on the list entry | MINOR | The cause code lives on the audit row `SESSION_INCOMPLETE` (`details.cause`) and on the alert; `session_history` has no column for it and schema 6 does not move. The contract tells J-W to filter operation 59 by `sessionId`. Needs: one column, or a ruling that operation 38 may join the trail |
| JT-11 / JW-13 / JA2-08: the form's "Notes (Optional)" on the item | MINOR | `evidence_items` has no column for the session's input notes (the item carries `markers` and the in-session `notes`, which the Core does keep - showing them is the clients'). Needs a column |
| JA2-37 | MINOR (S) | The simulator's sealed item carries the v1 track view (four tracks) AND the v2 file view (two files, a transcript hash) by design (SH-07 preview shape, held by `sim-v2-parity`); the recovery figures are generated. Covered by the DEMO mark of J-S 2 / J-S 7, not removed: changing the shape moves the stored rows of every simulated seal. Needs the owner's ruling on which view a simulated item keeps |
| JA2-30 / JW-26 | MINOR | Five version statements (app 2.4.1, demo update 2.5.0, core-server 0.2.0, API 0.3.0, mobile 0.1.0). Server half done for the real lane (the update slice is no reading there). ONE product version needs the user's decision on its source |
| JA2-12 | MINOR (S, asset) | Camera 2's mirrored on-picture label is in the bundled demo media: a media regeneration (no media build in this wave) |
| JW-14 | MINOR | Nothing for the server to make uniform without moving a total: a refused call already answers one shape (`403 NOT_PERMITTED` / `FORBIDDEN` with `details { operationId, permission, role }`); the five forms are client-side (disabled with / without reason, late refusal, redirect, hidden). The pre-emptive facts exist: operation 40 `access { play, readTranscript, export }`. Owner: J-W, J-T |
| JT-07 | MAJOR | "Separate tracks, never mixed" is true of the simulated four-track model and false of a real item (two camera files, audio intervals); the sentence is the tablet's (`apps/mobile`). The Core's facts are right on both lanes (`files`, `audioSourceIntervals`). Owner: J-T, with J-S 7 to tell the lanes apart |
| JW-23 (4): the selector accepts a camera on a dead port and the Core answers `online true, streamState LIVE` | MINOR | The Core does not probe a source when the selector is saved (a pre-check does; the source rig note of wave M says so). Stating "not checked" needs a tri-state where the slice has a boolean: a contract change beyond an optional member that I did not want to design inside this wave. Decision for the controller |

Seen, not changed: `restartServices` (operation 66) also runs the simulator's model on a
real-capture Core; the custody `detail` of an INCOMPLETE item is the raw text `POWER_FAIL; recovered`
(JA2-07 - the clients word it from `faultKind`); `api-reference.ts` still names the design book and
mock-core (a developer page).

## 2. Proven by test versus live

Everything above is proven BY TEST. Nothing was driven live: by the brief J-S calls no lane's UI,
and both Cores run the code they booted with until J-W restarts them after the "JS consistent"
line. What the restart changes for the judges' steps is the re-drive list of section 5.

## 3. Proof

One run each; a second run only of what failed. 1-minute load below 6 before each (5.61, 5.88,
5.95, 5.80 as read at the starts).

| Check | Command | Result |
|---|---|---|
| shared, whole suite | `npm test -w @dems/shared` | first run: 100 files passed, 2 failed (2678 / 2680): both are the "committed openapi.json equals the builder" tests - the document had been generated before the last member. After the regeneration: `vitest run test/api-openapi-scope.test.ts test/openapi.test.ts` -> 2 files, 45 tests passed. Whole: 102 files, 2680 tests green |
| OpenAPI | `/usr/bin/lockf -k .locks/npm.lock npm run openapi:gen -w @dems/shared` | `wrote openapi/openapi.json (all (committed): 97 operations, 2 security schemes, version 0.3.0; ...)`; counted from the file: 97 / 36 GET / 61 POST |
| core-server unit, whole suite | `npm test -w @dems/core-server` | in the command sandbox: 313 files passed, 11 failed (6608 passed, 120 failed) - all 11 are files that BIND a loopback port (`fake-onvif-stub`, `ws-discovery`, `onvif-session`, `loopback-guard`, `discovery-recording`, `lane-camera-stub`, `mic-helper.generated`, `probe`, `encrypted-credential`, `stt-config/routes`, `media-stream/routes`), refused inside the sandbox (EPERM), none in an area I touched. The same 11 files outside the sandbox: 11 files, 249 tests passed. Whole: 324 files green |
| db suite | `/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w @dems/core-server` | first run: 165 files passed, 13 failed, 3 skipped (2410 passed, 18 failed): every failure a pin of the OLD behaviour (seed row counts 52 / 314, four tracks on a never-sealed item, a COMPOSITE answered 202, operation 41's 409 not yet produced by the acceptance walk, the keys of operations 40 and 58). Tests updated (the failed-job path of the export keeps its coverage through a test part that admits the request). Second run of those 13 files + the 2 I extended: `Test Files 15 passed (15)  Tests 269 passed (269)`. Teardown: `0 remain` both times; lane 1 was not stopped (no "remaining connection slots") |
| typecheck | `npx tsc --noEmit -p packages/shared`; `npm run typecheck -w @dems/core-server` | clean |
| lint | `npm run lint -w @dems/shared`; `npm run lint -w @dems/core-server` | clean |

Not run by me: `apps/core-web` and `apps/mobile` (their drivers'), `test:regression` (the wave's end).

## 4. Decisions for the controller

1. **Operation 41 gains a documented `409`** (`NOT_SEALED`). It is the refusal operations 42 and 43
   already give a RECORDED item; the totals do not move, the OpenAPI document does (regenerated).
2. **`409 COMMAND_UNSUPPORTED` + `details.reason`** is the one form of "this Core cannot do that"
   (COMPOSITE: `COMPOSITE_ENCODER_NOT_SELECTED`; update: `UPDATER_NOT_AVAILABLE`), not `503
   NOT_READY`: a 503 says "ask again later", which is false for both.
3. **Seed content changed, schema did not:** the seed's one never-sealed item writes no track row
   (`evidence_tracks` 52 -> 48; seed total 314 -> 310, written by the seed 312 -> 308). The row
   counts of contract §9.4 / `EXPECTED_SEED_COUNTS` are pinned in tests and were updated; the
   masterplan document that quotes them needs an erratum (documents are not mine).
4. **Kept databases are not rewritten.** Rows with `sealed_at` NULL keep their old hash columns
   (the runtime role cannot update them); the Core answers them in the never-sealed shape at
   read. `EV-...-0006`-class items on lane 2 will show no hash after the restart.
5. **Shared texts changed under unchanged keys** (section 1, the two i18n rows). A client test that
   pins one of those exact sentences fails in its own workspace: listed for J-W / J-T / J-P in the
   contract (J-S 12).
6. **The Live export call can now throw** for a COMPOSITE (contract J-S 3). Until a client reads
   `exportKinds`, its wizard needs the `catch`.
7. `systemTruthOf` is offered, not imposed: no client was changed by me. If the three clients take
   it, JT-01 / JW-05 / JA2-04 have one rule.

## 5. Checks for the test runner, and the re-drive list

Checks for the test runner (after the last driver, one run each):

- `npm test -w @dems/shared`; `npm test -w @dems/core-server`;
  `/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w @dems/core-server` (one worker
  is the project's setting; lane 1 may have to be stopped for database slots);
  `npm run typecheck` / `lint` of both workspaces; `npm run test:regression` at the end of the wave.
- `apps/core-web` and `apps/mobile` typecheck after their drivers: they consume the new members.

Re-drive list for the confirmation judge (after "lanes restarted"):

1. Lane 1: record, raise `POWER_FAIL` (or "Storage full"), recover to INCOMPLETE, open the item:
   no hash, no manifest, no signature anywhere; Verify is not offered, and `POST
   evidence/{id}/verify` answers 409 NOT_SEALED. Same for the seed item `EV-...-0006` on both lanes.
2. Lane 1: seal a session, open its item: "demonstration record, no media", Verify PASS marked as
   a demonstration, the Summary's package step marked DEMO.
3. Both lanes: Export, output Composite is disabled with its reason; a forced `kind: COMPOSITE`
   answers 409 and Storage / Recent Events gain no row.
4. Lane 2: pre-check row Security reads "Not reported" (a note); Run diagnostics: SMART, fan,
   network / PoE and security "Not reported"; the pill does not say SECURE.
5. Lane 2 at rest: both microphones "Not measured"; during a recording: levels.
6. Lane 2: System & Maintenance: no Install control, "Software update is not available on this
   Core"; `POST system/update` answers 409 COMMAND_UNSUPPORTED.
7. Lane 2: Security & Audit tamper tile equals `evidenceVerification` of `GET security/status`.
8. Lane 2, `source-rig 2 unreachable CAM-02` and `seal-rig 2 blocked`: Home / pill / ring follow
   `systemTruthOf` (if the clients took it).

## 6. State left

No lane touched, no rig, no device, no git write. Lane 1 was NOT stopped by me. Files: the two
claim lines "wave J J-S" in `delegation_progress/file_claims.md`. Both Cores still run the old
code: the restart is J-W's, after the line "JS consistent" in `contract_wave_j.md`.

---
*Generated: 2026-10-12*
