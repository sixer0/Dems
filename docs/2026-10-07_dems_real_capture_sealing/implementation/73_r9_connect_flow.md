---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: coder-execution
blueprint_row: 142
source_plan: identification/02_structured.md row 142; masterplan/03_api_contract.md section 2.6; masterplan/05_capture_architecture_spec.md section A.6.2
tier: 3
status: needs-review
---

# Row 142 - credential-gated connect flow (R-9): operations 95, 96 and the Core side of 89

Status `needs-review`: the code and its tests are done, but two things outside this row's files
keep the flow from running in the product (section 5): the routes are not mounted, and operation 96
cannot commit a device into the replicated registry. Neither is faked. No commit, no lockfile
write, no migration, no real device contacted (D76), `.data/pg*.env` not read.

## 1. What was built

| Piece | Where |
|---|---|
| Read-only ONVIF test, the ONE importer of `onvif` 0.8.3 and of an HTTP agent; a facade with one call and five reads | `apps/core-server/src/capture/adapters/camera/onvif-session.ts:280` (`createOnvifConnectionTester`) |
| Declaration of the package's client with the five reads only (a sixth call does not compile) | `apps/core-server/src/capture/adapters/camera/onvif-cam.d.ts` |
| Limits: single flight, spacing, per minute, the lock-out guard (2 per host in 30 minutes, by rejected request) | `apps/core-server/src/modules/capture-discovery/connect/limits.ts` |
| The flow: `testCandidate` (:351), `adoptCandidate` (:388), `setCredential` (:471); the one maker of a permit `permitFor` (:249); the one place a device is contacted `contact` (:265) | `.../connect/service.ts` |
| The credential statements: INSERT, and the upsert with BIND PARAMETERS in SET (D103, F-129a-1) | `.../connect/statements.ts` |
| Routes of 95, 96, 89 from the registry entries; the seams; `candidateDirectoryOf` for row 132's store | `.../connect/index.ts:184` (`registerCaptureConnectRoutes`) |
| Scripted hostile device for tests (endless body, drip, hang, redirect, token-only) | `apps/core-server/test/support/onvif-odd-device.ts` |
| Static rules G-R10, G-R11; the socket exemption of that one file; the network guard exemption; the adapters file-list pin | `src/capture/__tests__/static.test.ts`, `test/static/network.test.ts`, `src/capture/adapters/__tests__/static.test.ts` |

Folder choice: `modules/capture-discovery/connect/`, operation 89 included (one credential write
path for 89 and 96); `modules/capture-config` is untouched.

## 2. How a credential travels (decisions of this row)

- The reads before authentication run on a client that holds no credential. For the first read
  that needs one, the read is sent WITHOUT it and the device's challenge decides: HTTP Digest (MD5
  or SHA-256 only) gets one digest answer; a challenge without Digest (Basic) gets nothing
  (`SCHEME_NOT_ALLOWED`); a SOAP fault "not authorized" without a challenge gets one WS-Security
  digest token. A refusal ends the test. Result: **at most 1 rejected credential-bearing request
  per failed test** (the contract allows 2). The package's own digest function is wrapped for this.
- One `GetStreamUri` per test (first H.264 profile, else first usable one); the address is compared
  and dropped. No RTSP connection (D82).
- A device that needs no authentication is never sent the credential; the outcome is judged from
  its answer. The stored credential of such a camera is then unverified - stated, not solved.
- `CAPTURE_CONNECTION_TESTED` is written in a unit of its own right after each attempt, also for
  the re-verification of 96, so it stands when the adoption rolls back (SEC35-46). The adoption
  transaction holds the device, the credential row, `CAPTURE_CREDENTIAL_SET`, `CAPTURE_CANDIDATE_ADOPTED`.
- `guardTripped` is written on every `AUTHENTICATION_FAILED` row (false / true), absent otherwise.
- The secret is sealed INSIDE the adoption unit (the envelope authenticates the device id, which is
  minted there). A unit that rolls back leaves an orphan key for the store's `retainOnly` hook.
- An account name over 120 characters is refused 422 on 89, 95, 96: the table's CHECK is 120, the
  contract's schema says 255.

## 3. Checks (commands in section 4; every one has a negative control)

