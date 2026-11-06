# `apps/mobile/src/features/storage`

Up: [`src/features/`](../README.md)

## Purpose

Storage at `/storage`: the capacity card and ring, the storage indicators (write speed, session size, time remaining), recent storage activity and the Manage Storage sheet (retention policy, auto-archive), which sends the `setStoragePolicy` action. A rise of the volume state (READY, LOW, FULL) raises one toast and one haptic.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `capacity-card.tsx` | T2 Capacity card (04_mobile_specs §4.13; MB 8 (645–890, 648–780)) |
| `capacity-ring.tsx` | Capacity donut (04_mobile_specs §4.13 T2; §7.4 M-C-03; MB 8 ring at (645–760, 655–775)). |
| `i18n.ts` | English copy of the `storage` feature, mounted at `features.storage.*` through `src/i18n/features.ts`. |
| `live-storage-sites.test.tsx` | Test: Storage in LIVE mode — settle site S2-6 (Apply in the Manage Storage sheet, operation 55 `setStoragePolicy`) with its success, its refusal, the Core's 422, an outage, a dead link and a ... |
| `manage-storage-sheet.tsx` | T4 Manage Storage sheet. - Retention: kit `RadioGroup` over the four simulator policies. - Auto-archive: kit `Switch`. |
| `panel-boundary.tsx` | Panel error boundary for Storage: a copy of step 77's `features/dashboard/panel-boundary.tsx` (P6; web parity: `common.errors.panelTitle` "This panel could not be displayed"). |
| `sim-adapter.ts` | Local simulator adapter for the mobile Storage screen (P6: screens never write `packages/shared/src/sim`). |
| `storage-activity.tsx` | T3 Recent Storage Activity (04_mobile_specs §4.13; MB 8 (645–890, 788–905)) |
| `storage-kpis.tsx` | Storage indicators: write speed, session size and est. remaining, computed from free space at 8.2 GB/h. |
| `storage-live-static.test.ts` | Test: Tests "Storage takes the Core through the light Live API (CLG c, AC-C-53)". |
| `storage-model.test.ts` | Test: Storage maths and the SIM-GAP-M85 adapter. |
| `storage-model.ts` | Storage screen model. Pure functions only, so the screen test and the model test pin the exact MB 8 numbers: ring 20% USED, "3.2 TB Free" of 4.0 TB, Used 804 GB, est. remaining 389h 45m at 8.2 GB/h. |
| `storage-motion.ts` | Storage choreography. Enter beats, ms from route enter: 0 header; 80 capacity card; 200 ring sweep (the hero moment, 120 ms into the card as on the web page, 900 ms `luxe`); 260 legend rows (stagger 60); 420 KPIs; ... |
| `storage-screen.test.tsx` | Test: Storage screen render test. The screen renders inside the real AppProviders with an injected, hydrated test simulator; expo-router's hooks are mocked, Skia is step 71's module mock and the gorhom sheet is the ... |
| `storage-screen.tsx` | Storage at `/storage`. |
| `use-held-value.ts` | Copy of step 77's `features/dashboard/use-held-value.ts` (P6; DR-S77-1), used for the Storage ring's centre %, which rolls in with the sweep. The "values tick after the held beat" rule, for C-6 RollingNumber in ... |
| `use-sheet-presence.tsx` | Mount-on-demand for kit sheets: a copy of step 79's `features/session-live/use-sheet-presence.tsx`. |
| `use-storage-alerts.ts` | M-PG-STOR data moment: a rise of the evidence volume state (READY → LOW → FULL) morphs the ring colour with ONE pulse, raises one toast and one haptic. Calm escalation: nothing loops, nothing fires on mount, a ... |
| `use-storage-data.ts` | Simulator reads for the Storage screen. `useSim` re-renders only when the selected value changes (shallow), so every selector returns primitives, flat objects of primitives, or arrays of store-owned objects (F74-13). |

## Main exports

- Screens: `StorageScreen` (`storage-screen.tsx`).
- Hooks: `useActivityText`, `useHeldValue`, `useSheetPresence`, `useSheetBack`, `useEscalationKey`, `useStorageAlerts`, `useStorageCapacity`, `useEvidenceCounts`, `useStorageKpis`, `useStoragePolicy`, `useStorageActivity`.
- Components: `CapacityCard`, `CapacityRing`, `ManageStorageSheet`, `ManageStorageBody`, `StorageActivity`, `StorageKpis`, `SheetContentSignal`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectEvidenceStats`, `selectFaultSessionId`, `selectStorage`, `selectStorageActivity`, `selectStoragePolicy`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `setStoragePolicy`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

4 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D182: row 203: storage activity row of a session still in FAULT.
