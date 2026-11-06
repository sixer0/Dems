# `apps/mobile/src/features/login`

Up: [`src/features/`](../README.md)

## Purpose

Login at `/login`: the brand block, the auth card (username, password, biometric button, Core chip and trust line), the ambient Skia accents and the entrance choreography. The form uses react-hook-form with a local zod schema; credentials live only in the form state and in the one `useAuth().signIn(...)` call. In Live mode the offline notice names the configured Core address.

## Contents

| Entry | Role |
|---|---|
| `i18n.ts` | English copy of the `login` feature, mounted at `features.login.*` through `src/i18n/features.ts`. |
| `live-login-link-visuals.test.tsx` | Test: In LIVE mode the Login chip, the glow ring and the ambient loops read the runtime's notice and view of the Core link (`useCoreLinkNotice()` → `liveCoreLookOf`), not its two-valued `state`. |
| `live-login.test.tsx` | Test: The mobile Login screen in LIVE mode, driven through the real controller over the app's Live source and the contract-checked fake transport. The screen is mounted directly under the real ... |
| `login-ambient.math.ts` | Maths of the Login ambient accents: - gold dust: at most 24 Skia points drifting up through the backdrop, one seamless loop; - border beam: one lap of a light segment around the auth card (6 s), then gone. Pure and ... |
| `login-ambient.tsx` | Login ambient accents on Skia: `GoldDust` and `BorderBeam`. |
| `login-brand.tsx` | Login brand block (04_mobile_specs §4.1 L2 + L3; MB 1 (143–260, 100–248)) |
| `login-card.tsx` | The Login auth card and its companions (04_mobile_specs §4.1 L4–L11; MB 1 (66–286, 270–470)) |
| `login-entrance-rest.test.tsx` | Test: Tests "RF-PH-4: the end of the Login entrance is drawn by React". |
| `login-live-model.test.ts` | Test: The pure rules of `login-live-model.ts` and the static rule of the folder. |
| `login-live-model.ts` | The Login screen in LIVE mode: the pure part. No React, no clock, no storage: every function gets what it reads as an argument. What differs from the simulator, and why this file exists. |
| `login-model.test.ts` | Test: Login view model and ambient maths: the pure state table behind T-M04, the ring tone, the biometric button, the seeded dust and the beam. |
| `login-model.ts` | Login view model. Pure functions only, so T-M04's state table is tested without rendering (`login-model.test.ts`). |
| `login-screen.tsx` | Login at `/login`. |
| `login.test.tsx` | Test: Generic error with attempts left, 5 failures → locked Alert with a live countdown, the Core-offline Alert with its rate-limited Retry, no demo-credentials ... |
| `presentation-mode.ts` | Presentation mode, as the Login screen reads it. The Settings screen owns the field and writes it by merge. Until then no writer exists, so the field name is fixed here and handed to step 88: `presentationMode: ... |
| `use-login-choreography.ts` | Login choreography: the two entrances and their beats. |
| `use-login-controller.ts` | Login behaviour. - The form: react-hook-form + the local zod schema. Credentials live only in the form state and in the one `useAuth().signIn(username, password)` call; the password field is cleared after every ... |

## Main exports

- Screens: `LoginScreen` (`login-screen.tsx`).
- Hooks: `usePresentationMode`, `useLoginChoreography`, `useLoginController`.
- Components: `GoldDust`, `BorderBeam`, `LoginBrand`, `LoginCard`, `LoginFooter`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectCoreDeviceId`, `selectPairingState`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265). `login-card.tsx`, `login-model.ts` read the configured address itself (to show or edit it), through the runtime's exports.

## Tests

6 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D174: row 171: Live login offline alert, Simulated switch removed.
- D205: row 199: login card shows the Core id.
