# Row CB (wave 12, track D) - the Core's camera bitrate and the four surviving tests

- Agent: coder-execution (CB). Date: 2026-10-14 (host `date`).
- Status: **complete** (09:57). Unit, static, typecheck and lint green; every new guard seen red on a mutant, the engine start block included (`restart.db.test.ts -t G75b`: green `4 passed`, block removed in memory `1 failed`, `expected [ 9, 9 ] to deeply equal [ null, null ]`). Devices database suites: 42 passed (three files) + 8 passed (`source-class.db.test.ts`). `onvif-session.test.ts` after E2 landed: 66 passed. DRIVER DECISION to confirm: the two suites that use the boot fixture ran under the database lock alone - the heavy-host lock was held by another job through 30 and then 20 minutes of waiting, and the fixture starts a stand-in script, no worker.
- Record: `implementation/cb_bitrate_and_survivors.md`.

## Files

| File | Change |
|---|---|
| `apps/core-server/src/modules/devices/status.ts` | modify, Edit tool: `withCameraStreamFacts` answers `bitrateMbps: null` (real capture) |
| `apps/core-server/src/engine/camera-bitrate.ts` | NEW: the pure transition |
| `apps/core-server/src/engine/host.ts` | modify, Edit tool: one import, one additive start block (DRIVER DECISION, declared in file_claims.md) |
| `apps/core-server/src/modules/devices/__tests__/status.test.ts`, `routes.test.ts` | two existing cases re-pinned (they held the 9 in real capture), two cases added |
| `apps/core-server/src/engine/__tests__/rehydrate.test.ts`, `restart.db.test.ts` | one block appended; two cases extended |
| `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts` | cases at :177 and :434 strengthened, one case added (:485) |
| `.../camera/__tests__/discovery-recording.test.ts`, `ws-discovery.test.ts` | the case at :118; the case at :267 |
| `delegation_progress/file_claims.md`, `file_requests.md` | one line; three lines |

No file of `packages/shared`, `apps/core-web`, `apps/mobile`, and no product file under `capture/adapters/camera`, `capture/fence`, `capture/boot` or `capture-composition.ts` was written.

## For W5

The reader can go by null now: a Core in real capture states `bitrateMbps: null` in the `cameras` slice of the state stream and on operations 44, 46, 47. Simulated keeps 9. Caveat: an older Core still serves 9.

## For the controller

- Driver decision 1: engine files written (the state stream's slice has no writer in the devices folder).
- `onvif-session.test.ts` has two writers in this wave (CB and E2).
- A red that is not this row's: `onvif-session.test.ts:658` and `:836` (`Object.isFrozen(facade)` is false) - row E2's in-flight `statedTester` / `statedLocator` wrappers of the same file (`:126-131`) are not frozen objects. Seen at 09:05 on the working tree; not edited.
- T3's equivalent mutant is another mutant than the review's :395 case; the review's is red now.
