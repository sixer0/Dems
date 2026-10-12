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
