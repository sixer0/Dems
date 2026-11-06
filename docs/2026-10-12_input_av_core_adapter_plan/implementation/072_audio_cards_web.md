---
task: 2026-10-12_input_av_core_adapter_plan
row: 72
milestone: M4 / WP-07d
agent: coder-execution (batch 8, agent U)
date: 2026-10-13
tier: T3
status: complete
---

# Row 72 - web console: the list of sound cards and the registration of an input

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `WEB` = `apps/core-web/src/features/devices`, `SH` = `packages/shared`.

## 1. What was built

| File | State | What it is |
|---|---|---|
| `WEB/audio-cards.ts` | NEW | Operations 98 and 99 in both data modes (`live.client.call(...)` / `sim.request(...)`), the gate `audioCardsGate`, the refusal names `listRefusal` / `registerRefusal`, `inputsOf`, `withRegistration`, the control `useAudioCards` |
| `WEB/audio-cards-panel.tsx` | NEW | `AudioCards`: the block "Sound cards" of the microphone panel |
| `WEB/__tests__/audio-cards.test.tsx` | NEW | 3 model cases, 7 page cases |
| `WEB/index.tsx` | MOD | one import, one line: `<AudioCards />` after `<MicRescan />` in the panel `audio` |
| `WEB/camera-search-panel.tsx` | MOD | one word: `DeviceText` (the existing untrusted-text element) is exported so the card name reuses it |
| `SH/src/i18n/en/common.ts` | MOD | NEW group `common.captureAudioCards` (31 strings) after `common.captureInputs` |

Not touched: `devices.css` (the classes `dev-scan`, `dev-scan-head`, `dev-scan-row`, `dev-scan-list`, `dev-scan-result`, `dev-search-control`, `dev-sel-group`, `dev-sel-reason`, `dev-tile-name`, `dev-tile-sub` are reused), the provider `camera-search-context.tsx`, any dependency. Kit components only: `Button`, `Spinner`, `Alert`, `Chip`, `RadioGroup` / `Radio` / `Label` / `Description` (the structure of `features/users-roles/role-dialog.tsx`).

## 2. The screen, state by state (each is an answer of the Core, and has a test)

| State | Source | Drawn as | Test (`audio-cards.test.tsx`) |
|---|---|---|---|
| Before a listing | nothing sent on mount | the control "List sound cards", one sentence, no list | "nothing lists by itself ..." (0 calls of operation 98 at mount) |
| Checking / role | `useCaptureDiscoveryGate` (`CAPTURE_CONFIG`) | disabled with "Checking ..." / the role sentence, never hidden | gates, case 1 |
| Session open | `hasActiveSession`, `captureConfig.locked`; also `409 CAPTURE_CONFIG_LOCKED` | disabled with `locked`; as an answer: the same sentence inline | gates, case 2; refusals case (the answer) |
| Listing | 200 of operation 98 | per entry: product (text node in `<bdi>`), input count, capture device index, USB id or "Not a USB card", sample sizes when stated; inputs 1 to `channelCount` as ONE single-choice group, all enabled; "Listed at" as a Core instant | Simulated case; Core case 1 |
| Registered input | `registered[]` of the entry | the input carries "Registered as MIC 3 (MIC-03)" and `data-registered` | Core case 1 |
| No card | `cards: []` | "The Core found no sound card."; no register control | Core case 4 |
| More cards than listed | `truncated: true` | a warning (not a note) with the bound 32 | Core case 4 |
| Nothing chosen | - | "Register as microphone" disabled with "Choose an input first." | Simulated case |
| 201 REGISTERED / 200 REENABLED / 200 CARD_CHANGED | answer of operation 99 | one sentence per change code; the input the request named is drawn as the microphone the answer names | Core case 1 |
| 404 | answer of 99 | `refusal.NOT_FOUND` | Core case 2 |
| 409 `AUDIO_INPUT_BEYOND_CARD` | answer of 99 | its sentence | Core case 2 |
| 409 `AUDIO_INPUT_NOT_REGISTRABLE` | answer of 99 (always, in the simulator) | its sentence | Simulated case; Core case 2 |
| 409 `AUDIO_CARD_SEARCH_IN_PROGRESS` | 98 or 99 | `busy` | Core cases 2, 3 |
| 429 | 98 (or 99) | the control disabled with the Core's number of seconds, written once; it re-enables by itself; nothing is sent then | Core case 3 |
| 503 | 98 or 99 | `notReady` | Core cases 2, 3 |
| any other failure (400, 422, 500, no answer) | 98 / 99 | `listFailed` / `refusal.FAILED`; one record in the page's own log (`reportDevicesError`, source `features/devices.audioCards`: operation id, status, code - no device text) | Core cases 2, 3 |
| 403 | 98 / 99 | the shared refusal presenter (Live); in the web console the role gate has already disabled the control | model case 2 (named `ROLE`) |

