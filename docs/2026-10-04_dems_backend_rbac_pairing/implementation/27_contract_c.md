---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 49
plan_row: W27 (wave B4; contract-owner slot, fourth holder, P17)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: needs-review (the contract is written, in the tree and verified; one test and two type checks fail in files of the typed-client row, which this row may not edit: section 11, findings F-1 and F-2)
---

# 27 Contract C (blueprint step 49, plan row W27)

Row, verbatim: [W27] Contract C: the 47 operations of areas 4 to 11; the committed `openapi.json`
in the scope `all` (75 operations, two security schemes, server `http://127.0.0.1:4420`, version
0.2.0); `AuditChainStatus` gains `lineage` and `lineageTotal`. Writes: the contract paths of step 41.
Slot: contract owner. Implements AC-B-09 (registry side), AC-B-11; AC-C-01 (re-run at 75).
Rollback R-PRE.

**Result: every item of the row is written and is in the tree. The registry holds 75 operations
and the committed document is the `all` scope. Three of the row's verification commands do not
exit 0, and all three failures have one of two causes in the typed client, whose two files this row
may not edit.** A type function of `packages/shared/src/client/core-client.ts` cannot be evaluated
for a table of 47 or more operations, and one loop of `packages/shared/test/client-core.test.ts`
calls every operation that answers 204 without its path parameter. A patch for the owner (15 lines
added, 5 removed, in those two files) is in `implementation/assets/27_proposed_client_changes.patch`;
with it, on an isolated copy, the shared suite and the type check are green (section 8.3).

| Field | Value |
|---|---|
| Registry | **75 operations: 27 GET, 48 POST.** The 10 existing ones, the 27 of contract A, and **38 new ones** of areas 4 to 11 (the other 9 of the 47 operations of those areas are among the existing ten) |
| Access rules | 4 PUBLIC, 5 DEVICE, 25 AUTHENTICATED, 40 with one permission, 1 any-of (`setStoragePolicy`). Every entry carries exactly one access rule and one audit rule |
| Named schemas | 130: the 98 of contracts A and B, and 32 new ones |
| Committed `openapi.json` | Scope **`all`**: 75 operations on 74 paths, **two security schemes** (`sessionCookie`, `bearerAuth`), servers `http://127.0.0.1:4420` then `http://127.0.0.1:4400`, `info.version` **0.2.0**; 96,541 to 882,723 bytes |
| Scope `offline` | Unchanged: the ten operations, every section byte-equal to `acaff20` except the two components contract A widened. It is not a file: the web page builds it in the browser (section 5) |
| `AuditChainStatus` | `view`, `stored`, **`lineage`** (at most 20 `AuditChainLineageEntry`, newest first), **`lineageTotal`** |
| Text rule API-13 on slice text | **On** (rule 4(b)): the simulator fix has landed, and every scenario state still parses (section 7) |
| Existing assertions edited | In 8 files, each by design and listed with file and line in section 9.1 |
| Tests added | **54**, in 2 new files and 3 extended ones; 38 of 38 single changes detected (section 9) |
| `npm run test -w @dems/shared -- --maxWorkers=2` | **exit 1: 1,404 passed, 1 failed** in 57 files (`client-core.test.ts:481-488`, F-2) |
| `gen-openapi.ts --check` | exit 0 |
| `npm run typecheck -w @dems/shared` | **exit 2**: 10 errors in 2 files, one cause (F-1) |
| `npm run typecheck -w @dems/mobile` | **exit 2**: 1 error, the same cause (F-1) |
| Lint of shared; typecheck of core-web, core-server, mock-core | exit 0 (core-server on its third run, P11: section 8.2) |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | exit 0: 438 passed, `scalar-config.test.ts` unchanged |
| `git diff acaff20 --stat -- apps/mock-core release` | prints nothing |

Evidence files, all under `implementation/assets/`: `27_gate.log` (the final run),
`27_proposed_client_changes.patch` (F-1, F-2), `27_mutations.log` and `27_mutate.py` (the 38 single
changes), `27_changes_to_existing_files.diff` (what this row changed in the 21 files that existed).

Sources are cited as [SP:§n] for `masterplan/01_specs.md`, [CS:…] for
`masterplan/04_client_integration_spec.md`, [PL:…] for `masterplan/02_plan.md`, [DB:…] for
`masterplan/03_database_contract.md`.

---

## 1. The count: 47 operations in the areas, 38 new entries

[SP:§7.8-7.15] number the operations of areas 4 to 11 from 24 to 70: 47 operations. Nine of them
are design-book operations that the registry already held (24 `createSession`, 25 `startSession`,
26 `stopSession`, 27 `getCurrentSession`, 42 `exportEvidence`, 44 `getDeviceHealth`, 45
`getAudioStatus`, 46 `getVideoStatus`, 53 `getStorageStatus`). This row adds the other 38.

| | Operations | GET | POST |
|---|--:|--:|--:|
| The ten existing (area 12 health, and 9 of areas 4 to 7) | 10 | 6 | 4 |
| Contract A (areas 1, 2, 3, 13) | 27 | 8 | 19 |
| **Contract C (areas 4 to 11)** | **38** | **13** | **25** |
| **Registry** | **75** | **27** | **48** |

A test holds the numbering: the spec numbers of the 75 entries are exactly 1 to 75, and 47 of them
lie between 24 and 70 (`api-registry.test.ts`, "AC-B-09").

Order in the registry: the ten existing operations, then areas 1, 2, 3, then areas 4 to 11, then
area 13 (the demo controls stay last). The first ten keep their positions.

---

## 2. The 47 operations of areas 4 to 11

Generated from the registry, not typed by hand. "(existing)" marks the nine that this row did not
add. "Audit" is: on success; on a refusal by the access rule; other row types the call can write.
"Errors" lists, per documented status, the codes its description names; a status with `*` is sent
by the Core server only (section 4). No operation of these areas has a condition on top of its
marker. The last column is the member of `SimActions` the Core server hosts for the operation
[SP:§7.17], or what a read answers from.

