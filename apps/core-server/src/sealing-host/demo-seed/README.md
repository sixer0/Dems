# `src/sealing-host/demo-seed`

Up: [`src/sealing-host`](../README.md)

## Purpose

The seed-time generator of the v2 demo packages: demo items are sealed by the Core into its own evidence store with the product pipeline, because a v2 package is bound to one Core's keys and cannot be a committed asset.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | The SEED-TIME generator of the v2 demo packages. |
| [`seed-hook.ts`](./seed-hook.ts) | The seed hook of the v2 demo packages. |
| [`source-arguments.ts`](./source-arguments.ts) | The generated camera file of a demo package. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `DEMO_PACKAGE_MAX_BYTES`, `DEMO_PACKAGE_NOTICE`, `DEMO_TAMPERED_FRAGMENT`, `DEMO_SOURCE_ROWS`, `DemoSealFailure`, `DemoSealError`, `isDemoTamperItem`, `sealDemoPackages`, * from `./source-arguments`, * from `./seed-hook`.
- Types exported from `index.ts`: `DemoSealFailure`, `DemoSealItem`, `DemoSealOptions`, `DemoSealedPackage`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`sealing-host`](../README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`evidence-verify`](../../evidence-verify/README.md)
- [`modules/recording-fragments`](../../modules/recording-fragments/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`sealing`](../../sealing/README.md)
- [`sealing-host`](../README.md)

- Workspace packages: `@dems/shared`
- Node built-ins: `node:fs`, `node:path`

## Tests

No test folder inside this folder.

Tests elsewhere that import it (2 folders): `src/modules/evidence/__tests__`, `src/sealing-host/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
