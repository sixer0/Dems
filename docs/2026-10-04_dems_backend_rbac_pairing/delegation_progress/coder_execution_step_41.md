---
task_id: 2026-10-04_dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 41
plan_row: W19 (contract A; contract-owner slot, P17)
status: needs-review
output_document: implementation/19_contract_a.md
started: 2026-10-04 07:44 WIB (pre-image saved)
returned: 2026-10-04 08:46 WIB
---

# Step 41 (W19) progress: contract A

## Status

**needs-review.** The contract is written and verified. Two of the row's verification commands do
not exit 0, both because of assertions in test files of step 34 that this row may not edit and that
fail by design (F-1 below). Everything else of the verification list passes.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 07:44 | P23 pre-image saved: `.cache/rollback/W19.pre.patch` (0 bytes; the paths equalled `acaff20`) |
| 07:56 | Baseline before the first edit: shared 680 passed in 37 files; typecheck, lint and `gen-openapi.ts --check` exit 0; `openapi.json` 95,021 bytes |
| 08:17 | Registry model, envelope, constants, health, text rule, scopes and the 27 operations written; `openapi.json` regenerated (96,541 bytes; four hunks in two components) |
| 08:18 | First full shared run: the two expected by-design failures, one in this row's `openapi.test.ts` (edited by design), one in step 34's `client-core.test.ts` (not edited) |
| 08:27 | Six new `api-*` test files written; the literal-table placement measured (21 type errors in two files of step 34) and restored |
| 08:29 | The web suite caught a regression of this row (a new message key without an i18n resource, 437 of 438); removed; 438 of 438 |
| 08:33 | The proposed change for the two client test lines checked on temporary copies (76 of 76), copies deleted |
| 08:37 | 24 of 24 single mutations detected; the tree equals the saved post-image |
| 08:38 to 08:41 | Final gate run on the finished tree (`implementation/assets/19_gate.log`) |

## Final gate (08:38:40 to 08:40:41 WIB)

