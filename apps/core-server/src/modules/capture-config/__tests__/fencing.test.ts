// The real-mode demo fencing of the capture-config module (blueprint row 52 / M2-W10; register
// CS-23; OD-18, OD-19; C3 §3 ops 71 to 75; C3 §4). Two halves:
//
//   the decision   `captureModeOf` / `demoFencingOf` name the two modes and what each refuses,
//                  with the two machine codes pinned to the contract's vocabulary;
//   the refusal    the Verification item of this row, "hardware-fault injection refused in real
//                  mode": the REAL app factory with no database, the REAL stage 6, a SUPERVISOR
//                  (a holder of DEMO_CONTROL) behind stage 4, and the demo flag off - which is
//                  what "real-capture mode" means on this server (config.ts DC-2: the flag is
//                  read once at start and never changeable through the API). The call answers
//                  403 DEMO_DISABLED before the body is read, the engine records no command and
//                  the pool sees no statement. The positive control turns the flag on and the
//                  same call passes stage 6 into the hosted action - so the refusal is proven to
//                  come from the mode, not from the permission.
//
// The 409 half of the fence (`RESET_BLOCKED_REAL_EVIDENCE`, op 75) is row 54's DB-and-disk guard;
// what this row can see is the contract: the code exists, operation 75 documents it, and the
// fencing data names both refusals. Asserted below.
import { ApiErrorCode, CORE_API_OPERATIONS, matchCoreApiOperation } from '@dems/shared/api';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../../../app';
import { ANONYMOUS, committedOf, engineDouble, operatorOf, scenarioState } from '../../devices/__tests__/support';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { standInDatabase, type StandInDatabase } from '../../../../test/support/core';
import { WEB_ORIGIN } from '../../../../test/support/identity';
import type { Principal } from '../../../plugins/authenticate';
import { CaptureMode, DemoState, captureModeOf, demoFencingOf } from '../index';
import { describe, expect, it } from 'vitest';

const FAULTS = '/api/v1/demo/faults';
const SCENARIO = '/api/v1/demo/scenario';
const STATUS = '/api/v1/demo/status';
const RESET = '/api/v1/demo/reset';

interface FencedApp {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  readonly database: StandInDatabase;
  readonly commands: Array<{ action: string; args: readonly unknown[] }>;
  actAs(principal: Principal): void;
  post(url: string, payload?: unknown): Promise<LightMyRequestResponse>;
  get(url: string): Promise<LightMyRequestResponse>;
}

/** The real pipeline with no PostgreSQL: stage 4 is a stand-in, stage 6 is the server's own rule,
 * the pool is the stand-in that answers the denial row the guard writes for an audited refusal. */
async function fencedApp(demoControls: boolean): Promise<FencedApp> {
  const log = captureLog();
  const database = standInDatabase();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info', demoControls }), createPool: () => database.pool, logStream: log.stream });
  let current: Principal = ANONYMOUS;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  const double = engineDouble(committedOf(scenarioState('idle')));
  app.seams.replace('engine', double.host);
  return {
    app,
    log,
    database,
    commands: double.commands,
    actAs: (principal) => void (current = principal),
    post: (url, payload) => app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload: payload as object }) }),
    get: (url) => app.inject({ method: 'GET', url }),
  };
}

describe('the mode decision (OD-18): the demo flag is the Simulated/real-capture switch', () => {
  it('flag off is REAL_CAPTURE, flag on is SIMULATED; the demo state op 71 reports follows', () => {
    expect(captureModeOf({ demoControls: false })).toBe(CaptureMode.REAL_CAPTURE);
    expect(captureModeOf({ demoControls: true })).toBe(CaptureMode.SIMULATED);
    expect(demoFencingOf({ demoControls: false }).demo).toBe(DemoState.DISABLED);
    expect(demoFencingOf({ demoControls: true }).demo).toBe(DemoState.ENABLED);
  });

  it('what each mode refuses, in data: faults and scenarios off in real capture, the reset further fenced by row 54', () => {
    const real = demoFencingOf({ demoControls: false });
    expect(real.faultInjectionAllowed).toBe(false);
    expect(real.scenarioLoadAllowed).toBe(false);
    expect(real.resetAllowedUnconditionally).toBe(false);
    const simulated = demoFencingOf({ demoControls: true });
    expect(simulated.faultInjectionAllowed).toBe(true);
    expect(simulated.scenarioLoadAllowed).toBe(true);
    // Even Simulated resets are guarded against real sealed evidence (OD-19): the flag opens the
    // operation, row 54's guard decides it. `resetAllowedUnconditionally` says exactly that.
    expect(simulated.resetAllowedUnconditionally).toBe(true);
  });

  it('the two refusal codes are the contract\'s own members, not strings invented here', () => {
    const codes = demoFencingOf({ demoControls: false }).refusalCodes;
    expect(codes.demoDisabled).toBe(ApiErrorCode.DEMO_DISABLED);
    expect(codes.resetBlocked).toBe(ApiErrorCode.RESET_BLOCKED_REAL_EVIDENCE);
  });

  it('the registry documents both refusals on the operations they fence (C3 §3/§4)', () => {
    const reset = CORE_API_OPERATIONS.find((operation) => operation.operationId === 'resetDemo');
    expect(reset?.responses['409']).toMatchObject({ schema: 'ApiError' });
    const inject = matchCoreApiOperation('POST', '/api/v1/demo/faults');
    expect(inject?.operation.responses['403']).toBeDefined();
    // The widened code: DEMO_DISABLED is the 403 of operations 71 to 74 (C3 §4, "widened to
    // real-capture mode"); its vocabulary member exists for the guard to answer with.
    expect(Object.values(ApiErrorCode)).toContain('DEMO_DISABLED');
    expect(Object.values(ApiErrorCode)).toContain('RESET_BLOCKED_REAL_EVIDENCE');
  });
});

