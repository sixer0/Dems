---
row: 133 (R2.1 NEW)
agent: coder-execution
date: 2026-10-22
status: complete
check: T-14 (88 D-A4.6; spec rflex §2.4 "Selector rule for Q-R5 B"; D16 Q96-02 (B)); M2/M4 not built (bundle M)
---

# Row 133 - console selector: the other line's microphone is an enabled MOVE option

## Op-78 verdict used
Row 132 (`implementation/78_rflex_selector_mic_move.md`): op 78 ACCEPTS `{unassign: [old], mics: [{..., role: new}]}` (T-13 green, routes.ts transport fix landed there). Built on that verdict.

## Changes
| File:line | Change |
|---|---|
| `apps/core-web/src/features/devices/capture-selector.ts:237-257` | new `MicMove` + `micMoveFor(mics, role, deviceId)`: `{from: <other role>, line: {inputId=deviceId, deviceId, role}}` when `deviceId` is the other line's mic, else `null` |
| `capture-selector.ts:376-377, 449-455` | new command `moveMic(move)`: ONE op 78 body `{unassign: [from], mics: [line]}` (Live and Simulated) |
| `capture-selector-panel.tsx:12, 406-416, 449, 466-469, 558, 566` | the other line's mic option is no longer `isDisabled` (M3 changed); Save is enabled for a move and sends `moveMic`; option text keeps `devices.micLines.onOtherLine.<role>` (row 101 text "... choose to move it here"); no catalogue edit |
| `__tests__/selector-microphones.test.tsx:209` | Sim T-14: option enabled with the move label; Save -> PRIMARY = MIC-02, STANDBY "Not assigned", 2 `CAPTURE_CONFIG_CHANGED` rows scope MIC |
| `__tests__/selector-microphones.test.tsx:323` | Live T-14: exactly ONE op 78 request, body `{unassign: ['STANDBY'], mics: [{inputId:'MIC-02', deviceId:'MIC-02', role:'PRIMARY'}]}`; no op 80 |
| `__tests__/selector-microphones.test.tsx:520, 676-682` | empty-slot case: held mic now offered as a move (was `aria-disabled`); `micMoveFor` unit asserts |
| `__tests__/selector-microphones.test.tsx:38-46` + 4 Live beds | `liveHealth(created)`: answers `getDeviceHealth` from the contract example (pre-existing red from task-4 LCD work `lcd-connection.tsx`, same cause as file_requests.md line 24) |
| `__tests__/selector-microphones.test.tsx:635-636` | pin "row 234" + `CAPTURE_DEVICE_RETIRED` (worded in the shared group at HEAD, task 4 RD2; pre-existing red) |

`capture-selector.test.tsx`: not edited (passes unchanged).

## Tests (one run after the fixes)
| Command | Result |
|---|---|
| `npx vitest run src/features/devices/__tests__/selector-microphones.test.tsx src/features/devices/__tests__/capture-selector.test.tsx --maxWorkers=2` (apps/core-web) | Test Files 2 passed (2); Tests 45 passed (45) |
| `npm run typecheck -w @dems/core-web` | `tsc -b`, no output, exit 0 |

First run before the two test-file fixes: 27 failed | 18 passed (26 from unscripted `GET /api/v1/device/health`, 1 from the RETIRED pin; both pre-existing, not caused by this row).
