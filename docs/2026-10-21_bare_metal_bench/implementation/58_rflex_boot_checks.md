---
row: 106 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete
---

# Row 106: fence binder doc comments C1/C2 for the global destination rule

## What changed (comment-only)
| File | Change |
|---|---|
| apps/core-server/src/capture/fence/production-parts.ts:76-85 (C1, `storedCameraAddressRuleOf`) | Doc comment: STORED_CAMERA is global (row 102); source interface from `interfaceSubnets`, on-link, longest prefix; `NO_SOURCE_INTERFACE` (NW-R1) / `SOURCE_INTERFACE_AMBIGUOUS` (NW-R2); unreadable facts -> `HOST_NOT_CONFIGURED` (no `interfaceSubnets`) -> `NOT_CONFIGURED` (RF-N7, O-5) |
| production-parts.ts:104-114 (C2, `typedProbeRuleOf`) | "held to the configured camera subnet" removed; TYPED_PROBE global, never an alias address; NW-R1/NW-R2; scan and set-IP stay bound (D16 Q96-04 a); unreadable -> `NOT_CONFIGURED` (RF-N7) |

No code line changed: `HOST_NOT_CONFIGURED` (:74), the fallbacks (:97, :122), scan/set-IP binders and `admitted` are untouched. No B6 derivation (O-6). Comments avoid the static-pin patterns (`DestinationPurpose.STORED_CAMERA`, call forms) so the SR-8 binder count stays 1.

## Diff evidence
`diff -u <snapshot before edit> production-parts.ts`: two hunks (@@ -75,7 +75,13 @@, @@ -97,10 +103,14 @@); filter of changed lines not starting with ` *` -> `NONE`.

## Tests (run-only files, unmodified)
| Command | Result |
|---|---|
| `npm test -w @dems/core-server -- src/capture/boot/__tests__/checks.test.ts src/capture/boot/__tests__/boot.test.ts src/capture/host-alias/__tests__/caller.test.ts src/capture/host-alias/__tests__/lifecycle.test.ts src/__tests__/host-alias-socket.test.ts --maxWorkers=2` (sandboxed) | `Test Files 1 failed \| 4 passed (5)`, `Tests 14 failed \| 263 passed (277)`; all 14 failures in host-alias-socket.test.ts with `listen EPERM: operation not permitted /tmp/claude-501/na-*/socket` (sandbox blocks Unix-socket listen; environmental) |
| `npm test -w @dems/core-server -- src/__tests__/host-alias-socket.test.ts --maxWorkers=2` (outside sandbox) | `Test Files 1 passed (1)`, `Tests 19 passed (19)` |
| `/usr/bin/lockf -k .data/locks/db-runner.lock npm run test:db -w @dems/core-server -- src/capture/host-alias/__tests__/lifecycle.db.test.ts --maxWorkers=2` | `Test Files 1 passed (1)`, `Tests 11 passed (11)`; teardown 0 remain |

Net: boot (checks, boot), host-alias (caller, lifecycle, lifecycle.db) and host-alias-socket all green, 258 + 19 + 11 tests. HOST-46 case lives in boot/checks.test.ts (passed, unchanged; AC-7). No red caused by row 102's NOT_CONFIGURED change.

## Deviations
None. Typecheck not run (comment-only change, cannot affect types).
