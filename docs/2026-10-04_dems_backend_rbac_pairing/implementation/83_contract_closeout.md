---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W83 (step 105)
title: Contract close-out and OpenAPI
part: 1 of 2 (ledger, classes, ruling sheet, phase-2 plan)
agent: coder-execution
date: 2026-10-06
status: needs-review (rulings required before phase 2)
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W83, line 762)
tree: b90a3c6 plus the uncommitted page-row work; packages/shared/src/api, packages/shared/openapi and packages/shared/scripts are clean against b90a3c6 (git status: 0 entries)
---

# W83 part 1: the ledger of every contract gap, the ruling sheet, and the phase-2 plan

Read-only phase. Nothing outside this file and `delegation_progress/coder_execution_step_105.md` was written.

## 0. Summary

| Class | What it needs | Items | Recommendation in short |
|---|---|--:|---|
| **A** | Mechanical contract fix in `packages/shared/src/api/**`, regenerated document, no server behaviour change | **34** | Apply all 34 in phase 2 (8 landings plus optional L9, section 7) |
| **B** | Text erratum in a specification, a row log or a code comment | **13** | Apply as errata appendices if the controller grants the paths (DQ-6) |
| **C** | A server behaviour change | **7** | All 7 accepted as residuals for the demo, one README / final-report sentence each |
| **D** | A change of the shared Live source, the typed client or a client app | **5** | Do 1 now (T3, the any-of permission name, one line); 4 residuals |
| **E** | Accept as a documented residual (by design, or a new capability beyond the demo) | **28** | Accept; rename the code markers (DQ-5) |
| **F** | Copy sweep: i18n keys in `packages/shared/src/i18n/en/**` and both apps (not in A to E: it is neither contract nor Live source) | **7** | Hand to a separate closing copy round, not to W83's single writer (DQ-7) |
| Closed | Already closed by a later row, or withdrawn | **7** | No action; listed so that the ledger is complete |
| **Total** | | **101** | |

The closing criterion of the row ("a search for `CONTRACT-GAP-` under `apps/` and `packages/` finds nothing") is met by
removing the markers of the A items with their landing and RENAMING the markers of the C, D and E items (DQ-5). Today:
**34 distinct `CONTRACT-GAP-` IDs on 88 lines in 43 files** (4 in `apps/core-server`, 17 in `apps/core-web`, 16 in
`apps/mobile`, 6 in `packages/shared`).

## 1. 5W1H (Tier 1)

