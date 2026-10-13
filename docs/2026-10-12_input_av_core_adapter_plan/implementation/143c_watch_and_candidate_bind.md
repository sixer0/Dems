---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 143c
milestone: M3 / S13-11 point 2, AD-02; decision C65
date: 2026-10-13
agent: coder-execution (driver of rows 143c and 85d, wave 10, track D)
tier: T3
requirement: S13-11 point 2 (every connection to a camera is made FROM the camera-interface address the rule names; no fallback route); AD-02 (1); C65 (the candidate of operations 95 / 96 under REAL_PRODUCTION)
status: complete on this Mac's doubles; three out-of-area edits declared; three driver decisions for the controller
---

# Row 143c: the third dial of a stored camera, and the candidate's test in production

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `CAM` = `CS/src/capture/adapters/camera`, `CONNECT` = `CS/src/modules/capture-discovery/connect`.

## 1. Statement

| Dial | Bound | Where |
|---|---|---|
| Stored camera: locator read, relay (first open, every re-open), adopted-camera connection test | yes (row 143b) | unchanged |
| Stored camera: the camera watch's time read - heartbeat, `check`, `clockOffsetMs` | YES, this row | `CAM/camera-watch.ts`: `targetOf` keeps the judgement, takes `storedCameraSourceOf(judged)`, answers the judged candidate WITH its source; the one `reader.read(target.camera, bound.signal, target.from)` hands it on; the seam `CameraTimeReader.read` REQUIRES the third parameter |
| Candidate that is not stored yet (operations 95 and 96), capture operation `REAL_PRODUCTION`: ONVIF half, each locator read, each stream probe | YES, this row (C65) | `CONNECT/service.ts` `testerOf`: the tester of the attempt is the provided one BOUND (`boundTo`) to the source the destination rule names for the candidate's address; `CAM/stream-probe.ts` `boundTo` |
| The same candidate under any other capture operation | unbound, exactly as before | `testerOf` returns the provided tester; no rule is asked |

Every caller of `judgeStoredCamera` is now a taker of its source (static rule A-10 (d): the list "callers that are no taker" is empty).

### The watch

A missing source is a refused address, by the two existing names: `check` / `clockOffsetMs` reject `CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED`; a heartbeat reports `CAMERA_WATCH_ADDRESS_REFUSED` and counts a beat without an answer. No read is made, nothing is sent. No new code word.

### The candidate (C65)

