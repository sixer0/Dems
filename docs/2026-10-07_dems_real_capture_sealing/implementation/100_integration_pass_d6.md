---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: integration pass D6 — the three defects of pass D4 and its seams (decisions D154, D156)
date: 2026-10-09
agent: coder-execution (single driver; rules D94 / D122, ownership D95 §9)
source_plan: implementation/98_integration_pass_d4.md; delegation_progress/file_requests.md lines 15:50:24Z, 16:24:16Z, 16:42:26Z
narrative_tier: 3
status: needs-review — items 1, 3, 4, 5, 6, 8, 9, 11, 13, 14 done; 2 stopped (migration proposal); 7 built except one foreign line; 10 half (one cell produced, the other is a product defect outside the pass); 12 not built except its Live part
---

# 100 — Integration pass D6

Baseline `e296ce7` plus the wave D tree. No commit, no migration (schema 5 / `dbc-6` asserted in
each new db file). Paths: `S` = `packages/shared/`, `C` = `apps/core-server/`, `W` =
`apps/core-web/src/`, `M` = `apps/mobile/src/`.

## 1. Per item

| # | Status | What (file) |
|---|---|---|
| 1 | done | V-11 binds a record to its body. `S/src/evidence-verify/verify.ts` `checkRevisions`: a record without `body` = `REVISION_BODY_MISSING` (MISSING); the body's hash must be `sha256` (`REVISION_BODY_HASH_MISMATCH`); the body's own `evidenceId`, `machineTranscriptSha256` (against the MANIFEST), `revisionNo`, `parentSha256`, `authorId`, `reason`, `createdAt` must equal the record's (`REVISION_MEMBER_MISMATCH`, TAMPERED, names `revisionNo` + `member`). `revisions.ts` `REVISION_BOUND_MEMBERS`; `types.ts` two codes. Parent link and retained-certificate rule unchanged. Writer: `C/src/modules/transcripts` already wrote exactly this body (pass D4) — no writer change was needed; the test builder (`C/src/evidence-verify/__tests__/support.ts` `revisionRecord`) now writes the bound members |
| 2 | STOPPED, proposal | see §2 |
| 3 | done | `C/src/plugins/permission-guard/session-holder.ts`: the fact reads `active_session.created_by` (C3 §2.2 "the operator who created the open session"; the mapping writes it from `session.createdBy`; `started_by` = who started the recording, no state member, always NULL). Static pin moved. Other routes with `SESSION_HOLDER`: none — operation 81 is the only one (`S/src/api/sessions.ts` :585; `access-rules.test.ts` :121) |
| 4 | done | `C/src/modules/sessions/routes.ts`, operation 81 handler: in simulated capture a well-formed input that is no input of the RECORDING open session answers `409 AUDIO_SOURCE_CONFLICT` (`details.reason: NO_SUCH_INPUT`). Decided on the committed state before the unit (a race falls back to the action's own answer) |
| 5 | done | Contract: `note` REQUIRED, 5–500 after trimming (`S/src/api/evidence.ts`; simulator `sim/api.ts`; OpenAPI regenerated). Spec basis: dbc-3 §B.9 `reason` NOT NULL 5..500 and the reason is inside the signed body. Clients: `W/features/evidence/transcript-revise-dialog.tsx`, `M/features/evidence/transcript-revise-sheet.tsx` + both `transcript-model.ts` (`revisionNoteOk`): Save disabled and the rule shown (`evidence.transcript.revise.noteRule`) until the note fits; label "Reason" (was "Reason (optional)") |
| 6 | done (Core side) | `C/src/engine/fact-doors.ts` (`factDoorsOf`), own block in `engine/host.ts`, pure transition `S/src/sim/core-facts.ts` `noteTranscriptRevisionTransition`, state member `EvidenceItem.transcript` (the slice schema's summary). `modules/transcripts/routes.ts` calls the door after the unit of operation 85 committed (a unit of its own; a failed publication is logged, never turns the 201 into an error). Limits: §4 |
| 7 | built except ONE foreign line | INTERNAL action `applyStorageVolume`: registry entry (`S/src/api/sim-actions.ts`, 48 → 49 actions, internal 5 → 6), simulator action + transition (`sim/core-facts.ts`), Live binding LOCAL (`S/src/live/source/bindings.ts`), engine door (`fact-doors.ts`, own block in `host.ts`). NOT built: the call at boot — `captureBootControl` is not exported by the closed unit `src/capture`, and a boot step of `modules/storage` would run BEFORE the capture boot step. Request filed (one statement in row 61's boot step). `modules/storage` unchanged |
| 8 | done | `ExportResult` reason `EXPORT_IN_PROGRESS` (`S/src/sim/types.ts`), its line in `C/src/modules/evidence/index.ts` (table) and `S/src/sim/api.ts` (table), the cast removed in `S/src/live/source/bindings.ts` and `W/features/evidence/export-wizard.tsx`. Wording: `evidence.exportWizard.failure.EXPORT_IN_PROGRESS` and `evidence.exportJob.inProgress` = "An export of this item is already running. Wait until it has finished, then export again." |
| 9 | done | Interval `seq` from 1: contract text + `min(1)` + example (`S/src/api/sessions.ts`), simulator (`sim/api.ts` `audioSourceIntervalsOf`). No client assumed 0 (they use `seq` as key, order and to match the manifest's intervals: `sealed-playback.ts` :126 in both apps is now consistent) |
| 10 | HALF | `createEvidenceMediaSession 201` PRODUCED: `C/test/acceptance/contract.transcripts.ts` makes the walk's REAL item playable (package built before the seal for the ID the seal mints, sealed with a key of a throw-away credential store handed to the media unit through its test door). `resetDemo 409` NOT produced — **finding F-D6-1**: the reset of a database with a REAL sealed item IS refused by the routine (R-3, nothing rebuilt) but `C/src/modules/demo/reset.ts` answers it `503 NOT_READY`; no path answers the documented `409 RESET_BLOCKED_REAL_EVIDENCE`. The walk holds the measured 503 (marked MEASURED, NOT WANTED); the coverage block stays red on that ONE cell. Request filed. `contract.test.ts`: 37 of 38 |
| 11 | done | Operations 84–86 answer `409 TRANSCRIPT_NOT_READY` with `details.reason` `SIMULATED_ITEM` (text: "…an item of the demonstration data: the Core server keeps no transcript and no revisions for it.") or `NO_SEALED_TRANSCRIPT`. Clients: the pane says "The transcript is not available yet." as a state, no toast, no record — not an operator's error; wording left |
| 12 (D156) | NOT built, except the Live part | see §5 |
| 13 (D159) | done — the TEST was stale | `W/features/session-monitor/__tests__/audio-source.test.tsx` :255: the band's segment test id is its `seq`; with item 9 the start interval is 1 and the switch's interval 2. The product value is right by the manifest's rule; expectation moved (segment-1 = MIC-01, segment-2 = MIC-02). Cause: item 9 of this pass, not D5's merge nor D1b |
| 14 (D160) | done | The shared raise carries `reason` (code form `^[A-Z][A-Z0-9_]{1,63}$`) and `evidenceFiles` (non-negative integer) of a `CAPTURE_FAULT` without a subject to the NEW alert's `params` and the `FAULT_RAISED` details; anything else is dropped (`S/src/sim/capture-telemetry.ts` `captureFaultFactsOf`, `faults.ts` `raiseFaultAtKey` / `raiseAlert`). The members are NOT added to `CaptureFaultWarningInput` (that broke `C/src/capture/forwarder.ts:201`). **`C/src/capture/__tests__/forwarder-engine.test.ts` (pass D8, closed) is now red because its `it.fails` passes: `.fails` must be removed there** |
| 15 (D161) | NOT TAKEN — the pass was too far along when it arrived | Nothing of it was started: no member `adapter` / `sourceClass` / `sourceOpen` was added to the shared device shape, row 140's two `it.fails` are unchanged, OpenAPI holds no such member. Goes to the next pass whole |

## 2. Item 2 — stopped: only a schema change fixes it

| Fact | Source |
|---|---|
| Spec: "one Core Ed25519 key, key id `CORE-KEY-EVSIGN-01`" (v1: `DEMO-KEY-EVSIGN-01`); manifest `signature.keyId` | ev §C.1, §C.3 |
| Code: `CORE_EVIDENCE_SIGNING_KEY_ID = 'CORE-KEY-EVSIGN-01'`; the signer's own rule `^[A-Z0-9][A-Z0-9-]{2,62}$`; the route stores `signer.signer.keyId` | `C/src/capture/signer/types.ts` :11; `modules/transcripts/routes.ts` |
| Table: `transcript_revisions_key_id_check` `signature_key_id ~ '^[A-Z][A-Z0-9_]{0,63}$'`; `evidence_items.signature_key_id` has no such check | `0004_capture.sql` :154; dbc §B.9 "format `CODE`" |

The signer and the route are the spec's form; the deviating side is the table rule. Changing the key
ID would break ev §C.1, the manifests, certificates and `evidence_items` of every sealed package.
**Proposal for the database owner (smallest migration):** drop and re-add the check as
`signature_key_id ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$'`; dbc §B.9 text "format `CODE`" → "key-ID form";
schema / contract revision bump. Not written. Alternative without a migration, NOT taken (a design
decision, and the stored value would differ from the package record): store the ID with `-` → `_`.
Until then operation 85 with the product key answers `503 SIGNING_KEY_ID_NOT_STORABLE` (held by the
last block of `transcript-routes.db.test.ts`, which flips to 201 with the migration).

## 3. Results (each once; a second run only after a fail)

| Check | Result |
|---|---|
| typecheck shared / core-server / mobile | 0 / 0 / 0 errors |
| typecheck core-web | 7 errors, all `features/session-monitor/__tests__/situation-c.test.tsx` (row 139, in flight) |
| lint shared / core-server | clean; 1 foreign warning `src/transcription/host.ts:166` (row 71c) |
| Core unit: `test/static`, engine, sessions, transcripts, evidence, permission-guard, evidence-verify, evidence-export, storage, capture static | 60 files, 1162 tests; 7 red at first (6 my pins, moved by delta, green) ; 1 foreign red: capture static G-R14 `src/capture/fence/index.ts` (row 140, in flight) |
| Core db (lock): `transcript-routes.db` 11, `session-holder.db` 3 (new), `fact-doors.db` 2 (new) | green |
| shared: `sim-core-facts` (new) 4, `live-source-bindings` 110, `sim-api`, `integration-d1b`, `api-domain-operations`, `openapi`, i18n | green after pins moved by delta |
| core-web: `transcript.test.tsx`, `export-job.test.tsx`, two Live guards | 4 files green |
| mobile (`--maxWorkers=2`): `media-session-canary`, `export-job`, `live-evidence-export`, `live-evidence-static` | 4 suites, 43 tests green |
| OpenAPI regenerated under `npm.lock` | 97 operations, offline 31 |
| `rbac-matrix.test.ts` | 39 of 39 (three reds on the way, each from the model not knowing the holder fact; see D6-6) |
| `contract.test.ts` | 37 of 38; red: coverage, on `resetDemo 409` only (F-D6-1). Was 37 of 38 with two cells missing |
| final db run (lock): contract, rbac-matrix, transcript-routes, session-holder, fact-doors, audio-intervals | 6 files, 97 tests, 1 red (the coverage cell) |
| shared suite, once | 90 files, 2364 tests, 1 red: `live-source-platform-neutral` export list (pass D5's `EXPORT_IN_PROGRESS_REASON`, pin moved, file green on its re-run) |
| `W` `audio-source.test.tsx` (item 13) | 21 of 21 |
| `C` `forwarder-engine.test.ts` (pass D8's) | 1 red BY DESIGN: its `it.fails` now passes (item 14) |

**Mutation proof (item 1, once):** the member comparison removed from `checkRevisions` → 2 tests red
in `verify-v2.test.ts`; file restored byte-exactly (SHA-256 compared).
**Negative controls:** item 1 — untouched package PASS beside each alteration, and restored-file PASS
at the end (db test); item 3 — a second INVESTIGATOR (same role, not the creator) refused 403 with one
`ACCESS_DENIED` row `reason: SESSION_HOLDER`; item 2 — the product key still measured refused.

**Item 1 proof on a package** (`transcript-routes.db.test.ts`, block "PASS D6"): revisions written by
the product (operation 85, real signer of row 83 with a storable key ID); two revisions → all checks
PASS; body removed → MISSING `REVISION_BODY_MISSING` rev 2; `reason` / `authorId` / `createdAt`
altered → TAMPERED `REVISION_MEMBER_MISMATCH` rev 1 with the member; body altered → TAMPERED
`REVISION_BODY_HASH_MISMATCH`. NOT proven: on a package the sealing PIPELINE wrote (the package of
this rig is the verify row's test builder; the revision records are the product's).

## 4. Not proven / limits

- Item 6: the summary is state only — after a Core restart the item has no `transcript` member until
  its next revision (request: mapping). Clients do not yet re-read on the member (request: row 92).
- Item 7: no real-mode boot shows the figures until row 61's one line lands.
- Item 4: the rule reads the committed state; in a race the hosted action's 404 can still answer.
- Item 10: the 201 uses the media unit's test door for the key store (as row 90's own test does).
- Nothing was run in a browser or on a device.

## 5. Item 12 (D156) — not built

Built: `SimTransitionError.reason` (`S/src/sim/errors.ts`) carries the Core's `details.reason`
through `S/src/live/source/rebuild-error.ts`; test in `live-source-bindings.test.ts`
(`CAPTURE_NOT_DURABLE`). The two typecheck errors row 139 saw (`sim/api.ts:496`, bindings test :89)
were this pass's own in-flight state and are closed.

Not built: the simulator's connecting → durable / failed-start model. Why it is not a line of this pass:
1. `session-machine.ts` :907 treats ANY session that carries `captureDurable` as recorded by a Core
   and stops the simulator's own seal for it. A simulator that writes the member needs that rule
   changed (row 82b's file, outside this pass) or must delete the member when durable.
2. The failed-start transition (`FAULT`, `startedAt` null, alert `params.reason`) lives in
   `C/src/engine/capture-session.ts`, not in shared; it must move or be written twice.
3. 49 test files in four workspaces start a recording; every one that stops or reads "recording"
   without driving the clock flips, in folders four drivers are writing now.
Proposal: its own row after this wave, owner of `session-machine.ts` + shared sim, with the existing
demo fault `CAMERA_OFFLINE` on both cameras as the "no camera" control (no new demo control).

## 6. Errata for the spec owner

| ID | Text |
|---|---|
| PE-D6-01 | ev §D V-11 / §C.1: the revision record of `transcript-revisions.json` CARRIES its canonical body; `sha256` = SHA-256 of that body; the body holds `evidenceId`, `machineTranscriptSha256`, `revisionNo`, `parentSha256`, `authorId`, `reason`, `createdAt` (+ `changes`), each equal to the record / manifest. A record without a body fails V-11 as MISSING |
| PE-D6-02 | C3 op 85: `note` required, 5–500 characters after trimming |
| PE-D6-03 | C3 op 82: `seq` counts from 1 (was "from 0") |
| PE-D6-04 | C3 `SIM_ACTION_OPERATIONS`: 49 members, 6 internal (`applyStorageVolume`) |

## 7. Decisions for the controller

| ID | Decision | Alternative |
|---|---|---|
| D6-1 | The body is bound to the MANIFEST's item and transcript hash (a signed revision cannot be moved to another package) — stricter than asked | bind only the three record members |
| D6-2 | Item 2: no key-ID change, no column encoding; migration proposal | `-` → `_` in the column |
| D6-3 | Item 5: the refusal of a missing note is now the body schema's 422 (no `details.reason: REVISION_REASON_REQUIRED`; the route's own check stays as a second line) | keep the schema optional |
| D6-4 | Item 6 as a unit AFTER the commit, not inside operation 85's unit | in-unit door (`internal-actions.ts`, 71b's binding table) |
| D6-5 | Item 7: the door is called by the capture boot step (one line, row 61), not by `modules/storage` | export `captureBootControl` + a deferred step |
| D6-6 | `rbac-matrix.test.ts`: the model now gets the holder fact read from the database before each call; the INVESTIGATOR column that created the open session passes operation 81 (was "refused" only because of the defect). The static literal `{13, 0, 3}` stays (the table's count without a session) | — |
| D6-8 | Item 10: the measured 503 of a blocked reset is held in the walk, not entered into `NOT_PRODUCED` (that would hide a contract defect) | enter it with the reason |
| D6-9 | Item 12 needs its own row (owner of `session-machine.ts`); this pass built only the Live `reason` | — |
| D6-7 | Edits outside the listed area, each forced by a pin or a type: `C/src/engine/{index.ts (one export),__tests__/static.test.ts,__tests__/hosted-actions.test.ts}`, `C/src/modules/sessions/__tests__/{static,audio-intervals}.test.ts`, `S/src/i18n/en/evidence.ts` (3 values / keys), `S/src/sim/{errors.ts,actions.ts,index.ts}`, `W` / `M` `features/evidence/transcript.ts` (one member) and their tests | — |

## 8. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npx vitest run --root apps/core-server --project db test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | `db-migrate` | 37 of 38 (coverage: `resetDemo 409` only) + 39 of 39; any other red goes back to this pass |
| `npx vitest run --root apps/core-server --project db src/modules/transcripts/__tests__/transcript-routes.db.test.ts src/plugins/permission-guard/__tests__/session-holder.db.test.ts src/engine/__tests__/fact-doors.db.test.ts src/modules/sessions/__tests__/audio-intervals.db.test.ts` | `db-migrate` | green |
| `npm run test -w @dems/shared` | none | green except what other rows announced |
| `npm test -w @dems/core-server` (unit) | none | green except capture static G-R14 (row 140) and the MODG baseline |
| `npm test -w @dems/core-web`; `npx -w apps/mobile jest --maxWorkers=2` | none | attention: any test that sends operation 85 without a note, or pins interval `seq` 0 |

## 9. Device / browser checks for the gate

| Check | Flow | Pass |
|---|---|---|
| M8-REV-NOTE | web + tablet: Revise a segment, leave Reason empty, type 4 characters, then 5 | Save disabled with the rule sentence; enabled at 5; the revision is appended |
| M5-SWITCH-HOLDER | tablet: the INVESTIGATOR who created the session switches the microphone; a second investigator account tries | first: switched; second: "not permitted", one audit row |
| M8-EXP-BUSY (wording) | second export of the same item while one runs | the sentence ends "…then export again." |
