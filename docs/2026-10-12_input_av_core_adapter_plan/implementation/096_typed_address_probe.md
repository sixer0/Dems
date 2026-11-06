---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 96
milestone: M8 / WP-12
date: 2026-10-13
agent: coder-execution (batch 8, agent SC)
tier: T3
requirement: AM-3 (amends D80(10) for the search); SR-2 (G-R9 amended); S13-11 points 1, 2 and 4 for the typed probe; C10 (web console only); the contract of row 94; fix pass I-5 (the deferral `LANDED_UNANSWERED`)
status: needs-review - the probe, the route and the search are built and proven on loopback doubles; on a production Core every typed address is refused until the composition hands the destination rule its host facts (one request, blocking for the live probe)
---

# Row 96: the live typed-address probe

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`.

## 1. Statement

Operation 93 reads the optional `address`. The address is held to the destination rule BEFORE anything is built; the rule's ANSWER, never the typed text, goes to the search; the search that is started sends ONE more datagram from the one datagram socket of the Core: one WS-Discovery probe of the camera type, with a message ID of its own, to that address on port 3702, once, with TTL 1. The candidate is built from the probe answer by the collector that builds every candidate (AM-3: probe-answer data only; no follow-up read, no sweep, no ping).

The named deferral `LANDED_UNANSWERED` of the acceptance file is REMOVED: the list is empty and the coverage block passes with two real requests that produce operation 93's 422.

**What is not live.** The destination rule needs the host's facts (the camera interface, its subnet, the host's addresses) and lies inside the closed capture unit; the module holds no rule of its own. Nothing in the tree reads those facts yet. So `typedAddressControl(app).decide` refuses every address on a Core that was handed no rule: 422 `DISCOVERY_ADDRESS_NOT_ALLOWED`, 0 packets. The one call that makes the path live is in section 6.

## 2. Change set

| File | State | What |
|---|---|---|
| `CS/capture/adapters/camera/ws-discovery.ts` | modified | `WsDiscoverySearch.unicast?: AllowedDestination`; the one send call now stands in `transmit`, with two callers (the round, the typed probe); `sendTyped` after the first round; `setTTL(1)` for a typed search; the count `typedProbesSent`, present only in a typed search; a host that does not hold the source the rule named: "could not run", nothing sent |
| `CS/capture/adapters/camera/onvif-discovery.ts` | modified | the parameter type of `discover` |
| `CS/modules/capture-discovery/search.ts` | modified, additive | `SearchRequest.typed`; the typed spacing per Core; `unicast` handed to the adapter as it came; types `TypedDestination`, `TypedAddressDecision` |
| `CS/modules/capture-discovery/routes.ts` | modified | the optional body of operation 93; the order schema -> web console only -> rule; `addressNotAllowed()` |
| `CS/modules/capture-discovery/typed-address.ts` | new | the rule holder: `provideRule` (once), `decide`; no rule of its own |
| `CS/capture/__tests__/static.test.ts` | modified | SR-2: the send pin follows `transmit`; one new case with a planted control |
| `CS/capture/adapters/camera/__tests__/ws-discovery.test.ts` | modified, additive | 5 cases |
| `CS/modules/capture-discovery/__tests__/search.test.ts` | modified, additive | 7 cases; the rig's adapter double records what it was handed |
| `apps/core-server/test/acceptance/contract.test.ts` | modified | two requests in the camera-search area; `LANDED_UNANSWERED = {}`; the pinned literal `[]` |

Not touched: `modules/capture-discovery/index.ts` (another agent's uncommitted lines stand in it; the routes reach the rule holder by the app), `discovery-collector.ts` (it takes the typed probe's message ID through the list it always took), `adapters/types.ts`, `adapters/index.ts`, `connect/`, `packages/shared`.

## 3. The contract, as built

**The order at the route**, before the search is asked for:

| # | Case | Answer |
|---|---|---|
| 1 | the body does not match its schema | 422 `INVALID_INPUT` (stage 7) |
| 2 | `address` from a session bound to a tablet or phone | 403 `NOT_PERMITTED`, `WEB_CONSOLE_ONLY`, the guard's own row (`requireWebConsoleSession`) |
| 3 | the rule refuses, throws, answers nonsense, or was never handed in | 422 `INVALID_INPUT`, details exactly `{ in: body, reason: DISCOVERY_ADDRESS_NOT_ALLOWED }`: one sentence, never the address, never the rule's code |
| 4 | the rule admits | `typed` = the rule's answer; then the refusals of the search in their order |

**At the search.** A typed address is probed only by a search this call started: while the caller's own search runs the answer is that search (`200`, `created: false`) and the typed address reaches no adapter. A typed probe sooner than 10,000 ms after the last one of ANY session is refused `DISCOVERY_RATE_LIMITED` with the wait, before anything is sent. The pre-check's search never carries one. The audit row and the log line hold counts only.

**At the socket.** One socket, one send call. The typed target is `fixture ?? { address: unicast.address, port: 3702 }`: under the loopback fixture of a test the datagram goes to the fixture's target, so no test can reach the address the rule answered. The host must hold the rule's `sourceAddress` on an interface the search probes; else `NO_ELIGIBLE_INTERFACE` and nothing is sent. A search without `unicast` sends what it always sent.

## 4. Checks (this Mac, 2026-10-13; loopback only; sandbox off; the heavy-host lock per run, with `.locks/db-migrate.lock` for the two database files)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Static after the code, before the amendment | `npx vitest run --project unit --maxWorkers=2 <the capture, module and adapter static files, test/static/imports.test.ts>` | `1 failed | 107 passed (108)`: the send pin of G-R9, as expected (SR-2 changes it) |
| Static list, runs 2 and 3 | `... src/capture/__tests__/static.test.ts` | run 2 `1 failed | 58 passed (59)`: a red in this row's own new case (an over-wide pattern); run 3 `Tests 59 passed (59)`. A third run because the failure was in the row's own new test |
| Search runner, run 1 | `... src/modules/capture-discovery/__tests__/search.test.ts src/modules/capture-discovery/__tests__/static.test.ts` | `1 failed | 37 passed (38)`: this row's own case expected the typed spacing where the limiter refuses first; the case was corrected |
| Unit, the whole set, one run | `/usr/bin/lockf -k -t 1800 ../../.locks/heavy-host.lock npx vitest run --project unit --maxWorkers=2 <ws-discovery, discovery-recording, discovery-collector, loopback-guard, search, the three static files, test/static>` | `Test Files 24 passed (24)`, `Tests 358 passed (358)`, 13.65 s |
| The acceptance file | `(ulimit -c 0; lockf heavy-host; lockf db-migrate; npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts)` | `Test Files 1 passed (1)`, `Tests 39 passed (39)`, 19.92 s; `0 remain` |
| Operation 93 through the stages, UNEDITED file | `... --project db ... src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` | `Tests 16 passed (16)`, 43.51 s; `0 remain` |
| Typecheck / lint | `npx tsc --noEmit -p .` / `npx oxlint <the touched files>` | exit 0 / exit 0 |

The row's verification cell:

| Cell | Evidence |
|---|---|
| against the fake ONVIF device a typed address yields 1 candidate from the probe answer alone | `ws-discovery.test.ts` "a typed address yields 1 candidate ...": a loopback device that answers ONLY the typed probe's message ID is listed (1 candidate, `typedProbesSent` 1, 5 datagrams at the device, 1 of them the typed probe of the camera type); the same search without the typed address finds nothing with 4 datagrams. "on the fake ONVIF stub": 1 candidate, 5 probes in the stub's log, 0 device requests, 0 violations. The destination in both is the answer of the product's `decideDestination` for `192.168.50.20` on a synthetic camera subnet; no datagram held that text and none went anywhere but 127.0.0.1 (the loopback guard: refused 0) |
| a refused address sends 0 packets | acceptance file: `{ address: '127.0.0.1' }` answers 422 `DISCOVERY_ADDRESS_NOT_ALLOWED`, the guard saw 0 datagrams, 0 searches were started, operation 94 reads no search, and the search after it starts with 202. Adapter: a host that does not hold the rule's source address: `NO_ELIGIBLE_INTERFACE`, 0 datagrams, 0 sockets. Rule: nine refused texts make no answer, so there is nothing to probe with. Runner: a refused spacing and a second request while the own search runs leave the adapter uncalled |
| the search without a typed address shows 0 changed results | the 16 cases of `capture-discovery.db.test.ts` and the existing cases of `ws-discovery.test.ts`, `discovery-recording.test.ts` and `search.test.ts` pass UNEDITED (one rig line of `search.test.ts` gained two recorded members); the adapter is asked with the two members it always was; the result has no `typedProbesSent` key; start answer, stored list and audit row are equal with and without the member on a scripted adapter |

BINDING, the deferral: `LANDED_UNANSWERED` is `{}`, its pinned literal is `[]`, and the coverage block of the acceptance file passes; the two 422 are produced by `expectCall` on the booted Core.

## 5. Doubles, and what stays unproven

Doubles: the fake ONVIF stub's discovery listener and a datagram responder of the test file, both on 127.0.0.1 behind the loopback guard, reached through the adapter's loopback fixture (the injection the existing discovery tests use). The rule in the adapter tests is the product's own function on synthetic host facts; in the runner tests a literal stands for its answer.

| Unproven | Check |
|---|---|
| A unicast probe on a real segment: that a camera answers a unicast Probe at all, that the datagram leaves from the camera interface when the host has several (the socket is then not bound to one address and the kernel's connected route decides), the firewall rule for the answer | `9A/H-12` |
| The product path `fixture === null` beyond the refusal: on this Mac the guard refuses every non-loopback datagram, so the typed datagram to a rule-admitted address was never handed to the operating system | `9A/H-12` |
| `403 WEB_CONSOLE_ONLY` for a paired session that sends `address` (pinned statically; not requested) | a test row with a paired session holding CAPTURE_CONFIG |
| The live rule on a production Core | the wiring of section 6 |

## 6. Requests filed (`delegation_progress/file_requests.md`)

1. **Blocking for the live probe**: the composition hands the rule in - `typedAddressControl(app).provideRule((address) => decideDestination({ purpose: TYPED_PROBE, address }, <host facts>))` from inside the capture unit - and the module's index exports `typedAddressControl`.
2. The 403 of a paired session: a test with such a caller.
3. Answers to the capture-static lines: row 67 served; rows 71 and 81 (offers) not served, not SR-1 to SR-4; row 81's pin waits for its wiring; row 68's entry belongs to the static-adapters list, not this writer's.

## 7. DRIVER DECISIONS for the controller to confirm

1. **The module holds no rule and refuses everything until one is handed in.** A default built on guessed host facts would be a permissive value under `src/`.
2. **One datagram for the typed address**: one probe of `dn:NetworkVideoTransmitter`, once, not repeated. The contract says "one unicast probe".
3. **The typed address is not probed while the caller's own search runs** (the contract's sentence), and such a request takes no place in the typed spacing.
4. **The typed spacing is per Core, 10,000 ms, and reported under the bound word `CORE_SPACING`**: the limiter's enumeration was not widened. The rule file's own `spacingAllowance` is not importable from a module; the same constant is used.
5. **The probe goes to the group's port 3702**; the port of the rule's answer (80, the device service) is not used by the search.
6. **A host that does not hold the rule's source address fails the WHOLE search** as "could not run"; the multicast rounds are not sent either.
7. **With several probed interfaces the socket stays unbound to an address**, as before; the rule has already refused every address inside another interface's subnet. A second, bound socket would break "one socket".
8. **`TTL 1` is set for unicast too**, only in a typed search.
9. **Every refusal of the rule is one answer**, whatever its code; the code stays inside the Core and is not logged.
10. **The route order**: schema, then web console only, then the rule, then the search's own refusals - so a refused address answers 422 also on a Core with no discovery adapter.
11. **`index.ts` of the module was not edited**; the rule holder is reached by the app from `routes.ts`.
12. **The existing send pin of G-R9 was CHANGED, not only added to** (`open.send(probe, to.port, to.address, sent);` in `transmit`): SR-2 amends the destination clause, and one send call site is kept.
13. **Three runs of the static list and two of the search file**, each after a red in this row's own new test.

The Edit-only rule was kept: every existing file was changed with the Edit tool after reading it; the new file was written with Write. Nothing was committed, staged or stashed.

---
*Generated: 2026-10-13*
