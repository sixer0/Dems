# `apps/mobile/src/features/session-summary`

Up: [`src/features/`](../README.md)

## Purpose

The Session Summary at `/session/summary/[sessionId]`: the sealed tracks in order, hashes (full value in a sheet), sizes, time source, the lifecycle stages, the sealed members of a schema-v2 item with the signature mark, and the acknowledgement. The SEALED stamp plays once per session per app process.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `hash-sheet.tsx` | Full hash value sheet (04_mobile_specs §4.7 "Tapping a hash opens a BottomSheet with the full value as `Text selectable` (long-press copy is native; no clipboard dependency is added)"). |
| `i18n.ts` | English copy of the `session-summary` feature, mounted at `features.session-summary.*` through `src/i18n/features.ts`. |
| `interrupted-seal.test.tsx` | Test: Tests "an interrupted seal on the Session Summary". |
| `live-summary-sites.test.tsx` | Test: The Session Summary in LIVE mode — settle site S2-4 (the acknowledgement, operation 37 `acknowledgeSessionSummary`, through Done, View in Evidence and Back) and S4-4 (whether a request is ... |
| `sealed-members.test.tsx` | Test: Tests "SealedMembersCard (MB-05)". |
| `sealed-members.tsx` | MB-05 Session Summary: the sealed members of a schema-v2 item. What the Core's seal states and the Summary did not show: per camera file the hash of the stored bytes and of the decrypted bytes, the transcript hash, ... |
| `session-summary-screen.test.tsx` | Test: Session Summary. Renders the real `/session/summary/[sessionId]` route with a test simulator whose session 0024 has just been sealed (summary pending). |
| `session-summary-screen.tsx` | Session Summary at `/session/summary/[sessionId]`; step 80. Replaces step 70's stub; the export name, the props and the `SafeScreen id="session-summary"` root stay. Regions: - Hero: the violet SEALED stamp (M-C-09: ... |
| `sim-adapter.ts` | Local simulator adapter of the Session Summary: the time source at an instant. |
| `stamp-once.ts` | The SEALED stamp plays once per session per app process. Without this, re-opening an unacknowledged summary (a relaunch resync, Back from Evidence before acknowledging) would replay the stamp and its Success haptic. ... |
| `summary-handoff-in-place.test.tsx` | Test: Tests "RF-PH-3: the Summary after the sealed hand-off is drawn in place". |
| `summary-handoff.ts` | The sealed-to-Summary hand-off without an empty frame. 9 of 18 phone runs showed ONE empty frame (7-109 ms) between the "Evidence sealed" card and the Session Summary; never at monitor -> Finalizing, whose incoming ... |
| `summary-live-static.test.ts` | Test: Static tests over the production files of `features/session-finalizing/`, `features/session-summary/` and `features/sessions/` (client gate CLG item (c), AC-C-53; ... |
| `summary.model.test.ts` | Test: Session Summary maths and the SIM-GAP-M80-1 adapter. |
| `summary.model.ts` | Session Summary maths. Pure: no React, no simulator instance. `use-summary.ts` reads the simulator and these functions shape what the screen shows; the tests check them directly. |
| `use-sheet-presence.tsx` | Mount-on-demand for the kit BottomSheet: a COPY of step 79's `features/session-live/use-sheet-presence.tsx`. |
| `use-summary.ts` | Session Summary data and the acknowledgement. Selectors return primitives or the store's own references, so `useSim`'s shallow compare keeps the screen quiet while the simulator ticks audio at 20 Hz. ... |

## Main exports

- Screens: `SessionSummaryScreen` (`session-summary-screen.tsx`).
- Hooks: `useSummarySignature`, `useSheetPresence`, `useSummarySession`, `useSummaryEvidence`, `useSummaryFinalization`, `useAcknowledgeSummary`.
- Components: `HashSheet`, `SealedMembersCard`, `SummarySignatureMark`, `SummarySignatureKeyLine`, `SheetContentSignal`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectEvidenceBySessionId`, `selectOperatorById`, `selectPendingSummaryId`, `selectSessionHistoryById`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `acknowledgeSummary`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

7 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D180: row 204: `TRACK_ORDER` widened to 8 tracks.
