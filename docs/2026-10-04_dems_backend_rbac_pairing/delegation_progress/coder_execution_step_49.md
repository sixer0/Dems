---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution
blueprint_row: 49
plan_row: W27 (contract C; contract-owner slot, P17)
date: 2026-10-04
status: needs-review
status_note: step 49 itself passed its gate (D64, closed by D69); the status is the one of the follow-up D113, see the last section
output_document: implementation/27_contract_c.md
---

# Progress: step 49 (W27, contract C)

Status: **needs-review**. The contract is written, in the tree and verified: 75 operations (27 GET,
48 POST), the committed `openapi.json` in the scope `all` with two security schemes, the server
`http://127.0.0.1:4420` and version 0.2.0, `AuditChainStatus` with `lineage` and `lineageTotal`.
Three of the row's verification commands do not exit 0, for two causes in the typed client's two
files, which this row may not edit. A patch for their owner is ready and proven on an isolated copy.

## Milestones (WIB)

| Time | Milestone |
|---|---|
| 09:47 | Pre-image saved before the first edit: `.cache/rollback/W27.pre.patch` (108,953 bytes), `W27.pre.untracked.tar` (20 files), `W27.pre.hashes` (34 files). State at the start: shared 977 / 977 in 46 files; `gen-openapi.ts --check` exit 0 (offline 10, all 37) |
| 09:56 | An isolated copy of `packages/shared` made under `.cache/W27/work`; all development and test runs happened there, so no other row saw a half-written registry |
| 10:05 | Shared parts: paging constants, five patterns, two model members (`responses[status].services`, `coreServerDescription`), four new tags, the code-unit bound helper, the query helpers. The example state generated from the real simulator (`state-examples.ts`) |
| 10:15 | The eight area modules (38 operations, 32 schemas, examples) and `sim-actions.ts`; registered in `core-api.ts`. The ten existing operations: Core-server texts, 401 and 403 on the five reads, 422 on `startSession` |
| 10:16 | **Found F-1**: the typed client's `CoreCallInput` type is a cross product of three unions and is refused by the compiler from 47 operations on (TS2590). Measured on probes; a type-only fix proven on the copy, not applied to the tree |
| 10:20 | `openapi.ts`: the `all` scope with the two security schemes, the server 4420, version 0.2.0, per-operation `security`, the Core server's texts and headers; `gen-openapi.ts`: committed scope `all`. Document 882,674 bytes |
| 10:27 | Existing pins moved to 75 by design in seven `api-*` files and `openapi.test.ts`. **Found F-2**: `client-core.test.ts:481-488` calls a 204 operation without its path parameter |
| 10:31 | Two new test files green; the examples corrected to the simulator's own answers |
| 10:34 | Rule 4(b): the simulator fix is in the tree, so the text rule was switched on for slice text; every scenario state still parses; contract B's test rewritten by design |
| 10:39:40 | **The work copied into the tree in one step** (33 files) |
| 10:39-10:44 | First mutation pass on a second copy: 36 of 36 detected |
| 10:45-10:50 | Second pass with the document regenerated after each change: 36 of 36 |
| 10:50:52 | Controller notes folded in: the export reason is bounded for all three exports (the specification makes it mandatory: no conflict with the stored record); no query member is required and none has a default. Second copy into the tree (5 files). Two more mutations: 2 of 2 |
| 10:52-10:56 | Gate on the finished tree: `implementation/assets/27_gate.log` (three runs of the core-server suite, P11) |
| 10:55 | The same contract with the proposed client patch on the isolated copy: shared 1,405 / 1,405, type check exit 0; `dev-probes.ts` of the mobile app type-checks against it |
| 10:55 | Rollback post-image saved; the recipe run in a scratch directory: 34 files, every hash equal to the pre-image |
| 11:01 | `implementation/27_contract_c.md` written |

## Files created or updated

