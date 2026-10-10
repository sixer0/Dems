# 95 — Integration pass D1b: shared-contract seams (decision D133; rulings D134, D137, D140, D144)

Date 2026-10-09. Agent: coder-execution. Baseline `e296ce7`. No commit. Each check ran once after
its last change (D122); a second run only after a fail or a later edit of the same file. The tree
moved under this pass (rows 61, 71a, 71b, 82, 90, 91, 92 and passes D1a, D2 landed meanwhile):
where a red is another row's, it is named.

## Items

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Op 78 assigns the mic inputs by pair replacement | done | `packages/shared/src/api/devices.ts` (`CaptureConfigMicUpdateSchema.role?`), `sim/capture-config.ts` (`replaceMicPair`, `UNKNOWN_MIC_TRANSPORT`), `sim/api.ts` (`checkCaptureConfigUpdate`), `sim/types.ts`; core-server `modules/capture-config/routes.ts` (`withRegisteredTransports`), `store.ts` (`readMicTransports`) |
| 2 | Session audio source / op 81 / intervals / meters / audio status on `MIC-NN` | done (contract + simulator types and op 81); a recording START on a pair beyond the built-in one is still refused in `session-machine.ts` (row 82's file, request filed) | `api/state-slices.ts`, `core-api.ts`, `sessions.ts`; `sim/types.ts`, `api.ts`, `actions.ts` |
| 3 | `EvidenceItem.developmentSources` | done in contract + simulator type; the server mapping line is a request | `api/state-slices.ts` (`EvidenceItemSchema`), `sim/types.ts` |
| 4 | Package layout + the reset removes the folders it cleared | done | `apps/core-server/src/evidence-verify/index.ts` (`sessionPackageDir`, `sessionManifestPath`), `src/db/reset/package-removal.ts` (new), `real-evidence.ts` (`removeClearedDevelopmentPackages`), `routine.ts` (after the swap), `index.ts` |
| 5 | `contract.test.ts` stale pins | pins fixed; **the "fewer than 10 red blocks" target is NOT met: 12 red** (see below) | `apps/core-server/test/acceptance/contract.test.ts`, `rbac-matrix.test.ts` (`DEFERRED_ROUTE`) |
| 6 | `device-upsert.db.test.ts` | done: the TEST was the stale side | `apps/core-server/test/db/device-upsert.db.test.ts` |
| 7 | MODG route lists | evidence: done; sessions: exact change filed as a request (row 71b's file) | `modules/evidence/__tests__/routes.test.ts`; also one pin of `modules/capture-config/__tests__/routes.test.ts` |
| 8 | `productionIdentity()` drops a reference that is not `urn:uuid:<UUID>` (D134) | done | `api/capture-discovery.ts` (`CAPTURE_ENDPOINT_REF_PATTERN`) |
| 9 | TS6196 unused `MicInputId` in `sim/types.ts` | done | core-web `tsc -b` 0 errors |
| 10 | Meter channel -> mic input is a function of the microphone lines (D137) | done in the simulator and in the Core's audio status; three lines of `session-machine.ts` are a request | `sim/audio.ts` (`micInputOfChannel`, `channelOfMicLine`, `captureMicLines`, `activeMeterChannel`, `noInputFrame`; `MIC_INPUT_OF_CHANNEL` kept as a deprecated alias), `capture-telemetry.ts`, `faults.ts`, `health.ts`, `react.ts`, `api.ts`, `capture-config.ts`; core-server `modules/devices/status.ts` |
| 11 | "MIC 3" wording | done | `i18n/en/common.ts` (`common.captureDeviceName.microphone`); the pins are in four CLIENT test files (edited: the string only) |
| 12 | Ops 42 / 87 / 88, additive (D140) | done in the contract and simulator; server wiring lines are requests | `api/evidence.ts` (`EvidenceMediaSessionRequestSchema`, op 88 body / 400 / 422 / reasons; job `failureReason` values), `api/core-api.ts` (`EvidenceExportAccepted.jobId?`, 409 `EXPORT_IN_PROGRESS`), `api/examples.ts`, `sim/api.ts` (`exportJobIdOf`, `kind`), `sim/evidence-actions.ts`, `sim/types.ts` |
| 13 | Two documented reasons; three advisory notices; fault key (kind, reason, device) (D144) | reasons + notices done; **the fault-key change is NOT done** (see "Left") | `api/sessions.ts`, `core-api.ts`; `sim/capture-notices.ts` (`CaptureAdvisoryReason`) |

## What was decided while building

1. **Op 78, two forms.** Lines WITHOUT `role` = the form published first, unchanged (additive):
   a line edits an input the selector holds. Lines WITH `role` on both = the two lines ARE the new
   pair. A single line with `role`, a mix of the two forms, two equal roles, one input twice,
   `deviceId != inputId`, an unregistered microphone: `422 INVALID_INPUT`, nothing written. The
   rule lives in the shared transition, so the simulator and the hosted action hold it alike; the
   Core route keeps `assertStorable` and the registry check of pass C1.
   Audit rows keep the keys of C3 §5.2: the same two inputs trading roles = the ROLE row of op 80;
   otherwise one SOURCE row per role whose device (or transport) changed.
2. **Transport of a new input.** The device slice has no transport. The Core route reads it from
   the registry row (the module's one read statement) for a line that names none; the simulator
   writes `UNKNOWN`. Without it the stored row and the committed state disagree after a restart.
3. **Meters type is truthful.** `AudioSlice.inputs` is `Record<MIC-NN, AudioFrame>` (exactly two
   frames, schema-held). Indexed reads are `AudioFrame | undefined`; type-only assertions went into
   8 shared test files, 3 core-server test files, and two lines of `live/source/` (declared).
4. **A replaced pair re-keys the meters at once** and makes its PRIMARY the active input; an edit
   that keeps the two inputs leaves the meters slice alone, as before.
5. **Op 81 with a well-formed id that is no input of the session** answers the contract's
   `409 AUDIO_SOURCE_CONFLICT` (it was `422` while only two ids were well formed); two shared
   tests that pinned `MIC-09 -> 422` now hold `MIC-9 -> 422` and `MIC-09 -> 409`.
6. **Reset removal.** Only directories the guard cleared in this run; judged AGAIN at the moment
   of removal with the anchors read at R-3 (a folder replaced in between stays and blocks); only
   one `SESSION-*` path segment that is a real directory resolving directly below the resolved
   store root; after the swap, never on a refused run. A folder that stays is logged at `error`
   (`RESET_DEVELOPMENT_PACKAGE_LEFT`) and blocks the next reset. The store scan itself is not
   changed: a v2 folder reads UNKNOWN there (fail-safe) and rule (5) asks its signed manifest.
7. **Item 6: which side was wrong.** Row 132's `registerCaptureDevice` registers an adopted camera
   with `streamState: null` (no stream until a track is assigned) and the mapping reads exactly
   that back (`db/mapping/rows.ts:824`). The test of row 129 still expected the built-in cameras'
   `LIVE`. The test follows now, with a control on `CAM-01`.
8. **`kind` on the export row** is written only when the request names it (absent = PACKAGE), so
   no existing row shape moves.
9. **Advisory notices** are `SYSTEM` alerts of severity `INFO`, one per (reason, device), with no
   fault, no audit row and no device state. No new demo control.

## Results

| Check | Result |
|---|---|
| `npm run test -w @dems/shared` | 88 files, 2348 passed (new: `test/integration-d1b.test.ts`, 26) |
| typecheck shared, core-server, core-web, mobile | 0 errors each |
| lint shared, core-server | clean |
| core-server unit: devices, capture-config, evidence MODG, db/reset, evidence-verify, capture-notices, `test/static` | 37 files, 690 passed |
| db (lock `db-migrate`): `integration-d1b.db` (4), `integration-c1.db` (5), `device-upsert.db`, `m4-sec-reset.db`, capture-config, devices | green |
| db: `capture-actions.db` A-4 | red, the known baseline (`transcriber.config`) |
| OpenAPI regenerated under `npm.lock` | 97 operations, offline 31; totals 97 / 36 / 61 / 67 not moved; schemas 166 -> 167 (the optional body of op 88) |
| Client pin tests of item 11 (4 files) | green |

**Proofs that can fail.** Removal rule, 5 mutants, all red, restored: second judgement off;
blocked run removes; name rule off; directory/link rule off; name rule and containment off.
`endpointRef` rule off: red. Items 1, 10, 13: the refusals beside each acceptance; item 10's test
was red before the active-input rule was right.

`MIC-03` through the API: `integration-d1b.db.test.ts` — REAL_DEVELOPMENT, the local microphone the
boot registered is selected by op 78, stored (`mic_primary_id = MIC-03`), stored state equals the
committed state, and a restarted Core holds the same selector. Elsewhere `422 INVALID_INPUT`:
SIMULATED on the seed (no such device), and a production microphone in REAL_DEVELOPMENT
(`details.reason: DEVELOPMENT_SOURCE_NOT_ALLOWED`).

### `contract.test.ts` blocks

| | Red | Passed |
|---|---|---|
| At `e296ce7` (the checkpoint report) | 10 | 27 |
| In the moving tree, before this pass's edits | 14 | 23 |
| After | **12** | 25 |

Red at the baseline (10): router = registry; area 4; area 5; 401; 403; 404 / 405; DEMO_DISABLED +
grant removed; no GET writes; U+0000; coverage.

Red after (12): router = registry; area 4; 401; 403; 404 / 405; DEMO_DISABLED + grant removed; no
GET writes; U+0000; coverage — all nine only because of the **5 operations still unrouted** — and
three that are new: **SC6 "every answer validated"** and **"the error codes"** (op 81 is routed and
op 82 on the same path is not, so `GET …/audio-source` answers an undocumented 405), and
**AC-B-70** (reached for the first time: a v2 item sealed by this file lists `files: [...,
"AUDIO-01"]`, one session audio track, which the block's rule "both members" does not admit).
Green again: area 5; the committed-document block and the detector block.
Coverage cells produced: 299 -> 417 of 457.

Pins fixed, none weakened: session operations 11 -> 14; guarded 71 -> 93; reads 27 -> 36; router
79 -> 98 (reached only when nothing is unrouted); the every-role list 6 -> 9; `LANDED_UNROUTED`
8 -> 5 (ops 87, 81 and 88 routed in this wave; row 90 edited the same list for op 88).

Unrouted, by owner: 82 `listAudioSourceIntervals` (session wiring, no route yet); 83
`getSealingProgress` (rows 82 / 86); 84 `getTranscript`, 85 `createTranscriptRevision`, 86
`listTranscriptRevisions` (no owner row in wave D). The target cannot be met without routing them
or weakening the walks that call them.

## Left for the next pass

- **Fault key (kind, reason, device)** — not built. `faults.active` and its stored rows are keyed
  (kind, target); a `reason` on the entry needs the fault mapping in `db/mapping` (closed) and
  probably a stored column, and `CaptureFaultWarningInput.reason` must be threaded through
  `raiseFaultAtKey` / `clearFaultAtKey` / `resolveAlerts`. What exists now: `MIC_RATE_AT_LIMIT` is
  its own notice alert beside `MIC_SILENT` and `CAPTURE_FAULT`. Still merged: two `CAPTURE_FAULT`
  reasons on one device (e.g. `MIC_DISCONNECTED` and another).
- `switchAudioSourceTransition` audit keys (`fromInput`, `toInput`, `fromMs`, `toMs`,
  `sendingDeviceId`) — `session-machine.ts`, row 82.
- The forwarder must call `raiseCaptureWarning` with the three advisory codes (row 71b).
- `rbac-matrix.test.ts` AC-B-16: the literal `{ INVESTIGATOR: 11, SUPERVISOR: 0, TECHNICIAN: 0 }`
  reads `{ 13, 0, 2 }` now that ops 81, 87, 88 are routed. Derived by hand: 87 denies INVESTIGATOR
  and TECHNICIAN, 81 denies TECHNICIAN — one INVESTIGATOR cell is not accounted for, so the literal
  was NOT moved.
- Not applied (decision needed): an INTERNAL action for the real storage volume (row 61, action
  count 45 -> 46); three INTERNAL entries for the seal transitions (row 82's note).

## Requests filed (`file_requests.md`, 15:35:19Z)

`session-machine.ts` (start on any `MIC-NN`, parameter type, two channel lines); sessions MODG
test (exact change); `db/mapping/rows.ts` transport of a de-selected device; op 42 handler / op 88
local schema; the client import sites of `MIC_INPUT_OF_CHANNEL`.
Also open, other owners: `db/mapping` `developmentSources` (item 3: `evidenceItemFromRows` /
`evidenceItemToRow` carry `development_sources` to and from the item member);
`modules/evidence/media.ts` `LIVE_STREAM` (row 90's own request); `live/source/bindings.ts`
`exportBody` passes `kind` (row 92's request; `ExportRequest.kind?` exists now).

## Client compile errors (item 2)

None: core-web and mobile typecheck 0 errors (pass D2 landed its client side during this pass).
Client sites that still use the fixed channel table are listed in the request line (17 sites).