| Check | Result |
|---|---|
| M4-CONN-OUT-1 five outcomes on the stub, real package, adapter and route | pass; stub violations 0, RTSP connections 0; 5 distinct outcomes |
| M4-CONN-NOCRED-1 | pass: 422 with 0 tester calls; type-level permit; static: one `tester.test(` call site, no store read in the folder; control: a fallback double reaches the tester |
| M4-CONN-SSRF-1 | pass: foreign, other-session, untestable, conflicting, address-less, steered loopback, adapter-refused: 0 calls; strict schema refuses host/port/url/address |
| M4-CONN-ORDER-1 | pass (unit + db); search -> test -> adopt -> assign end to end is NOT run (no mounted module) |
| M4-CONN-WEBONLY-1 | pass on the real stage 6: 403 `WEB_CONSOLE_ONLY`, one `ACCESS_DENIED` row each, malformed body included; simulator half is row 132's |
| M4-CONN-ATOM-1 | pass as `dems_app`, 2 runs: failure after the device INSERT leaves 0 rows in both tables; two-concurrent-adoptions case NOT run (needs the registry action) |
| M4-SEC-CONN-1 / -2 | pass: no secret, base64 or Basic in any request; Basic-only receives nothing; 1 credential-bearing request on failure; a challenged clock read gets none |
| M4-SEC-CONN-3 | pass: byte cap, drip, hang, redirect, one-element service list, missing element, 3,000-level body; 0 uncaught exceptions. Heap growth not measured; TLS branch never run (stub has no TLS); connect limit only seen as a 3,000 ms timer request |
| M4-SEC-CONN-4, M4-SEC-RATE-1, M4-SEC-AUD-1 | pass on a manual clock (13 + route case) |
| M4-SEC-CRED-1 | pass: both canaries, 0 hits in responses, log at trace, error log, audit, publications, candidate state, 42 tables; planted control fails the sweep. The account name IS in `capture_device_credentials.username` (clear column by contract, unreadable for `dems_app`). Child-process argv/env and worker log: none exists in this flow |
| M4-SEC-CRED-2 | pass; note: the contract schema trims, so a trailing newline is accepted after trimming |
| M4-SEC-ADOPT-1, M7-CONN-CRED-1 | pass: `DEVICE_CHANGED` 409; credentialed adoption 201, envelope opens, one-character secret stored, secret columns 42501; op 89 replace: one row, new key reference |
| M4-SR-1 (G-R10, G-R11), M4-SEC-NET-1 (`onvif` half) | pass with planted controls |
| Schema pin | `[5, 'dbc-6']`, 42 tables |

## 4. Commands and results

- `npx tsc --noEmit -p apps/core-server`: 0 errors. `npm run lint -w @dems/core-server`: 0 findings in this row's files.
- Unit: `onvif-session.test.ts` 25, `connect/__tests__/limits.test.ts` 13, `service.test.ts` 13, capture static + network guard: 111 passed.
- db (under `.locks/db-migrate.lock`): `connect.db.test.ts` 16 passed, run alone 5 times green.
  **One of 6 paired runs with the acceptance file failed two cases** (the one-character secret on
  CAM-02 and the sweep after it); not reproduced in 5 more paired runs, cause unknown. The case now
  prints status and code.
- Static guards: 2 red, both expected: `credential-store/__tests__/static.test.ts` (pin entry
  requested), adapters `A-5` (red by design). Others red there are rows 134-136 / 66.
- `test/acceptance/contract.test.ts`: 13 failed, not shrunk by this row (its routes are unmounted):
  AC-B-09 x2, AC-B-10 areas 4 and 5, AC-B-14 x4, SR-20 GET, AC-B-93, SC6 x2, the self-check block.

## 5. To wire - requests filed in `delegation_progress/file_requests.md`

1. **Row 132, blocking 96:** an INTERNAL engine action that adds a device to the `captureDevices`
   slice. Without it `DeviceRegistrar` is not provided and 96 answers `503 DISCOVERY_NOT_READY`
   before the re-verification. The db test uses a stand-in that INSERTs the row in the unit: the
   transaction is proven, "publishes `captureDevices`" is not. `CaptureDeviceStatusSchema` also
   lacks `adapter`.
2. **Row 132, blocking the product:** barrel export of the tester and four mount lines in the
   module plugin. Until then no route of this row exists in the running Core.
3. **Row 84's static pin:** one entry for `connect/index.ts`.
4. **`packages/shared/src/api/redaction.ts`:** the account-name rule (exact change in the request).

## 6. Left for the gate (device / browser, scripted flow)

Web: connect dialog on a fake camera through all five outcomes, guard text after two refusals,
abandon paths leave 0 rows, credentialed add shows "Password stored."; tablet / phone: Connect
disabled. Before any real camera: the user's lock-out rule for that model re-pins the guard constant.
