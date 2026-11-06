# `apps/mobile/src/features/pairing`

Up: [`src/features/`](../README.md)

## Purpose

Pairing at `/pair`, a public screen. In Live mode it shows the Core server address field (host and port, `runtime/core-address.ts`, D263, D265), the six-digit code panel, the Core connection card with the step timeline and the Core id, and the unpair dialog. `use-pairing-flow.ts` runs the attempt, its outcome, the lockout countdown and the hand-off back to the boot router (`/`).

## Contents

| Entry | Role |
|---|---|
| `core-address-field.test.tsx` | Test: The "Core server address" field of the Pair screen, in LIVE mode, on the app's real Live source (`createMobileLive`) over the contract-checked fake transport, as `pairing-live.test.tsx` mounts it. The field ... |
| `core-address-field.tsx` | "Core server address" on the Pair screen: host and port of the Core server this device pairs with, shown before pairing in LIVE mode, prefilled with the address in force (`127.0.0.1:4420` until it is set). |
| `i18n.ts` | English copy of the `pairing` feature, mounted at `features.pairing.*` through `src/i18n/features.ts`. |
| `live-gap-sites.test.tsx` | Test: Live tests that name sites S1-8 and S2-5. |
| `pairing-code-panel.tsx` | The code card of the Pairing screen: - UNPAIRED / FAILED / locked: `InputOTP` with 6 digits, the one Alert (danger "Code not accepted" + attempts left; warning "Pairing locked" + the C-6 countdown on the simulator ... |
| `pairing-connection.tsx` | The "Core connection" card of the Pairing screen: a `SectionCard` with the C-1 GlowRing around the link state, the C-4 Stepper (Discover → Verify code → Paired) that animates through the connection steps, one live ... |
| `pairing-handoff-routes.test.tsx` | Test: Where the app lands after a redeem, after a sign-out and on a guarded deep link while the pairing gate holds. ROUTE tests: the real route tree of `src/app`, the real `RootNavigator`, the real Pair screen ... |
| `pairing-live-model.test.ts` | Test: The pure part of the Pair screen in LIVE mode (`pairing-live-model.ts`), and the two outcome kinds it adds to the existing model. |
| `pairing-live-model.ts` | The Pair screen in LIVE mode: the pure part. No React, no clock, no storage: every function gets what it reads as an argument. What differs from the simulator, and why this file exists. |
| `pairing-live-static.test.ts` | Test: Tests "the pairing folder takes the Core through the light Live API (CLG c, AC-C-53)". |
| `pairing-live.test.tsx` | Test: The Pair screen in LIVE mode, on the app's real Live source (`createMobileLive`) over the contract-checked fake transport. The screen is mounted as the app mounts it (`AppProviders`), the secure ... |
| `pairing-model.test.ts` | Test: Pairing model: timeline phases, view state, C-4 statuses, the lockout countdown on the simulator clock and the flat selectors (F74-13). |
| `pairing-model.ts` | Pairing screen model. Pure: the connection-steps timeline on the simulator clock, the view state, the C-4 statuses, the C-1 ring state and the flat `useSim` selectors (F74-13: primitives or flat tuples only). |
| `pairing-screen.test.tsx` | Test: Pairing screen (step 76; 04_mobile_specs §4.2, §6.5, §3.3 hand-off; blueprint row 76 AC: pair(code) and unpair() change the pairing state and emit audit rows). |
| `pairing-screen.tsx` | Pairing at `/pair`, public (reachable from the Login trust line and from Settings → Security). |
| `stack-check-service-name.test.tsx` | Test: the Stack Check health line prints the service name of the health answer without the `dems-` prefix ("mock-core" or "core-server"). |
| `unpair-dialog.tsx` | Unpair confirmation. Kit `Dialog`, mounted on demand by the screen (`useDialogPresence`). |
| `use-dialog-presence.ts` | Mount-on-demand for the Unpair `Dialog`, copied from step 79's pattern. A closed kit overlay still mounts its overlay hooks (S73-12), and a kit overlay animates in only on a closed → open transition that its mounted ... |
| `use-pairing-flow.ts` | The Pairing screen's controller: the code, the attempt in flight, its outcome, the lockout countdown and the hand-off. Every timer runs on the clock of the store: the connection steps (Discover → Verify), the commit ... |

## Main exports

- Screens: `PairingScreen` (`pairing-screen.tsx`).
- Hooks: `useDialogPresence`, `usePairingFlow`.
- Components: `CoreAddressField`, `PairingCodePanel`, `PairingConnection`, `UnpairDialog`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectCertificateFingerprint`, `selectCoreDeviceId`, `selectCoreName`, `selectLastPairingAudit`, `selectLockSeconds`, `selectPairedAt`, `selectPairingState`, `selectReportedCoreDeviceId`, `selectReportedCoreDeviceIdLive`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `pair`, `unpair`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265). `core-address-field.tsx`, `pairing-code-panel.tsx` read the configured address itself (to show or edit it), through the runtime's exports.

## Tests

9 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D186: row 223: "Use Simulated mode" only where available.
- D190: row 223: release pairing slot.
- D212: row 200: pairing card shows the Core id.
- D263: Core server address setting.
- D265: row 236: the Pair-screen "Core server address" field.
