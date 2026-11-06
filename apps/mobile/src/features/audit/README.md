# `apps/mobile/src/features/audit`

Up: [`src/features/`](../README.md)

## Purpose

The Operator Audit View at `/audit`: the audit log, newest first, with category chips, severity and operator filters, search, a live/paused feed, the hash-chain status strip and a sheet with one entry in full (event JSON, previous and current hash). In Live mode the Verify button sends operation 60 `verifyAuditChain` and the chain lines come from the Core.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `audit-boundary.tsx` | Region error boundary for the Audit view (the Network & Time card boundary's pattern, copied; P6: another feature's files are not shared code). |
| `audit-capture-labels.test.ts` | Test: Audit tab and the capture-phase audit types: every type the Core can write has a label in the app's resources, and a capture-configuration change reads its change from the row's own detail keys. |
| `audit-entry-detail.tsx` | One audit entry in full (04_mobile_specs §4.16 "Row → BottomSheet with the event JSON (mono, selectable) and the previous and current hashes"). |
| `audit-filters.tsx` | Audit controls. Category is the chip row (MB 5 filter chips); severity and operator sit in one "More filters" `Menu` so the phone keeps a single control row. With Live off, a "N new entries · Resume live" button appears. |
| `audit-live-static.test.ts` | Test: Tests "Operator Audit takes the Core through the light Live API (CLG c, AC-C-53)". |
| `audit-model.test.ts` | Test: Audit view model: newest-first filtering, the actor rule shared with the web page, the fault / method facts, the chain-link status and the strip's pinned older break. Real simulator rows, no React. |
| `audit-model.ts` | Pure view-model logic of the Operator Audit View. No React, no i18n: the screen passes the translated text it shows into `filterAuditRows`, so search matches what the operator reads (event labels by code, never the ... |
| `audit-row-deselect-drawn.test.tsx` | Test: Tests "W93-2: the Audit row that loses the selection is still drawn (tablet landscape)". |
| `audit-row.tsx` | One audit list row (04_mobile_specs §4.16 "rows: time (mono), event, actor, category Chip, chain-link dot"; brief: short hash column). |
| `audit-screen.test.tsx` | Test: Operator Audit View. Real route file, real providers, real simulator. |
| `audit-screen.tsx` | Operator Audit View at `/audit`. |
| `audit-sheet.tsx` | Phone entry sheet. The kit BottomSheet with the step-79 mount-on-demand pattern: mounted on request, opened one frame after its content's first layout, unmounted after the exit animation. Two device findings of step ... |
| `audit-tones.ts` | Status tones of the Audit view. |
| `chain-live.tsx` | Live-mode parts of the Audit view: `LiveChainLines` and `AuditLinkNotice`. |
| `chain-strip.tsx` | Hash-chain status of the Audit view: `ChainStatusChip`, `ChainStrip`, `TamperAlert`. |
| `i18n.ts` | English copy of the `audit` feature, mounted at `features.audit.*` through `src/i18n/features.ts`. |
| `live-audit-chain.test.tsx` | Test: The Operator Audit view in LIVE mode — settle site S1-7 (Verify, operation 60 `verifyAuditChain`) and S4-3 (its time stamp on the Live clock), on the app's real Live source over the ... |
| `live-audit-screen.test.tsx` | Test: What the Operator Audit view SHOWS in LIVE mode, on the app's real Live source over the contract-checked fake transport (`testing/live-audit-bed`), and that Simulated mode shows what it ... |
| `use-audit-data.ts` | Simulator reads for the Operator Audit View. Relay F74-13 (flat selectors) |
| `use-sheet-presence.tsx` | Mount-on-demand for kit sheets. Copied from step 79 (`session-live/use-sheet-presence.tsx`) for the Audit entry sheet. Step 79 finding F-79-2. |

## Main exports

- Screens: `AuditScreen` (`audit-screen.tsx`).
- Hooks: `useAuditRingRows`, `useAuditTotal`, `useAuditHead`, `useChainBreakSeq`, `useAuditOperators`, `useAuditText`, `useAuditFeed`, `useSheetPresence`.
- Components: `AuditEntryDetail`, `AuditFilters`, `AuditSheet`, `LiveChainLines`, `AuditLinkNotice`, `ChainStatusChip`, `ChainStrip`, `TamperAlert`, `SheetContentSignal`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectAuditChainBreak`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `verifyAuditChain`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

7 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
