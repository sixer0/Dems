---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 110
milestone: M10 / WP-22a
date: 2026-10-13
agent: coder-execution (batch 8, agent SC)
tier: T3
requirement: S2-5 of the specification; SR-3 (G-R10 / G-R11 amended), AM-4, AM-7; decisions C1, C7; S13-04 (the file's half), S13-11 (set-IP paragraph, the file's half), S13-12 (a) to (c)
status: complete - built and proven against the fake ONVIF stub on loopback; called by nothing (row 111 is the job)
---

# Row 110: the set-network file

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`.

## 1. Statement

`createOnvifNetworkSetter({ timers, destination }).setAddress(candidate, assignment, credential, signal)` writes ONE static IPv4 address into ONE camera with the four ONVIF calls: it reads the interfaces, sets the first interface to the address and prefix of the assignment, sets the default gateway when the assignment names one, and reboots when the device says the change needs it. It resolves with codes, whatever the device does.

It is the second importer of the ONVIF package that SR-3 admits, and it is called by nothing: the job that uses it is row 111. No real camera was contacted.

## 2. Change set

| File | State | What |
|---|---|---|
| `CS/capture/adapters/camera/onvif-network.ts` | new | the facade `setAddress`; its vocabulary (`OnvifNetworkOutcome`, `OnvifNetworkReason`, `OnvifGatewayState`, `OnvifRebootState`, `ONVIF_NETWORK_CALLS`, `ONVIF_NETWORK_LIMITS`) |
| `CS/capture/adapters/camera/onvif-cam.d.ts` | modified, additive | the four calls declared beside the five reads; `StaticInterfaceSet` declares the one form of a set, with `DHCP: false` as a literal type |
| `CS/capture/__tests__/static.test.ts` | modified, additive | SR-3: the pinned name `ONVIF_NETWORK`; G-R2 (the file's one HTTP agent import, pinned by exact string); G-R10 / G-R11 (two importers, the four calls as an exact list, nine declared members, the constructor rule, the exact export and import lists, the destination pins, a planted control). SR-4: one case asked by row 67 (section 6) |
| `CS/capture/adapters/camera/__tests__/onvif-network.test.ts` | new | 14 cases, the real package against the stub |
| `apps/core-server/test/support/loopback-destination.ts` | new | the permissive destination rule of a test, loopback only, defined under `test/` (AD-02 (2)) |

Not touched: `onvif-session.ts` (its call list stays the five reads, its exports and agent imports as they were), `destination-rule.ts`, `credential.ts`, the stub.

## 3. The contract, as built

**Before any request**, in this order: an aborted signal and a candidate that may not be contacted reject (`CAPTURE_ADAPTER_ABORTED`, `CAPTURE_LOCATOR_INVALID`); an `https:` service address, an assignment outside the rule's form and a destination the rule refuses resolve as `NOT_SET` with their reason and 0 requests.

**The destination.** `options.destination(host, port)` is the caller's binding of `decideDestination`. The client is built with the address and port the rule RETURNED; every connection of the call is forced to them and bound to the source address the rule named. The package moves its own target to the new address after a successful set: the file puts it back in the same callback, and a connection that would go elsewhere is not made (the call ends `FAULT`).

**The calls.**

| # | Call | A failure is |
|---|---|---|
| 1 | `GetNetworkInterfaces`: the first interface, its token and hardware address | `NO_ANSWER`, `CREDENTIAL_REFUSED`, `SCHEME_NOT_ALLOWED`, `INTERFACES_ANSWER_INVALID`, `NO_INTERFACE`; a token outside `A-Z a-z 0-9 _ . : -` (1 to 64): `INTERFACE_TOKEN_REFUSED`, no set request |
| 2 | `SetNetworkInterfaces`: enabled, IPv4, manual address and prefix, `DHCP: false` | a fault or a refused credential: `NOT_SET` (`SET_REFUSED`, `CREDENTIAL_REFUSED`); no answer or one that cannot be read: **`UNKNOWN`** (`NO_ANSWER`, `SET_ANSWER_INVALID`, `BYTE_CAP`, `DEADLINE`) and nothing more is sent |
| 3 | `SetNetworkDefaultGateway`, only with a gateway | a warning: `gateway: NOT_CONFIRMED`; the address stands |
| 4 | `SystemReboot`, only when the device said `RebootNeeded` | `reboot: SENT_NO_ANSWER` (a camera that goes down at once) or `REFUSED`; the address stands |

**The result** holds the outcome (`SET`, `NOT_SET`, `UNKNOWN`), a reason of the closed list, the destination rule's code when it refused, the hardware address the device reported before the set (six upper-case pairs, or null), `rebootNeeded`, the gateway and reboot states, the calls made, and two counts of requests that carried the credential. No device text, no address, no credential member.

**The credential** is the fourth parameter, a `SealedCredential`. The file imports `usingCredential` and the type from `../credential` and nothing of the reader or the reveal module. Digest only (HTTP Digest with MD5 or SHA-256, or the WS-Security token); a refusal is final: at most one rejected request per call. The two values are taken off the client when the call ends.

**The guards** are those of the connection file, written again here because that file exports its facade only: one agent per call without keep-alive, watched sockets, 1,048,576 received bytes, 3,000 ms to connect, 5,000 ms idle per request, the caller's signal as the deadline, every callback of the package taken once.

## 4. Checks (this Mac, 2026-10-13; loopback only; sandbox off and the heavy-host lock for the stub's ports)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit and static, one run | `/usr/bin/lockf -k -t 1800 ../../.locks/heavy-host.lock npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/onvif-network.test.ts src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts` | `Test Files 3 passed (3)`, `Tests 92 passed (92)`, 2.25 s |
| The workspace's static rules, once | `npx vitest run --project unit --maxWorkers=2 test/static` | `Test Files 1 failed | 15 passed (16)`, `Tests 1 failed | 179 passed (180)`; the red is `test/static/search-path.test.ts:94`, the list lacks `src/db/migrations/0018_network_commissioning_privileges.sql` (agent D, rows 99 + 192); not edited |
| The static list again, after row 67's case | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/static.test.ts` | `Tests 58 passed (58)` |
| Typecheck | `npx tsc --noEmit -p .` | exit 0 |
| Lint | `npx oxlint <the touched files>` | exit 0, no finding |

