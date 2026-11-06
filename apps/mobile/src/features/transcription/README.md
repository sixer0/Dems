# `apps/mobile/src/features/transcription`

Up: [`src/features/`](../README.md)

## Purpose

The read-only transcription status section of Settings: enabled, backend, model, speaker labelling and whether a credential is set, as the Core reports them through `getSttConfig`. The settings are changed in the web console; this device only shows them and re-reads on realtime signals with a backstop timer.

## Contents

| Entry | Role |
|---|---|
| `i18n.ts` | English copy of the `transcription` feature, mounted at `features.transcription.*` through `src/i18n/features.ts`. |
| `stt-status-model.test.ts` | Test: The pure view model of the transcription status. |
| `stt-status-model.ts` | Pure view model of the Settings transcription status. No React: unit-tested in `stt-status-model.test.ts`. |
| `stt-status-section.test.tsx` | Test: The read-only transcription status in the SIMULATED source (the in-app simulator answers operation 90) and in the LIVE source (the typed client over the contract-checked fake transport). |
| `stt-status-section.tsx` | Settings → Transcription status. READ-ONLY on this device: the block draws enabled, backend, model, speaker labelling, whether a credential is set, the last connection test and the "applies to the next session" note. ... |
| `stt-status-static.test.ts` | Test: Static guards over the production files of `features/transcription/`. |
| `use-stt-config.ts` | Reads the transcription configuration (`getSttConfig`) with a backstop timer next to the realtime signals. |

## Main exports

- Hooks: `useSttConfig`.
- Components: `TranscriptionSection`, `SttStatusBlock`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectIsSignedIn`, `selectSttAuditMark`.
- Operations called directly on the Live client (`useMobileLive()?.client.call`): `getSttConfig` (`use-stt-config.ts`).

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

3 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
