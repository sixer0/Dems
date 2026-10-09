/**
 * Engine host (plan row W26; hand-built element HB-13, host half; spec §8; decisions D11 ADQ-1,
 * D14, D28, D40, D62, D67).
 *
 * This unit fills the seam `engine` of the scaffold (P25) and registers the boot step that
 * rehydrates the engine and sets `ready.engine`:
 *
 *   `app.engine`       one headless `Sim` of the shared simulator core, with PostgreSQL as its
 *                      store (`host.ts`). Its type is `EngineHost` (`types.ts`).
 *   boot step          `engine.rehydrate`, after B-1 to B-9 of the pool and the core: the stored
 *                      rows are read as `dems_app`, validated, put into the engine, the epoch is
 *                      moved on and a session that was in flight is moved to FAULT, in one unit
 *                      of work. A stored state that cannot be read or is rejected stops the boot:
 *                      the server never comes up on a state it could not validate.
 *   close hooks        the scheduler is stopped and what is not written yet (the hardware
 *                      snapshot) is written in a last unit, before the core closes the pipeline
 *                      and the pool closes.
 *
 * HOW A MODULE USES IT. One hosted action is one call; the answer comes after the commit:
 *
 *     const { value } = await app.engine.command(request.principal, 'stopRecording', body.reason);
 *     return answerOf(value);
 *
 * API-7 (the headers `x-dems-epoch` and `x-dems-revision` on every 2xx answer of a POST) is this
 * unit's, for every route of the server (`api-headers.ts`): a handler sets neither. The values
 * are those of the outcome of the command the request ran, or the engine's own when the answer
 * is sent. A handler that still sets them itself is not overruled.
 *
 * A refusal of the simulator is thrown as the `ApiFailure` of spec §7.2 with `details.simCode`;
 * a handler lets it propagate. A unit that could not be committed is 503 `NOT_READY`: nothing is
 * stored and the engine's state is set back.
 *
 * Hosted actions and server-native rows in ONE unit (they commit together or not at all):
 *
 *     const { value } = await app.engine.run('pairing.deviceConnected', async ({ unit, command }) => {
 *       await unit.audit.append({ type: 'PAIRING_SUCCESS', actorId: null, deviceId, message: '...', details: {} });
 *       return command(principal, 'acknowledgeAlert', alertId);
 *     });
 *
 * Reads need no pipeline: `app.engine.state()` and `app.engine.slice('session')` return the
 * COMMITTED state, by reference.
 *
 * | A module MUST | Why |
 * |---|---|
 * | Pass `request.principal` as it is | The actor of every row comes from the session, never from a request field (SR-65) |
 * | Answer after `command` or `run` resolved | The commit has happened then (ENG-4); the outcome carries the revision of API-7 |
 * | Return a refusal that the simulator reports IN ITS RESULT from the unit and answer afterwards | Such a refusal may have written a row (`EXPORT_DENIED`); throwing inside the unit would roll that row back |
 * | Use `engine.run` when a hosted action and rows of its own belong together | The host syncs its ring with the unit's rows before the action, so the chain continues |
 * | Call `engine.mirrorOperators()` after a unit that changed an operator committed | Clients then get the changed `operators` slice (ENG-3) |
 * | For a reset: `engine.stop()` before the pool is closed, `engine.reload()` after it is reopened | Spec §12.4 DC-4; `reload` adopts the epoch the reset routine wrote and adds nothing (decision D74) |
 *
 * | A module MUST NOT | Why |
 * |---|---|
 * | Call `engine.command` or `engine.run` inside `app.pipeline.run` | A unit cannot submit a unit (`PIPELINE_REENTRANT`) |
 * | Call a simulator action directly, or change the hosted `Sim` | Nothing would be written, published or set back |
 * | Insert into `audit_log` or `events` itself | The two writers of the core own those tables |
 * | Keep `scope.pending()` or answer from it | It is not committed and may be set back |
 * | Change what `state()` or `slice()` returns | It is the engine's own state, by reference |
 * | Pass a time, an actor or a revision from a request | None is trusted (SR-65) |
 *
 * WHAT THE REALTIME CHANNEL CAN RELY ON (`app.publish`): `types.ts`, `EngineStateChange`.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `enginePlugin`, `EngineHost`,
 * `EngineStateChange` and `EngineMeterFrame` keep their names.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { followClock, raiseClockFloor } from '../core';
import { registerStatePositionHeaders, statePositionOf } from './api-headers';
import { createEngineHost, isEngineControl, type EngineControl } from './host';
import { ENGINE_BOOT_STEP } from './limits';
import type { EngineHost } from './types';

export { actorAuth, isSignedOut, withActorScope } from './actor-scope';
export { registerStatePositionHeaders, statePositionOf, type StatePosition, type StatePositionHeaders } from './api-headers';
export { appendedRows, changedSlices, changesRecords, deltaOps } from './delta';
export { EngineError, EngineErrorCode, SIM_REFUSAL_RULES, engineNotReady, simCodeOf, simRefusal } from './errors';
export {
  HOSTED_ACTIONS,
  hostedActionsOfOperation,
  isHostedAction,
  type HostedActionArguments,
  type HostedActionName,
  type HostedActionResult,
} from './hosted-actions';
export { createEngineHost, isEngineControl, type EngineControl, type EngineHostDependencies } from './host';
export { registerCaptureDeviceIn, type InternalActions } from './internal-actions';
export {
  ENGINE_BOOT_STEP,
  ENGINE_TICK_MS,
  ENGINE_UNIT_LABEL,
  HEALTH_SNAPSHOT_INTERVAL_MS,
  RESYNC_RETRY_INTERVAL_MS,
  SNAPSHOT_MIN_INTERVAL_MS,
  SUSPENDED_PROBE_INTERVAL_MS,
} from './limits';
export { createSystemTimer, type EngineTimer } from './timer';
export type {
  EngineChangeCause,
  EngineDeltaOp,
  EngineHost,
  EngineMeterFrame,
  EngineOutcome,
  EngineStartMode,
  EngineStateChange,
  EngineStats,
  EngineUnit,
} from './types';

/** The host's controls of an app (tests, measurements). Throws when a test put another object behind the seam. */
export function engineControl(app: FastifyInstance): EngineHost & EngineControl {
  const engine = app.engine;
  if (!isEngineControl(engine)) throw new Error('app.engine is not the host of src/engine: the seam was replaced');
  return engine;
}