The row's verification cell:

| Cell | Evidence (`onvif-network.test.ts`) |
|---|---|
| malformed, oversized and markup-token replies: the Core stays up and the request is well-formed | "a malformed reply to each call": four stubs, one malformed call each, 0 uncaught exceptions, every request the stub recorded `wellFormed`; before the set nothing is written (`INTERFACES_ANSWER_INVALID`), a malformed answer to the set is `UNKNOWN` while the stub's state shows the change pending, the gateway and the reboot leave `SET`. "an oversized reply": `BYTE_CAP`, `NOT_SET` before the set and `UNKNOWN` after it. "an interface token with markup characters": `INTERFACE_TOKEN_REFUSED`, 0 set requests, 0 records with `NOT_WELL_FORMED`, the stub's address unchanged |
| importers of the reader in this file: 0 | static case "the set-network file ...": the import list is exact (eight sources), the credential import is the opaque type and `usingCredential` only, no word of the reader, the holders or a reveal |
| the rule lists G-R10, G-R11 pass in their amended state | `static.test.ts` green: importers exactly the declaration, the set-network file and the connection file; the connection file's calls exactly the five reads, this file's exactly the four; the declaration exactly nine; the planted control finds a third importer, a read and a clock set in this file, a listener and a certificate check switched off |

Beyond the cell: the healthy run (five operations at the stub in order, all accepted, the stub's state holds the new address, prefix, gateway and one reboot); a wrong secret (1 request carrying it, 1 rejected, 0 network requests passed, nothing changed); the product's `decideDestination` refuses the loopback stub with `LOOPBACK` and 0 requests; a candidate at a documentation address whose rule answers the stub reaches the stub - what is dialled is the rule's answer.

## 5. The double, and what stays unproven

The double is `apps/core-server/test/support/fake-onvif-stub.ts` with `network`, on 127.0.0.1 and ephemeral ports, driven by the real `onvif` package 0.8.3. The addresses written are RFC 5737 documentation addresses and exist only in the stub's state.

| Unproven | Check |
|---|---|
| A real camera's answers to the four calls, its faults, whether it asks for a reboot, how it treats the gateway | `9A/H-14` (experiment E-14, hypothesis H-T) |
| The WS-Security token form without a clock read first: this file makes four calls and no time read, so a camera that takes only the token form and whose clock is far off may refuse the credential | `9A/H-14`; a decision for row 111 (it polls the time read first, S13-04 (a)) |
| The numeric interface token: the package turns an all-digit token into a number, which this file refuses as not of the token form | `9A/H-14` |
| The connection really leaving from the camera interface's address (`localAddress`) on a host with several interfaces | `9A/H-13`, `9A/H-14` |
| TLS: not spoken by this file | - |

## 6. Static requests served, and requests filed

- **Row 67 (G-R12 by SR-4), SERVED**: one new case in the G-R12 block, "SR-4 at the production microphone adapter": each table function called once with the named members only; the door called at three places with the three stated argument forms; `guardedArguments` is the helper path followed by the list unchanged; a planted control. Additive.
- Row 67's SR-1 line and row 71's offer: no entry was asked or needed; none made.
- No request filed by this row.

## 7. DRIVER DECISIONS for the controller to confirm

1. **Five requests on the wire for four calls.** The package's `setNetworkDefaultGateway` reads the gateway back by itself when given a callback; without one it reports neither its end nor its failure. The callback form is used and the read-back's answer is what `CONFIRMED` means. A stub built without `gatewayReadBack` names the fifth request as a violation (shown in a test); row 111's tests need `network: { gatewayReadBack: true }`.
2. **`http:` only.** An `https:` service address is refused before any request, so the certificate exception of SR-3 is NOT widened and one agent import is pinned, not two.
3. **An interface token outside the token form is refused, not escaped** (S13-12 (b): "held to a character rule"). The reference escaped it.
4. **The first interface is the one that is set**, as in the reference; no second interface is tried.
5. **`UNKNOWN` is an outcome of its own**: a set that was sent and not answered validly may have happened (the stub obeys it). Row 111's wait by MAC decides.
6. **The destination rule is a function handed in**, and the file uses the address it returns; the binding to the purpose `SET_IP` and to the host's facts is row 111's. The file also forces every connection to that address and binds the source the rule named.
7. **The assignment is the rule's own type** (`NewCameraAddress` of `decideNewCameraAddress`) and is held once more to the dotted-quad form and the prefix bounds 16 to 30 of the rule before it reaches a request.
8. **The guards of the connection file are written again in this file** (about 150 lines of the same shape): that file exports its facade only, its export list is pinned, and it was another agent's in this batch.
9. **A new file under `test/support`**, `loopback-destination.ts`, outside the row's Ownership Area line: AD-02 (2) requires the permissive value to be defined there.
10. **The heavy-host lock was taken for the one run that bound the stub's ports** (2.25 s).

The Edit-only rule was kept: the two existing files were changed with the Edit tool after reading them; the three new files were written with Write. Nothing was committed, staged or stashed.

---
*Generated: 2026-10-13*
