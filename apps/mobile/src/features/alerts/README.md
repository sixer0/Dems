# `apps/mobile/src/features/alerts`

Up: [`src/features/`](../README.md)

## Purpose

The alert toasts: the consumer of the Core's alerts that Settings > Notifications promises. `<AlertToasts />` raises one toast per new alert of an enabled category, with the same words as the bell's list (`alertLabel`), and acknowledges through the Core action. Mounted by `app/(app)/_layout.tsx`.

## Contents

| Entry | Role |
|---|---|
| `alert-label.ts` | The words of ONE alert, the same in the bell's list and on its toast: 1. |
| `alert-toasts-model.ts` | Pure rules of the alert toasts: kind, label length and the step from one alert state to the next. |
| `alert-toasts.tsx` | `<AlertToasts />` - the consumer of the Core's alerts that Settings → Notifications promises (fix wave J, JA2-05). |
| `i18n.ts` | English copy of the alert toasts (fix wave J, JA2-05), mounted at `features.alerts.*`. |

## Main exports

- Components: `AlertToasts`.

## Core operations and state

- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `acknowledgeAlert`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

No test file in this folder.
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
