---
task_slug: input_av_core_adapter_plan
row: 185
milestone: M4 / WP-07c
date: 2026-10-13
agent: coder-execution (batch 8, agent G)
tier: T3
status: complete
---

# Row 185 - the shared registry action that adds a microphone

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`.

## 1. What was built

The INTERNAL action `registerCaptureMicrophone`, the microphone's equivalent of `registerCaptureDevice` (which camera adoption runs through `CS/src/modules/capture-discovery/adoption.ts:52` -> `registerCaptureDeviceIn` -> `SH/src/sim/capture-registry.ts`).

| File | Change |
|---|---|
| `SH/src/sim/capture-registry.ts` | `registerCaptureMicrophoneTransition`, `nextCaptureMicrophoneId`, `REGISTER_CAPTURE_MICROPHONE_ACTION`, `REGISTERED_MICROPHONE_ADAPTER`, `REGISTERED_MICROPHONE_ID_PATTERN`, `REGISTERED_MICROPHONE_MODEL_PATTERN`; the camera's functions are untouched |
| `SH/src/sim/types.ts` | `RegisterCaptureMicrophoneInput`; ONE member of `SimActions`, the last |
| `SH/src/sim/actions.ts` | one line: the action commits the transition |
| `SH/src/api/sim-actions.ts` | one entry: `{ operations: [], execution: INTERNAL }` |
| `SH/src/live/source/bindings.ts` | one binding, flow `LOCAL` (resolves without a request, as the camera's) |
| `CS/src/engine/hosted-actions.ts` | header comment only |

Input: `{ deviceId: string | null, model: string }`. It names no class and no adapter.

| `deviceId` | Effect |
|---|---|
| `null` | ONE device appended to slice `captureDevices`: id = the next free `MIC-NN` (highest number + 1, never reused, minted by the action), `kind: 'MIC'`, `adapter: 'USB_AUDIO'`, `sourceClass: 'PRODUCTION'`, `online: true`, `streamState: null`, `host`, `firmware`, `poePort` null, `capabilities: []`, `model` as given |
| an id | that registered `USB_AUDIO` microphone is `online: true` with the model of the new listing; no device appended; already so = the SAME state object (the engine writes nothing) |

Invariants kept, as adoption keeps them: no permission and no session check, NO audit row, no event, `captureConfig` untouched (decision C25); refusals are `SimTransitionError` with code INVALID_INPUT and change nothing. RG-4: a listed card is no descriptor and never enters the registry; only this action, run by operation 99 after the Core's own listing, creates one. AD-07 (1): the model must pass the closed rule of a product name of the card listing (printable ASCII, 1 to 64); the pattern is restated in the registry file (it imports nothing of the contract) and a test holds it equal to `CAPTURE_AUDIO_CARD_TEXT_PATTERN`. Re-enabling refuses a built-in microphone, a local-device microphone, a camera, an id the registry does not hold.

The simulator: its own operation 99 is NOT changed (`SH/src/sim/api.ts` not edited) and does not run the action; the seeded state is unchanged; no simulated answer moved.

## 2. Pins moved (by delta; no operation and no audit pin moved, no operation added)

| Pin | File | From -> to |
|---|---|---|
| members of `SimActions` / bindings / table keys | `SH/test/live-source-bindings.test.ts`, `SH/test/api-domain-operations.test.ts`, `CS/src/engine/__tests__/hosted-actions.test.ts` | 49 -> 50 (three places; two describe titles follow) |
| executions `[hosted, server-native, not-available, internal]` | `SH/test/api-domain-operations.test.ts` | `[33, 9, 1, 6]` -> `[33, 9, 1, 7]`; the internal list gains the name |
| flow `local` | `SH/test/live-source-bindings.test.ts` | 7 -> 8 names (case title follows) |
| not-hosted names | `CS/src/engine/__tests__/hosted-actions.test.ts` | + `registerCaptureDevice`, `registerCaptureMicrophone` (two more parametrised cases) |

Unchanged: hosted 33; "42 actions reach 45 operations"; the operation registry; `SH/openapi/openapi.json` (not regenerated: nothing of it changed; `git status` of the folder is clean).

## 3. Evidence

| Check | Command | Result |
|---|---|---|
| The unit table and the pins | `cd packages/shared && npx vitest run --maxWorkers=2 test/sim-capture-discovery.test.ts test/live-source-bindings.test.ts test/api-domain-operations.test.ts` | `Test Files 3 passed (3)`, `Tests 179 passed (179)` |
| 0 other changed results in the simulator suites | `npx vitest run --maxWorkers=2 test/sim- test/live- test/api-closeout test/openapi` | `Test Files 55 passed (55)`, `Tests 1455 passed (1455)` |
| Typecheck | `npm run -s typecheck` in `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile`, `apps/transcriber`, `apps/mock-core` | exit 0, all six |
| The Core's pin | `cd apps/core-server && npx vitest run --project unit --maxWorkers=2 src/engine/__tests__/hosted-actions.test.ts ...` | green (in the run of row 190's record) |

Verification cell, case by case (`SH/test/sim-capture-discovery.test.ts`, describe "the INTERNAL action `registerCaptureMicrophone`"): a first registration appends one `MIC-03` and every other slice is the same object; a second for the same device re-enables and appends none; eleven refused inputs leave the state object; the action is INTERNAL with no operation and bound LOCAL, equal to `registerCaptureDevice`; the simulated operation 99 leaves the simulator registry alone.

## 4. Driver decisions

| # | Decision | Why |
|---|---|---|
| DD-1 | A NEW member `registerCaptureMicrophone`, not a wider `registerCaptureDevice` | the row asks for the equivalent action with class and adapter fixed by it; the camera's input and refusals stay as they are |
| DD-2 | The action mints the id (`deviceId: null`); the caller names none | "the next free MIC-nn ... fixed by the action"; the state it reads is the unit's |
| DD-3 | One action for add and re-enable | the row's wording ("adds ... and re-enables one") |
| DD-4 | `capabilities: []` for a registered microphone | the registry table has no capability column and the mapping reads `[]` back for every microphone that is no built-in (`CS/src/db/mapping/rows.ts:899`; the local-device microphone carries `[]`). `['AUDIO']` would differ after a restart unless `db/mapping/rows.ts` changed, which is not this row's file and would move the read-back of the fixtures' two `USB_AUDIO` microphones. For the controller to confirm |
| DD-5 | Re-enable also takes the model of the new listing | row 70's seam hands it (`reenable(..., model)`), and `model` is a column the engine may update |
| DD-6 | The header counts of `sim-actions.ts` and `bindings.ts` (already stale: 48 / 47 / 5 / 6) were not renumbered; the new entry says "one more" | not this row's drift; a rewrite of those headers is not a delta |

## 5. The double, and what stays unproven

Pure functions and the in-memory simulator; no process, no port, no database in this row. On a database: row 190. A real card: `9A/H-07`.

---
*Generated: 2026-10-13*
