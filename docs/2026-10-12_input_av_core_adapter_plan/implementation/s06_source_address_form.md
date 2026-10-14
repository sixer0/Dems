---
row: S06 (wave 12, track D)
agent: S06 (coder-execution)
date: 2026-10-14
source: verification/086_pre_lift_security.md caution C-10 (:85) / finding S-06 (:144); decisions C127, C135 (3)
status: complete (one request line open to N4 - the static pin of the import list)
tier: 3
---

# S06 - the source of an ONVIF set call held to the source-address form

## What was wrong
`apps/core-server/src/capture/adapters/camera/onvif-network.ts` held the destination's `sourceAddress` (the address every
connection of a set call is made FROM) to `DOTTED_QUAD` only (old :345). `0.0.0.0`, multicast (`224.0.0.0/4`) and
`255.255.255.255` passed. Commissioning path only (operation 106/107); not the recording path; U24 keeps set calls off real cameras.

## Change (product)
| File | Change |
|---|---|
| `apps/core-server/src/capture/adapters/camera/onvif-network.ts` | + `import { isSourceAddress } from './stored-address';` (:69, read-only use; stored-address.ts NOT edited). + `LINK_LOCAL_SOURCE` and `sourceAdmitted(source) = isSourceAddress(source) && !LINK_LOCAL_SOURCE.test(source)` with its comment (:211-220). The source check at :356 now reads `!sourceAdmitted(destination.sourceAddress)`. Refusal unchanged: `DESTINATION_REFUSED`, `destinationRefusal: null`, before any request. |

`DOTTED_QUAD` stays for the DESTINATION address (:356) and for the assignment's address and gateway (`assignmentValid`,
:297/:301): those are not sources, and the brief's two places (:209 the constant, :345 its source use) are both covered by
moving the source use off it. The export `isSourceAddress` was unchanged at the time of reading (`stored-address.ts:132`).

## DRIVER DECISION (for the controller to confirm)
The brief asks a link-local source to be refused; `isSourceAddress` (the relay's `source_ok` form: first number 1-223)
ADMITS `169.254.0.0/16`. So the set-network file adds a local link-local refusal on top of `isSourceAddress`. Loopback is NOT
refused here: the file's tests reach the stub from `127.0.0.1` (the double), and the product rule never names one anyway
(its sources must be private, `destination-rule.ts:294-298`). Observation, not a request: `isSourceAddress` itself admits
link-local and loopback for the session, stream-probe and relay-start dials too; the product rule's private-only sources make
that unreachable today. Changing `isSourceAddress` would diverge from `relay_core.c` `source_ok` - left to the controller.

## The other camera files that take a source address for a dial (grep `sourceAddress` under `capture/adapters/camera/`, stored-address.ts excluded)
| File:line | How the source is held | Dotted form only? |
|---|---|---|
| `onvif-session.ts:533` (`exchange`, used by `test`, `locate`, `read`) | `isSourceAddress` before any request | no |
| `stream-probe.ts:584` (`boundTo`); `:435` hands it to relay-start | `isSourceAddress` | no |
| `relay-start.ts:72, :97` | `isSourceAddress` | no |
| `camera-watch.ts:453`, `onvif-relay.ts:687, :707` | from `storedCameraSourceOf` (`stored-address.ts:152`, `isSourceAddress`) | no |
| `ws-discovery.ts:191` | must EQUAL an address of a probed interface of this host (stronger than a form) | no |

No other place is held only to the dotted form: nothing else to fix, no request for V7b's files.

## Tests (`apps/core-server/src/capture/adapters/camera/__tests__/onvif-network.test.ts`, ONE appended block "row S06 / C-10")
- `it.each` over `0.0.0.0`, `224.0.0.1`, `239.255.255.250`, `255.255.255.255`, `169.254.10.20`: result equals
  `NOT_SET / DESTINATION_REFUSED / destinationRefusal null / calls []`, **0 sockets** (every call of the agent's real
  `createConnection` is counted by wrapping it on `HttpAgent.prototype`, put back in `finally`), 0 requests at the stub,
  stub state unchanged.
- Admitted: `192.168.50.1` (the camera-interface address of the file's product context) is not refused and every socket is made
  from it; CONTROL: `127.0.0.1` (the double's) sets the address (`SET`, `ACCEPTED`), every socket from it.
- Double: the fake ONVIF stub (`test/support/fake-onvif-stub.ts`) on 127.0.0.1, ephemeral ports. No real camera, nothing sent
  to one. Unproven here: a real camera interface's source bind on Linux (hardware package, 9A/H).

## Mutations (each run, then restored with the Edit tool; restore verified by grep)
| Mutant | Result |
|---|---|
| A: `!DOTTED_QUAD.test(destination.sourceAddress)` back at :356 | RED 5/5 refusal cases (`Tests 5 failed / 1 passed`) |
| B: `!isSourceAddress(...)` without the link-local clause | RED 1 (the `169.254.10.20` case; `Tests 1 failed / 5 passed`) |

## Checks
| Check | Result line |
|---|---|
| `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/onvif-network.test.ts` | `Test Files 1 passed (1)  Tests 33 passed (33)` |
| `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/ src/capture/__tests__/static.test.ts` | `Test Files 1 failed / 12 passed (13)  Tests 1 failed / 412 passed (413)` - the one red is `static.test.ts:662`, the exact pinned import list of the set-network file (N4's file this wave): request line filed |
| `npx tsc --noEmit` (apps/core-server) | exit 2, 9 errors, NONE in S06's files: `src/capture/adapters/mic-transport.ts` (2, `PCM_FIFO_GAPPED`), `src/capture/__tests__/forwarder-engine.test.ts` (2), `fault-lifecycle.test.ts` (1), `forwarder-advisories.test.ts` (1), `src/capture/fence/__tests__/development-session.db.test.ts` (2), `test/support/capture.ts` (1) - the level-report fields / gapped kind of the capture-protocol row in flight |
| `npx oxlint` on the two touched files | exit 0 |

## Request left
`delegation_progress/file_requests.md`, row S06 -> N4: append `"from './stored-address'"` to the pinned import list at
`src/capture/__tests__/static.test.ts:662` with a NAMED ENTRY comment (stored-address.ts imports only a type of `../types`;
the entry opens no door). Blocking for the static rule set only.

## Notes
- Wave-12 brief row 9 reserves `capture/adapters/camera/*` for row 88; decision C135 (3) gives `onvif-network.ts` to S06.
- Edit tool only on existing files; nothing left running; no `.data/` file read; nothing committed or staged.
