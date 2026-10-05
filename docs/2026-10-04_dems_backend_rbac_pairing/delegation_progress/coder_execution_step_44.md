---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution
blueprint_row: 44
plan_row: W22 (contract B; contract-owner slot, P17)
date: 2026-10-04
status: complete
output_document: implementation/22_contract_b.md
---

# Progress: step 44 (W22, contract B)

Status: **complete**. Every verification command of the row exits 0. One finding needs a controller
ruling (SIM-GAP-1, below); it does not block the rows that consume this contract.

## Milestones (WIB; from file timestamps and the logs, so the early ones are to within a few minutes)

| Time | Milestone |
|---|---|
| 08:48 | Pre-image saved before the first edit: `.cache/rollback/W22.pre.patch` (76,172 bytes), plus `W22.pre.untracked.tar` and `W22.pre.hashes` because contract A's new files are untracked |
| 08:48 | State at the start recorded: shared 785 tests, 1 failed (`client-core.test.ts:118`); shared typecheck exit 2 (`client-types.test.ts:123`). Both are the typed-client row's; its owner saved both files at 08:51 |
| 08:55 | The real shapes read from 52 simulator states (scenarios and driven journeys) before any schema was written |
| 09:00 | `state-slices.ts`: 28 slice schemas, `AudioSlice`, `ReplicatedState`. 1,456 slice parses of the 52 states: no refusal |
| 09:06 | `realtime-messages.ts`: the union of nine server messages, three client messages, value sets, close codes, the catalogue. The heartbeat interface and schema byte-equal to `acaff20` |
| 09:09 | Registered in `CORE_API_SCHEMAS` (50 to 98); examples; the Core server section of the Realtime tag in the `all` scope |
| 09:13 | `api-state-slices.test.ts` green (99 tests) |
| 09:17 | `api-realtime.test.ts` green (74 tests); shared 977 of 977 |
| 09:21 | First mutation run on an isolated copy: 38 of 38 detected. It showed that the type proofs did not see a forgotten optional member; member-name proofs added |
| 09:25 | Finding F-1 reproduced with the real simulator; slice text taken as the engine holds it |
| 09:28 | Final mutation run on the final code: 40 of 40 detected |
| 09:29-09:31 | Gate on the finished tree: `implementation/assets/22_gate.log` |
| 09:40 | `implementation/22_contract_b.md` written; rollback recipe tested in a scratch directory |

## Files created or updated

Code, changed: `packages/shared/src/api/realtime-messages.ts`, `core-api.ts`, `openapi.ts`,
`constants.ts`, `patterns.ts`, `index.ts`; `packages/shared/test/api-registry.test.ts`.

Code, new: `packages/shared/src/api/state-slices.ts`, `packages/shared/src/api/realtime-examples.ts`,
`packages/shared/test/api-state-slices.test.ts`, `packages/shared/test/api-realtime.test.ts`.

Documents: `implementation/22_contract_b.md`; this file;
`implementation/assets/22_gate.log`, `22_mutations.log`, `22_mutate.py`,
`22_changes_to_existing_files.diff`, `22_realtime_tag_all_scope.md`,
`22_finding_f1_reproduction.ts`, `22_finding_f1_output.txt`.

Git-ignored: `.cache/rollback/W22.{pre,post}.patch`, `W22.{pre,post}.untracked.{list,tar}`,
`W22.pre.hashes`; `.cache/W22/` (the isolated copy for the mutation runs, the rebuilt pre-image).

Not written: `openapi.json`, `gen-openapi.ts`, `openapi.test.ts`, `schemas.test.ts`,
`sim-api-validation.test.ts` (their `git hash-object` equals the value saved at the start); anything
under `packages/shared/src/sim`, `src/client`, `src/live`, `src/realtime`; any `package.json`;
anything in `apps/`; `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`.

## Processes

None left running. No port was bound, no database used, no emulator touched, no npm install.

## Blockers

None.

## For the controller to record (detail: `implementation/22_contract_b.md` section 10)

Findings:

- **F-1, SIM-GAP-1 (needs a ruling).** The simulator cuts three texts by UTF-16 code units
  (`sim/session-machine.ts:1102`; `sim/evidence-actions.ts:158` and `:275`). A surrogate pair at the
  cut is split, so input that passes API-13 leaves ill-formed text in the state: in the timeline
  entry of a long note, and in `details.destination` of an `EVIDENCE_EXPORTED` or `AUDIT_EXPORTED`
  audit row, which is part of the hashed body. Reproduced with the real simulator. What PostgreSQL
  does with it was not run here.
- F-2. `Exact` (mutual assignability) does not see a missing optional member; a member-name proof
  was added. Contract A's four proofs were checked the same way and hold.
- F-3. A parsed slice has the schema's member order, not the engine's: equal content, different
  serialised text.
- F-4. `heartbeat.serverTime` is ISO-8601; every new time on the socket is epoch milliseconds.
- F-5. The heartbeat is the one message that is not strict (as released).
- F-6. The released heartbeat client now ignores a message that is not a heartbeat instead of
  reporting it, on a Core-server socket only.
- F-7. `session.ended.reason` has six values; the two stored device reasons are told by
  `device.revoked`.
- F-8. The simulator does not check a fault kind at run time; the contract's request schema does.
- F-9. A snapshot of the recording scenario is 194,670 bytes; a `replace` of `health` is 19.5 kB.

Deviations: DR-1 48 named schemas were registered, not 28; DR-2 the socket is documented in the
`all` scope; DR-3 three constants and one pattern added; DR-4 the report, plan and status files of
the agent template were not written (parallel run); DR-5 mutation runs on an isolated copy; DR-6 a
slice does not carry the text rule API-13.

Decisions: DN-0 who closes SIM-GAP-1 (recommended: cut on a code-point boundary in the simulator,
which needs a scheduled slot); DN-1 strict objects in every slice and every new message; DN-2 slice
text without API-13 until SIM-GAP-1 is closed; DN-3 the member names of a delta operation; DN-4 the
values of `hello.reason` and the form of `connectionId`; DN-5 client messages carry no `v`; DN-6 a
delta has at least one operation; DN-7 component names; DN-8 the existing union name is widened.

One existing assertion edited by design: `packages/shared/test/api-registry.test.ts:345` and `:359`
(the schema count 50 becomes 98).

Test ledger: shared 785 (1 failed, not this row's) to 977 passed in 46 files; +173 are this row's
in two new files, +19 are the typed-client row's. core-web 438, mobile 833: unchanged.