Code, changed (21): `packages/shared/src/api/{constants,contract-model,core-api,example-parts,examples,index,openapi,operation-parts,operation-table,patterns,schema-parts,state-slices}.ts`;
`packages/shared/scripts/gen-openapi.ts`; `packages/shared/openapi/openapi.json`;
`packages/shared/test/{openapi,api-envelope,api-examples,api-openapi-scope,api-realtime,api-registry,api-state-slices,api-text-rule}.test.ts`.

Code, new (12): `packages/shared/src/api/{sessions,evidence,devices,storage,network-time,security-audit,system,alerts,state-examples,sim-actions}.ts`;
`packages/shared/test/{api-domain-operations,api-state-examples}.test.ts`.

Documents: `implementation/27_contract_c.md`; this file; `implementation/assets/27_gate.log`,
`27_proposed_client_changes.patch`, `27_mutations.log`, `27_mutate.py`,
`27_changes_to_existing_files.diff`.

Git-ignored: `.cache/rollback/W27.{pre,post}.patch`, `W27.{pre,post}.untracked.{list,tar}`,
`W27.pre.hashes`; `.cache/W27/` (the two isolated copies, logs, probe configurations).

Not written: `packages/shared/src/client/**` and `packages/shared/test/client-*.test.ts` (checked
byte-equal to their state at the start); anything under `packages/shared/src/sim`, `src/live`,
`src/realtime`; any i18n file; any `package.json`; anything in `apps/`; `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`.

## Processes

None left running. No port was bound, no database used, no emulator touched, no npm install.

## Blockers

Two, both in files of the typed-client row (details and the patch: `27_contract_c.md` section 11).

| | Where | Effect on the tree |
|---|---|---|
| F-1 | `packages/shared/src/client/core-client.ts:244-247`: the input type of `call` is `ParamsOf<U> & BodyOf<U> & QueryOf<U>` over the union of all operations, a cross product of n × n × n members; the compiler refuses it from n = 47 | `npm run typecheck -w @dems/shared` exit 2 (10 errors: `api-registry.test.ts`, `client-types.test.ts`); `npm run typecheck -w @dems/mobile` exit 2 (`src/runtime/dev-probes.ts:225`). Literal-typed client calls are not type-checked until it is fixed |
| F-2 | `packages/shared/test/client-core.test.ts:481-488`: the loop over the 204 operations passes no path parameter; ten 204 operations of the specification have `{id}` | `npm run test -w @dems/shared` exit 1: 1 failed, 1,404 passed |

## Findings, deviations, decisions (for the controller to record)

Findings F-1 to F-12, deviations DR-1 to DR-10 and decisions DN-0 to DN-12 are in
`implementation/27_contract_c.md` section 11. The ones that need a ruling or an action:

- **DN-0**: who applies `27_proposed_client_changes.patch` (F-1, F-2). With it the shared suite and
  type check are green on the copy.
- **F-3 / DN-1**: "the six reads" of the specification are five reads and health; health is PUBLIC
  and documents no 401.
- **Rule 4(b)**: the text rule is on for slice text, and for the names the engine mints (DR-4).
- **Controller note D62**: the specification makes the export reason mandatory for all three
  exports; the contract requires it (5 to 500, the text rule). No conflict with the stored record.
- **Controller note D61**: no required query member, and no default (a default makes
  `client-core.test.ts:147` fail; measured).
- **F-10**: one core-server scaffold test fails because of another row's boot check, not the
  contract.
- **KI-18**: the `all` scope and the committed document are corrected; six offline strings and the
  places outside the contract folder are listed for W83.

---

## Follow-up D113: a condition for operation 23 (second holding of the slot)

Status: **needs-review**. The contract half is ready and proven, and it is NOT in the tree: it is
the patch `implementation/assets/27c_condition_op23.patch`, for the guard's owner to land with the
evaluation in one step. Document: `implementation/27_contract_c.md`, section 15.

### Milestones (WIB)

