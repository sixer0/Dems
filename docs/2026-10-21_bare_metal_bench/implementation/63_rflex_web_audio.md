---
row: 111 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete
spec: masterplan/01_specs_rflex_api_ui.md §3 with masterplan/01_specs_rflex.md §2.4/§6.2 (bundle M); decisions D16 (Q96-01 a, Q96-02-M, Q96-03 a)
---

# Row 111 - console sound-cards panel (R-FLEX)

## What changed
| File:line | Change |
|---|---|
| apps/core-web/src/features/devices/audio-cards.ts:113 | `holderOf`: reads `details.deviceId` of a refusal, accepted only if it matches `HARDWARE_DEVICE_ID_PATTERN`; carried as `AudioCardsFailure.holder` |
| audio-cards.ts (registerRefusal) | new refusal `ALREADY_BOUND` for 409 `AUDIO_CARD_ALREADY_BOUND` (W-A4) |
| audio-cards.ts:189 `withRegistration` | merged answer sets `boundTo = deviceId` and drops the microphone's old input entry (move, bundle M) |
| audio-cards.ts:212 `isAmbiguous` | W-A8 (Q96-03 a), client-derived: same non-null `usbId`, both `usbSerial` null/absent, same non-null `boundTo` |
| audio-cards.ts:223 `inputOffered` | Q96-01 a: free card all inputs; bound card only the holder's own input; move mode all; ambiguous none |
| audio-cards.ts:347, :388 | controller `moving` / `startMove` / `cancelMove`; body gets `release: true` only when the choice is on the card in move mode; move mode ends on list-again and on an accepted registration; `RegisterOutcome` gains `{ refusal: 'ALREADY_BOUND', holder }` |
| apps/core-web/src/features/devices/audio-cards-panel.tsx:81 | W-A1 chip `audio-card-bound-<key>` with `data-bound-to`; card `li` has `data-bound-to`, `data-moving`, `data-ambiguous` |
| audio-cards-panel.tsx:87 | W-A8 note `audio-card-not-tellable-<key>` under each ambiguous card |
| audio-cards-panel.tsx:93-101 | W-A2 move button; in move mode W-A7 hint + `common.actions.cancel` |
| audio-cards-panel.tsx:121 | per-input `isDisabled` from `inputOffered` |
| audio-cards-panel.tsx:158 | W-A3 released line (`audio-cards-released`) when `releasedDeviceId !== null` |
| audio-cards-panel.tsx:164 | W-A4 refusal sentence with the holder's name |
| apps/core-web/src/features/devices/__tests__/audio-cards.test.tsx | fixture `card()` gains `boundTo: 'MIC-03'` (fixes the typecheck red at old :29); model test :95; T-15 inside :213 (bound + free card); new describe :366 with move (:367), ALREADY_BOUND + list-again (:407), ambiguous W-A8 (:437); CARD_CHANGED expectation updated to the landed catalogue text |

No catalogue edited; keys used: `common.captureAudioCards.card.boundTo`, `.card.notTellable`, `.release`, `.releaseHint`, `.released`, `.refusal.AUDIO_CARD_ALREADY_BOUND`, `common.actions.cancel`.

## Tests
| Command | Result |
|---|---|
| `cd apps/core-web && npx vitest run src/features/devices/__tests__/audio-cards.test.tsx --maxWorkers=2` | `Test Files  1 passed (1)` / `Tests  14 passed (14)` (after the fix below) |
| `npm run typecheck -w @dems/core-web` | exit 0 |

Run history: run 1 14/14 pass, typecheck red in my own audio-cards.ts:365 (ALREADY_BOUND passed to `shared`) - fixed; run 2 13/14: W-A4 text in common.ts was re-worded by another row in parallel ("or move {{device}} to another input first") - the test now derives the sentence from the catalogue; run 3 14/14, typecheck exit 0.

## Decisions / deviations
- An ambiguous card (W-A8) shows no move button: "neither is offered" read as no binding and no move.
- An `ALREADY_BOUND` refusal without a valid `details.deviceId` is shown as `FAILED` (the spec words no fallback without the name).
- The released line uses W-A3 with `number` = the answer's `inputNumber` (bundle M text); the change line (`result.REENABLED`) is still drawn above it, per 92 §3.2 "Released" row.
- Other literal texts in the new tests (W-A3, W-A7, W-A8) are pinned verbatim; if a parallel row re-words them, those assertions need the same catalogue-derived form.
