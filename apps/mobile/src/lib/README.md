# `apps/mobile/src/lib`

Up: [`src/`](../README.md)

## Purpose

Small shared helpers that are not a feature: the version a footer shows, the Core's component versions (operation 64 `getSystemStatus`), the hand-off mark between two session screens, the soft keyboard rules, list position keeping, operator-scoped query keys, confirmed bottom-sheet opening and the tone icon map.

## Contents

| Entry | Role |
|---|---|
| `app-version.test.ts` | Test: Tests "shownVersionOf". |
| `app-version.ts` | WHICH VERSION A FOOTER SHOWS. The Login footer, the rail's foot and the More page printed `SOFTWARE_VERSION` - the DEMONSTRATION device model's "2.4.1" - on every Core, also one in its own capture, where it is the ... |
| `core-components.test.ts` | Test: Tests "coreComponentsOf". |
| `core-components.ts` | The versions of the components of THIS Core (fix wave J round two; JW-26 mobile half; contract_wave_j.md "J2-S 2") |
| `handoff-mark.test.ts` | Test: The one-slot hand-off mark: the rule the three hand-offs of a session share. |
| `handoff-mark.ts` | The "one slot" mark of a hand-off between two screens of one session: the three copies in `session-live/monitor-handoff.ts`, `session-finalizing/handover.ts` and `session-summary/summary-handoff.ts` are this one ... |
| `keyboard-guard.tsx` | Rule 2 of `./keyboard` (fix wave Q; JT-23 original, CT-06, CP-13) |
| `keyboard.ts` | The soft keyboard's ONE rule: 1. |
| `list-position.ts` | How the Evidence list and the Sessions hub hold their place when rows are added. JM-03 (wave J) |
| `live-static-ac-c-53.test.ts` | Test: The app-wide static test of AC-C-53 for the mobile app. AC-C-53: "No production file under ... |
| `operator-query-scope.tsx` | The operator in the key of every cached answer that depends on who asked (fix wave K, driver M2; gate finding G81b-02, ruling D221 (3)). |
| `sheet-open.test.tsx` | Test: Tests "useConfirmedOpen". |
| `sheet-open.ts` | A kit bottom sheet whose open is CONFIRMED. The kit asks the sheet library to slide in ONCE, when its `isOpen` turns true, and the library drops that request without a word while its own first layout is not finished ... |
| `tone-icons.ts` | Resolves the lucide icon names stored in @dems/shared to lucide-react-native components. |

## Main exports

- Hooks: `useShownVersion`, `useCoreComponents`, `useTopOnQueryChange`, `useOperatorId`, `useConfirmedOpen`.
- Components: `KeyboardGuard`, `OperatorQueryScope`.

## Tests

5 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
