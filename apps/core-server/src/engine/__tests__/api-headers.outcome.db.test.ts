// API-7 for a handler that sets NO header, against PostgreSQL as `dems_app` (plan row W26, fix
// round B2a; decisions D78 DN-8, D87; spec API-7, RT-5).
//
// The app is the real factory WITHOUT the domain modules (decision D85; the helper below is
// imported FIRST): the core, the four stage plugins, the ENGINE and the identity module are
// real, and three operations of the contract registry get stand-in handlers that set nothing.
// So what the answers carry is the hook's own work:
//
//   a handler that ran a hosted command    the position of the OUTCOME of that command, although
//                                          ticks and another command committed before the answer
//                                          left (the revision that holds the request's effect,
//                                          exactly: spec API-7);
//   a handler that ran no unit of the engine   the engine's position when the answer leaves;
//   a handler whose command was refused    no header: the answer is no 2xx.
//
// The caller is a seeded operator signed in through the real sign-in route; the request passes
// the real stages 2 to 7. A cookie is taken from an answer and handed on; it is never printed.
import '../../plugins/permission-guard/__tests__/without-domain-modules';

import { CORE_API_OPERATIONS, EPOCH_HEADER_NAME, REVISION_HEADER_NAME } from '@dems/shared/api';
import { OPERATORS, createManualClock, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { useTestDatabase, type TestDatabase } from '../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { cookieValue, webPost, webSignIn, type Headers } from '../../../test/support/identity';
import { routeOfOperation } from '../../plugins/permission-guard';
import { engineControl, type EngineOutcome } from '../index';
import { FIXED_NOW, manualTimer } from './support';

const db = useTestDatabase({ template: 'seed' });

/** `[x-dems-epoch, x-dems-revision]` of an answer; null for a header that is not there. */
function headersOf(response: LightMyRequestResponse): [number | null, number | null] {
  const read = (name: string): number | null => {
    const value = response.headers[name];
    return value === undefined ? null : Number(value);
  };
  return [read(EPOCH_HEADER_NAME), read(REVISION_HEADER_NAME)];
}

/** The route of a registry operation: method, path and `config.operationId`, so the real stage 6 applies its rule. */
function routeOf(operationId: string) {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return routeOfOperation(operation);
}

interface StandInServer {
  readonly app: FastifyInstance;
  readonly engine: ReturnType<typeof engineControl>;
  /** Advances the clock, fires the engine's timer and waits for the tick, 50 ms at a time. */
  drive(ms: number): Promise<void>;
  signIn(role: OperatorRole): Promise<Headers>;
}

/** The real app without the domain modules, with the given stand-in routes, booted on a manual clock and a manual timer. */
async function standInServer(target: TestDatabase, routes: (instance: FastifyInstance) => void): Promise<StandInServer> {
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'warn' }), logStream: log.stream });
  target.onCleanup(() => app.close());
  // A plugin registered after the units, as a module is: the boot check of the access rules sees its routes.
  void app.register(async (instance) => routes(instance));
  await app.ready();
  const clock = createManualClock(FIXED_NOW);
  app.seams.replace('clock', clock);
  const engine = engineControl(app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);
  await app.readiness.boot();
  return {
    app,
    engine,
    async drive(ms) {
      for (let elapsed = 0; elapsed < ms; elapsed += 50) {
        clock.advance(50);
        timer.fire();
        await engine.idle();
      }
    },
    async signIn(role) {
      const operator = OPERATORS.find((candidate) => candidate.role === role);
      if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
      const response = await webSignIn(app, operator.username);
      const name = app.config.sessionCookieName;
      const token = response.statusCode === 200 ? cookieValue(response, name) : null;
      if (token === null) throw new Error(`the web sign-in of the ${role} answered ${response.statusCode}`);
      return { cookie: `${name}=${token}` };
    },
  };
}

