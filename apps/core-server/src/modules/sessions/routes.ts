/**
 * The routes of the sessions module: operations 24 to 38 of the shared registry (plan row W34;
 * spec §7.8, §7.17; contract `core-api.ts` for 24 to 27, `sessions.ts` for 28 to 38).
 *
 *   #   operationId                  hosted action                 arguments            success
 *   24  createSession                createSession                 the body             201, or 200 for equal input
 *   25  startSession                 startRecording (composite)    none                 202 PRECHECK, 200 RECORDING
 *   26  stopSession                  stopRecording                 body.reason          202 STOPPING
 *   27  getCurrentSession            (a read of `session`)                              200
 *   28  beginPrecheck                beginPrecheck                 none                 202 PRECHECK
 *   29  retryPrecheck                retryPrecheck                 none                 202 PRECHECK
 *   30  acknowledgePrecheckWarnings  acknowledgePrecheckWarnings   none                 200 ARMED
 *   31  cancelSession                cancel                        none                 204
 *   32  scanCaseNumber               scanCaseNumber                none                 200
 *   33  recoverSession               recover                       none                 202 RECOVERY
 *   34  addSessionMarker             addMarker                     body.label           204
 *   35  addSessionNote               addNote                       body.text            204
 *   36  takeSessionSnapshot          snapshot                      none                 204
 *   37  acknowledgeSessionSummary    acknowledgeSummary            the `{id}` of the path  204
 *   38  listSessionHistory           (a read of PostgreSQL)                             200
 *
 * THE RECIPE OF A COMMAND. One unit of work of the engine host per request; the answer is built
 * after it resolved, so after the commit. The engine's unit gives it the epoch and the revision
 * of the outcome (API-7; `src/engine/api-headers.ts`): no handler here sets either. A refusal the simulator throws arrives as the mapped `ApiFailure` with
 * `details.simCode` and propagates. Three forms:
 *
 *   24, 32, 37   `app.engine.command(request.principal, action, ...args)`.
 *   25 to 36     the `{id}` of the path must be the open session. No action of the simulator
 *   with `{id}`  takes a session ID, so the check is the module's, and it is made INSIDE the
 *                unit (`app.engine.run`), on the state the action is about to change: between
 *                a check made outside and the unit, another operator's unit could cancel that
 *                session and create the next one, and the action would then change a session
 *                the caller never named. The unit runs ONE hosted action after the check.
 *   25           the composite start of the design book, as the simulator's REST layer answers
 *                it: from CREATE the pre-check (202); from ARMED the recording (200); from a
 *                pre-check that ended with a warning, with `acknowledgeWarnings: true`, the
 *                acknowledgement AND the recording in one unit (200, two audit rows); the three
 *                `PRECHECK_*` answers otherwise. Every other state is left to the simulator's
 *                own refusal of `startRecording`.
 *
 * The `state` of a `SessionCommandResponse` is the state the hosted action leaves the session
 * in, which the contract names in the description of each 2xx answer. For a create with equal
 * input it is the state of the open session, read from the committed state.
 *
 * WHO MAY CALL is not checked here: the access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`), before the body is read. For `recover`, `addMarker`, `addNote`,
 * `snapshot` and `acknowledgeSummary` the simulator checks nothing, so that rule is the only
 * check there is. No route of this file has a hook of its own.
 *
 * ONE ERROR PRECEDENCE (spec §7.3; decision D94). Everything the registry's schemas say of a
 * request is answered at line 8, before the engine: `422 INVALID_INPUT`, by stage 7. Two body
 * members are the exception, because the hosted action checks their lower bound itself and the
 * specification answers such a check at line 10, after the session was looked at: the reason of
 * a stop (26) and the text of a note (35). Their routes have no body schema; the handler reads
 * the body with the contract's schema (`text-body.ts`):
 *
 *   the shape is wrong (not text, the text rule, too long)   422 `INVALID_INPUT`, before the engine;
 *   the member is absent or too short                        the hosted action gets the EMPTY
 *                                                            text and decides in its own order:
 *                                                            404 (not the open session), 409
 *                                                            (the state), then 422:
 *                                                            `INVALID_REASON` for a stop,
 *                                                            `INVALID_INPUT` for a note.
 *
 * So the refusals of a stop come in the order of the simulator's REST layer. No other body of
 * this module has a member that the schema bounds from below AND the action checks after a 404
 * or a 409: `createSession` validates its input before it looks for an open session, in the
 * action as at stage 7; a start has no bound; a marker label may be empty.
 */
