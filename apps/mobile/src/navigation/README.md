# `apps/mobile/src/navigation`

Up: [`src/`](../README.md)

## Purpose

The navigation shell: the root navigator with the auth guard and the pairing gate, the route registry (tabs on phones and tablets), stacks, master-detail selection, deep-link parameter parsing, the pending href of a guarded link, session guards and session-state routing, the back guard, the route error fallback and the rail collapse preference.

## Contents

| Entry | Role |
|---|---|
| [`__tests__/`](__tests__/) | Tests of this folder. |
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `app-tabs.tsx` | Every tab route as a trigger. The navigator always holds all nine, so a route keeps its URL on every device; the chrome shows five on phones and eight on tablets (H-MB-01: a route stays a tab without a visible ... |
| `back-guard.tsx` | Back-guard infrastructure. The session screens own their dialogs and decide when the guard is on; this hook owns the mechanics: - `mode: 'confirm'` |
| `i18n.ts` | Copy owned by the navigation shell, registered in `src/i18n/features.ts` under `navigation`, so it resolves as `features.navigation.*`. |
| `index.ts` | Public surface of the navigation shell (re-exports). |
| `log.ts` | Structured issue reporting for the navigation shell. Same record shape and policy as the motion kit's log: there is no client error-log endpoint in this demo (D41(g)), so the default sink writes one structured record ... |
| `master-detail.ts` | Master-detail routing. One list route holds the selection in `?selected=`; the detail also has its own route for single-pane windows: - multi-pane (medium, expanded) |
| `new-session-blocked.test.tsx` | Test: "New Session explains why it is unavailable instead of failing with a toast". |
| `not-found-screen.tsx` | Screen of the `+not-found` route. |
| `params.ts` | Deep-link and route parameter parsing (04_mobile_specs §3.1 "useLocalSearchParams parsing (zod)", §3.5 deep links; step 70). |
| `pending-href.ts` | The pending href of 04_mobile_specs §3.3: a guarded URL that arrived while no operator was signed in. The `Stack.Protected` guard then shows `/login` (the guarded `(app)` group is not in the navigator, so Expo Router ... |
| `rail-prefs.ts` | The extended rail's collapse preference. The key is shared with the motion kit (`reduceMotion`, `haptics`), the Core link source and presentation mode. This module owns one field, `railCollapsed`, and writes it only ... |
| `root-navigator.tsx` | The root stack with the auth guard and the pairing-required gate, rendered by `src/app/_layout.tsx` inside the providers: - public: `/` (boot router), `/stack-check`, `/pair`, plus `/dev-gallery` (debug) and ... |
| `route-error-fallback.tsx` | The route error screen of the Expo Router error boundary (`app/_layout.tsx` `ErrorBoundary`) |
| `routes.ts` | Route registry of the navigation shell. One place for: the tab destinations and their chrome (bottom bar on phones, rail on tablets), the screen id of every route, and which URL paths are public or guarded. Route ... |
| `screen-stub.tsx` | Placeholder body for a route whose screen step has not run yet. It renders the real screen root (`SafeScreen`, so the `screen-<id>` testID and the safe-area behaviour are the final ones), a one-line label and the ... |
| `session-guards.ts` | Deep-link policies of the session flow: - `/session/new` is refused while a session is busy (RECORDING, STOPPING, FINALIZING, FAULT, RECOVERY) |
| `session-routes.ts` | Session-state routing. `sessionResyncHref` is the §3.7 table as a pure function: where a session in a given state belongs. The boot router uses it for the post-sign-in precedence, the session routes use it for their ... |
| `stack-check-route.tsx` | The row-18 proof screen as a route: `/stack-check`, and `/` whenever the URL carries `?motion=`. |
| `stacks.tsx` | The stacks of the shell: auth stack, app stack, session flow stack and drill-in stack. |
| `tab-root.ts` | Finds the tab of an href and opens a tab at its root. |

## Main exports

- Public surface (`index.ts`): `ALL_TABS`, `MORE_TABS`, `PHONE_TABS`, `ROUTE_SCREENS`, `TABLET_TABS`, `TAB_DESTINATIONS`, `activeDestination`, `isGuardedPath`, `tabForSegments`, `MAX_HREF_LENGTH`, `SETTINGS_SECTIONS`, `firstParam`, `hasMotionParam`, `parseRecordId`, `parseScenario`, `parseSessionStep`, `parseSettingsSection`, `recordIdSchema`, `scenarioSchema`, `sessionStepSchema`, `settingsSectionSchema`, `toInternalHref`, `SIGN_IN_PATH`, `clearPendingHref`, `peekPendingHref`, `recordIncomingLink`, `setSignedInSnapshot`, `isSessionActive`, `isSessionBusy`, `postSignInHref`, `sessionResyncHref`, `useSessionLiveRedirect`, `useSessionNewRedirect`, `BootRedirect`, `RootNavigator`, `useBootHref`, `BackGuardDialog`, `useBackGuard`, `useDetailPaneHandover`, `useSelectionPush`, `findTabNavigation`, `tabForHref`, `useOpenTabRoot`, `AppTabs`, `TAB_TRIGGERS` and 10 more.
- Screens: `NotFoundScreen` (`not-found-screen.tsx`).
- Hooks: `useBackGuard`, `useSelectionPush`, `useDetailPaneHandover`, `useRailCollapse`, `useBootHref`, `useSessionNewRedirect`, `useSessionLiveRedirect`, `useOpenTabRoot`.
- Components: `AppTabs`, `BackGuardDialog`, `RootNavigator`, `BootRedirect`, `RouteErrorFallback`, `ScreenStub`, `StackCheckRoute`, `AuthStack`, `AppStack`, `SessionFlowStack`, `DrillInStack`.

## Tests

1 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
More tests are in [`__tests__/`](__tests__/).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
