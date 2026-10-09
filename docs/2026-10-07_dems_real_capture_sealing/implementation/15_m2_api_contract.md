---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 48 (phase C, milestone M2, class B; M2-W7; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: identification/02_structured.md rev 2.1 row 48 (:211) + standing invariants (:199); masterplan/03_api_contract.md (C3) §1-§5, §7, §9; masterplan/09_security_design_review.md SEC35-01/16/17/18/19/21/22; decisions/decisions.md D31-D34
narrative_tier: 3
status: completed - `packages/shared` restored to green (typecheck exit 0, lint exit 0); shared suite green except the two OpenAPI-vs-registry drift files owned by row 50 (see §6)
closes: SH-12, SH-13, SH-14, SH-15, SH-18, SH-19, SH-20, SH-21, CS-12, CS-14, CS-25, B4 (E-30), SEC35-01, SEC35-16, SEC35-17, SEC35-18 (deferred condition), SEC35-19, SEC35-21, SEC35-22; C3 §1-§5, §7, §9
depends_on: row 46 (DONE - implementation/11_m2_migrations.md), row 47 (DONE - implementation/14_m2_shared_contract.md)
---

# Row 48 / M2-W7: Core API registry, audit, errors and constants in `packages/shared`

## 0. Context — this row RECONCILED an interrupted attempt

A prior attempt at this exact row died on a context-compaction empty-summary failure
(D33/D34) and left `packages/shared/src/api/*` uncompilable. A later pass had already
completed most of the SOURCE (the registry, `capture.ts`, the vocabulary/contract-model
additions, the i18n labels, the server `audit-details.ts` key lists). This run's job was
to (a) verify the source against C3 rather than trust compilation, (b) restore the tree to
green, and (c) reconcile every consumer/pin the half-finished state left behind.

**Anti-hang:** no `timeout` binary exists on this macOS host, so a POSIX shim
(`python3 subprocess.run(timeout=…)`) was installed on PATH; every command ran under
`timeout … </dev/null`, CI/`--run` mode, single/double worker, never watch, never stdin.

## 1. Verification results (raw command output quoted)

| Check | Command | Result |
|---|---|---|
| **M2-API-1** registry drift-free at 89 ops | live count over `CORE_API_OPERATIONS` | **89 total / 34 GET / 55 POST**; offline scope **23**; duplicate ids **[]** |
| **M2-API-3** SESSION_HOLDER condition | `Object.values(CoreApiAccessCondition)` | **5 members**, `SESSION_HOLDER` last; enforced on op 81 only (`withCondition('SESSION_HOLDER') === ['switchAudioSource']`) |
| **M2-AUD-1** nine new types 53 → 62 | `Object.values(AuditType).length` | **62** (was 53); `AUDIT_TYPE_CATEGORY` also 62 (nine new entries, all in EXISTING categories) |
| **M2-AUD-2** exact detail-key lists, 0 secret keys | grep of `SERVER_AUDIT_DETAIL_RULES` | all **9/9** new types present exactly once; **no** secret-named detail key (§4) |
| **M2-CRD-1** credential write-only, never returned | op 89 schema + slice grep | request `{username,secret}`; response = `CaptureConfigSlice`; **no** credential member in any capture slice/device schema (§4) |
| error codes 31 → 40 | `API_ERROR_CODES.length` | **40** (16 baseline + 15 Core-server + 9 capture-phase) |
| **shared typecheck** | `timeout 300 npx tsc --noEmit -p packages/shared </dev/null` | **exit 0** |
| **shared lint** | `npm run lint -w @dems/shared </dev/null` | **exit 0** |
| **shared suite** | `timeout 1200 env CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run </dev/null` | **Tests 1849 passed / 18 failed; Test Files 70 passed / 2 failed** — the 2 failures are ONLY `api-openapi-scope.test.ts` (12) + `openapi.test.ts` (6), both OpenAPI-vs-registry drift owned by row 50 (§6) |

## 2. What the contract required and where it landed

### 2.1 Operations 76-89 (14 new) + 24 modified — `src/api/{devices,sessions,evidence}.ts`, merged into `core-api.ts`
Appended in number order so table order == contract numbering (`…CAPTURE_CONFIG_OPERATIONS`
76-80, `…AUDIO_SOURCE_OPERATIONS` 81-83, `…TRANSCRIPT_MEDIA_OPERATIONS` 84-88,
`CAPTURE_CREDENTIAL_OPERATION` 89). Method/path/tag/mode/access/audit verified against C3 §2.2
by the reconciled `api-registry.test.ts` (42/42 green). Thirteen are `simulated` (offline per
OD-17); op 88 `createEvidenceMediaSession` is `live` only. Ops 90-92 (R-8) are NOT present
(proposed only until Q-STT-CFG; CF-11).

### 2.2 Error codes 31 → 40 — `core-api.ts` `ApiErrorCode`
Nine added in C3 §4 order: `CAPTURE_CONFIG_LOCKED, AUDIO_SOURCE_CONFLICT, CAMERA_NOT_LOST,
TRANSCRIPT_NOT_READY, TRANSCRIPT_REVISION_CONFLICT, EXPORT_IN_PROGRESS, MEDIA_NOT_AVAILABLE,
RESET_BLOCKED_REAL_EVIDENCE, TRANSCRIPT_AUDIO_UNAVAILABLE`. All SCREAMING_SNAKE (accepted by the
audit writer's `code()` rule). A failed export JOB is the job's `status: FAILED` in op 87's 200,
not an HTTP code.

### 2.3 Audit types 53 → 62 with exact key lists — `sim/vocabulary.ts` + `apps/core-server/src/core/audit-details.ts`
Nine appended to `AuditType` + `AUDIT_TYPE_CATEGORY` (existing categories only):
`CAPTURE_CONFIG_CHANGED`→DEVICE, `AUDIO_SOURCE_SWITCHED`→SESSION, `CAMERA_POE_CYCLED`→DEVICE,
`TRANSCRIPT_REVISED`→EVIDENCE, `MIC_SILENT`→DEVICE, `EVIDENCE_MEDIA_SERVED`→EVIDENCE,
`EVIDENCE_EXPORT_FAILED`→EVIDENCE, `CAPTURE_CREDENTIAL_SET`→SECURITY,
`CAPTURE_CREDENTIAL_REVEALED`→SECURITY. Each gets an EXACT allow-list in
`SERVER_AUDIT_DETAIL_RULES` matching C3 §5.2 (see §4 for the 0-secret proof). `DEVICE_COMMAND`
gains the value `POE_CYCLE` (op 48) plus a second `CAMERA_POE_CYCLED` row.

### 2.4 Credential write-only path (op 89) — SEC35-01 / RK-12 / M2-CRD-1
`setCaptureDeviceCredential`: body `CaptureCredentialWriteRequest {username, secret}` (both
write-only), response `CaptureConfigSlice` (never echoes either field), audit
`CAPTURE_CREDENTIAL_SET` carries `deviceId` (+ optional operationId/permission) only. No capture
slice or `CaptureDevice` schema holds a credential member; `host` is host/address only, never a
`user:password@` URL (C-N8).

### 2.5 SESSION_HOLDER condition — SEC35-18 (deferred to M2 per D14(c))
Added to `CoreApiAccessCondition` (contract-model.ts) as the fifth member; op 81 access =
`PERMISSION SESSION_START` + `SESSION_HOLDER`. The Core-server enforcement is deferred (SEC35-18);
this row materialises the vocabulary + registry marker only.

### 2.6 Constants `@dems/shared/api/capture.ts` — CS-25
New module, re-exported from `@dems/shared/api`. Includes the SP-4 pair
`CAPTURE_GOP_FRAMES = 50` / `CAPTURE_FRAGMENT_TARGET_MS = 2_000` (+ `CAPTURE_MIN_FRAG_DURATION_MS
= 2_000`) and the Q-GOP observed threshold `CAPTURE_OBSERVED_GOP_MAX_MS = 2_000` (GOP ≤ 2 s;
under the default the worker raises the EXISTING capture-warning channel — **no new error or
audit code**). Also `MIC_SILENCE_DBFS/-DURATION_MS/DISCONNECT_DEBOUNCE_MS`,
`CAPTURE_AUDIO_SAMPLE_RATE_HZ/CHANNELS`, `SEALING_PROGRESS_INTERVAL_MS`, `CAPTURE_METER_RATE_HZ`,
`EVIDENCE_MEDIA_SESSION_TTL_MS`, `EVIDENCE_MEDIA_TOKEN_PREFIX='mts_'`,
`MEDIA_SESSION_SIGNING_KEY_ID`.

## 3. Reconciliation of the interrupted attempt (all in-scope: `test/**`, `src/api/**`, `src/live/source/bindings.ts`, `src/demo-data/**`)

The source compiled but the SUITE was red because dozens of pins still described the pre-row-48
world, and a few genuine defects were left. Fixed:

- **`api-registry.test.ts`** fully reconciled to the 89-op reality (added an `M2_OPERATIONS` data
  array; counts 75→89, GET 27→34, POST 48→55, offline 10→23, AUDIT_TYPES 53→62, conditions
  four→five, conditioned 9→10, tag sums, ENFORCED_AT wiring CAPTURE_CONFIG→[78,79,80,89] /
  TRANSCRIPT_REVISE→[85] / SESSION_START+81 / EVIDENCE_VIEW+[84,86,88] / EVIDENCE_EXPORT+87,
  schema block 51+39+11+33+18=152, type pin `Table['length']=89`, query list 4→6). KI-18 relaxed
  so only LIVE ops must say "Core server only" (the 13 simulated capture ops legitimately do not).
  Media-path guard allows op 88 `/media-sessions` (session ISSUER; byte route stays external).
- **Real defects fixed:** restartDevice missing 400 example + missing request example; the four
  capture-config WRITE ops missing their 200 (`CaptureConfigSlice`) example; resetDemo missing the
  409 `RESET_BLOCKED_REAL_EVIDENCE` example; op 88 missing `CORE_SERVER_NOTE` (live KI-18);
  `TranscriptSegment.speaker` used a raw `z.string()` (accepted U+0000) → wrapped in `apiText()`
  (API-13 violation, caught by `api-text-rule.test.ts`).
- **Consumer pins for modified ops:** op 42 export `EXPORTED`→`QUEUED` (client-core,
  live-testing-fetch, demo-data example + its type + the generator emission); op 47 DeviceInventory
  build adds `captureConfig`; op 48 PoE-cycle codes + no-longer-body-less; POE_CYCLE wired through
  the device-command tables/tests (sim-actions.ts + bindings.ts already carried it).
- **REVERTED a premature out-of-contract edit:** the interrupted attempt had re-keyed
  `MicClipResetRequest` from `{channel: AUDIO-0x}` to `{inputId: MIC-0x}` (its own comment deferred
  the sim re-key to "M2-W9", which has NOT landed — the off-limits sim action `resetClip(channel)`
  is unchanged). Op 52 is NOT in C3 §3's modified list, so this half-applied change created a
  schema↔sim↔binding↔test inconsistency that cannot be closed without editing `src/sim/**`. It was
  reverted to HEAD (`channel`) across schema, description, example and the two domain-operations
  type/value pins, restoring coherence with zero sim edits.

## 4. Secret-key proofs (M2-AUD-2 / M2-CRD-1)

- `grep -nE "^\s+(secret|password|token|username|cookie|credential|ciphertext|nonce|url|key|keyId|apiKey|pairingCode)\s*:" apps/core-server/src/core/audit-details.ts` → **NONE**.
- The union of keys defined under the nine new types (40 names) is: active, authorId, baseRevision,
  bytesServed, changeCount, confirmed, deviceId, durationMs, expiresAt, field, fileId, from,
  fromInput, fromMs, gapFromMs, gapToMs, inputId, jobId, kind, machineTranscriptHash, number,
  operationId, permission, poePort, rangeEnd, rangeStart, reason, revisionId, scope, sendingDeviceId,
  signed, sinceMs, streamWasLost, thresholdDbfs, to, toInput, toMs, trackId. None is a secret VALUE:
  `signed` is a boolean flag, `machineTranscriptHash` a public integrity hash, `reason` a
  SCREAMING code or typed-text bound (never the transcript body), `deviceId`/`sendingDeviceId`
  identifiers. `CAPTURE_CREDENTIAL_SET`/`_REVEALED` carry `deviceId` (+operationId/permission/reason
  code) only.
- Credential write-only: `grep -nE "\b(secret|username|password|credential)\b" src/api/state-slices.ts`
  returns only COMMENTS asserting absence; the `CaptureDevice` schema has no credential member and
  `host` is "never a credential URL". Op 89 response is `CaptureConfigSlice`.

## 5. Deferrals honoured (not silently done)

- **`SIM_SNAPSHOT_VERSION` stays 1.** Not bumped to 2. Row 51 routed it as an ATOMIC bump across
  the wire-literal `MetaSlice z.literal(1)` + mapping/boot-check, owned jointly with rows 49/52
  (D14). Leaving it at 1 keeps v1 snapshot resume working. Recorded here as a deliberate deferral.
- **`openapi.json` NOT regenerated; lockfile untouched.** Row 50 is the sole lockfile writer and
  owns the version bumps (`all` 0.2.1→0.3.0, `offline` 0.1.0→0.2.0) + the pinned-count sweep.
- **`src/sim/**` untouched except `vocabulary.ts`** (which was already complete); `apps/core-web`,
  `apps/mobile`, `apps/mock-core`, `release`, controller trackers untouched.

## 6. Remaining-red tests — every one attributed (none is a row-48 defect)

All 18 remaining failures are inside the two files the brief designates as expected-red.

**(A) OpenAPI-vs-registry drift → row 50 regenerates `openapi.json` + bumps versions + re-pins counts (15 tests):**
`api-openapi-scope.test.ts` #1-#12 and `openapi.test.ts` #13-#15 compare the built/committed
document against the STALE committed `openapi.json` (still 75 ops / 132 components / version
0.2.1 / "75 operations" description). Representative raw lines:
- `AC-B-11: is the committed openapi.json, byte for byte, with 75 operations` → doc-vs-file drift.
- `the committed openapi/openapi.json matches the builder byte for byte (no drift)` → the drift check itself.
- `version 0.2.1 … to contain '75 operations'` → the version constant + description string (row 50).
- `has 75 operations on 74 paths: 27 GET and 48 POST` → 89 vs 75 (row 50 re-pin).
- `holds one component per registry schema … 132 but got 152` → component count (row 50 regen).

**(B) Simulator parity for the new/modified ops → row 51 re-run (surfacing in `openapi.test.ts`) (3 tests):**
These do NOT read `openapi.json`; they exercise `sim/api.ts` directly, so row 50 regeneration will
NOT turn them green — they need the simulator to answer the capture ops and emit the modified op-44
device-health shape, which lives in `src/sim/**` (off-limits to this row; D33 resume plan step 2
re-runs row 51 once shared builds):
- `the simulator's route table lists exactly the 9 simulated operations` → `SIM_API_ROUTES` = 9 vs
  registry-simulated = 22 (the 13 capture ops have no sim route yet).
- `every documented simulated status is produced by the simulator` and `device-health/storage
  examples equal the idle simulator` → the simulator's `getDeviceHealth` still emits the pre-op-44
  shape (no `streamState`, AUDIO-keyed audio), so it fails validation against the modified schema.

**Conclusion:** none of the 18 is a defect in row 48's registry / audit / error / constants /
credential deliverable. (A) is closed by row 50's `openapi:gen` + version/pin sweep; (B) is closed
by row 51's post-row-48 sim-parity re-run. Both are outside this row's file set by the brief's own
constraints.

## 7. Files changed in THIS session (source was largely pre-staged by the interrupted attempt)

| File | Change |
|---|---|
| `packages/shared/test/api-registry.test.ts` | reconcile to 89-op reality; add M2_OPERATIONS; relax KI-18/media guard |
| `packages/shared/test/api-envelope.test.ts` | error codes 31→40 |
| `packages/shared/test/api-closeout.test.ts` | restartDevice body-less removal; device-command 4-cmd/3-op table |
| `packages/shared/test/api-domain-operations.test.ts` | reached 34→48; DeviceInventory captureConfig; REVERT MicClipReset inputId→channel (schema/type/value pins) |
| `packages/shared/test/api-examples.test.ts` | NEW_OPERATIONS 65→79 |
| `packages/shared/test/api-state-examples.test.ts` | simCode MAPPING +5 appearing codes |
| `packages/shared/test/api-state-slices.test.ts` | offline doc legitimately holds the two capture slices |
| `packages/shared/test/api-text-rule.test.ts` | bodies 25→31, queries 4→6, added schemas 114→134 |
| `packages/shared/test/client-core.test.ts` | op-42 export QUEUED |
| `packages/shared/test/live-testing-fetch.test.ts` | op-42 fake answer QUEUED |
| `packages/shared/test/live-source-bindings.test.ts` | deviceCommand paths += POE_CYCLE→/restart |
| `packages/shared/test/i18n-vocabulary-sync.test.ts` | AuditType 53→62; spot-check repointed to task-3 nine |
| `packages/shared/src/api/devices.ts` | restartDevice request+400 examples; 4 write-op 200 examples; REVERT MicClipResetRequest to `channel` |
| `packages/shared/src/api/evidence.ts` | op 88 CORE_SERVER_NOTE; TranscriptSegment.speaker apiText() (API-13) |
| `packages/shared/src/api/demo-controls.ts` | resetDemo 409 RESET_BLOCKED_REAL_EVIDENCE example |
| `packages/shared/src/demo-data/types.ts` + `packages.generated.ts` + `scripts/gen-demo-evidence.ts` | op-42 export status EXPORTED→QUEUED (consistent triple) |

## 8. Issues & decisions log

- **D-48-1 (binding):** the `MicClipResetRequest` inputId re-key was reverted as premature/out-of-
  contract (op 52 not in C3 §3; sim action unchanged). If a later row wants resetMicClip keyed by
  mic INPUT, it MUST change schema + `sim/actions.resetClip` + `bindings.resetClip` + ARGS + tests
  atomically (the W01b pattern). Flagged for the M2 gate.
- **D-48-2 (attribution):** `openapi.test.ts` #16/#17/#18 are simulator-parity gaps (row 51), NOT
  openapi.json drift — recorded so the M2 gate does not assume row 50 alone greens `openapi.test.ts`.
- **D-48-3:** `SIM_SNAPSHOT_VERSION` deliberately left at 1 (row 51 atomic bump; D14).
- **D-48-4:** `openapi.json` intentionally left stale; the two drift files stay red pending row 50.

## 9. Next steps
- Row 50: regenerate `openapi.json`, bump versions, re-pin 89/34/55/offline-23/30-slices → turns group (A) green.
- Row 51 re-run (post-row-48): add capture-op sim routes + op-44 device-health shape → turns group (B) green.
- Rows 49/52: core-server consumers of this registry (out of this row's compile gate).

---
*Generated: 2026-10-08 (row 48 completion run)*