The verification cell "the screen lists the fixture cards and registers one input (component test)": the Simulated case lists the simulator's two cards (`DEMS_TEST_A` 4 inputs, `DEMS_TEST_B` 2 inputs) and sends ONE registration with the body `{ cardId, deviceIndex, inputNumber }`, which the simulator answers with `409 AUDIO_INPUT_NOT_REGISTRABLE`; Core case 1 registers one input of a contract-example card with a 201 put in at the path.

## 3. Rules held

- Nothing lists by itself: not a mount, not a timer, not a registration (asserted: one call of operation 98 after three registrations).
- The technician picks a card and ONE input of it (input-av's idea): one `InputChoice` for the whole list; choosing on a second card removes the choice on the first (asserted: exactly one checked input). Inputs are selected, never mixed: no multi-select and no "all inputs" control exists.
- No device text goes back to the Core: the body is the three members of the contract (asserted with `toEqual`). The product name is in no sentence, no accessible name of a group ("Inputs of sound card 1"), no log record and no test id (ids use the card id and device index, which are of the kernel's form).
- Untrusted text: the product is a text node inside the existing `DeviceText` (`<bdi>`); a name with markup is drawn literally (asserted: no `img` or `b` element, no script effect).
- Never the answer's own message: every sentence is an i18n string chosen by status, code and reason (asserted: the answer's message is nowhere in the block).
- Simulated mode is unchanged apart from the new block: the 14 existing test files of the feature pass unedited.

## 4. Checks (2026-10-13)

| Check | Command | Result |
|---|---|---|
| The feature's test files, one run | `npx vitest run --maxWorkers=2 src/features/devices/__tests__` in `apps/core-web` | `Test Files 15 passed (15)`, `Tests 175 passed (175)` |
| i18n of the shared package | `npx vitest run --maxWorkers=2 test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` in `packages/shared` | `Test Files 2 passed (2)`, `Tests 52 passed (52)` |
| Typecheck | `npm run -s typecheck` in `packages/shared` and `apps/core-web` | exit 0, both |
| Lint of the new and changed files | `npx oxlint` on the four files | exit 0 |

No i18n count pin exists that this group moves (`i18n.test.ts:127` compares relative counts; searched for a pin of the leaf count: none).

## 5. The double, and what stays unproven

The double is the in-app simulator; the answers only a Core gives are put in at `sim.request` in the shapes of the contract's examples. Unproven here: the Live transport of the two calls (`live.client.call('searchCaptureAudioCards')`, `('registerCaptureAudioInput', { body })` compile against the typed client and follow the pattern of `capture-inputs.ts`, but no test of this row runs them against a Core); a booted production Core, which today answers 503 to both (rows 85 and 185/190, see `implementation/070_mic_registration.md` section 5); a real card (`9A/H-07`). The screen is judged in the scripted device session of the milestone gate.

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | A registered input stays selectable, marked "Registered as ..." | the contract gives a registered input an answer of its own (200 REENABLED / CARD_CHANGED); disabling it would remove that path from the only client. It is said, with "no second microphone was made" |
| DD-2 | After a successful registration the held listing is completed with the answer (`withRegistration`); the Core is not asked again | "nothing lists by itself", and operation 98 is spaced (5 s); both facts are statements of the Core |
| DD-3 | The block is a section of the existing microphone panel, with its own control (not in `CameraSearchProvider`) | one place uses it; no existing file but `index.tsx` had to change |
| DD-4 | With a session open the two controls are disabled from the session state before any call (as Connect is), and the answer `409 CAPTURE_CONFIG_LOCKED` has the same sentence | the contract: idle only |
| DD-5 | `AUDIO_INPUT_NOT_REGISTRABLE` reads "This Core cannot capture from this sound card ..." | one sentence that is true for both answerers of the reason: the simulator (captures from no card) and row 70 DD-5 (a card whose channel count is assumed) |
| DD-6 | `DeviceText` of `camera-search-panel.tsx` is exported (one word) rather than copied | the UI rule: an existing component where the feature has one |
| DD-7 | All strings are in `common.captureAudioCards`, although the screen is web console only | this batch's i18n writer holds `common.ts` only (`devices.ts` is another file of `packages/shared`) |

## 7. Requirements

P12-F05 (c), client half: an operator can register a microphone from the web console (the contract's only client of 98 and 99). AD-07 (1), client half: "a client draws it as text only" held and tested. AD-07 (2), client half: no descriptor text in a request, held and tested.

---
*Generated: 2026-10-13*
