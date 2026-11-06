---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 145
milestone: M3 / AD-03
date: 2026-10-13
agent: coder-execution (batch 6, agent D)
tier: T3
requirement: AD-03 points 2 (returned only after the commit is acknowledged) and 3 (the session in the audit row)
status: complete
---

# Row 145: the credential reader, commit and session

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CC` = `apps/core-server/src/modules/capture-config`.

## What was changed

| File | Change | Description |
|---|---|---|
| `CC/credential-reader.ts` | modify | The camera adapter's two methods take the session: `sessionOpen(deviceId, sessionId)`, `relayRestart(deviceId, sessionId)`. The entry carries it as the audit row's `sessionId`; the details stay two keys. New frozen list `CAPTURE_CREDENTIAL_SESSION_REASONS`. A session's reason without a session id of the right form, and any other reason with a session, is `CAPTURE_CREDENTIAL_REQUEST_INVALID` before any statement. Header text for both points. Nothing of the unit, the commit flag or the opening was changed |
| `CC/__tests__/credential-reader.db.test.ts` | extend | one new block of 6 cases; a third planted trigger on the clone (deferred, waits on an advisory lock); every earlier call of the adapter's methods names a session; the first case now expects the session in the row |
| `CC/__tests__/credential-reader.test.ts` | extend | 2 new cases (a commit that is held; a runner that rejects after the work returned); the session forms; the arity and type pins moved from "device only" to "device and session" |

Not edited: `CC/credential-holders.ts` (the wiring hands the readers on unchanged), `CC/credential-reveal.ts`, `core/audit-details.ts` (the two detail keys are unchanged), the static rule file (R-1 to R-6 pass unchanged), `packages/shared`.

## Point 2: "returned only after the unit's commit is acknowledged"

What was missing: nothing in the code. Row 45's reader takes the commit from `unit.afterCommit`, which the pipeline runs only in its "committed" branch, after `COMMIT` was answered. What was missing was the proof of the moment in between, and of a commit that waits instead of failing at once.

How the commit is made to wait on PostgreSQL: a deferred constraint trigger on `audit_log` of the clone (`row145_commit_hold`). In mode `hold` it asks for an advisory lock that a connection of the test holds, so the `COMMIT` of the reader's unit is sent and does not return. When it gets the lock it refuses the commit if a second key is taken too. The mode lives in the one-row switch of row 45; no trigger of the audit table is dropped or disabled.

| Case (database) | While the COMMIT waits | After | 
|---|---|---|
| held, then let through | read pending; store openings 0; audit rows another connection sees +0; error log +0; checked twice, 400 ms apart, with 1 backend waiting | 1 credential, 1 entry (its session in the row), store opened once |
| held, then refused | the same | `CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED`; 0 credentials, 0 entries, store not asked, 1 error-log code; the pipeline logs `COMMIT_FAILED` once |
| held past the unit's limit (nobody releases) | the same | the reader answers after more than 4 s with `CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED`; 0 credentials, store not asked, 1 error-log code; the pipeline names the end once (`UNIT_TIMEOUT` or `COMMIT_FAILED`); 0 entries after the server side ended |
| control | - | the path works again; the chain verifies |

On doubles (unit test): a runner that holds its commit - the work has returned, 1 statement and 1 appended entry exist, the read is pending and the opener was not asked; and a runner that rejects after the work returned, with and without having run the after-commit tasks - no credential in both, the opener not asked.

Row 45's cases of the same file still pass and cover the rest of the cell: append fails 0/0; commit fails at once 0/0; the store fails to open after the commit 0 credentials, 1 entry, 1 error-log code.

## Point 3: the session in the audit row

| Reason | Session | Entry |
|---|---|---|
| `SESSION_OPEN`, `RELAY_RESTART` | required, `SESSION_ID_PATTERN` | `sessionId` = the session, as a member of the row (`audit_log.session_id`) |
| `CONNECTION_TEST` | none; the method has no parameter for one | no `sessionId` member |

Check of the addendum ("per session, reveal entries with that session equal the cameras of its plan plus relay restarts"), read from the column as the owner: session B with two camera opens and one relay restart gives `SESSION_OPEN` 2, `RELAY_RESTART` 1; session A gives the two reads that committed and nothing of the two that did not; the entries without a session are connection tests only. Every entry has exactly the two detail keys.

## Verification (the row's cell)

| Asked | Where | Result |
|---|---|---|
| commit made to fail: 0 credentials, 0 entries | DB "the COMMIT fails after the append succeeded" (row 45), "a COMMIT that waits and is then REFUSED", "a COMMIT that waits past the time limit" | 0 and 0 in each |
| the store fails to open after the commit: 0 credentials, 1 entry, 1 error-log code | DB "the store cannot open the envelope" (row 45, unchanged) | passes |
| a session reveal carries its session id | DB first case (`row.sessionId`), "AD-03 (3): ..."; unit "every method writes its own reason ..." | passes |

Commands, from `apps/core-server`:

```
npx vitest run --project unit src/modules/capture-config/__tests__/credential-reader.test.ts src/modules/capture-config/__tests__/static.test.ts --maxWorkers=2
  run 1: Test Files 2 passed (2); Tests 33 passed (33)
