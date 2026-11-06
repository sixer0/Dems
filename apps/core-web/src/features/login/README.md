# src/features/login

Up: [src/features](../README.md)

## Purpose

The Login page of the web console. A brand side (the graded room still with Ken Burns, the glow ring, the emblem and a device strip that shows the appliance's health before sign-in) and an auth side (the sign-in card, alerts for lock-out, Core offline and session end, and the mode selector where the build offers it). It signs the operator in with a user name and password or with a security key, then plays the hand-off animation and navigates into the shell. The password lives only in the controller hook's state while typed and in the one sign-in call; it is cleared after every attempt and never logged or stored.

The layout has four tiers: wide (1280 px and up, 7 | 5 split), split (1024 to 1279, 6 | 6), stacked (768 to 1023, a brand band above the card) and compact (below 768, full-bleed backdrop with the card over it).

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit and page tests of this folder |
| [`auth-card.tsx`](auth-card.tsx) | `AuthCard`: the sign-in card (fields, field errors, submit, security key, pending and locked states, exit on hand-off) |
| [`brand-panel.tsx`](brand-panel.tsx) | `LoginBackdrop`, `BrandSide`: the graded room still with Ken Burns, glow ring, particles and text effects |
| [`device-strip.tsx`](device-strip.tsx) | `DeviceStrip`, `PanelFirmwareCell`: device, room, clock, time sync, Core link, security, and the front panel's firmware (operation 114) |
| [`graded-still.ts`](graded-still.ts) | `useGradedStill`, `GradedStill`, `BACKDROP_GRADE_FILTER`: bakes the backdrop colour grade into an image once instead of a live CSS filter |
| [`index.tsx`](index.tsx) | `LoginPage`: page root (`page-login`), tier layout, choreography, version line |
| [`live-adapter.ts`](live-adapter.ts) | Live readers: `useLiveCoreHealth` (public health answer) and `useLivePanelFirmware` (operation 114) |
| [`login-alert.tsx`](login-alert.tsx) | `LoginAlert`: the alert above the card (lock-out countdown, offline, session end) |
| [`login-choreography.ts`](login-choreography.ts) | `buildLoginChoreography` and the timing constants of the entrance, arrival and hand-off (ms literals, time-scaled by the motion policy) |
| [`login-emblem.tsx`](login-emblem.tsx) | `LoginEmblem`: the brand emblem with its stroke animation |
| [`login-live-model.ts`](login-live-model.ts) | Pure Live rules: `liveArrivalNoticeFor` (session end), `signInFailureFor` / `signInFailureFacts` (rejected sign-in), `readinessOf`, `isCoreStarting`, health refetch intervals |
| [`login-model.ts`](login-model.ts) | Pure view model: `coreLinkFor`, `isCoreBlocked`, `ringStateFor`, `ringSizeFor`, `emblemSizeFor`, field error keys, idle timeout and verify beat constants |
| [`login-motion.ts`](login-motion.ts) | `revealProps`: Motion props for each element's enter and hand-off fade |
| [`login.css`](login.css) | Page styles per tier (`data-tier`); only transform and opacity animate |
| [`mode-selector.tsx`](mode-selector.tsx) | `ModeSelector`: the "Simulated / Live" toggle; renders nothing unless the build offers the choice |
| [`report.ts`](report.ts) | Structured error records of the page (`buildLoginLogEntry`, `reportLoginIssue`, `recordLoginIssue`) to the page's own log `webErrorSink` |
| [`sim-adapter.ts`](sim-adapter.ts) | Simulator reads: `usePresentationMode`, `readLastAuthEvent` |
| [`use-login-controller.ts`](use-login-controller.ts) | `useLoginController`: the page's behaviour and states (Idle, Validating, Submitting, Error, Locked out, Core offline, Signed out or expired, Success) |
| [`use-login-tier.ts`](use-login-tier.ts) | `useLoginTier`: the layout tier and the tall flag from the window size |

## Main exports

- Screen: `LoginPage` (`index.tsx`), root test ID `page-login`, with `AuthCard`, `BrandSide`, `LoginBackdrop`, `DeviceStrip`, `LoginAlert`, `LoginEmblem`, `ModeSelector`.
- Hooks: `useLoginController`, `useLoginTier`, `useGradedStill`.
- Model: `login-model.ts` and `login-live-model.ts` (pure functions, no credential in any output).
- Live readers: `useLiveCoreHealth`, `useLivePanelFirmware` (`live-adapter.ts`).

Routes: `/login` (route file `src/routes/login.tsx`).

## Core operations, state and shared modules

- Sign-in through the `signIn` and `signInWithSecurityKey` actions of `useCoreActions()`, handled with `settle`.
- Operation 1 (the Core's identity in the device strip), operation 114 (front panel firmware, public).
- Health: the console's one health reader in [`src/lib`](../../lib/) (`health-query`, `panel-firmware-query`).
- State slices read with `useSim`: `device`, `time`, `operators`, `pairing`.
- Shared modules: `@dems/shared/api`, `@dems/shared/brand`, `@dems/shared/live`, `@dems/shared/realtime`, `@dems/shared/sim`, `@dems/shared/tokens`, and the hero still from `@dems/shared/assets`.
- Console folders used: [`src/components/shell`](../../components/shell/) (`mode-switch`, `shell-entrance`, `shared-layout-ids`), [`src/components/composed`](../../components/composed/) (glow ring), [`src/components/ui`](../../components/ui/) (border beam, particles, text effect, sliding and animated numbers), [`src/lib`](../../lib/) (`core-endpoint`, `core-errors`, `presentation-mode`, `product-versions`, `utils`), [`src/motion`](../../motion/), [`src/runtime`](../../runtime/).

## Tests

- [`__tests__/`](__tests__/): `login-model.test.tsx`, `login-page.test.tsx`, `panel-firmware-cell.test.tsx`.
- In `src/test`: [`live-login-model.test.tsx`](../../test/live-login-model.test.tsx), [`live-login-page.test.tsx`](../../test/live-login-page.test.tsx), [`live-login-signin.test.tsx`](../../test/live-login-signin.test.tsx), [`live-login-presentation.test.tsx`](../../test/live-login-presentation.test.tsx), [`dev-console-logging.test.tsx`](../../test/dev-console-logging.test.tsx).

## Related decisions

- D25, D47: production console lock; the production web login offers no Simulated mode.
- D34: unused imports in `auth-card.tsx` (typecheck finding DF-52).
