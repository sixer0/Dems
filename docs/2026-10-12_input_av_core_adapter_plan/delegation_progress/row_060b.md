# Row 60b - second pass of the code review of phase 3 (M3)

Status: needs-review (items 1 to 3 read in full; items 4 and 5 in part). Agent: senior-code-reviewer. Date: 2026-10-13.
Full record: `verification/060b_m3_review_second_pass.md`.

## Result

- Verdict: CHANGES REQUESTED. Blocking findings for M3: 1 (B-01).
- Follow-ups: 13 (S-01 to S-13). Notes: 12 (M-01 to M-12).

## Blocking

- B-01 (rows 142, 26, I-7, 143b, 110): `onvif-session.ts:109` and `onvif-network.ts:74` cap a device reply at 1 MiB; the package strips namespaces with a quadratic expression (`node_modules/onvif/lib/utils.js:56`). One unauthenticated reply of 1,000 KiB held the event loop 41.9 s (measured: 16 KiB 11 ms, 256 KiB 2.8 s). The whole-test deadline cannot end it. Reached at head by operations 95 / 96, the scan probe and the set-IP poll. Smallest fix: a cap per facade (time reader 16 KiB) and one test per facade with the hostile body at the cap.

## To close or rule before the lift (row 88)

1. S-01 (rows 52 to 55): a track without a stored stream statement keeps the simulator's literal `1080p / 25 / H.264` (`devices/status.ts:168`); `resolution` and `codec` cannot be null in the contract. Against decision C36.
2. S-02 (rows 85b / 85c): a camera or microphone loss before its watch is attached is dropped silently (`capture-composition.ts:484, 494`).
3. S-03: three optional members whose absence turns a check off (`candidateSource?`, `sourceAddress?`, `admitHwAddress?`).

## For the controller

- B-01 is called blocking by three stated criteria (in M3's list; reachable without the lift; breaks a bound the file states). The controller may rule it a before-the-lift follow-up.
- S-08: the flaky `service.test.ts` expectation (1 run in 256) is still at head, now `:382-383`.
- S-09: `INGEST_OPEN_STUCK` - a hypothesis (the 22 s give-up bound from the session start against a real-time pusher under load), with its experiment.
- S-07: `relay-check.sh --selftest` proves by tag; 18 rule lines have no control of their own, the bind-before-connect order among them.
- S-01 needs a contract step (two nullable members) or a ruling.

## Method and limits

Read-only. Three targeted checks without a port, a database or the lock (the package's parse on hostile bodies; the staleness of the 24 fuzz controls: 0 stale). No suite, build or typecheck; Graft not queried. NOT read: about 11,000 lines of Core-side tests (`onvif-relay`, `stream-probe`, `camera-watch`, `onvif-network`, the discovery and database tests) and six worker fixtures (`row041`, `row042`, `row186`, `br09`, `row176`, `rtsp_test_camera_check`); the web and mobile readers were read at their fact lines only. Reason: the volume (22,000 lines of tests); the product files of items 1 to 3 and the worker's unit, fuzz and static nets were put first.

## Files written

- `verification/060b_m3_review_second_pass.md`
- `delegation_progress/row_060b.md`

No source file, no decision file and no tracking file was changed.
