---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 56 (plan W34, sessions module, operations 24 to 38)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 56 (W34, the sessions module)

Status: **complete** (15:40; gate PASS, decision D94), and the follow-up of that gate (one error
precedence) **complete** (17:22): see "Follow-up" at the end of this file, which supersedes the
figures and the stop-reason statements below. Full record: `implementation/34_module_sessions.md`
(the follow-up is its section 18); runner output of the final runs:
`implementation/assets/34_gate.log` (first gate) and `implementation/assets/34_followup_gate.log`;
the mutation log: `implementation/assets/34_mutations.log`. All times WIB. No credential, token,
hash or password is in this file.

## What exists now

- `apps/core-server/src/modules/sessions/`: six production files (787 lines) and nine files
  under `__tests__/`. The stub `index.ts` is replaced; the export `sessionsModule` keeps its name.
- Operations 24 to 38 of the registry, each registered from its registry entry with the
  registry's schemas: thirteen commands, each the shared simulator's own hosted action run as the
  caller in one unit of the engine host and answered after the commit with the two headers of
  API-7; `getCurrentSession` from the engine's committed state; `listSessionHistory` from
  PostgreSQL by a keyset page.
- The `{id}` of a path is compared with the open session INSIDE the unit that runs the action
  (404 otherwise); the composite start of the design book runs in one unit, with the
  acknowledgement and the start together when warnings are acknowledged; a stop reason the schema
  stage refused for its length answers 422 `INVALID_REASON`.
- The module checks nobody's permission, writes no row of its own and owns no table.

## Verification (runner output quoted in `34_module_sessions.md`, sections 4 to 10, and in `assets/34_gate.log`)

| Check | Result |
|---|---|
| Row tests, `unit` | 3 files, 141 tests, exit 0 (15:36:39) |
| Row tests, `db`, `DEMS_TEST_STEP=56` | 4 files, 41 tests, exit 0; 0 databases remain with the run prefix (15:36:42) |
| MODG | Route list = registry (15 = 15, printed); every documented status of the 15 operations produced and validated against the contract; one allowed and one refused call per operation; a static test of rule M3 for the folder |
| AC-B-49 | 40 rounds of two simultaneous creates: 40 x (201, 409 `SESSION_ACTIVE`); equal input 20 x (201, 200 `created: false`); eight at once: one 201, seven 409 |
| AC-B-50 | A stop by another operator with a reason of five characters: 202, `RECORDING_STOPPED` names that operator; four characters: 422 `INVALID_REASON`, no row |
| The journey and the recovery | 18 steps through HTTP against PostgreSQL with the audit sequence equal to the shared simulator's; the recovery after a restart fault |
| Whole `unit` project | 102 files, 2,661 tests, exit 0 (15:37:02) |
| Whole `db` project | 75 files, 1,081 tests, exit 0; forced drops that needed a retry: 0; 0 databases remain with the run prefix (15:37:37) |
| Typecheck, lint | Exit 0 (15:39:23); exit 0 with no warning (15:39:29) |
| Mutation check | 62 of 62 detected (54 on a scratch copy; 8 against PostgreSQL through a transform) |
| PostgreSQL | `.locks/postgres.pid` 19121; no database with this row's prefix remains (15:39:40) |

## Findings (details in section 13 of the document)

- F-1: "pause" and "resume", named in the brief's journey, do not exist in the specification,
  the contract or the simulator. Nothing was built.
- F-2: no "cancel reason": `cancelSession` has no body.
- F-3: `session_history` has no `seq`; the list pages by the keyset `(ended_at DESC, id DESC)`.
- F-5: a POST of an operator carries the identity module's activity unit (5 statements) before
  the engine's unit (11 statements) whenever the server clock moved since that operator's last POST.
- F-7: a short stop reason is answered before 404 and 409 (decision D50); the simulator's REST
  layer looks at the session first.
- F-9, `SIM-GAP-W34-1`: the recording time of a faulted session keeps counting
  (`selectElapsedMs` ends at `stoppedAt` or the clock; a faulted session has no `stoppedAt`).
- F-10, `CONTRACT-GAP-W34-1`: `details.sessionId` on 409 `SESSION_ACTIVE` is sent and read by the
  Live binding; the contract does not name it.