| # | operationId | Method and path | Access | Conditions | Audit | Request | Success | Errors | Simulator action |
|--:|---|---|---|---|---|---|---|---|---|
| 24 | `createSession` (existing) | POST `/api/v1/session` | SESSION_START | — | SESSION_CREATED; ACCESS_DENIED | `SessionCreateRequest` | 200 `SessionCommandResponse`, 201 `SessionCommandResponse` | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED; 409 SESSION_ACTIVE; 422 INVALID_INPUT | `createSession` |
| 25 | `startSession` (existing) | POST `/api/v1/session/{id}/start` | SESSION_START | — | RECORDING_STARTED; ACCESS_DENIED; also PRECHECK_PASSED | `SessionStartRequest` (optional) | 200 `SessionCommandResponse`, 202 `SessionCommandResponse` | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED; 404 NOT_FOUND; 409 PRECHECK_RUNNING, PRECHECK_WARNINGS, PRECHECK_BLOCKED, INVALID_STATE; 422* INVALID_INPUT | `startRecording` |
| 26 | `stopSession` (existing) | POST `/api/v1/session/{id}/stop` | SESSION_START | — | RECORDING_STOPPED; ACCESS_DENIED | `SessionStopRequest` | 202 `SessionCommandResponse` | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED; 404 NOT_FOUND; 409 INVALID_STATE; 422 INVALID_REASON | `stopRecording` |
| 27 | `getCurrentSession` (existing) | GET `/api/v1/session/current` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `CurrentSessionResponse` | 401* NOT_SIGNED_IN; 403* DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads `session` |
| 28 | `beginPrecheck` | POST `/api/v1/session/{id}/precheck` | SESSION_START | — | NONE-P; ACCESS_DENIED | none | 202 `SessionCommandResponse` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 INVALID_STATE; 422 INVALID_INPUT | `beginPrecheck` |
| 29 | `retryPrecheck` | POST `/api/v1/session/{id}/precheck/retry` | SESSION_START | — | NONE-P; ACCESS_DENIED | none | 202 `SessionCommandResponse` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 INVALID_STATE, PRECHECK_RUNNING; 422 INVALID_INPUT | `retryPrecheck` |
| 30 | `acknowledgePrecheckWarnings` | POST `/api/v1/session/{id}/precheck/acknowledge` | SESSION_START | — | PRECHECK_PASSED; ACCESS_DENIED | none | 200 `SessionCommandResponse` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 INVALID_STATE, PRECHECK_RUNNING; 422 INVALID_INPUT | `acknowledgePrecheckWarnings` |
| 31 | `cancelSession` | POST `/api/v1/session/{id}/cancel` | SESSION_START | — | SESSION_CANCELLED; ACCESS_DENIED | none | 204 | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 INVALID_STATE; 422 INVALID_INPUT | `cancel` |
| 32 | `scanCaseNumber` | POST `/api/v1/session/case-number` | SESSION_START | — | NONE-P; ACCESS_DENIED | none | 200 `CaseNumberScan` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | `scanCaseNumber` |
| 33 | `recoverSession` | POST `/api/v1/session/{id}/recover` | SESSION_START | — | RECOVERY_STARTED; ACCESS_DENIED; also SYSTEM_BOOT, FAULT_CLEARED | none | 202 `SessionCommandResponse` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 INVALID_STATE; 422 INVALID_INPUT | `recover` |
| 34 | `addSessionMarker` | POST `/api/v1/session/{id}/markers` | SESSION_NOTE | — | MARKER_ADDED; ACCESS_DENIED | `SessionMarkerRequest` (optional) | 204 | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 INVALID_STATE; 422 INVALID_INPUT | `addMarker` |
| 35 | `addSessionNote` | POST `/api/v1/session/{id}/notes` | SESSION_NOTE | — | NOTE_ADDED; ACCESS_DENIED | `SessionNoteRequest` | 204 | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 INVALID_STATE; 422 INVALID_INPUT | `addNote` |
| 36 | `takeSessionSnapshot` | POST `/api/v1/session/{id}/snapshots` | SESSION_NOTE | — | SNAPSHOT_TAKEN; ACCESS_DENIED | none | 204 | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 INVALID_STATE; 422 INVALID_INPUT | `snapshot` |
| 37 | `acknowledgeSessionSummary` | POST `/api/v1/session/{id}/summary/acknowledge` | SESSION_START | — | SUMMARY_ACKNOWLEDGED; ACCESS_DENIED | none | 204 | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | `acknowledgeSummary` |
| 38 | `listSessionHistory` | GET `/api/v1/session/history` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | query `PageQuery` | 200 `SessionHistoryPage` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | reads `sessionHistory` |
| 39 | `listEvidence` | GET `/api/v1/evidence` | EVIDENCE_VIEW | — | NONE-R; ACCESS_DENIED | query `EvidenceListQuery` | 200 `EvidencePage` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | reads `evidence` |
| 40 | `getEvidence` | GET `/api/v1/evidence/{id}` | EVIDENCE_VIEW | — | NONE-R; ACCESS_DENIED | none | 200 `EvidenceDetail` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 422 INVALID_INPUT | reads `evidence` |
| 41 | `verifyEvidence` | POST `/api/v1/evidence/{id}/verify` | EVIDENCE_VIEW | — | EVIDENCE_VERIFIED; ACCESS_DENIED; also EVIDENCE_VERIFY_FAILED | none | 200 `EvidenceVerifyResult` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 422 INVALID_INPUT | `verify` |
| 42 | `exportEvidence` (existing) | POST `/api/v1/evidence/{id}/export` | EVIDENCE_EXPORT | — | EVIDENCE_EXPORTED; EXPORT_DENIED | `EvidenceExportRequest` | 202 `EvidenceExportAccepted` | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 FORBIDDEN; 404 NOT_FOUND; 409 NOT_SEALED, SECURITY_FAULT; 422 INVALID_REASON | `exportEvidence` |
| 43 | `archiveEvidence` | POST `/api/v1/evidence/{id}/archive` | EVIDENCE_REVIEW | — | EVIDENCE_ARCHIVED; ACCESS_DENIED | none | 204 | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 NOT_SEALED; 422 INVALID_INPUT | `archiveEvidence` |
| 44 | `getDeviceHealth` (existing) | GET `/api/v1/device/health` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `DeviceHealthResponse` | 401* NOT_SIGNED_IN; 403* DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads |
| 45 | `getAudioStatus` (existing) | GET `/api/v1/audio/status` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `AudioStatusResponse` | 401* NOT_SIGNED_IN; 403* DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads |
| 46 | `getVideoStatus` (existing) | GET `/api/v1/video/status` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `VideoStatusResponse` | 401* NOT_SIGNED_IN; 403* DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads |
| 47 | `getDeviceInventory` | GET `/api/v1/device/inventory` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `DeviceInventory` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads 7 slices |
| 48 | `restartDevice` | POST `/api/v1/device/{id}/restart` | DEVICE_MANAGE | — | DEVICE_COMMAND; ACCESS_DENIED | none | 204 | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 RECORDING_ACTIVE, COMMAND_UNSUPPORTED; 422 INVALID_INPUT | `deviceCommand` (RESTART) |
| 49 | `testDeviceSignal` | POST `/api/v1/device/{id}/test-signal` | DIAGNOSTICS_RUN | — | DEVICE_COMMAND; ACCESS_DENIED | none | 204 | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 409 COMMAND_UNSUPPORTED; 422 INVALID_INPUT | `deviceCommand` (TEST_SIGNAL) |
| 50 | `identifyDevice` | POST `/api/v1/device/{id}/identify` | DIAGNOSTICS_RUN | — | DEVICE_COMMAND; ACCESS_DENIED | none | 204 | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 404 NOT_FOUND; 422 INVALID_INPUT | `deviceCommand` (IDENTIFY) |
| 51 | `setActiveCamera` | POST `/api/v1/video/active-camera` | AUTHENTICATED | — | NONE-P; ACCESS_DENIED | `ActiveCameraRequest` | 204 | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | `setActiveCamera` |
| 52 | `resetMicClip` | POST `/api/v1/audio/clip/reset` | AUTHENTICATED | — | NONE-P; ACCESS_DENIED | `MicClipResetRequest` | 204 | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | `resetClip` |
| 53 | `getStorageStatus` (existing) | GET `/api/v1/storage/status` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `StorageStatusResponse` | 401* NOT_SIGNED_IN; 403* DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads |
| 54 | `getStorageDetail` | GET `/api/v1/storage/detail` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `StorageDetail` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads `storage`, `storagePolicy` |
| 55 | `setStoragePolicy` | POST `/api/v1/storage/policy` | ANY-OF(EVIDENCE_REVIEW, MAINTENANCE) | — | STORAGE_POLICY_CHANGED; ACCESS_DENIED | `StoragePolicyRequest` | 200 `StoragePolicySlice` | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | `setStoragePolicy` |
| 56 | `getNetworkStatus` | GET `/api/v1/network/status` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `NetworkStatus` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads `network`, `tabletLink` |
| 57 | `getTimeStatus` | GET `/api/v1/time/status` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `TimeStatus` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads `time` |
| 58 | `getSecurityStatus` | GET `/api/v1/security/status` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `SecurityStatus` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads `security`, audit head and total |
| 59 | `listAuditRows` | GET `/api/v1/audit` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | query `AuditListQuery` | 200 `AuditPage` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | reads `audit` |
| 60 | `verifyAuditChain` | GET `/api/v1/audit/chain` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `AuditChainStatus` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | `verifyAuditChain` |
| 61 | `exportAudit` | POST `/api/v1/audit/export` | AUDIT_EXPORT | — | AUDIT_EXPORTED; EXPORT_DENIED | `AuditExportRequest` | 202 `AuditExportAccepted` | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_REASON, INVALID_INPUT | `exportAudit` |
| 62 | `exportLogs` | POST `/api/v1/logs/export` | AUDIT_EXPORT | — | AUDIT_EXPORTED; EXPORT_DENIED | `AuditExportRequest` | 202 `AuditExportAccepted` | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_REASON, INVALID_INPUT | `exportLogs` |
| 63 | `listEvents` | GET `/api/v1/events` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | query `EventListQuery` | 200 `EventPage` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | reads `events` |
| 64 | `getSystemStatus` | GET `/api/v1/system/status` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `SystemStatus` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads 5 slices |
| 65 | `runDiagnostics` | POST `/api/v1/system/diagnostics` | DIAGNOSTICS_RUN | — | DIAGNOSTICS_RUN; ACCESS_DENIED | none | 202 `DiagnosticsRunStarted` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | `runDiagnostics` |
| 66 | `restartServices` | POST `/api/v1/system/services/restart` | MAINTENANCE | — | DEVICE_COMMAND; ACCESS_DENIED | none | 200 `ServicesRestarted` | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 409 SESSION_ACTIVE | `restartServices` |
| 67 | `startSoftwareUpdate` | POST `/api/v1/system/update` | MAINTENANCE | — | UPDATE_STARTED; ACCESS_DENIED | none | 202 | 401 NOT_SIGNED_IN; 403 NOT_PERMITTED, DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 409 SESSION_ACTIVE | `startSoftwareUpdate` |
| 68 | `updateSettings` | POST `/api/v1/settings` | AUTHENTICATED | — | NONE-P; ACCESS_DENIED | `SettingsUpdateRequest` | 200 `SettingsSlice` | 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | `setPresentationMode`, `updateSettings` |
| 69 | `listAlerts` | GET `/api/v1/alerts` | AUTHENTICATED | — | NONE-R; ACCESS_DENIED | none | 200 `AlertList` | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED | reads `alerts` |
| 70 | `acknowledgeAlert` | POST `/api/v1/alerts/{id}/acknowledge` | AUTHENTICATED | — | NONE-P; ACCESS_DENIED | none | 204 | 401 NOT_SIGNED_IN; 403 DEVICE_REVOKED, ORIGIN_NOT_ALLOWED; 422 INVALID_INPUT | `acknowledgeAlert` |

Rules the 38 new entries follow, each enforced by `api-registry.test.ts` for every entry:

- Path and method are those of the specification's tables; no two operations share a method and a
  path; a literal segment never matches a templated route (`case-number`, `current`, `history`,
  `inventory`, `chain` are tested one by one).
- Every one documents 403 (the Origin guard and a retired device apply to all) and 401 (none is
  PUBLIC). One with a permission names it and `NOT_PERMITTED` in its 403; the any-of names both.
- 400 is documented exactly where there is a body. **422 is documented where there is a body, a
  query or a path parameter** (SR-64 validates all three; the server's envelope already answers
  `details.in: params` and `querystring`). Contract A's rule said "a body" because none of its
  operations had a query, or a path parameter without a body.
- 405, 413, 429, 500 and 503 are never repeated: they are defined once.
- A GET writes no row (`NONE-R`); a POST never has `NONE-R`. Seven commands of these areas have
  `NONE-P`: the hosted action writes no audit row today.
- A success has a schema unless it is 204, or the 202 of `startSoftwareUpdate`, which [SP:§7.14]
  gives without a body.
- **No operation serves media or takes a file** [SP:§11]. `getEvidence` answers an
  `EvidenceMediaRef`, which holds a source and a package suffix and nothing else; a test refuses a
  path, a URL or a file name in it, and checks that no route has `media`, `file`, `download` or
  `upload` in its path.

### 2.1 Totals and distribution

```
operations 75   GET 27   POST 48
access     PUBLIC 4   DEVICE 5   AUTHENTICATED 25   one permission 40   any-of 1     (41 carry a permission)
audit      NONE-R 27 (every GET)   NONE-P 8   an audit type 40
           denial ACCESS_DENIED 72   EXPORT_DENIED 3 (exportEvidence, exportAudit, exportLogs; RB-5)
input      a body 25   a query 4   a path parameter 23
statuses   337 documented (operation, status) pairs; one example set for each of the 319 that have a body (449 examples)
tags       Service 1, Identity 8, Administration 5, Pairing 9, Session 15, Device 9, Storage 3,
           Evidence 5, Network 2, Security 6, System 5, Alerts 2, Demo 5
```

Every permission is enforced at exactly the operations [SP:§4.3] names for it; a test compares all
twelve lists, with operation 55 counting for both of its permissions.

---

## 3. Schemas

