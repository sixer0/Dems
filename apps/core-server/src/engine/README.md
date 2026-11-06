# `src/engine`

Up: [`src`](../README.md)

## Purpose

The engine host. It fills the `engine` seam with one headless simulator core (from the shared package) that uses PostgreSQL as its store, and registers the `engine.rehydrate` boot step that reads the stored rows back into the engine at start.

## Contents

| File or folder | Role |
|---|---|
| [`actor-scope.ts`](./actor-scope.ts) | The actor scope of one hosted command. |
| [`api-headers.ts`](./api-headers.ts) | The two headers of spec API-7, in one place. |
| [`camera-bitrate.ts`](./camera-bitrate.ts) | A Core in its own capture states no bitrate of a camera. |
| [`capture-checkpoint-doors.ts`](./capture-checkpoint-doors.ts) | The capture-checkpoint door of the engine host, reached beside the seam like the fact doors, and not a member of `EngineHost`: applyCaptureCheckpoints what the Core holds of a recording of its own... |
| [`capture-session.ts`](./capture-session.ts) | What the capture of a real recording does to the open session. |
| [`delta.ts`](./delta.ts) | What changed between two committed states, as the operations of one state change. |
| [`errors.ts`](./errors.ts) | Errors of the engine host, and the one table that turns a refusal of a hosted simulator action into the answer of the API. |
| [`export-doors.ts`](./export-doors.ts) | The export doors of the engine host, reached beside the seam like the seal doors and the fact doors, and not members of `EngineHost`: completeEvidenceExport the completion of an export whose job... |
| [`fact-doors.ts`](./fact-doors.ts) | The fact doors of the engine host, reached beside the seam like the capture doors and the seal doors, and not members of `EngineHost`: applyStorageVolume CS-09: the internal action of the same name. |
| [`headless-sim.ts`](./headless-sim.ts) | The shared simulator core, headless. |
| [`host.ts`](./host.ts) | The engine host. |
| [`hosted-actions.ts`](./hosted-actions.ts) | Which simulator actions the engine host runs. |
| [`index.ts`](./index.ts) | Engine host. |
| [`internal-actions.ts`](./internal-actions.ts) | The internal simulator actions a server module may run inside its own engine unit. |
| [`limits.ts`](./limits.ts) | Limits of the engine host. |
| [`rehydrate.ts`](./rehydrate.ts) | Rehydration: the stored rows back into an engine state, and what a process start does to it. |
| [`restart-fault.ts`](./restart-fault.ts) | The end of the restart fault of a Core in its own capture. |
| [`ring.ts`](./ring.ts) | Rows that somebody else appended to the one chain, taken into the engine's rings. |
| [`scheduler.ts`](./scheduler.ts) | The scheduler of the engine host. |
| [`seal-doors.ts`](./seal-doors.ts) | The seal doors of the engine host: the three internal actions `applySealingProgress`, `completeSeal` and `recordEvidenceVerification`, reached beside the seam like the capture doors. |
| [`sealed-facts-doors.ts`](./sealed-facts-doors.ts) | The sealed-facts door of the engine host, reached beside the seam like the fact doors, and not a member of `EngineHost`: applySealedItemFacts what the sealed manifest of an item says and no stored... |
| [`sealing-notice-doors.ts`](./sealing-notice-doors.ts) | The sealing notice doors of the engine host, reached beside the seam like the seal doors, and not members of `EngineHost`. |
| [`timer.ts`](./timer.ts) | The timer that drives the engine host's scheduler. |
| [`types.ts`](./types.ts) | The types of the engine host. |
| [`unsealable-doors.ts`](./unsealable-doors.ts) | The unsealable door of the engine host, reached beside the seam like the seal doors, and not a member of `EngineHost`: endSessionUnsealable the terminal outcome of a session the Core cannot seal:... |
| [`write-plan.ts`](./write-plan.ts) | Write-through: what one unit of work writes when the engine's state moved. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `engineControl`, `captureDoorsOf`, `provideCaptureDeviceListing`, `enginePlugin`, `actorAuth`, `isSignedOut`, `withActorScope`, `registerStatePositionHeaders`, `statePositionOf`, `StatePosition`, `StatePositionHeaders`, `appendedRows`, `changedSlices`, `changesRecords`, `deltaOps`, `EngineError`, `EngineErrorCode`, `SIM_REFUSAL_RULES`, `engineNotReady`, `simCodeOf`, `simRefusal`, `HOSTED_ACTIONS`, `hostedActionsOfOperation`, `isHostedAction`, `HostedActionArguments`, `HostedActionName`, `HostedActionResult`, `createEngineHost`, `isEngineControl`, `EngineControl`, and 58 more.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`app.ts`](../app.ts): `index.ts`
- [`capture`](../capture/README.md): `index.ts`
- [`capture-composition.ts`](../capture-composition.ts): `index.ts`
- [`capture-notices`](../capture-notices/README.md): `index.ts`
- [`capture-session`](../capture-session/README.md): `index.ts`
- [`capture/boot`](../capture/boot/README.md): `index.ts`
- [`evidence-export`](../evidence-export/README.md): `index.ts`
- [`evidence-facts`](../evidence-facts/README.md): `index.ts`
- [`lcd`](../lcd/README.md): `index.ts`
- [`modules/capture-discovery`](../modules/capture-discovery/README.md): `index.ts`
- [`modules/capture-inputs`](../modules/capture-inputs/README.md): `index.ts`
- [`modules/devices`](../modules/devices/README.md): `index.ts`
- [`modules/evidence`](../modules/evidence/README.md): `index.ts`
- [`modules/sessions`](../modules/sessions/README.md): `index.ts`
- [`modules/transcripts`](../modules/transcripts/README.md): `index.ts`
- [`realtime`](../realtime/README.md): `index.ts`
- [`sealing-host`](../sealing-host/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../core/README.md)
- [`db/mapping`](../db/mapping/README.md)
- [`db/schema`](../db/schema/README.md)
- [`db/store`](../db/store/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)
- [`realtime`](../realtime/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `drizzle-orm`, `fastify`
- Node built-ins: `node:async_hooks`, `node:util`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 32 | 16 |

16 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (39 folders): `src/__tests__`, `src/capture-notices/__tests__`, `src/capture-session/__tests__`, `src/capture/__tests__`, `src/capture/fence/__tests__`, `src/capture/host-alias/__tests__`, `src/evidence-export/__tests__`, `src/evidence-facts/__tests__`, and more.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
