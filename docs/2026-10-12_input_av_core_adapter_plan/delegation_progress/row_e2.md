# Row E2 (wave 12, agent E2) - camera adapter, findings E-02 / E-03 / E-04 / E-05 of review 60e

Status: **complete on doubles**; the adapter's database suites not run (db-migrate lock held through two bounded waits). Record: `implementation/e2_camera_adapter_review_fixes.md`.

| Finding | State |
|---|---|
| E-04 | DONE in `camera/onvif-relay.ts`. Choice: hand on, under the number that was TOLD. A re-open of a later relay number ends the told absence as `REOPENED { loss: <told>, through: <relay's> }`; a re-open whose loss line never arrived is handed on as `LOST { cause: 'LOSS_NOT_TOLD' }` then `REOPENED`, in one turn; a late or repeated re-open is dropped and the fault stands. The session's number match works again without a session change; wording request to row E3 |
| E-02 | REQUIRED now: `relayEnded`, `admitHwAddress`, `sourceAddress` of the session's `test` / `locate` / `exchange` (stated as `string \| undefined`). Each has a named refusal for a caller the type did not hold. WAITS: `candidateSource` (`connect/service.ts`, not this row's file) - request line |
| E-03 | DONE in `camera/camera-watch.ts`: `captureEnded()` and the same boundary by itself at the first established push of another session. WAITS: the composition's call (row 88) - request line |
| E-05 | DONE: the two lines in `camera/onvif-session.ts` |

Checks: unit set `Test Files 47 passed (47)`, `Tests 1012 passed (1012)` (second run; the first had 3 reds of my own tests); `tsc --noEmit` 0 errors. Mutants: 11, 10 seen RED, 1 stated as not killable (the `authorizedAsk` line of E-05).

ADDENDUM (after PostgreSQL was started): database suites run - relay files (`camera-adapter-open.db`, `adopted-camera-test.db`, `stream-test.db`, `minted-code.db`) `Test Files 4 passed (4)`, `Tests 50 passed (50)`; `connect.db`, `capture-composition.db`, `camera-network/routes.db` `Tests 1 failed | 46 passed (47)` - the red is the schema-version case of `connect.db.test.ts` (`[14, 'dbc-15'] = [13, 'dbc-14']`), not this row's. Typecheck now 2 errors, both in agent PR's in-flight files (`adopted-camera-test.db.test.ts:277`, `adopted-test.test.ts:56`). The `authorizedAsk` line of E-05 has its test now (a source pin of both copies, red on the mutant without the line): 11 mutants, 11 red.

Requests left (3, none blocking): row E3 (session wording for the two repaired reports); row 88 (`captureEnded` wiring; who reads `lost()`); the connect flow's owner and row 88 (`candidateSource` required, plus three members of the same family).

Driver decisions to confirm: `through` and `LOSS_NOT_TOLD` added to `CameraLegReport`; four lines in `adapters/__tests__/real.test.ts` (outside the camera folder, needed to compile); the watch asks its own faults away at the boundary instead of only forgetting them; `onvif-session.test.ts` states the source address once in two helpers, not at 76 call sites.

Edit tool only for every existing file. Nothing committed. No device, no relay, no C, no binary rebuilt.
