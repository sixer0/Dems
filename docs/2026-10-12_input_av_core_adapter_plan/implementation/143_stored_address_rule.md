---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 143
milestone: M3 / AD-02
date: 2026-10-13
agent: coder-execution (batch 9, agent R3)
tier: T3
requirement: AD-02 point 1 (the rule on the stored address at every use, before the reader) and point 2 (no permissive value under `src/`); GATE CONDITION AD-02
status: complete on this Mac's doubles
---

# Row 143: the destination rule on the STORED camera address, at every use

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CAM` = `apps/core-server/src/capture/adapters/camera`.

## 1. Statement

The stored address of a camera is untrusted: the runtime database role can insert an `ONVIF_RTSP` row and update its `address` (security addendum 04, item 3.4). Until this row the destination rule of row 95 stood in ONE place, the device gate of the credential reader (row 144). It now stands in front of every use of a stored address by the production camera adapter, with or without a credential:

| Use | Where | Refusal | Before |
|---|---|---|---|
| `openSource` - every open, so every new relay | `CAM/onvif-relay.ts`, step 1b | `CAPTURE_CAMERA_ADDRESS_REFUSED`, `reason` = the rule's code | the reader (0 reveals, 0 audit entries, 0 error-log entries), the locator read, the door |
| presence read (heartbeat, `check`) and clock read (`clockOffsetMs`, the adapter's `ntpOffsetMs`) | `CAM/camera-watch.ts`, the one function every read takes its camera from | `CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED`; report `CAMERA_WATCH_ADDRESS_REFUSED` | the time read (0 requests) |
| connection test of an adopted camera | `apps/core-server/src/modules/capture-discovery/adopted-test.ts` (row 146) | `409 CANDIDATE_NOT_TESTABLE` | the bounds, the reader, the tester |

A relay that re-opens its camera leg by itself (row 43) dials the address of its start message again and nothing else; a NEW relay is a new `openSource` and is judged again. The stream address a camera names is already held to the judged host by the ONVIF session (`STREAM_HOST_MISMATCH`, `CAM/onvif-session.ts:369`), so the relay is never started for another host.

## 2. Change set

| File | State | What |
|---|---|---|
| `CAM/stored-address.ts` | new | `judgeStoredCamera(candidate, rule)`: the host as stored, the service address on that host (`http:`, the same text as its host part, no user part), its port; the answer of the rule held to an admission of the address asked. `storedCameraCandidate({ adapterKind, address, endpointRef })`: a stored `host` / `host:port` as the candidate the ONVIF session takes, with the fixed device service path `ONVIF_DEVICE_SERVICE_PATH`. Pure: one type import |
| `CAM/onvif-relay.ts` | changed | one optional dependency `storedAddress`, one refusal code with its sentence, two lines between the stored facts and the read of the credential; header |
| `CAM/camera-watch.ts` | changed | the same dependency; the judgement in `targetOf`; one report code, one clock refusal; a refused address is a beat without an answer and without a read |
| `apps/core-server/src/capture/adapters/index.ts` | changed, one export line | the names of the new file |
| `apps/core-server/src/capture/adapters/__tests__/static.test.ts` | changed | new rule A-10 (three statements, one control); header |
| `CAM/__tests__/stored-address.test.ts`, `stored-address-cases.ts` | new | the judgement on the REAL rule with hand-written host facts; the shared table of refused classes |
| `CAM/__tests__/onvif-relay.test.ts`, `camera-watch.test.ts` | extended | the rigs hand a rule in (it admits the ONE documentation address of the file); one new block each; the import pin of the watch moved by the one file |
| `apps/core-server/src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts` | extended | the two adapters of row 46 are handed the test rule of `test/support/stored-camera-address.ts`; a third adapter with the PRODUCT'S rule and one new case on PostgreSQL |

Not edited: the registry builder, the capture static list, `destination-rule.ts`, `credential-reader.ts`, `credential-holders.ts`, `apps/core-server/test/static/credentials.test.ts` (no entry of it moves).

## 3. The dependency, as the composition hands it in

`storedAddress?: StoredCameraAddressRule` = `(host: string, port: number | undefined) => { allowed: true, destination? } | { allowed: false, refusal }`. It is the SAME shape as the `storedAddress` the credential wiring takes (`CaptureCredentialHoldersDependencies`), so the composition makes ONE binding of `decideDestination` with the purpose `STORED_CAMERA` on the host's facts (camera interface, camera subnet, the host's own addresses: the facts row 85 hands in at the real entry, decision C46) and gives it to three takers: the wiring, `createOnvifRelayCameraAdapter(devices, { ..., storedAddress })` and `createCameraWatch({ ..., storedAddress })` - and to `adoptedCameraTestControl(app).provide({ reader, storedAddress })` for row 146. No file of this row reads a host fact or builds the binding; the registry builder was not edited (a request line names the member for agent R1).

## 4. Checks (this Mac; 2026-10-13; no camera, no network: the unit doubles have no socket, the database file dials loopback only)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit: judgement, adapter, watch, static A-10 | `npx vitest run --project unit --maxWorkers=2` on `stored-address.test.ts`, `onvif-relay.test.ts`, `camera-watch.test.ts`, `adapters/__tests__/static.test.ts` | run 1: `Test Files 4 passed (4)`, `Tests 82 passed (82)` |
| PostgreSQL, real relay and worker (row 46's T-2 with the new case) | `(ulimit -c 0; lockf heavy-host; lockf db-migrate; npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts)`, sandbox off | run 1: `Test Files 1 passed (1)`, `Tests 11 passed (11)`; `0 remain with the run prefix` |
| Tree-wide static rules and the touched folders | `... --project unit ... test/static`, the static tests of `capture`, `capture/adapters`, `capture-config`, the folders `modules/capture-discovery`, `capture/adapters/camera` (39 files) | run 1 was started with the sandbox ON by mistake: the files that bind loopback failed on `EPERM` (99 cases, none a judgement of code). Run 2, sandbox off under the heavy-host lock: `Test Files 1 failed, 38 passed (39)`, `Tests 1 failed, 660 passed (661)` - the one red was statement (b) of my own new rule A-10 against a line of row 146's file (a rule re-keyed instead of handed on); the line was changed and the two files run again: `Test Files 2 passed (2)`, `Tests 40 passed (40)` (a third run, of my own new test) |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in a file of this row. Errors seen in files in flight elsewhere, not edited: `src/capture/__tests__/supervisor.test.ts:1069` (`maxRestarts`: R2), `cli/production-key*.ts` and `src/sealing/__tests__/production-key.test.ts` (a module not yet written: R9) |
| Lint | `npx oxlint` on the changed and new files | exit 0 |
| Secret scan | `node scripts/secret-scan/count-only.mjs` on `CAM`, `modules/capture-discovery`, the database test | 0 in a file of this row (4 in two older fixture tests, `onvif-session.test.ts` 3 and `probe-answer.test.ts` 1, not edited) |

### The gate condition

"Each of the five refused address classes gives the named code with 0 reveal entries and 0 relay starts; a search of `src/` for a permissive rule value finds 0."

| Class | Stored value of the case | Code of the rule | Unit (door and reader doubles, REAL rule) | PostgreSQL (real reader, audit trail, real door) |
|---|---|---|---|---|
| loopback | `127.0.0.1`, `127.8.9.10:8557`; `127.0.0.1:8557` on the clone | `LOOPBACK` | refused, 0 reader calls, 0 locator reads, 0 children | refused; trail +0, error log +0, relays +0 |
| unspecified | `0.0.0.0` | `UNSPECIFIED` | same | same |
| link-local | `169.254.10.20` | `LINK_LOCAL` | same | same |
| multicast | `224.0.0.251` | `MULTICAST` | same | same |
| the host's own addresses | `192.168.50.1`, `10.20.0.5` | `HOST_ADDRESS` | same | same (`192.168.50.1`) |
| further: public, out of subnet, another interface's subnet, a name, the subnet broadcast, a port outside the list, a service address on another host, loopback written as an integer, no service address, no host | 13 cases | their codes | same | public, out of subnet, other interface: same |

On PostgreSQL the address is moved by the RUNTIME role (`core.app.db.pool`), which is the finding itself; the counts compared before and after the nine refusals are reveal entries, the whole audit trail, the reader's error log, requests at the ONVIF double, relay processes and connections at the sink: all equal. The control (an address of the camera subnet) goes on to the reader: 1 reveal, then the locator read of that adapter, which is a counting double so that nothing is dialled.

"Every open": a row moved to loopback between two opens refuses the second with no reveal; moved back, the third passes (unit). The same for the watch: a `PRESENT` camera whose row is moved is read no more and becomes `ABSENT`.

The search of `src/` (rule A-10, a test that runs with the unit suite): (a) `allowed: true` is written as a VALUE in 4 production files with pinned counts - the rule itself (4), the judgement (1, returned after the handed-in rule admitted), the search spacing (1), the access decision (1); (b) 0 production sources name a rule of the tests (`loopbackDestination`, `loopbackStoredCameraAddress`, `TEST_RULE_...`, a `permissive...` or `allowLoopback...` name), 0 give a stored-address rule a value of their own; (c) the judgement is called by three pinned files, once each, on the line before the use of the address. Without a rule handed in the judgement refuses (`STORED_ADDRESS_RULE_ABSENT`): asserted for the adapter and the watch.

## 5. Doubles, and what stays unproven

- Doubles: the door, the locator read, the reader and the time reader of the unit files; on PostgreSQL the scripted ONVIF device (8557), the test camera (8565), the sink (8563), the existing `build/capture-relay` and worker (not rebuilt). The host facts are hand-written (camera interface `192.168.50.1/24`, office interface `10.20.0.5/24`).
- Unproven: that a real host's facts reach the three takers (row 85 binds them; C46); the session-start check of AD-02 point 3 on a booted Core ("clone with a loopback row, assigned, on a Core built without the test value: start 409") - it needs the lift (rows 85, 88) and is theirs; that the sockets of the ONVIF session (test, locator read, time read) and of the relay are bound to the camera-interface address the rule names (`sourceAddress`: the caller's half of point 2 of S13-11; only the set-network file of row 110 binds it today, `CAM/onvif-network.ts:349` - a request line); a camera on a real camera network (`9A/H-09`, `H-10`).

## 6. DRIVER DECISIONS (for the controller to confirm)

1. **The dependency is optional in the type and mandatory in effect.** Without it every open and every read is refused. A required member would have broken the typecheck of the registry builder agent R1 is writing at this moment; the refusal is the fail-closed equivalent. The controller may make it required once row 85 has landed (one character in two files).
2. **A refused address in the heartbeat counts as a beat without an answer** (the camera becomes `ABSENT`, told once, no fault), not as "nothing concluded": a row moved to a refused address must not stay `PRESENT`. `check` and `clockOffsetMs` refuse by a named code instead of answering "absent".
3. **The judgement also holds the service address to the stored host** (same text, `http:`, no user part) and an admission to the address asked. The rule of row 95 judges one host text; without this a candidate could be judged at one host and dialled at another.
4. **`storedCameraCandidate` and the device service path live in the judgement file.** Row 46 left open who forms the service address of an adopted camera from the stored `host[:port]`; it is the ONVIF standard's fixed entry point, and one function now forms it for the adapter's composition and for row 146. Row 85 is told in a request line; nothing forces it to use the function.
5. **Rule A-10 pins every admission value under `src/`**, including two that are not destinations (search spacing, access decision). One more `allowed: true` anywhere is then a visible decision. If that proves noisy the pin can be narrowed to `src/capture/` and the modules that hold a stored-address seam.
6. **The existing reader-gate case of row 46 is unchanged**: its two adapters get the test rule at the adapter, so the case still shows the READER'S gate; the adapter's own rule has its own case with a third adapter.
7. New files were written with the Write tool; every edit of an existing file used the Edit tool.

## 7. Requests left in `delegation_progress/file_requests.md`

Three lines: the member for row 85 (R1); the source-address half of the rule (controller); the answer on A-9 for the files row 85 will name (information).

---
*Generated: 2026-10-13*
