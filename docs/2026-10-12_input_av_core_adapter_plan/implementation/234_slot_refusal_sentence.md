---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 234
date: 2026-10-13
agent: coder-execution (wave 11, agent W1; single writer of apps/core-web)
tier: T3
status: complete
---

# Row 234 - the slot assignment states why the Core refused it

## The finding

The user's run on two real cameras (`delegation_progress/file_ownership.md`, "row 233"; decision C60
"FACT FOR THE USER"): three `POST /capture/cameras/:id/source` answered `422 INVALID_INPUT` and the
console said only "This choice was not accepted. Nothing was changed.". The Core's answer carries a
word in `details.reason`; the web selector worded one of them (`DEVELOPMENT_SOURCE_NOT_ALLOWED`).

## What was built

| File | Change |
|---|---|
| `apps/core-web/src/features/devices/slot-refusal.ts` (NEW) | `slotRefusalWording(reason)`: pure; the shared tree first, then the console's own, then the word as a code, then the general sentence. `wordedSlotRefusalReasons()` for the test |
| `apps/core-web/src/features/devices/capture-selector-panel.tsx` | `useFailureNotice(kind)` words every `422` through it; the camera row passes `CAMERA`, the microphone row `MIC` (one import, the hook, two call sites) |
| `apps/core-web/src/i18n-web.ts` | group `web.captureSlotRefusal`: `source` (camera / microphone), `reason` (four sentences), `code` |
| `apps/core-web/src/features/devices/__tests__/selector-microphones.test.tsx` | two cases added to the existing block "task 4 row 31" (the file of the selector's Live refusals) |

## The reasons and their sentences (operations 78, 79, 80; `422 INVALID_INPUT`)

Source of the closed lists: `apps/core-server/src/modules/capture-config/routes.ts:111-170`
(`CaptureAssignmentRefusal`, `CaptureProfileRefusal`) and its header (`SLOT_UNASSIGNED_AND_ASSIGNED`).
`packages/shared` holds no constant of these words; its i18n group `common.captureSlotRefusal` holds two.

| `details.reason` | Sentence read from | Text (camera row) |
|---|---|---|
| `PRODUCTION_SOURCE_NOT_ALLOWED` | `web.captureSlotRefusal.reason` | This camera was not assigned: it is a production device, and this Core runs in development capture operation. This camera can be assigned only on a Core running in production capture operation. Nothing was changed. |
| `CAPTURE_DEVICE_NOT_SERVED` | `web.captureSlotRefusal.reason` | This camera was not assigned: it is registered, but no capture adapter of the running Core serves it, so this Core cannot record from it. Nothing was changed. |
| `CAPTURE_DEVICE_CLASS_MISMATCH` | `web.captureSlotRefusal.reason` | This device was not assigned: the Core does not hold it as a camera. Nothing was changed. |
| `SLOT_UNASSIGNED_AND_ASSIGNED` | `web.captureSlotRefusal.reason` | This choice was not accepted: one request cleared a slot and filled the same slot. Nothing was changed. |
| `CAMERA_PROFILE_NOT_STATED`, `CAMERA_PROFILE_NOT_OF_DEVICE` | `common.captureSlotRefusal` (shared; pass I-7 - now read by a client) | as written there |
| `DEVELOPMENT_SOURCE_NOT_ALLOWED` | `devices.selector.developmentOnly` (unchanged) | This source can only be used in the development configuration. |
| any other word of the form `[A-Z][A-Z0-9_]*` (an adapter-layer code, rule CR-4) | general sentence + `web.captureSlotRefusal.code` | This choice was not accepted. Nothing was changed. Reason code: `<WORD>`. |
| no word, or a text that is no code | general sentence | This choice was not accepted. Nothing was changed. |

The user's case: an adopted ONVIF camera has source class PRODUCTION; under `REAL_DEVELOPMENT` the
registry does not know it and `captureAssignmentRefusalOf` answers `PRODUCTION_SOURCE_NOT_ALLOWED`
(routes.ts:150-158) - the first row of the table. The answer's own `message` is never drawn.

## Checks

| Command (from `apps/core-web`) | Result |
|---|---|
| `npx vitest run src/features/devices/__tests__/selector-microphones.test.tsx --maxWorkers=2` | `Test Files 1 passed (1)`, `Tests 31 passed (31)` |
| `npx vitest run ... src/features/devices/__tests__/capture-selector.test.tsx ...` (batch) | passed (its `selectorRefusal` cases are unchanged) |

## Requests

`delegation_progress/file_requests.md`: agent A5 - the four sentences into `common.captureSlotRefusal`
(not blocking: the console reads the shared word first the day it exists).

## Driver decisions

| # | Decision | Why |
|---|---|---|
| DD-1 | The four missing sentences live in the console's own tree (`web.*`) instead of a bare code with a generic sentence | the brief orders that the production-camera sentence says what is true; `i18n-web.ts` exists for exactly this case (shared tree closed to the web writer) |
| DD-2 | The sentence names "camera" or "microphone" by the row, not by the operation | operation 78 serves both kinds |
| DD-3 | A word is drawn as a code only when it has the form of one | `details.reason` is an answer's text; nothing else of an answer is drawn |

## Unproven

A real Core's answer on real cameras (the user's run read the status, not the body): the sentence is
proven against a scripted `422` of the fake transport. Mobile (`apps/mobile`) words none of these: not this row's area.
