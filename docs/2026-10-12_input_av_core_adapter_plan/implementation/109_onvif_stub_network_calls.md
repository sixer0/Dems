---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 109
package: M10 | WP-22a
date: 2026-10-12
agent: coder-execution
tier: T3
status: complete
---

# Row 109 - the fake ONVIF stub answers the four network calls

## Statement

`apps/core-server/test/support/fake-onvif-stub.ts` now answers the four calls of the set-camera-address exchange and has four switchable modes. It is a test double: three listeners on the literal 127.0.0.1, ephemeral ports, nothing contacted. Everything is OFF unless a stub is built with the new option `network`; a stub built without it behaves exactly as before (the four calls stay violations, `SystemReboot` included).

## Change set (2 code files, both in the Ownership Area)

| File | Change |
|---|---|
| `apps/core-server/test/support/fake-onvif-stub.ts` | additive: 316 lines added, 1 line replaced (the "operation not allowed" condition gains `networkCall === null &&`) |
| `apps/core-server/test/support/fake-onvif-stub.test.ts` | additive: one new `describe` block, 11 tests; 7 imports added |

No other file was written. No commit, no staging.

## What was added

| Item | Content |
|---|---|
| Option `network?: FakeOnvifNetworkOptions` | `hwAddress`, `address`, `prefixLength`, `gateway`, `rebootNeeded` (default true), `gatewayFault`, `gatewayReadBack`, `rebootDropsConnection` |
| The 4 calls (`FAKE_ONVIF_NETWORK_OPERATIONS`) | `GetNetworkInterfaces`, `SetNetworkInterfaces`, `SetNetworkDefaultGateway`, `SystemReboot`; all four authenticated exactly as `GetProfiles` is (WS-Security digest or HTTP Digest; a password in clear is still a violation) |
| State (`networkState()`) | interface token, hardware address, IPv4 address, prefix, DHCP flag, gateway, pending change, reboot count, twin endpoint reference. With `rebootNeeded` the change is applied by `SystemReboot`, otherwise at once |
| Record (`networkRequests()`) | per authenticated network request: operation, `wellFormed`, `accepted`, `refusal` (`NOT_WELL_FORMED`, `INTERFACE_TOKEN_UNKNOWN`, `ADDRESS_INVALID`, `GATEWAY_REFUSED`), and the address, prefix, DHCP flag, gateway it carried (an address only when it is dotted IPv4). Cleared by `resetLog()` |
| `setNetworkMode(mode, only?)` | the 4 modes below; `only` limits a reply-shape mode to one call |
| `isWellFormedXml(text)` (exported) | the stub's judge of a request: one element, balanced tags, quoted attributes, no bare `&`, no stray `<`; refuses DOCTYPE, CDATA, processing instructions |
| Constants | `FAKE_ONVIF_NETWORK_DEFAULTS`, `FAKE_ONVIF_MARKUP_TOKEN`, `FAKE_ONVIF_OVERSIZED_REPLY_BYTES` (2 MiB; the connection test's cap is 1 MiB, `onvif-session.ts:68`), `FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION` |

### The four modes

| Mode | What the stub does | What a later row can prove with it |
|---|---|---|
| `MALFORMED_REPLY` | status 200, body cut inside `<s:Body>`; a Set call is still obeyed | the set-network file survives the parse (S13-12 c) |
| `OVERSIZED_REPLY` | a well-formed body above 2 MiB | the byte bound of the set-network file |
| `MARKUP_TOKEN` | the interface token is `eth0"><x y='1'>&`, escaped in the reply. Written back raw, the request is not well-formed: fault `ter:WellFormed`, record `wellFormed: false`. Written back escaped: accepted | "the request it sends is well-formed" is read from `networkRequests()` |
| `TWO_ENDPOINTS` | each Probe is answered by two endpoint references from the one address (the device and a twin) | the conflict flag of DR-6: the product refuses with 0 Set requests in the record |

## Evidence

| Check | Command | Result |
|---|---|---|
| Targeted tests, run 1 | `npx vitest run --project unit --maxWorkers=2 test/support/fake-onvif-stub.test.ts src/capture/adapters/camera/__tests__/onvif-session.test.ts test/support/lane-camera-stub.test.ts` (sandbox off: loopback binding) | `Test Files 2 failed | 1 passed (3)`, `Tests 1 failed | 75 passed (76)` |
| Targeted tests, run 2 (after the failure) | same | `Test Files 1 failed | 2 passed (3)`, `Tests 1 failed | 81 passed (82)` |
| Typecheck | `npx tsc --noEmit` in `apps/core-server` | exit 2; 9 errors, all in `src/db/fixtures/pipeline.ts:705` and `src/db/mapping/rows.ts:924,925,958`; 0 in the two files of this row |

Reading of the results:

- `fake-onvif-stub.test.ts`: passed in run 2 with all its tests (49), the 11 new ones included. The existing tests of the file were not edited.
- `lane-camera-stub.test.ts`: 6 of 6 passed in run 2, including "REAL_PRODUCTION: refused by name BEFORE anything is started" - the launcher still refuses the stub in production (the row's verification cell). The launcher builds the stub without `network`.
- Run 1 counted 76 tests in 3 files with 2 files failed: one file (6 tests, by the count the launcher file) was not collected. Its error text was not captured (only the tail was read). It passed unchanged in run 2. Other rows were writing files of this workspace at that moment. NOT EXPLAINED beyond that.
- `onvif-session.test.ts`: 26 of 27 passed. The one failure, "REACHABLE: the fixture account, one H.264 profile ...", is `toEqual` against a result that now carries a member `profiles`. That member comes from `onvif-session.ts`, which row 26 is changing at this moment (claimed in `file_claims.md`; both files show as modified, the diff of `onvif-session.ts` holds 7 lines with `profiles`). The stub's `GetProfiles` reply is byte-for-byte what it was. Not a result of row 109.
- The typecheck errors are in files of the schema row in flight (new column `sourceFacts`, nullable slot columns). Not a result of row 109.

## The double, and what stays unproven

- The double is the stub itself. It never changes an address and never leaves 127.0.0.1: "the camera moved" is a value in `networkState()`. A wait for the same MAC at a new address (row 111) therefore reads the same listener.
- The requests in the stub's test are written by a reference client in the shape of the `onvif` package (`node_modules/onvif/lib/device.js:230-388`, `lib/cam.js:1165-1178`). The package itself was not run against the stub here: that is row 110.
- Unproven, for the hardware package: what a real camera answers to the four calls, its fault codes, whether it asks for a reboot, how it treats a gateway outside the new subnet (`9A/H-nn`, experiment E-14).

## Notes for row 110

1. The `onvif` package's `setNetworkDefaultGateway`, when given a callback, sends a fifth request by itself, `GetNetworkDefaultGateway` (`device.js:384-388`). The stub treats it as a violation unless built with `network: { gatewayReadBack: true }`.
2. The package's `setNetworkInterfaces` writes `options.interfaceToken` into the request without escaping (`device.js:282`). Mode `MARKUP_TOKEN` shows it.
3. The package's `systemReboot` uses the service key `deviceIO` (`cam.js:1167`); the stub answers on any path of its one HTTP port.

## DRIVER DECISIONS (for the controller to confirm)

1. The network calls are opt-in (`network` option) so that every existing user of the stub is unchanged, including the existing test that pins `SystemReboot` as a violation.
2. `GetNetworkDefaultGateway` is not one of the four: a violation by default, answered only on request.
3. Two options beyond the row's list, each a tolerated failure of the reference (`onvif_client.py:219-229`): `gatewayFault`, `rebootDropsConnection`.
4. A DHCP request is obeyed and recorded (`dhcp: true`), as a camera would; "DHCP is not carried" is the product's rule, shown by 0 such records.
5. `lane-camera-stub.test.ts` was added to the one targeted run because the verification cell names the launcher's refusal.

## Requests

None left in `file_requests.md`. No request of row 26 for the stub was present there when checked (twice, last before this record).

## Requirement identifiers

WP-22a (test support part); the stub side of S13-12 (c). S13-04 and S13-11 are not closed here: the stub only makes them observable (authenticated request count in `requestLog()`, 0 packets = 0 records).

---

# Second pass (wave 10, agent T1, 2026-10-13)

## Statement

The row was already built and committed (`b7ed4c60`): the four calls and the modes MALFORMED_REPLY, OVERSIZED_REPLY, MARKUP_TOKEN, TWO_ENDPOINTS exist as recorded above and were NOT rebuilt. The four calls were checked again against the design, not taken from memory: `masterplan/01_specs.md:150` (S2-5) and `:403` name `GetNetworkInterfaces`, `SetNetworkInterfaces`, `SetNetworkDefaultGateway`, `SystemReboot`; no DNS call is in the design. This pass adds what the wave-10 brief asks beyond the first record: a per-request HTTP record with the Authorization scheme, a camera that APPLIES the address by moving its listeners, a camera that accepts and does NOT apply, and markup in free-text fields. Test support only; no file under `src/` was written.

The stub file is not claimed by any agent of this wave (`file_claims.md`; row 143b owns `camera/onvif-session.ts` and its tests, not the stub), and the request record has to sit inside the stub's HTTP handler, so the additions are in the stub itself and not in a sibling file. Every default is the earlier behaviour.

## Change set (2 code files, Edit tool only)

| File | Change |
|---|---|
| `apps/core-server/test/support/fake-onvif-stub.ts` | additive. New exports: `FakeOnvifHttpRequest`, `FakeOnvifNetworkApply`, `FAKE_ONVIF_MARKUP_TEXT`; network options `onApply`, `movedPorts`; mode `MARKUP_TEXT`; state members `location`, `changesNotApplied`; stub methods `httpRequests()`, `networkSettled()`. The body of `start()` / `stop()` became the local functions `openListeners()` / `closeListeners()` (same statements, the ports read from a variable) so that a move can reuse them |
| `apps/core-server/test/support/fake-onvif-stub.test.ts` | 6 new cases inside the existing row-109 `describe`; 1 import added. No existing case edited |

## What was added

| Item | Content |
|---|---|
| `httpRequests()` | every request the device listener receives, on every stub (with or without `network`), recorded when the request HEAD arrives - so also a request that is never answered. Fields: `listener` (`ORIGINAL` / `MOVED`), `port`, `method`, `path` (no query string; at most 256 characters), `queryPresent`, `soapAction` (the `SOAPAction` header or the `action` parameter of `Content-Type`; `null` when absent, `?` when no plain URI), `operation`, `authorizationPresent`, `authorizationScheme` (`Basic`, `Digest`, `Bearer`, `Negotiate`, `OTHER`, `null`), `wsSecurity` (`NONE`, `DIGEST`, `CLEAR`). Never a header value, a query string, a nonce, a user name or a secret. Cleared by `resetLog()` |
| `network.onApply: 'MOVE'` with `network.movedPorts` | when a call applies a CHANGED address (SystemReboot, or SetNetworkInterfaces on a camera built with `rebootNeeded: false`), the answer is written on the old port, then the stub closes its three listeners and opens them on `movedPorts`. The old ports refuse from then on; XAddrs, the service addresses and the stream address name the new ports. One move per stub. `networkSettled()` resolves when the new ports listen and rejects with `FakeOnvifPortBusyError` when one was taken (the stub then listens nowhere). `networkState().location` says `MOVED` |
| `network.onApply: 'NOT_APPLIED'` | every call is answered as accepted (`RebootNeeded` as configured, the reboot counted); address, prefix, DHCP flag, gateway and ports stay; `networkState().changesNotApplied` counts the dropped changes |
| mode `MARKUP_TEXT` | `<tt:Name>` of GetNetworkInterfaces and `<tds:Message>` of SystemReboot hold `FAKE_ONVIF_MARKUP_TEXT` (angle brackets, ampersand, quotes, `${`, `{{`), escaped; the reply is well-formed; the interface token and the hardware address are untouched. The hostile-text case of AD-06 for the fields a job could copy into a log or a notice |

"The new loopback address/port" is another PORT of 127.0.0.1, not another address: a bind of 127.0.0.2 fails on this host without a root-added alias (measured earlier, stated at `FAKE_ONVIF_TESTABLE_DEVICES_MAX` in the stub). A test of row 111 maps the camera's new address to `127.0.0.1:<movedPorts>` in its destination seam.

## Evidence

| Check | Command | Result |
|---|---|---|
| Stub tests and the unit suites that use the stub, 1 run | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` around `npx vitest run --project unit --maxWorkers=2` with `test/support/fake-onvif-stub.test.ts`, `test/support/lane-camera-stub.test.ts`, and under `src/capture/adapters/camera/__tests__/`: `onvif-network`, `onvif-session`, `loopback-guard`, `ws-discovery`, `probe-answer`, `discovery-recording` (sandbox off: loopback binding) | `Test Files 1 failed | 7 passed (8)`, `Tests 1 failed | 187 passed (188)` |
| Database suites that use the stub, 1 run | `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock /usr/bin/lockf -k -t 900 .locks/heavy-host.lock` around `npx vitest run --project db --maxWorkers=2 src/modules/capture-discovery/connect/__tests__/connect.db.test.ts src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` (sandbox off) | `Test Files 2 passed (2)`, `Tests 40 passed (40)`; `dropped 2 database(s)`, `0 remain with the run prefix` |
| Typecheck | `npx tsc --noEmit` in `apps/core-server` | exit 2; 3 errors, all in `packages/shared/src/api/capture-discovery.ts:1444` and `packages/shared/src/api/core-api.ts:1135,1141`; 0 lines naming the stub's two files |

Reading of the results:

- The stub's file passed with all its cases, the 6 new ones included, in the first run; no second run was made. The launcher's file passed: the stub is still refused in production by name (the row's verification cell).
- The 1 failure is `src/capture/adapters/camera/__tests__/onvif-session.test.ts:1082`: `expect(facade.read).toHaveLength(2)` received 3. The uncommitted diff of `camera/onvif-session.ts` adds a third parameter `sourceAddress?` to `read` (row 143b, in flight, owner of that file and of its test). Not edited by this row and not caused by the stub.
- The typecheck errors are in `packages/shared` (the shared-contract writer of this wave). Not edited by this row.
- NOT RUN: `test/acceptance/contract.test.ts` (it imports the stub; rows 196 / 197 are editing it in this wave). Lint: `npx eslint` found no configuration from the workspace or the root in this shell; not run.

## What stays unproven

- A real camera's behaviour between the reboot answer and its first answer at the new address (how long, whether the old address answers for a while), and a camera that accepts and silently keeps its address: hardware package, `9A/H-nn`, experiment E-14.
- The move is a change of port on one address. That the product's wait finds the same MAC at another ADDRESS is shown only through the test's destination seam.

## For rows 107, 110, 111

1. `stub.httpRequests()`: `[]` is "0 requests sent"; `.filter((r) => r.authorizationScheme === 'Basic' || r.wsSecurity === 'CLEAR')` empty is "the password never left in clear".
2. `createFakeOnvifStub({ ports, credential, network: { onApply: 'MOVE', movedPorts: await freeFakeOnvifPorts(), gatewayReadBack: true } })`, then `await stub.networkSettled()` and `stub.addresses()` for the new place.
3. `network: { onApply: 'NOT_APPLIED' }` for the camera that never appears at the new address; `stub.networkState()` gives `location`, `changesNotApplied`, `hwAddress`.

## DRIVER DECISIONS of the second pass (for the controller to confirm)

1. The row was found done; this pass built only the difference to the wave-10 brief and left the first pass as committed.
2. The additions are in the stub's own file, not in a sibling: the file is unclaimed in this wave and the request record needs the HTTP handler.
3. The move changes PORTS on 127.0.0.1 (no second loopback address can be bound here) and moves all three listeners, the RTSP one included.
4. Only a changed address moves the camera; a DHCP-only change does not. A stub moves once.
5. `NOT_APPLIED` keeps the gateway too.
6. The SOAP action is recorded only when it is a plain URI (else `?`); the path is recorded without its query string.
7. `MARKUP_TEXT` is a new mode beside `MARKUP_TOKEN`, so that row 110's tests of the token case are unchanged.

## Requests

None.