/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/credential-reader.db.test.ts   (sandbox off)
  run 1: Tests 4 failed | 17 passed (21)
  run 2: 4 failed again (run to read the first failure, which run 1's output had cut; no change between the two)
  run 3: Test Files 1 passed (1); Tests 21 passed (21); "dropped 2 database(s) ...; 0 remain with the run prefix"
npx vitest run --project unit src/modules/capture-config/__tests__/ + six tree-wide static files --maxWorkers=2
  Test Files 1 failed | 12 passed (13); Tests 1 failed | 131 passed (132)   (the one red is not this row's: see below)
npx tsc --noEmit: exit 0, 0 "error TS" lines.   npx oxlint on the five changed files of rows 150 and 145: exit 0
```

The four failures of database runs 1 and 2 were one fault of the test, not of the reader: the helper that starts a read was an `async` function that RETURNED the read's promise, so awaiting the helper waited for the read itself, and the "while it waits" checks ran after the unit's watchdog had ended it. The helper now stores the promise. One run more than the rule allows was used (run 2 changed nothing); it is stated here.

A red seen in a file this row does not own: `apps/core-server/src/modules/capture-config/__tests__/routes.test.ts:59` ("registers operations 76 to 80 ... and nothing else under /capture") finds two more routes, `POST /api/v1/capture/audio-cards/search` and `/inputs`. They come from the new module `src/modules/capture-audio-cards/` and `src/app.ts`, in flight in this batch (row 70). Not edited.

## A finding for the controller (the pipeline, not this row)

In database runs 1 and 2 the faulty test let a read run into the 5 s limit and then released both keys at once. The audit row of that read was then found COMMITTED (`RELAY_RESTART` for session A), although the reader had answered `CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED` and the pipeline had logged the unit as abandoned. Reading: the watchdog closes the connection of a unit whose `COMMIT` is waiting inside the server; the backend does not notice a closed connection while it waits, and the statement limit of the unit (the same 5,000 ms, counted from the start of the `COMMIT`, a few milliseconds later than the watchdog's from the start of the unit) had not yet cancelled it. So for a few milliseconds an abandoned unit can still commit.

- For the reader this is the safe direction: an entry without a credential, never a credential without an entry. The name of the code then says less than happened; the header of the reader states it.
- For the pipeline in general the sentence of `core/errors.ts` on `UNIT_TIMEOUT` ("Nothing of it is committed") does not hold in that window. Any unit can meet it. Not reproduced as a test here: it is a race of milliseconds, and the passing case holds the second key so that the outcome is 0 entries either way. A statement limit below the watchdog's (so that the server ends first) would close it; that is a change of `core/`, outside this row.

## Doubles and what stays unproven

- Database test: no double except the planted triggers. The sessions are texts in the form of a session id; `audit_log.session_id` is no foreign key, and no such session is stored.
- Unproven here: that the session passed is the session of the plan (the callers are rows 46, 85, 89; the reader holds the form only); the count against a real sealed test session with a real plan (row 89's check); a commit that the server completed while its answer was lost on the wire (it gives 0 credentials and 1 entry by the same code path as the runner that rejects after its tasks ran; shown on doubles only).

## Driver decisions

1. DRIVER DECISION: the session is a REQUIRED second parameter of both methods of the camera adapter's reader, not an optional one. Both reasons are a session's; an optional parameter would let a reveal for a session be written without it. Callers do not exist yet (rows 46, 85), so nothing else changed.
2. DRIVER DECISION: the session is checked for its FORM only (`SESSION_ID_PATTERN`), before any statement. That it exists and is open is the caller's fact (the plan); the reader reads no session table.
3. DRIVER DECISION: the session is the row's `sessionId`, not a third detail key: AD-03 (3) names `session_id`, and row 45's cell and the audit writer hold the details to exactly two keys.
4. DRIVER DECISION: the error-log context of a failed read is unchanged (`deviceId`, `reason`, at most `causeCode`, `refusal`): the session is not added, because the pins of rows 45 and 144 hold the key list. If the controller wants the session there for tracing a failed start, it is one member and five pins.
5. DRIVER DECISION: the connection test's reader got no session parameter; a session handed to it anyway is not heard.
6. The causes named in the error log for a commit that failed are the pipeline's `NOT_READY` (its 503 code); the reason (`COMMIT_FAILED`, `UNIT_TIMEOUT`) is in the pipeline's own log line, which the tests read.

## Requests left in `file_requests.md`

Two lines, neither blocking this row: the callers of the reader pass the plan's session (rows 46, 85, 89); the finding on the abandoned unit (the controller, `core/`).

---
*Generated: 2026-10-13*
