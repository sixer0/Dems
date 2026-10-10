/**
 * Sessions module (plan row W34; spec §7.8, §7.17, Q16; AC-B-49, AC-B-50): operations 24 to 38
 * of the shared registry, the recording lifecycle of the one session a Core has open.
 *
 *   24 createSession        28 beginPrecheck                 33 recoverSession
 *   25 startSession         29 retryPrecheck                 34 addSessionMarker
 *   26 stopSession          30 acknowledgePrecheckWarnings   35 addSessionNote
 *   27 getCurrentSession    31 cancelSession                 36 takeSessionSnapshot
 *                           32 scanCaseNumber                37 acknowledgeSessionSummary
 *                                                            38 listSessionHistory
 *
 * WHAT THE MODULE IS. A thin layer between HTTP and the engine host: every command is the
 * shared simulator's own action, hosted (`app.engine`), run as the caller, as one unit of work,
 * answered after the commit. The module owns no table and writes no row of its own: the audit
 * rows, the events, the session, the history entry and the sealed evidence item of a recording
 * are the engine's, written through its unit. Evidence has no route here (operations 39 to 43
 * are the evidence module's): an item appears because the engine finalises a stopped recording.
 *
 * ONE SESSION PER CORE (Q16). The engine's state has one `session`, and the database one row
 * (`active_session`, a singleton by its primary key). Two creates at the same moment are two
 * units of the one serial pipeline: the first opens the session, the second finds it open and is
 * answered `409 SESSION_ACTIVE`, or `200` with `created: false` when its input is the same.
 * Any operator who may start a session may stop it, with a reason; the row names that operator.
 *
 * ONE ERROR PRECEDENCE (spec §7.3; decision D94). The refusals of a command come in the order
 * of the simulator's REST layer: the shape of the request (422 `INVALID_INPUT`, before the
 * engine), then 404 for a session that is not the open one, then 409 for its state, then the
 * 422 the hosted action decides (`INVALID_REASON` for a stop reason that is absent or too
 * short). See `routes.ts` and `text-body.ts`.
 *
 * READS. `getCurrentSession` answers from the engine's committed state (no statement).
 * `listSessionHistory` answers from PostgreSQL, a keyset page (`history.ts`).
 *
 * The plugin function opens no database connection and registers no boot step and no seam:
 * `buildApp()` works without PostgreSQL. ONE hook since fix pass F-M5 (review R74-09): the
 * `onClose` of the capture-session unit (`registerSessionCaptureShutdown`), which does nothing
 * for an app that never captured a session.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `sessionsModule` keeps its name.
 */
import type { FastifyPluginAsync } from 'fastify';
import { registerSessionCaptureShutdown } from '../../capture-session';
import { registerSessionRoutes } from './routes';

export { INTERVALS_READ_SOURCE, intervalCursorOf, intervalPositionOf, listAudioSourceIntervals, pageOfIntervals, readIntervalPage } from './audio-intervals';
export { currentSessionResponse, type CurrentSessionSource } from './current';
export { cursorOf, listSessionHistory, positionOf, readHistoryPage, type HistoryPosition } from './history';
export {
  CAPTURE_SESSION_OPERATION_IDS,
  SESSION_OPERATION_IDS,
  SESSION_READ_IDS,
  actionOf,
  bodySchemaOf,
  operationOf,
  successStatusesOf,
  successesOf,
  type ActionOf,
  type SessionCommandId,
  type SessionOperationId,
  type SessionReadId,
} from './operations';
export { createRefusal, notOpenSession, precheckBlocked, precheckRunning, precheckWarnings } from './refusals';
export { registerSessionRoutes, sessionUnitLabel } from './routes';
export { NO_TEXT, readTextBody, type TextBody } from './text-body';

export const sessionsModule: FastifyPluginAsync = async (app) => {
  registerSessionRoutes(app);
  // Review R74-09: the capture of the open session is ended when the Core shuts down. A hook must be
  // added at plugin time; the unit itself is built on first use and an app that never used it closes nothing.
  registerSessionCaptureShutdown(app);
};
