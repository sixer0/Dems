# `apps/mobile/src/providers`

Up: [`src/`](../README.md)

## Purpose

The app's provider tree and boot: `AppProviders` (keyboard, safe area, query client, i18n, HeroUI Native, the shared heartbeat, then the runtime's `SimRuntimeProvider` and the `AuthProvider`; the motion policy provider sits around it in `app/_layout.tsx`), `BootGate` (holds the native splash during hydration, then shows the boot skeleton) and the toast area offsets.

## Contents

| Entry | Role |
|---|---|
| `app-providers.test.tsx` | Test: AppProviders and BootGate. Gesture Handler's own jest mocks, first: GestureHandlerRootView installs a native module that jest lacks. |
| `app-providers.tsx` | `AppProviders`: the provider tree of the app and `createAppQueryClient`; caps font scaling. |
| `boot-gate.tsx` | `BootGate`: holds the native splash during hydration, then shows the boot skeleton. |
| `index.ts` | Public surface of the providers folder (re-exports). |
| `runtime-contract.test.tsx` | Test: The runtime contract (src/runtime), exercised the way steps 70 and 73 use it. Step 68 wrote this file against its stub; step 73 replaced the stub with the simulator runtime and rewrote the stub-specific cases (same ... |
| `toast-area.tsx` | Where the app's toasts may lie. The kit lays its toasts over the whole window, from the top edge. On the tablet the persistent critical toast then covered the page title, the clock, the bell, the account button and ... |

## Main exports

- Public surface (`index.ts`): `AppProviders`, `MAX_FONT_SIZE_MULTIPLIER`, `createAppQueryClient`, `heroUIConfig`, `BootGate`, `SPLASH_MAX_HOLD_MS`.
- Components: `AppProviders`, `BootGate`.

## Tests

2 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
