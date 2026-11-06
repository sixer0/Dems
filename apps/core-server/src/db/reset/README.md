# `src/db/reset`

Up: [`src/db`](../README.md)

## Purpose

The reset and carry-over routine: steps R-0 to R-9 that rebuild a database while keeping a fixed set of tables, with a guard that refuses the reset when real sealed evidence exists in the database or on disk.

## Contents

| File or folder | Role |
|---|---|
| [`cli.ts`](./cli.ts) | `db:reset`: returns one project database to the seed state, as the owner role. |
| [`errors.ts`](./errors.ts) | The failures of the reset routine. |
| [`index.ts`](./index.ts) | The reset and carry-over routine. |
| [`kept-tables.ts`](./kept-tables.ts) | The eighteen kept tables and how their rows cross a reset. |
| [`names.ts`](./names.ts) | Which databases the reset routine may touch, and the text of its database-level statements. |
| [`package-removal.ts`](./package-removal.ts) | Removal of one package folder of the evidence store. |
| [`plan.ts`](./plan.ts) | What a reset writes beyond the seed, decided from what R-3 read. |
| [`real-evidence.ts`](./real-evidence.ts) | The real-evidence guard of a demo reset. |
| [`routine.ts`](./routine.ts) | The reset and carry-over routine, steps R-0 to R-9. |
| [`session-artefacts.ts`](./session-artefacts.ts) | The PER-SESSION artefacts of the sessions a reset clears, outside the database. |
| [`transcriber-scratch.ts`](./transcriber-scratch.ts) | The transcriber scratch of the sessions a reset clears. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `RESET_CHECKPOINTS`, `RESET_STEPS`, `ResetError`, `stepOf`, `ResetCheckpoint`, `ResetErrorCode`, `ResetStep`, `KEPT_TABLES`, `KEPT_TABLE_NAMES`, `CAPTURE_KEPT_TABLES`, `CarryMode`, `KeptTable`, `DEVELOPMENT_ADAPTER_KINDS`, `MAX_NAMED_SESSIONS`, `REAL_SEALED_EVIDENCE_STATEMENT`, `SOURCE_ROWS_PER_SESSION`, `assertNoRealSealedEvidence`, `classifyRealSealedRows`, `clearedDevelopmentPackages`, `developmentPackagesMessage`, `evaluateRealEvidence`, `findRealSealedEvidence`, `realEvidenceDetails`, `realEvidenceMessage`, `removeClearedDevelopmentPackages`, `DevelopmentPackageRemoval`, `DevelopmentPackageRemovalOptions`, `PackageKeptReason`, `RealEvidenceFacts`, `RealSealedEvidenceRow`, and 43 more.

Command-line entry: `cli.ts`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`modules/demo`](../../modules/demo/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`config.ts`](../../config.ts)
- [`db/commands`](../commands/README.md)
- [`db/mapping`](../mapping/README.md)
- [`db/schema`](../schema/README.md)
- [`db/seed`](../seed/README.md)
- [`db/store`](../store/README.md)
- [`evidence-verify`](../../evidence-verify/README.md)
- [`plugins/config`](../../plugins/config/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `drizzle-orm`, `pg`
- Node built-ins: `node:crypto`, `node:fs`, `node:path`, `node:perf_hooks`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 21 | 9 |

9 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (5 folders): `src/db/fixtures/__tests__`, `src/engine/__tests__`, `src/modules/demo/__tests__`, `src/modules/security-audit/__tests__`, `src/sealing-host/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