| | |
|---|---|
| **What** | One ledger of every gap ID (`CONTRACT-GAP-*`, the task's `SIM-GAP-*`, `BE-GAP-*`) and every un-numbered item routed to W83, each with source, current state in the tree, class and a phase-2 action |
| **Who** | Writer: this agent (read-only). Rulers: the controller. Phase-2 writer: one coder-execution agent (contract slot F1, `.locks/contract.lock`). Affected owners: W27 (contract C tests), W44 (Live source), W12 (typed client), W36 / W35 / W52 (server tests), the web and mobile page rows (markers only, one mobile assertion) |
| **When** | Phase 1 now (2026-10-06 03:17); phase 2 after the rulings and after checkpoint commit 2 (W105), because the closing web round W1 writes `apps/core-web/**` at this moment and line numbers there will move |
| **Where** | Contract: `packages/shared/src/api/**`, `packages/shared/openapi/openapi.json`. Outside the row's owned paths: the files listed in section 7.2 (grants needed) |
| **Why** | Plan row W83 [`masterplan/02_plan.md:762`]; KI-18 [`02_plan.md:1538`]; the gap-ID rule of D84 [`decisions/decisions.md:90`]; about 30 decisions that route items "to W83" (D75 to D179, F64) |
| **How** | Three sources de-duplicated (section 2); every claim checked against the tree with a command (section 8). Each item classed A to F; for C and D the smallest change and its blast radius were read in the code |
| **Alternatives** | For the four structural choices the alternatives are in section 6.5 (DQ-1 to DQ-4) |
| **Assumptions** | (1) The `offline` scope of the OpenAPI document stays byte-pinned to `acaff20` except where KI-18 requires a change (`packages/shared/test/api-openapi-scope.test.ts:51-89`, the rule of contract C [`implementation/27_contract_c.md:418-423`]). (2) Nothing under `packages/shared/src/sim/` is written (DR-07). (3) Simulated mode looks and behaves as before (the rule every page row followed) |
| **Gaps in evidence** | No suite was run for this phase except `gen-openapi --check`; the blast radius of the strict schemas (T8) on hand-written fake answers in the app tests is NOT measured (marked as a hypothesis at ledger row 71) |

## 2. Sources and how they were read

| Source | Command or file | Result |
|---|---|---|
| Markers in code | `grep -rnoE 'CONTRACT-GAP-[A-Z0-9-]+\|SIM-GAP-W[0-9]+-[0-9]+\|BE-GAP-W[0-9]+-[0-9]+' apps packages --include='*.ts' --include='*.tsx'` | 67 distinct IDs in 67 files. **33 of them are NOT this task's**: `SIM-GAP-W43-1` … `SIM-GAP-W53-2` are predecessor KI-07 markers present at `acaff20` (`git grep … acaff20 -- apps packages`), like `SIM-GAP-M80-1` … `SIM-GAP-M88-1` and `SIM-GAP-W1`. They stay untouched (the KI-07 count must not change, D148, D167 DN-4). The task's own: 34 `CONTRACT-GAP-*`, `SIM-GAP-W34-1`, `SIM-GAP-W39-1`, `BE-GAP-W36-1`, plus `SIM-GAP-1` and `SIM-GAP-2` |
| Row logs | `implementation/*.md`, `test/*.md`, `gateway_check/*.md` | Adds the IDs with no code marker: `-W32-4`, `-W39-2`, `-W39-3`, `-W40-2`, `-W41-1`, `-W41-3`, `-W41-4`, `-W41-5`, `-W42-1/-2/-3`, `-W43-1`, `-W49-1`, `-W75-1`, `-W76-2`, `-W76-3`, `-W78-1`, `-W81-1`, `-W81-2`, `-W82-1`; `SIM-GAP-W36-1`; W52-F2; the gap table of the conformance row [`test/03_contract_conformance.md:338-364`] |
| Decisions | every row of `decisions/decisions.md` naming W83, "close-out", a gap ID or "copy sweep" (31 rows name W83; 40 more name a gap ID) | Adds the un-numbered items W83-T1 … W83-T39 |

## 3. Constraints found while reading (they shape the classes)

1. **The offline document is pinned.** `api-openapi-scope.test.ts:51-89` holds SHA-256 values of `info`, `servers`, `tags`,
   `paths`, the ten operation objects and 16 of 18 components, all equal to `acaff20`. Any change to the
   `description`, a response text, an example or `source` of the ten existing operations, or to `HealthResponse`,
   `EvidenceExportRequest` or `Heartbeat`, changes a pinned hash and what the Simulated-mode API page shows. Only the
   members `details` and `requestId` of `ApiError` are outside the pin (`:165-178` deletes them before hashing).
2. **Examples are not scoped.** `CORE_API_EXAMPLES` (`examples.ts:348`) serves both scopes; only a status with
   `services` set is left out of `offline` (`contract-model.ts:187-193`). The ten operations carry an all-scope text in
   `coreServerDescription`, but a RESPONSE has no all-scope text. Gaps on statuses of the ten (W34-2, W35-2) can be
   closed machine-readably only by a small model extension (DQ-1).
3. **The absence of a `notPermitted` example is pinned on purpose.** `api-state-examples.test.ts:233-238` asserts that
   `listEvidence`, `getEvidence`, `verifyEvidence`, `testDeviceSignal`, `identifyDevice`, `runDiagnostics` (operations
   39, 40, 41, 49, 50, 65) have NO `notPermitted` example, because every seeded role holds EVIDENCE_VIEW and
   DIAGNOSTICS_RUN (`sim/auth.ts:46-72`); an example must name a role that lacks the permission (`:219-232`).
   Operations 60 `verifyAuditChain` and 70 `acknowledgeAlert` are AUTHENTICATED: `NOT_PERMITTED` cannot occur
   (ruling D154 DN-1; `implementation/75_web_security_audit.md:358`). So the "missing examples" on 41, 49, 50, 60, 65,
   70 are by design (class E).
4. **The conformance test reads codes from texts.** `contract.support.ts:99-111` (`registryCodes`) takes the codes a
   status may carry from its `description` and its examples. `contract.test.ts:1451-1460` (`KNOWN_CODE_GAPS`) lists the
   mismatches; a stale entry does not fail (`:1520-1525`), an unlisted one does. The coverage block (`:1531-1562`)
   requires every DOCUMENTED status to be produced or listed in `NOT_PRODUCED`, and answers sent with `knownGap` do not
   count (`contract.support.ts:330`). Hence a per-operation 400 on 23 body-less POSTs would open 23 coverage cells;
   an envelope-level entry opens none (DQ-2).
5. **W83's owned write paths are contract-only** (`02_plan.md:762`). Every marker outside `packages/shared/src/api/**`
   and the pinned tests needs a grant (section 7.2).
6. **The Live source's public API is pinned.** `DEVICE_COMMAND_OPERATION_INDEX` is exported from
   `@dems/shared/live/source` (`live/source/index.ts:41`) and named in the public-API list of
   `live-source-platform-neutral.test.ts:260`. CONTRACT-GAP-3 is therefore closed by deriving the local tables from the
   new contract table and keeping their names, not by deleting them.

## 4. The ledger

Columns: **Recorded** = where the item is recorded (file:line; decision). **State** = checked in the tree on
2026-10-06 03:00-03:17. **Markers** = code lines that cite the ID (phase 2 removes them for A items and renames them
for C, D, E items). All paths below `docs/2026-10-04_dems_backend_rbac_pairing/` are written without that prefix.

### 4.1 Task-wide IDs (D84 registry)

| # | ID | Recorded | Says | State | Class | Phase-2 action | Markers |
|--:|---|---|---|---|---|---|---|
| 1 | CONTRACT-GAP-1 | D36, D50, D55 | Operation table literal; health schema widening | CLOSED by W19 (D50) and the scaffold touch-up (D55); no marker | Closed | none | none |
| 2 | CONTRACT-GAP-2 | D36, D50 | `query?: { schema }` in the model | CLOSED by W19 (D50) | Closed | none | none |
| 3 | CONTRACT-GAP-3 | `implementation/36_module_devices.md:160-198`; D75, D89, D86 | No contract table says which device command reaches which of operations 48, 49, 50 | OPEN: `grep DEVICE_COMMAND_OPERATIONS packages/shared/src` → nothing; local tables `live/source/bindings.ts:161` and `core-server/src/modules/devices/operations.ts:49` | A | Add `DEVICE_COMMAND_OPERATIONS` and `deviceCommandOfOperation` to `sim-actions.ts` (text of `36:172-189`); derive `DEVICE_COMMAND_OPERATION_INDEX` and `DEVICE_COMMAND_OF_OPERATION` from it, names kept (constraint 6) | `core-server/src/modules/devices/operations.ts:42`; `…/devices/__tests__/routes.test.ts:157`; `packages/shared/src/live/source/bindings.ts:156`; `packages/shared/test/live-source-platform-neutral.test.ts:235, 245`; `apps/mobile/src/features/devices/testing/live-devices-bed.tsx:124` |
| 4 | CONTRACT-GAP-4 | `implementation/12_typed_client_emulator_proof.md:1117`; D81 | The contract exports no bearer-secret prefix constant | OPEN: no `BEARER_SECRET_PREFIXES` in `api/constants.ts` | A | Export `BEARER_SECRET_PREFIXES` (`ses_`, `dvc_`, `bio_`) beside the three token patterns; the typed client reads it; its test reads the constant instead of the pattern heads | `packages/shared/src/client/core-client.ts:63`; `packages/shared/test/client-credentials.test.ts:265` |
| 5 | CONTRACT-GAP-5 | `implementation/28_rbac_guard_pipeline.md:275, 698`; D83 DN-1, D88 DN-3, D155 (1), D168 DN-3; F64 | The any-of denial has three spellings: the example `ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)`, the server `EVIDENCE_REVIEW_OR_MAINTENANCE`, the simulator `EVIDENCE_REVIEW \| MAINTENANCE` (the last only when the stored matrix differs, F-W37-1) | OPEN: `storage.ts:174-181` still `ANY-OF(…)`; the server answers `_OR_` (`test/03_contract_conformance.md:342`) | A (+ D: W83-T3) | Example `permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE'`; a shared helper that splits a denial label into permissions (`_OR_`, ` \| `, the old `ANY-OF(…)`); one mapping for clients through W83-T3 | `apps/core-web/src/test/live-storage-policy.test.tsx:258`; `apps/mobile/src/features/storage/storage-screen.tsx:199`; `apps/mobile/src/features/storage/live-storage-sites.test.tsx:188`; `apps/core-server/test/acceptance/contract.test.ts:616, 618` |
| 6 | CONTRACT-GAP-6 | `implementation/28:670, 706`; D83 DN-9 | The `getRoleMatrix` example lists SUPERVISOR's grants in another order than the server | OPEN (`administration.ts:291`) | A | Add to the `RoleMatrix.grants` description "a set: the order is not significant" (DQ-4) | `contract.test.ts:525, 528` |
| 7 | CONTRACT-GAP-7 | D84, D86, D97 | The sign-out reason of a local expiry | WITHDRAWN (D97: no sign-out is sent for an expiry); no marker | Closed | none | none |

### 4.2 Module rows W32 to W52

| # | ID | Recorded | Says | State | Class | Phase-2 action | Markers |
|--:|---|---|---|---|---|---|---|
| 8 | CONTRACT-GAP-W32-1 | `implementation/32_pairing_device_registry.md:742`; D93 | The redeem 423 says the attempt is not compared; the failure that LOCKS also answers 423, was compared, writes `PAIRING_FAILED` | OPEN: `pairing.ts:339` unchanged | A | The exact text of `32:742` | `contract.test.ts:1038` (shared with W41-3) |
| 9 | CONTRACT-GAP-W32-2 | `32:743`; D93 | A text of the form of a credential (or holding the code) is refused with 422; the descriptions do not say so | OPEN: `pairing.ts:128-130` | A | Two sentences of `32:743` on `deviceName` and on the revoke `reason` | `contract.test.ts:561, 563`; `apps/core-web/src/features/paired-devices/revoke-dialog.tsx:31` |
| 10 | CONTRACT-GAP-W32-3 | `32:744`; D93; D118 FU-6, FU-7; CF-7 (`28:1496`) | The 403 of operations 21, 22, 23 does not name `DEVICE_NOT_PAIRED` for a web console session, nor a revoked device in flight without a row | OPEN: `pairing.ts:420, 442, 466`; `operation-parts.ts:71` | A | `forbidden('an operator\'s web console session called a device-only operation (DEVICE_NOT_PAIRED; no audit row)')` and the `REVOKED` text of `32:744`; then three `KNOWN_CODE_GAPS` entries go | `contract.test.ts:1454, 1455, 1456` |
| 11 | CONTRACT-GAP-W32-4 | `32:745`; D93; D179 DC-4 | Code lifetime 300 s, 5 attempts, QR prefix exist only as words | OPEN: no such constants in `api/` | A | `PAIRING_CODE_LIFETIME_MS`, `PAIRING_CODE_MAX_FAILED_REDEEMS`, `PAIRING_QR_PREFIX`, and with gap 4 `DEVICE_CREDENTIAL_PREFIX`, in `constants.ts`; the server's `modules/pairing/limits.ts` may import them later (code review W91) | none |
| 12 | CONTRACT-GAP-W34-1 | `implementation/34_module_sessions.md:626`; D94 | 409 `SESSION_ACTIVE` carries `details.sessionId`; the envelope's `details` list does not name it | OPEN: `core-api.ts:206` | A | Add `sessionId` (409 `SESSION_ACTIVE`: the open session) to the `details` description (outside the offline pin, constraint 1). The offline 409 example of `createSession` stays: it is the simulator's answer | `contract.test.ts:692, 693` |
| 13 | CONTRACT-GAP-W34-2 | `34:627`; D94, D108 | `stopSession` 422 also answers `INVALID_INPUT` (text rule, malformed `{id}`) | PARTIAL: the all-scope operation text names the reason case (`core-api.ts:699`), not the `{id}` case; the 422 response text (offline, pinned) names `INVALID_REASON` only, so `registryCodes` does not see `INVALID_INPUT` | A (DQ-1) | Response-level all-scope text (model extension, DQ-1) naming both codes; `contract.support.ts:99` reads it; the `KNOWN_CODE_GAPS` entry goes | `contract.test.ts:742, 1452` |
| 14 | CONTRACT-GAP-W34-3 | `34:628`; D94 | Examples of 404 / 409 on session operations quote the request's ID; the server's texts are fixed | OPEN | A | Change the examples of the Core-only operations (`sessions.ts:445-451`) to the server's fixed texts; leave the ten-operation examples (`examples.ts:385-425`: offline, the simulator's texts) and add one sentence to the `coreServerDescription` of `startSession` / `stopSession` | `contract.test.ts:676, 679` |
| 15 | SIM-GAP-W34-1 | D94 DN-5 | The recording time of a faulted session keeps counting, in both modes | Known difference (`test/03_contract_conformance.md:363`) | E | None; listed for the final report (W88). Not a `CONTRACT-GAP-` marker: stays | `contract.test.ts:754, 758`; `test/acceptance/restart.test.ts:1153`; `src/modules/sessions/__tests__/journey.db.test.ts:439` |
| 16 | CONTRACT-GAP-W35-1 | `implementation/35_module_evidence.md:762-777`; D92 | The 409 example of `archiveEvidence` lacks `from: null, event: 'archiveEvidence'` | OPEN: `evidence.ts:370-375` | A | The exact text of `35:767-775` (operation 43 is Core-only) | `contract.test.ts:819, 821`; `src/modules/evidence/__tests__/commands.db.test.ts:755` |
| 17 | CONTRACT-GAP-W35-2 | `35:780-797`; D92 | `exportEvidence` 422 also answers `INVALID_INPUT` | PARTIAL: the all-scope operation text says it (`core-api.ts:830`); the 422 text (offline, pinned) names `INVALID_REASON` only | A (DQ-1) | As item 13, with the status text of `35:788-791` | `contract.test.ts:809, 1453`; `commands.db.test.ts:524` |
| 18 | CONTRACT-GAP-W36-1 | `36:202-227`; D89 | A POST without a request body answers 400 `INVALID_JSON` to a body that is no JSON object; the registry documents no 400 | OPEN: 23 body-less POSTs, none documents 400 (computed from the table) | A (DQ-2) | One PIPELINE-stage envelope entry `{ status: 400, codes: [INVALID_JSON] }` (text of `36:221-225`); `validateCoreApiResponse` already looks up undocumented statuses among PIPELINE entries (`core-api.ts:1124-1129`) | `contract.test.ts:927, 935`; `src/modules/devices/__tests__/routes.test.ts:481, 484` |
| 19 | BE-GAP-W36-1 | `36:229-262`; D89; F66 | The engine seam offered no meter frame | CLOSED: `EngineHost.meters()` in round B2b (`devices/status.ts:48` "closed by decision D89"; `effects.db.test.ts:105`) | Closed | none (the markers are history; a reword is the code review's, W91) | `devices/status.ts:48`; `…/status.test.ts:8, 182, 226`; `…/effects.db.test.ts:105` |
| 20 | SIM-GAP-W36-1 | `36:550` (F-11), DN-4 | The design-book read shapes are built twice (server and simulator) | Hypothetical gap, "no writer planned"; parity tests hold them together | E | None (a simulator export would break DR-07) | none |
| 21 | CONTRACT-GAP-W39-1 | `implementation/39_module_security_audit.md:840-846`; D102; observation O-1 (`test/03:377`) | "A cursor that is not one" does not say that a rebuild invalidates a cursor | OPEN: `operation-parts.ts:56-58` | A | The text of `39:845`, worded as O-1 proposes: "a cursor on a row the rebuilt chain does not hold" | `contract.test.ts:1413, 1416` |
| 22 | CONTRACT-GAP-W39-2 | `39:848-855`; D102 | `rows` / `head` of the audit export answer do not say which rows | OPEN: `security-audit.ts:219-220` | A | The two descriptions of `39:852-853` | none |
| 23 | CONTRACT-GAP-W39-3 | `39:858-861` | The cursor pattern comment omits the row-ID form | OPEN: `patterns.ts:85-90` | A | One comment sentence | none |
| 24 | SIM-GAP-W39-1 | D102 DN-2 | The simulator's `AUDIT_EXPORTED` row counts its ring (1,000), not the stored chain | Known difference (`test/03:364`) | E | None; final report. Stays | `contract.test.ts:1348, 1353` |
| 25 | CONTRACT-GAP-W40-1 | `implementation/40_modules_system_alerts.md:501-515`; D104 | As item 18, on operations 65, 66, 67, 70 | OPEN | A | Closed by item 18's landing | `contract.test.ts:927, 935` |
| 26 | CONTRACT-GAP-W40-2 | `40:517-526`; D104 DN-3 | `listAlerts` says every alert wrote `FAULT_RAISED`; `AUDIT_TAMPER` writes `AUDIT_CHAIN_DISCONTINUITY`; kind `SYSTEM` exists | OPEN: `alerts.ts:65` | A (+ B: AC-B-71 reading) | The text of `40:523-525`, in the description and the file header | none |
| 27 | CONTRACT-GAP-W41-1 | `implementation/41_biometric_token.md:747`; D105; F72 | Token lifetime 30 days only in words; the rotated token comes without expiry | OPEN: `identity.ts:195` | A | `BIOMETRIC_TOKEN_LIFETIME_MS` in `constants.ts`, named in the two descriptions of `41:747` | none |
| 28 | CONTRACT-GAP-W41-2 | `41:748`; D105 | Operation 7's 403 does not say `details.reason: PASSWORD_SESSION_REQUIRED` | PARTIAL: the case is in the text (`identity.ts:399`), the reason, an example and a shared constant are not (`grep` finds the constant only in `core-server/…/enrolment.ts:45`) | A | `PASSWORD_SESSION_REQUIRED_REASON` beside `DEVICE_CREDENTIAL_REQUIRED_REASON`; the reason in the text; one example | `contract.test.ts:509, 512` |
| 29 | CONTRACT-GAP-W41-3 | `41:749`; D105; D78 DN-3 | The failure that locks a sign-in answers 423 itself, verified, `AUTH_FAILED` | OPEN: `identity.ts:244` (shared by `signIn` and `signInWithBiometric`) | A | The text of `41:749` | `contract.test.ts:1038` |
| 30 | CONTRACT-GAP-W41-4 | `41:750`; D105 DN-4; `24b:540` | Six `details.reason` values of a refused token exist only in the server | OPEN: no `TOKEN_EXPIRED` in `packages/shared/src` | A (+ B: spec §13 line) | A shared constant of the six values beside the audit vocabulary; `OTHER_DEVICE` worded as `24b:541` says | none |
| 31 | CONTRACT-GAP-W41-5 | `implementation/24b_identity_security_lows.md:538-549`; D123 DN-5, D132 | `TOKEN_REUSE` texts speak of a used token only; a live token from another device is a reuse too | OPEN: `realtime-messages.ts:136-138`, `realtime-examples.ts:178` | A (+ B: seven spec lines) | The two texts of `24b:542-543` | none |
| 32 | CONTRACT-GAP-W42-1 | `implementation/42_realtime_channel.md:384, 409`; D111 DN-1 | A client message over 65,536 bytes closes with 1009, not 1008 | OPEN: `RealtimeCloseCode` lists six codes (`realtime-messages.ts:167-181`) | A (+ B: §9.4) | Add 1009 with "Reconnect"; `api-realtime.test.ts:787-789` changes by design (six → seven) | none |
| 33 | CONTRACT-GAP-W42-2 | `42:410`; D111 DN-2 | A `resync` sooner than 2 s is answered when the 2 s have passed | OPEN: `realtime-messages.ts:429, 548` | A | One sentence | none |
| 34 | CONTRACT-GAP-W42-3 | `42:411`; D111 DN-3 | `meters.seq` never goes back on a connection, also across an epoch | OPEN: `realtime-messages.ts:343` | A | One sentence | none |
| 35 | CONTRACT-GAP-W43-1 | `implementation/43_module_demo_controls.md:428-440` (DN-7); D101; `76:352` | `details.reason` values `RESET_IN_PROGRESS`, `RESET_FAILED` of the 503 are undocumented | OPEN: neither value in `api/` | A | The text of `43:434-436` in `loadScenario` and `resetDemo`; optionally the two values as a constant | none |
| 36 | CONTRACT-GAP-W44-1 | `implementation/44_live_source.md:1922`; D107; F66-28 | `hello` names no session, so the client probes `getAuthSession` after a reconnect | OPEN | C + D | See ruling R-C1 (residual recommended) | `packages/shared/src/live/source/live-sim.ts:1473`; `live-source-platform-neutral.test.ts:239, 245` |
| 37 | CONTRACT-GAP-W44-2 | `44:1923`; D107; D100 (the one-round-trip window) | A sign-out names no session, so a debt paid late can end another tab's new session | OPEN | C + D | See R-C2 (residual recommended) | `live-sim.ts:1340`; `live-source-platform-neutral.test.ts:240, 245` |
| 38 | CONTRACT-GAP-W49-1 | `test/05_shared_state_realtime.md:497, 619`; D119 W49-F1 | `HeartbeatSchema` is `z.object`; the other eight members of the server union are strict | OPEN: `realtime-messages.ts:74` | A (DQ-3) | A strict heartbeat member inside the Core server's union only; `HeartbeatSchema` and the offline `Heartbeat` component stay byte-equal (mock-core, the 0.1.0 build) | none |
| 39 | CONTRACT-GAP-W52-1 | `test/03_contract_conformance.md:370, 426`; D115; G-3 (D126) | 403 of operations 8 and 9 does not name `DEVICE_NOT_PAIRED` for a web session | OPEN: `identity.ts:432` (`forbidden(DEVICE_CREDENTIAL_REFUSED)`, operation 8) and `:458` (`forbidden()`, operation 9) name no web-session case | A | The text of `test/03:370` on both, as item 10; two `KNOWN_CODE_GAPS` entries go | `contract.test.ts:1458, 1459` |

### 4.3 Page rows W63 to W82

| # | ID | Recorded | Says | State | Class | Phase-2 action | Markers |
|--:|---|---|---|---|---|---|---|
| 40 | CONTRACT-GAP-W63-1 | `implementation/63_web_dashboard.md:296`; D152 (3) | Operation 49 has no `notPermitted` example | By design (constraint 3) | E | Reword markers; the hand-written envelopes stay | `apps/core-web/src/test/live-dashboard-devices.test.tsx:198`; `apps/core-web/src/test/live-system-maintenance.test.tsx:237` |
| 41 | CONTRACT-GAP-W66-1 | `implementation/66_mobile_home_more.md:125`; D159 DN-4 | Replicated session history carries no media reference; LIVE rows show the brand still | OPEN | C (needs slice + contract + Live source + both clients) | See R-C3 (residual) | `apps/mobile/src/features/dashboard/recent-sessions.tsx:10, 76`; `…/dashboard/home-live.test.tsx:9, 114`; `apps/mobile/src/features/sessions/live-sessions.test.tsx:126` |
| 42 | CONTRACT-GAP-W66-2 | `66:126`; D159 | Operation 70 has no `notPermitted` example | By design: AUTHENTICATED (D154 DN-1) | E | Reword markers | `…/dashboard/home-live.test.tsx:211`; `apps/mobile/src/features/session-recovery/live-recovery-sites.test.tsx:310` |
| 43 | CONTRACT-GAP-W69-1 | `implementation/69_web_evidence.md:277`; D158 DC-3 | Operation 41 has no `notPermitted` example | By design (constraint 3) | E | Reword marker | `apps/core-web/src/test/live-evidence-verify.test.tsx:220` |
| 44 | CONTRACT-GAP-W69-2 | `69:278, 296`; D158 DC-1 | No evidence-media key in `CORE_QUERY_KEYS` | Accepted as built (D158 DC-1: the key from the exported root) | E | Reword marker | `apps/core-web/src/features/evidence/use-evidence-media.ts:29` |
| 45 | CONTRACT-GAP-W70-1 | `implementation/70_web_devices.md:383, 413`; D156 (2) | A paired device's socket opening or closing publishes no `admin.changed DEVICES` | OPEN; the clients re-read on a tablet-link change | C | See R-C4 (residual) | `apps/core-web/src/features/devices/device-drawer.tsx:364, 392`; `apps/core-web/src/features/paired-devices/devices-panel.tsx:32, 50`; `apps/core-web/src/test/live-strict-mode-starts.test.tsx:226`; `…/live-paired-devices-list.test.tsx:13, 126, 199`; `…/live-devices-drawer.test.tsx:13, 207` |
| 46 | CONTRACT-GAP-W70-2 | `70:384`; D156 (6) | Operations 49 and 50 have no `notPermitted` example | By design | E | Reword the test title | `apps/core-web/src/test/live-devices-commands.test.tsx:221` |
| 47 | CONTRACT-GAP-W71-1 | `implementation/71_web_storage_network_time.md:105, 324`; D155 (2) | The Core reports no SMART counters; the Live footnote says so | A new Core capability | E | Reword markers | `packages/shared/src/i18n/en/storage.ts:119`; `apps/core-web/src/features/storage/volumes-panel.tsx:20`; `apps/core-web/src/test/live-storage-page.test.tsx:13, 142` |
| 48 | CONTRACT-GAP-W73-1 | `implementation/73_mobile_recovery.md:121`; D175 DN-3 | The Core reports the recovery stage and outcome, not per-check results | A new Core capability | E | Reword marker | `apps/mobile/src/features/session-recovery/session-recovery-screen.tsx:37` |
| 49 | CONTRACT-GAP-W74-1 | `implementation/74_mobile_evidence.md:227`; D162 DN-3 | Operation 42's schema cannot say the role is checked before the body; the probe's empty reason is refused by the contract-checked fake | The prose already says "before the body is read" (`core-api.ts:827`); a schema cannot express order | E | Reword markers | `apps/mobile/src/features/evidence/export-sheet.tsx:176`; `…/evidence/testing/live-evidence-bed.tsx:23, 94` |
| 50 | CONTRACT-GAP-W74-2 | `74:228`; D162 DN-4 | List items and the replica carry no media reference | OPEN; as item 41 | C | With R-C3 | `apps/mobile/src/features/evidence/evidence-media.ts:24` |
| 51 | CONTRACT-GAP-W75-1 | `implementation/75_web_security_audit.md:348-356`; D176 DC-5 | Every web export is recorded with destination "Audit archive (simulated)" | OPEN; the Live binding already forwards a `destination` (`live/source/bindings.ts:240-245`) | D (client: web export dialogs) | See R-D2 (residual) | none |
| 52 | CONTRACT-GAP-W76-1 | `implementation/76_web_system_demo.md:352`; D178 DC-3 | The Live layer drops `details.reason` of the reset's 503 | OPEN: `live/errors.ts:50-69` keeps status, code, retry-after, request ID only | D | See R-D3 (residual) | `apps/core-web/src/test/live-system-demo.test.tsx:469` |
| 53 | CONTRACT-GAP-W76-2 | `76:353`; D178 | Operation 65 has no `notPermitted` example | By design | E | none | none |
| 54 | CONTRACT-GAP-W76-3 (+ F75-1) | `76:354`; `75:364`; D176, D178 | The binding of operation 62 (and 61) drops `rows` and `head` | OPEN; `ExportResult` is a simulator type (`sim/types.ts:943`) | D | See R-D4 (residual) | none |
| 55 | CONTRACT-GAP-W77-1 | `implementation/77_web_users_roles.md:71, 260`; D172 | No `admin.changed` on sign-in, sign-out or expiry | OPEN; already "accepted for the demo" (D172) | C | See R-C5 (residual) | `apps/core-web/src/features/users-roles/index.tsx:20`; `…/users-roles/users-panel.tsx:42` |
| 56 | CONTRACT-GAP-W78-1 | `implementation/78_mobile_devices.md:103`; D160 (3) | The Core serves no camera picture | A new Core capability | E | none | none |
| 57 | CONTRACT-GAP-W78-2 | `78:104`; D160 (3), (4) | The Core serves no per-device health history; the LIVE line is derived and says so | A new Core capability | E | Reword markers | `apps/mobile/src/features/devices/health-chart.tsx:10`; `…/devices/i18n.ts:99`; `…/devices/live-devices-sites.test.tsx:368`; `…/devices/live-devices-health-caption.test.tsx:1` |
| 58 | CONTRACT-GAP-W80-1 | `implementation/80_mobile_operator_audit.md:121`; D167 DN-3 | Operation 60 has no `notPermitted` example | By design: AUTHENTICATED (D154 DN-1) | E | Reword the test title | `apps/mobile/src/features/audit/live-audit-chain.test.tsx:193` |
| 59 | CONTRACT-GAP-W81-1 | `implementation/81_web_paired_devices.md:291`; D179 DC-4 | The close reasons of a pairing code (`EXPIRED`, `EXHAUSTED`, `CANCELLED`) are server literals | OPEN (`grep EXHAUSTED packages/shared/src` → nothing) | A | A shared constant `PAIRING_CODE_CLOSE_REASONS`, named in the `PAIRING_CODE_CLOSED` texts; adoption by the server and the page later (W91, W92) | none |
| 60 | CONTRACT-GAP-W81-2 | `81:292`; D179 DC-4 | A code replaced by a new issue is closed as `CANCELLED` | OPEN | C | See R-C6 (residual) | none |
| 61 | CONTRACT-GAP-W82-1 | `implementation/82_mobile_settings.md:148, 411`; D177 DN-6 | Operation 65 has no `notPermitted` example | By design | E | none | none |

### 4.4 Other task IDs

| # | ID | Recorded | Says | State | Class | Phase-2 action | Markers |
|--:|---|---|---|---|---|---|---|
| 62 | SIM-GAP-2 | D75 | The client spec's `auth.status` LOCKED is not a simulator value; the Live source keeps SIGNED_OUT with `lastSessionEnd.signOut: LOCK` | Accepted local adapter, pinned by a test | E | None (not a `CONTRACT-GAP-`; the marker documents the adapter) | `live/source/live-sim.ts:43`; `live-source-platform-neutral.test.ts:237` |
| 63 | SIM-GAP-1 (task) | D53, D56 | Text cuts could split a surrogate pair | CLOSED in the simulator (D56); the markers document the fix. The three mobile `SIM-GAP-1` markers in `features/session-new/**` are predecessor markers (4 existed at `acaff20`) | Closed | none | `packages/shared/src/sim/text-cut.ts:2`, `…/evidence-actions.ts:159, 276`, `…/session-machine.ts:1071, 1104`, `test/sim-text-cut.test.ts:1` |

### 4.5 Un-numbered items routed to W83 (labels W83-T*)

| # | Label | Recorded | Says | State | Class | Phase-2 action |
|--:|---|---|---|---|---|---|
| 64 | W83-T1 **KI-18** | `02_plan.md:1538`; `research/01b_explore_contract_dataset.md:274-297`; `implementation/27_contract_c.md:401-427`; F5 | The stale sentence "served by mock-core on 127.0.0.1:4400 (CORS allows the web dev origins)" (wrong in a packaged build); repeated in 8 places | In the `all` scope and the committed file every place is corrected (contract C, `27:405-415`). In the `offline` scope five strings are kept on purpose because they are true of Simulated mode (`openapi.ts:237, 245, 300, 315, 462`); the web re-points their origin strings in a packaged build (`apps/core-web/src/features/api-reference/api-document.ts:108-125`, W84's path). **Still stale: the offline health description `core-api.ts:601`**, which `pointAtCoreOrigin` does not touch (it swaps `info` and `tags` only) | A | Reword `core-api.ts:601` so that it names no fixed origin and no CORS claim (true in a dev run and a packaged build); by-design change of two pinned hashes (`api-openapi-scope.test.ts:55` `paths`, `:58` `getServiceHealth`) and the two test titles ("byte-equal to acaff20 except KI-18"); quote the diff of the eight places |
| 65 | W83-T2 notPermitted umbrella | brief item; `test/02_rbac_matrix.md:150`; D154 DN-1 | Operations 41, 49, 50, 60, 65, 70 show no `notPermitted` example | By design (constraint 3); it is the sum of items 40, 42, 43, 46, 53, 58, 61 | (E, not counted twice) | none |
| 66 | W83-T3 any-of name for clients | `71:333, 355-356` (F71-1); D155 (1), D168 DN-3 | The Live source passes `details.permission` on unchanged, so neither spelling gives the presenter a role | OPEN: `packages/shared/src/live/source/rebuild-error.ts:129`; the web presenter splits on `\|` only (`apps/core-web/src/lib/core-errors.ts:120-126`) | D | One line in `rebuild-error.ts:129`: normalise the label to `A \| B` (`_OR_`, `ANY-OF(…)`); see R-D1 (do now) |
| 67 | W83-T4 `DemoStatus.activeFaults` | `implementation/22_contract_b.md:677`; `27:803` | It restates the `faults` slice items; could refer to `FaultsSliceSchema` | OPEN, cosmetic | E | Defer to the code review of `packages/shared` (W92) |
| 68 | W83-T5 `Exact` in `api-schemas.test.ts` | `22:678`; `27:803` | The member-name proof could replace `Exact` | OPEN, test refactor | E | Defer to W92 |
| 69 | W83-T6 `source` of the ten | `27:804` | "Design book §21.2" names no operation number of [SP:§7] | OPEN; `x-dems-source` is in the pinned offline document (`api-openapi-scope.test.ts:181`) | E | None (would change nine pinned hashes for a cross-reference) |
| 70 | W83-T7 F-6 | `27:730-734`; `35:797` | `EvidenceExportRequest.destination` says "is cut"; the server refuses | The component is pinned and true of Simulated mode; the all-scope operation text says the server refuses (`core-api.ts:830`) | E | None |
| 71 | W83-T8 W52-F2 | `test/03:371, 427`; D115 | `validateCoreApiResponse` accepts an unknown top-level member for 26 response schemas | OPEN | A (DQ-3) | Strict for the Core-only answer schemas of contract A (`SignInResponse`, `SignInStatus`, `AuthSessionInfo`, `AuthSessionExpiry`, `BiometricEnrollment`, `RoleMatrix`, `AdminUserList`, `AdminUser`, the seven pairing answers, `DemoStatus`, `DemoEpoch`); NOT for `HealthResponse` (mock-core, the 0.1.0 launcher), the eight other offline answers and `ApiError` (pinned; residual sentence in AC-B-10). **Hypothesis, not measured:** an app test that writes such an answer by hand with an extra member turns red |
| 72 | W83-T9 two `DEFAULT_TIMERS` | D90 CPC1-28; `gateway_check/07_cp_shared_client.md:912` | Two exported constants share a name (`realtime/live-socket-client.ts:468`, `sim/platform.ts:187`) | OPEN; CP-C1 moved it to W92; the realtime name is pinned by its static test (D86 (3)); the sim one is DR-07 | E | Defer to W92 |
| 73 | W83-T10 the realtime entry | D111 DN-7 | `@dems/shared/realtime` re-exports a `.tsx`, so the server cannot type-check it | OPEN (`src/realtime/index.ts:3`); test rows import by file | D (`packages/shared/package.json` export split) | See R-D5 (residual) |
| 74 | W83-T11 reason length unit | D108 FU-DN-2; F75-3 (`75:366`) | The contract counts characters, Simulated mode and the forms count UTF-16 code units | Known: stricter in Live only for astral input | E | None; one sentence in the final report |
| 75 | W83-T12 F-B2a-7 | `implementation/26_engine_host.md:1256`; D122, D132 | A hosted refusal reported in a result (`EXPORT_DENIED`) commits a row and answers 403 without revision headers | Undocumented | A (+ B: API-7) | One sentence in the `coreServerDescription` of `exportEvidence` and the 403 texts of `exportAudit` / `exportLogs` (Core-only) |
| 76 | W83-T13 F-B2a-8 | `26:1257`; D122 | ENG-14 says only "never backwards"; a system time set back is now followed | `masterplan/01_specs.md:1129` unchanged | B | Erratum |
| 77 | W83-T14 AC-B-05 | D110 F4; `test/06_restart_recovery.md:600` | AC-B-05 names four recovery rows; the server writes five (§8.6) | `01_specs.md:1727` unchanged | B | Erratum |
| 78 | W83-T15 NL-6 | D112 DN-4; `gateway_check/04c:81`, `04b:404` | NL-6 to read "an explicit column list that leaves out the hash columns" | `masterplan/03_database_contract.md:1356` unchanged | B | Erratum |
| 79 | W83-T16 ID-1 (b) | D117 DN-2 (F-W47-1) | `signIn` is accepted from a device credential OR a session bound to a paired device | Spec unchanged | B | Erratum |
| 80 | W83-T17 §6.6 first line | D117 (F-W47-2); `test/02_rbac_matrix.md:508` | An UNPAIRED device presenting its old credential gets 403 `DEVICE_REVOKED` with a row | `01_specs.md:694` unchanged | B | Erratum |
| 81 | W83-T18 G-2 | D126 GD-2; `24b:918` | `01_specs.md:405` names operation 23 only for the device credential; operation 8 needs it too; `implementation/41:119, 322-326, 346, 423` | `01_specs.md:405` still names operation 23 only | B | Erratum (spec and row log) |
| 82 | W83-T19 `implementation/41` §8.2 | D129 DN-4 | "keeps the token and tries once" is superseded | Row log unchanged | B | Erratum note |
| 83 | W83-T20 CPS1-13 | `gateway_check/05_cp_access_control_security.md:447-449` | Three sentences no longer true: `core-server/src/db/commands/owner-connection.ts:10`; [DB:§6.6 LN-6] and T-AO-4; [DB:§5.4 NL-1] | All three unchanged | B (one is a server code comment) | Errata; the comment needs a grant |
| 84 | W83-T21 Stack Check service name | D137 DN-3 | The screen prints the service name without `dems-`; the spec words it with the prefix | As built (`57_mobile_pairing_flow.md:321`) | B | Erratum (and W87's report) |
| 85 | W83-T22 Test signal permission | D152 (1) F63-1; D156 (4) F70-7 | The Dashboard asks `DEVICE_MANAGE` for Test signal, the Core and the Devices page `DIAGNOSTICS_RUN` | Ruled "the console stays stricter" (D152) | B | Record the stricter Dashboard rule as intended in the client spec; no code change |
| 86 | W83-T23 Recovery Start hint | D175 DN-1 | The spec says "the hint disables it"; the button stays enabled with the hint | As built and accepted | B | Erratum |
| 87 | W83-T24 AC-C-106 | D179 DC-3 | The cache clause reads "no core entry holds data" | Not routed by name to W83; included for completeness | B | Erratum |
| 88 | W83-T25 F63-4 | D152 (6) | A Core audit message for a restart says "(simulated)" (`packages/shared/src/sim/maintenance.ts:225`) | Simulator text (DR-07); the Core's data shown as written (D176 DC-4) | E | None |
| 89 | W83-T26 `sessionNew.live.*` | D164 DN-5 | One shared pair of LIVE strings for both clients | Web key `sessionNew.live.coreLinkHint` (`i18n/en/session-new.ts:189-192`); mobile has its own wording | F | Copy round |
| 90 | W83-T27 `devices.live.samples` | D166 DN-F4; `gateway_check/09b:540` | The web's "Last N samples" and the mobile `features.devices.live.samples_*` | Web keys still "Simulated · …" (`i18n/en/devices.ts:290-291`) | F | Copy round |
| 91 | W83-T28 `storage.live.applied` | D168 DN-2 | Merge the mobile key with W71's shared key | Shared `storage.live.applied` exists (`i18n/en/storage.ts:211`) | F | Copy round |
| 92 | W83-T29 `system.live.*` | D177 DN-5 | W82's own copy keys move to W76's `system.live.*` | OPEN | F | Copy round |
| 93 | W83-T30 shared "(simulated)" in Live | D162 DN-5; `74:236` (F-3) | `evidence.exportWizard.success` reads "(simulated)" | OPEN (the destination labels stay, D158 DC-4) | F | Copy round |
| 94 | W83-T31 F75-7 | `75:370`; D176 DC-5 | The Simulated note "the demo simulator does not record the export reason yet" is no longer true | `i18n/en/security-audit.ts:239` unchanged | F (a deliberate Simulated copy change) | Copy round |
| 95 | W83-T32 Metadata "No DEMO package" | D165; `gateway_check/08a:393-395` | In Live, with operation 40 unanswered, the Metadata tab still says "No DEMO package for this item" | `apps/core-web/src/features/evidence/metadata-tab.tsx:113` uses `evidence.metadata.noPackage` | F | Copy round (web) |
| 96 | W83-T33 "Username typed" in Simulated | D167 DN-2; D176 DC-3 | Same wording for typed-username rows in both modes and both clients | Live only today | E | None (Simulated mode stays as before) |
| 97 | W83-T34 F73-4 | D175 DN-3 | "Last good segment" shows the recording start | Derived on the device and labelled so (item 48) | E | None |
| 98 | W83-T35 F78-3 / F79-1 | D168 DN-4; `78:234`; `79:362` | The predecessor marker texts `SIM-GAP-M84-3` and `SIM-GAP-M85-2` are stale | `apps/mobile/src/features/devices/sim-adapter.ts:17`; `apps/mobile/src/features/storage/sim-adapter.ts:10-14` | B (code comments) | Reword the comment text, keep the marker token (the KI-07 count stays) |
| 99 | W83-T36 CLIP chip press guard | `gateway_check/08a:386` (DC-6) | "if wanted, to W83/W88" | UX, not contract | E | Hand to W100 / W88 |
| 100 | W83-T37 D50 leftovers | D50 | All-scope document, 401 on the reads, KI-18 | CLOSED by contract C except KI-18 (item 64): `gen-openapi --check` reports "all … 75 operations, 2 security schemes, version 0.2.0" | Closed | none |
| 101 | W83-T38 CPS1-3 wording | D113, D118, D126 | The contract's wording of operation 23 | CLOSED: condition `DEVICE_CREDENTIAL` on operations 23 and 8 with example `deviceCredentialRequired` (registry dump, section 8) | Closed | none |

Also seen and NOT counted: `BE-GAP-W23-1/-2` (two test-failure explanations inside row W23, `implementation/23_request_guards.md:631, 648`, closed there); `SCHEMA-GAP-1` (not raised, `17:40`); 08a DC-2 (an F69-1 note for the final report, W88); CPC1-5 and CPC1-6 (closed by W44, D84).

## 5. Totals per class

| Class | Count | Items (ledger #) |
|---|--:|---|
| A | 34 | 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 38, 39, 59, 64, 71, 75 |
| B | 13 | 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 98 (plus the B halves of 26, 30, 31, 32, 75) |
| C | 7 | 36, 37, 41, 45, 50, 55, 60 |
| D | 5 | 51, 52, 54, 66, 73 |
| E | 28 | 15, 20, 24, 40, 42, 43, 44, 46, 47, 48, 49, 53, 56, 57, 58, 61, 62, 67, 68, 69, 70, 72, 74, 88, 96, 97, 99 (27 distinct items) and 65 (the umbrella row) |
| F | 7 | 89, 90, 91, 92, 93, 94, 95 |
| Closed | 7 | 1, 2, 7, 19, 63, 100, 101 |
| **Total** | **101** | |

The totals count ledger rows (101). Row 65 is an umbrella over seven E rows (40, 42, 43, 46, 53, 58, 61); it is a
ledger row of its own because the brief names it as one item, so E has 27 distinct items in 28 rows.

## 6. Ruling sheet (one row per C, D and E item, plus the four structural questions)

### 6.1 C items: server behaviour changes

| Ruling | Item | Smallest change | Blast radius | Recommendation |
|---|---|---|---|---|
| R-C1 | #36 CONTRACT-GAP-W44-1 (`hello` names the session) | `HelloMessageSchema` gains optional `session: { operatorId, issuedAt }` for `OPERATOR`; the hub's hello builder fills it; `live-sim.ts` `revalidateSession` compares at `hello` and drops the probe | Contract (realtime union, examples, `api-realtime.test.ts`), the hub and its tests, W49's `shared-state.test.ts` (message shapes), the Live source's local-end / atomicity tests, both runtimes | **Residual.** The client already closes the case with one `getAuthSession` after a reconnect (CPC1-35); the remaining windows are one round trip wide and need a sign-in in another tab inside them (F66-28). README / report: "After a reconnect the console confirms its session with one request before it shows the Core's data." Marker → `RESIDUAL-W44-1` |
| R-C2 | #37 CONTRACT-GAP-W44-2 (a sign-out names its session) | `SignOutRequestSchema` gains optional `issuedAt`; the server ends nothing and answers 401 when it differs; `settleDebt` sends it | Identity sign-out handler and tests, the Live source's debt tests, the contract examples | **Residual.** Report: "A sign-out owed by one tab and paid after another tab signed in can end that newer session; the operator signs in again." Marker → `RESIDUAL-W44-2` |
| R-C3 | #41 W66-1, #50 W74-2 (media reference in replicated rows) | `mediaSource` (or an `EvidenceMediaRef`) on `SessionHistoryEntry` and the evidence items of the replicated state | The replicated state is the simulator's state shape (`state-slices.ts`), so the change reaches the simulator (DR-07), the server's slice builder, the Live source, both clients and their parity tests | **Residual.** Report: "In Live mode the session list and the evidence list show the bundled poster by evidence number, or the brand still; the item's own picture opens in its detail." Markers → `RESIDUAL-W66-1`, `RESIDUAL-W74-2` |
| R-C4 | #45 W70-1 (`admin.changed DEVICES` on presence) | Publish `admin.changed { resource: DEVICES }` on a paired device's socket admission and departure (`core-server/src/realtime/hub.ts:219-224, 697-700`), debounced like the tablet link | Realtime acceptance tests that count messages (W48, W49), the web drawer and Paired Devices page (they would re-read twice: the request-count tests `live-paired-devices-list.test.tsx:199`, `live-devices-drawer.test.tsx:207`) | **Residual.** Clients re-read on a tablet-link change; the one case left: with two paired devices, one leaving while the other stays is seen at the next re-read. README sentence. Markers → `RESIDUAL-W70-1` |
| R-C5 | #55 W77-1 (`admin.changed` on sign-in, sign-out, expiry) | Publish `admin.changed { resource: USERS }` from `identity/sign-in.ts:241`, `identity/sessions.ts:191, 310` | Every sign-in would notify every USER_ADMIN socket; realtime tests counting messages; the web Users page refetch counts | **Residual** (already accepted for the demo, D172). README: "Active sessions and last sign-in are as fresh as the page's last read (it re-reads on focus)." Markers → `RESIDUAL-W77-1` |
| R-C6 | #60 W81-2 (`REPLACED` close reason) | `modules/pairing/codes.ts:53` closes a replaced code with `REPLACED`; the shared constant of #59 gains it | Pairing tests that pin `CANCELLED` on replace; the web page's rule 2 of §2.3 can then drop its status read | **Residual.** The page tells the two apart by a status read after the issue. Nothing to rename (no marker) |

### 6.2 D items: shared Live source, typed client, a client app

| Ruling | Item | Smallest change | Blast radius | Recommendation |
|---|---|---|---|---|
| R-D1 | #66 W83-T3 (any-of permission name) | `packages/shared/src/live/source/rebuild-error.ts:129`: `permission()` returns the label normalised to `A \| B` (strip `ANY-OF(…)`, split `_OR_` and ` \| `); no permission name holds `_OR_` (`core-server/src/plugins/permission-guard/access-rules.ts:186`) | Web and mobile presenters then name "Requires the Supervisor role" for operation 55. **Turns red by design:** `apps/mobile/src/features/storage/live-storage-sites.test.tsx:188-190` (asserts no "Requires the …"). Expected green: `apps/core-web/src/test/live-storage-policy.test.tsx:230-274` (it forbids a WRONG role only) — to be confirmed by the run | **Do now**, in the same landing as CONTRACT-GAP-5 (one mapping for every client, as F64 asked) |
| R-D2 | #51 W75-1 (export destination) | The web's Live audit and log export dialogs send a truthful `destination` (e.g. "Web console download"); the binding forwards it already | Two web feature folders and their Live tests that assert the request body `{ reason }` | **Residual**, consistent with D176 DC-4 (the Core's own record is shown as written). README / report: "In Live mode an export from the web console is recorded with the Core's default destination label." |
| R-D3 | #52 W76-1 (`details.reason` of the 503) | `LiveTransportError` keeps `details.reason` (`live/errors.ts:50-69`); the web presenter words two cases | `live-light-errors` tests, the web System test `:469`, the mobile presenter | **Residual.** Both cases read "The Core server is starting. Nothing was changed.", true for both. Marker → `RESIDUAL-W76-1` |
| R-D4 | #54 W76-3 + F75-1 (`rows` / `head` of an export) | Add `rows`, `head` to `ExportResult`, or a Live-only receipt | `ExportResult` is `sim/types.ts:943` (DR-07); a receipt is a new Live API on two pages | **Residual.** The pages read both values from the `AUDIT_EXPORTED` row in the replica (equal by [I39:§7.4]); fallback stated in `75:364` |
| R-D5 | #73 W83-T10 (realtime entry with a `.tsx`) | Split `@dems/shared/realtime` into a neutral entry and a React entry (`packages/shared/package.json`, `src/realtime/index.ts`) | Every importer of the entry in both apps; the export-subpath tests | **Residual.** Test rows import the socket client by file (D111 DN-7) |

### 6.3 E items: accept as documented residuals

| Ruling | Items | Why | README / report sentence |
|---|---|---|---|
| R-E1 | #40, #42, #43, #46, #53, #58, #61 (and the umbrella #65): no `notPermitted` example on operations 41, 49, 50, 60, 65, 70 | Pinned on purpose (constraint 3): no seeded role lacks EVIDENCE_VIEW or DIAGNOSTICS_RUN, and 60 / 70 are AUTHENTICATED (D154 DN-1). The tests that write that envelope by hand test the presenter path, which stays | Report: "Six operations show no NOT_PERMITTED example because no seeded role can be refused there; their 403 texts still name the code." Markers → reworded to cite this ruling |
| R-E2 | #15 SIM-GAP-W34-1, #24 SIM-GAP-W39-1 | Known differences of both modes, already ruled (D94, D102) | Final report (W88) lists both; markers stay (they are not `CONTRACT-GAP-`) |
| R-E3 | #20 SIM-GAP-W36-1, #67 T4, #68 T5, #72 T9 | Refactors with no behaviour; the simulator part would break DR-07 | Defer to the code review of `packages/shared` (W92) |
| R-E4 | #44 W69-2 | Accepted as built (D158 DC-1) | none |
| R-E5 | #47 W71-1, #48 W73-1, #56 W78-1, #57 W78-2 | New Core capabilities (SMART counters, per-check recovery results, a camera stream, per-device health history) beyond the demo; each Live screen already says what is derived | README: "In Live mode the SMART counters, the recovery check details and the device health lines are derived on the client from the Core's data, and the camera picture is the bundled demo loop." |
| R-E6 | #49 W74-1 | The order "role before body" is prose, and the prose says it (`core-api.ts:827`); a schema cannot express order | none |
| R-E7 | #62 SIM-GAP-2 | Accepted adapter (D75), pinned | none |
| R-E8 | #69 T6, #70 T7 | Would change the pinned offline document for a cross-reference or a text that is true of Simulated mode | none |
| R-E9 | #74 T11 | Stricter in Live only for astral characters; the server is the judge | Report sentence |
| R-E10 | #88 T25, #96 T33, #97 T34 | Simulator text or Simulated wording (Simulated mode stays as before); a derived value labelled as derived | none |
| R-E11 | #99 T36 | UX, not contract | Hand to W100 / W88 |

### 6.4 F items (copy sweep) and B items (errata): confirm the route

- **F (#89 to #95):** seven copy merges across `packages/shared/src/i18n/en/{session-new,devices,storage,system,evidence,security-audit}.ts`
  and both apps. They are owned by the page rows' i18n files, two of them change Simulated copy (#90 web "Simulated · …"
  stays in Simulated; #94 is a deliberate Simulated change), and they need web and mobile test runs. **Recommendation
  (DQ-7): a separate closing copy round after W83**, not W83's contract slot.
- **B (#76 to #87, #98, and the B halves of #26, #30, #31, #32, #75):** errata. **Recommendation (DQ-6):** one appended
  section "Errata (W83)" at the end of `masterplan/01_specs.md`, `masterplan/03_database_contract.md` and
  `masterplan/04_client_integration_spec.md` (lines are not rewritten in place: the specifications are not re-issued,
  D80 CPC1-17), a note line appended to `implementation/41_biometric_token.md`, and three code-comment fixes
  (`core-server/src/db/commands/owner-connection.ts:10`; the two mobile `sim-adapter.ts` comments, marker tokens kept).

### 6.5 Structural questions (DQ) for the controller

| # | Question | Options | Recommendation |
|---|---|---|---|
| DQ-1 | How to document a second code on a status of the ten existing operations (#13 W34-2, #17 W35-2) without changing the pinned offline document | (a) Model extension: optional `coreServerDescription` on `CoreApiResponseSpec`, used by the `all` builder and by `contract.support.ts` `registryCodes`; (b) rename the two `KNOWN_CODE_GAPS` entries to residual labels | **(a)**: about 15 lines in `contract-model.ts`, `openapi.ts` and the support file; the `all` document and the conformance table then say the truth; offline unchanged |
| DQ-2 | 400 `INVALID_JSON` on the 23 body-less POSTs (#18, #25) | (a) one PIPELINE envelope entry; (b) `400` on each operation | **(a)**: no new coverage cells (constraint 4), one new `components.responses` entry `InvalidJson`; by-design changes `api-envelope.test.ts:110`, `api-openapi-scope.test.ts:550-552`. `rbac-matrix.test.ts:1091-1096` filters by status, code and reason, so a 400 entry does not touch it (read). The PROBE mode of the matrix (`test/02:512-514`) relies on the server's 400, which does not change |
| DQ-3 | Strictness (#38 heartbeat, #71 W52-F2) | (a) strict Core-only schemas and a strict heartbeat member inside the Core union, offline untouched; (b) one sentence each in AC-B-46 and AC-B-10 | **(a)**, gated by the full web and mobile suites (the blast on hand-written fake answers is a hypothesis, not measured). If the gate shows more than a few red tests outside W83's files, fall back to (b) |
| DQ-4 | CONTRACT-GAP-6 | (a) "order not significant" in the description; (b) reorder the example to the stored order | **(a)**: the conformance test compares sets already |
| DQ-5 | Markers of residual items (C, D, E) | (a) rename `CONTRACT-GAP-W<row>-<n>` to `RESIDUAL-W<row>-<n>` and cite this file; (b) delete them | **(a)**: the trail stays searchable; W88 lists `RESIDUAL-*` |
| DQ-6 | Where the B errata go | (a) appended errata sections (section 6.4) with a grant on the three spec files, one row log and three code comments; (b) only in this file and W88's report | **(a)** |
| DQ-7 | The F copy sweep | (a) W83's single writer with grants on six shared i18n files and both apps; (b) a separate closing copy round | **(b)** |
| DQ-8 | OpenAPI `info.version` of the `all` scope (0.2.0 today) | keep 0.2.0, or 0.2.1 | **0.2.1** if DQ-1 to DQ-3 land (new documented responses and strictness); otherwise keep |
| DQ-9 | The report's file name | The plan names `implementation/83_contract_close_out_openapi.md` (`02_plan.md:894`); the brief names `83_contract_closeout.md` | This file follows the brief; the controller aligns the plan's artifact list |

## 7. Phase-2 plan

### 7.1 Writer and order

One coder-execution agent (tier R), contract slot F1, `.locks/contract.lock`, after the rulings and after checkpoint
commit 2. Each landing ends with `node --import tsx packages/shared/scripts/gen-openapi.ts` (write), then
`--check`, then the shared suite; landings that touch another workspace also run that workspace. Before the first
landing: pre-images (hashes) of every granted file outside the owned paths, and a fresh marker grep (W1 moves lines in
`apps/core-web`).

| Landing | Content (ledger #) | Files | Gate after the landing |
|---|---|---|---|
| L1 | Texts, examples and constants on Core-only operations: 6, 8, 9, 10, 11, 12, 14 (Core-only part), 16, 21, 22, 23, 26, 27, 28, 29, 30, 31, 33, 34, 35, 39, 59, 75, and the constant of 4 | `packages/shared/src/api/{pairing,identity,sessions,evidence,security-audit,alerts,realtime-messages,realtime-examples,demo-controls,administration,constants,operation-parts,patterns,core-api}.ts` | shared suite; `--check`; offline pins unchanged (`api-openapi-scope.test.ts` green without edits) |
| L2 | Envelope 400 `INVALID_JSON` (18, 25); close code 1009 (32) | `core-api.ts`, `realtime-messages.ts`; by design `api-envelope.test.ts:110`, `api-openapi-scope.test.ts:550-552`, `api-realtime.test.ts:787-789` | shared suite; `--check` |
| L3 | Response-level all-scope text (13, 17; DQ-1) | `contract-model.ts`, `openapi.ts`, `core-api.ts`; grant `apps/core-server/test/acceptance/contract.support.ts:99-111` | shared suite; server `db` file `test/acceptance/contract.test.ts` |
| L4 | Contract tables adopted: CONTRACT-GAP-3 (aliases kept), CONTRACT-GAP-4 in the client | `sim-actions.ts`, `constants.ts`; grants `packages/shared/src/live/source/bindings.ts`, `packages/shared/src/client/core-client.ts`, `packages/shared/test/client-credentials.test.ts`, `apps/core-server/src/modules/devices/operations.ts`, `…/devices/__tests__/routes.test.ts` | shared suite; server `unit` (devices) and `db` (`devices/__tests__/effects.db.test.ts`) |
| L5 | CONTRACT-GAP-5 example and helper, R-D1 | `storage.ts`, `operation-parts.ts` or `contract-model.ts`; grants `packages/shared/src/live/source/rebuild-error.ts`, `apps/mobile/src/features/storage/live-storage-sites.test.tsx` (assertion by design), `apps/mobile/src/features/storage/storage-screen.tsx` (comment) | shared suite; web `live-storage-*`; mobile `features/storage` |
| L6 | KI-18 (64) | `core-api.ts:601`; by design `api-openapi-scope.test.ts:55, 58` and two titles | shared suite; `--check`; the diff of the eight places quoted |
| L7 | Strictness (38, 71; DQ-3) | `realtime-messages.ts`, the contract A schema modules | shared, web, mobile and server suites in full (the hypothesis of #71 is tested here) |
| L8 | Marker sweep: A markers already gone with L1 to L6; C, D, E markers renamed (DQ-5); test titles reworded; `KNOWN_CODE_GAPS` emptied (10, 13, 17, 39); known-gap labels of `contract.test.ts:927-935` reworded | grants: `apps/core-server/test/acceptance/contract.test.ts`, `…/evidence/__tests__/commands.db.test.ts`, `packages/shared/test/live-source-platform-neutral.test.ts:226-245`, `packages/shared/src/live/source/live-sim.ts` (comments), `packages/shared/src/i18n/en/storage.ts:119` (comment), the 13 web and 16 mobile files of section 4 (comments and titles only) | the final gate (7.4) |
| L9 (if DQ-6 a) | B errata | the three spec files, `implementation/41_biometric_token.md`, three code comments | none beyond a diff |

### 7.2 Grants needed outside the owned paths (`02_plan.md:762`)

`packages/shared/src/live/source/{bindings,rebuild-error,live-sim}.ts`; `packages/shared/src/client/core-client.ts`;
`packages/shared/src/i18n/en/storage.ts` (one comment); `packages/shared/test/{live-source-platform-neutral,client-credentials}.test.ts`;
`apps/core-server/src/modules/devices/{operations.ts,__tests__/routes.test.ts}`; `apps/core-server/src/modules/evidence/__tests__/commands.db.test.ts`;
`apps/core-server/test/acceptance/{contract.test.ts,contract.support.ts}`; the 13 `apps/core-web` and 16 `apps/mobile` files of
section 4 (comments, test titles, and one assertion in `live-storage-sites.test.tsx`); for L9 the errata paths.
Optional later adoptions of the new constants by the server (`modules/pairing/limits.ts`, `identity/biometric/tokens.ts`,
`enrolment.ts`, `pairing/activity.ts`) are left to the code review W91, not to W83.

### 7.3 Tests of other rows that change by design

| File (owner) | Change | Landing |
|---|---|---|
| `packages/shared/test/api-openapi-scope.test.ts` (W27) | KI-18 hashes `paths`, `getServiceHealth`; two titles; envelope name list `+ InvalidJson` | L2, L6 |
| `packages/shared/test/api-envelope.test.ts` (W19) | envelope list `+ [400, [INVALID_JSON], PIPELINE]` | L2 |
| `packages/shared/test/api-realtime.test.ts` (W22) | close codes six → seven | L2 |
| `packages/shared/test/client-credentials.test.ts` (W12) | reads `BEARER_SECRET_PREFIXES` | L4 |
| `packages/shared/test/live-source-platform-neutral.test.ts` (W44) | marker list: no `CONTRACT-GAP-*` left; `RESIDUAL-W44-1/-2` if DQ-5 a | L4, L8 |
| `apps/core-server/test/acceptance/contract.test.ts`, `contract.support.ts` (W52) | `KNOWN_CODE_GAPS` emptied; `registryCodes` reads the response-level text; comments, console lines and `knownGap` labels reworded | L3, L8 |
| `apps/core-server/src/modules/devices/__tests__/routes.test.ts` (W36) | the CONTRACT-GAP-3 block reads the contract table; the W36-1 print reworded | L4, L8 |
| `apps/core-server/src/modules/evidence/__tests__/commands.db.test.ts` (W35) | two comments | L8 |
| `apps/mobile/src/features/storage/live-storage-sites.test.tsx` (W79) | the toast now names the Supervisor | L5 |
| Web and mobile tests that write a `notPermitted` envelope by hand (W63, W66, W69, W70, W73, W76, W80, W82) | **unchanged** (R-E1): titles and comments only | L8 |
| `packages/shared/test/api-state-examples.test.ts:233-238` | **unchanged** (R-E1) | none |

### 7.4 Expected effect on `gen-openapi --check`, and the gate

- Today: `packages/shared/openapi/openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0; offline: 10 operations, 0 security schemes, version 0.1.0)`, exit 0.
- After each landing the committed `all` document is regenerated; `--check` must again say "up to date" with **75
  operations** (and version 0.2.1 if DQ-8). Changes expected only in the `all` scope: descriptions and examples (L1),
  `components.responses.InvalidJson` and the 1009 row of the Realtime tag (L2), response descriptions of `stopSession`
  and `exportEvidence` (L3), `additionalProperties: false` on the strict schemas (L7). The **offline** document changes
  in exactly one place, the health description (L6), which moves the `paths` and `getServiceHealth` hashes.
- **Final gate** (the row's verification, `02_plan.md:762`, plus the cross-row edits):
  1. `grep -rn 'CONTRACT-GAP-' apps packages --include='*.ts' --include='*.tsx'` → no line;
  2. `grep -rn 'CORS allows the web dev origins\|served by mock-core on 127.0.0.1:4400' packages/shared/src packages/shared/openapi` → no line, and the diff of the eight KI-18 places quoted;
  3. `node --import tsx packages/shared/scripts/gen-openapi.ts --check` exit 0; registry and document both 75;
  4. `npm run typecheck` (all workspaces) and `npm run lint` exit 0;
  5. `@dems/shared` full suite at or above 68 files / 1,814 tests plus the new ones;
  6. `@dems/core-server` `unit` (154 / 3,916) and `db` (122 / 1,740) in full, `test/acceptance/contract.test.ts` and `rbac-matrix.test.ts` included;
  7. `@dems/core-web` full (93 / 1,244) and `@dems/mobile` full (140 / 1,721), each at or above the ledger;
  8. hashes of the granted files outside the owned paths: changed only where section 7.3 says.

## 8. Evidence (commands run in this phase, all read-only)

| Command | Output (shortened) |
|---|---|
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | `… is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0; offline: 10 operations, 0 security schemes, version 0.1.0)`, exit 0 |
| `git status --short packages/shared/src/api packages/shared/openapi packages/shared/scripts` | 0 entries (clean against `b90a3c6`) |
| `grep -rlE 'CONTRACT-GAP-' apps packages --include='*.ts' --include='*.tsx' \| wc -l`; lines; distinct IDs | 43 files; 88 lines; 34 IDs |
| `git grep -hoE 'SIM-GAP-[A-Z0-9-]+' acaff20 -- apps packages \| sort -u` | the predecessor markers `SIM-GAP-W43-1` … `SIM-GAP-W53-2`, `SIM-GAP-M80-1` … `SIM-GAP-M88-1`, `SIM-GAP-W1`, and 4 × `SIM-GAP-1` already at `acaff20` |
| A tsx script printing `CORE_API_OPERATION_TABLE` (operation, access, 403 example names) and `source` | 75 operations; 403 examples of 41, 49, 50, 60, 65, 70 are `deviceRevoked, originNotAllowed` only; spec numbers from `source` ("01_specs §7.x, operation N") |
| A tsx script listing POSTs without `requestBody` | 23: `touchSession`, `issuePairingCode`, `cancelPairingCode`, `unpairDevice`, `rotateDeviceCredential`, `beginPrecheck`, `retryPrecheck`, `acknowledgePrecheckWarnings`, `cancelSession`, `scanCaseNumber`, `recoverSession`, `takeSessionSnapshot`, `acknowledgeSessionSummary`, `verifyEvidence`, `archiveEvidence`, `restartDevice`, `testDeviceSignal`, `identifyDevice`, `runDiagnostics`, `restartServices`, `startSoftwareUpdate`, `acknowledgeAlert`, `resetDemo`; none documents 400 |
| A tsx script printing response descriptions of 12 operations | `pairing.ts:339` and `identity.ts:244` 423 texts unchanged; the 403 of `getDeviceRegistration`, `reportBiometricFailure` names `DEVICE_REVOKED` and the Origin only; the 403 of operation 7 names the password case without the reason |
| `grep` of `DEVICE_COMMAND_OPERATIONS`, `BEARER_SECRET_PREFIXES`, `PAIRING_CODE_LIFETIME_MS`, `BIOMETRIC_TOKEN_LIFETIME_MS`, `RESET_IN_PROGRESS`, `TOKEN_EXPIRED`, `EXHAUSTED` in `packages/shared/src` | nothing for each |

No test suite was run in this phase; the suites' figures in 7.4 are the controller's 03:01 ledger from the brief.

## 9. Deviations

| # | Deviation | Why |
|--:|---|---|
| DV-1 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | The brief allows only this file and the progress file (parallel run; the controller owns the shared files) |
| DV-2 | Class F added beside A to E | Seven copy merges are neither contract nor Live source; forcing them into D would hide that they change page-row i18n files and Simulated copy |
| DV-3 | The file name follows the brief, not the plan's artifact list (DQ-9) | Brief instruction |

---
*Generated: 2026-10-06 03:17 · Last updated: 2026-10-06 03:25*

---

# Part 2: phase 2 applied

Decision D184 ruled the sheet of part 1; checkpoint commit 2 is `057fc17`. Phase 2 ran from 03:33 to 04:24 on
2026-10-06 as the single writer of the contract slot, under `.locks/contract.lock`, with nobody else writing
the tree. **Status: complete**, with one fallback taken (DQ-3 (b) for the heartbeat) and one deviation
outside the grants (DV-4, one line) that needs ratification.

## P2.1 What was applied, by ruling

| Ruling | Applied as |
|---|---|
| A items (34) | 33 applied in the contract; ledger row 38 (gap W49-1, the strict union heartbeat) tried and reverted to DQ-3 (b): a sentence in AC-B-46 (errata S-7) |
| C (R-C1 to R-C6), D (R-D2 to R-D5), E (all) | Residuals; no server behaviour change; code markers renamed `RESIDUAL-W<row>-<n>` (DQ-5); sentences for W86 and W88 in P2.5 |
| R-D1 | Done in L5: `packages/shared/src/live/source/rebuild-error.ts:129` maps every spelling of the any-of to `A \| B` |
| DQ-1 (a) | `CoreApiResponseSpec.coreServerDescription` (L3) |
| DQ-2 (a) | One PIPELINE envelope entry 400 `INVALID_JSON` (L2) |
| DQ-3 | **(a) for the answers of contract A** (17 schemas strict, 0 tests outside W83's files red); **(b) for the heartbeat**: the strict union member turned 1 test outside W83's files red, `apps/core-server/test/acceptance/shared-state.test.ts:856` ("the union accepts an unknown member of a heartbeat", W49's own pin of the gap), a file outside the grants; reverted, and the sentence went into AC-B-46 (errata S-7) |
| DQ-4 (a), DQ-5 (a), DQ-6 (a), DQ-9 | As ruled |
| DQ-7 (b) | The seven copy merges (ledger #89 to #95) were not touched |
| DQ-8 | `info.version` of the `all` scope 0.2.1 (DQ-1 and DQ-2 landed in full, DQ-3 in part) |

## P2.2 Landings

Every landing ended with `node --import tsx packages/shared/scripts/gen-openapi.ts` (write), `--check`
(exit 0 each time), the shared suite, and the workspaces it touched. Pre-images of all 99 files edited
outside a new file are in `.cache/rollback/W83/` (mirrored paths), their hashes in
`.cache/rollback/W83.pre.sha256`, the list in `.cache/rollback/W83.files.txt`. Restore one file:
`cp -p .cache/rollback/W83/<path> <path>`.

| L | Ledger rows | Files (lines +/−) | Tests changed by design | Gate (exit 0 unless stated) |
|---|---|---|---|---|
| L0 | — | `.locks/contract.lock`; fresh marker grep: 87 lines in 43 files (the same 43 files as part 1, one line fewer after W1) | — | baseline shared 68 / 1,814; `--check` "up to date … 0.2.0" |
| L1 | 4 (constants), 6, 8–12, 14, 16, 21–23, 26–31, 33–35, 39, 59, 75 | `api/pairing.ts` (constants `PAIRING_CODE_LIFETIME_MS`, `PAIRING_CODE_MAX_FAILED_REDEEMS`, `PAIRING_QR_PREFIX`, `PairingCodeCloseReason`; the 423 text; the two descriptions; the web-session 403 on operations 21–23); `api/identity.ts` (`BIOMETRIC_TOKEN_LIFETIME_MS`, `BiometricTokenRefusalReason`, the 423 text, operation 7's reason and example, the web-session 403 and examples on operations 8 and 9, the reuse text); `api/patterns.ts` (`SESSION_TOKEN_PREFIX`, `DEVICE_CREDENTIAL_PREFIX`, `BIOMETRIC_TOKEN_PREFIX`, `BEARER_SECRET_PREFIXES`; the cursor comment); `api/contract-model.ts` (`PASSWORD_SESSION_REQUIRED_REASON`); `api/core-api.ts` (`details` names `sessionId`; the session commands' fixed texts; stopSession's 422 rule; the export denial note); `api/operation-parts.ts` (`INVALID_QUERY`, `REVOKED`, `EXPORT_DENIAL_NOTE`); `api/example-parts.ts` (`webConsoleSession`); `api/sessions.ts`, `evidence.ts`, `security-audit.ts`, `alerts.ts`, `realtime-messages.ts`, `realtime-examples.ts`, `administration.ts`, `demo-controls.ts` (`DemoRebuildRefusalReason`) | `api-registry.test.ts:591` (+ `webConsoleSession`); new `api-closeout.test.ts` | shared 69 / 1,832; web 95 / 1,255; mobile 140 / 1,721; server unit 154 / 3,916; offline pins unchanged |
| L2 | 18, 25, 32 | `api/core-api.ts` (envelope 400 `INVALID_JSON`, PIPELINE, after the routing 400); `api/realtime-messages.ts` (close code 1009) | `api-envelope.test.ts:110`; `api-openapi-scope.test.ts:552` (+ `InvalidJson`); `api-realtime.test.ts:787` (six → seven codes) | shared 69 / 1,834; typecheck server, web, mobile |
| L3 | 13, 17 | `api/contract-model.ts` (`coreServerDescription` on a response), `api/openapi.ts`, `api/core-api.ts` (stopSession and exportEvidence 422); `apps/core-server/test/acceptance/contract.support.ts` (reads both texts, +11 −3); `contract.test.ts` (`KNOWN_CODE_GAPS` emptied: 10, 13, 17, 39) | `api-openapi-scope.test.ts:485` | shared 69 / 1,835; `test:db test/acceptance/contract.test.ts` 34 / 34 — the code block passes with no known gap |
| L4 | 3, 4 | `api/sim-actions.ts` (`DEVICE_COMMAND_OPERATIONS`, `deviceCommandOfOperation`); `live/source/bindings.ts` (index derived, name kept); `apps/core-server/src/modules/devices/operations.ts` (table derived, name kept); `client/core-client.ts` (guard built from `BEARER_SECRET_PREFIXES`) | `client-credentials.test.ts` (+ list check); `live-source-platform-neutral.test.ts:235-247`; `devices/__tests__/routes.test.ts` (title, one assertion; the W36-1 print became an assertion that the validator accepts) | shared 69 / 1,836; server unit 154 / 3,916; `test:db devices/effects.db.test.ts` 3 / 3 |
| L5 | 5, 66 | `api/contract-model.ts` (`ANY_OF_DENIAL_SEPARATOR`, `denialPermissionOf`, `permissionsOfDenialLabel`); `api/storage.ts` (example `EVIDENCE_REVIEW_OR_MAINTENANCE`); `live/source/rebuild-error.ts:129` | `apps/mobile/src/features/storage/live-storage-sites.test.tsx:190` **and `:219`** (the twin test in the same file, same assertion; DV-7): the toast now says "Requires the Supervisor role", never Investigator or Technician; `storage-screen.tsx:199` comment | shared 69 / 1,837; web 95 / 1,255 (the web storage tests untouched and green); mobile 140 / 1,721 |
| L6 | 64 (KI-18) | `api/core-api.ts:601` | `api-openapi-scope.test.ts`: hashes `paths` and `getServiceHealth` (acaff20 values kept as comments) and two titles | shared 69 / 1,838; web `scalar-config` + `sim-fetch` 29 / 29; the other nine operation hashes, `info`, `servers`, `tags` unchanged |
| L7 | 71 (and 38, reverted) | 17 schemas `z.strictObject` in `api/identity.ts`, `administration.ts`, `pairing.ts`, `demo-controls.ts`; `api/openapi.ts` (version 0.2.1); `scripts/gen-openapi.ts` (comment) | `api-schemas.test.ts:189` (PairedDevice refuses an extra member); `api-openapi-scope.test.ts:8, 245, 371, 378` and `contract.test.ts:443` (version 0.2.1). The heartbeat attempt changed 8 pins in owned tests, all reverted with it | measured with both halves: web 95 / 1,255, mobile 140 / 1,721, server unit 154 / 3,916 green; server `db` 121 / 122 files, 1,739 / 1,740 (**the one red: `shared-state.test.ts:856`**); after the heartbeat revert `shared-state.test.ts` 6 / 6 |
| L8 | markers | closed gaps reworded ("gap N, closed by W83") in `contract.test.ts`, `commands.db.test.ts`, `revoke-dialog.tsx`, `live-storage-policy.test.tsx`, `live-devices-bed.tsx`; residuals renamed in 31 files (`RESIDUAL-W<row>-<n>`, "W83 ledger #n" at the first use in each file); `live-source-platform-neutral.test.ts` asserts no gap marker and the two residuals; `contract.test.ts` body-less block asserts the seven verdicts are `{"ok":true}` | `apps/mobile/src/features/dashboard/home-more-live-static.test.ts:150` (**DV-4**) | shared 69 / 1,840; web 95 / 1,255; server unit 154 / 3,916; mobile dashboard 7 / 55 |
| L9 | 76–87, 98, and the B halves of 26, 30, 31, 32, 75; 38 (S-7) | appended "Errata (W83)": `masterplan/01_specs.md` (S-1 to S-13), `masterplan/03_database_contract.md` (D-1 to D-3), `masterplan/04_client_integration_spec.md` (C-1 to C-4); note appended to `implementation/41_biometric_token.md`; comments `apps/core-server/src/db/commands/owner-connection.ts:10`, `apps/mobile/src/features/devices/sim-adapter.ts` (`SIM-GAP-M84-3` text), `apps/mobile/src/features/storage/sim-adapter.ts` (`SIM-GAP-M85-2` text) | — | `git diff --numstat` of the four documents: +24/+13/+14/+9, 0 deletions; KI-07 tokens in the two adapters 1 and 2, as at HEAD |

`packages/shared/test/api-closeout.test.ts` (new, 315 lines, 26 tests) holds every closing text, constant and
table to its ledger row, so that taking one back turns it red.

## P2.3 Deviations

| # | Deviation | Why |
|--:|---|---|
| DV-4 | `apps/mobile/src/features/dashboard/home-more-live-static.test.ts:150` was edited (one line plus a comment) although it is not in the grant list | W66's static test pins the marker `CONTRACT-GAP-W66-1` in `recent-sessions.tsx`, built from parts, so part 1's grep missed it. The rename that DQ-5 ordered turned it red; keeping the old marker would fail the row's own criterion. The line now pins `RESIDUAL-W66-1`. Pre-image saved. **Needs ratification** |
| DV-5 | Constants placed beside their area, not in `constants.ts`: the prefixes in `patterns.ts`, the pairing numbers in `pairing.ts`, the biometric lifetime in `identity.ts` | `constants.ts` holds network constants and imports nothing; each new constant sits next to the pattern or schema it describes, and the barrel exports all |
| DV-6 | Part 1 section 7.2 said "13 `apps/core-web` files"; the marker files of section 4 are 17 | A counting slip in part 1; the 17 are the ones section 4 lists, and only those (plus DV-4) were edited |
| DV-7 | Two assertions of `live-storage-sites.test.tsx` changed (`:190` granted and its twin `:219`) | The same assertion in the test of the Core's own spelling; R-D1 changes both alike |
| DV-8 | `KNOWN_CODE_GAPS` was emptied in L3, not L8; two prints became assertions (`devices/__tests__/routes.test.ts`, `contract.test.ts` body-less block) | The gate then proves the closure instead of printing it |
| DV-9 | The DQ-3 heartbeat half took fallback (b) on 1 red test, not "more than a few" | The red test lies outside the grants (`shared-state.test.ts` is W49's), and the sheet allowed no edit there; the controller may grant it and re-apply (a), which is ready: strict twin `RealtimeHeartbeatSchema` in the union, catalogue name `RealtimeHeartbeat`, 8 by-design pins in owned tests and `shared-state.test.ts:848-860` |

## P2.4 Final gate (part 1 section 7.4, all eight points)

| # | Check | Output |
|--:|---|---|
| 1 | `grep -rn 'CONTRACT-GAP-' apps packages --include='*.ts' --include='*.tsx'` | `0` lines (also 0 in `packages/shared/openapi/openapi.json`) |
| 2 | `grep -rn 'CORS allows the web dev origins\|served by mock-core on 127.0.0.1:4400' packages/shared/src packages/shared/openapi` | `0`. Diff of the eight places below |
| 3 | `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | `packages/shared/openapi/openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.1; offline: 10 operations, 0 security schemes, version 0.1.0)`, exit 0; `registry 75 document 75 version 0.2.1` |
| 4 | `npm run typecheck`; `npm run lint` (all workspaces, mock-core included) | exit 0; exit 0 |
| 5 | `npm test -w @dems/shared` | `Test Files 69 passed (69)`, `Tests 1840 passed (1840)` (ledger 68 / 1,814 + the new file's 26) |
| 6 | `npm test -w @dems/core-server`; `npm run test:db -w @dems/core-server` (04:19:36 to 04:21:25) | unit `154 passed (154)`, `3916 passed (3916)`; db `122 passed (122)`, `1740 passed (1740)`, `0 remain with the run prefix` — `contract.test.ts` and `rbac-matrix.test.ts` included |
| 7 | `npm test -w @dems/core-web`; `npm test -w @dems/mobile` | web `95 passed (95)`, `1255 passed (1255)` (the W1 ledger); mobile `Test Suites: 140 passed`, `Tests: 1721 passed` |
| 8 | `shasum -a 256 -c .cache/rollback/W83.pre.sha256` | 78 files changed, 53 of them outside the owned paths: exactly the files of section 7.2 / 7.3 and L9, plus DV-4. No pre-imaged file outside the owned paths is unchanged by accident; `git status` shows no other change in `apps/` or `packages/` beyond the new `api-closeout.test.ts` |

**KI-18, the eight places** (research `01b_explore_contract_dataset.md:274-297`): (1) the `core-api.ts` header
table, (2) the `openapi.ts` header, (3) the info summary, (4) the badge legend row, (5) the tag texts, (6) the
server description, (7) `openapi.json` — corrected by contract C in the `all` scope (the offline strings of
3 to 6 are true of Simulated mode and re-pointed by the web in a packaged build); (8) the web's
`api-document.ts` — W84's path, it swaps origins in `info` and `tags`. The stale sentence itself survived in
the offline health description and is gone now:

```diff
-      'Liveness of the local mock-core service. **Live**: served by mock-core on 127.0.0.1:4400 (CORS allows the web dev origins). This is not the device health snapshot; that is `GET /api/v1/device/health`.',
+      'Liveness of the local mock-core service. **Live**: served by mock-core over the network, on 127.0.0.1:4400 in a development run and on the page\'s own origin in a packaged build. This is not the device health snapshot; that is `GET /api/v1/device/health`.',
```

`api-closeout.test.ts` ("W83 ledger row 64: KI-18") holds both scopes free of the two stale phrases.

## P2.5 Sentences for the README (W86) and the final report (W88)

For the residuals of D184. README sentences describe Live mode to a user; report sentences record the limit.

| Item | README (W86) | Final report (W88) |
|---|---|---|
| R-C1 `RESIDUAL-W44-1` | — | After a reconnect the console confirms its session with one request before it shows the Core's data; `hello` does not name the session |
| R-C2 `RESIDUAL-W44-2` | — | A sign-out owed by one tab and paid after another tab signed in can end that newer session; the operator signs in again |
| R-C3 `RESIDUAL-W66-1`, `RESIDUAL-W74-2` | In Live mode the session list and the evidence list show the bundled poster by evidence number, or the brand still; an item's own picture opens in its detail | The replicated history and evidence rows carry no media reference |
| R-C4 `RESIDUAL-W70-1` | With two paired devices, one leaving while the other stays shows as offline only at the next refresh of the Devices drawer or the Paired Devices page | A paired device's socket opening or closing publishes no `admin.changed DEVICES`; clients re-read on a tablet-link change |
| R-C5 `RESIDUAL-W77-1` | On Users & Roles, active sessions and the last sign-in are as fresh as the page's last read; it reads again when the window regains focus | No `admin.changed` on sign-in, sign-out or expiry |
| R-C6 (gap W81-2) | — | A pairing code replaced by a new issue is closed with the reason `CANCELLED`; the page tells the two apart by a status read |
| R-D2 (gap W75-1) | In Live mode an export from the web console is recorded with the Core's default destination label, "Audit archive (simulated)" | — |
| R-D3 `RESIDUAL-W76-1` | — | A reset refused because another runs and a reset that failed both read "The Core server is starting. Nothing was changed." |
| R-D4 (gap W76-3, F75-1) | — | The export pages read the row count and head from the `AUDIT_EXPORTED` row in the replica, not from the answer |
| R-D5 (`@dems/shared/realtime`) | — | The entry re-exports a React file; server-side tests import the socket client by file |
| R-E1 (six operations) | — | Operations 41, 49, 50, 60, 65 and 70 show no NOT_PERMITTED example: no seeded role can be refused there; their 403 texts still name the code |
| R-E2 `SIM-GAP-W34-1`, `SIM-GAP-W39-1` | — | Known differences of both modes: a faulted session's recording time keeps counting; the simulator's `AUDIT_EXPORTED` row counts its ring of 1,000 |
| R-E5 `RESIDUAL-W71-1`, `RESIDUAL-W73-1`, `RESIDUAL-W78-2`, gap W78-1 | In Live mode the SMART counters, the recovery check details and the device health lines are derived on the client from the Core's data, and the camera picture is the bundled demo loop | — |
| R-E6 `RESIDUAL-W74-1`; R-E7 SIM-GAP-2; R-E8; R-E10; R-E11 | — | As the ruling sheet says (section 6.3) |
| R-E9 (reason length) | — | A reason is counted in characters by the Core server and in UTF-16 code units in Simulated mode; only astral input differs |
| DQ-3 (b) heartbeat | — | The union's `heartbeat` member is not strict (AC-B-46 erratum S-7); the shared-state test checks its members |
| `RESIDUAL-W63-1`, `-W66-2`, `-W69-1`, `-W70-2`, `-W80-1` | — | Covered by R-E1; `RESIDUAL-W69-2` is the accepted evidence-media cache key (D158 DC-1) |

## P2.6 Ledger after phase 2

| Class | Part 1 | After phase 2 |
|---|--:|---|
| A | 34 | 33 closed in the contract; 1 (row 38) moved to B by DQ-3 (b) |
| B | 13 | 14 applied as errata (13 + S-7), plus the B halves of rows 26, 30, 31, 32, 75 |
| C | 7 | 7 residuals (P2.5) |
| D | 5 | 1 done (R-D1), 4 residuals |
| E | 28 | 28 accepted; 17 code markers renamed `RESIDUAL-*` |
| F | 7 | untouched, for the closing copy round (DQ-7) |
| Closed | 7 | unchanged |

---
*Part 2 written: 2026-10-06 04:24*