32 new named schemas, in eight modules, one per area (the folder's style, as contract A set it).

| Module | Operations | Named schemas |
|---|---|---|
| `sessions.ts` | 28 to 38 | `SessionMarkerRequest`, `SessionNoteRequest`, `CaseNumberScan`, `PageQuery`, `SessionHistoryPage` |
| `evidence.ts` | 39, 40, 41, 43 | `EvidenceListQuery`, `EvidencePage`, `EvidenceMediaRef`, `EvidenceDetail`, `EvidenceVerifyResult` |
| `devices.ts` | 47 to 52 | `DeviceInventory`, `ActiveCameraRequest`, `MicClipResetRequest` |
| `storage.ts` | 54, 55 | `StorageDetail`, `StoragePolicyRequest` |
| `network-time.ts` | 56, 57 | `NetworkStatus`, `TimeStatus` |
| `security-audit.ts` | 58 to 63 | `SecurityStatus`, `AuditListQuery`, `AuditPage`, `ChainVerifyResult`, `AuditChainLineageEntry`, `AuditChainStatus`, `AuditExportRequest`, `AuditExportAccepted`, `EventListQuery`, `EventPage` |
| `system.ts` | 64 to 68 | `SystemStatus`, `DiagnosticsRunStarted`, `ServicesRestarted`, `SettingsUpdateRequest` |
| `alerts.ts` | 69, 70 | `AlertList` |

Two more new modules: `state-examples.ts` (section 3.6) and `sim-actions.ts` (section 3.7).

### 3.1 Answers: the slices and what the hosted action returns

| Kind | Schemas | Rule |
|---|---|---|
| A read of the state | `DeviceInventory`, `StorageDetail`, `NetworkStatus`, `TimeStatus`, `SecurityStatus`, `SystemStatus`, `AlertList` | A strict object whose members are the slice schemas of contract B, under their slice names (API-6). In the document each member is a `$ref` to its `…Slice` component. `SecurityStatus` adds `auditHead` and `auditTotal` |
| A page of a list | `SessionHistoryPage`, `EvidencePage` (`items`), `AuditPage` (`rows`, `head`, `total`), `EventPage` (`events`) | The element is contract B's element schema (`SessionHistoryEntry`, `EvidenceItem`, `AuditRow`, `SimEvent`); `nextCursor` is a cursor or null |
| The answer of a hosted action | `EvidenceVerifyResult`, `ChainVerifyResult`, `CaseNumberScan`, `DiagnosticsRunStarted`, `ServicesRestarted` | The value the action returns |
| A slice as the answer | `setStoragePolicy` answers `StoragePolicySlice`, `updateSettings` answers `SettingsSlice` | The slice after the change |
| Server-built | `EvidenceMediaRef`, `EvidenceDetail`, `AuditChainStatus`, `AuditChainLineageEntry`, `AuditExportAccepted` | [SP:§7.18] |

Every answer of areas 4 to 11 is strict: a member the schema does not name is refused, not dropped.
Request bodies and queries are open objects (API-4: an unknown key is dropped).

**Compile-time proofs** (`api-domain-operations.test.ts`; a `false` member does not compile):
28 statements in three groups. A body is what the hosted action takes (`SessionNoteRequest.text`
is the argument of `addNote`; `StoragePolicyRequest` is `Partial<StoragePolicy>`;
`AuditExportRequest` is the simulator's type of that name; and so on). An answer is what the action
returns (`EvidenceVerifyResult`, `ChainVerifyResult`, the case number, the run ID, the restart
count). A read is `Pick<SimState, …>` of exactly the slices [SP:§7.10-7.15] name. Each proof
compares assignability in both directions and the member names at every depth (contract B's F-2).

### 3.2 `AuditChainStatus` [SP:§7.13, §7.18; DB:LN-5]

| Member | Form |
|---|---|
| `view` | `ChainVerifyResult`: `{ ok: true, checked, head }` or `{ ok: false, checked, index, seq, reason }` with `reason` one of `HASH_MISMATCH`, `PREV_LINK_BROKEN`, `SEQ_GAP`. The two forms do not mix |
| `stored` | `{ ok, checked, head, firstBadSeq }`; `firstBadSeq` is null while the stored chain verifies |
| `lineage` | A list of `AuditChainLineageEntry`, newest first, **at most 20** (`AUDIT_CHAIN_LINEAGE_MAX`); the 21st is refused |
| `lineageTotal` | A count; required, like `lineage` |
| `AuditChainLineageEntry` | `epoch`, `rows`, `head`, `resetAt`, `actorId` (an operator ID or null), `scenario`, `reason` (`RESET` or `SCENARIO_LOAD`). Strict: `firstSeq` and `lastSeq`, which the table stores, are not members [DB:§4.30] |

### 3.3 Requests: bounds in UTF-16 code units (rule 4(a))

zod's `.max()` counts code points; the simulator counts and cuts by code units. `boundedText(max,
min)` in `schema-parts.ts` is the one helper: trimmed, `min` to `max` characters, **and** at most
`max` code units, with the text rule. So the contract refuses what the hosted action would cut or
refuse, and the server never asks the simulator to cut.

| Input | Bound | The simulator's own bound | Proven with the real simulator |
|---|---|---|---|
| `SessionMarkerRequest.label` (optional; empty means "Marker n") | at most **80** code units | cuts at 80 | A label of 80 units, also one ending in a two-unit character, is in the `MARKER_ADDED` row as sent; 81 units is refused, also as 80 characters |
| `SessionNoteRequest.text` | 1 to **2,000** characters and code units [SP:§7.8] | refuses above 2,000 units | What the contract accepts the action accepts, what it refuses the action refuses (1,001 two-unit characters are 1,001 code points and are refused by both) |
| `AuditExportRequest.destination` (optional) | at most **120** code units | cuts at 120 | 120 units recorded as sent by `exportAudit` and `exportLogs`; 121 refused |
| `EvidenceExportRequest.destination` (**existing** operation 42) | at most **120** code units after trimming, as a refinement | cuts at 120 | The same. The JSON Schema of the component is unchanged (the offline hash still equals `acaff20`) |
| The reason of all three exports | **5 to 500**, mandatory | at least 5 | Section 3.4 |
| `EvidenceListQuery.q` | 1 to 100 | none (a search text) | — |

### 3.4 The export reason is mandatory for all three exports (controller note on D62)

[SP:§7.9] gives `exportEvidence` the existing `EvidenceExportRequest`, whose reason is required;
[SP:§7.13] gives `exportAudit` and `exportLogs` the body `{ reason, destination? }` and says "In
Live mode the export reason is mandatory". **The specification makes the reason required for all
three, so there is no conflict between the specification and the stored `exports` record**, which
has `reason` NOT NULL with at least 5 characters and a destination of 1 to 120 [DB:§4.20].

| | In the contract |
|---|---|
| The body | `requestBody.required: true` on all three operations |
| The reason | Required; trimmed; 5 to 500 characters and at most 500 code units; the text rule. An absent, empty, blank or four-character reason is refused |
| The simulator's form without a request (which records no reason, `sim/types.ts`) | Cannot be reached through the contract |
| The destination | Optional. The engine names its default ("Audit archive (simulated)", "Case file transfer (simulated)"), so the recorded one is never empty and never longer than 120 |
| The upper bound 500 | The specification gives none. It is the cap contract A gave every other reason (D50, DN-6). For `exportEvidence` it is a refinement; the component's JSON Schema is unchanged (DN-5) |

One test states all of this for the three operations and runs the three actions
(`api-domain-operations.test.ts`, "all three exports need a body with a reason").

### 3.5 List reads: query and paging (API-9; D51; controller note on D61)

Four operations name a query schema: `listSessionHistory` (`PageQuery`), `listEvidence`,
`listAuditRows`, `listEvents`.

| Rule | Detail |
|---|---|
| Paging | `cursor` and `limit` in, `nextCursor` (a cursor or null) out. `API_PAGE_LIMIT_DEFAULT` 50, `API_PAGE_LIMIT_MAX` 200 (new constants) |
| `limit` | A whole number from 1 to 200. The schema coerces: the server parses the text of the URL (`'20'`), a client passes a number; both give 20. In the document it is `{ type: integer, minimum: 1, maximum: 200 }` |
| `cursor` | Opaque; `LIST_CURSOR_PATTERN`: 1 to 128 letters, digits or hyphens. **No underscore, so no bearer value fits** and the typed client's rule against a credential in a URL never trips on a cursor. A sequence number, or a time and an ID joined by hyphens, both fit |
| **No member is required, and none has a default** | A client that gives no query sends none; the server applies the default of 50 |
| Filters | Value sets of the shared vocabulary, or IDs with their pattern. `listEvidence`: `status`, `caseType`, `q`. `listAuditRows`: `category`, `type`, `actorId`, `sessionId`, `evidenceId`, `order` (`ASC`, the order of the chain, when omitted; `DESC`). `listEvents`: `category`, `type`, `severity`; one order, by `seq` |
| After parsing | Every member is a string or a number (D51); a test walks the four schemas |

**Why no default, although the note prefers one.** The typed client parses the caller's query
with the schema and sends the result. With `limit` defaulting to 50, a call without a query sends
`?limit=50`, and `client-core.test.ts:147` (not this row's file) expects the bare path for every
operation: measured on the isolated copy, that test then fails; the fake transport's loops pass
either way. So the members are optional without a default, no operation has a required query
member, and `OperationExamples` needed no query example. Should a required query member ever be
added: give `OperationExamples` an additive `query?: Record<string, OpenApiExample>` beside
`request`, and have both loops pass its first value as `input.query`, the way they pass
`request` as `input.body`.

### 3.6 Examples follow the real simulator (`state-examples.ts`)

The contract does not import the simulator, so the state its examples show is plain data: sixteen
slices of the idle state at the example instant (2026-10-01 10:00:00 WIB), the two newest history
entries, the evidence item `EV-20260930-0004`, the two newest audit rows with head and total, the
two newest events, and the alert the simulator raises for `MIC_NO_SIGNAL`. Four long series are cut
to their newest two points. `api-state-examples.test.ts` builds the real state and compares every
value; it also compares the verdict examples, the chain examples, the case number, the run ID and
the restart count with what the real actions return at that instant.

Every (operation, status with a schema) pair of the 75 operations has at least one example: 319
pairs, checked by `api-state-examples.test.ts`, by `openapi.test.ts` and by the typed client's and
the fake transport's own loops. Two more rules are tested: a refusal for a missing permission names
a role that lacks it by the seeded matrix (`EVIDENCE_VIEW` and `DIAGNOSTICS_RUN` are held by every
role, so their six operations show no such example), and a refusal the engine raised carries
`details.simCode` with the status and code [SP:§7.2] maps it to.

### 3.7 The 42 simulator actions as data (`sim-actions.ts`)

[SP:§7.17] is a table; `SIM_ACTION_OPERATIONS` is that table: every member of `SimActions` with
the operation IDs it reaches and how it runs. Its keys are held to `keyof SimActions` at compile
time (a type-only import), and a test compares them with the keys of a real simulator.

```
hosted 31   server-native 9   not available 1 (signInWithSecurityKey, X-1)   internal 1 (setTabletLink, X-2)
40 actions reach 41 operations (deviceCommand: three; setPresentationMode and updateSettings: one)
the other 34 operations are reads and server functions
```

Of the 38 new entries, 26 host an action and name it in their description; the other 12 are reads.

---

## 4. The ten existing operations

Path, method, path parameter, request schema and the schema of every status a client gets without
the Core server are those of `acaff20` (`api-registry.test.ts`, "AC-B-13"; the offline document's
operation objects still hash to the baseline values).

They gained what only the Core server needs said [SP:§7.19], through two additive members of the
model (`contract-model.ts`):

| Member | Says | Used by |
|---|---|---|
| `responses[status].services` | Which services send that status, when not every answerer of the operation does | **401 and 403 on the five simulated reads; 422 on `startSession`.** Eleven statuses in all, each `['dems-core-server']` |
| `coreServerDescription` | The text of the `all` scope where `description` speaks of the simulator or of mock-core | All ten |

The `offline` scope shows neither (`isOfflineCoreApiResponse`, `listCoreApiResponseStatuses`), so
its document is unchanged. `validateCoreApiResponse` accepts every documented status, whoever
sends it.

**"The six reads" are five reads and health** (finding F-3). [SP:§7.2] adds 401 "to the six
reads"; the six GET operations of the baseline are the five simulated reads and
`getServiceHealth`. Health is PUBLIC [SP:§7.4]: it has no sign-in to fail, and its only 401 is the
envelope-level one for two credentials in one request, which contract A defined once. So five
operations document 401 and 403, and health still documents 200 alone.

**Why `startSession` gained a 422.** Its optional body is validated by the server with its schema
(stage 7), so a wrong member answers 422 `INVALID_INPUT`; the simulator ignores it. Without the
status the server could not answer a body that fails the schema with a documented status.

---

## 5. What is committed, and how the web reads each scope (rule 2)

| | Scope `all` | Scope `offline` |
|---|---|---|
| Where it is | **`packages/shared/openapi/openapi.json`**, the one committed file (`OPENAPI_COMMITTED_SCOPE = 'all'`) | **Not a file.** `createOpenApiDocument()` returns it by default; `gen-openapi.ts --scope offline --print` prints it |
| Who reads it | `gen-openapi.ts --check` and two shared tests, byte for byte. In Live mode the API Reference page will build it in the browser with `createOpenApiDocument({ scope: 'all' })` (W84) | The API Reference page in Simulated mode: `apps/core-web/src/features/api-reference/api-document.ts:133` calls `createOpenApiDocument({ includeSimulated })` |
| What guards it | The drift check, and the assertions of `api-openapi-scope.test.ts` | SHA-256 of every section against `acaff20` (`api-openapi-scope.test.ts`), and the unchanged `openapi.test.ts` and `scalar-config.test.ts` |

**Committing the `all` scope does not change what the web renders in Simulated mode, because no
app reads `openapi.json`.** Checked: the only readers of the file in the repository are
`packages/shared/scripts/gen-openapi.ts` and `packages/shared/test/{openapi,api-openapi-scope}.test.ts`
(`grep -rn "openapi\.json\|openapi/openapi"` over `apps`, `packages`, `scripts`). The page builds its
document from the registry in the browser, and the builder's default is the offline scope. That is
the second form the row's rule names ("one file plus the builder's `offline` scope used by the
web"), so no second file was added. `scalar-config.test.ts`, which pins ten operations through the
page's own document function, passes unchanged.

```
$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0; offline: 10 operations, 0 security schemes, version 0.1.0)
exit=0

$ shasum -a 256 packages/shared/openapi/openapi.json
83e5a186010619a817a6e2575ab286fae3746f27e37c99c45dc9d351b0e37977      (882,723 bytes)
```

---

## 6. The `all`-scope document (rule 5)

| Item | Value |
|---|---|
| `info.version` | `0.2.0` (`OPENAPI_CORE_SERVER_DOCUMENT_VERSION`); the offline scope keeps `0.1.0` |
| `servers` | `http://127.0.0.1:4420` (the Core server, every operation), then `http://127.0.0.1:4400` (mock-core: health and its heartbeat socket only) |
| `components.securitySchemes` | **`sessionCookie`**: `apiKey` in `cookie`, name `dems_session_4420` (ID-P7; `OPENAPI_SESSION_COOKIE_NAME`). **`bearerAuth`**: `http`, `bearer` (the device credential `dvc_`, or the device session token `ses_`) |
| `security`, per operation, from its access rule | PUBLIC: none, `[]` (3 operations). `signIn`: optional bearer, `[{}, {bearerAuth}]`, because a paired device sends its credential and a web console none (1). DEVICE, or a device session: `[{bearerAuth}]` (6). Every other rule: `[{sessionCookie}, {bearerAuth}]` (65) |
| Mode | `x-dems-mode` keeps the registry's value: `simulated` for the nine the in-app simulator can answer, `live` for the 66 others |
| Badges | `LIVE` on all 75 [CS:AR-3]: the Core server answers each over the network. `RBAC + AUDIT` stays on `exportEvidence` |
| Per operation | `x-dems-access`, `x-dems-audit`, `x-dems-services`, `x-dems-source`; `x-dems-rbac` on the four simulated commands only |
| Response headers | `x-request-id` on every answer of the 74 operations only the Core server answers over the network, `x-dems-epoch` and `x-dems-revision` on a 2xx of a POST. Health documents none (mock-core sends none). `x-dems-simulated` is not in this scope: the Core server never sends it (API-10) |
| Tags | 14: Service, Identity, Administration, Pairing, Session, Device, Storage, Evidence, **Network, Security, System, Alerts** (new), Demo, Realtime |
| Query parameters | The members of each query schema, as `in: query` |
| Realtime tag | Names both sockets (`ws://127.0.0.1:4420/ws`, `ws://127.0.0.1:4400/ws`), then the Core server's protocol, then mock-core's heartbeat |
| Examples | No credential-shaped value: contract A's tests scan every example and both documents; areas 4 to 11 add no secret-named member and no value of a secret's form |

**The vendor-extension assertion.** `openapi.test.ts:194-206` (lines 179-191 before this row) runs
on the offline document, where it passes unchanged; it was not edited. The `all` scope has its own, in
`api-openapi-scope.test.ts` ("uses no vendor extension beyond x-badges and x-dems-*; the names in a
headers map are HTTP header names"): it leaves the names inside a `headers` map out of the
extension check, as contract A wrote it, and now also pins those names to exactly `x-dems-epoch`,
`x-dems-revision` and `x-request-id`.

### 6.1 KI-18

In the `all` scope every text describes the Core server; the committed document holds none of the
stale sentences (a test searches the whole document for eleven of them).

| Place | State |
|---|---|
| `core-api.ts` header table (line 5-8 at contract A) | **Corrected**: who answers each of the ten, in both modes |
| `core-api.ts` health description | `all`: **corrected** (`coreServerDescription`). `offline`: kept, line 601 |
| `openapi.ts` header | **Corrected**: a table of the two scopes |
| `openapi.ts` info summary and description | `all`: **new texts**. `offline`: kept, lines 237 and 245 (the legend row) |
| `openapi.ts` Service tag, and the tags Session, Device, Storage, Evidence | `all`: **new texts**. `offline`: kept, line 315 |
| `openapi.ts` Realtime tag | `all`: **rewritten**. `offline`: kept, line 300 |
| `openapi.ts` server description | `all`: **two entries**. `offline`: kept, line 462 |
| `openapi.json` | **Corrected**: it is the `all` scope |
| `operation-table.ts` header | **Corrected** (it described a state D51 ended) |

**Left for W83, with the reason.** The six `offline` strings are what the Simulated-mode page shows,
and this row's rule is that that page does not change; the offline document is pinned section by
section to `acaff20`. Five of them are true of Simulated mode. The one that is stale there is the
health description ("served by mock-core on 127.0.0.1:4400 (CORS allows the web dev origins)"):
in a packaged build the origin is the page's own. Correcting it changes two pinned hashes
(`paths`, the `getServiceHealth` operation) and the page's text.

**Outside the contract folder**: `apps/core-web/src/features/api-reference/api-document.ts:108-125`
(`pointAtCoreOrigin`: its comment and its swap assume the offline texts);
`packages/shared/src/i18n/en/api-reference.ts:9, 49, 52, 82, 84` (the page's own strings name
mock-core; right in Simulated mode, wrong in Live mode: W84); the test titles
`packages/shared/test/openapi.test.ts:208` and `apps/core-web/src/test/scalar-config.test.ts:87`.

---

## 7. Rule 4(b): the text rule on slice text is on

The controller's note confirmed that the simulator fix landed (D56). Checked at the end of this row:

```
$ git diff acaff20 --stat -- packages/shared/src/sim
 packages/shared/src/sim/auth.ts             |  5 +++++
 packages/shared/src/sim/evidence-actions.ts |  5 +++--
 packages/shared/src/sim/session-machine.ts  |  7 +++++--
 packages/shared/src/sim/vocabulary.ts       | 27 +++++++++++++++++++++++++++
 4 files changed, 40 insertions(+), 4 deletions(-)          (and the new file text-cut.ts)

packages/shared/test/sim-text-cut.test.ts: 35 tests, passed
```

What was done: `text()` in `state-slices.ts` is `apiText()` (contract B's one line), and so is
`label()`, the non-empty names the engine mints, so that the statement of API-13, "every string
schema of the registry", holds for all 112 schemas the backend task added (DR-4). The full shared
suite was run: **every scenario state and every journey still parses** (contract B's 51 states and
1,428 slice parses, its replica journeys, and this row's eleven reads over four states). The rule
stays on.

One existing test changed with it, by design: contract B's "text is taken as the engine holds it"
asserted that a slice with an unpaired surrogate is accepted. It now asserts the opposite, and
that what well-formed input leaves in the state after the engine's three cuts is well-formed
(section 9.1). A new test walks the 112 schemas and finds no string that accepts U+0000 or an
unpaired surrogate; the 18 schemas of the ten existing operations are the exception, by AC-B-13.

---

## 8. Verification

### 8.1 State at the start (09:47 WIB, before the first edit)

```
$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  46 passed (46)
      Tests  977 passed (977)
exit=0
$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (offline (committed): 10 operations; all: 37 operations)
exit=0
```

### 8.2 Final run on the tree (10:52 to 10:56 WIB; full output: `assets/27_gate.log`, part 1)

```
$ npm run test -w @dems/shared -- --maxWorkers=2
 FAIL  test/client-core.test.ts > contract A: a success without a body (the five 204 operations) > each of them resolves as a success with undefined data
CoreClientUsageError: cancelSession needs the path parameter "id"
 Test Files  1 failed | 56 passed (57)
      Tests  1 failed | 1404 passed (1405)
exit=1

$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0; offline: 10 operations, 0 security schemes, version 0.1.0)
exit=0

$ npm run typecheck -w @dems/shared
test/api-registry.test.ts(841,29): error TS2590: Expression produces a union type that is too complex to represent.
test/api-registry.test.ts(857,7): error TS2578: Unused '@ts-expect-error' directive.     (and lines 859, 861, 863, 865)
test/client-types.test.ts(211,5): error TS2578: Unused '@ts-expect-error' directive.     (and lines 213, 215, 217)
exit=2

$ npm run lint -w @dems/shared               exit=0
$ npm run typecheck -w @dems/core-web        exit=0
$ npm run typecheck -w @dems/mobile
src/runtime/dev-probes.ts(225,24): error TS2590: Expression produces a union type that is too complex to represent.
exit=2
$ npm run typecheck -w @dems/core-server     exit=2 (10:52:22), exit=2 (10:54:18), exit=0 (10:55:54)
$ npm run typecheck -w @dems/mock-core       exit=0

$ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  39 passed (39)
      Tests  438 passed (438)
exit=0

$ git diff --stat acaff20 -- apps/core-web/src/test/scalar-config.test.ts   (prints nothing when unchanged)
(end)
$ git diff acaff20 --stat -- apps/mock-core release                          (prints nothing when unchanged)
(end)

$ npm run test -w @dems/core-server -- --maxWorkers=2
 10:53:06   Test Files  5 failed | 36 passed (41)     Tests  19 failed | 1257 passed (1276)     exit=1
 10:54:25   the same 19                                                                            exit=1
 10:56:01   Test Files  1 failed | 40 passed (41)     Tests   1 failed | 1279 passed (1280)     exit=1
```

**The core-server runs (P11).** Another row was writing `apps/core-server/src/core/**` during this
gate (file times 10:51:24 to 10:55:49). Its files did not compile at 10:52 and 10:54
(`src/core/__tests__/pipeline.test.ts(9,10): Module '"../audit-writer"' has no exported member
'AUDIT_INSERT'`) and 18 of the 19 failures were in `src/core/__tests__/`. After it saved, the type
check exits 0 and one failure remains:

```
 FAIL  |unit| src/plugins/db/__tests__/db.test.ts > boot step B-1 > passes when the database answers and sets the flag
Caused by: BootCheckError: B-2: the server reports version number NaN; PostgreSQL 18 is expected.
 ❯ Object.checkServerVersion [as run] src/db/schema/boot-checks.ts:85:11
 ❯ Object.run src/core/boot-checks.ts:55:11
```

It is a scaffold test whose fake pool now meets the boot step B-2 that `src/core/boot-checks.ts`
registers; neither file imports the contract (finding F-10). The nine server test files that do
import `@dems/shared/api`, the health test against the widened schema among them, pass: 9 files,
459 tests, exit 0 (10:54:40).

### 8.3 The same contract with the proposed client patch (`assets/27_gate.log`, part 2)

On an isolated copy of `packages/shared` under `.cache/W27/mut`, every file equal to the tree's
except the two the patch changes. Nothing in the tree was changed.

```
$ vitest run --root .cache/W27/mut/packages/shared --maxWorkers=2
 Test Files  57 passed (57)
      Tests  1405 passed (1405)
exit=0
$ tsc --noEmit -p .cache/W27/mut/packages/shared/tsconfig.json
exit=0
$ tsc -p .cache/W27/tsconfig.mobile.tree.json      (apps/mobile/src/runtime/dev-probes.ts against the tree's shared package: the control)
apps/mobile/src/runtime/dev-probes.ts(225,24): error TS2590: Expression produces a union type that is too complex to represent.
exit=2
$ tsc -p .cache/W27/tsconfig.mobile.patched.json   (the same file against the copy with the patch)
exit=0
```

The whole mobile workspace was not type-checked against the copy; the one file that fails was.

### 8.4 The row's verification items

| Item | Result |
|---|---|
| The shared tests exit 0 | **No**: 1,404 of 1,405; the one failure is F-2 |
| `gen-openapi.ts --check` exits 0 | Yes |
| Exactly 75 operations (27 GET, 48 POST), each with `access` and `audit` | Yes (`api-registry.test.ts`) |
| The document lists 75 operations and two security schemes | Yes (`api-openapi-scope.test.ts`, "AC-B-11"; `openapi.test.ts`) |
| The typed client's callable operation count is 75 | **At run time yes**: `client.operationIds` has 75 entries, and both loops call all 75. **At compile time no**, until F-1 is fixed: literal-typed calls are not checked |
| The typed client's own tests green and unchanged | **No**: unchanged; `client-core.test.ts` 1 failed (F-2), `client-types.test.ts` 4 type errors (F-1) |
| `npm run typecheck` and `npm run lint` exit 0 for `@dems/shared` | Lint yes. Typecheck **no** (F-1) |
| `npm run typecheck` exit 0 for core-web, mobile, core-server, mock-core | core-web, core-server (third run), mock-core yes. Mobile **no** (F-1) |
| Web tests 438 passed, `scalar-config.test.ts` unchanged | Yes |
| The core-server tests still green | **No, and not because of the contract**: one scaffold test of another row's change (F-10); the tests that use the contract pass |
| `git diff acaff20 --stat -- apps/mock-core release` prints nothing | Yes |

---

## 9. Tests

### 9.1 Existing assertions edited, each by design

Lines are those of the file as contract B left it (`.cache/rollback/W27.pre.*`); the full diff is
`assets/27_changes_to_existing_files.diff`. The three pinned files: only `openapi.test.ts`
changed; `schemas.test.ts` and `sim-api-validation.test.ts` are untouched, and so is
`api-schemas.test.ts`.

| File and lines | Before | After | Why |
|---|---|---|---|
| `openapi.test.ts:163-167` | "matches the committed openapi/openapi.json byte for byte": the committed file equals the offline document | The committed file equals the `all` scope and holds 75 operations; the offline document is still what the generator renders for `offline` | AC-B-11; [CS:AR-1]: "The committed `openapi.json` and the drift test use **all**" |
| `openapi.test.ts:421-425` | Every documented status of the nine simulated operations is produced by the simulator | The statuses of the offline scope are produced by it; the other eleven must be marked Core-server-only | [SP:§7.19]: "the comparison must be limited to the statuses the simulator can produce" (rule 6) |
| `api-registry.test.ts:143-152` | `shapeOf` lists every response of an entry | It lists the responses of the offline scope; a new test pins the eleven Core-server-only statuses | The same; AC-B-13 still holds for what the baseline documented |
| `api-registry.test.ts:160-175` | 37 operations; 14 GET, 23 POST; the entries after the ten equal contract A's 27 | 75; 27 GET, 48 POST; the 65 in spec order | [PL:CO-3]: "The absolute pins … are asserted from W27 on" |
| `api-registry.test.ts:258-260` | `EXPORT_DENIED` only on `exportEvidence` | On the three exports | RB-5 names operations 42, 61 and 62 |
| `api-registry.test.ts:267-269` | 4, 5, 10, 18, 0 by access rule | 4, 5, 25, 40, 1 | [SP:§7] as the row states it |
| `api-registry.test.ts:321-322` | The `all` scope has 37 | 75 | The same |
| `api-registry.test.ts:358-370` | 98 schemas; the last 48 are the socket's | 130; the socket's 48 in the middle; then this row's 32, listed by name | **Contract B's pin on the schema count** |
| `api-registry.test.ts:373-386` | A success has a schema unless it is 204; five operations answer 204 | Also the 202 of `startSoftwareUpdate`; seventeen answer 204 | [SP:§7.14] gives that 202 no body |
| `api-registry.test.ts:397-399` | 422 documented exactly where there is a body | Where there is a body, a query or a path parameter | SR-64 (section 2) |
| `api-registry.test.ts:419, 454, 457, 477, 499, 532` | Titles and counts at 37; `Table[36]` is the reset | At 75; `Table[74]` is the reset | The same |
| `api-registry.test.ts:558-559` | No operation has a query | Four have one, named | Contract A wrote "the first list read with one comes with contract C" |
| `api-openapi-scope.test.ts:171-178` | "is the committed openapi.json, byte for byte" (offline) | "is not a file: the builder returns it, and the committed openapi.json holds the other scope" | AC-B-11 |
| `api-openapi-scope.test.ts:193-215` | 37 operations on 36 paths; 9 simulated, 28 live | 75 on 74; 9 and 66; `LIVE` on all | The registry is complete; [CS:AR-3] |
| `api-openapi-scope.test.ts:223, 237` | `permissions` from `access.permission` | From `coreApiAccessPermissions` | The any-of has two |
| `api-openapi-scope.test.ts:249-257` | The ten are equal to their offline twins apart from three `x-dems-*` members | Equal in ID, tags, summary, parameters, request body, mode, source, RBAC note, and the description, schema and examples of every offline status; the differences are named | In this scope they are described as the Core server answers them [SP:§7.19] |
| `api-openapi-scope.test.ts:267-278` | Six header components; a simulated operation documents `x-dems-simulated` | Five; the nine document the Core server's headers | API-10: the server never sends that header |
| `api-openapi-scope.test.ts:296-305` | "what contract C still owes this scope": no scheme, one server, 0.1.0 | Replaced by two tests: two schemes with the per-operation rule; the server 4420 first and 0.2.0 | API-12. Contract A pinned it "so that the change is made on purpose" |
| `api-realtime.test.ts:817-833` | The `all` Realtime tag begins with the offline text and names no host | It names both sockets, the Core server first; mock-core's rules and example are the offline text's, word for word | Contract B: "the pin … changes then" |
| `api-realtime.test.ts:849` | The first JSON block is the heartbeat | The first is `hello`, the last the heartbeat | The same |
| `api-state-slices.test.ts:779-821` | "text is taken as the engine holds it": ill-formed text in a slice is accepted; a 130-unit destination passes `EvidenceExportRequest` | The rule is on: such a slice is refused; the destination is refused; what the engine leaves after its cuts is well-formed | Rule 4 (section 7) |
| `api-text-rule.test.ts:154-156` | 17 operations take a body | 25, and 4 a query | The registry is complete |
| `api-envelope.test.ts:158, 161-162` | A 403 `NOT_PERMITTED` on `getCurrentSession` is a contract violation | The same statement for `getServiceHealth`; the reads accept their own 401 and 403 | The five reads document both now (F-5) |
| `api-examples.test.ts:50, 73, 125` | "the 27 new operations"; more than 110 answers, 80 errors | "the 65 operations that only the Core server answers"; more than 300 and 230 | The registry is complete |

### 9.2 Tests added (54)

| File | Tests | Subject |
|---|--:|---|
| `test/api-domain-operations.test.ts` (new) | 25 | 28 compile-time proofs. The eleven read schemas against the idle state and three scenarios, and their strictness. The answers of the hosted actions. The four text bounds against the real simulator. The reason of the three exports. The other bodies. The path-parameter patterns against every ID the simulator mints. The four queries. The 42 actions |
| `test/api-state-examples.test.ts` (new) | 12 | The example state against the real simulator; the examples of the hosted actions; every (operation, status) pair of the 75; denial examples against the seeded matrix; the simulator codes |
| `test/api-registry.test.ts` | +9 | The 38 against the specification's tables; the Core-server-only statuses; `coreServerDescription`; every permission at its operations; `NONE-P`; the status of every success; the specific 404 and 409; routing of the literal routes and no media route; a list read through the typed client |
| `test/api-openapi-scope.test.ts` | +6 | The offline scope leaves out what only the Core server sends; the committed file; the security schemes; the servers and the version; KI-18; the Realtime tag; the query parameters (two former tests became others) |
| `test/api-text-rule.test.ts` | +2 | The form of a query; API-13 over the 112 schemas |

### 9.3 Can the tests fail? (38 single changes; `assets/27_mutations.log`)

Each change was made to one source file on an isolated copy (`.cache/W27/mut`), never on the tree;
the contract tests and the type check were run there, and the file was restored. Two passes: with
the committed document as it is (a change that shows in the document also fails the drift check),
and with the document regenerated after each change, so that only a semantic assertion can catch
it. **36 of 36 in each pass, and 2 of 2 added later: 38 of 38.**

| Group | Changes |
|---|---|
| Registry (11) | A wrong path; a wrong permission; a wrong audit rule; the any-of with a wrong permission; the audit export with `ACCESS_DENIED`; a GET that became a POST; a wrong success status; a missing 409; a wrong access rule; a 404 where the specification has none; an action marked server-native that is hosted |
| The ten existing (3) | The 401 of the reads not marked Core-server-only; the registry in another order; the evidence export destination without its bound |
| Schemas (13) | The marker bound at 81; a bounded text without its code-unit bound; a limit up to 500; a limit with a default; a cursor with an underscore; no `lineageTotal`; a lineage of 50; a media reference whose source and suffix need not agree; a read that is not strict; retention days up to 4,000; the text rule off for slice text; an export reason of 4 characters; the evidence export reason without its upper bound |
| Document (9) | Version 0.1.1; a DEVICE operation that takes the cookie; the simulator's text of the ten in the `all` scope; the offline document with the Core-server-only statuses; the committed scope back to `offline`; `SIMULATED` badges in the `all` scope; one security scheme; the Core server not the first server; an audit export whose body is optional |
| Examples (2) | An example slice that differs from the simulator; a credential-shaped example |

### 9.4 Test ledger (P24)

| Workspace | Before this row | After | Note |
|---|---|---|---|
| `@dems/shared` | 977 passed in 46 files (09:47, before the first edit) | **1,405 in 57 files: 1,404 passed, 1 failed** | +54 tests and +2 files are this row's. +374 tests and +9 files arrived from three other rows while it ran: `sim-text-cut.test.ts` 35, `realtime-live-*.test.ts` 130 in 2 files, `live-testing-*.test.ts` 209 in 6 files |
| `@dems/core-web` | 438 in 39 | 438 passed in 39 | no change |
| `@dems/mobile` | 833 in 72 suites | not run (only its type check is a gate of this row) | — |
| `@dems/core-server` (unit) | not this row's | 1,280 in 41 at its last run, 1 failed (F-10) | no file of this row |

Expected shared total = 977 + 54 + 374 = 1,405. The thirteen contract test files hold 361 tests
(307 before). The gate does not pass: failed is 1 (F-2).

---

## 10. Files written

Changed (21; `assets/27_changes_to_existing_files.diff`: 1,656 lines added, 300 removed, without
`openapi.json`): `packages/shared/src/api/{constants,contract-model,core-api,example-parts,examples,index,openapi,operation-parts,operation-table,patterns,schema-parts,state-slices}.ts`;
`packages/shared/scripts/gen-openapi.ts`; `packages/shared/openapi/openapi.json` (regenerated);
`packages/shared/test/{openapi,api-envelope,api-examples,api-openapi-scope,api-realtime,api-registry,api-state-slices,api-text-rule}.test.ts`.

New (12): `packages/shared/src/api/{sessions,evidence,devices,storage,network-time,security-audit,system,alerts,state-examples,sim-actions}.ts`;
`packages/shared/test/{api-domain-operations,api-state-examples}.test.ts`.

Outside the code: this document, `delegation_progress/coder_execution_step_49.md`, five files under
`implementation/assets/27_*`, and `.cache/rollback/W27.*` and `.cache/W27/` (git-ignored).

Not written: anything under `packages/shared/src/sim`, `src/client`, `src/live`, `src/realtime`;
the client tests; any i18n file; any `package.json`; anything in `apps/`; `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`. Unchanged among the contract paths:
`administration.ts`, `demo-controls.ts`, `health.ts`, `identity.ts`, `pairing.ts`,
`realtime-examples.ts`, `realtime-messages.ts`, `session-schema.ts`, `text.ts`,
`api-schemas.test.ts`, `schemas.test.ts`, `sim-api-validation.test.ts`.

**How the work reached the tree** (DR-7). It was written and tested on an isolated copy of the
package and copied into the tree in one step at 10:39:40, with one small follow-up at 10:50:52
(section 3.4), so that rows running the shared suite at the same time never saw a half-written
registry.

---

## 11. Findings, deviations and decisions for the controller (P22)

### Findings

**F-1 (blocks the gate). The typed client's input type cannot be evaluated for 47 or more
operations.** `packages/shared/src/client/core-client.ts:244-247` defines

```ts
CoreCallInput<Ops, Id> = ParamsOf<OperationOf<Ops, Id>> & BodyOf<OperationOf<Ops, Id>> & QueryOf<OperationOf<Ops, Id>>
```

When the compiler resolves the generic `call` signature, `Id` is still the union of all operation
IDs, each of the three parts is a union with one member per operation, and their intersection is
the cross product: n × n × n. TypeScript refuses a union above 100,000 members: 46³ = 97,336
passes, 47³ = 103,823 does not, and 75³ = 421,875. Measured: every pair of the three compiles, the
triple does not. With 37 operations (50,653) nobody saw it.

| Consequence | Where |
|---|---|
| TS2590 at the first literal-typed `client.call` of a program | `apps/mobile/src/runtime/dev-probes.ts:225`; `packages/shared/test/api-registry.test.ts:841` |
| After that error the calls are **not type-checked at all**: `client.call('noSuchOperation')` compiles | `packages/shared/test/client-types.test.ts:211, 213, 215, 217` and `api-registry.test.ts:857-865` report an unused `@ts-expect-error` |
| At run time nothing is wrong | Both loops call all 75 operations |

No change inside `packages/shared/src/api/` avoids it: the limit depends only on the number of
entries. The fix is type-only (the patch: 8 lines added, 3 removed): one distributive helper, so
that the intersection is taken per operation. A call with a literal ID has the same type as before.

**F-2 (blocks the gate). One loop of the typed client's test calls a 204 operation without its
path parameter.** `packages/shared/test/client-core.test.ts:481-488` calls every registry operation
that answers 204 with its request example and no `params`. Contract A's five 204 operations have no
path parameter; ten of this row's have one, by the specification's own paths (`cancelSession`,
`addSessionMarker`, `addSessionNote`, `takeSessionSnapshot`, `acknowledgeSessionSummary`,
`archiveEvidence`, `restartDevice`, `testDeviceSignal`, `identifyDevice`, `acknowledgeAlert`). The
client itself is right to refuse the call. The patch passes `examples.pathParams`, as the same
file's main loop does at line 113.

**F-3. "The six reads" are five reads and health** (section 4).

**F-4. `startSession` had no documented 422**, so a server that validates its optional body could
not answer with a documented status (section 4). Related, for W34: the three existing commands with
`{id}` document 404 and (now all three) 422, so a malformed ID may answer either; the simulator
answers 404.

**F-5. `validateCoreApiResponse` checks a documented status by its schema only, not by its code.**
Since the five reads document 403, a `403 NOT_PERMITTED` on an AUTHENTICATED read validates, as it
already did on every operation of contract A that documents 403. Which codes a status may carry is
in its description, not in data. For the conformance row W52: a code check per operation needs
either a data member or the row's own table.

**F-6. `EvidenceExportRequest` says "text beyond 120 characters is cut", and the schema now
refuses it.** The description belongs to the offline component, which is pinned. In Simulated mode
it is still true: the simulator does not parse with the schema and cuts. In the `all` scope the
operation's text says that the server refuses instead. Rewording the component is W83's (it
changes one pinned hash).

**F-7. Bounds the Live forms must respect.** A marker label of at most 80 code units, a
destination of at most 120, an export reason of at most 500, a search text of at most 100. The
Simulated dialogs accept longer text today, which the simulator cuts; in Live mode the typed client
refuses it before sending. An HTML `maxLength` counts code units, which fits. For W66, W69, W75.

**F-8. Two permissions cannot be shown as refused.** Every seeded role holds `EVIDENCE_VIEW` and
`DIAGNOSTICS_RUN`, and the matrix is read-only, so no operator can get `403 NOT_PERMITTED` on
operations 39, 40, 41, 49, 50 or 65. Their examples show the two refusals every operation shares.
For the matrix test W47: these six cells have no denied case.

**F-9. The `all` document is 882,723 bytes** (paths 331 kB, schemas 111 kB, the tag texts 13
kB). The examples of slices are most of it. The page builds it in the browser on demand; for W84.

**F-10. One scaffold test of the core server fails, and not because of the contract** (section
8.2): `src/plugins/db/__tests__/db.test.ts:226`, since the core row's `src/core/boot-checks.ts`
registers boot step B-2. Its owner is the row that writes `apps/core-server/src/core/**`.

**F-11. The `limit` coercion is lenient.** `z.coerce.number()` reads `' 20 '`, `'1e2'` and
`'0x10'` as numbers. Whatever it reads must be a whole number from 1 to 200, so nothing out of
range passes; a strict decimal form would cost the clean `integer` parameter in the document.

**F-12. In the `all` scope `servers[0]` is the Core server.** The web's `pointAtCoreOrigin`
replaces `servers[0].url` and swaps the back-ticked mock-core addresses; it is written for the
offline document. W84 needs its own for Live mode ([CS:AR-3]: the server shown is the page's
origin).

### Deviations from the plan

| ID | Deviation | Why |
|---|---|---|
| DR-1 | The row's status is `needs-review`: three verification commands do not exit 0 | F-1, F-2 |
| DR-2 | Two members were added to the registry model: `responses[status].services` and `coreServerDescription` | Rule 6 and rule 5 ask for statuses and texts in the `all` scope that the offline scope must not show; both are additive and optional |
| DR-3 | 422 is documented on operations with a query or a path parameter, not only with a body | SR-64; the server's envelope already answers it |
| DR-4 | `label()` carries the text rule too, not only `text()` | So that API-13 holds for every string of the 112 schemas; one more line than rule 4(b) names |
| DR-5 | `EvidenceExportRequest` of the existing operation 42 gained two refinements (destination at most 120 code units, reason at most 500) | Rule 4(a) and the controller's note on D62. The JSON Schema is unchanged |
| DR-6 | In the `all` scope the nine design-book operations carry the badge `LIVE` and the Core server's headers, and the component `XDemsSimulated` is not in that scope | The scope describes the Core server ([CS:AR-3]; API-10). `x-dems-mode` still marks the nine |
| DR-7 | The work was done on an isolated copy and copied into the tree in one step | Other rows were running the shared suite |
| DR-8 | `sim-actions.ts` was added: [SP:§7.17] as data | The engine host, the Live source and the conformance test need the same table; 42 lines of data |
| DR-9 | No second committed document for the offline scope | Section 5: no app reads the file |
| DR-10 | `implementation/99_implementation_report.md`, `masterplan/02_plan.md` and `status_tasks.md` were not written | The parallel-run contract of this delegation (P8) |

### Decisions needed

| ID | Decision | This row's choice |
|---|---|---|
| DN-0 | **Who applies `assets/27_proposed_client_changes.patch`** (F-1: a type-only change in `core-client.ts`, +8 −3; F-2: the 204 loop of `client-core.test.ts` passes the path parameter, +7 −2, a by-design test change under P24) | Not this row. The patch applies to the tree (`git apply --check -p0`) and is proven on a copy (section 8.3) |
| DN-1 | Health documents no 401 and no 403 of its own (F-3) | As stated |
| DN-2 | A read of one slice answers it under its slice name: `TimeStatus` is `{ time }`, `AlertList` is `{ alerts }`. `SecurityStatus` is `{ security, auditHead, auditTotal }` | One rule for every state read, so the Live source can map any of them into its replica by name; `audit` is not a member, because it would not be the slice |
| DN-3 | `listAuditRows.order` is `ASC` or `DESC`, `ASC` when omitted; `listEvents` has one order, ascending | The order of the chain and of the slices; the export files are built in that order |
| DN-4 | The cursor's form (section 3.5) | A pattern without an underscore |
| DN-5 | An export reason of at most 500 for all three exports, where the specification gives only the minimum; a search text of at most 100 | As stated |
| DN-6 | Names of the bodies the specification writes inline (section 3) | As listed |
| DN-7 | `listSessionHistory`, `listEvidence`: pages of `items`; `listAuditRows`: `rows`; `listEvents`: `events` | The specification's member names |
| DN-8 | The `all` scope shows `LIVE` on all 75 | [CS:AR-3]; the neutral `CORE SERVER` badge of AR-2 is the page's, from `x-dems-services` |
| DN-9 | Every answer of areas 4 to 11 is strict; bodies and queries are open | As contract B chose for the slices |
| DN-10 | Four new tags: Network, Security, System, Alerts | Areas 8 to 11; areas 4 to 7 extend existing tags |
| DN-11 | `x-dems-rbac` stays on the four simulated commands; the role holders of the 41 permission operations are not restated | They are data in PostgreSQL, read with `getRoleMatrix`; `x-dems-access` carries the permission. [SP:§7.19] row 3 is met for the permissions, not for the holders |
| DN-12 | For the any-of, the `details.permission` of the denial row is not defined by RB-4; the example uses the rule's marker `ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)` | An example only; W28 decides |

---

## 12. Open points for W83 and the other rows

| For | Point |
|---|---|
| The typed-client owner | DN-0 |
| W83 | KI-18: the six offline strings and the places outside the folder (section 6.1); F-6 |
| W83 | `DemoStatus.activeFaults` can refer to `FaultsSliceSchema`; the member-name proof can replace `Exact` in `api-schemas.test.ts` (both from contract B, untouched) |
| W83 | The `source` text of an existing operation still reads "Design book §21.2": correct, and it does not name the operation number of [SP:§7] |
| W84 | Build the Live page with `createOpenApiDocument({ scope: 'all' })`; F-9, F-12. The deny list of [CS:AR-3a] is the six operations whose description says "holds a secret" (a test pins the list) |
| W84 | In Simulated mode with "Show Core-server endpoints": the 65 are `listCoreApiOperations('all')` minus the offline ten; a status with `services` is Core-server-only |
| W26 (engine host), W44 (Live source) | `SIM_ACTION_OPERATIONS`, `simActionsOfOperation` |
| W34 to W40 (domain modules) | The schema stage answers 422 `INVALID_INPUT` for a reason that is too short; map it to `INVALID_REASON` where the table names that code (D50). F-4. A refusal of the engine carries `details.simCode` (the examples show the mapping of [SP:§7.2]) |
| W39 | `AuditChainStatus.lineage` is at most 20 and strict: a 21st entry, or `firstSeq`, is a contract violation. The cursor of a list must fit `LIST_CURSOR_PATTERN` |
| W35 | `EvidenceMediaRef`: the source and the suffix go together; the suffix is the four digits of `demoIdSuffix` |
| W47 | F-8 |
| W52 | F-5; the Core-server-only statuses; `listCoreApiResponseStatuses(operation, scope)` |
| W66, W69, W75 | F-7 |

---

## 13. Rollback (R-PRE)

Pre-image, saved at 09:47 before the first edit: `.cache/rollback/W27.pre.patch` (108,953 bytes:
`git diff acaff20` over the six contract paths, so it holds contracts A and B),
`W27.pre.untracked.tar` (20 files) and `W27.pre.hashes` (`git hash-object` of all 34 files).
Post-image: `W27.post.patch`, `W27.post.untracked.tar` (32 files).

```
git checkout acaff20 -- packages/shared/src/api packages/shared/openapi packages/shared/scripts/gen-openapi.ts \
  packages/shared/test/openapi.test.ts packages/shared/test/schemas.test.ts packages/shared/test/sim-api-validation.test.ts
git apply .cache/rollback/W27.pre.patch
rm packages/shared/src/api/{sessions,evidence,devices,storage,network-time,security-audit,system,alerts,state-examples,sim-actions}.ts
rm packages/shared/test/{api-domain-operations,api-state-examples}.test.ts
tar -xf .cache/rollback/W27.pre.untracked.tar
```

The patch was taken over exactly the six contract paths, so it needs no `--include` list. The
recipe was run in a scratch directory outside the repository (an archive of `acaff20`, then the
patch and the tar): 34 files, each with the hash recorded before the first edit.

After a rollback the registry has 37 operations again, the committed document is the offline
scope, and slice text carries no text rule. The simulator fix and the other rows' files are not
touched.

---

## 14. Not done here

Server code and client code; the two client files of F-1 and F-2; any change of the simulator; any
i18n text; the API Reference page; the six offline KI-18 strings.

*Written 2026-10-04 11:01 WIB.*

---

## 15. Follow-up: a condition for operation 23 (decision D113)

*Second holding of the contract-owner slot, 2026-10-04 18:41 to 19:18 WIB. Evidence tier 3 for the
mechanical parts; the judgments of 15.4 carry their reasons and their sources.*

**Status: needs-review. The change is NOT in the tree. It is delivered as a proven patch**
(`assets/27c_condition_op23.patch`), for the guard's owner to land together with the evaluation in
one step. Section 15.2 says why. No file outside `docs/` was written in the tree by this follow-up.

### 15.1 What was asked

Finding CPS1-3 of the security review (`gateway_check/05_cp_access_control_security.md:381-387`):
operation 23 `rotateDeviceCredential` has the marker `DEVICE`, and the guard lets a `DEVICE`
operation be called by the device (its credential) and by an operator's session that is bound to
the device (`decision.ts:104-109`). So the holder of a session token of a device, which ends when
idle and at its absolute limit, obtains a device credential that never expires, and its first use
locks the real device out. Ruling D113: operation 23 needs the device's own credential, said in the
registry, so that stage 6 decides it.

### 15.2 The check that was ordered first, and why the change is a patch

| Question | Answer | Source |
|---|---|---|
| Does the guard's boot check stop on a condition it does not evaluate? | **No.** The set of known conditions is built from the shared vocabulary itself, so a member added there is "known" at once and `ACCESS_RULE_INVALID` is not raised | `apps/core-server/src/plugins/permission-guard/access-rules.ts:198` (`new Set(Object.values(CoreApiAccessCondition))`), `:265-266` |
| What does stage 6 do with it today? | It ignores it: `decideConditions` is a `switch` with three cases and no default, so operation 23 would keep answering a session of the device with 200 | `decision.ts:135-152` |
| Do the server's types hold? | Yes: the typecheck of the server against the patched contract exits 0 | 15.6, row 8 |
| Do the server's tests hold? | **No.** Two tests of the `unit` project pin the list of conditioned rules and turn red, and one acceptance test compares the registry's conditions with the specification and turns red too | below |

Landing the contract half alone would therefore not stop the boot, and it would still do two
things this row may not do:

1. **Turn three tests red in files of other rows**, two of them in the `unit` project that every
   row runs, one in the acceptance file of a row that is running now:

| Test | What it pins | Proof |
|---|---|---|
| `apps/core-server/src/plugins/permission-guard/__tests__/access-rules.test.ts:92-102` | The full list of rules with a condition (seven entries) | Run against the patched contract: red at `:94` |
| `apps/core-server/src/modules/pairing/__tests__/routes.test.ts:128` | `conditions: []` for the three device operations of the pairing module (`DEVICE_ONLY`, `:94`) | Run against the patched contract: red at `:128` |
| `apps/core-server/test/acceptance/rbac-matrix.test.ts:861-881` (row W47, running) | Every registry entry has the conditions of its row in `masterplan/01_specs.md` section 7; the reader knows three texts (`rbac-matrix.support.ts:178-184`) | The same comparison repeated without a database (`.cache/W27c/probe/rbac-spec.probe.test.ts`): green on the unchanged contract, red for row 23 on the patched one |

2. **Commit a document that says the server refuses what the server still allows.** For a
   security property that is the wrong order: the text and the evaluation belong in one step.

The patch route is the one the brief gives for a landing that would break server tests: the guard's
owner applies the patch and its evaluation together.

How the proof was run without touching the tree: the server's `unit` project is read from the tree
and `@dems/shared` is resolved by an alias to a copy (`.cache/W27c/vitest.server.<copy>.config.ts`).

| Run | Contract | Result |
|---|---|---|
| 18:55, whole `unit` project | unchanged copy | 143 files, 3,710 passed |
| 18:55, whole `unit` project | patched copy | 143 files, **2 failed**, 3,708 passed: the two lines above and nothing else |
| 19:13, guard folder and four route tests | unchanged copy | 12 files, 225 passed |
| 19:13, the same | fresh copy of the tree with the delivered patch | 12 files, **2 failed**, 223 passed: the same two lines |

P11: the first run on the unchanged copy (18:54) had one failure in
`src/engine/__tests__/rehydrate.test.ts`, whose three files were saved at 18:54:17 by the engine
row; the second run was green. The two whole-project runs of 19:10 carry failures of the realtime
and biometric rows (`hub.principal-cap.test.ts`, `biometric/__tests__/static.test.ts`,
`tokens.test.ts`) **with the unchanged contract too**; they are in `assets/27c_gate.log`, part 2,
beside the focused pair.

### 15.3 The change (in the patch)

**One condition, `DEVICE_CREDENTIAL`**, in `packages/shared/src/api/contract-model.ts`, between
`DEVICE_SESSION` and `DEMO_FLAG`:

| Point | Content |
|---|---|
| Meaning | The request presented the device credential itself: the caller is the DEVICE principal. On the marker `DEVICE` it takes away the second half of that marker: the session of an operator who is signed in on the device does not hold it |
| Where it belongs | On an operation whose effect outlives the session that would call it |
| What a caller that fails it gets | **403 `DEVICE_NOT_PAIRED`**, message `This operation needs the device's own credential.`, `details.reason: DEVICE_CREDENTIAL_REQUIRED`. No audit row |
| Why no new error code | `DEVICE_NOT_PAIRED` is the code the guard already gives a caller of the wrong principal kind on a `DEVICE` operation (a web console session, `decision.ts:106-107`, `denial.ts:59-62`) and the code of the two other device conditions. The specification already divides one code by `details.reason` (`NOT_SIGNED_IN` with `CREDENTIAL_CONFLICT`, `01_specs.md:749`), and the server does the same under this very code (`PASSWORD_SESSION_REQUIRED`, `modules/identity/biometric/enrolment.ts:44-55`) |
| Why a reason at all | The device of this caller IS paired, so the bare code would mislead; the reason tells this refusal from "not paired" |
| The reason as a name | `DEVICE_CREDENTIAL_REQUIRED_REASON` (`'DEVICE_CREDENTIAL_REQUIRED'`), exported beside the condition, so the guard and the document take it from one place |

**Operation 23** (`packages/shared/src/api/pairing.ts`): `access: { ...DEVICE_ACCESS, conditions:
[DEVICE_CREDENTIAL] }`; the marker stays `DEVICE`, the audit rule is unchanged. Its description has
one new paragraph, its 403 text one new clause, its 403 examples one new first entry
(`ERROR_EXAMPLES.deviceCredentialRequired`, `example-parts.ts`). The module header's table row 23
names the condition.

**The committed document** (`openapi.json`, scope `all`), regenerated: 882,723 to 884,037 bytes,
four hunks, all inside operation 23 (the description, the 403 text, the example, and
`x-dems-access.conditions: ["DEVICE_CREDENTIAL"]`). Compared operation by operation: 74 of 75 are
equal to the tree's, and everything outside `paths` is equal. `security` of operation 23 stays
`[{ bearerAuth: [] }]`: the bearer is the device credential. **No change of `openapi.ts` or of the
generator was needed.** The offline scope has no operation 23; its section hashes against `acaff20`
are tested by `api-openapi-scope.test.ts` and pass unchanged.

### 15.4 Judgment on the other device operations (table F-2)

The question of the brief: does the operation have the same exposure, an effect that outlives the
session that called it? Facts were read in the server's code; none of it was changed.

| # | Operation | Marker | Effect when called with a session of the device | Same exposure? | Condition |
|--:|---|---|---|---|---|
| 23 | `rotateDeviceCredential` | DEVICE | A device credential that never expires; the real device is locked out at its first use | Yes (the finding) | **Yes, in the patch** |
| 8 | `signInWithBiometric` | DEVICE | A new session and a rotated token with a new 30 days. With operation 7 it is a chain: a session created by password enrols (`enrolment.ts:65`), then signs in with the token while it is still open, and the new session can do the same again. The handler takes the device from the session (`biometric/routes.ts:62`), ends the presented session as `ROTATED` and issues the next token with `now + 30 days` (`sign-in.ts:159, 196, 204`); the path is a tested one (`sign-in.db.test.ts:539`) | **Yes in kind, smaller in reach**: access as one operator on that device, renewable without the device credential and without the password. It does not lock the device out, it leaves rows (`BIOMETRIC_ENROLLMENT_CHANGED`, then `AUTH_SUCCESS` with `method: BIOMETRIC`), and `disableUser`, `revokeDevice`, `unpairDevice` and `setBiometricEnrollment {enabled: false}` end it | **Not in the patch. Ready as an optional add-on** (`assets/27c_condition_op8_addon.patch`); it needs a ruling, see 15.8 finding FU-2 |
| 7 | `setBiometricEnrollment` | AUTHENTICATED + `DEVICE_SESSION` | A token family of 30 days: this is what enrolment is for | Its effect outlives the session by design. The condition cannot stand here: the operation needs an OPERATOR, the condition needs the DEVICE (a test of the patch pins that it stands on the marker `DEVICE` only). The token is only as strong as the rule of operation 8 | No |
| 22 | `unpairDevice` | DEVICE | The device is UNPAIRED for good; its sessions and tokens end, the caller's own session among them | The effect outlives the session, and nothing is gained or kept: the harm is availability (an operator with `PAIRING_MANAGE` must pair the tablet again). The specification wants this caller: T9 names "the device (and the signed-in operator, if any)" (`01_specs.md:655`), the row names that operator (`pairing/routes.ts:225-230`), and the mobile app calls it with the session token while an operator is signed in (`apps/mobile/src/runtime/sim-adapters.ts:314, 399`) | No. Reported as FU-3 |
| 9 | `reportBiometricFailure` | DEVICE | One failure toward the device's lockout and one `AUTH_FAILED` row; it can never create a session | No: bounded by the lockout, and wrong passwords at `signIn` reach the same counter | No |
| 21 | `getDeviceRegistration` | DEVICE | A read | No | No |
| - | The promotion of the "next" credential (second phase of the rotation) | not an operation | It happens at the first request that presents the next credential, in the authentication stage; that caller holds the credential itself by definition | No own operation in the registry (75 entries; operation 23 is the only one that rotates) | - |
| 18 | `redeemPairingCode` | PUBLIC | Returns a device credential once, for the pairing code | Not callable "as a session": the code is the proof | No |

### 15.5 Tests (`packages/shared/test`, in the patch)

**Existing lines changed, by design (P24): one.**

| File:line (tree) | Before | After | Why |
|---|---|---|---|
| `api-registry.test.ts:466` | title `the conditions on top of a marker: the console rule, a device session, the demo flag` | `... a device session, the device credential itself, the demo flag` | The test now pins four conditions |

The three existing pins inside that test (`CONSOLE_IDENTITY` on `signIn`, `DEVICE_SESSION` on
`setBiometricEnrollment`, `DEMO_FLAG` on the five demo operations) are unchanged. **Added in the
same test** (patched file `:476-482`): `DEVICE_CREDENTIAL` on `['rotateDeviceCredential']`; eight
operations carry a condition, each exactly one. No count of `api-openapi-scope.test.ts` changes
(`[3, 1, 6, 65]` by credential stays: operation 23 took the bearer before).

**Tests added: 6**, one block in `api-registry.test.ts` (patched file `:519-593`): the vocabulary
has four members and the reason has its value; operation 23 keeps the marker and the audit rule and
carries the condition; the condition stands on the marker `DEVICE` only; the other four `DEVICE`
operations carry none; the description and the 403 text say what is refused and with what; the
example is the error envelope with the existing code and the reason, first of its status, and no
other operation's example carries the reason. **Assertions added to two existing tests** of
`api-openapi-scope.test.ts` (patched file `:301-311`, `:353-354`): `x-dems-access`, the texts and
the example of operation 23 in the `all` document; exactly one operation carries the condition;
nothing of it in the offline document.

Shared suite: 68 files and 1,807 tests before, **68 files and 1,813 tests** with the patch. The
files that are not this row's (`client-core.test.ts`, `live-testing-*.test.ts`,
`live-source-*.test.ts`) are green and unchanged; no loop of theirs failed.

**Can the tests fail?** 15 single changes on a copy of the patched copy, never in the tree
(`assets/27c_mutate.py`, `assets/27c_mutations.log`): 15 detected, 0 not detected. Among them: the
condition taken off operation 23; put on operation 22, on operation 8, on an AUTHENTICATED
operation; the vocabulary without it; its value or the reason renamed; the example with another
code, without the reason, missing, or not first; the two texts without the refusal; the committed
document left stale.

### 15.6 Verification

Full output: `assets/27c_gate.log` (five parts). "Patched copy" is a fresh copy of the tree's
`packages/shared` with the delivered patch applied by `git apply`; it is byte-equal to the copy the
change was written on.

| # | Command | On | Result |
|--:|---|---|---|
| 1 | `git apply --check docs/.../assets/27c_condition_op23.patch` | the tree | exit 0 (6 files, 156 insertions, 8 deletions) |
| 2 | `vitest run --maxWorkers=2` of `@dems/shared` | patched copy | exit 0: 68 files, 1,813 tests passed |
| 3 | `node --import tsx scripts/gen-openapi.ts --check` | patched copy | exit 0: up to date, 75 operations, 2 security schemes, version 0.2.0; offline 10 operations |
| 4 | `tsc --noEmit` of `@dems/shared` | patched copy | exit 0 |
| 5 | `oxlint` of `@dems/shared` (src, test, scripts) | patched copy | exit 0, no warning |
| 6 | `tsc --noEmit` of `@dems/core-web` with `@dems/shared` mapped to the patched copy | tree sources | exit 0 at 19:14. At 19:08 it failed in `apps/core-web/src/test/live-runtime-surface.test.tsx(95,96)`, a file of the web runtime row; the tree's own `npm run typecheck -w @dems/core-web` failed on the same line at the same minute and passed at 19:14 (P11, both runs recorded) |
| 7 | `tsc --noEmit` of `@dems/mobile`, mapped the same way | tree sources | exit 0 |
| 8 | `tsc --noEmit` of `@dems/core-server`, mapped the same way | tree sources | exit 0 |
| 9 | The server's `unit` project against the patched contract | tree sources | 2 failed by design in files of other rows (15.2). Not run "after landing": nothing was landed |
| 10 | `npm run test -w @dems/shared -- --maxWorkers=2` | the tree, unchanged | exit 0: 68 files, 1,807 tests (the baseline) |
| 11 | `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | the tree, unchanged | exit 0 |
| 12 | `npm run typecheck` and `npm run lint` of `@dems/shared`; `npm run typecheck` of `@dems/core-web`, `@dems/mobile`, `@dems/core-server` | the tree, unchanged | exit 0, five times (19:02) |

Note on row 8: two server test files import a source file of the shared package by a relative path
(`src/realtime/__tests__/first-contact.db.test.ts`, `test/acceptance/shared-state.support.ts`:
`packages/shared/src/realtime/live-socket-client`), so the probe read 64 shared files from the tree
beside the 96 of the copy. Every import by package name went to the copy; the guard and all its
readers of `@dems/shared/api` were checked against the patched contract.

### 15.7 Hand-over to the guard's owner: one step

```
git apply docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/27c_condition_op23.patch
```

It writes six files: `packages/shared/src/api/{contract-model,example-parts,pairing}.ts`,
`packages/shared/test/{api-registry,api-openapi-scope}.test.ts`,
`packages/shared/openapi/openapi.json`. If a contract file moved in between, `git apply --check`
says so; the document is then regenerated with `npm run openapi:gen -w @dems/shared`.
Five of the six files are not tracked by git yet (only `openapi.json` is), so the patch goes to the
working tree: plain `git apply`, not `git apply --index`.

What the same step needs on the server, with the lines read:

| Where | What |
|---|---|
| `permission-guard/decision.ts:135-152` | A fourth case in `decideConditions`: the condition holds only for `principal.kind === 'DEVICE'`; otherwise `DEVICE_NOT_PAIRED` with the condition as cause. `:80`: the cause union gains the condition. The header table (`:15-24`) gains the case |
| `permission-guard/denial.ts:59-62` | The answer of that cause: 403 `DEVICE_NOT_PAIRED`, message `This operation needs the device's own credential.`, `details: { reason: DEVICE_CREDENTIAL_REQUIRED_REASON }`. Today every cause but the console rule gets the text "available on a paired device only", which would be wrong for a caller on a paired device |
| `permission-guard/__tests__/access-rules.test.ts:92-102` | The list gains `['rotateDeviceCredential', DEVICE_CREDENTIAL]` after `setBiometricEnrollment` (registry order) |
| `permission-guard/__tests__/decision.test.ts:56-72` | The model `expected()` lets a session of the device through on every `DEVICE` operation; it must read the condition |
| `modules/pairing/__tests__/routes.test.ts:128` | `conditions: []` no longer holds for `rotateDeviceCredential` |
| `modules/rbac/__tests__/matrix.db.test.ts:158` | The same model for an operator on a device |
| `modules/pairing/__tests__/devices.db.test.ts:536-537` | "Through the operator's session of the device this time": that rotation is now the refusal |
| `test/acceptance/rbac-matrix.support.ts:178-184, 406-417` and `rbac-matrix.test.ts:861-881` | The reader of the specification knows three condition texts and the expectation three conditions; both need the fourth, and the specification its text |
| `test/acceptance/contract.test.ts:864-890` | The 403 per operation: operation 23 can now also be shown with a session of the tablet |
| `masterplan/01_specs.md:404` (marker `DEVICE`), `:653` and `:659` (T7), `:755` (the code table), `:801` (order of stage 6), `:859` (row 23) | The specification's text of the rule. Not this row's file |

The order of stage 6 needs no new rule: the condition answers `DEVICE_NOT_PAIRED` like the two
other device conditions, and no operation carries two conditions (pinned by the patch's test).

### 15.8 Findings, deviations, decisions (for the controller)

| ID | Kind | Content |
|---|---|---|
| FU-1 | Deviation, by the brief's own rule | Not landed: the boot would not stop, and two `unit` tests and one acceptance test of other rows would turn red, and the document would promise a refusal the server does not give yet (15.2). Delivered as a proven patch; status `needs-review` |
| FU-2 | **Decision needed** | Operation 8 `signInWithBiometric` has the same kind of exposure (15.4): a session of the device, created by password, can enrol and then renew itself with the token, without the device credential. The registry's text already says the token is "sent with the device credential"; the guard does not require it. The add-on patch puts the condition on operation 8 too (the same 403 text and example, one more test: 68 files, 1,814 tests; `gen-openapi --check`, typecheck and lint exit 0; applies on top of the first patch, `git apply --check` exit 0 there and, as expected, not on the tree alone). It is NOT part of the mandated patch because it changes behaviour that others own: (a) the handler's branch "a presented session is ended as `ROTATED`" (ID-6) can no longer be reached for a biometric sign-in, and `sign-in.db.test.ts:539-558` pins it; (b) `identity/biometric/__tests__/routes.test.ts:119` pins `conditions: []` (run against the add-on: red at `:119`, beside the two lines of 15.2); (c) the mobile app sends `session ?? deviceCredential` (`sim-adapters.ts:314`): at the login screen no session is in memory, so it sends the device credential, but that is the mobile row's to confirm. Alternative: leave it and record it as a residual with its audit trail |
| FU-3 | Info, residual | Operation 22 `unpairDevice`: a session token of the device can retire the device for good. By specification (T9) and used by the mobile app; the harm is availability only. No condition. If the controller wants unpairing to need more than any signed-in operator, that is a product rule, not this condition |
| FU-4 | Decision recorded here | The refusal is not audited, like every other `DEVICE_NOT_PAIRED`. A session token that tries to rotate the device credential is exactly the attempt of the finding; if it should leave a row, that is a rule of the guard (a third audited refusal with a place in the denial budget), and the registry's `audit.denial` of operation 23 is `ACCESS_DENIED` already |
| FU-5 | Info, for the client rows | The typed client has one credential provider for all calls (`core-client.ts:99`, a function without arguments). A client that calls operation 23 while an operator is signed in must use a client instance whose provider returns the device credential. No client calls operation 23 today (`01_specs.md:659`) |
| FU-6 | Info | The 403 text of operation 23 now names the refusal of a session of the device. The refusal of a web console session on a `DEVICE` operation (`DEVICE_NOT_PAIRED`, no reason; it comes from the marker, before any condition) is still not named in the 403 text of the `DEVICE` operations: the collected gaps `CONTRACT-GAP-W52-1` (operations 8 and 9) and W32-3 (two more operations) hold it, and if operation 23 is not among them it joins that list. Left for the close-out row as ordered |
| FU-7 | Not done, as ordered | The collected contract gaps (`CONTRACT-GAP-3` to `-6`, `-W32-...` to `-W52-1`) were not started. Item 4 of the brief named no further item |

### 15.9 Files of this follow-up

| File | Kind |
|---|---|
| `implementation/assets/27c_condition_op23.patch` | The change: 6 files, 156 insertions, 8 deletions |
| `implementation/assets/27c_condition_op8_addon.patch` | Optional, on top of the first: 6 files, 61 insertions, 24 deletions (FU-2) |
| `implementation/assets/27c_gate.log` | The runs of 15.2 and 15.6 |
| `implementation/assets/27c_mutate.py`, `27c_mutations.log` | The 15 mutation checks |
| `implementation/27_contract_c.md` | This section |
| `delegation_progress/coder_execution_step_49.md` | Progress |

Scratch, outside the task folder and not part of the deliverable: `.cache/W27c/` (the copies
`base`, `work`, `work8`, `verify1`, `verify8`, `mut`, the probe configurations and logs).

Rollback: nothing to roll back in the tree. After the guard's owner has landed the patch,
`git apply -R` of the same file takes the contract half back.

*Written 2026-10-04 19:18 WIB.*
