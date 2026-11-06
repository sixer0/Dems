---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 51a (controller-added follow-up to row 51; phase C, milestone M2, class B; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: identification/02_structured.md rev 2.1 rows 51/17 + OD-17 (D4); masterplan/03_api_contract.md (C3) §2.2/§2.3/§3 ops 44/45/46/42/76-89, §6, §8; implementation/15_m2_api_contract.md (row 48 registry); implementation/16_m2_openapi_pins.md (row 50 residual list); implementation/17_m2_simulated_parity.md (row 51)
narrative_tier: 3
status: in-scope work complete - #16 and #18 green, shared suite down to ONE red (#17) whose two blockers are both outside `packages/shared/src/sim/**`
closes: the Simulated half of OD-17 (simulator emulates v2), SH-15 consumer side of ops 44/45/46, sim capture routes 76-87/89
depends_on: row 50 (DONE), row 48 (DONE), row 51 (DONE)
---

# Row 51a / M2-W9b: Simulated v2 parity for the capture operations

## 0. Scope and boundary

Edits are confined to `packages/shared/src/sim/**` plus one sim-owned test fixture
(`packages/shared/test/sim-api.test.ts`, the simulator's own REST-handler suite - the fixture the
brief allows). Nothing else was written this session:

| File | Change | Why it is in scope |
|---|---|---|
| `src/sim/api.ts` | modify | The simulated REST handlers and `SIM_API_ROUTES` (SH-18 family, sim-owned) |
| `src/sim/types.ts` | modify | One optional member on the sim `EvidenceItem` plus its record types |
| `test/sim-api.test.ts` | modify | Sim-owned fixture: three stale v1 pins re-pinned to v2, plus new coverage for the 13 routes |

Untouched (verified by the file list above and by `git status` attribution): `packages/shared/src/api/**`
(row 48), `openapi.json` and the OpenAPI builder (row 50), the lockfile, `apps/**`,
`apps/mock-core`/`release`, and every controller tracker (`status_tasks.md`, `masterplan/02_plan.md`).
No commit, no push, no remote, no sudo, no database contact. `SIM_SNAPSHOT_VERSION` was NOT bumped
(v1 snapshot resume preserved; the atomic bump stays routed to the controller per row 51).

**Anti-hang:** this macOS host has no `timeout` binary, so the same POSIX shim row 50 used
(`python3 subprocess.run(timeout=...)`) was installed on `PATH`; every command ran under
`timeout ... </dev/null`, with `CI=true` and `--run`, never watch, never stdin.

## 1. The target route set (not a forced number)

The brief warned against padding the table to a number. The correct set was derived from three
sources that agree:

- **Registry** (`CORE_API_OPERATIONS.filter(mode === 'simulated')`, row 48): **22** operations.
  Probed output: 9 book §21.2 operations + 13 schema-v2 operations (ops 76-87 and 89).
- **Test assertion** (`test/openapi.test.ts:397-403`): `SIM_API_ROUTES` must equal that registry set,
  element-for-element as `METHOD path operationId`.
- **OD-17 / C3 §2**: the simulator emulates v2 (single audio, mic switch, v2 sealing steps, transcript
  stub). Op 88 (`createEvidenceMediaSession`) is the one capture operation NOT in the set - C3 §2.4
  keeps it LIVE-only because Simulated mode plays the bundled demo media instead. It is deliberately
  absent from `SIM_API_ROUTES`, which is exactly why the target is 22 and not 23.

`SIM_API_ROUTES` therefore went 9 -> 22 with thirteen real handlers behind it (no entry without a handler).

## 2. Handler semantics (all built from existing sim state, never invented data)

| Op | Route | Answer and refusals implemented in the simulator |
|---|---|---|
| 76 | `GET /capture/config` | The `captureConfig` slice in wire form (API-6) with `locked` recomputed from the open session (OD-10). 401 signed out |
| 77 | `GET /capture/devices` | The `captureDevices` slice (five built-in devices). No credential member exists (RK-12). 401 |
| 78 | `POST /capture/config` | RBAC `CAPTURE_CONFIG` first (INVESTIGATOR 403), then the idle lock (`409 CAPTURE_CONFIG_LOCKED`, **no audit row**, SEC35-19), body validated against `CaptureConfigUpdateRequest` (strict members, 1..2 lines, `HARDWARE_DEVICE_ID_PATTERN`, API-13 text) -> 400 / 422; applies the partial update, copies the device's telemetry (`online`/`streamState`) onto the slot, writes one `CAPTURE_CONFIG_CHANGED` row per changed line with the C3 §5.2 keys (`operationId, scope, field, trackId/inputId, deviceId, from, to`) |
| 79 | `POST /capture/cameras/{id}/source` | Same guards; unknown or non-camera `{id}` -> 404; audit `scope: CAMERA, field: SOURCE` |
| 80 | `POST /capture/mics/{id}/primary` | Same guards; swaps PRIMARY/STANDBY in the selector **and mirrors the pair onto `state.mics[].micRole`** so ops 44/45 follow the selector; audit `scope: MIC, field: ROLE` |
| 89 | `POST /capture/devices/{id}/credential` | Same guards; requires both write-only members; the answer is the plain selector snapshot and **never echoes** username/secret; the `CAPTURE_CREDENTIAL_SET` row carries `deviceId` (+ operationId/permission) only - proven by assertion that neither value appears in the answer or in any audit row (M2-CRD-1) |
| 81 | `POST /session/{id}/audio-source` | `sessionAccess` (401/403 SESSION_START) + the `SESSION_HOLDER` condition (the creator or any SUPERVISOR, SEC35-18), 404 not the open session, 409 unless RECORDING, 422 bad body; runs row 51's `switchAudioSourceTransition` (which writes the `AUDIO_SOURCE_SWITCHED` row and the timeline item) and answers `AudioSourceState` |
| 82 | `GET /session/{id}/audio-source` | Page newest-first derived from the session's audio-source state: seq 0 `START` interval (closed when a switch happened) and seq 1 `MANUAL` open interval; `switchedBy` read back from the `AUDIO_SOURCE_SWITCHED` audit row, `fromMs`/`toMs` are media pts from `startedAt` (E-13/S2 §6). `nextCursor: null` |
| 83 | `GET /session/{id}/sealing` | `409 INVALID_STATE` while the finalization slice has not opened (STOPPING); otherwise the v2 steps with whole-percent forward-only `progressPct`, `etaMs` from the remaining steps x `SEALING_ETA_STEP_MS`, and `resumed` derived from a step attempt beyond `SEALING_FIRST_ATTEMPT` (dbc-3 §B.4) |
| 84 | `GET /evidence/{id}/transcript` | 404 unknown item; `409 TRANSCRIPT_NOT_READY` for an item without a sealed transcript hash (every pre-M2 dataset item); the canonical `dems.transcript/1` stub with `language: id`, `speakerState: UNAVAILABLE`, `machineTranscriptHash` = the sealed hash and **`segments: []`** - D-EV-1 forbids fabricating transcript text, so the simulator binds the hashes and lets corrections carry the text |
| 85 | `POST /evidence/{id}/transcript/revisions` | RBAC `TRANSCRIPT_REVISE` (TECHNICIAN 403), 404, 409 not-ready, 422 body, `409 TRANSCRIPT_REVISION_CONFLICT` when `baseRevision` is not the current head (SEC35-21); appends `TRV-NNNNNN` with a `SIMULATED-SHA256` signature over the canonical revision JSON (OD-04 software key), stores it on the item, writes `TRANSCRIPT_REVISED` with the §5.2 keys and no segment text |
| 86 | `GET /evidence/{id}/transcript/revisions` | Page newest-first, `nextCursor: null`; the sealed hash is byte-unchanged by a revision (asserted) |
| 87 | `GET /evidence/exports/{id}` | RBAC `EVIDENCE_EXPORT` (INVESTIGATOR 403), 422 malformed job id, 404 unknown job; the job is read back from the `EVIDENCE_EXPORTED` row op 42 wrote (`EXPJ-nnnnnn` <-> `EXP-nnnnnn`) and reports `COMPLETE`/100% because the simulated export finishes inside the request that queued it |

## 3. op 44 / 45 / 46 / 42 shape reconciliation (the "op-44 device-health" half)

The registry schemas row 48 shipped are v2; the simulator still emitted v1 bodies, which is what made
#17 and #18 fail validation. Fixed in the sim mapping helpers only:

- **op 44 `getDeviceHealth`**: cameras gained `sourceDeviceId` (the selector's device for the track) and
  `streamState` (`LIVE`/`LOST`, OD-22); the `audio` array is keyed by the mic **input** with its
  `role`; top-level `activeInputId` added. The idle answer is now byte-equal to
  `CORE_API_EXAMPLES.getDeviceHealth.responses[200].idle.value` (that equality is what #18 asserts).
- **op 45 `getAudioStatus`**: `{ channels: [...input-keyed...], activeInputId }` (SH-15/SH-17). The v1
  `trackId` member is gone from this read; `MIC_INPUT_OF_CHANNEL` remains the compat map for the demo
  controls, exactly as row 51 documented.
- **op 46 `getVideoStatus`**: same camera v2 fields (one shared mapping helper feeds 44 and 46).
- **op 42 `exportEvidence`**: the accepted body now carries `status: 'QUEUED'`
  (`EvidenceExportAcceptedSchema` is `z.literal('QUEUED')`, C3 §3 op 42). The evidence item's lifecycle
  status stays `EXPORTED`; the queue receipt and the item status are different things.

Storage (`getStorageStatus`) needed no change - #18's storage half already matched.

## 4. Verification (raw command output quoted)

### 4.1 `openapi.test.ts` #16 and #18 now pass; #17 is the single red

```
$ timeout 600 env CI=true npx vitest run test/openapi.test.ts --root packages/shared \
    --maxWorkers=2 --run --reporter=verbose </dev/null
 ✓ test/openapi.test.ts > the contract matches the simulated handlers (sim/api.ts) > the simulator's route table lists exactly the 9 simulated operations 0ms
 × test/openapi.test.ts > the contract matches the simulated handlers (sim/api.ts) > every documented simulated status is produced by the simulator, and every response parses 18ms
 ✓ test/openapi.test.ts > examples follow the canonical dataset (2026-10-01 10:00 WIB) > the device-health and storage examples equal the idle simulator at that instant 1ms
 ...
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
```

(The first title still reads "9" - the stale title belongs to row 50's pin sweep; the assertion it
runs compares against the registry's 22-operation simulated set and passes.)

#17's remaining failure, verbatim - it is the test's own v1 expectation, not a simulator shape:

```
AssertionError: expected { status: 202, body: { …(3) } } to match object { status: 202, body: { …(2) } }
-     "status": "EXPORTED",
+     "status": "QUEUED",
 ❯ test/openapi.test.ts:457:22
```

Note the line above it (`a.call(...)`, :456) passed: that helper runs `validateCoreApiResponse` and
requires `{ ok: true }`, i.e. the registry itself accepts the simulator's `QUEUED` body. The test then
asserts the superseded v1 literal.

### 4.2 Simulator REST suite (sim-owned fixture, extended)

```
$ timeout 600 env CI=true npx vitest run test/sim-api.test.ts --root packages/shared \
    --maxWorkers=2 --run </dev/null
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

Was 12 tests; +8 cover the new routes falsifiably: the two reads and their 401s, RK-12 (no credential
member anywhere in the answers), RBAC-before-lock ordering, the four locked edits writing zero audit
rows (SEC35-19), the write-only credential (value absent from answer and audit), the mic switch plus
its intervals page and `AUDIO_SOURCE_SWITCHED` row, the v2 sealing step order with progress and
`resumed`, the transcript 409/stub/conflict/append/list chain, and the export-job poll including its
404 and 422 and the INVESTIGATOR 403.

### 4.3 Full shared suite

```
$ timeout 1200 env CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run </dev/null
 Test Files  1 failed | 71 passed (72)
      Tests  1 failed | 1874 passed (1875)
```

Row 50's close-out baseline was `Tests 3 failed | 1864 passed (1867)`. Delta: **+10 passing / -2
failing** = #16 and #18 turned green plus the 8 new sim-API proofs. The single residual red is
`openapi.test.ts` #17 (owner: see §5). M2-RG-SHARED is therefore exit 1 at this row, one test short.

### 4.4 Typecheck and lint

```
$ timeout 300 npx tsc --noEmit -p packages/shared </dev/null   ; TYPECHECK_EXIT=0
$ timeout 300 npm run lint -w @dems/shared </dev/null          ; LINT_EXIT=0
```

## 5. Residual red: `openapi.test.ts` #17 - two blockers, neither inside `src/sim/**`

The simulator now answers all 22 simulated operations with schema-valid bodies. #17 nevertheless cannot
turn green from `packages/shared/src/sim/**`, for two independent, measured reasons.

**B1 - the test asserts the superseded v1 export body.** `test/openapi.test.ts:457` expects
`body.status === 'EXPORTED'`; the v2 registry (row 48, C3 §3 op 42) pins `z.literal('QUEUED')`, and the
same test's own `validateCoreApiResponse` call at :456 demands `QUEUED`. The two assertions in adjacent
lines contradict each other; no simulator output satisfies both. Fixing the sim to emit `EXPORTED`
would break :456 and the OpenAPI example pin; fixing the literal is a one-word edit in a file this row
must not touch.

**B2 - the status-coverage loop needs calls the flow never makes, and some documented statuses no
simulator can produce.** Lines :476-478 require, for every simulated operation, `produced ==
listCoreApiResponseStatuses(op, OFFLINE)`. The flow (:405-468) calls only the nine §21.2 operations, so
the thirteen capture operations produce nothing:

```
simulated ops the flow never calls: 13   (getCaptureConfig, getCaptureDevices, updateCaptureConfig,
setCaptureCameraSource, setPrimaryMic, switchAudioSource, listAudioSourceIntervals, getSealingProgress,
getTranscript, createTranscriptRevision, listTranscriptRevisions, getEvidenceExportJob,
setCaptureDeviceCredential)
```

Even with an extended flow, six of them document a `403` with **no `services` marker**, so the loop
treats it as simulator-producible while no seeded role can be refused it - the same condition that W27
handled for the five baseline reads by marking their 401/403 `services: ['dems-core-server']`:

```
getCaptureConfig         access=AUTHENTICATED
getCaptureDevices        access=AUTHENTICATED
listAudioSourceIntervals access=AUTHENTICATED
getSealingProgress       access=AUTHENTICATED
getTranscript            access=PERMISSION:EVIDENCE_VIEW      (every seeded role holds EVIDENCE_VIEW)
listTranscriptRevisions  access=PERMISSION:EVIDENCE_VIEW
```

For those six the 403 originates in the Origin / revoked-device guards, which the simulator does not
implement by design (01_specs §7.19). The other seven capture operations DO produce a real 403 in the
simulator (proven in §4.2), so they need flow coverage, not a marker.

**Routing.** B1 and B2 belong to the contract-test/registry lane, not the simulator lane:
- B1: `test/openapi.test.ts:457` literal `EXPORTED` -> `QUEUED` (row 50's pin family).
- B2a: extend the sim-contract flow to exercise the 13 new routes across their offline statuses
  (the material added to `test/sim-api.test.ts` here is a ready-made source of scenarios).
- B2b: mark the six unproducible `403`s `services: ['dems-core-server']` in the registry
  (`src/api/devices.ts`, `sessions.ts`, `evidence.ts` - row 48's files), mirroring the five baseline
  reads; otherwise the loop asks for a status no client of the simulator can ever receive.

No assertion was weakened, skipped, or timed out to reach this state.

## 6. Persistent Issues

| Issue | Attempts | Root cause | Current status | Blocking? |
|---|---|---|---|---|
| `openapi.test.ts` #17 red | 3 (emit `EXPORTED`; emit `QUEUED`; extend sim handlers) | Two test-side contradictions with the v2 registry, both outside `src/sim/**`: the v1 export literal at :457 (B1) and the coverage loop over uncalled capture ops plus six unmarked `403`s (B2) | unresolved-by-this-row; routed with evidence to the row 48/50 lane (or a dedicated row 51b) | yes for M2-RG-SHARED exit 0 at the row-56 gate; no for the sim parity behaviour itself |
| `SIM_SNAPSHOT_VERSION` still 1 | not attempted (row 51 already measured it) | Cross-row atomic bump (constant + wire `z.literal` + Core boot check) | unchanged, still routed to the controller with rows 48/49/52 | no: the new evidence member is optional, so v1 snapshots still resume |
| App-side consumers of the v2 `/audio/status` and `/device/health` shapes | n/a | This row changed only the simulator's REST answers to the schema row 48 published; app reads of these endpoints are Live-mode code owned by rows 52/54/67/68 | not touched (apps/** off-limits) | flagged for the app lanes; no shared test depends on it |

## 7. Notes / decisions

- **D-51a-1 (route count is derived, not chosen).** 22 = the registry's simulated set = 9 + 13, with
  op 88 excluded per C3 §2.4. Every added route has a working handler; none is a placeholder.
- **D-51a-2 (handlers live in `api.ts`).** A separate `sim/capture-api.ts` module would have created an
  import cycle with the route table and the shared `respond`/`fail` plumbing; `api.ts` is the file the
  register names for simulated REST handlers, and it grew 530 -> 1377 lines with clear section banners.
- **D-51a-3 (no new `SimActions` members).** Row 51 established that a `SimActions` member forces
  matching entries in `live/source/bindings.ts` and `api/sim-actions.ts` (both outside this row). The
  capture edits therefore apply pure transitions and commit through the store inside the handler, the
  same pattern `actions.ts` uses; `switchAudioSourceTransition` (row 51) is reused rather than duplicated.
- **D-51a-4 (transcript stub carries no segments).** D-EV-1 ("the package seals PARTIAL without
  fabricated text") is the governing rule: inventing Indonesian sentences would put unverifiable content
  inside a sealed-hash view. The stub carries the binding hashes and the revision counter; corrections
  arrive as revisions, whose `from`/`to` text is operator-supplied.
- **D-51a-5 (export job is derived, not stored).** Adding an `exportJobs` top-level slice would have
  joined `SNAPSHOT_KEYS` for no benefit; the job is reconstructed from the `EVIDENCE_EXPORTED` audit row
  op 42 already writes, which keeps the receipt, the job and the custody chain consistent by construction.
- **D-51a-6 (path-parameter 422 vs 404).** Where the registry documents both `404` and
  `422 INVALID_PATH_PARAMETER`, the simulator answers 404 for an id it does not hold and reserves 422 for
  a syntactically invalid one (job ids). This matches the existing sim style (`startSession` 404) and is
  asserted for op 87.
- **D-51a-7 (fixture edits are re-pins, not weakenings).** `test/sim-api.test.ts` kept every v1
  assertion that still holds (item status `EXPORTED`, CLIP latch, video tracks) and re-pinned only the
  three that encode a superseded shape; the audio assertion got *stronger* (inputId + role + activeInputId
  + the health mirror).

## 8. Next steps

- Contract-test lane (row 50 family or a new row 51b): apply B1, B2a, B2b; `openapi.test.ts` then
  reaches 21/21 and M2-RG-SHARED reaches exit 0 with no further simulator change.
- Rows 52/54 (app lanes): consume the v2 `/audio/status`, `/video/status` and `/device/health` answers
  if any app reads them through `Sim.request` (none does today in the shared suite).
- Row 55/56: M2-SIM-2 diff audit post-commit; the row-51a files are `src/sim/api.ts`, `src/sim/types.ts`,
  `test/sim-api.test.ts`, all owned by blueprint rows 51/51a.

---
*Generated: 2026-10-08 (row 51a completion run)*
