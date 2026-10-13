---
task_id: 2026-10-12_input_av_core_adapter_plan
row: V6b
date: 2026-10-13
agent: coder-execution (agent V6b, track D)
source: decisions/decisions.md C105 items (5) and (6); verification/119_commissioning_security.md R119-08, R119-09
status: complete (item 1 built with ONE driver decision to confirm; item 2 built)
---

# Row V6b - the clock floor of an acceptance (R119-08, operation 109) and the client that is not armed again (R119-09)

Tier 3 record: statements, file paths and command output. No schema change (pins stay `[13,'dbc-14']`), no file of `packages/shared`, existing files changed with the Edit tool only.

## 1. Item 1 - R119-08 for operation 109: DONE, one driver decision

### What was true before

An acceptance stamped earlier than a stored instant (the revocation of the record before it, or an earlier acceptance) was STORED: no error, a record whose instants are out of order (row V6's request line; the table has no rule for it).

### What is built

`apps/core-server/src/modules/capture-config/installation-acceptance/store.ts`

- The INSERT carries its own condition. Shape, one statement, no separate read:
  `INSERT INTO public.installation_acceptances (...) SELECT $1::bigint, $2::text ... $9::jsonb WHERE NOT EXISTS (SELECT 1 FROM public.installation_acceptances AS stored WHERE stored.accepted_at > $1::bigint OR stored.revoked_at > $1::bigint) RETURNING ...`
- A row answered = written. No row answered = a stored instant is later than `$1` (the clock is behind the record). "One in force" is still 23505 by `installation_acceptances_in_force_key`: the condition does not read `revoked_at IS NULL`.
- `insert` now answers `StoredAcceptance | null` (was: a thrown `InstallationAcceptanceRowError('id')` for no row).
- The equal instant is not "behind" (`>`), as the table's `revoked_at >= accepted_at`.

`.../installation-acceptance/service.ts`

- `row === null`: nothing stored, no audit entry, nothing persisted as a defect, one line at warning level with `code: INSTALLATION_CLOCK_BEHIND_RECORD`, then `409 INVALID_STATE` with `details: { reason }` and no value.

### DRIVER DECISION (to confirm): which reason operation 109 answers

The contract lists `INSTALLATION_CLOCK_BEHIND_RECORD` for operation 110 only (`packages/shared/src/api/installation-acceptance.ts`: the member's comment says "Operation 110"; the 409 text and the examples of `acceptInstallation` name five reasons without it). As briefed, the contract was not edited and the nearest reason of operation 109 is answered: **`INSTALLATION_ACCEPTANCE_IN_FORCE`** (constant `ACCEPT_CLOCK_BEHIND_REASON` in `service.ts`).

This is exact when the later instant is the acceptance in force. It is NOT exact when the later instant is the revocation of an earlier record: none is in force, and the sentence "Revoke it first" misleads the technician (a revocation then answers `INSTALLATION_ACCEPTANCE_NOT_IN_FORCE`). Only the Core's warning line names the true cause. The request line `row V6b` in `delegation_progress/file_requests.md` gives the exact contract member and the one line of the Core that moves after it.

### The static rule: ONE named entry

The rule's words (`__tests__/service.test.ts`): "both statements WRITE, each names the table once, and neither is a question: no SELECT statement exists in the folder", pattern `/\bSELECT\b|\bDELETE\b|\bON CONFLICT\b/` on each statement and `/\bSELECT\b|\bDELETE\b/` on the folder's code. `src/modules/capture-config/__tests__/static.test.ts` names nothing of this folder. The pattern forbids the word anywhere, so the guarded INSERT cannot pass by formatting.

Purpose of the rule (the service header and the test's block title): no statement reads an acceptance so that something could be decided from the answer - a question before a write (a race), or a reader that could gate a recording. Judged MET by the condition: it is part of the one write, its answer goes nowhere but into whether that write happens, it reads the two instants and never "in force", and the folder still exports no reader (the function list of the folder is unchanged, 11 names).

The entry, as the test holds it word for word (`CLOCK_FLOOR_ENTRY`):

`WHERE NOT EXISTS (SELECT 1 FROM public.installation_acceptances AS stored WHERE stored.accepted_at > $1::bigint OR stored.revoked_at > $1::bigint)`

Around it the INSERT must be the write of its nine parameters and read nothing (one naming of the table, one SELECT - the parameter list, no FROM, JOIN, IS NULL). In the folder's code the word SELECT exists exactly twice, both in `store.ts`; DELETE nowhere; the UPDATE's rule is unchanged.

Planted controls (a new case beside the existing positive control), each seen as refused: the INSERT without the entry (two forms, the old VALUES statement among them); a condition that asks `revoked_at IS NULL`; the entry plus such a condition; a second read in the parameter list; the entry twice; a third SELECT in a planted file of the folder.

### Tests

| What | Where | Result |
|---|---|---|
| Clock behind a revocation (none in force): named 409, `details` = `reason` only, rows unchanged, no entry, no failure, the warning line, the INSERT was sent; the equal instant is taken; clock behind an acceptance in force: the same; clock right: the index's answer, no warning line | `service.test.ts`, new case | green |
| The same on PostgreSQL as `dems_app`: the statement answers no row and no error one instant before a stored revocation; through the route 409, the answer valid against the contract (`validateCoreApiResponse('acceptInstallation', 409, ...)`), no instant in the body, no row, no audit row, no line in the persistent error log, the engine not suspended; one in force and the clock behind; the clock past the record: revocation and a normal acceptance as before | `routes.db.test.ts`, new case | green |
| Two acceptances at the same moment, through the route and on two open transactions with the folder's statement: one wins, the other is 23505 by the index | `routes.db.test.ts`, existing cases, unchanged but for a null check of the first row | green |

### Limit, not measured

Under READ COMMITTED the condition is read at the start of the statement. An INSERT that waits at the index behind a concurrent revocation is not asked again: if that revocation carries a later instant, the acceptance is stored one step out of order. This is two requests interleaving on one clock, not a clock that went back; closing it needs a rule of the schema (row V6's request (a)).

## 2. Item 2 - R119-09: DONE

`apps/core-server/src/capture/adapters/camera/onvif-network.ts`, two lines:

- `authorizedAsk`: `if (settled) return ask(call, invoke);` before `arm` - the review's fix. `ask` already answers an ended call at once (no request, the call is not listed), so no result changes.
- `arm`: `if (settled) return;` - the same rule at its root, for the second place that arms (the token form).

Row B1's reply guard (`guardOnvifReplies`, `replyRefused`, `refuseAnswer`) is untouched.

Test, appended by ONE Edit to `__tests__/onvif-network.test.ts` inside the block of the scripted device (the file was re-read first; agent T3 had not changed it): a device that never answers the gateway request, a reboot needed, the call cut by its signal. The client is seen as `this` of the package's own gateway method, wrapped for this case and put back. Control: armed with both values during the call. After the cut and after the package answered its cut request: `username`, `password` undefined, `useWSSecurity` false; the device received three requests and no reboot.

Red before the fix (measured): the client held both values after the cut. Green after it.

The double: the scripted HTTP listener of the test file on 127.0.0.1, a port the system chose. No device of a real network. Unproven on hardware: nothing new (the path sends no request).

## 3. Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| Folder unit test | `npx vitest run --project unit src/modules/capture-config/installation-acceptance/__tests__/service.test.ts --maxWorkers=2` | `Test Files 1 passed (1)`, `Tests 27 passed (27)` (25 before this row; + the clock case and the planted-control case) |
| Folder database test | `lockf .locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 .../installation-acceptance/__tests__/routes.db.test.ts` | first run `1 failed, 15 passed (16)`: the file's last count pin (rows written without an operation, 2) did not know the two rows of the new case; restated by delta. Second run `Test Files 1 passed (1)`, `Tests 16 passed (16)`, `0 remain` |
| Camera adapter unit suite | `npx vitest run --project unit src/capture/adapters/camera --maxWorkers=2` | `Test Files 12 passed (12)`, `Tests 304 passed (304)` |
| Static set and the folder's unit tests | `npx vitest run --project unit test/static src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/modules/capture-config --maxWorkers=2` | `Test Files 32 passed (32)`, `Tests 654 passed (654)` |
| The acceptance pair and the folder's database tests | `lockf .locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts src/modules/capture-config` | `Test Files 2 failed, 8 passed (10)`, `Tests 3 failed, 208 passed (211)`, `0 remain`. None of the three is this row's: (1) `contract.test.ts:655`, the committed `openapi.json` against the generator, byte for byte - `packages/shared` is being written by agent R1b; (2), (3) `camera-adapter-open.db.test.ts:548` and `:564`, the lines "Row T3 (X-07)" (`inEnvironmentListing` expected true, read false) - agent T3's control of the process listing. Not run a second time |
| Typecheck | `npx tsc --noEmit` | exit 0 |

MISTAKE OF THIS ROW, stated: the last database command took the folder `src/modules/capture-config`, which holds `camera-adapter-open.db.test.ts` - a file that starts the real relay and the capture worker. It ran under the database lock but WITHOUT `.locks/heavy-host.lock`. It ended by itself; no process was left.

## 4. Files

| File | Change |
|---|---|
| `apps/core-server/src/modules/capture-config/installation-acceptance/store.ts` | modify: the INSERT's condition, `INSERT_CLOCK_FLOOR`, `insert` answers null |
| `.../installation-acceptance/service.ts` | modify: the refusal, the warning line, `ACCEPT_CLOCK_BEHIND_REASON`, header |
| `.../installation-acceptance/__tests__/service.test.ts` | modify: the double's condition, one case, the static rule's entry, one planted-control case |
| `.../installation-acceptance/__tests__/routes.db.test.ts` | modify: one case, a null check, two count pins by delta |
| `apps/core-server/src/capture/adapters/camera/onvif-network.ts` | modify: two lines |
| `apps/core-server/src/capture/adapters/camera/__tests__/onvif-network.test.ts` | modify: one appended case |
| `delegation_progress/file_claims.md`, `file_requests.md` | one line each |

## 5. Requests left

- `row V6b` in `file_requests.md`: the contract member for operation 109 (`INSTALLATION_CLOCK_BEHIND_RECORD`), then one constant of the Core. Not blocking.
