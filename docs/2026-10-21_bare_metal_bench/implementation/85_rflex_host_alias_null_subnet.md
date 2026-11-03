# Row 141 - host-alias facts reader: null camera subnet is "facts unknown" (D23)

Status: complete. Tier 3.

## Change
- apps/core-server/src/capture/host-alias/facts.ts:65-68 - after the existing null/non-object check, `hostAliasFactsReaderOf` now throws `HostAliasFactsUnknownError` when an interface is stored and `network().cameraSubnet` is null/undefined. Restores the pre-row-105 behaviour (row 105 D-105-2 changed `networkFactsOf` to return a context with `cameraSubnet: null` instead of null). The no-stored-interface path is unchanged (returns `storedInterface: null`, caller refuses NETWORK_NOT_CONFIGURED).
- apps/core-server/src/capture/host-alias/__tests__/lifecycle.test.ts:23 (import `HostAliasFactsUnknownError`), :1009-1016 new case "a stored interface whose network facts carry NO camera subnet ..." - stored 'eth1' + cameraSubnet null -> rejects HostAliasFactsUnknownError; no stored interface + cameraSubnet null -> resolves storedInterface null.

## Verification
| Check | Command | Result |
|---|---|---|
| Mutation (before fix) | `npm test -w @dems/core-server -- src/capture/host-alias/__tests__/lifecycle.test.ts -t "NO camera subnet" --maxWorkers=2` | 1 failed / 99 skipped: `AssertionError: promise resolved "{ storedInterface: 'eth1', …(5) }" instead of rejecting` |
| Unit (after fix) | `npm test -w @dems/core-server -- src/capture/host-alias/__tests__/lifecycle.test.ts src/capture/host-alias/__tests__/caller.test.ts --maxWorkers=2` | Test Files 2 passed (2), Tests 122 passed (122) |
| DB (db-runner lock, outside sandbox) | `lockf -k .data/locks/db-runner.lock npm run test:db -w @dems/core-server -- src/capture/host-alias/__tests__/lifecycle.db.test.ts --maxWorkers=2` | Test Files 1 passed (1), Tests 11 passed (11) |
| Typecheck (heavy-host lock) | `npm run typecheck -w @dems/core-server` | exit 0, 0 `error TS` lines (no audio-cards errors at run time either) |

Note: the facts test lives in lifecycle.test.ts (no separate facts test file exists); extended there, no new file.
