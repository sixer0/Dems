---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: coder-execution (row HA, wave 12, track D)
type: Core change - caution R119c-01 of statement 119c (decisions C74, C114 F-1 / F-9, C121, C122)
narrative_tier: 2
baseline: branch task4/input-av-core-port, head 1fbeada7 (uncommitted tree of wave 12)
status: complete
---

# Row HA: a removal the helper answers `NOT_MARKED` is no longer recorded as removed

`J` = `apps/core-server/src/capture/host-alias/journal.ts`, `L` = `.../lifecycle.ts`, `LT` = `.../__tests__/lifecycle.test.ts`,
`LDB` = `.../__tests__/lifecycle.db.test.ts`, `CDB` = `apps/core-server/src/__tests__/capture-composition.db.test.ts`.
The helper is a DOUBLE in every test (a scripted transport); no socket, no process, no `ip`, no host address read or
changed. The helper file `scripts/host/netalias/dems-core-netalias` (SHA-256 3621e79c...) was not opened for writing.

## 1. What, why, how verified

| | |
|---|---|
| **Finding** | R119c-01 (`verification/119c_helper_statement_3621e79c.md:109-111, :200`): with a stored row, a `del` the helper answers `45 NOT_MARKED` was written `HOST_ALIAS_REMOVED`, "Alias address removed" (old `J:225-229`); the row closed |
| **Changed** | `J` result of a REMOVE: `HOST_ALIAS_REMOVED` only for the helper's `OK` (`J:251-256`); `NOT_MARKED` -> row CLOSED + `HOST_ALIAS_REMOVE_FAILED` (`J:258-275`); `L`: `Removal.gone` split into `confirmed` / `settled` (`L:316-336`), `hostHolds` (`L:205-215`), the journal handed the Core's own table (`L:240-246`), `confirmed: false` on the answer (`L:143`, `L:357`) |
| **Verified** | unit `99 passed (99)`; database `11 passed (11)`; composition `15 passed (15)`; acceptance pair 83 passed; static set one red not mine; typecheck 0 errors (section 5). 10 mutants, each red (section 4) |

## 2. The entry now written for `NOT_MARKED`

The closed list of `HOST_ALIAS_REMOVE_FAILED` (`apps/core-server/src/core/audit-details.ts:700-707`) has `failureReason: code(REQUIRED)`:
any `^[A-Z][A-Z0-9_]{0,63}$` code, so the Core's refusal name `HELPER_NOT_MARKED` is ADMITTED. No vocabulary edit.

| Key | Value |
|---|---|
| type | `HOST_ALIAS_REMOVE_FAILED` |
| details | `aliasId` (with a row; absent without), `address`, `removeReason` (the reason the removal was asked with), `failureReason: 'HELPER_NOT_MARKED'`, `operationId` / `permission` (when an operator asked) - nothing else (the database test checks the key set) |
| severity | `WARNING` when the Core's own table shows the address on any interface or cannot be read; `INFO` when it does not show it |
| message | `HOST_ALIAS_NOT_CONFIRMED_MESSAGES` (`J:166-170`): HELD "Alias address not removed: the helper holds no mark of it and the host still holds the address; its kernel lifetime ends it at the latest"; NOT_KNOWN "Removal of the alias address not confirmed: ...; if the address is in place, its kernel lifetime ends it at the latest"; NOT_SHOWN "Removal ... not confirmed by the helper: it holds no mark of it; the host table of the Core does not show the address". None says "removed" or "gone" (a test holds it) |
| lifetime | NOT in the details: the closed list has no member for it - request line (section 6) |
| report | `HOST_ALIAS_REMOVAL_NOT_CONFIRMED { removeReason, hadRow, heldByHost }` to the persistent log when the table shows the address or cannot be read (codes and a boolean; never the address) |

The row-less boot sweep follows the same entry (it already wrote `HOST_ALIAS_REMOVE_FAILED`; its words and severity now
follow the table: the old fixed "No alias address of the Core was there", INFO, said nothing true about a held address).

## 3. Behaviour kept (the security reviewer's safe behaviour, C122)

- The row is CLOSED for `NOT_MARKED` (`store.close`, the same statement), no retry is armed, the timer is disarmed, the next
  `add` is not held back: tested for JOB_DONE, MANUAL, EXPIRED (the timer), SHUTDOWN (every later add is refused by the
  shutdown itself), BOOT_SWEEP.
- The row's `remove_reason` is the reason the removal was asked with; on the path after an add of unknown effect
  (`L:406`) that is `ADD_UNCONFIRMED` - ruling F-9 of C114 KEPT (tested).
- `ok: true, removed: true` to the caller, with the new optional `confirmed: false`. `0 OK` answers stay exactly
  `{ ok: true, removed: true }`.
- A `NOT_MARKED` whose result entry the writer refuses is NOT settled (the intent alone, row open, reported, retry armed).

## 4. Tests and mutations

New: `LT` describe "a removal the helper answers NOT_MARKED is settled and NOT CONFIRMED" - 5 controls (`0 OK` ->
REMOVED, per way), 20 cases (5 ways x 4 readings of the table: not shown, on another interface = F-1's case, on the camera
interface, unreadable; each: one intent + one result, the whole result entry, the row closed with its reason and actor, no
retry, no second line, the answer, the report, the next add), the timer, the add-of-unknown-effect path, the
unrecorded result, the row-less sweep (held / `OK` / not shown), the words. `LDB`: 3 cases on the real writer and table -
release (`OK` control then `NOT_MARKED` held elsewhere) + next add + shutdown; the lifetime timer FIRED (the file's timer
double now records callbacks); the boot sweep with a row and without.

