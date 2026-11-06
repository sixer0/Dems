---
task_slug: input_av_core_adapter_plan
row: 201
milestone: M11 / X-C
date: 2026-10-13
agent: coder-execution (batch 9, agent R5)
tier: T3
status: complete (two enforcement lines in the audit writer are a request: the file is outside the row's set)
---

# Row 201 - the audit vocabulary step for X-1 and X-2 (77 to 78)

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server/src`.

## 1. What was built, in one change set

| # | Change | Where |
|---|---|---|
| 1 | Audit type `OPERATOR_PASSWORD_SET`, appended LAST (77 -> 78); category `SECURITY` (as `USER_ENABLED`) | `SH/src/sim/vocabulary.ts` (two lines and their comments) |
| 2 | Its label `Operator password set from the host` | `SH/src/i18n/en/common.ts` (`common.auditType`) |
| 3 | Its closed details rule, five keys (below); the list now holds 34 types, the simulator's 44 do not move | `CS/core/audit-details.ts` (`SERVER_AUDIT_DETAIL_RULES`) |
| 4 | The fixed severity: `SERVER_AUDIT_FIXED_SEVERITY = { OPERATOR_PASSWORD_SET: WARNING }` and `fixedSeverityOf(type)` | `CS/core/audit-details.ts` |
| 5 | The two public members of `SYSTEM_BOOT`: `SYSTEM_BOOT_SIGNING_DETAIL_RULES = { signingKeyId, signingCertificateSha256 }`, both optional, each with a value form | `CS/core/audit-details.ts` |
| 6 | Contract examples: `OPERATOR_PASSWORD_SET_DETAILS_EXAMPLE`, `SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE`, `SYSTEM_BOOT_DETAILS_EXAMPLE` | `SH/src/api/security-audit.ts` (exported constants; no schema changed) |
| 7 | Fixture: one row of the new type (actor null, severity WARNING) | `CS/db/fixtures/operations.ts` (`buildCaptureActivity`, row `at(24)`) |

### The details of `OPERATOR_PASSWORD_SET` (SX-14; design 05 section 3.7)

| Key | Required | Form |
|---|---|---|
| `targetOperatorId` | yes | an operator ID (`OPR-NNN`) |
| `method` | yes | one of `OPERATOR_PASSWORD_SET_METHODS` = `HOST_COMMAND` |
| `sessionsEnded` | yes | a whole number of 0 or more |
| `earlierWasDemo` | yes | true or false: the credential that was replaced was the published demonstration one |
| `invokerUid` | no | the numeric id of the OS user, 0 to 4294967295 - a fact, not a proof |

No `operationId` and no `permission`: no contract operation and no operator session stand behind the row. No key can hold the password, its length, a salt, a tag or a hash parameter: none exists on the list, and the general key rule refuses `password`, `passwordHash`, `salt`, `secret`, `credential`, `token`, `nonce`, `keyRef` before the list is asked.

### The two members of `SYSTEM_BOOT` (design 05 section 2.7 point 3)

| Key | Form |
|---|---|
| `signingKeyId` | the form of every key-id column (`CS/db/schema/checks.ts`, `keyId`): `^[A-Z0-9][A-Z0-9_-]{0,63}$` |
| `signingCertificateSha256` | 64 lower-case hex digits |

FINDING against the design: the design names "the details rule of `SYSTEM_BOOT` in `audit-details.ts`". There is none. `SYSTEM_BOOT` is one of the simulator's 44 types: the shared code writes it with its own keys and the audit writer gives such a type the general payload rules and NO list. The two members are therefore accepted today without any change (measured: case "a SYSTEM_BOOT row with and without ..."), and neither name is a forbidden key. What this row adds is the NAMES, fixed once, and the form of the two values as an exported rule set for the one writer of the boot row.

## 2. Count pins moved (each by its delta)

| Pin | From | To | File |
|---|---|---|---|
| Audit types | 77 | 78 | `CS/core/__tests__/writers.test.ts` (title and length) |
| Types with a list | 33 | 34 | `writers.test.ts` (describe title, case title, length; `accepted`, `keys`, `required` each gain the type; the 44 without a list unchanged) |
| Position of the ten of row 19 | `slice(-10)` | `slice(-11, -1)` | `writers.test.ts` |
| Fixture writes all types | 77 | 78 | `CS/db/fixtures/__tests__/audit-details.test.ts` (title, two printed tables) |
| Types by source, ALLOW-LIST | 33 | 34 | same file (MODULE 11, SIMULATOR 33 unchanged) |
| Listed types with no builder | 24 | 25 names | same file |
| Fixture comment | 77 | 78 | `CS/db/fixtures/operations.ts` (header of `buildCaptureActivity`) |
| Audit types (shared) | 77 | 78 | `SH/test/i18n-vocabulary-sync.test.ts` (title, length) |
| Positions of the earlier groups | `slice(-24,-15)`, `at(-15)`, `slice(-14,-10)`, `slice(-10)` | `slice(-25,-16)`, `at(-16)`, `slice(-15,-11)`, `slice(-11,-1)`; new `at(-1)` | `SH/test/i18n-vocabulary-sync.test.ts` |
| Audit types | 77 | 78 | `SH/test/api-registry.test.ts`, `SH/test/api-domain-operations.test.ts` (title, length), `SH/test/api-capture-discovery.test.ts` (title, length) |

No operation pin and no action pin moved. Counts after the row: 99 operations, 78 audit types, 50 actions, 15 permissions.

## 3. Checks (2026-10-13, one run each, `--maxWorkers=2`)

| Check | Command | Result |
|---|---|---|
| Shared pins and labels | `npx vitest run --maxWorkers=2 test/i18n-vocabulary-sync.test.ts test/api-registry.test.ts test/api-domain-operations.test.ts test/api-capture-discovery.test.ts test/i18n.test.ts` in `packages/shared` | `Test Files 5 passed (5)`, `Tests 156 passed (156)` |
| Writer, fixture, static | `npx vitest run --project unit --maxWorkers=2 src/core/__tests__/writers.test.ts src/db/fixtures/__tests__/audit-details.test.ts build.test.ts static.test.ts target.test.ts src/core/__tests__/static.test.ts` in `apps/core-server` | `Test Files 6 passed (6)`, `Tests 285 passed (285)` |
| Typecheck | `npm run -s typecheck` in `packages/shared`, `apps/core-web`, `apps/mobile`, `apps/transcriber`, `apps/mock-core` | exit 0, five of five |
| Typecheck | the same in `apps/core-server` | exit 2, 6 lines, ALL in `src/capture/adapters/audio/__tests__/alsa-config.test.ts:196` and `card-listing.test.ts:323,331,332,453` (the member `USB_SERIAL` / `usbSerial` of rows 199 and 200, agent R4, in flight); 0 lines in a file of this row |

Verification cell: "the writer accepts the new type" - two stated rows and the contract example, each appended to a chain as `SECURITY` / `WARNING` / actor null; "refuses a foreign detail key, among them every key that names a password, a length, a salt, a tag or a hash parameter" - 10 names by the key rule (`AUDIT_DETAIL_KEY_FORBIDDEN`) and 39 by the list (`AUDIT_DETAIL_KEY_NOT_ALLOWED`), plus 12 values outside their form; "a `SYSTEM_BOOT` row with and without the two members is accepted" - four rows (none, the operation only, both members, the key id only); "every count pin of the file set passes at 78" - section 2.

`SH/openapi/openapi.json` is NOT regenerated in this row: the audit type enum gains one value, so `SH/test/openapi.test.ts` (byte-for-byte case) is red until the one regeneration at the end of this agent's four rows.

## 4. Requests (`delegation_progress/file_requests.md`)

1. `CS/core/audit-writer.ts` (not in the row's file set): in `auditInputOf`, refuse an entry whose type has a fixed severity and states another (`fixedSeverityOf`), and hold a present `signingKeyId` / `signingCertificateSha256` of a `SYSTEM_BOOT` entry to `SYSTEM_BOOT_SIGNING_DETAIL_RULES`. Until then the severity and the two forms are stated and tested, not enforced by the writer. Not blocking.
2. `CS/core/index.ts`: the export line of the new names for rows 209 and 215. Not blocking.

## 5. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The key names: `targetOperatorId`, `method`, `sessionsEnded`, `earlierWasDemo`, `invokerUid` | the first and third are the names `USER_DISABLED` already uses; the fourth avoids the words `credential` and `password` in a key; fixed here, as the row says |
| DD-2 | `earlierWasDemo` is REQUIRED, not optional | the command always knows it (it compares before it replaces); a row without it would be weaker evidence |
| DD-3 | `method` is a closed set of one, `HOST_COMMAND` | the design's value; a console operation later adds its own value here |
| DD-4 | `invokerUid` admits 0 | whether the command refuses uid 0 is the command's rule (a design hypothesis); the audit rule states a form only |
| DD-5 | `SYSTEM_BOOT` did NOT get a closed list | it is a simulator type; a list would refuse the shared code's own keys on a native write and move the pin "44 without a list" and the fixture's source table. The two members are a stated form instead |
| DD-6 | The severity is a stated constant, not yet a writer rule | the writer is outside the row's file set (request 1) |
| DD-7 | The count of revoked biometric tokens is not a key | the requirement lists five facts; a sixth is a decision of the security review, not of this row |

## 6. The double, and what stays unproven

Pure functions and the fixture builder; no database, no process, no terminal, no key and no password in this row. Unproven here: the row written by the real command inside its transaction (rows 215, 216), and the boot row carrying a real key's id and digest (row 209).

Existing files were edited with the Edit tool only.

---
*Generated: 2026-10-13*