describe('hardware-fault injection refused in real mode (the Verification item of row 52)', () => {
  it('demo flag OFF + SUPERVISOR (a DEMO_CONTROL holder): injectFault answers 403 DEMO_DISABLED before the body', async () => {
    const built = await fencedApp(false);
    expect(captureModeOf(built.app.config)).toBe(CaptureMode.REAL_CAPTURE);
    built.actAs(operatorOf('SUPERVISOR'));

    const response = await built.post(FAULTS, { kind: 'CAMERA_LOSS', target: { cameraId: 'VIDEO-01' } });
    expect(response.statusCode).toBe(403);
    expect((response.json() as { error: { code: string } }).error.code).toBe('DEMO_DISABLED');
    // The refusal is the mode's, not a handler's: no command reached the engine.
    expect(built.commands).toEqual([]);
    // DC-2: DEMO_DISABLED writes no audit row and one log line.
    expect(built.database.committed.auditSeqs).toEqual([]);
    const refused = built.log.lines().filter((line) => line['code'] === 'DEMO_DISABLED' && line['msg'] === 'request refused by the access rule');
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ audited: false, operationId: 'injectFault' });
  });

  it('scenario load and the status read take the same refusal; the reset route is fenced identically', async () => {
    const built = await fencedApp(false);
    built.actAs(operatorOf('SUPERVISOR'));
    for (const [url, payload] of [
      [SCENARIO, { name: 'idle' }],
      [FAULTS, { kind: 'MIC_CLIP' }],
      [RESET, undefined],
    ] as const) {
      const response = await built.post(url, payload);
      expect(response.statusCode, url).toBe(403);
      expect((response.json() as { error: { code: string } }).error.code, url).toBe('DEMO_DISABLED');
    }
    expect((await built.get(STATUS)).statusCode).toBe(403);
    expect(built.commands).toEqual([]);
    expect(built.database.committed.auditSeqs).toEqual([]);
  });

  it('positive control: the SAME caller with the flag ON passes stage 6 and reaches the hosted action - the refusal came from the mode', async () => {
    const built = await fencedApp(true);
    expect(captureModeOf(built.app.config)).toBe(CaptureMode.SIMULATED);
    built.actAs(operatorOf('SUPERVISOR'));
    const response = await built.post(FAULTS, { kind: 'CAMERA_LOSS', target: { cameraId: 'VIDEO-01' } });
    expect(response.statusCode).toBe(204);
    expect(built.commands.map((command) => [command.action, command.args[0]])).toEqual([['inject', 'CAMERA_LOSS']]);
  });

  it('a caller without DEMO_CONTROL is refused by permission first, whatever the flag (order of stages)', async () => {
    for (const demoControls of [false, true]) {
      const built = await fencedApp(demoControls);
      built.actAs(operatorOf('TECHNICIAN'));
      const response = await built.post(FAULTS, { kind: 'CAMERA_LOSS' });
      expect(response.statusCode, `flag ${String(demoControls)}`).toBe(403);
      expect((response.json() as { error: { code: string } }).error.code, `flag ${String(demoControls)}`).toBe('NOT_PERMITTED');
      // RB-4: the permission refusal is the audited one - exactly one ACCESS_DENIED row, while the
      // flag refusal above wrote none. The order of the two refusals is the order of their rules.
      expect(built.database.committed.auditSeqs.length, `flag ${String(demoControls)}`).toBe(1);
      expect(built.commands).toEqual([]);
    }
  });

  it('an unauthenticated caller gets 401 before either refusal (RB-6)', async () => {
    const built = await fencedApp(false);
    built.actAs(ANONYMOUS);
    expect((await built.post(FAULTS, { kind: 'MIC_CLIP' })).statusCode).toBe(401);
    expect(built.database.committed.auditSeqs).toEqual([]);
  });
});
