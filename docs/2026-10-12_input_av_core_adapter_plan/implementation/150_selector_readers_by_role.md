---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 150
milestone: M2 / WP-13a / AD-04
date: 2026-10-13
agent: coder-execution (batch 6, agent D)
tier: T3
requirement: AD-04 point 2 (no reader works by position; the fallback of `status.ts:205` is removed), for the three server readers row 27 measured not safe (B11, B12, B13)
status: complete
---

# Row 150: the three server selector-line readers find a line by track or role

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `DV` = `apps/core-server/src/modules/devices`.

## What was changed

| File | Change | Description |
|---|---|---|
| `DV/status.ts` | modify | `videoTracksOf` (B11), `audioChannelsOf` (B12), `activeInputOf` (B13), the two import names, the two call sites of `activeInputOf`, the comments of the three readers. Nothing else of the file |
| `DV/__tests__/status.test.ts` | extend | one new block of 10 cases (`row 150: ...`), three import lines. No existing case was changed: all 44 pass unchanged |

Not edited: `packages/shared` (agent A's in this batch), the other 19 server readers (measured safe by row 27), `DV/index.ts` (it re-exports `activeInputOf` by name only).

## The three readers, before and after

| Site | Before (commit 6e6707dd) | After | Name of the register |
|---|---|---|---|
| B11 `videoTracksOf` | line found by track; `sourceDeviceId: slot?.deviceId ?? camera.deviceId` | line found by track; `sourceDeviceId: slot?.deviceId ?? null`. Still one entry per track | E39 |
| B12 `audioChannelsOf` | input by `micInputOfChannel` (position, then the built-in table); `?? mic.deviceId`; `?? mic.micRole`; always two entries | input by `meterInputOfChannel`; `null` gives NO entry; the device and the role are the line's, with no other source. Two entries on a complete pair, else none | N5, E40 |
| B13 `activeInputOf` | frame, else the PRIMARY slot, else the hardware slice's PRIMARY microphone, else its first microphone through the positional function, else `'MIC-01'` | a frame that names an input, else `micInputOfRole(lines, 'PRIMARY')`, else `null`. The parameter `mics` (the hardware slice) is gone: nothing reads it | N4, E40 |

`BUILTIN_SLOTS` for a state that holds no `captureConfig` slice (site B10, measured safe) stays, as the register's section 7 line 9 says.

Answers on a complete selector are equal to before: the 44 earlier cases of the file, among them the member-by-member parity with the in-app simulator's handler on five scenarios and the development selector of row 140, pass without an edit.

## Verification (the row's cell)

| Asked | Evidence |
|---|---|
| each of the three readers has a test with a missing line that passes | B11: 2 cases (only `VIDEO-02`; lines reversed and no line). B12: 3 cases (four incomplete line sets; a frame does not bring an entry back; a complete pair in the reversed role arrangement). B13: 2 cases (no PRIMARY; PRIMARY alone and second, frame rules) |
| names of the positional function left in the file: 0 | the last case reads `status.ts` as text: 0 occurrences, comments included; 0 of its built-in table; 0 literal `MIC-NN` in code; with a positive control on the replaced text (4 hits) |
| an input or device answered for a slot without a line: 0 | one case over 16 hand-built states (4 camera line sets x 4 microphone line sets, identifiers no hardware slice holds): `invented` = 0; every answer passes `DeviceHealthResponseSchema` |

Commands, from `apps/core-server`:

```
npx vitest run --project unit src/modules/devices/__tests__/status.test.ts src/modules/devices/__tests__/static.test.ts src/modules/devices/__tests__/routes.test.ts --maxWorkers=2
  run 1: Test Files 1 failed | 2 passed (3); Tests 1 failed | 106 passed (107)
         (the failing check was the row's own text search: it counted `MIC-01` inside the file's comments; moved to the code without comments)
npx vitest run --project unit src/modules/devices/__tests__/status.test.ts --maxWorkers=2
  run 2: Test Files 1 passed (1); Tests 54 passed (54)
npx tsc --noEmit   (see row 155's record for the final run of the workspace)
```

## Double, and what stays unproven

The double is a hand-built state: the idle seed with selector lines taken away, the hardware slices left complete. Not proven here: the same answers over HTTP on a stored selector with a NULL slot (the database test of the routes needs the nullable columns and the hosted action of rows 29 and 162), and the parity with the simulator on an INCOMPLETE selector, which exists only when row 165 has rewritten the simulator's twins (C23, C24).

## Driver decisions

1. DRIVER DECISION: `streamState` of a track without a line is unchanged (`LIVE` while the camera of the hardware slice is online, else `LOST`). The register widens only `sourceDeviceId` (E39) and the schema keeps `streamState` required. It is a state of the unit's port, not a device, an input or a microphone. To confirm; if the controller wants "no stream state without a source", it is a schema change for row 28's writer.
2. DRIVER DECISION: a frame whose `activeInputId` is `null` does not hide a PRIMARY line (the register: "`null` when none and no frame states one"). A frame that names an input is still answered first, as before, including when the slots hold no PRIMARY: the frame is the engine's own statement and the selector is locked while a session runs.
3. DRIVER DECISION: the signature of `activeInputOf` lost its first parameter (the hardware slice). Its only callers are the two in the same file; the module's index re-exports the name.

## For the controller

- A meter channel without an input gives no entry, so an answer of operation 45 can hold 0 entries while the hardware slice holds 2 microphones. This is E40 as written; the clients' readers are rows 167 to 171.
- The existing parity cases hold this file against the simulator on complete selectors only. When row 165 lands, a parity case on an incomplete selector can be added to the same block (one line per answer); it was not written here because the simulator's twins still answer the stand-ins at this commit.
