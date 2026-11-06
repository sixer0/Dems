# Row 60d - fourth and last pass of the code review of phase 3 (M3)

Status: needs-review (list A and `onvif-session.test.ts` read in full; list B, the tablet's selector folder and the live source IN PART). Agent: senior-code-reviewer. Date: 2026-10-13.
Full record: `verification/060d_m3_review_fourth_pass.md`.

## Result

- Verdict: PASS WITH FOLLOW-UPS. Blocking findings for M3: 0 in this pass; across four passes 1 raised (B-01), 1 fixed, 0 open.
- Follow-ups: 12 (Q-01 to Q-12). Notes: 8. Tests that would survive a mutation: 4 (section 6 of the record).
- B-01: row B1's fix is SOUND - one linear pass, the cap enforced before the package is handed the crossing chunk, a refusal is one of seven codes and nothing is logged. One residual, measured, not blocking (Q-06): the scan knows LF and CR as a line end, the package also stops at U+2028 / U+2029; such a reply is admitted and costs 4.65 ms at 128 KiB (0.51 ms for the worst shape the row's test sweeps), linear.

## Recommendation to the gate (row 61)

M3 MAY CLOSE, on these conditions:

1. The working tree that holds row B1 is committed and the gate's own suite is green on that commit (this review ran no suite).
2. The "lift" items below are entered as preconditions of row 88, each with an owner.
3. The gate's record states that the product code of rows R1, R2, B2, V6 and V6b was read by NO review pass (Q-12).

## For the lift (row 88) - open with no owner in the records read

1. Q-01: a camera lost INSIDE a session shows a critical notice only; the track keeps "Live" and the stored format on both clients while the relay holds its push (`apps/core-web/src/features/devices/stream-facts.ts:97-111`, `apps/mobile/src/features/devices/stream-facts.ts:89-97`; cause `packages/shared/src/sim/capture-telemetry.ts:108-113`). Row W4's item 6 does not cover the watch's fault.
2. Q-02: no client can assign a production camera - both send operation 79 without a profile (`capture-selector.ts:390-395`, `capture-selector-port.ts:107`); the Core answers `CAMERA_PROFILE_NOT_STATED`, or judges the new camera by the old line's profile (`modules/capture-config/routes.ts:330`). Declared by request line `row 187` (`file_requests.md:198`).
3. S-01 on the state stream (the `cameras` slice still holds the simulator's literals; request line of row V6).
4. S-03, S-04, S-06 of the second pass and F3-06 for operation 108: each still as found at head.

## For the controller

- Q-03: the connection limit of `onvif-session.ts:565` is held by no test (row T3 closed it for the set-network file only).
- Q-04: `discovery-recording.test.ts:83` does not detect an event-loop stall; the booted form (`capture-discovery.db.test.ts:747-760`) does.
- Q-07: five absences proven by a sleep of 20 to 60 ms - these can pass falsely under load.
- Q-05: "Stream: LIVE" at rest in the two "View device" surfaces of an adopted camera.
- Ports: row T3 missed none in the files this pass read.
- The live source substitutes no simulator value (it starts neutral and replaces slices whole); every simulator value on a live Core comes from the Core's own committed slices.

## Method and limits

Read-only. One targeted check was run (`node` with the reply guard's file and a copy of the package's expression; no port, database or lock). No test, suite, build or typecheck. Graft not queried. I-9b's in-flight edits were not reviewed.

NEVER READ BY ANY PASS (the full table is section 10 of the record): the product code of the follow-up rows as changed after a pass read the file; 18 of 23 files of the tablet's `capture-selector/`; `live-sim.ts` but for three ranges and the rest of `live/source/`; `capture-config.db.test.ts:1-1402` and six other test files of that folder; the discovery product files (`probe-answer.ts`, `discovery-collector.ts`, `search.ts`, `store.ts`, ...); four worker fixtures; every client test; the commit history.

## Files written

- `verification/060d_m3_review_fourth_pass.md`
- `delegation_progress/row_060d.md`

No source file, no decision file and no tracking file was changed.
