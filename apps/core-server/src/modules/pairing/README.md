# `src/modules/pairing`

Up: [`src/modules`](../README.md)

## Purpose

Pairing and the device registry: operations 15 to 23 (pairing code, redeem, list, revoke, a device's own registration, unpair, credential rotation) and the `deviceResolver` seam that resolves a device credential at the authenticate stage.

## Contents

| File or folder | Role |
|---|---|
| [`activity.ts`](./activity.ts) | The audit rows and events of the pairing module. |
| [`codes.ts`](./codes.ts) | The pairing code, as the portal handles it. |
| [`database.ts`](./database.ts) | Reads of the pairing module on the runtime pool. |
| [`devices.ts`](./devices.ts) | The device registry and the life of a paired device. |
| [`index.ts`](./index.ts) | Pairing module and device registry. |
| [`limits.ts`](./limits.ts) | The numbers of the pairing module. |
| [`presence.ts`](./presence.ts) | Which paired devices are online. |
| [`redeem-lock.ts`](./redeem-lock.ts) | The redeem lock. |
| [`redeem.ts`](./redeem.ts) | The redeem of a pairing code. |
| [`resolver.ts`](./resolver.ts) | The device resolver: what the seam `app.deviceResolver` answers to stage 4. |
| [`routes.ts`](./routes.ts) | The routes of the pairing module: operations 15 to 23 of the shared registry. |
| [`secrets.ts`](./secrets.ts) | The two secrets of the pairing module. |
| [`store.ts`](./store.ts) | The statements of the pairing module. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `pairingControl`, `pairingModule`, `DEVICE_CREDENTIAL_BYTES`, `DEVICE_CREDENTIAL_PREFIX`, `DEVICE_SEEN_MIN_INTERVAL_MS`, `PAIRING_CODE_DIGITS`, `PAIRING_CODE_LIFETIME_MS`, `PAIRING_CODE_MAX_FAILED_REDEEMS`, `PAIRING_CODE_SWEEP_INTERVAL_MS`, `PAIRING_QR_PREFIX`, `REDEEM_LOCK_DURATION_MS`, `REDEEM_LOCK_KEY`, `REDEEM_LOCK_MAX_FAILURES`, `REDEEM_LOCK_WINDOW_MS`, `createDevicePresence`, `DevicePresence`, `createRedeemLock`, `RedeemFailure`, `RedeemLock`, `RedeemLockRefusal`, `RedeemLockStatus`, `RedeemTicket`, `PAIRING_OPERATION_IDS`, `PairingOperationId`, `readDeviceState`, `Queryable`.
- Types exported from `index.ts`: `PairingControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`
- [`plugins/authenticate`](../../plugins/authenticate/README.md): `index.ts`
- [`realtime`](../../realtime/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`modules/identity`](../identity/README.md)
- [`plugins/authenticate`](../../plugins/authenticate/README.md)
- [`plugins/db`](../../plugins/db/README.md)
- [`plugins/error-envelope`](../../plugins/error-envelope/README.md)
- [`plugins/logger`](../../plugins/logger/README.md)
- [`plugins/permission-guard`](../../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `fastify-type-provider-zod`, `pg`, `rate-limiter-flexible`, `zod`
- Node built-ins: `node:crypto`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 11 | 7 |

7 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (5 folders): `src/db/fixtures/__tests__`, `src/modules/__tests__`, `src/modules/identity/biometric/__tests__`, `src/plugins/authenticate/__tests__`, `src/realtime/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