| Time | Milestone |
|---|---|
| 18:41 | Finding CPS1-3 and decision D113 read. The check ordered first: `access-rules.ts:198, 265-266` builds the set of known conditions from the shared vocabulary, so the boot does not stop on a new member |
| 18:47 | `decision.ts:135-152` ignores a condition it has no case for. The server's tests that pin the conditions found by reading: `access-rules.test.ts:92-102`, `pairing/__tests__/routes.test.ts:128`, `test/acceptance/rbac-matrix.test.ts:861-881` |
| 18:48 | Two scratch copies of `packages/shared` (unchanged and work). Baseline on the unchanged copy: 68 files, 1,807 tests |
| 18:51 | Condition, operation 23, texts, example, tests and the regenerated document on the work copy: 68 files, 1,813 tests; typecheck and lint exit 0 |
| 18:53 | Typecheck of the server, the web app and the mobile app against the work copy: exit 0 three times |
| 18:56 | The server's `unit` project against both copies: unchanged 143 files and 3,710 passed; changed 2 failed, the two predicted lines. Decision: do not land |
| 18:57 | 15 mutation checks on a third copy: 15 detected |
| 19:02 | The optional add-on for operation 8 on its own copy (68 files, 1,814 tests). The acceptance comparison of specification and registry repeated without a database: red for row 23 on the changed copy. The tree's own seven checks: exit 0 |
| 19:07 | Texts made exact (the refused caller is a session of the device; a web console session is refused by the marker). Both patches written to `assets/` and proven: applied to fresh copies of the tree, byte-equal to the copies they were made from |
| 19:15 | Gate log closed (`assets/27c_gate.log`, five parts). The tree's `packages/shared` equals the snapshot of 18:48: untouched |
| 19:18 | Section 15 of the implementation document and this section written |

### Files created or updated

| File | Kind |
|---|---|
| `implementation/assets/27c_condition_op23.patch` | created: the change (6 files of `packages/shared`) |
| `implementation/assets/27c_condition_op8_addon.patch` | created: optional, on top of the first |
| `implementation/assets/27c_gate.log` | created |
| `implementation/assets/27c_mutate.py`, `27c_mutations.log` | created |
| `implementation/27_contract_c.md` | updated: section 15 appended |
| `delegation_progress/coder_execution_step_49.md` | updated: this section |

No file of the tree outside `docs/` was written. Scratch: `.cache/W27c/`.

### Processes

None left running. No server, no database and no port was used; the server's tests were read from
the tree by a probe configuration in `.cache/W27c/`.

### Blockers

| Blocker | Owner | What unblocks |
|---|---|---|
| The contract half cannot land alone: two `unit` tests and one acceptance test of other rows pin the conditions, and the document would promise a refusal the server does not give yet | the guard's owner | `git apply` of the patch together with the evaluation in `decision.ts` and `denial.ts` and the by-design changes listed in section 15.7 |

### Findings, deviations, decisions (for the controller to record)

| ID | Kind | Summary |
|---|---|---|
| FU-1 | Deviation by the brief's own rule | Not landed; a proven patch instead (section 15.2) |
| FU-2 | Decision needed | Operation 8 `signInWithBiometric` has the same kind of exposure, by a chain with operation 7; the add-on patch is ready and changes behaviour of three other owners (section 15.8) |
| FU-3 | Info, residual | Operation 22 `unpairDevice` through a session: availability only, by specification T9; no condition |
| FU-4 | Decision recorded | The refusal is `403 DEVICE_NOT_PAIRED` with `details.reason: DEVICE_CREDENTIAL_REQUIRED`, an existing code; it is not audited |
| FU-5 | Info | The typed client has one credential provider for all calls; a caller of operation 23 needs an instance that returns the device credential |
| FU-6 | Info | The web-session refusal on `DEVICE` operations stays with the collected gaps |
| FU-7 | Not done, as ordered | The collected contract gaps were not started |

