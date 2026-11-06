# Row T3 - the survivors of review 60c made red, a port per test, X-01, the header parse (decisions C98, C100 (2), C61 (4))

Status: **complete**. Agent: test-expert (T3, track D). Date: 2026-10-13. Full record: `test/t3_mutation_and_ports.md`.

## Result per item

1. THE SURVIVORS - **18 of 18 red on a mutant, 0 left.** Mutants of TypeScript in memory (a vitest transform under
   `.cache/task4-t3/`, no file written); of the relay by a stand-in or a patched start in a scratch driver.
   - `onvif-network.test.ts`: six cases appended - the source bind on the wire (192.0.2.1: `NO_ANSWER`, 0 requests) and
     as asked (local address, family 4), the connection limit (a timer that FIRES on a connection that is never
     established), the request limit (a silent device), the reply guard by behaviour (12 KiB at the gateway step: no
     reboot is sent), the 2,048 bound of a Digest challenge. Eight mutants red; one (`connect` no longer cancels the
     timer) is equivalent and survives - stated.
   - the two leak sweeps: the control plants the secret through the product's own sinks (logger, error log, an audit
     entry through the pipeline, a registry row, ...) and the SAME sweep must find 1 in each; real run first: 0.
   - `connect.db.test.ts`: the TABLE's CHECK asked as `dems_app` (23514 by the constraint's name); the credential case
     pins `23514` of the nonce CHECK and that the registrar returned.
   - `stream-test.db.test.ts`: `H264_1080P25` and the lower-case answer pinned; the recorded-file comparison is a case
     of its own - skipped BY NAME without the file, a failure with `DEMS_REQUIRE_RECORDED_FILES=1`.
   - the camera's `end()` throws without its exit line, in all four database files (17 `?? 0` places).
   - `service.test.ts:237`, `adopted-camera-test` (the tester wrapper hands the source address on; a wire case),
     `row042_probe.py` (the hostile text counted in VALUES), `row186_bounds.py` (the literal `True` replaced by the
     listener's queue), `row041_relay.py` and `camera-adapter-open` (a control of the environment listing),
     `rtsp_test_camera_check.py` (`--runs 0` fails).
   - FINDING on the way: on macOS 27 `ps eww` shows NO environment for a program of the system (`/bin/sleep`); it does
     for the relay's class of program. The controls use that class.
2. T-01, PORTS AND LOCKS - **done.** ONVIF device: 8555 `adopted-camera-test`, 8557 `camera-adapter-open`, 8575
   `stream-test`, 8576 `minted-code` (8559-8561 are OFF the device's list); `onvif-session.test.ts`: a port the system
   hands out. Test camera: 8565/8566 `stream-test`, 8567/8568 `minted-code`, 8569 `adopted-camera-test`, 8570
   `camera-adapter-open`. One file per number, by a search. New `test/support/heavy-host-lock.ts`; every case that
   starts the camera or the relay takes the lock. The five database files together, two workers, three times:
   `73 passed (73)` each, `EADDRINUSE` 0.
3. X-01 - **does not hold; nothing changed in the order.** The order is as the review reads it (camera double, control
   push, relay - all after START + 1.5 s) for `row041` and its users, not for `row58_gate.py` (control first, no camera
   double). But the camera double takes 0.05 s with its clip cached, 1.9 s at most without (HEVC encode), in a 12 s
   listen window; the worker connects 2.9 s after START. A late double would end by the listen timeout's code, not
   `INGEST_OPEN_STUCK`. The fixture now records its timeline per session. No ten runs (no change to prove).
4. THE HEADER PARSE - **measured; no bound added, the existing one is now tested.** Node admits a 16,384-byte head.
   The package is linear on commas, quotes, an unterminated quote, repeated `nonce=`, repeated scheme words; QUADRATIC
   on one shape (spaces before a quoted value with a tail): 0.86 ms at 2,048 characters, 53.8 ms at 16,000 - in the
   package alone. `digestChallengeAllowed` already refuses above 2,048 characters in both files (worst through it:
   1.01 ms). That line was held by no test (62 of 62 and 19 of 19 passed without it); one case per file holds it now.

## Files

Changed (Edit tool only): eight test files and `test/support/onvif-odd-device.ts` of `apps/core-server`; four fixtures
of `apps/capture-worker/test-fixtures` (`row042_probe.py`, `row186_bounds.py`, `rtsp_test_camera_check.py`,
`row041_relay.py` - additive criteria and facts, the start order untouched); one line each in `file_claims.md` (plus
a closing line) and `file_requests.md`. New: `apps/core-server/test/support/heavy-host-lock.ts`,
`test/t3_mutation_and_ports.md`, this file. **No product source written** (write times in the record, section 6).

## Checks

unit (camera adapter, discovery, test support) `565 passed (565)`; the five database files together x 3
`73 passed (73)`; static set `778 passed (778)`; `tsc --noEmit` rc 0; `oxlint` rc 0; worker `check.sh src` /
`--selftest` / `relay-check.sh` rc 0 / 0 / 0; `row042_probe.py start` 21 PASS; `row186_bounds.py session` 23 PASS.

## Not done (outside the fixed list)

The review's four "weaker, not counted" tests; T-07 beyond the lock helper, T-10, T-11, T-12; X-02, X-03, X-05, X-08.

## Driver decisions for the controller

- The sink block of `camera-adapter-open` holds the heavy-host lock for the whole block.
- The recorded-file comparison is skipped by name on a host without the file; `DEMS_REQUIRE_RECORDED_FILES=1` fails it.
- `onvif-session.test.ts` takes no lock (ports of the system only).