describe('a handler that sets no header', () => {
  it('gets the position of the OUTCOME of the hosted command its request ran, although ticks and another command committed before the answer left', async () => {
    const target = await db.another({ slug: 'b2a_headers_outcome' });
    let ran: (outcome: EngineOutcome<unknown>) => void = () => undefined;
    const commandRan = new Promise<EngineOutcome<unknown>>((resolve) => {
      ran = resolve;
    });
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    /** The retention of the request whose handler fires the engine's timer itself. */
    const INSIDE = 78;
    let tickInside: () => Promise<void> = async () => undefined;
    const server = await standInServer(target, (instance) => {
      // Operation `setStoragePolicy`: the hosted command of the request, and no header of the handler's own.
      instance.route({
        ...routeOf('setStoragePolicy'),
        handler: async (request) => {
          const { retentionDays } = request.body as { retentionDays: number };
          const outcome = await instance.engine.command(request.principal, 'setStoragePolicy', { retentionDays });
          if (retentionDays === INSIDE) {
            // A second of ticks that run INSIDE this request's work (the timer is fired from here, as a timer that
            // was started during a request is): what a tick commits is not this request's outcome.
            await tickInside();
            return { revision: outcome.revision };
          }
          ran(outcome);
          // The answer is held back while the engine moves on.
          await released;
          return { done: true };
        },
      });
      // Operation `cancelPairingCode`: a handler that runs no unit of the engine.
      instance.route({ ...routeOf('cancelPairingCode'), handler: async () => ({ done: true }) });
      // Operation `stopSession`: its hosted command is refused by the simulator (no session is open), by throwing.
      instance.route({
        ...routeOf('stopSession'),
        handler: async (request) => {
          await instance.engine.command(request.principal, 'stopRecording', 'Interview completed');
          return { done: true };
        },
      });
    });
    tickInside = () => server.drive(1_000);
    const supervisor = await server.signIn('SUPERVISOR');
    const investigator = await server.signIn('INVESTIGATOR');

    const pending = webPost(server.app, routeOf('setStoragePolicy').url, supervisor, { retentionDays: 77 });
    const outcome = await commandRan;
    // Three seconds of ticks, and a sign-in of somebody else, commit before the answer is sent.
    await server.drive(3_000);
    await server.signIn('TECHNICIAN');
    expect(server.engine.revision).toBeGreaterThan(outcome.revision + 1);
    release();
    const response = await pending;
    expect(response.statusCode).toBe(200);
    // The revision that holds THIS command's effect, exactly: not the engine's later one.
    expect(headersOf(response)).toEqual([outcome.epoch, outcome.revision]);
    expect(headersOf(response)[1]).toBeLessThan(server.engine.revision);
    expect(server.engine.slice('storagePolicy').retentionDays).toBe(77);

    // Ticks that commit inside the request's own work are not its outcome either: the command's revision stays.
    const inside = await webPost(server.app, routeOf('setStoragePolicy').url, supervisor, { retentionDays: INSIDE });
    expect(inside.statusCode).toBe(200);
    expect(headersOf(inside)).toEqual([server.engine.epoch, (inside.json() as { revision: number }).revision]);
    expect(headersOf(inside)[1]).toBeLessThan(server.engine.revision);

    // A handler that ran no unit of the engine: the engine's position when the answer leaves.
    const native = await webPost(server.app, routeOf('cancelPairingCode').url, supervisor);
    expect([native.statusCode, headersOf(native)]).toEqual([200, [server.engine.epoch, server.engine.revision]]);

    // A command the simulator refused: the answer is no 2xx and carries nothing, and nothing changed.
    const revision = server.engine.revision;
    const refused = await webPost(server.app, routeOf('stopSession').url.replace(':id', 'SES-20261001-0001'), investigator, { reason: 'Interview completed' });
    expect(refused.statusCode).toBeGreaterThanOrEqual(400);
    expect(refused.statusCode).toBeLessThan(500);
    expect(headersOf(refused)).toEqual([null, null]);
    expect(server.engine.revision).toBe(revision);

    // The real stage 6 stands before the stand-in: an operator without the permission gets 403 and no header.
    const denied = await webPost(server.app, routeOf('setStoragePolicy').url, investigator, { retentionDays: 5 });
    expect([denied.statusCode, headersOf(denied)]).toEqual([403, [null, null]]);

    // A tick after a request does not write into that request's record: the next request reads the engine afresh.
    await server.drive(1_000);
    const again = await webPost(server.app, routeOf('cancelPairingCode').url, supervisor);
    expect(headersOf(again)).toEqual([server.engine.epoch, server.engine.revision]);
  });
});
