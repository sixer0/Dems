---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 143b
milestone: M3 / S13-11 point 2, AD-02
date: 2026-10-13
agent: coder-execution (driver of row 143b, track D)
tier: T3
requirement: S13-11 point 2 (the connection is made FROM the camera-interface address the rule names; no fallback route), the caller's half; AD-02
status: needs-review - built and checked on this Mac's doubles for 2 of the 3 dials and for the whole connection test of an adopted camera; the third dial (the camera watch) is a named remainder; one static rule of the relay was changed and awaits a security confirmation
---

# Row 143b: the source half of the destination rule, at the dials to a stored camera

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CAM` = `apps/core-server/src/capture/adapters/camera`, `RELAY` = `apps/capture-worker/src/relay`.

## 1. Statement

`decideDestination` answers two things for a stored camera: that its address may be dialled, and the camera-interface address the connection must be made FROM (`destination.sourceAddress`). Until this row only the first was applied (row 143). Now:

| Dial to a stored camera | Bound | Where |
|---|---|---|
| Locator read of an open (`GetSystemDateAndTime`, `GetServices`, `GetStreamUri`) | yes | `CAM/onvif-relay.ts` hands the source to `locator.locate`; `CAM/onvif-session.ts` gives it to every socket of the exchange as `localAddress`, IPv4 |
| The relay's RTSP connection, first open | yes | `source` in the start message (`CAM/relay-start.ts`); `RELAY/relay_rtsp.c` `dial`: bind, port 0, before the connect |
| The relay's RTSP connection, every re-open | yes | the same `dial` (the one socket and the one connect of the relay); the relay's own socket rule, asked after every re-open, holds the camera socket's own end to the address |
| Connection test of an adopted camera: the ONVIF test, each locator read, each probe | yes | `modules/capture-discovery/adopted-test.ts` hands the source to the tester; `CAM/stream-probe.ts` hands it to all three |
| The camera watch's time read (heartbeat, `check`, `clockOffsetMs`) | NO - remainder | `CAM/camera-watch.ts` was another row's file when this row started; the session's `read` takes the address, the watch does not hand it in yet (request line, exact change) |

No unbound path was added for a stored camera. An admission of the rule that names no source address in the strict form is a refusal (`STORED_ADDRESS_SOURCE_ABSENT`) at the two callers this row holds, before the reveal. A record start of the relay without a source makes no start message in the Core and is an invalid start message in the relay. With no network configuration the rule still refuses every address (`NOT_CONFIGURED`, C55): unchanged.

## 2. Change set

| File | What |
|---|---|
| `CAM/stored-address.ts` | the judgement answers `{ allowed: true, sourceAddress }` (`string` in the strict form, or `null`); `isSourceAddress` (the one form, the same the relay holds); `storedCameraSourceOf` (a source or a refusal, no third answer); refusal `SOURCE_ABSENT` |
| `CAM/onvif-session.ts` | `test`, `locate`, `read` take the source last; the exchange refuses a text that is none (`CAPTURE_LOCATOR_INVALID`, before any request) and gives it to every socket of its agent |
| `CAM/relay-start.ts` | `source`: required for a record start (refused with `CAPTURE_START_MESSAGE_INVALID` before the injection point is called), optional for a probe; the member stands before `access` |
| `CAM/stream-probe.ts` | `test(candidate, credential, signal, sourceAddress?)`: one source for the ONVIF half, each locator read and each probe |
| `CAM/onvif-relay.ts` | step 1b: the source taken from the judgement, refused when absent; handed to the locator read and to the relay start |
| `modules/capture-discovery/adopted-test.ts`, `connect/service.ts` | the adopted test takes the source from its judgement and hands it to the tester; one optional parameter in the type `ConnectionTester` |
| `RELAY/relay.h`, `relay_core.c`, `relay_rtsp.c`, `relay.c` | member `source` of `RelayStart`; `source_ok` (canonical dotted quad, first number 1 to 223, the library's reader must agree, no name lookup); record mode refused without it; the bind in `dial`; the socket rule holds the camera socket's own end to it; header text "THE SOURCE ADDRESS" |
| `apps/capture-worker/relay-check.sh` | rule "the relay binds nothing" replaced by the positive rule `S13-11` (section 5); `bind` out of the import net; 1 planted line, 7 mutations |
| Tests and fixtures | `test/relay_unit_test.c` (+2 functions), `test/relay_fuzz.c` (invariants, 6 seeds), `test/relay_fuzz_controls.sh` (+2 controls), NEW `test-fixtures/row143b_source_bind.py`, `test-fixtures/row041_relay.py` (the helper states `source`), `row044_door_parent.mts` (one member); Core: `onvif-session.test.ts`, `stored-address.test.ts`, `stream-probe.test.ts`, `onvif-relay.test.ts`, `adopted-test.test.ts`, `test/support/stored-camera-address.ts` |
| `apps/core-server/src/capture/adapters/__tests__/static.test.ts` | SR-8 (C60 (1)): `RULE_BINDERS` = `src/capture/fence/production-parts.ts`, seen by a new pattern (`DestinationPurpose.STORED_CAMERA`), with a planted control; A-10 statement (d): the source half at the callers, the session, the relay start and the stream probe, with a control |

## 3. Exit code

No new code. A source address the host does not hold ends the relay with the existing 20 `CAMERA_UNREACHABLE` (no connection was asked for, nothing was sent); the Core maps it as before. It is not told apart from a refused connection by the code alone (request line). `onvif-relay.test.ts` still reads `relay.h`'s table unchanged.

## 4. Checks (this Mac, 2026-10-13; loopback only; no camera, no credential)

| Check | Result |
|---|---|
| `make` in `apps/capture-worker` (heavy-host lock) | `make rc=0`; `relay_unit_test: 982 checks passed`, 34 of 34 cases, the same under the sanitizers; fuzz `1475136 inputs over 8 entry point(s) ... 0 failures`; `relay-check.sh: build/capture-relay: import net OK`; guard 83 checks |
| `relay-check.sh --selftest` | rc 0; the 8 new controls each `refused as required (S13-11)` |
| `test/relay_fuzz_controls.sh 20` | run 1: 23 of 24 (my own new control did not compile: an unused variable); corrected, run 2: `24 of 24 planted flaws found` |
| `row143b_source_bind.py all` | `14 of 14 runs PASS`: source 127.0.0.1 probes the test camera (exit 0, 5 requests); source 192.0.2.1 in probe and record mode: exit 20, `0 connection(s), 0 request(s)` at the counting double; control with source 127.0.0.1 at the same double: 1 connection, 1 request; no source in record mode and 8 malformed forms: exit 10, 0 connections |
| `row043_reopen.py drop` (existing fixture, new relay) | `11 run(s), 11 PASS, 0 FAIL`; the 5 `drop_*` runs are of this run: the re-open connects with the address bound and the socket rule passes after it |
| Core unit (camera folder, both static files, capture-discovery, composition; loopback) | run 1: 3 red (2 in `test/static/credentials.test.ts`, another row's `operator:set-password`; 1 in my new session test); final run: `Test Files 21 passed (21)`, `Tests 482 passed (482)` |
| Core database, real relay through the Core | `camera-adapter-open.db.test.ts`: 11 passed; `adopted-camera-test.db.test.ts`: run 1 failed on port 8557 in use (I ran both files side by side), alone: `Tests 7 passed (7)` |
| Typecheck `apps/core-server` | 0 errors at the end |

Session test, wrong local address: the test, the locator read and the time read against the fake ONVIF stub with 192.0.2.1 answer `UNREACHABLE` / `NO_ANSWER` / not answered, and the stub's log is empty.

## 5. The relay's static rule that had to change

`relay-check.sh` held "RC-6: the relay binds nothing" in the sources and in the import net. The row orders a bind before the connect, so the rule is now: exactly one bind, in `relay_rtsp.c`, its line pinned; addressed with the start message's source (pinned); port 0 (pinned); before the one connect; record mode refused without the member; the member held to `source_ok`; the socket rule holds the camera socket to it. `listen`, `accept`, `accept4` stay forbidden in both nets. This is a change of a security rule by a driver: a request line asks for confirmation.

## 6. What loopback cannot prove

- On one network a bound and an unbound socket have the same address: a case that CONNECTS does not tell them apart. What shows the bind is the refusal (0 connections), the unit check of the one dial (also after a leg was given up and opened again) and the static pins.
- That a camera sees the camera-interface address, and that nothing leaves by the other interface: a host with two networks (hardware; request line for chapter 3, with `9A/H-09`, `H-10`, `H-11`).
- That the re-open of a RUNNING relay is refused once the host lost the address: the start message is fixed for a relay's life and no host address may be changed here.
- Binding an address does not choose the interface by name. On Linux an interface that is down with its address still configured, plus a default route elsewhere, is the one case to measure (request line, point (d)).

## 7. DRIVER DECISIONS

1. `CAMERA_UNREACHABLE` is the code of a source address that cannot be bound: it fits ("no connection"), and it is retried like any unreachable camera after a loss, with nothing sent.
2. `source` is mandatory in record mode and optional in probe mode. A probe of a camera that is not stored yet has no judged source; that test stays unbound as before (request line).
3. `relay-check.sh` was edited (section 5), and `row041_relay.py`, `row044_door_parent.mts`, `adopted-test.ts` with its test, `connect/service.ts` (one type line) and `test/support/stored-camera-address.ts`: none was in the first ownership list; without them the build, the fixtures or the adopted test would be red. Declared in the closing claims line.
4. The judgement stays an admission when the rule names no source (`sourceAddress: null`); the refusal stands at the dial (`storedCameraSourceOf`). Refusing in the judgement itself would have turned the watch's tests red in a file that was not this row's. Once the watch hands the source on, the refusal can move into the judgement.
5. Loopback is a source address by form (the doubles need it); the product's rule never names it.
6. To keep the capture static list green without editing it: no `sourceAddress:` member is written outside the rule's file (a mapped type instead), and `OnvifTimeReader.read` has a second signature instead of a changed first line (request line).
7. `apps/capture-worker/README.md` and the Makefile comments were not updated.

## 8. Remainder (why needs-review)

The watch's time read (one function, one seam parameter, its test rule, two static entries): exact change in the request line. The row grew beyond M through the relay's static rules and the fixtures.

## 9. Requests left

Five lines in `delegation_progress/file_requests.md`: the watch; the two pins of the capture static list; the RC-6 confirmation; the hardware check for chapter 3; the unstored-candidate test and the exit code.

---
*Generated: 2026-10-13*