import {
  CaseNumberScanSchema,
  CurrentSessionResponseSchema,
  PageQuerySchema,
  SessionCommandResponseSchema,
  SessionHistoryPageSchema,
  SessionMarkerRequestSchema,
  SessionNoteRequestSchema,
  SessionStartRequestSchema,
  SessionStopRequestSchema,
  sessionCreateSchema,
  type CaseNumberScan,
  type CurrentSessionResponse,
  type SessionCommandResponse,
  type SessionHistoryPage,
} from '@dems/shared/api';
import { SessionState } from '@dems/shared/domain';
import type { ActiveSession } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { EngineOutcome, EngineUnit } from '../../engine';
import { invalidInput } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import { currentSessionResponse } from './current';
import { listSessionHistory } from './history';
import { actionOf, bodySchemaOf, operationOf, successesOf, type SessionOperationId } from './operations';
import { createRefusal, notOpenSession, precheckBlocked, precheckRunning, precheckWarnings } from './refusals';
import { NO_TEXT, readTextBody } from './text-body';

/** Label of the unit of work of an operation that names the open session. It appears in the pipeline's log lines. */
export const sessionUnitLabel = (operationId: SessionOperationId): string => `sessions.${operationId}`;

/** The `{id}` of a path, validated with the pattern the registry gives the operation. */
function sessionParams(operationId: SessionOperationId) {
  const parameter = operationOf(operationId).pathParam;
  if (parameter === undefined) throw new Error(`the contract gives ${operationId} no path parameter`);
  return z.object({ id: z.string().regex(parameter.pattern) });
}

