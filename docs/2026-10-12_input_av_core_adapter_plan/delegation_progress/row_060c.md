# Row 60c - third pass of the code review of phase 3 (M3)

Status: needs-review (lists A, B, C read in full; list D - the web and mobile readers - in part). Agent: senior-code-reviewer. Date: 2026-10-13.
Full record: `verification/060c_m3_review_third_pass.md`.

## Result

- Verdict: PASS WITH FOLLOW-UPS. Blocking findings for M3 in what this pass read: 0. B-01 of the second pass is not re-judged and stays with row B1.
- Follow-ups: 27 (T-01 to T-12 tests, X-01 to X-09 fixtures, R-01 to R-06 readers). Notes: 9.
- Tests and fixture criteria that would survive a mutation: 18 (named in section 6 of the record).

## To close or rule before the lift (row 88), or before the gate's suite is quoted

1. T-01: four database test files bind camera port 8565, three bind ONVIF port 8557, in a project with two workers (`vitest.config.ts:23`); only two cases of one file take the heavy-host lock. C61 (4) ruled a port per file; `camera-adapter-open.db.test.ts:83-87` records it as not done.
2. R-01: a camera's `bitrateMbps` has one writer, the simulator's literal 9 (`packages/shared/src/sim/initial-state.ts:300, 316`); the web Devices tile draws it on a Core in real capture while a session records (`camera-tile.tsx:142-153`, `source-state.ts:69-72`).
3. R-02: the tablet's device detail draws the simulator's model, firmware, port, format and bitrate for a production camera (`devices-model.ts:145-148`, `device-detail.tsx:538-561`); the web says "Not reported". The second pass's sentence about `device-detail.tsx:527` was wrong (that is the `FAKE` branch).
4. T-02: `onvif-network.test.ts` passes 14 of 14 with the source bind deleted, and with the connection limit deleted; it has no case for B-01 either (the setter is the second copy of the exchange).

## For the controller

- CORRECTIONS of earlier findings: F3-07 (`devices-step.tsx:466`) and the reader list of S-01 do not reach a Core in real capture - `CameraPreview` is the "No preview" tile there and takes neither the label nor the format (`camera-preview.tsx:27-33`). What is left of S-01 on the clients is R-01 and R-02.
- R-04: every reader hides the stream's picture, rate and codec by `realCapture`, not by "fact absent". When row B2 makes the members nullable, the five guards must become null checks, or the stream's own statement (rows 52 to 55) is shown nowhere.
- X-01: a second hypothesis for `INGEST_OPEN_STUCK`, with its experiment - `row041_relay.py:211-219` starts the camera double (and, on a cold cache, an FFmpeg encode) after START and before the control push, inside the worker's give-up window, for both cameras.
- X-02, X-03, T-10: verdicts that depend on wall-clock margins of 0.45 to 4 s; all fail closed. The host's load was 16 during this review. One repair serves all: the load in every result and a third verdict.
- T-03: the "control" of two leak sweeps is a tautology (`adopted-camera-test.db.test.ts:772`, `camera-adapter-open.db.test.ts:790`).
- T-12: `connect.db.test.ts:578` records an unexplained 1-in-8 failure with no owner.

## Method and limits

Read-only. No test, fixture, build or typecheck was run; no port, database or lock was used; Graft not queried. In-flight files were not reviewed (two blocks of `onvif-network.ts` were read to confirm T-02).

STILL UNREAD: `onvif-session.test.ts` (in flight); the discovery tests of `camera/__tests__` (`ws-discovery`, `discovery-*`, `probe-answer`, `loopback-guard`) - the wire half of the typed address probe is there; `search.test.ts:1-439` and the other tests of `capture-discovery/__tests__` and `capture-config/__tests__` not named in the brief; of the readers: `capture-selector-panel.tsx`, `capture-notices.tsx`, `registered-devices-model.ts`, the mobile `capture-selector/*`, the media components, the slice schemas and the live source; the rest of the reader files read in part. The exact table is section 9 of the record.

## Files written

- `verification/060c_m3_review_third_pass.md`
- `delegation_progress/row_060c.md`

No source file, no decision file and no tracking file was changed.
