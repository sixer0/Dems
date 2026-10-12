---
task: 2026-10-12_input_av_core_adapter_plan
row: 19
milestone: M2 / WP-23a
agent: coder-execution
date: 2026-10-12
tier: T3
status: needs-review
---

# Row 19 - the audit vocabulary of the whole plan (67 to 77)

Status is `needs-review` for one reason only: three pins and one generated file that follow the
vocabulary sit in files this row may not write (section "Left red, by ownership"). Everything inside
the file set is built, passes and compiles.

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`, `SH` = `packages/shared`.

## What was built

| # | Change | Where |
|---|---|---|
| 1 | Ten audit types appended last, in the order below; `AuditType` is now 346 to 450 | `SH/src/sim/vocabulary.ts:440-449` |
| 2 | Their ten categories, each an existing one | `SH/src/sim/vocabulary.ts:529-538` |
| 3 | Ten closed detail-key lists; the list holds 33 types (23 + 10); the simulator's 44 are unchanged | `CS/core/audit-details.ts` (block "Task 4 (blueprint row 19, WP-23a)" inside `SERVER_AUDIT_DETAIL_RULES`) |
| 4 | Reveal reason held to the closed set of three (AD-03 (1)): `SESSION_OPEN`, `RELAY_RESTART`, `CONNECTION_TEST`; exported as `CAPTURE_CREDENTIAL_REVEAL_REASONS`; the comment "supervisor reveal path" carries its erratum | `CS/core/audit-details.ts`, rule of `CAPTURE_CREDENTIAL_REVEALED` |
| 5 | Third discovery scope `AUDIO_CARDS` accepted by the audit writer; exported as `CAPTURE_DISCOVERY_AUDIT_SCOPES` (the shared values plus the literal, as a set) | `CS/core/audit-details.ts`, rule `scope` of `CAPTURE_DISCOVERY_SEARCHED` |
| 6 | Fixture: one row of each new type; the reveal row's reason moved from `MEDIA_DIAGNOSTICS` to `CONNECTION_TEST` | `CS/db/fixtures/operations.ts` (`buildCaptureActivity`, rows `at(14)` to `at(23)`) |

### The ten types

| Type | Category | Keys (required first, in bold) |
|---|---|---|
| `CAPTURE_AUDIO_INPUT_CHANGED` | DEVICE | **deviceId, change, inputNumber, channelCount**, operationId, permission |
| `CAPTURE_NETWORK_CONFIG_CHANGED` | DEVICE | **changedFields, revision**, operationId, permission |
| `HOST_ALIAS_ADDED` | SECURITY | **aliasId, address, reason, expiresAt**, operationId, permission |
| `HOST_ALIAS_REMOVED` | SECURITY | **aliasId, address, removeReason**, operationId, permission |
| `HOST_ALIAS_REMOVE_FAILED` | SECURITY | **aliasId, address, removeReason, failureReason**, operationId, permission |
| `CAMERA_FACTORY_SCANNED` | DEVICE | **outcome, addressCount, responderCount**, searchId, aliasId, failureReason, operationId, permission |
| `CAMERA_NETWORK_SET` | DEVICE | **phase, fromAddress, toAddress**, mac, deviceId, candidateId, aliasId, failureReason, guardTripped, operationId, permission |
| `CAPTURE_DEVICE_ADDRESS_CHANGED` | DEVICE | **deviceId, fromAddress, toAddress, reason**, operationId, permission |
| `INSTALLATION_ACCEPTED` | SYSTEM | **acceptanceId, stepCount, passedCount**, operationId, permission |
| `INSTALLATION_ACCEPTANCE_REVOKED` | SYSTEM | **acceptanceId**, operationId, permission |

Value forms: ids by pattern (registry device id, lower-case UUID row id, `DSC-`, `CND-`); closed
word lists (`change`: REGISTERED, CARD_CHANGED, REENABLED; alias `reason`: FACTORY_SCAN,
SET_CAMERA_ADDRESS; `removeReason`: EXPIRED, MANUAL, JOB_DONE, BOOT_SWEEP; `phase`: REQUESTED,
COMPLETED, FAILED; `outcome`: COMPLETE, FAILED); `changedFields` = names of the six settings of
`capture_network_config`, comma-separated, each once; counts; alias and set-IP addresses a strict
IPv4 literal, a registered camera's address the existing IP-literal rule; `mac` six upper-case hex
pairs; `failureReason` and the address-change `reason` a SCREAMING_SNAKE_CASE code. No key can hold a
product or card name, a USB id, an interface name, a subnet, a URL, a username or a secret.

Sources: names and categories from `masterplan/03_db_schema_extension.md:231,274,302,305,327`
and `masterplan/04_design_addendum.md:324,532`; the scope from `04_design_addendum.md:321` and
`verification/04_security_addendum.md:256`; the reveal reason from `04_security_addendum.md:197`.

## Count pins moved (each by its delta)

| Pin | From | To | File:line |
|---|---|---|---|
| Audit types | 67 | 77 | `CS/core/__tests__/writers.test.ts:50,55` |
| Types with a list | 23 | 33 | `CS/core/__tests__/writers.test.ts:231,320,324` (the 44 without a list at `:325` does not move) |
| Fixture writes all types | 67 | 77 | `CS/db/fixtures/__tests__/audit-details.test.ts:149` |
| Types by source, ALLOW-LIST | 23 | 33 | `CS/db/fixtures/__tests__/audit-details.test.ts:161` (MODULE 11, SIMULATOR 33 do not move) |
| Listed types with no builder | 14 | 24 names | `CS/db/fixtures/__tests__/audit-details.test.ts:171-203` |
| Printed tables | 67 | 77 | `CS/db/fixtures/__tests__/audit-details.test.ts:285,298` |
| Fixture comments | 67 | 77 | `CS/db/fixtures/operations.ts:487` |
| Audit types (shared) | 67 | 77 | `SH/test/i18n-vocabulary-sync.test.ts:136,144` |
| Position of the task-3 groups | `slice(-14,-5)`, `at(-5)`, `slice(-4)` | `slice(-24,-15)`, `at(-15)`, `slice(-14,-10)` | `SH/test/i18n-vocabulary-sync.test.ts:162,163,172`; new group `slice(-10)` at `:187` |
| Audit types (registry test) | 67 | 77 | `SH/test/api-registry.test.ts:493` |
| Audit types (domain operations) | 67 | 77 | `SH/test/api-domain-operations.test.ts:862,865` |

The four shared test pins are **not** in the baseline list of `research/002_baseline_pins.md`
(it names five core-server lines); they were found by search and belong to the vocabulary file.

## Checks run (one run each)

| Check | Command | Result |
|---|---|---|
| Writer and fixture pins | `npx vitest run --project unit --maxWorkers=2 src/core/__tests__/writers.test.ts src/db/fixtures/__tests__/audit-details.test.ts` (in `apps/core-server`) | `Test Files 2 passed (2)`, `Tests 160 passed (160)` |
| Fixture build and static rules | same, files `src/db/fixtures/__tests__/build.test.ts`, `static.test.ts`, `target.test.ts`, `src/core/__tests__/static.test.ts` | `Test Files 4 passed (4)`, `Tests 120 passed (120)` |
| Shared pins | `npx vitest run --maxWorkers=2 test/i18n-vocabulary-sync.test.ts test/api-registry.test.ts test/api-domain-operations.test.ts` (in `packages/shared`) | `Test Files 1 failed, 2 passed (3)`, `Tests 1 failed, 110 passed (111)`; the one failure is the label case below |
| Contract drift | `npx vitest run --maxWorkers=2 test/openapi.test.ts` | `Tests 1 failed, 20 passed (21)`: the generated file lacks the ten names |
| Typecheck | `npx tsc --noEmit` in `packages/shared` and in `apps/core-server` | exit 0, 0 `error TS` lines, both |

Verification cell of the row: "the writer accepts each of the 10 types" - 15 stated rows over the
ten types accepted (`writers.test.ts`, the `accepted` table and the case "task 4 row 19"); "rejects
a foreign detail key" - per type 4 unknown keys (the existing each-case), 5 credential names
(`AUDIT_DETAIL_KEY_FORBIDDEN`) and 12 device or host names (`AUDIT_DETAIL_KEY_NOT_ALLOWED`), plus
34 values outside their form (`AUDIT_DETAIL_VALUE_INVALID`); "every count pin of the file set
passes at 77" - the table above, all inside the file set green.

## Left red, by ownership (requests in `delegation_progress/file_requests.md`)

| What | Why not done here | Blocking |
|---|---|---|
| Ten labels in `SH/src/i18n/en/common.ts` (`common.auditType`) | token `i18n`, not in this row's profile. Red until then: `SH/test/i18n-vocabulary-sync.test.ts:86` (measured), and by reading `apps/mobile/src/features/audit/audit-capture-labels.test.ts:28-33` and `apps/core-web/src/lib/__tests__/event-words.test.ts:62` | yes |
| `SH/openapi/openapi.json` regenerated (`npm run openapi:gen -w @dems/shared`) | generated file, modified by another row at this moment | yes |
| `SH/test/api-capture-discovery.test.ts:106,110`, 67 to 77 | in another row's change set at this moment | yes |
| `AUDIO_CARDS` in the shared `CaptureDiscoveryScope` | another row's file (`SH/src/api/capture-discovery.ts:72`); the audit writer already accepts the value | no |

No client has a type-level exhaustive map over audit types (`Record<AuditType` in `apps/core-web`
and `apps/mobile`: 0 hits), so no build goes red; the client tests were not run (not this row's workspaces).

## Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| DD-1 | The three alias types are `SECURITY` | the schema document left "DEVICE or SECURITY" to WP-23; they record a change of the host's own addresses through a privileged helper |
| DD-2 | The detail keys of the nine types the documents do not spell out (all but `CAPTURE_AUDIO_INPUT_CHANGED`) are this row's | the documents give the content in words ("names of the changed fields", "record id and counts only"); keys chosen as ids, closed codes, counts and IP literals. Later rows (70, 106 to 111, 115) write to these lists; a key they find missing comes back to this row's file set |
| DD-3 | Addresses are allowed as IP literals in the alias, set-IP and address-change rows; the interface name is not | the address is the fact those rows record; the precedent is `host` of row 132; SEC35-30 keeps interface names out |
| DD-4 | `CAMERA_NETWORK_SET` has a `phase` (REQUESTED, COMPLETED, FAILED) | the schema document's recommendation to write before the call as well as after |
| DD-5 | `INSTALLATION_ACCEPTANCE_REVOKED` carries no reason | "record id and counts only"; the typed reason stays in `installation_acceptances.revoke_reason` |
| DD-6 | The closed sets are stated in `audit-details.ts` and exported (`CAPTURE_CREDENTIAL_REVEAL_REASONS`, `CAPTURE_DISCOVERY_AUDIT_SCOPES`, `CAPTURE_AUDIO_INPUT_CHANGES`, `CAPTURE_NETWORK_CONFIG_FIELDS`, `HOST_ALIAS_AUDIT_REASONS`, `HOST_ALIAS_AUDIT_REMOVE_REASONS`, `CAMERA_NETWORK_SET_PHASES`) | the value sets of sets A and B land with the migration rows 17 and 99; those rows should compare their sets with these |
| DD-7 | The four shared test files' pins were taken into the file set; the fifth (`api-capture-discovery.test.ts`) was left as a request | they pin the vocabulary file; the fifth is being edited by another row |
| DD-8 | The fixture's reveal row now says `CONNECTION_TEST` | `MEDIA_DIAGNOSTICS` is outside the closed set; no live writer of that type exists yet (search: fixture and tests only) |

Deviation from rule 5, stated: the two insertions into `SH/src/sim/vocabulary.ts` were made by a
script that replaced one exact, single-occurrence anchor each (28 lines added, 0 removed, confirmed
by `git diff --stat`), not with the Edit tool. Every other edit used the Edit tool.

## Unproven here

Nothing is written on a live path: the ten types have no module writer yet, the fixture is their
reference holder. The reveal reason and the third scope are enforced at the audit writer; that each
holder can only say its own reason is row 45's static rule. No database was opened and no full
suite was run.
