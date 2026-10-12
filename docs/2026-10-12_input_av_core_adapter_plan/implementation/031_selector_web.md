---
task: 2026-10-12_input_av_core_adapter_plan
row: 31
milestone: M2 / WP-13a
agent: coder-execution (batch 6, agent B)
date: 2026-10-13
tier: T3
status: complete
---

# Row 31 - web console: the capture selector draws one row per SLOT

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `WEB` = `apps/core-web/src`. Names are those of
`decisions/161_selector_names_register.md` (section 6: E36, N1, N14).

## Statement

The selector panel of Devices & Inputs always draws four rows: `VIDEO-01`, `VIDEO-02`, `PRIMARY`, `STANDBY`.
A slot no line names is a row that says "Not assigned" and offers the registered sources with "Assign".
A held slot offers "Not assigned" as one more option of its source select; saving that choice is operation 78
with `unassign: [slot]`. The microphone command is built for every slot state (it was `null` unless both
roles were held). A complete selector is drawn and behaves as before; the closed panel shows no new control.

## Sites closed

| Site (row 27) | Was | Now |
|---|---|---|
| W1 `capture-selector-panel.tsx` (the two `map` calls over the lines) | a row per existing line: an absent line had no row and no offer | `selectorSlotRows(config)`: two video rows by track, two microphone rows by role; `line: null` is drawn |
| W2 `capture-selector.ts` `micPairFor` | `null` unless the selector held two lines | the pair when the other role holds a line; ONE line by role when it is empty; `null` only for the other role's microphone (E36, rule MIC-ASSIGN) |

## Change set

| File | Change |
|---|---|
| `WEB/features/devices/capture-selector.ts` | `micPairFor` (result `readonly MicPairLine[] \| null`); NEW `CameraSlotRow`, `MicSlotRow`, `selectorSlotRows`; `CaptureSelectorCommands.setMicPair` takes 1 or 2 lines; NEW command `unassign(slot)` (operation 78, body `{ unassign: [slot] }`, both data modes) |
| `WEB/features/devices/capture-selector-panel.tsx` | `CameraSourceRow` and `MicRow` take `slot` and `line \| null`; the empty row; the option "Not assigned" (`NOT_ASSIGNED_KEY`); the row attributes `data-selector-slot`, `data-state` (`ASSIGNED` / `NOT_ASSIGNED`) |
| `WEB/features/devices/__tests__/selector-microphones.test.tsx` | one new block, 11 cases; `liveSelector` gained an optional `prepare` |

No new component, element, style rule, dependency or string: the rows are the existing `dev-sel-row` with the
kit's `Select`, `ListBox`, `Button`, `Chip`; the words are `common.captureSlot.*` (row 28) and the existing
`devices.selector.*`.

## What each state shows

| State | Row | Evidence (case of the new block) |
|---|---|---|
| assigned | as before; test ids unchanged; `data-state="ASSIGNED"` | "one row per slot ... 2 lines"; the 36 existing cases |
| not assigned | the slot's name (`common.captureSlot.<slot>`), "Not assigned", no device id, no state chip, no badge; select labelled "Assign a source to ..."; button "Assign", disabled until a source is chosen | "one row per slot" with 0 and 1 lines (three line sets) |
| assigning | the row is `aria-busy`, the select disabled, the slot still not assigned until the Core answers | "an empty video slot is assigned" (held answer) |
| refused | the sentence of the selector at the field (`409` locked, `422` development only, `422` not accepted); the slot stays empty | "a refused assignment of an empty slot" |
| gated | role sentence / lock sentence, controls disabled, never hidden | "the gates of an empty row" |

Commands sent (Live mode, fake Core): empty video slot -> ONE `setCaptureCameraSource` for the track; empty
role beside an empty role -> `updateCaptureConfig` with ONE line `{ inputId, deviceId, role }`; empty role
beside a held role -> the two-line pair; "Not assigned" + Save -> `updateCaptureConfig` with exactly
`{ unassign: ['VIDEO-02'] }` / `{ unassign: ['STANDBY'] }`.

## Checks

| Check | Command (in `apps/core-web`) | Result |
|---|---|---|
| Selector tests, run 1 | `npx vitest run src/features/devices/__tests__/selector-microphones.test.tsx src/features/devices/__tests__/capture-selector.test.tsx src/test/live-devices-capture-selector.test.tsx --maxWorkers=2` | 4 failed, all in the NEW cases and all test-side: an assertion read the select's option list as the row's text; two Live saves had no scripted answer |
| Selector tests, run 2 | the same | `Test Files  3 passed (3)` / `Tests  47 passed (47)` |
| Typecheck | `npx tsc -b` | exit 0 |
| Lint | `npx oxlint` on the three files | exit 0 |

Verification cell: "4 rows drawn in every case, each empty one with its offer" - the `it.each` over four line
sets; "the command for an empty slot is built (not null)" - the pure case of `micPairFor` and the two Live
cases; "0 other changed results" - no existing expectation of the three files was edited (36 cases pass as
they were).

## Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | "Unassign" is the option "Not assigned" of the row's own source select, sent by the row's Save. No new button, no confirm dialog | the closed panel of a complete selector looks exactly as today (the Simulated-mode rule); the kit's select is the existing control; no new string is needed; the edit is reversible and audited by the Core |
| DD-2 | Row order: a kind with both slots held is drawn in the order of the Core's lines (as before - the microphone rows do not jump when roles trade); a kind with an empty slot is drawn in the order of `CAPTURE_SELECTOR_SLOTS` | 0 changed results on a complete selector; the register lets the web row model be the row's own |
| DD-3 | A `422` with `details.reason` `MIC_ON_BOTH_INPUTS`, `CAMERA_ON_BOTH_TRACKS` or `SLOT_UNASSIGNED_AND_ASSIGNED` reads the existing "not accepted" sentence | no string exists for them; the client already prevents the first (disabled option) |
| DD-4 | The empty state of the panel (registry AND selector empty: the camera search) is unchanged | nothing can be assigned there |
| DD-5 | `capture-selector.ts` was edited ONCE with a scripted exact-string replace (each string asserted to occur once) before the brief's "Edit tool only" line was applied; every later edit used the Edit tool | reported as a deviation from the batch brief; the result was typechecked and is in the diff |

## Interim state (not this row)

- Simulated mode: the in-app simulator refuses the member `unassign` (unknown member, `422`) until row 165, and the
  hosted action refuses a camera for an empty track and a single line by role until row 162. Until then the
  panel shows the "not accepted" sentence for those edits in Simulated mode; the seeded selector is unaffected.
- Live mode: the Core's route forwards only `cameras` and `mics` until row 29 (`implementation/028_selector_contract.md` section 7): `unassign` answers 200 with nothing changed.

## Double, and what stays unproven

The double is a hand-built selector slice (the simulator's store; the fake Core's served slice with scripted
answers). The panel against a Core that really clears and fills a slot is rows 29 / 162 / 33 and the scripted
device session of the milestone gate. No browser session was run. Nothing goes to the hardware package.

## Requests / PENDING-SHARED

None. No `PENDING-SHARED` constant in this row.

---
*Generated: 2026-10-13*
