# `apps/mobile/src/features/settings`

Up: [`src/features/`](../README.md)

## Purpose

Settings at `/settings` and one section at `/settings/[section]` (a pane on tablets): Account and Profile sheet, App Preferences, Notifications, Security & Privacy (biometric switch, pairing, Core address shown read-only), Capture (the device selector), Transcription status, System Maintenance and About. Settings-owned fields are written by merge into `dems.mobile.prefs.v1`.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `about-facts.test.tsx` | Test: "Tablet Settings > About TPM field: not found in two views of the screen - NOT PROVEN"). |
| `about-section.tsx` | Settings → About DEMS: product and device identity, the native app build (expo-constants), licences and credits (fonts OFL-1.1; the hero photo credit of THIRD_PARTY_NOTICES.md) in a sheet, and "Stack diagnostics" → ... |
| `core-link-switch.tsx` | Settings > App Preferences > "Core link source" control and its confirm dialog. |
| `heartbeat-release-gate.test.tsx` | Test: Release builds offer LIVE only: the Heartbeat and Simulated Core-link sources are debug-build options. Jest runs with `__DEV__ === true` (react-native's jest setup), so the release case flips the global for the test ... |
| `i18n.ts` | English copy of the `settings` feature, mounted at `features.settings.*` through `src/i18n/features.ts`. |
| `live-gap-s1-2-biometric.test.tsx` | Test: Live tests that name sites S1-2 and S1-3. |
| `live-settings-biometric.test.tsx` | Test: The biometric switch of Settings → Security & Privacy in LIVE mode — finding CPM1-1 of gateway_check/09 and AC-C-68 (04_client_integration_spec §9.3 MB-1, MB-2, MB-6a (3)). |
| `live-settings-boundary.test.tsx` | Test: Crossing the LIVE boundary from Settings → App Preferences → "Core link source". |
| `live-settings-sites.test.tsx` | Test: Settings in LIVE mode — settle site S2-7 (`useCoreCommand`, the callback form of B-10: Run diagnostics, operation 65; Install update, 67; the Demo controls, 73, 74, 52, 72, 33) and S5-7 ... |
| `maintenance-section.tsx` | Settings → System Maintenance: - Run diagnostics: starts (or rejoins) the simulator run and opens a sheet that follows the eight checks (SCR-02 `runDiagnostics`). |
| `notifications-section.tsx` | Settings → Notifications: one `Switch` per alert category, persisted by merge as `notifications` in `dems.mobile.prefs.v1`. |
| `preferences-section.tsx` | Settings → App Preferences: - Reduce motion: the in-app override of §7.7, through the motion kit. The OS setting is shown when it already reduces motion. - Haptics, through the same kit hook. - Presentation mode: ... |
| `profile-sheet.tsx` | Profile `BottomSheet` from the Account row: role, the role's demo permissions (S20), Lock console and Sign out. Portalled content cannot read the runtime contract, so the operator and the two actions come in as props ... |
| `section-body.tsx` | One Settings section's body, shared by the pushed section route (compact) and the right pane. |
| `security-section.tsx` | Settings → Security & Privacy: - Biometric sign-in `Switch` with the hardware and enrolment status, bound to the signed-in operator through the runtime auth (`useAuthSession().setBiometricEnabled`). |
| `settings-controls.tsx` | Building blocks of the Settings screens: the MB 10 group card (`ListGroup` with its title), a navigation row (icon, label, chevron), a `Switch` row and a segmented choice (`Tabs`, the pattern the monitor's settings ... |
| `settings-list.tsx` | The MB 10 list: header (back + "Settings"), the Account card (avatar initials, role, name, chevron → Profile sheet), Application (App Preferences, Notifications, Security & Privacy) and System (Device Settings, ... |
| `settings-live-model.test.ts` | Test: The pure parts of Settings in LIVE mode. The step-88 model test (`settings-model.test.ts`) is a baseline file and stays as it is; this file adds the new inputs. |
| `settings-live-static.test.ts` | Test: Tests "Settings takes the Core through the light Live API (CLG c, AC-C-53)". |
| `settings-model.test.ts` | Test: Pure Settings models and the prefs parser. |
| `settings-model.ts` | Pure view models for Settings. No React: unit-tested in `settings-model.test.ts`. |
| `settings-prefs.ts` | Settings-owned fields of the shared preferences key `dems.mobile.prefs.v1`. |
| `settings-screen.test.tsx` | Test: Settings screens. The screens render inside the real AppProviders with an injected, hydrated test simulator; expo-router's hook is mocked, and the kit's BottomSheet uses gorhom's mock (F-79-2. |
| `settings-screen.tsx` | Settings at `/settings`; step 88. Replaces step 70's stub; the export name, the props and the `SafeScreen id="settings"` root stay. - Compact and compact-landscape: the MB 10 list. A section row pushes ... |
| `settings-section-screen.tsx` | Settings section at `/settings/[section]`; step 88. Replaces step 70's stub; the export name, the props and the `SafeScreen id="settings-section"` root stay. Single-pane windows push this route from the list; on ... |
| `sheet-frame.tsx` | Kit `BottomSheet` frame for the Settings sheets. The step-79 findings apply (F-79-2) |
| `use-sheet-presence.tsx` | Mount-on-demand for kit sheets (copy of the session monitor's pattern, P6). |

## Main exports

- Screens: `SettingsScreen` (`settings-screen.tsx`), `SettingsSectionScreen` (`settings-section-screen.tsx`).
- Hooks: `useCoreLinkSwitch`, `useSettingsPrefs`, `useSheetPresence`.
- Components: `AboutSection`, `CoreModeDialog`, `MaintenanceSection`, `NotificationsSection`, `PreferencesSection`, `ProfileSheet`, `SectionBody`, `SecuritySection`, `GroupCard`, `NavRow`, `SwitchRow`, `SegmentRow`, `SectionStack`, `SettingsList`, `SettingsHeader`, `SheetFrame`, `SheetContentSignal`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectActiveFaults`, `selectDemoFlag`, `selectDevice`, `selectDiagnostics`, `selectPairingState`, `selectScenario`, `selectSessionState`, `selectUpdate`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `clearFault`, `inject`, `loadScenario`, `recover`, `resetClip`, `runDiagnostics`, `signOut`, `startSoftwareUpdate`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265). `security-section.tsx` read the configured address itself (to show or edit it), through the runtime's exports.

## Tests

10 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D168: row 197: About on own capture.
- D208: row 175: release offers Live only (`heartbeat-release-gate`, `live-settings-boundary` tests).
