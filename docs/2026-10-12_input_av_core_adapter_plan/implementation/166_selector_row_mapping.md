---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 166
package: WP-13a (milestone M2)
date: 2026-10-13
agent: coder-execution
tier: T3
status: complete
---

# Row 166 - server row mapping of the selector: by track and by role, NULL for an absent line

## 1. Statement

The three functions of `apps/core-server/src/db/mapping/rows.ts` that row 27 named (sites A3, A4, A5; register entry E17, names unchanged) handle an unassigned selector slot:

| Site | Function | Before | Now |
|---|---|---|---|
| A3 | `captureConfigToRow` | cameras by position; a role, else the line at position 0 or 1; fewer than four lines threw `ROW_SHAPE` | each camera line into the columns of its track, each microphone line into the column of its role; a slot no line names is NULL (device and profile of a video slot together); no positional fallback |
| A4 | `captureConfigFromRow` (the engine rehydration) | `named()` and `codeToProfile()` threw on a NULL: the second place that stopped the boot | a NULL slot is an absent line; six NULLs give two empty lists |
| A5 | `selectorDeviceIds` | put a NULL into the set | skips NULL |

An unassigned slot is an ABSENT line in the slice, never a line with an empty device (register E13). `CaptureConfigSlice` is unchanged.

Refusals kept or added, all `ROW_SHAPE`, fail closed:
- to row: a track or a role named twice, or a line of neither (so no line is dropped silently). The old refusal "must name two cameras and a PRIMARY and a STANDBY" is gone: that state is now valid.
- from row: a video slot with a device and no profile, or a profile and no device (the CHECK `capture_config_slot_pair_check` cannot hold it); a slot that names a device the registry does not hold, and a profile that is not a CODE, as before.

## 2. Change set

| File | Change |
|---|---|
| `apps/core-server/src/db/mapping/rows.ts` | the three functions; a local type `StoredSelectorSlots` and one cast `seamedSelectorRow` (section 4); comments |
| `apps/core-server/src/db/mapping/__tests__/from-rows.test.ts` | one import line; one new `describe` with 7 cases |

Not edited: `db/schema/capture.ts` (the seam `slotColumn` stays: the row's cells do not ask for its removal), `changes.ts`, `to-rows.ts`, `from-rows.ts`, `packages/shared`, any seed or fixture.

## 3. Verification (the row's cell) and evidence

Command, one run: `npx vitest run --project unit --maxWorkers=2 src/db/mapping/__tests__/from-rows.test.ts src/db/mapping/__tests__/to-rows.test.ts src/db/mapping/__tests__/round-trip.test.ts src/db/mapping/__tests__/changes.test.ts src/db/mapping/__tests__/static.test.ts`

Result: `Test Files 5 passed (5)`, `Tests 181 passed (181)`.

| Verification cell | Test case (block "capture_config: an unassigned slot is NULL in the row ...") | Result |
|---|---|---|
| a selector with only `VIDEO-02` and only a STANDBY microphone is written and read back with `video_01_*` and `mic_primary_id` NULL | "GATE AD-04 (2): only VIDEO-02 and only a STANDBY microphone" (the six columns compared; read back `toStrictEqual` the slice; the mirror image; control: the seeded selector whole) | pass |
| a row of six NULLs rehydrates to two empty lists without a throw | "GATE AD-04 (2): a row of six NULLs" (`fromRows` on a hand-written row image; the registry still listed; no slot keeps a device in under a rule that lists nothing; `selectorDeviceIds` empty) | pass |
| the mapping tests show 0 other changed results | the 174 existing cases of the five files pass unchanged; no existing line of a test was edited | pass |
| also | each of the 16 selectors of four slots round-trips to its own columns; lines listed in the other order reach the same columns, and a lone PRIMARY that is `MIC-02` is the primary column; the engine diff of a cleared slot is `set: { video01DeviceId: null, video01Profile: null, micPrimaryId: null }`; 6 slice refusals; 4 row refusals with their column | pass |

Typecheck of `apps/core-server` (`npx tsc --noEmit -p .`): 0 errors. It was invoked twice in one command line (once to count, once to filter), which is one more than the rule's once.

No database: the blueprint's profile line for this row says "row images written by hand; no database". No `db:migrate`, no lock taken, nothing reached PostgreSQL. No seed or fixture writes a NULL: the seeded selector is complete (control case).

## 4. The type seam, and the swap

`CaptureConfigRow` still states the six slots as `string` (the seam `slotColumn()` of row 17 in the schema folder). So `rows.ts` holds:
- `StoredSelectorSlots`: the six slots as the database holds them, `string | null`; the two readers view the row through it (a widening, no cast);
- `seamedSelectorRow`: THE ONE CAST, where a row with NULL slots is returned under the type the seam states.

Swap at the seam's removal (in `file_requests.md`): the cast becomes the identity and the local type a `Pick` of `CaptureConfigRow`. No shared contract type was needed (the slice type is unchanged), so nothing here waits for row 28.

## 5. What stays open (not this row)

- A1: `modules/capture-config/store.ts:46-53,85-108` still stops the boot on a NULL slot (row 29); A2 `slices.ts` (row 29). The gate of row 29 needs both readers.
- Nothing writes a NULL yet: operation 78 has no `unassign` on the server (rows 28, 29, 162).
- NOT RUN: the store's UPDATE with a NULL in `set` and the runtime role's grant on those columns, against PostgreSQL (rows 29 / 33 on a throw-away database).
- No double is involved; nothing of this row goes to the hardware package.

## 6. Requests and driver decisions

Requests in `delegation_progress/file_requests.md` (both not blocking): the one-line swap at the seam's removal; a note that the engine diff carries NULL and the database half was not run.

DRIVER DECISIONS for the controller to confirm:

1. A slice that names a track or a role twice, or holds a line of neither, is refused `ROW_SHAPE` (before: the extra line was dropped by position, and a microphone line without a role was placed by position).
2. A row with half a video pair is refused `ROW_SHAPE` at the reader, naming the NULL column, instead of being read as an unassigned slot.
3. The seam is bridged by a local type and one cast in `rows.ts`; the declared signatures of the three functions are unchanged, so `changes.ts`, `to-rows.ts` and `from-rows.ts` compile untouched.
4. Pure tests only, in `from-rows.test.ts` (the file of the subject); `to-rows.test.ts` and `round-trip.test.ts` were claimed and not edited.

## 7. Requirement identifiers

Closed for the row mapping: AD-04 (2) at sites A3, A4, A5 (the gate condition of this row); C18 (2) for `rows.ts:785-786` (the positional fallback is gone); register E17. Open by design: AD-04 at A1, A2 (row 29); C18 (1), C25 (rows 30, 163).
