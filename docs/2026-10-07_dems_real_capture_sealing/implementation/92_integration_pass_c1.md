# 92 — Integration pass C1 (decision D120)

Date 2026-10-09. Agent: coder-execution. No commit. Each check was run once after its last
change (decision D122); the mutations are named where one was made.

## Items

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Mic input id rule `MIC-NN` | done (selector scope) | `packages/shared/src/api/patterns.ts` `MIC_INPUT_ID_PATTERN` (`^MIC-\d{2,}$`, the stored CHECK); `state-slices.ts` `CaptureConfigMicSchema.inputId`; `devices.ts` `CaptureConfigMicUpdateSchema.inputId`; `capture-discovery.ts` `CaptureInputScanEntrySchema.inputId`; `sim/types.ts` `CaptureMicInputId`; `sim/audio.ts` `builtInMicInputOf` / `channelOfMicInput`; `sim/session-machine.ts` `audioSourceAtStart`; `sim/capture-telemetry.ts`; `sim/api.ts` op 78 body check; core-server `modules/capture-config/slices.ts` `micInputOf`; `modules/devices/status.ts` `activeInputOf` (one narrowing the wider type forced) |
| 2 | `captureDurable` | schema + seam done; wiring is row 71's | `state-slices.ts` `ActiveSessionSchema`, `core-api.ts` `SessionResourceSchema` (optional boolean); `sim/types.ts` `ActiveSession.captureDurable?`; `sim/capture-telemetry.ts` `captureDurableOf`, `captureDurableTransition` |
| 3 | `EvidenceItem.manifestVersion?` / `labelsStatus?` | done | `sim/types.ts` `EvidenceItem`; `state-slices.ts` `EvidenceItemSchema` |
| 4 | Ops 78 / 79 ask the adapter registry | done | `modules/capture-config/index.ts` (import + the boot step takes `captureFenceControl(app).registry()`); `test/static/imports.test.ts` `EXPOSED` gains `src/capture/fence` |
| 5 | Describe text; `micsInInputOrder` | text done; helper kept | `state-slices.ts` `CaptureConfigSliceSchema.mics`; `modules/capture-config/routes.ts` (comment only) |
| 6 | Contract walk area for ops 89, 93-97 | done | `test/acceptance/contract.test.ts`, new block after the capture selector area |
| 7 | Expired session frees its candidate list at once | done | `modules/capture-discovery/session-expiry.ts` (new), `index.ts`, `store.ts` / `limits.ts` (`sessionIds()`) |

## What is real, and its limits

1. **Mic id.** A stored selector with `MIC-03` PRIMARY rehydrates, is published on an edit, is
   stored, and comes back after a restart (clone database, `[5, 'dbc-6']`). "Exactly one PRIMARY
   and one STANDBY" and `deviceId == inputId` hold on that path (asserted). NOT widened: the session
   audio source, the audio-source intervals, op 81, the meters slice and the audio status stay on
   `MIC-01 | MIC-02` — core-web and mobile index `Record<MicInputId, …>` by them and are not this
   pass's files. So a recording START with an input beyond the pair is refused by name
   (`mic input MIC-03 has no session audio source`); it is never recorded under another
   microphone's id. Meters and `MIC_SILENT` have no channel for such an input.
   Also open: **no API call can put `MIC-03` into the selector** (op 78 finds the slot by `inputId`
   and D106 (4) wants `deviceId == inputId`): contract decision, request filed.
2. **`captureDurable`.** The simulator has no notion of a fragment and the engine shares its
   transitions, and the session row has no place for the member: an explicit `true` at RECORDING
   would make stored state differ from committed state on the Core. So the simulator never writes
   the member and ABSENT READS AS DURABLE (`captureDurableOf`) — a simulated recording is durable
   from RECORDING. `captureDurableTransition` is the seam; it is hosted by no action yet.
3. **Evidence item.** The strict schema now accepts the rows (2, hash, labels) and (2, NULL, NULL).
   The mapping's local type and cast still compile and are left (closed folder; request filed).
4. **Registry.** In `REAL_DEVELOPMENT` an assignment of a production camera answers
   `422 INVALID_INPUT`, `details.reason: DEVELOPMENT_SOURCE_NOT_ALLOWED`, nothing stored, by both
   operations. `SOURCE_KIND_NOT_RECORDABLE` is the contract's 409 of the recording start (C3 §4),
   not of ops 78 / 79: it stays row 71's (`assertRecordableSelector`). SIMULATED: no registry, as before.
5. **`micsInInputOrder` not removed**: the case `AC-B-70` of `routes.test.ts` holds its behaviour
   on a hand-set state; removing it means removing that case.
7. **Expiry.** After every commit that holds an `AUTH_EXPIRED` row the module asks
   `auth_sessions` which of the sessions that own a list or limiter starts have ended (one SELECT of
   ids) and discards those; a still-open session of the same operator keeps its list. A failed read
   frees nothing early and is logged and written to the error log.