Mutants (planted with Edit in the source, run once, taken out with Edit; counts are failing tests):

| # | Mutation | `LT` (99) | `LDB` (11) |
|---|---|---|---|
| M1 | `J`: `NOT_MARKED` with a row written REMOVED (the old behaviour) | 23 | 3 |
| M1r | `J`: row-less `NOT_MARKED` written REMOVED | 2 | - |
| M2 | `J`: row not closed (code noted on the open row) | 23 | 3 |
| M3 | `L`: `settled` without `notMarked` | 23 | - |
| M4a / M4b | `J`: severity always INFO / always WARNING | 16 / 8 | - |
| M5 | `L`: the report dropped | 16 | - |
| M6 | `L`: `confirmed: false` dropped | 13 | - |
| M7 | `L`: `hostHolds` reads the camera interface only | 5 (F-1's rows) | - |
| M8 | `L`: `notMarked` without "result on record" | 1 | - |

Final state checked free of mutants (grep of the planted texts: 0 lines) before the last runs.

Existing expectations CHANGED (each pinned `HOST_ALIAS_REMOVED` for a `NOT_MARKED` answer):
1. `LT` "a removal the helper answers NOT_MARKED..." (row NF's case): answer `+ confirmed: false`, the type, the second
   tuple's type; title. What row NF pinned (reason of the call, no actor) unchanged.
2. `CDB:715` (C78 DD-2 (b) through the scan: the double never marked the address whose add timed out): the fourth type
   `HOST_ALIAS_REMOVE_FAILED`, plus one line pinning `ADD_UNCONFIRMED` / `HELPER_NOT_MARKED`. File claimed first.
3. `LDB` timer double: `after` now records (behaviour of the existing cases unchanged).
Every other existing test passed unedited.

## 5. Checks (one run each unless said)

| Check | Command (apps/core-server) | Result |
|---|---|---|
| Unit, host-alias + static set + composition unit + 104/105 service | `npx vitest run --project unit --maxWorkers=2 <46 static files> src/capture/host-alias src/__tests__/capture-composition.test.ts src/modules/capture-config/host-alias` | `Test Files 1 failed / 49 passed (50)`, `Tests 1 failed / 1009 passed (1010)`. The red is NOT mine: `src/modules/capture-config/__tests__/static.test.ts:175` R-5 - `src/modules/capture-discovery/adopted-profiles.ts` writes a reveal reason (row PR, in flight) |
| Database, under `.locks/db-migrate.lock` then `.locks/heavy-host.lock` | `npx vitest run --project db --maxWorkers=2 lifecycle.db.test.ts capture-composition.db.test.ts test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | run 1: `1 failed / 108 passed (109)` - `CDB:715` (section 4, item 2); after the change, `CDB` alone: `Tests 15 passed (15)`. So: lifecycle db 11, acceptance pair 83, composition 15, all green; `0 remain` each run |
| Typecheck | `npx tsc --noEmit` | 0 errors (an earlier run showed 4 in capture-discovery / packages/shared, rows PR / V7 in flight; gone at the final run) |

## 6. Requests (delegation_progress/file_requests.md, all non-blocking)

1. `HOST_ALIAS_REMOVE_FAILED` gains `expiresAt: count(OPTIONAL)` (the lifetime has no member); the comment
   `audit-details.ts:701` is untrue for `HELPER_NOT_MARKED` (closed row, `remove_error` NULL).
2. THE STATE SET (`HostAliasStateSchema`, `{ alias | null }`) has no "not confirmed": operation 104 shows the closed row
   as null, 105 answers `{ alias: null }`. LEFT AS IS; requested: a `lastRemoval { confirmed }` member, the service reading
   `confirmed: false`, a ruling on `job-port.ts:97` (answers `DONE`).
3. A ruling whether the TABLE row must carry it (`CLOSE_HOST_ALIAS` clears `remove_error`).

## 7. Driver decisions (for the controller)

a. The row closes with the removal's OWN reason (EXPIRED, MANUAL, JOB_DONE, SHUTDOWN, BOOT_SWEEP; ADD_UNCONFIRMED on its
   path), not `ADD_UNCONFIRMED` for every `NOT_MARKED`: after a recorded `HOST_ALIAS_ADDED` "the add was not confirmed"
   would be untrue; the brief's "keep it" read as "keep F-9's path as is".
b. Severity and words follow the Core's own table (`hostAddresses` and the camera interface's list), as 119c section 4.3
   suggests ("a warning when the Core's own table still shows the address"); unreadable counts as shown (WARNING).
c. `confirmed: false` added to `HostAliasReleased` as an OPTIONAL key (no importer breaks).

## 8. Unproven

That the helper's `NOT_MARKED` and the kernel lifetime behave so on a host (`9A/H-05`, `9A/H-06`); that the Core's
interface table is fresh at the moment of the answer (read right after it, in the result's unit).

Edit tool only for existing files; the two records new with Write. Nothing committed.

---
*Generated: 2026-10-14*
