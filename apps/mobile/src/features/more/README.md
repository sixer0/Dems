# `apps/mobile/src/features/more`

Up: [`src/features/`](../README.md)

## Purpose

More at `/more`: the operator card, the console tiles (on phones the Audit, Storage, Network & Time and Settings tabs have no visible trigger, so More is their entrance), secondary links and the footer with the Core link chip and the app version.

## Contents

| Entry | Role |
|---|---|
| `console-tiles.tsx` | Console launcher: on phones these four tab routes have no visible trigger (H-MB-01), so More is their entrance. Each is a pressable tile in the panel language (warm L2 surface, bronze hairline, gold icon badge, ... |
| `i18n.ts` | English copy of the `more` feature, mounted at `features.more.*` through `src/i18n/features.ts`. |
| `more-boundary.tsx` | Section error boundary for More. One failing section (operator card, console tiles, links, footer) never blanks the screen: 1. |
| `more-links.tsx` | Secondary destinations and the footer of More. MB 10 grouped-row language: a kit `ListGroup` inside a section card, gold icon badge, title, muted description, status chip and chevron. Rows (`linkDestinations`) |
| `more-live.test.tsx` | Test: More in LIVE mode, drawn on the app's own Live source over the contract-checked fake transport (the bed of `features/dashboard/testing/live-home-bed`). |
| `more-model.ts` | More screen model. Pure: which destinations the screen lists for a layout class and a session state, their hrefs, the tones of the live status chips, and the flat `useSim` selectors (F74-13: primitives only). |
| `more-screen.test.tsx` | Test: More render test. The screen renders inside the real AppProviders with an injected, hydrated test simulator; expo-router's `useRouter` is mocked. |
| `more-screen.tsx` | More at `/more`. |
| `operator-card.tsx` | Operator header card (04_mobile_specs §4.17 "an operator header card (Avatar, name, role)"; MB 10 Account row language). |
| `use-core-link-chip.test.tsx` | Test: The one rule of the two Core link chips (Home header `home-core-link`, More footer `more-core-link`), and the chip's LIVE "Offline" decided by the runtime's no-flicker rule. The hook is driven ... |
| `use-core-link-chip.ts` | The Core link chip of Home (header) and More (footer). |
| `use-more-navigate.ts` | Navigation from More. `router.push('/storage')` and the other console routes turn into tab jumps on phones (the routes are tabs with hidden triggers), and `backBehavior="history"` brings Back to More. Console jumps ... |

## Main exports

- Screens: `MoreScreen` (`more-screen.tsx`).
- Hooks: `useCoreLinkChip`, `useMoreNavigate`.
- Components: `ConsoleTiles`, `MoreLinks`, `MoreFooter`, `OperatorCard`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectAuditChainBreak`, `selectAuditCount`, `selectChainBroken`, `selectClockSecond`, `selectCoreName`, `selectLinkUp`, `selectPairingState`, `selectSessionStateFlat`, `selectSignedInAt`, `selectStorageState`, `selectTimeLocked`, `selectTimeSource`, `selectUsedPercent`.

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

3 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
