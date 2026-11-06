# `apps/mobile/src/i18n`

Up: [`src/`](../README.md)

## Purpose

The app's i18n runtime: i18next and react-i18next, English only. `index.ts` builds the English resources from three layers (shared words of `@dems/shared`, the mobile namespace `mobile.*` in `en.mobile.ts`, and the per-feature words registered in `features.ts` under `features.<name>.*`) and records missing keys.

## Contents

| Entry | Role |
|---|---|
| `en.mobile.ts` | The mobile namespace `mobile.*` (English). |
| `features.ts` | Registry of per-feature i18n resources. Owner: step 70 (P6). |
| `i18n.test.ts` | Test: Mobile i18n runtime and resource layering. |
| `index.ts` | i18n runtime: builds the English resources and records missing keys. |
| `resources.ts` | i18n resource trees. A tree is nested plain objects whose leaves are strings. |

## Main exports

- Public surface (`index.ts`): `EN_RESOURCE_LAYERS`, `buildEnResources`, `getMissingKeys`, `resetMissingKeys`, `i18n`, `mergeResources`.

## Tests

1 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