## Tests (red first / mutation)

| Item | Test | Proof it can fail |
|---|---|---|
| 1, 2, 3 | `packages/shared/test/integration-c1.test.ts` (9) | refusals beside every acceptance (bad ids, wrong types, unknown members) |
| 1, 4 | `apps/core-server/src/modules/capture-config/__tests__/integration-c1.db.test.ts` (5) | mutation: schema line back to the two-value enum -> `engine.rehydrate` rejected; registry line removed -> 200 instead of 422. Both red, restored, green. Control: `mic_primary_id = 'CAM-02'` stops at `engine.rehydrate` |
| 7 | `capture-discovery/__tests__/session-expiry.test.ts` (5), `session-expiry.db.test.ts` (3, manual clock, the identity unit's own sweep: ABSOLUTE and IDLE) | mutation: commit listener removed -> 2 red (`expected 2 to be 1`) |
| 6 | the new block of `contract.test.ts` | — |

## Results

| Check | Result |
|---|---|
| `npm run test -w @dems/shared` | 85 files, 2294 passed |
| core-server unit: capture-config, capture-discovery, capture-inputs, capture-notices, devices, `test/static` | 29 files, 384 passed |
| core-server unit sample: engine, sessions, capture, db/mapping | 2 failed = the baseline MODG pair in `modules/sessions` |
| db (lock `db-migrate`): `rbac-matrix`, capture-config, capture-discovery (+ connect), devices, capture/fence | 139 passed, 1 failed: `fence.db.test.ts` 'CONTROL of the fixture' — it pins the OLD rule (boot stops for `MIC-03`); pass C2's file, request filed |
| typecheck shared, core-server; lint shared, core-server | clean |
| typecheck core-web | 1 error, not this pass: `features/evidence/__tests__/verify-v2.test.tsx` (`V-15`, rows 87 / 141) |
| typecheck mobile | 4 errors, not this pass: `features/capture-selector/capture-notices-model.test.ts` x3 (row 138), `features/evidence/verify-v2.test.tsx` (`V-15`, rows 87 / 141) |
| OpenAPI regenerated under `npm.lock` | 97 operations, offline 31; second run "unchanged" |
| Public totals 97 / 36 / 61 / 67 | not moved (registry block and generator block of `contract.test.ts` green; shared suite green) |

### `contract.test.ts` blocks

Before: 11 failed, 25 passed (36). After: **10 failed, 27 passed (37)**. No block edited but the new one.

Failing before (11): router equals registry; area 4 sessions; area 5 evidence; 401 every
operation; 403 sample; 404 / 405 / INVALID_PATH; 403 DEMO_DISABLED + grant removed; every GET
writes nothing; free text U+0000; **SC6 "every answer validated … API-7 on every 2xx POST"**
(76 judged, needs more than 80); SC6 coverage.

Failing after (10): the same list without the SC6 "every answer validated" block, which is green
(the new area's 2xx POSTs are judged too). New green block: "camera search, connect and the mic
re-read (operations 89 and 93 to 97 …)". Coverage cells produced 280 -> 299 of 456; of the six
operations only `setCaptureDeviceCredential 409` (CAPTURE_CONFIG_LOCKED, needs an open session:
area 4) is not produced. The area's only network is loopback: the real adapter on the fake ONVIF
stub's fixture, guard on during the search (datagrams to 127.0.0.1 only, 0 refused).

Seen, not touched (stale pins of earlier rows in that file): session operations 11 (now 14),
guarded 71 (now 93), reads 27 (now 36), 8 unrouted operations.

## To wire

- Row 71: host `captureDurableTransition` from `app.capture.status().durable`; where the member
  lives across a restart (database owner). `assertRecordableSelector` at the start.
- Row 71 + clients: widen session audio source / meters / op 81 for an input beyond the pair.
- Controller: how op 78 assigns a new mic input (blocks row 140's microphone slot at the API).
- Pass C2: the flipped control in `fence.db.test.ts`.
- Database owner: drop the two casts and the local sealed-members type in `db/mapping/rows.ts`.

## Decisions taken

- The widened id is typed `string` (`CaptureMicInputId`) on the selector only; `MicInputId` stays the metered pair.
- A start on a non-built-in input is refused by name rather than mapped to a built-in input.
- `modules/devices/status.ts` (not in this pass's map) got one narrowing line: the core-server typecheck needed it.
- `modules/capture-config/slices.ts` `micInputOf` and one pinned message in `slices.test.ts` follow the rule (row 136's request names the function).
- Expiry is detected by a commit listener plus one read, not by tapping the publish seam.
- `captureFenceControl` is imported from `src/capture/fence` (added to `EXPOSED`), not through the capture index.