export const enginePlugin: FastifyPluginAsync = async (app) => {
  // API-7 in one place: every 2xx answer of a POST carries the two headers (`api-headers.ts`).
  // The position is read through the seam when the answer is sent: what a test put behind it counts.
  const positions = registerStatePositionHeaders(app, () => statePositionOf(app.engine));

  const host = createEngineHost({
    // Read through the seams at each use: what a test puts in place after `ready()` is what runs.
    pipeline: () => app.pipeline,
    clock: followClock(() => app.clock),
    // ONE time base per process (decision D110): the floor is the server clock's own, raised in
    // place on the object behind the seam. Nothing here puts another clock behind it.
    raiseClockFloor: (instant) => raiseClockFloor(app.clock, instant),
    publish: (publication) => app.publish(publication),
    setReady: (ready) => app.readiness.set('engine', ready),
    log: app.log,
    errorLog: app.errorLog,
    noteOutcome: positions.note,
    // Capture mode `real`: a worker measures the levels, the simulator generates none (CS-04, A-4).
    captureLevels: app.config.captureMode === 'real' ? 'external' : 'simulated',
  });
  app.seams.provide('engine', host);

  // After the boot checks of the pool (B-1) and of the core (B-2 to B-9), which registered first.
  app.readiness.addBootStep({ id: ENGINE_BOOT_STEP, run: () => host.start('boot') });

  // Spec §8.6 "Stop". `preClose` hooks run in the order of registration, so this one runs before
  // the realtime channel's: the last change is published while the sockets are still open. The
  // `onClose` hook is the same call a second time, which does nothing; it runs before the
  // core's (the pipeline closes after the engine's last unit) and before the pool's.
  app.addHook('preClose', async () => {
    await host.stop();
  });
  app.addHook('onClose', async () => {
    await host.stop();
  });
};
