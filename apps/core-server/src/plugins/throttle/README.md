# `src/plugins/throttle`

Up: [`src/plugins`](../README.md)

## Purpose

Stage 5 of the request pipeline: the request throttle per caller key and the denial budget that blocks a key after 20 audited refusals within 60 seconds. Both refuse with 429 `RATE_LIMITED`.

## Contents

| File or folder | Role |
|---|---|
| [`denial-budget.ts`](./denial-budget.ts) | The denial budget: per throttle key at most 20 audited refusals within 60 s. |
| [`index.ts`](./index.ts) | Throttle and denial budget: stage 5 of the request pipeline and the seam `denialBudget`. |
| [`limits.ts`](./limits.ts) | Keys, limits and buckets of the request throttle and the denial budget. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `throttleControl`, `rateLimited`, `throttlePlugin`, `createDenialBudget`, `BudgetRefusal`, `DenialBudgetSnapshot`, `KeyedDenialBudget`, `DENIAL_BUDGET_MAX`, `DENIAL_BUDGET_WINDOW_MS`, `DEVICE_SIGN_IN_OPERATIONS`, `HEALTH_OPERATION`, `THROTTLE_BUCKET_MAX`, `THROTTLE_STRICT_MAX`, `THROTTLE_WIDE_MAX`, `THROTTLE_WINDOW_MS`, `ThrottleBucket`, `ThrottleClass`, `bucketOf`, `classKeyOf`, `principalKeyOf`, `ThrottleKey`.
- Types exported from `index.ts`: `DenialBudget`, `ThrottleControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../../app.ts): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../../core/README.md)
- [`plugins/authenticate`](../authenticate/README.md)
- [`plugins/error-envelope`](../error-envelope/README.md)
- [`plugins/logger`](../logger/README.md)
- [`plugins/origin-guard`](../origin-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `@fastify/rate-limit`, `fastify`, `rate-limiter-flexible`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 3 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (21 folders): `src/__tests__`, `src/modules/admin/__tests__`, `src/modules/capture-config/camera-network/__tests__`, `src/modules/capture-config/factory-scan/__tests__`, `src/modules/capture-config/installation-acceptance/__tests__`, `src/modules/capture-config/network/__tests__`, `src/modules/capture-discovery/connect/__tests__`, `src/modules/capture-inputs/audio-cards/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
