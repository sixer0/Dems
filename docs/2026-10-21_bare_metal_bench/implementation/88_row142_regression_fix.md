# Row 142 (new, controller): the open R-FLEX test regression of handoff §3

Date: 2026-10-22, host .73 (controller: Claude Code on the Windows workstation over SSH, D29/D30/D32).

## What failed
`npx vitest run --root apps/core-server --project unit src/capture/adapters/audio/__tests__/card-listing.test.ts src/capture/adapters/audio/__tests__/usb-audio-macos.test.ts` on host .73 before the fix: `Tests 23 failed | 53 passed (76)` - the same 22 + 1 the Mac run of row 115 reported.

## Root causes (no production code at fault)
1. `card-listing.test.ts` (22): R-FLEX added the required member `boundTo` (nullable, not optional) to `CaptureAudioCardSchema` (`packages/shared/src/api/capture-audio-cards.ts`). The adapter's listing has no `boundTo`; the Core's service adds it (`apps/core-server/src/modules/capture-inputs/audio-cards/service.ts:317`). The test's local helper `asAnswer` (line 118), which builds the operation-98 answer from a listing card, was not updated, so every `CaptureAudioCardSchema.safeParse(asAnswer(card))` failed. `macos-card-listing.test.ts` had been updated by row 107; this file was missed.
2. `usb-audio-macos.test.ts` (1): the enumerate test used, as its NOT-present microphone, a serial-less unit of the same model on another socket. Under D10 (1) (no port lock; row 107) that unit IS the stored card, so `present: true` is the specified behaviour.

## Change (tests only)
- `card-listing.test.ts:118`: `asAnswer` returns `boundTo: null` (the schema's rule: with `registered: []`, `boundTo` is null).
- `usb-audio-macos.test.ts:783`: MIC-02 is another model (`product: 0x0016`), not another socket; a two-line comment cites row 107 / D10 ruling 1.

## Evidence after the fix
`npx vitest run --root apps/core-server --project unit --maxWorkers=2 src/capture/adapters/audio/` -> `Test Files 10 passed (10)`, `Tests 345 passed (345)`.