| Command | Result |
|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2` | **exit 1**: 44 files, 785 tests, 784 passed, 1 failed (`client-core.test.ts:118`, `Error: no example for signOut 204`) |
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | exit 0: `offline (committed): 10 operations; all: 37 operations` |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | exit 0: 39 files, 438 passed; `scalar-config.test.ts` unchanged against `acaff20` |
| `npm run typecheck -w @dems/shared` | **exit 2**: one error, `test/client-types.test.ts(123,46)` TS2344 |
| `npm run typecheck` of core-web, mobile, mock-core, core-server | exit 0 each |
| `npm run lint` of shared, core-web, mobile | exit 0 each |
| `npm run test -w @dems/core-server -- --maxWorkers=2` (not a gate of this row) | exit 0: 24 files, 526 passed |
| `npm run test -w @dems/mobile -- --maxWorkers=2` (not a gate of this row) | exit 0: 72 suites, 833 passed |
| `git diff acaff20 --stat -- packages/shared/src/sim apps/mock-core release` | Only step 38's `auth.ts` +5 and `vocabulary.ts` +27 |

## Files created or updated

Updated (13): `packages/shared/openapi/openapi.json`; `packages/shared/scripts/gen-openapi.ts`;
`packages/shared/src/api/constants.ts`, `core-api.ts`, `examples.ts`, `health.ts`, `index.ts`,
`openapi.ts`, `patterns.ts`, `session-schema.ts`; `packages/shared/test/openapi.test.ts`,
`schemas.test.ts`, `sim-api-validation.test.ts`.

Created (16): `packages/shared/src/api/administration.ts`, `contract-model.ts`,
`demo-controls.ts`, `example-parts.ts`, `identity.ts`, `operation-parts.ts`, `operation-table.ts`,
`pairing.ts`, `schema-parts.ts`, `text.ts`; `packages/shared/test/api-envelope.test.ts`,
`api-examples.test.ts`, `api-openapi-scope.test.ts`, `api-registry.test.ts`, `api-schemas.test.ts`,
`api-text-rule.test.ts`.

Documents: `implementation/19_contract_a.md`; this file;
`implementation/assets/19_gate.log`, `19_openapi_offline_diff.txt`,
`19_literal_table_activation_errors.txt`, `19_proposed_client_test_changes.patch`.

Git-ignored: `.cache/rollback/W19.pre.patch`, `.cache/rollback/W19.post.patch`.

## Blocker

**F-1.** `packages/shared/test/client-types.test.ts:123` (a type assertion that pins the envelope
member to `{ code, message }`) and `packages/shared/test/client-core.test.ts:118` with `:129-130`
(a loop that expects an example and a schema for every success) fail because the specification
adds `details` and `requestId` to the envelope and has five operations that answer 204. Both files
are step 34's. A change of 4 lines into 8 is proposed and checked
(`implementation/assets/19_proposed_client_test_changes.patch`). It needs a recorded decision and
a writer (DN-0).

## Findings (details: `implementation/19_contract_a.md` section 12)

| ID | Finding |
|---|---|
| F-1 | Two client test assertions of step 34 fail by design (above) |
| F-2 | The literal table as the typed client's default breaks 18 lines in `client-core.test.ts` and 3 in `apps/mobile/src/runtime/dev-probes.ts` |
| F-3 | zod 4.6.5 `.max(n)` counts code points, not UTF-16 code units; D30 D-a assumed code units and the password hash wrapper counts `password.length` |
| F-4 | A web test requires an i18n resource for every value of `SESSION_CREATE_MESSAGES`, so a contract row cannot add a message key there |
| F-5 | A reason below the minimum answers `INVALID_INPUT` at the schema stage, while the specification names `INVALID_REASON` for `revokeDevice`, stop and export |
| F-6 | The vendor-extension check of `openapi.test.ts` counts header names; it will trip on `x-request-id` in the `all` scope |
| F-7 | A stale comment in `session-schema.ts:19-20`, left as it is |
| F-8 | The scaffold's local health adapter and its gap marker are no longer needed (file of W08) |

## Deviations

| ID | Deviation |
|---|---|
| DR-1 | `CORE_API_OPERATION_TABLE` is exported from `operation-table.ts` and `@dems/shared/api`, not from `core-api.ts`, so it is not the typed client's default table yet (F-2) |
| DR-2 | Status `needs-review`: shared tests exit 1 and shared typecheck exit 2 (F-1) |
| DR-3 | `implementation/99_implementation_report.md`, `masterplan/02_plan.md` and `status_tasks.md` not written (parallel run, P8) |
| DR-4 | Two temporary edits, both restored: the measurement of F-2 in this row's own `core-api.ts` and `index.ts`; two copies of the client tests under `packages/shared/test/api-tmp-*`, created and deleted |

## Decisions for the controller

| ID | Decision | This row's choice |
|---|---|---|
| DN-0 | Who applies the client test change of F-1, as a recorded by-design change | Not this row; the patch is ready |
| DN-1 | The password is also bounded at 128 UTF-16 code units (F-3) | Added |
| DN-2 | The envelope-level answers include the stage-3 403 `ORIGIN_NOT_ALLOWED` and the stage-4 401 `CREDENTIAL_CONFLICT`, beside the seven of the specification | Added |
| DN-3 | Token forms in answers: `ses_`, `dvc_`, `bio_` plus 43 base64url characters; the biometric token in a request is any text of 1 to 256 characters | As stated |
| DN-4 | `access.conditions`: `CONSOLE_IDENTITY`, `DEVICE_SESSION`, `DEMO_FLAG` | Added |
| DN-5 | Names for the bodies the specification writes inline | Listed in the output document, section 2 |
| DN-6 | Optional administration reasons: at most 500 characters, empty means none | As stated |
| DN-7 | `AuthSessionInfo.method`: `PASSWORD` or `BIOMETRIC` only | As stated |
| DN-8 | When the literal table becomes the typed client's default | After step 34's owner has changed its two files |

## Rollback

`implementation/19_contract_a.md` section 14.