export function registerSessionRoutes(app: FastifyInstance): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const route = (operationId: SessionOperationId) => routeOfOperation(operationOf(operationId));

  // The hosted action of each command, read once from the contract's table.
  const action = {
    createSession: actionOf('createSession'),
    startSession: actionOf('startSession'),
    stopSession: actionOf('stopSession'),
    beginPrecheck: actionOf('beginPrecheck'),
    retryPrecheck: actionOf('retryPrecheck'),
    acknowledgePrecheckWarnings: actionOf('acknowledgePrecheckWarnings'),
    cancelSession: actionOf('cancelSession'),
    scanCaseNumber: actionOf('scanCaseNumber'),
    recoverSession: actionOf('recoverSession'),
    addSessionMarker: actionOf('addSessionMarker'),
    addSessionNote: actionOf('addSessionNote'),
    takeSessionSnapshot: actionOf('takeSessionSnapshot'),
    acknowledgeSessionSummary: actionOf('acknowledgeSessionSummary'),
  } as const;

  /**
   * One unit of work on the open session: `work` runs only when `id` names it, on the state
   * inside the unit. Otherwise the unit ends with 404 and nothing changed.
   */
  const onOpenSession = <Value>(
    operationId: SessionOperationId,
    id: string,
    work: (scope: EngineUnit, session: ActiveSession) => Promise<Value>,
  ): Promise<EngineOutcome<Value>> =>
    app.engine.run(sessionUnitLabel(operationId), async (scope) => {
      const session = scope.pending().session;
      if (session === null || session.id !== id) throw notOpenSession();
      return work(scope, session);
    });

  // 24 createSession
  {
    const [replayed, created] = successesOf('createSession', [200, 201]);
    routes.route({
      ...route('createSession'),
      schema: { body: sessionCreateSchema, response: { 200: SessionCommandResponseSchema, 201: SessionCommandResponseSchema } },
      handler: async (request, reply): Promise<SessionCommandResponse> => {
        const outcome = await app.engine.command(request.principal, action.createSession, request.body);
        const result = outcome.value;
        // A refusal in the result: the unit has committed (it changed nothing); answered after it.
        if (!result.ok) throw createRefusal(result);
        const open = app.engine.slice('session');
        void reply.code(result.created ? created : replayed);
        return {
          sessionId: result.sessionId,
          state: open !== null && open.id === result.sessionId ? open.state : SessionState.CREATE,
          created: result.created,
        };
      },
    });
  }

  // 25 startSession
  {
    const [recordingStarted, precheckStarted] = successesOf('startSession', [200, 202]);
    const precheck = { status: precheckStarted, state: SessionState.PRECHECK } as const;
    const recording = { status: recordingStarted, state: SessionState.RECORDING } as const;
    routes.route({
      ...route('startSession'),
      schema: {
        params: sessionParams('startSession'),
        body: SessionStartRequestSchema,
        response: { 200: SessionCommandResponseSchema, 202: SessionCommandResponseSchema },
      },
      handler: async (request, reply): Promise<SessionCommandResponse> => {
        const { id } = request.params;
        const acknowledge = request.body.acknowledgeWarnings === true;
        const outcome = await onOpenSession('startSession', id, async (scope, session) => {
          if (session.state === SessionState.CREATE) {
            await scope.command(request.principal, action.beginPrecheck);
            return precheck;
          }
          if (session.state === SessionState.PRECHECK) {
            const result = session.precheck.outcome;
            if (result === 'WARN' && acknowledge) await scope.command(request.principal, action.acknowledgePrecheckWarnings);
            else if (result === 'BLOCK') throw precheckBlocked(session.precheck.items);
            else if (result === 'WARN') throw precheckWarnings();
            else throw precheckRunning();
          }
          // ARMED starts. Any other state is the simulator's own refusal: 409 `INVALID_STATE`.
          await scope.command(request.principal, action.startSession);
          return recording;
        });
        void reply.code(outcome.value.status);
        return { sessionId: id, state: outcome.value.state };
      },
    });
  }

  // 26 stopSession
  {
    const [accepted] = successesOf('stopSession', [202]);
    const stopBody = bodySchemaOf('stopSession', SessionStopRequestSchema);
    routes.route({
      ...route('stopSession'),
      // No body schema here: the lower bound of the reason is the hosted action's to refuse (line 10).
      schema: { params: sessionParams('stopSession'), response: { 202: SessionCommandResponseSchema } },
      handler: async (request, reply): Promise<SessionCommandResponse> => {
        // Line 8: a body that does not match its schema in shape, before the engine.
        const body = readTextBody(stopBody, 'reason', request.body);
        if (body.kind === 'INVALID') throw invalidInput('body');
        const { id } = request.params;
        // Line 10: the open session (404), then the action's own order: the state (409), the reason (422).
        const reason = body.kind === 'VALID' ? body.value.reason : NO_TEXT;
        await onOpenSession('stopSession', id, (scope) => scope.command(request.principal, action.stopSession, reason));
        void reply.code(accepted);
        return { sessionId: id, state: SessionState.STOPPING };
      },
    });
  }

  // 27 getCurrentSession
  routes.route({
    ...route('getCurrentSession'),
    schema: { response: { 200: CurrentSessionResponseSchema } },
    // The committed state, by reference: no unit of work and no statement.
    handler: async (): Promise<CurrentSessionResponse> => currentSessionResponse(app.engine.state(), app.clock.now()),
  });

  // 28 beginPrecheck, 29 retryPrecheck, 30 acknowledgePrecheckWarnings, 33 recoverSession:
  // one hosted action without an argument on the open session, answered with the state it leaves.
  const transition = (
    operationId: 'beginPrecheck' | 'retryPrecheck' | 'recoverSession',
    hosted: 'beginPrecheck' | 'retryPrecheck' | 'recover',
    state: SessionState,
  ): void => {
    const [accepted] = successesOf(operationId, [202]);
    routes.route({
      ...route(operationId),
      schema: { params: sessionParams(operationId), response: { 202: SessionCommandResponseSchema } },
      handler: async (request, reply): Promise<SessionCommandResponse> => {
        const { id } = request.params;
        await onOpenSession(operationId, id, (scope) => scope.command(request.principal, hosted));
        void reply.code(accepted);
        return { sessionId: id, state };
      },
    });
  };
  transition('beginPrecheck', action.beginPrecheck, SessionState.PRECHECK);
  transition('retryPrecheck', action.retryPrecheck, SessionState.PRECHECK);

  {
    const [armed] = successesOf('acknowledgePrecheckWarnings', [200]);
    routes.route({
      ...route('acknowledgePrecheckWarnings'),
      schema: { params: sessionParams('acknowledgePrecheckWarnings'), response: { 200: SessionCommandResponseSchema } },
      handler: async (request, reply): Promise<SessionCommandResponse> => {
        const { id } = request.params;
        await onOpenSession('acknowledgePrecheckWarnings', id, (scope) => scope.command(request.principal, action.acknowledgePrecheckWarnings));
        void reply.code(armed);
        return { sessionId: id, state: SessionState.ARMED };
      },
    });
  }

  // 31 cancelSession
  {
    const [cancelled] = successesOf('cancelSession', [204]);
    routes.route({
      ...route('cancelSession'),
      schema: { params: sessionParams('cancelSession') },
      handler: async (request, reply) => {
        await onOpenSession('cancelSession', request.params.id, (scope) => scope.command(request.principal, action.cancelSession));
        return reply.code(cancelled).send();
      },
    });
  }

  // 32 scanCaseNumber
  {
    const [scanned] = successesOf('scanCaseNumber', [200]);
    routes.route({
      ...route('scanCaseNumber'),
      schema: { response: { 200: CaseNumberScanSchema } },
      handler: async (request, reply): Promise<CaseNumberScan> => {
        const outcome = await app.engine.command(request.principal, action.scanCaseNumber);
        void reply.code(scanned);
        return { caseNumber: outcome.value };
      },
    });
  }

  // 33 recoverSession
  transition('recoverSession', action.recoverSession, SessionState.RECOVERY);

  // 34 addSessionMarker
  {
    const [added] = successesOf('addSessionMarker', [204]);
    routes.route({
      ...route('addSessionMarker'),
      schema: { params: sessionParams('addSessionMarker'), body: SessionMarkerRequestSchema },
      handler: async (request, reply) => {
        const { label } = request.body;
        await onOpenSession('addSessionMarker', request.params.id, (scope) => scope.command(request.principal, action.addSessionMarker, label));
        return reply.code(added).send();
      },
    });
  }

  // 35 addSessionNote
  {
    const [added] = successesOf('addSessionNote', [204]);
    const noteBody = bodySchemaOf('addSessionNote', SessionNoteRequestSchema);
    routes.route({
      ...route('addSessionNote'),
      // No body schema here, as for the stop: an absent or empty note is the hosted action's to refuse (line 10).
      schema: { params: sessionParams('addSessionNote') },
      handler: async (request, reply) => {
        const body = readTextBody(noteBody, 'text', request.body);
        if (body.kind === 'INVALID') throw invalidInput('body');
        const text = body.kind === 'VALID' ? body.value.text : NO_TEXT;
        await onOpenSession('addSessionNote', request.params.id, (scope) => scope.command(request.principal, action.addSessionNote, text));
        return reply.code(added).send();
      },
    });
  }

  // 36 takeSessionSnapshot
  {
    const [taken] = successesOf('takeSessionSnapshot', [204]);
    routes.route({
      ...route('takeSessionSnapshot'),
      schema: { params: sessionParams('takeSessionSnapshot') },
      handler: async (request, reply) => {
        await onOpenSession('takeSessionSnapshot', request.params.id, (scope) => scope.command(request.principal, action.takeSessionSnapshot));
        return reply.code(taken).send();
      },
    });
  }

  // 37 acknowledgeSessionSummary: the one `{id}` that is the action's argument and never answers 404.
  {
    const [acknowledged] = successesOf('acknowledgeSessionSummary', [204]);
    routes.route({
      ...route('acknowledgeSessionSummary'),
      schema: { params: sessionParams('acknowledgeSessionSummary') },
      handler: async (request, reply) => {
        await app.engine.command(request.principal, action.acknowledgeSessionSummary, request.params.id);
        return reply.code(acknowledged).send();
      },
    });
  }

  // 38 listSessionHistory
  successesOf('listSessionHistory', [200]);
  routes.route({
    ...route('listSessionHistory'),
    schema: { querystring: PageQuerySchema, response: { 200: SessionHistoryPageSchema } },
    handler: async (request): Promise<SessionHistoryPage> => listSessionHistory(app, request, request.query),
  });
  successesOf('getCurrentSession', [200]);
}
