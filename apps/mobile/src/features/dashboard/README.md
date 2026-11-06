# `apps/mobile/src/features/dashboard`

Up: [`src/features/`](../README.md)

## Purpose

Home (Dashboard) at `/home`: the header with the bell and the Core link chip, the System Status card, the status tiles, the camera and microphone tiles (live preview thumbnails and meters), Quick Actions (Start Session, gated by role) and Recent Sessions. `home-model.ts` maps the store to what the screen shows.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `dashboard-route.test.tsx` | Test: Home through the REAL route tree: `/home` renders the Dashboard inside the tab chrome on every layout class, with the MA-12 ids on the tablet (`nav-rail` with 8 destinations, the `pane-*` zones) and the MB 2 regions ... |
| `dashboard-screen.test.tsx` | Test: Home (Dashboard) render test. The screen renders inside the real AppProviders with an injected, hydrated test simulator; expo-router's hooks are mocked, Skia is step 71's module mock. |
| `dashboard-screen.tsx` | Home (Dashboard) at `/home`. |
| `development-source-tiles.test.tsx` | Test: Tests "Home tiles: the development-source badge (LIVE)". |
| `device-tiles.test.tsx` | Test: The tablet Home camera tiles 3 and 4 were bound to camera 1 - `device-tiles.tsx` derived the camera as `VIDEO-02 ? 2. |
| `device-tiles.tsx` | Tablet (expanded) device tiles 2x2: Camera 1 and Camera 2 with a live `CameraFeed` thumbnail, MIC 1 and MIC 2 with a C-2 `compact` meter fed by the transient 20 Hz shared values and a 1 Hz dBFS line. Tap → the device ... |
| `home-header.tsx` | H1 header of Home, compact (phone) and expanded (tablet) variants. |
| `home-live.test.tsx` | Test: Home in LIVE mode, drawn on the app's own Live source over the contract-checked fake transport (`testing/live-home-bed`). |
| `home-mic-tiles-live.test.tsx` | Test: The tablet Home MIC tiles in LIVE mode, on the app's own Live source over the contract-checked fake transport (`testing/live-home-bed`). |
| `home-model.test.ts` | Test: Home view model and choreography. |
| `home-model.ts` | Home (Dashboard) view model. Pure: every function maps simulator values to what the screen shows, so the rules are tested without React. - H2 status: `SystemStatus` (`selectSystemState`) → ring state, tone, copy ... |
| `home-more-live-static.test.ts` | Test: Tests "Home and More take the Core through the light Live API (CLG c, AC-C-53)". |
| `home-motion.ts` | Home choreography. Enter beats, in ms from route enter: 0 header; 120 status card; 250 tiles (stagger 50, values tick after the 120 ms held beat, which RollingNumber `count` owns); 450 quick actions; 650 recent ... |
| `home-notice-tiles.test.tsx` | Test: Tests "the contract of the open notice (contract_wave_l.md section 1), read by name". |
| `i18n.ts` | English copy of the `dashboard` feature, mounted at `features.dashboard.*` through `src/i18n/features.ts`. |
| `panel-boundary.test.tsx` | Test: Home panel error boundary: fallback copy, a persisted log record and a rate-limited retry. |
| `panel-boundary.tsx` | Panel error boundary for Home (web Dashboard parity: `common.errors.panelTitle` "This panel could not be displayed"). |
| `quick-actions.tsx` | H4 Quick Actions (04_mobile_specs §4.3; MB 2 (352–592, 245–320)). |
| `recent-sessions.tsx` | H5 Recent Sessions (04_mobile_specs §4.3; MB 2 (352–592, 335–488)) |
| `session-start-home.test.tsx` | Test: Tests "session start home". |
| `status-card-layout.test.tsx` | Test: Tests "the Home status card and the shared layout transition". |
| `status-chip-row.tsx` | Tablet chip row "Security, Time & Network". |
| `status-tiles.tsx` | H3 status tiles ×3 (04_mobile_specs §4.3; MB 2 (352–592, 170–232)) |
| `system-status-card.tsx` | H2 System Status (04_mobile_specs §4.3; MB 2 (352–592, 88–160)) and its tablet hero variant. - Phone: `SectionCard` "System Status" with a C-1 GlowRing `mini` (72 dp) around the state shield, the state title in the ... |
| `use-held-value.test.tsx` | Test: The Home held-beat value (DR-S77-1) |
| `use-held-value.ts` | The "values tick after the held beat" rule for Home's numbers, for C-6 RollingNumber in `slide` mode: the first render shows 0, the real value arrives once `delayMs` has passed (the card has settled plus the 120 ms ... |
| `use-home-data.ts` | Simulator reads for Home. The engine publishes a new state on every 50 ms tick, and `useSim` re-renders only when the selected value changes (shallow), so every selector here returns primitives, or arrays of ... |

## Main exports

- Screens: `DashboardScreen` (`dashboard-screen.tsx`).
- Hooks: `useHeldValue`, `useHomeStatus`, `useHomeSession`, `usePrimaryAction`, `useElapsedSeconds`, `useHomeTiles`, `useRecentRows`, `useSealedToday`, `useAlertSummary`, `useChipRow`, `useDeviceTiles`.
- Components: `DeviceTiles`, `HomeHeader`, `QuickActions`, `RecentSessions`, `StatusChipRow`, `StatusTiles`, `SystemStatusCard`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectClockSecond`, `selectConnectingCameras`, `selectDeviceStats`, `selectElapsedMs`, `selectOperator`, `selectOperatorById`, `selectPendingSummaryId`, `selectRecentSessions`, `selectSealedToday`, `selectStorage`, `selectSystemState`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `acknowledgeAlert`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

13 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D189: row 209: Home microphone tiles (needs-review).
- D194: row 209: Home microphone tiles, pair words.
- D253: row 230: each Home tile follows its own VIDEO-0N.
- D254: row 231: an unfocused Home tile releases the camera preview.
