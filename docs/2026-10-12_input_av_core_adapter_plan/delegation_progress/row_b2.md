# Row B2 - review follow-ups S-01 and S-02 (`verification/060b`, decision C95)

Status: needs-review - S-02 complete on doubles; S-01 done as far as the contract allows, the rest requested of step V6.
Agent: coder-execution (B2, track D). Date: 2026-10-13. Full record: `implementation/b2_review_follow_ups_s01_s02.md`.

## Result per item

1. S-01 - PARTIAL. The contract has an honest "not stated" for the rate only (`fps` nullable); `resolution` and `codec` have
   none (measured). `withCameraStreamFacts` now answers `fps: null` for a track without a stream statement on operations
   44 / 46 / 47 of a real Core; picture and codec stay the slice's, nothing invented. An operator sees `1080p`, `H.264`, no
   rate (before: `1080p / 25 / H.264`). Request left for V6: both members nullable, then the Core and the listed readers.
   Bounding fact, verified by existing tests: a production camera is not assignable without a profile of its stored list
   (row 187) and the adapter opens nothing without the stored stream row (`PROFILE_UNKNOWN`). Limit of the bound: the
   database holds a stored code to the `CODE` form, not the statement form.
2. S-02 - DONE. A loss before the attach is kept (64 per watch), reported at once as an error by code, and handed to the
   watch at the attach, in order, once. A microphone loss of a superseded attempt is still dropped: the answer of the moment
   the adapter spoke is kept with the loss. Beyond the bound, or a watch that throws: `EARLY_LOSS_NOT_DELIVERED`, reported.

## Files

Changed (Edit tool only): `apps/core-server/src/modules/devices/status.ts`, `src/modules/devices/__tests__/status.test.ts`,
`src/capture-composition.ts`, `src/__tests__/capture-composition.test.ts`; one line each in `file_claims.md`, `file_requests.md`.
New: `implementation/b2_review_follow_ups_s01_s02.md`, this file.

## Checks

- Unit, composition + devices + three static files: first run `Tests 1 failed, 307 passed (308)` (this row's own new
  control); `status.test.ts` after the fix `Tests 64 passed (64)`.
- Database, composition and devices: `Test Files 5 passed (5)`, `Tests 65 passed (65)`, `0 remain`.
- Database, the bounding fact (row 187 block, adapter `PROFILE_UNKNOWN`): `Test Files 2 passed (2)`, 5 cases, `0 remain`.
- `test/static`: `Tests 210 passed (210)`. Typecheck: exit 0.

## Requests and decisions

- `file_requests.md`, row B2: contract step V6 (the two nullable members, the Core branch, the readers); the committed
  `cameras` slice on a real Core still holds the simulator's literal - not traced, not changed.
- DRIVER DECISIONS: D-1 `fps: null` although picture and codec cannot follow; D-2 an early loss is reported at level
  `error`; D-3 the bound of 64 kept losses per watch.
- Unproven, for row 88 and the hardware package: the lift attaches each watch before its adapter can report.