- `CONNECT/index.ts` (the one maker of an app's seams) ALWAYS states `candidateSource`: `required: true` with the rule handed in by the composition when `isProductionCaptureOperation(captureOperationOf(app.config))`, else `required: false`.
- The rule is the ONE binding of the composition (`storedCameraAddressRuleOf`, purpose `STORED_CAMERA`): `CS/src/capture-composition.ts` hands it to `captureConnectControl(app).provideCandidateRule` in the same port that feeds the adopted-camera test (fifth taker). No second binder (SR-8 list unchanged).
- Order in `contact`: `testerOf` is the first statement, before `limits.refusal`. So a refusal spends no bound, opens no turn, writes no audit row, sends nothing.

| Production case | Answer (all exist in the contract of operations 95 / 96) |
|---|---|
| rule admits and names a source | the tester bound to it; ONE call `tester.test(candidate.camera, sealed, deadline.signal)` as before |
| the rule refuses - NO NETWORK CONFIGURATION is the rule's `NOT_CONFIGURED`; also loopback, host address, other subnet, public, port not listed, malformed service address | `409 INVALID_STATE` / `CANDIDATE_NOT_TESTABLE`; log line `CAPTURE_CANDIDATE_TEST_ADDRESS_REFUSED` with the rule's word, never the address |
| the rule admits and names no source address | the same 409 (`STORED_ADDRESS_SOURCE_ABSENT` in the log) |
| no rule handed in (the composition did not run), or a tester without `boundTo` | `503 NOT_READY` / `DISCOVERY_NOT_READY` |
| the tester refuses the address as a source | the same 409 |

Under `REAL_DEVELOPMENT` and `SIMULATED` nothing changed: the existing cases of `service.test.ts`, `connect.db.test.ts`, `minted-code.db.test.ts`, `capture-discovery.db.test.ts` and `capture-discovery.booted.db.test.ts` pass UNEDITED (the one existing pin `tester.test(candidate.camera, sealed, deadline.signal)` and "one call of the tester in the folder" hold as written - which is why the bind is `boundTo` on the adapter side and not a fourth argument).

## 2. Change set

| File | What |
|---|---|
| `CAM/camera-watch.ts` | header paragraph; import `storedCameraSourceOf`; seam's third parameter; `ReadTarget`; `targetOf`; the one read |
| `CAM/stream-probe.ts` | member `boundTo(fromAddress)` (held to `isSourceAddress`, else `CAPTURE_LOCATOR_INVALID`), two import names |
| `CONNECT/service.ts` | header paragraph; `ConnectionTester.boundTo?`; `CandidateSourceBinding`; seam `candidateSource?`; `testerOf`; `CANDIDATE_TEST_ADDRESS_REFUSED`; two lines in `contact` |
| `CONNECT/index.ts` (NOT in the first claim) | control member `provideCandidateRule`, state member, `production`, seam `candidateSource` |
| `CS/src/modules/capture-discovery/index.ts` (NOT in the first claim) | ONE export line: `captureConnectControl` |
| `CS/src/capture-composition.ts` | the port `provideConnectionTest` also hands the binding to the connect flow; one import name |
| `CS/src/capture/adapters/__tests__/static.test.ts` | A-10: the watch's pinned call and use lines by delta; the watch and `connect/service.ts` in `JUDGEMENT_CALLERS` / `SOURCE_TAKERS`; "no taker yet" = empty; pins of the one read, `boundTo`, the binding's two makers |
| Tests | `CAM/__tests__/camera-watch.test.ts` (rule names a source; double records it; 4 cases), `onvif-session.test.ts` (3 cases: the watch through the REAL time reader on the fake ONVIF stub), `stream-probe.test.ts` (1 case), `CONNECT/__tests__/service.test.ts` (7 cases), `CONNECT/__tests__/stream-test.db.test.ts` (1 case, NOT in the first claim: real relay + test camera 8565 + scripted ONVIF device), `CS/src/__tests__/capture-composition.db.test.ts` (2 lines, NOT in the first claim) |

## 3. Checks (2026-10-13, this Mac, loopback only; no real camera, no credential; no binary rebuilt)

| Check | Result |
|---|---|
| Unit, sandbox on: watch, stream probe, stored address, both static files, `test/static`, connect service and limits, discovery static, adopted test, composition | run 1: `Test Files 2 failed, 24 passed (26)`, `Tests 4 failed, 440 passed (444)` - all four in MY new cases (a documentation range is `PUBLIC_ADDRESS` for the product's rule; one regex); after the fix the two files: `Tests 55 passed` of 56 then, third run (own new test) `camera-watch.test.ts`: `Tests 26 passed (26)` |
| Loopback unit (heavy-host lock): `onvif-session.test.ts`, `onvif-relay.test.ts` | `Test Files 2 passed (2)`, `Tests 92 passed (92)` |
| Database + real app (both locks): `connect.db`, `minted-code.db`, `capture-composition.db`, `capture-discovery.db`, `capture-discovery.booted.db` | `Test Files 5 passed (5)`, `Tests 58 passed (58)`, `0 remain` |
| Database + real relay + test camera (both locks, one worker): `stream-test.db`, `capture-config/__tests__/adopted-camera-test.db` | `Test Files 2 passed (2)`, `Tests 18 passed (18)`, `0 remain` |
| Fact line of the bound test (`.cache/row050-stream-test/facts.log`) | `[row143c] bound: held REACHABLE; not held UNREACHABLE (NO_ANSWER) in 493 ms; ONVIF requests after it 0; relays after it 0; camera {"auth_digest_ok":4,... "connections":1, ...}` |
| Typecheck `CS` | `tsc rc=0` |
| oxlint on the five changed sources | no finding |

0 requests on every refusal, asserted on the per-request record: the fake ONVIF stub's `requestLog()` (watch: no source, a source that is no address, no rule, an address the host does not hold) and the scripted ONVIF device's `requests()` plus the test camera's counters (bound candidate test from 192.0.2.1).

## 4. Doubles and what stays unproven

| Double | What |
|---|---|
| fake ONVIF stub (`test/support/fake-onvif-stub.ts`), loopback | the camera of the watch cases; the rule of those cases is a rule of the test that admits the stub and names the source under test |
| scripted ONVIF device 8557 + `rtsp_test_camera.py` 8565 + the relay of the worker build | the bound candidate test |
| the connect flow's spy tester; the PRODUCT'S rule (`storedCameraAddressRuleOf`) on hand-written host facts | the refusal table of section 1 |

| Unproven | Check |
|---|---|
| a camera sees the camera-interface address for the watch's read and for a candidate's test; nothing leaves by the office interface | `9A/H-09`, `H-10`, `H-11` (the chapter-3 request of row 143b covers the same capture) |
| operations 95 / 96 through their ROUTES on a booted `REAL_PRODUCTION` Core (proven here: the service with the product's rule, the static pin of the wiring, the composition's door on the real app) | row 86 / row 88's proof; `9A/H-09` |
| the watch attached to a built adapter (row 88) | row 88 |

## 5. DRIVER DECISIONS

1. THE RULE OF A CANDIDATE IS THE STORED-CAMERA RULE (purpose `STORED_CAMERA`, the composition's one binding). An adopted candidate becomes a stored camera at that very address, and every later dial is held to this rule; no second binder was made (SR-8). Consequence: on a production Core a candidate OUTSIDE the camera subnet (a camera still at its factory address) cannot be tested or adopted before it is re-addressed - the alias purposes are the scan's and set-IP's.
2. ONE ANSWER FOR EVERY RULE REFUSAL, `409 CANDIDATE_NOT_TESTABLE`, as the adopted-camera test answers (row 146); the rule's word is in the log line only. A missing network configuration is therefore not told apart for the operator. A reason of its own would be a contract addition (V3): request line.
3. OUT-OF-AREA EDITS: `connect/index.ts`, `capture-discovery/index.ts` (one export), `stream-test.db.test.ts`, `capture-composition.db.test.ts`. The seams of an app are made in `connect/index.ts` only; without it the ruling would exist behind a seam nobody states (fail-open). Both files had no owner in this wave.
4. The refusal is logged (`note`), not written to the persistent error log: the connect host has no such seam and the refusal is an answer of the operation, not a fault.
5. `seams.candidateSource` is optional in the TYPE (the flow's existing test doubles state no capture operation and had to stay unedited); a static pin holds that the one production maker always states it.

## 6. Requests left

Three lines beginning `row 143c` in `delegation_progress/file_requests.md`: V3 (a reason for "camera network not configured", optional, a ruling first); the controller (the out-of-area edits and the STORED_CAMERA decision); the README / hardware chapter 3 (the factory-address consequence and the two extra captures). The capture static list (`src/capture/__tests__/static.test.ts`) needed no move: SR-2 and the G-R10 / G-R11 pin are green as row 143b left them.

---
*Generated: 2026-10-13*
