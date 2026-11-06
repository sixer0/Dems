# `src/plugins/config`

Up: [`src/plugins`](../README.md)

## Purpose

The configuration loader: reads the environment values and the runtime connection file and builds the configuration object exposed as `app.config`. The constants and the pure `createConfig` live in `src/config.ts`.

## Contents

| File or folder | Role |
|---|---|
| [`connection-file.ts`](./connection-file.ts) | Reads the runtime connection file. |
| [`index.ts`](./index.ts) | Public surface of the configuration loader. |
| [`load-config.ts`](./load-config.ts) | The configuration loader. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `DEFAULT_DATA_DIR`, `loadConfig`, `LoadConfigOptions`, `readConnectionFile`, `ConnectionFileFields`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`db/commands`](../../db/commands/README.md): `index.ts`
- [`db/reset`](../../db/reset/README.md): `index.ts`
- [`db/seed`](../../db/seed/README.md): `index.ts`
- [`index.ts`](../../index.ts): `index.ts`
- [`sealing`](../../sealing/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`config.ts`](../../config.ts)

- Node built-ins: `node:fs`, `node:path`, `node:url`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 2 | 0 |

None of these tests needs a database window.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
