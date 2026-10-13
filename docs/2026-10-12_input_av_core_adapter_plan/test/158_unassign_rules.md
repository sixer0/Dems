---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 158
milestone: M2 / WP-13a
date: 2026-10-13
agent: coder-execution (batch 7, agent S; the row's agent type is test-expert)
tier: T2
requirement: AD-10 of verification/04_security_addendum.md (section 3.3 (c)); names register `decisions/161_selector_names_register.md` 4.1 (E1, E8, E9, E10), 4.3, 4.4; decisions C18, C21 (6), C25
status: complete (tests only; no production file changed)
---

# Row 158: tests of the `unassign` rules of operation 78

## 1. Subject, and why these tests

**What.** Operation 78 (`updateCaptureConfig`) gained the member `unassign` in rows 28, 162 and 29: a selector slot can be cleared. AD-10 states five rules for it. Row 29 built the server half and tested most of it; this row adds what was left, on PostgreSQL as the runtime role.

**Who is affected.** SUPERVISOR and TECHNICIAN (the holders of `CAPTURE_CONFIG`), on the web console and on a paired tablet or phone; the investigator whose session must not lose a source; the reader of the audit trail.

**Method.** Five new cases (six with the `it.each`) in the existing file `apps/core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts`, as a fourth block inside row 29's `describe` so that its helpers are reused and nothing is duplicated. Each case runs the real app on a throw-away clone of the seed; what is stored is read as the owner.

## 2. What row 29 already holds (not repeated)

| Rule | Where row 29 holds it |
|---|---|
| AD-10 (1) one row per cleared slot, 0 for an empty slot | `routes.test.ts` (unit, per slot) and `capture-config.db.test.ts` block 2 (PostgreSQL, web console session of the TECHNICIAN) |
| AD-10 (2) the lock | `routes.test.ts`: 8 states x 5 bodies on the simulator double (states set by hand); PostgreSQL: CREATE and RECORDING only |
| AD-10 (3) one slot cleared and filled in one body | `routes.test.ts` (schema forms and the action's form), not on PostgreSQL |
| AD-10 (4) `SELECTOR_SHAPE` for an incomplete selector | `plan.test.ts` "AD-10 (4), C25": 15 of 15 incomplete selectors, S-5 (three slots assigned, the STANDBY not) by name, in three operations |
| AD-10 (5) the registry entry | `routes.test.ts`: the guard's rule; without a database the refusal is not the product's answer |

## 3. What this row adds

| # | Case | Rule | What is held, with evidence of the run |
|---|---|---|---|
| 1 | every client kind and role against the access members of the contract | AD-10 (5), (1) | The contract's access of operation 78 is `{ kind: PERMISSION, permission: CAPTURE_CONFIG }` with NO `conditions` member. Expected outcome per cell is COMPUTED from that and from `ROLE_PERMISSIONS`, then compared with the product: 3 roles x 2 kinds of operator session (web console; session of a paired device) = 6 cells: `INVESTIGATOR 403` twice, `SUPERVISOR 200` and `TECHNICIAN 200` twice. A refused cell: `403 NOT_PERMITTED`, ONE `ACCESS_DENIED` row `{ operationId, permission, role }` by the caller, from its device. An allowed cell clears one slot, so the four allowed cells clear the four slots: per slot ONE stored `CAPTURE_CONFIG_CHANGED` row, by the caller, `device_id` the sending device (null for the web console), details exactly `{ operationId, scope, field: 'SOURCE', trackId or inputId, from, permission }`, every key held to `detailRulesOf('CAPTURE_CONFIG_CHANGED')`, no `to`, no `deviceId`. Then the callers that are no operator, against a slot that holds a source: no credential `401 NOT_SIGNED_IN`, a device credential without an operator session `401 NOT_SIGNED_IN`, both 0 rows; a retired device `403 DEVICE_REVOKED` with ONE `ACCESS_DENIED` row `{ operationId, reason: 'DEVICE_REVOKED' }`; nothing stored; the chain links and verifies |
| 2 | the lock table on PostgreSQL | AD-10 (2) | A REAL session is taken through every state by the product's own commands and timer: `CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING` on the clean path (the exact list the watch saw), `FAULT, RECOVERY` after an injected power failure. In each state, 5 bodies (each slot, and all four): all `409 CAPTURE_CONFIG_LOCKED`, the answer valid for the contract, the trail the same length (no row of any type), the stored row the seeded one, the selector object unchanged. The set of states reached equals every member of `SessionState` but `SEALED` (8 of 8). Controls: with no session and with a SEALED session the same call is `200` with one row |
| 3 | one slot cleared and filled in one body, on PostgreSQL | AD-10 (3) | Three bodies (the track of a camera line; the role of a mic line; the form only the action sees, `details.reason: SLOT_UNASSIGNED_AND_ASSIGNED`): all `422 INVALID_INPUT`, trail unchanged, stored row seeded, stored slices = committed state (the refused unit left nothing). Control: the same clear and the same assignment as two calls are accepted, 2 rows |
| 4 | an unassign against a session that is being opened | the race | 8 rounds; the request is sent first, the session is created 0, 1, 2, 4, 8, 16, 32 turns of the event loop later, and in the last round after the answer. WHO WINS: the unit of the engine that commits first - the lock is read inside the unit of the edit (`routes.ts`, `isSessionActive(before.session)` on `scope.pending()`), and the engine runs one unit at a time. Round 1 (same turn): the SESSION wins. Last round: the UNASSIGN wins. WHAT THE LOSER GETS: a losing unassign is `409 CAPTURE_CONFIG_LOCKED`, 0 rows, nothing stored, and the session holds both cameras; a losing session is still opened (an edit never refuses a session), on the selector WITHOUT the slot, with the `CAPTURE_CONFIG_CHANGED` row before `SESSION_CREATED` in the trail. In every round stored slices = committed state. No round shows a session whose snapshot holds a source the stored selector lost |
| 5, 6 | an unassign against the START of an armed session, either call first | the race | The session holds the lock from its creation, so the unassign is `409` with 0 rows in both orders; the session reaches `RECORDING` with its 2 cameras and 2 microphones; the stored row is the seeded one |

## 4. Run evidence (this Mac, PostgreSQL 18.4, throw-away databases, `.locks/db-migrate.lock`, sandbox off)

| Command | Result line |
|---|---|
| `npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/capture-config.db.test.ts` | run 1: `Test Files 1 passed (1)`, `Tests 31 passed (31)` (25 before, 6 new), `0 remain with the run prefix`. Run 2, after ONE edit that only hands the log of case 1 to a captured stream (it printed to the run's output): `Tests 31 passed (31)`, `0 remain` |
| `npx vitest run --project unit --maxWorkers=2` on `src/capture-session src/capture-notices src/modules/capture-config src/capture/fence`, the two capture static files and `test/static` | `Test Files 37 passed (37)`, `Tests 573 passed (573)` |
| `npx tsc --noEmit` in `apps/core-server` (last, after rows 71, 30, 158) | no error |
| `npx oxlint` on the changed files | exit 0 |

## 5. Rationale and alternatives

| Choice | Why | Alternative not taken |
|---|---|---|
| Case 1 replaces stage 4 only (it hands out the principal of each client kind) and keeps stage 6, the handler, the engine and the trail real | the subject is the ACCESS rule; without a database the guard cannot write its row and does not answer 403 (row 29's unit case says so). A device session through the product's pairing and bearer sign-in would test the pairing module | a full pairing per client kind |
| Case 2 walks a real session instead of setting the state by hand | row 29's unit table already sets states by hand; what was unproven is that the product reaches each state with the lock intact | repeating the unit table on PostgreSQL |
| Case 4 asserts the winner only in the first and the last round | between them the winner depends on how long the request's stages take (a session read in PostgreSQL); every round is held to the rules of whichever won, so no outcome is unasserted | a fixed winner per round (would be a timing test) |
| Simulated mode for cases 2 to 6 | the lock and the audit rules do not depend on the capture operation, and a Simulated session reaches every state without a worker | a real-capture rig with a fake worker |

## 6. Assumptions, gaps, unproven

- The loser session of case 4 in REAL capture: its pre-check says BLOCK for the cleared slot (row 30, held at a booted `REAL_DEVELOPMENT` Core) and its start is refused by the shared machine (row 163, shared tests). The refused start at a Core in real capture with its `details.reason`, worker started 0 times, is row 33's 21-state table, not run here.
- A tablet and a phone are one client kind for the access rule: the principal carries a paired device id and no platform. The two are not told apart by any rule of operation 78.
- `SELECTOR_SHAPE` for S-5 is cited from row 29's `plan.test.ts`, not repeated.
- Nothing of this row goes to the hardware package.

## 7. Identifiers

Closed by test: AD-10 (2) on PostgreSQL for 8 of 8 states; AD-10 (5) as a measured decision (no client-kind condition; both kinds of operator session); AD-10 (1) per slot and per client kind on stored rows; AD-10 (3) on PostgreSQL; the race of an unassign with a session. Left as it was: AD-10 (4) (row 29, row 33).