- F-13: on a Core with no paired tablet connected every pre-check ends with a block ("Core link
  offline"), so no recording can be started, also from the web console: the simulator's `CORE`
  check together with spec §6.8. The tests set the link CONNECTED as the realtime channel will.
- F-15: the folder's database tests needed more than Vitest's five seconds per test on the loaded
  host; the four files now set 120 s per test and 180 s per hook. No assertion changed.
- `CONTRACT-GAP-W34-2` (the 422 codes of `stopSession`), `CONTRACT-GAP-W34-3` (example texts of
  404 and 409 quote the request's session ID; the server's texts are fixed).

## Deviations

- DV-1: ten operations use `app.engine.run` with one hosted action (the ID check must be in the
  unit); the row text says `app.engine.command`.
- DV-2: the `state` of a command's answer is the state the action leaves, as the contract names
  it; for a replayed create it is read from the committed state.
- DV-3: the module imports `db/schema` and `db/mapping` for the history read (one mapping).
- DV-5: eight mutations of `history.ts` ran in place from 15:04:51 to 15:06:36, before rule M15;
  the file was restored (SHA-256 equal), the controller was told, and they were re-run through a
  transform with no change to the tree.
- DV-6: the journey has no pause and no resume step.
- DV-7: process notes (one `cd` into the workspace root itself; two script edits of own test
  files; a one-off script moved out of the folder).

## Decisions needed (section 13 of the document)

DN-1 the in-unit ID check; DN-2 the order of the stop's refusals; DN-3 which bodies are
`INVALID_REASON`; DN-4 `details.sessionId`; DN-5 `SIM-GAP-W34-1`; DN-6 pause and resume; DN-7 the
keyset cursor; DN-8 the tablet link (for W42, and whether a web-only Core may start a recording); DN-9 the texts of the refusals; DN-10 notes for W47
and W52; DN-11 a malformed `{id}` answers 422.

## Other rows

- Rule M10, decision D85: three test files of the guard row failed by design once module routes
  were registered. Reported at 14:36 with file, line and failure text; none was edited here; green
  in the whole runs from 15:06 on.
- Noise seen and named (P11): 14:32 and 14:33 typecheck error and a lint warning in
  `src/modules/admin/__tests__/`; 14:57 a typecheck error in `src/modules/storage/index.ts`. All
  gone at the final runs.

## Files

Created or replaced:

- `apps/core-server/src/modules/sessions/index.ts` (replaces the stub)
- `apps/core-server/src/modules/sessions/operations.ts`
- `apps/core-server/src/modules/sessions/routes.ts`
- `apps/core-server/src/modules/sessions/refusals.ts`
- `apps/core-server/src/modules/sessions/current.ts`
- `apps/core-server/src/modules/sessions/history.ts`
- `apps/core-server/src/modules/sessions/__tests__/routes.test.ts`
- `apps/core-server/src/modules/sessions/__tests__/pure.test.ts`
- `apps/core-server/src/modules/sessions/__tests__/static.test.ts`
- `apps/core-server/src/modules/sessions/__tests__/journey.db.test.ts`
- `apps/core-server/src/modules/sessions/__tests__/concurrency.db.test.ts`
- `apps/core-server/src/modules/sessions/__tests__/operations.db.test.ts`
- `apps/core-server/src/modules/sessions/__tests__/history.db.test.ts`
- `apps/core-server/src/modules/sessions/__tests__/support.ts`
- `apps/core-server/src/modules/sessions/__tests__/memory-engine.ts`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/34_module_sessions.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/34_gate.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/34_mutations.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_56.md`
- `.cache/rollback/W34.sessions.index.ts.pre` (pre-image of the stub)

Not written (parallel run, P8): `masterplan/02_plan.md`, `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md`.

## Rollback (R-NEW; not executed)

`cp .cache/rollback/W34.sessions.index.ts.pre apps/core-server/src/modules/sessions/index.ts`,
then remove the other five production files and `__tests__/` of the folder. No database,
migration, contract or dependency change is to be undone.

## Follow-up: one error precedence (decision D94), complete at 17:22

Ruling: DN-2 was not accepted as built. A reason that is absent or too short is business
validation, answered in the order the hosted action checks it (spec §7.3 line 10): 404, then 409,
then 422 `INVALID_REASON`; the shape of the body stays the schema stage's (line 8).

### What was changed (only `apps/core-server/src/modules/sessions/**`)

- `text-body.ts` (new): `readTextBody(schema, member, body)` reads a body with the contract's
  schema as VALID, TEXT_MISSING (only the lower bound of the one text member) or INVALID; `NO_TEXT`
  is the empty text the hosted action gets in place of a missing one. The approach of the evidence
  module's `export-request.ts` (decision D92), not its file.
- `routes.ts`: `stopSession` and `addSessionNote` have no route body schema and no
  `attachValidation`; the handler answers INVALID with 422 `INVALID_INPUT` before the engine and
  hands the action the parsed text or `NO_TEXT` inside the unit that first compares the `{id}`
  with the open session. The refused text never reaches the engine.
- `operations.ts`: `bodySchemaOf` (the schema applied in a handler is the registry's own object).
- `refusals.ts`, `index.ts`: the module answers no `INVALID_REASON` itself; three functions
  removed (nothing outside the folder used them).

Operations with the pattern "the schema bounds a body member from below AND the hosted action
checks it": **`stopSession` (`reason`)** and **`addSessionNote` (`text`)**, both changed. Not the
pattern: `createSession` (the action validates before it looks for an open session, as stage 7
does; asserted against the simulator), `startSession` (no bound), `addSessionMarker` (an empty
label is valid).

### Verification (quoted in section 18.7 of the document and in `assets/34_followup_gate.log`)

| Check | Result |
|---|---|
| Row tests, `unit` | 3 files, 168 tests, exit 0 (17:18:33) |
| Row tests, `db`, `DEMS_TEST_STEP=56b` | 4 files, 42 tests, exit 0; 0 databases remain with the run prefix (17:18:35) |
| The order against the simulator's REST layer | In nine states of the Core, four bodies with an absent or too-short reason: 404 for a session that is not open, 409 for one that is not recording, 422 `INVALID_REASON` on a recording; status and code equal to `sim.request` each time. The same through the real stages against PostgreSQL, with nothing stored |
| Typecheck, lint | Exit 0 (17:21:02); exit 0 with no warning (17:21:06) |
| ONE whole `unit` run (17:18:59) | 139 of 140 files, 3,565 tests passed; the one red is another row's: `src/db/fixtures/__tests__/audit-details.test.ts:67` `TypeError: simulatorAuditRows is not a function` (file being edited, modified 17:21:13); alone at 17:21:31 it passes (35 tests) |
| ONE whole `db` run (17:19:24) | 107 of 108 files, 1,538 tests passed; the one red is another row's: `src/modules/pairing/__tests__/secrets.db.test.ts:319` "rule M14: the two failing statements are in the log …" (file modified 17:18:53); alone at 17:21:33 it passes (11 tests). Forced drops that needed a retry: 1 (it went through); 0 databases remain with the run prefix |
| Mutation re-run (rule M15: a scratch copy under the temp directory) | 72 of 72 detected, 25 of them on the changed handlers, the body reader and `bodySchemaOf`; the old order (a short reason before the session) fails 20 tests |
| PostgreSQL | `.locks/postgres.pid` 19121; no database with the prefix `dems_test_step_56b_` or `dems_test_step_56_` remains (17:21:56) |

### Observable changes

- `stopSession`, reason absent or too short: 404 on a session that is not open and 409 on an open
  one that is not recording (both were 422 `INVALID_REASON`); on a recording still 422
  `INVALID_REASON`, now from the hosted action (the engine host's text; `details` name `from` and
  `event` beside `simCode`), at the cost of one rolled-back unit.
- `stopSession`, a reason that is `null` or not text: 422 `INVALID_INPUT` (was `INVALID_REASON`).
- `addSessionNote`, text absent or empty: 404, 409, then 422 `INVALID_INPUT` with
  `details.simCode: NOTE_INVALID` (was 422 `INVALID_INPUT`, `in: body`, before 404 and 409).
- Nothing else: the acceptance test in flight sends a valid note and a valid reason.

### Findings and decisions of the follow-up (section 18.9 of the document)

- FU-1 / FU-DN-1: DN-3 (marked accepted: "absent or no text is `INVALID_REASON`") and the ruling
  ("a reason that is not text" is line 8) disagree on a non-text reason. The ruling was followed.
  One condition in `text-body.ts` changes it back if DN-3 was meant to stand.
- FU-2: the contract's example text for `INVALID_REASON` is the simulator REST layer's; it joins
  `CONTRACT-GAP-W34-3`.
- FU-3: `CONTRACT-GAP-W34-2` stays as reported.
- FU-4: a short-reason stop on a recording costs one unit now and counts in `commandsRefused`.
- FU-5 / FU-DN-2: three two-unit characters are too short for the contract (characters) and long
  enough for the simulator (code units); the server follows the contract.
- FU-DV-1: two routes without `schema.body` (rule M2), as the evidence module's DV-3.
- FU-DV-3: no pre-image of the first gate's files was saved before the follow-up edits (a
  single-writer folder; the row's rollback is unchanged).
- Noise named (P11): the two reds above; typecheck at 17:11 and 17:13 red in
  `test/acceptance/restart.test.ts` (1105 and 1107), gone at 17:21.

### Files of the follow-up

Created: `apps/core-server/src/modules/sessions/text-body.ts`;
`docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/34_followup_gate.log`.

Updated: `apps/core-server/src/modules/sessions/routes.ts`, `refusals.ts`, `operations.ts`,
`index.ts`; `__tests__/routes.test.ts`, `__tests__/pure.test.ts`, `__tests__/static.test.ts`,
`__tests__/journey.db.test.ts`, `__tests__/operations.db.test.ts`;
`implementation/34_module_sessions.md` (section 18 appended; notes at the superseded passages);
`implementation/assets/34_mutations.log` (one block appended); this file.

Not touched: `__tests__/support.ts` (imported by the acceptance test), `history.ts`, `current.ts`,
anything outside the folder.
