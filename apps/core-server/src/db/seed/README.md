# `src/db/seed`

Up: [`src/db`](../README.md)

## Purpose

The seed program `db:seed`: the shared demonstration dataset as of one instant, the factory seed (vendor identities and the unit's own configuration only), and the demo-package helpers.

## Contents

| File or folder | Role |
|---|---|
| [`cli.ts`](./cli.ts) | `db:seed`: loads the shared dataset into a freshly migrated project database, as the owner role. |
| [`dataset.ts`](./dataset.ts) | The dataset of a seed: the shared simulator's initial state as of one instant. |
| [`demo-core.ts`](./demo-core.ts) | Which Core a seed command seeds for. |
| [`demo-helper.ts`](./demo-helper.ts) | The ONE-SHOT helper run of the seed commands. |
| [`demo-packages.ts`](./demo-packages.ts) | The v2 demo items of a seed. |
| [`factory.ts`](./factory.ts) | `db:seed --factory`: the factory seed — what a database of a unit leaving the workshop holds. |
| [`index.ts`](./index.ts) | The seed program. |
| [`seed.ts`](./seed.ts) | The seed program. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `DatasetOptionError`, `buildSeedState`, `resolveDatasetOptions`, `DatasetOptions`, `ResolvedDatasetOptions`, `STAGING_SUFFIX`, `STT_CONFIG_SEED_DEFAULT`, `SeedError`, `assertSeedTarget`, `prepareSeed`, `seedDatabase`, `sttConfigSeedRow`, `writeSeed`, `PreparedSeed`, `SeedDatabaseOptions`, `SeedDependencies`, `SeedErrorCode`, `SeedOptions`, `SeedReport`, `SeedTarget`, `CERT_FINGERPRINT_PATTERN`, `ENV_DEVICE_CERT_FINGERPRINT`, `FACTORY_EMPTY_TABLES`, `FactorySeedError`, `factoryIdentityOfEnvironment`, `prepareFactorySeed`, `seedFactoryDatabase`, `writeFactorySeed`, `FactoryIdentityAnswer`, `FactoryIdentityProblem`, and 23 more.

Command-line entry: `cli.ts`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`db/reset`](../reset/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture/boot`](../../capture/boot/README.md)
- [`capture/fence`](../../capture/fence/README.md)
- [`config.ts`](../../config.ts)
- [`db/commands`](../commands/README.md)
- [`db/mapping`](../mapping/README.md)
- [`db/schema`](../schema/README.md)
- [`db/store`](../store/README.md)
- [`modules/identity`](../../modules/identity/README.md)
- [`plugins/config`](../../plugins/config/README.md)
- [`sealing-host`](../../sealing-host/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `drizzle-orm`, `pg`
- Node built-ins: `node:child_process`, `node:path`, `node:perf_hooks`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 8 | 3 |

3 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (7 folders): `src/capture/adapters/__tests__`, `src/db/fixtures/__tests__`, `src/db/reset/__tests__`, `src/db/store/__tests__`, `src/engine/__tests__`, `src/modules/demo/__tests__`, `src/modules/network-time/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
