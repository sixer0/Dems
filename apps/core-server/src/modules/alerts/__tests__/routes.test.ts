// The two routes of the alerts module against the contract registry (plan row W40; module gate
// MODG; spec §7.2, §7.3, §7.15, §7.17 member 29, §13.2; AC-B-71; SR-82, AC-B-89). In-process, no
// database: the real app factory with a REAL headless simulator behind the seam `engine` (the
// engine double of `../../system/__tests__/support.ts`) and stage 4 as a stand-in. Stage 6 (the
// access rule) and stage 7 (parsing, validation) are the server's own. The same operations
// against PostgreSQL and the real engine host are in `alerts.db.test.ts`.
//
// Alerts are raised here by the simulator's own `inject`, called on the double's simulator: the
// demo-control routes are another row's.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ALERT_ID_PATTERN,
  CORE_API_SCHEMAS,
  CoreApiAccessKind,
  CoreApiAuditNone,
  CoreApiTag,
  EPOCH_HEADER_NAME,
  REVISION_HEADER_NAME,
  SIM_ACTION_OPERATIONS,
  findCoreApiOperation,
  matchCoreApiOperation,
  validateCoreApiResponse,
} from '@dems/shared/api';
import { ALERT_RING_SIZE, FaultKind, type FaultTarget, type SimAlert } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { hostedActionsOfOperation } from '../../../engine';
import { ApiFailure } from '../../../plugins/error-envelope';
import { permissionGuard } from '../../../plugins/permission-guard';
import {
  ALERTS,
  ANONYMOUS,
  PAIRED_DEVICE,
  ROLES,
  acknowledge,
  bareRoutes,
  bodyOf,
  errorOf,
  linesWith,
  memberNames,
  moduleApp,
  operatorOf,
  outcome,
  ownMembers,
  post,
  registryOperationsOf,
  registrySignatures,
  routeSignatures,
  seeded,
  stringValues,
  type ModuleApp,
  type ModuleAppOptions,
} from '../../system/__tests__/support';
import { ACKNOWLEDGE_ACTION, ACKNOWLEDGE_UNIT_LABEL, ALERTS_MODULE_OPERATIONS, ALERT_ACKNOWLEDGED_MESSAGE, alertsModule } from '../index';

const scratchDir = mkdtempSync(join(tmpdir(), 'dems-w40-alerts-'));
const apps: FastifyInstance[] = [];
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));
/** How many lines the log held when the app was handed to the test: the lines of the start-up are not a call's. */
const linesAtBuild = new WeakMap<ModuleApp, number>();

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

async function build(options: ModuleAppOptions = {}): Promise<ModuleApp> {
  const built = await moduleApp(options);
  apps.push(built.app);
  linesAtBuild.set(built, built.log.lines().length);
  return built;
}

/** The lines written since the app was built that are not the logger's own line of a request. */
const moduleLines = (built: ModuleApp) =>
  built.log
    .lines()
    .slice(linesAtBuild.get(built) ?? 0)
    .filter((line) => line['msg'] !== 'request completed');

const state = (built: ModuleApp) => built.engine.state();
const alertsOf = (built: ModuleApp): SimAlert[] => state(built).alerts;
const wire = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;
const acknowledgementLines = (built: ModuleApp) => linesWith(built.log, ALERT_ACKNOWLEDGED_MESSAGE);

/** Raises an alert: the simulator's own fault injection, one clock second after the last. */
function raise(built: ModuleApp, kind: FaultKind, target?: FaultTarget): SimAlert {
  built.clock.advance(1_000);
  built.engine.sim.actions.inject(kind, target);
  const alert = alertsOf(built).at(-1);
  if (alert === undefined) throw new Error(`injecting ${kind} raised no alert`);
  return alert;
}

/** Every fault kind with a target that raises an alert on the idle Core. */
const FAULTS: ReadonlyArray<readonly [FaultKind, FaultTarget | undefined]> = [
  [FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-02' }],
  [FaultKind.MIC_NO_SIGNAL, { channel: 'AUDIO-02' }],
  [FaultKind.MIC_CLIP, { channel: 'AUDIO-01' }],
  [FaultKind.STORAGE_LOW, undefined],
  [FaultKind.STORAGE_FULL, undefined],
  [FaultKind.GNSS_LOSS, { fallback: 'RTC' }],
  [FaultKind.TAMPER, undefined],
  [FaultKind.FAN_STALL, undefined],
  [FaultKind.POWER_FAIL, undefined],
  [FaultKind.TPM_FAILURE, undefined],
  [FaultKind.SECURITY_FAULT, undefined],
  [FaultKind.AUDIT_TAMPER, undefined],
];

describe('MODG: the route list of the alerts module equals its registry operations', () => {
  it('registers exactly the two operations of the registry tag Alerts, each with the method, the path and the operation ID of the registry', async () => {
    const fromModule = routeSignatures(await bareRoutes(alertsModule));
    const fromRegistry = registrySignatures(CoreApiTag.ALERTS);
    console.info(`[w40] MODG routes of src/modules/alerts:   ${fromModule.join(' | ')}`);
    console.info(`[w40] MODG registry, tag Alerts (69-70):   ${fromRegistry.join(' | ')}`);
    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual(['GET /api/v1/alerts listAlerts', 'POST /api/v1/alerts/:id/acknowledge acknowledgeAlert']);
    expect(registryOperationsOf(CoreApiTag.ALERTS).map((operation) => operation.operationId)).toEqual([...ALERTS_MODULE_OPERATIONS]);
    expect(registryOperationsOf(CoreApiTag.ALERTS).map((operation) => operation.path)).toEqual(['/api/v1/alerts', '/api/v1/alerts/{id}/acknowledge']);
  });

  it('in the real app: the same two routes, nothing else under /api/v1/alerts, and each matches its registry entry', async () => {
    const { registered } = await build();
    const own = registered.filter((route) => (ALERTS_MODULE_OPERATIONS as readonly string[]).includes(String(route.config?.operationId)));
    expect(routeSignatures(own)).toEqual(registrySignatures(CoreApiTag.ALERTS));
    expect(routeSignatures(registered.filter((route) => route.url.startsWith('/api/v1/alerts')))).toEqual(routeSignatures(own));
    expect(matchCoreApiOperation('GET', ALERTS)?.operation.operationId).toBe('listAlerts');
    expect(matchCoreApiOperation('POST', acknowledge('ALR-000001'))).toMatchObject({ operation: { operationId: 'acknowledgeAlert' }, params: { id: 'ALR-000001' } });
  });

  it('the operations are 69 and 70 of the specification', () => {
    const numbers = ALERTS_MODULE_OPERATIONS.map((operationId) => Number(/operation (\d+)/.exec(findCoreApiOperation(operationId)?.source ?? '')?.[1]));
    expect(numbers).toEqual([69, 70]);
  });

  it('the schemas are the registry\'s: the 200 answer of 69 is its own object; 70 has no body in either direction and its `{id}` is held to the registry\'s pattern', async () => {
    const [list, acknowledgement] = await bareRoutes(alertsModule);
    const listSchema = list?.schema as { body?: unknown; params?: unknown; querystring?: unknown; response?: Record<number, unknown> } | undefined;
    expect(listSchema?.response?.[200]).toBe(CORE_API_SCHEMAS.AlertList);
    expect(Object.keys(listSchema?.response ?? {})).toEqual(['200']);
    expect([listSchema?.body, listSchema?.params, listSchema?.querystring]).toEqual([undefined, undefined, undefined]);

    const operation = findCoreApiOperation('acknowledgeAlert');
    expect(operation?.pathParam).toMatchObject({ name: 'id', pattern: ALERT_ID_PATTERN });
    expect(operation?.requestBody).toBeUndefined();
    expect(operation?.responses[204]?.schema).toBeUndefined();
    const schema = acknowledgement?.schema as { body?: unknown; params?: { safeParse(value: unknown): { success: boolean } }; response?: unknown } | undefined;
    expect([schema?.body, schema?.response]).toEqual([undefined, undefined]);
    for (const [id, accepted] of [
      ['ALR-000001', true],
      ['ALR-1234567', true],
      ['ALR-00001', false],
      ['alr-000001', false],
      ['ALR-000001 ', false],
      ['DIAG-000001', false],
      ['', false],
    ] as const) {
      expect(schema?.params?.safeParse({ id }).success, JSON.stringify(id)).toBe(accepted);
      expect(ALERT_ID_PATTERN.test(id), JSON.stringify(id)).toBe(accepted);
    }
  });

  it('no route carries a hook or a rule of its own: the route configuration is the operation ID and nothing else', async () => {
    for (const route of await bareRoutes(alertsModule)) {
      expect(route.config).toEqual({ operationId: route.config?.operationId });
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onResponse', 'onError'] as const) {
        expect(route[hook], `${String(route.config?.operationId)} ${hook}`).toBeUndefined();
      }
    }
  });

  it('the rules stage 6 applies to the two routes are the registry\'s: both AUTHENTICATED; a read, and a command without an audit row', async () => {
    const { app } = await build();
    const rules = permissionGuard(app)
      .registeredRules()
      .filter((rule) => (ALERTS_MODULE_OPERATIONS as readonly string[]).includes(rule.operationId));
    expect(rules.map((rule) => [rule.operationId, rule.method, rule.url, rule.kind, rule.permissions])).toEqual([
      ['listAlerts', 'GET', ALERTS, CoreApiAccessKind.AUTHENTICATED, []],
      ['acknowledgeAlert', 'POST', '/api/v1/alerts/:id/acknowledge', CoreApiAccessKind.AUTHENTICATED, []],
    ]);
    expect(permissionGuard(app).routeProblems()).toEqual([]);
    expect(ALERTS_MODULE_OPERATIONS.map((operationId) => findCoreApiOperation(operationId)?.audit.success)).toEqual([CoreApiAuditNone.READ, CoreApiAuditNone.PARITY]);
  });

  it('spec §7.17 member 29: operation 70 runs the one hosted action the contract maps to it; the read stands for none', () => {
    expect(hostedActionsOfOperation('acknowledgeAlert')).toEqual([ACKNOWLEDGE_ACTION]);
    expect(SIM_ACTION_OPERATIONS[ACKNOWLEDGE_ACTION]).toEqual({ operations: ['acknowledgeAlert'], execution: 'hosted' });
    expect(hostedActionsOfOperation('listAlerts')).toEqual([]);
  });
});

describe('69 listAlerts', () => {
  it('the idle Core has no alert: 200 with an empty list under the slice name', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    const response = await built.app.inject({ method: 'GET', url: ALERTS });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ alerts: [] });
    expect(validateCoreApiResponse('listAlerts', 200, response.json())).toEqual({ ok: true });
  });

  it.each(ROLES)('%s reads the `alerts` slice of the committed state in its wire form: active and resolved, acknowledged or not, oldest first', async (role) => {
    const built = await build();
    const first = raise(built, FaultKind.MIC_NO_SIGNAL, { channel: 'AUDIO-02' });
    const second = raise(built, FaultKind.FAN_STALL);
    raise(built, FaultKind.STORAGE_LOW);
    built.clock.advance(1_000);
    built.engine.sim.actions.clearFault(FaultKind.FAN_STALL);
    built.engine.sim.actions.acknowledgeAlert(first.id);
    built.actAs(operatorOf(role));
    const response = await built.app.inject({ method: 'GET', url: ALERTS });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ alerts: wire(alertsOf(built)) });
    expect(validateCoreApiResponse('listAlerts', 200, response.json())).toEqual({ ok: true });
    const listed = (response.json() as { alerts: SimAlert[] }).alerts;
    expect(listed.map((alert) => [alert.id, alert.kind, alert.active, alert.acknowledged, alert.resolvedAt === null])).toEqual([
      [first.id, 'MIC_NO_SIGNAL', true, true, true],
      [second.id, 'FAN_STALL', false, false, false],
      [listed[2]?.id, 'STORAGE_LOW', true, false, true],
    ]);
    expect(listed.map((alert) => alert.at)).toEqual(listed.map((alert) => alert.at).toSorted((a, b) => a - b));
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
  });

  it('reads the one slice ONCE, opens no unit of work and changes nothing', async () => {
    const built = await build();
    raise(built, FaultKind.FAN_STALL);
    built.actAs(operatorOf('SUPERVISOR'));
    const before = state(built);
    expect((await built.app.inject({ method: 'GET', url: ALERTS })).statusCode).toBe(200);
    expect(built.engine.reads).toEqual({ state: 0, slices: ['alerts'] });
    expect(built.engine.units).toEqual([]);
    expect(state(built)).toBe(before);
    expect(moduleLines(built)).toEqual([]);
  });

  it('AC-B-71 on the simulator: every alert of the list was raised by a fault, and the row that fault wrote names the alert\'s kind, target, instant, severity and text', async () => {
    const built = await build();
    const faultRows = (): number => state(built).audit.rows.filter((row) => row.type === 'FAULT_RAISED').length;
    // The dataset's own history holds FAULT_RAISED rows of earlier days: counted from here.
    const faultRowsBefore = faultRows();
    // The row each injection appended, taken at once: a later AUDIT_TAMPER alters one ring row by design.
    const rowOf = new Map<string, ReturnType<typeof state>['audit']['rows'][number] | undefined>();
    for (const [kind, target] of FAULTS) {
      const total = state(built).audit.total;
      const alert = raise(built, kind, target);
      expect(state(built).audit.total, kind).toBe(total + 1);
      rowOf.set(alert.id, state(built).audit.rows.at(-1));
    }
    built.actAs(operatorOf('TECHNICIAN'));
    const listed = ((await built.app.inject({ method: 'GET', url: ALERTS })).json() as { alerts: SimAlert[] }).alerts;
    expect(listed.map((alert) => alert.kind)).toEqual(FAULTS.map(([kind]) => kind));
    for (const alert of listed) {
      const row = rowOf.get(alert.id);
      if (alert.kind === 'AUDIT_TAMPER') {
        // The one kind whose row is not FAULT_RAISED (spec §7.16, operation 73).
        expect(row).toMatchObject({ type: 'AUDIT_CHAIN_DISCONTINUITY', at: alert.at, message: alert.message, severity: alert.severity, details: { kind: alert.kind } });
        expect(alert.target).toBe(`seq:${String(row?.details['seq'])}`);
      } else {
        expect(row, alert.kind).toMatchObject({ type: 'FAULT_RAISED', at: alert.at, message: alert.message, severity: alert.severity, details: { kind: alert.kind, target: alert.target ?? null } });
      }
    }
    expect(faultRows() - faultRowsBefore).toBe(FAULTS.length - 1);
  });

  it(`the slice is a ring of ${ALERT_RING_SIZE}: after ${ALERT_RING_SIZE + 3} raised alerts the list holds the newest ${ALERT_RING_SIZE}`, async () => {
    const built = await build();
    const raised: string[] = [];
    for (let index = 0; index < ALERT_RING_SIZE + 3; index += 1) {
      raised.push(raise(built, FaultKind.FAN_STALL).id);
      built.engine.sim.actions.clearFault(FaultKind.FAN_STALL);
    }
    built.actAs(operatorOf('INVESTIGATOR'));
    const response = await built.app.inject({ method: 'GET', url: ALERTS });
    const listed = (response.json() as { alerts: SimAlert[] }).alerts;
    expect(listed).toHaveLength(ALERT_RING_SIZE);
    expect(listed.map((alert) => alert.id)).toEqual(raised.slice(3));
    expect(validateCoreApiResponse('listAlerts', 200, response.json())).toEqual({ ok: true });
  });

  it('nobody without a session reads the alerts: 401 NOT_SIGNED_IN', async () => {
    const built = await build();
    for (const caller of [ANONYMOUS, PAIRED_DEVICE]) {
      built.actAs(caller);
      const response = await built.app.inject({ method: 'GET', url: ALERTS });
      expect(outcome(response), caller.kind).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse('listAlerts', 401, response.json())).toEqual({ ok: true });
    }
    expect(built.engine.reads.slices).toEqual([]);
  });

  it('an engine that is not running: 503 NOT_READY', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.running = false;
    const response = await built.app.inject({ method: 'GET', url: ALERTS });
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(validateCoreApiResponse('listAlerts', 503, response.json())).toEqual({ ok: true });
  });
});

describe('70 acknowledgeAlert', () => {
  it.each(ROLES)('%s acknowledges an alert: 204 without a body, with the epoch and the revision of the unit; that alert is acknowledged and nothing else moved', async (role) => {
    const built = await build();
    const other = raise(built, FaultKind.STORAGE_LOW);
    const alert = raise(built, FaultKind.MIC_NO_SIGNAL, { channel: 'AUDIO-01' });
    built.actAs(operatorOf(role));
    const before = state(built);
    const response = await post(built.app, acknowledge(alert.id));
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(validateCoreApiResponse('acknowledgeAlert', 204, bodyOf(response))).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(built.engine.position.epoch));
    expect(response.headers[REVISION_HEADER_NAME]).toBe('41');
    expect(alertsOf(built)).toEqual([other, { ...alert, acknowledged: true }]);
    // As the simulator: the fault behind the alert is not cleared, and no other slice changed.
    expect(state(built).faults).toBe(before.faults);
    expect(state(built).audit).toBe(before.audit);
    expect(state(built).events).toBe(before.events);
    expect(state(built).mics).toBe(before.mics);
  });

  it('one unit of work with ONE hosted action: the caller as it is, and the `{id}` of the path as its one argument', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.FAN_STALL);
    const caller = operatorOf('SUPERVISOR');
    built.actAs(caller);
    await post(built.app, acknowledge(alert.id));
    expect(built.engine.units).toEqual([{ label: ACKNOWLEDGE_UNIT_LABEL, committed: true, actions: ['acknowledgeAlert'], pendingReads: 2 }]);
    expect(built.engine.actions).toHaveLength(1);
    expect(built.engine.actions[0]?.principal).toBe(caller);
    expect(built.engine.actions[0]?.unit).toBe('alerts.acknowledgeAlert');
    expect(built.engine.actions[0]?.args).toEqual([alert.id]);
    // The answer needs no read of the committed state.
    expect(built.engine.reads).toEqual({ state: 0, slices: [] });
  });

  it('SR-82, AC-B-89: an acknowledgement writes NO audit row and EXACTLY ONE log line with the operator ID and the alert ID, and nothing else of the alert', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.MIC_NO_SIGNAL, { channel: 'AUDIO-02' });
    const caller = operatorOf('INVESTIGATOR');
    built.actAs(caller);
    const audit = state(built).audit;
    const events = state(built).events;
    const response = await post(built.app, acknowledge(alert.id));
    expect(response.statusCode).toBe(204);
    expect(state(built).audit).toBe(audit);
    expect(state(built).events).toBe(events);
    expect(built.database.committed.auditSeqs).toEqual([]);

    const lines = acknowledgementLines(built);
    expect(lines).toHaveLength(1);
    const line = lines[0] ?? {};
    expect(ownMembers(line)).toEqual({ operatorId: caller.operatorId, alertId: alert.id });
    expect(line['level']).toBe(30);
    const requestLine = built.log.lines().find((entry) => entry['msg'] === 'request completed');
    expect(line['reqId']).toBeDefined();
    expect(line['reqId']).toBe(requestLine?.['reqId']);
    console.info(`[w40] the log line of acknowledgeAlert: ${JSON.stringify({ ...line, time: '<time>', pid: '<pid>', hostname: '<host>', reqId: '<request id>' })}`);

    // Nothing else of the alert is in the captured log: not its text, its kind, its target or its severity.
    const sinceBuild = moduleLines(built);
    expect(sinceBuild).toEqual(lines);
    const everyLine = built.log.lines();
    for (const member of ['message', 'kind', 'severity', 'target', 'params', 'alert', 'alerts', 'acknowledged', 'active']) expect([...memberNames(everyLine)], member).not.toContain(member);
    const values = everyLine.flatMap((entry) => stringValues(entry));
    expect(values).not.toContain(alert.message);
    expect(values).not.toContain(alert.kind);
    expect(built.log.text()).not.toContain('no signal');
  });

  it('a second acknowledgement of the same alert: 204, nothing changes, the same revision, and NO second line', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.FAN_STALL);
    built.actAs(operatorOf('INVESTIGATOR'));
    const first = await post(built.app, acknowledge(alert.id));
    const before = state(built);
    built.actAs(operatorOf('SUPERVISOR'));
    const second = await post(built.app, acknowledge(alert.id));
    expect(second.statusCode).toBe(204);
    expect(second.headers[REVISION_HEADER_NAME]).toBe(first.headers[REVISION_HEADER_NAME]);
    expect(alertsOf(built)).toBe(before.alerts);
    expect(acknowledgementLines(built).map(ownMembers)).toEqual([{ operatorId: seeded('INVESTIGATOR').id, alertId: alert.id }]);
    expect(built.engine.units.map((unit) => unit.committed)).toEqual([true, true]);
  });

  it('an alert the Core does not have: 204 as the simulator answers, nothing changes, no line', async () => {
    const built = await build();
    raise(built, FaultKind.FAN_STALL);
    built.actAs(operatorOf('TECHNICIAN'));
    const before = state(built);
    const response = await post(built.app, acknowledge('ALR-999999'));
    expect(response.statusCode).toBe(204);
    expect(validateCoreApiResponse('acknowledgeAlert', 204, bodyOf(response))).toEqual({ ok: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBe('40');
    expect(alertsOf(built)).toBe(before.alerts);
    expect(acknowledgementLines(built)).toEqual([]);
    expect(built.engine.actions.at(-1)?.args).toEqual(['ALR-999999']);
  });

  it('a resolved alert can still be acknowledged: it stays resolved and becomes acknowledged, with its line', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.STORAGE_LOW);
    built.clock.advance(1_000);
    built.engine.sim.actions.clearFault(FaultKind.STORAGE_LOW);
    built.actAs(operatorOf('SUPERVISOR'));
    expect((await post(built.app, acknowledge(alert.id))).statusCode).toBe(204);
    expect(alertsOf(built)).toEqual([{ ...alert, active: false, resolvedAt: built.clock.now(), acknowledged: true }]);
    expect(acknowledgementLines(built).map(ownMembers)).toEqual([{ operatorId: seeded('SUPERVISOR').id, alertId: alert.id }]);
  });

  it('one line per alert that became acknowledged, in order, each with its own caller', async () => {
    const built = await build();
    const raised = [raise(built, FaultKind.FAN_STALL), raise(built, FaultKind.STORAGE_LOW), raise(built, FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-01' })];
    const callers = ['TECHNICIAN', 'INVESTIGATOR', 'SUPERVISOR'] as const;
    for (const [index, alert] of raised.entries()) {
      built.actAs(operatorOf(callers[index] ?? 'TECHNICIAN'));
      expect((await post(built.app, acknowledge(alert.id))).statusCode).toBe(204);
    }
    expect(acknowledgementLines(built).map(ownMembers)).toEqual(raised.map((alert, index) => ({ operatorId: seeded(callers[index] ?? 'TECHNICIAN').id, alertId: alert.id })));
    expect(alertsOf(built).every((alert) => alert.acknowledged)).toBe(true);
  });

  it.each(['ALR-00001', 'alr-000001', 'ALR-12345x', 'DIAG-000001', 'ALR-000001%20', '%41LR-00000', 'ALR-٠٠٠٠٠١'])('an `{id}` outside the registry\'s pattern (%s): 422 INVALID_INPUT at stage 7, no unit, no line', async (id) => {
    const built = await build();
    raise(built, FaultKind.FAN_STALL);
    built.actAs(operatorOf('INVESTIGATOR'));
    const before = state(built);
    const response = await post(built.app, acknowledge(id));
    expect(outcome(response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(response).details).toMatchObject({ in: 'params' });
    expect(validateCoreApiResponse('acknowledgeAlert', 422, response.json())).toEqual({ ok: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(built.engine.units).toEqual([]);
    expect(state(built)).toBe(before);
    expect(acknowledgementLines(built)).toEqual([]);
  });

  it('takes no body: an empty JSON object is accepted, and a body that is no JSON object is still refused at stage 7 (400 INVALID_JSON)', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.FAN_STALL);
    built.actAs(operatorOf('INVESTIGATOR'));
    for (const payload of ['[1]', '{"broken": ', '"text"']) {
      const response = await post(built.app, acknowledge(alert.id), payload);
      expect(outcome(response), payload).toEqual([400, 'INVALID_JSON']);
      console.info(`[w40] acknowledgeAlert: body ${payload} answers 400 INVALID_JSON; against the contract: ${JSON.stringify(validateCoreApiResponse('acknowledgeAlert', 400, response.json()))}`);
    }
    expect(built.engine.units).toEqual([]);
    expect(alertsOf(built)[0]?.acknowledged).toBe(false);
    expect((await post(built.app, acknowledge(alert.id), {})).statusCode).toBe(204);
    expect(alertsOf(built)[0]?.acknowledged).toBe(true);
  });

  it('nobody without a session acknowledges an alert: 401 before the path is validated, no unit, no line', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.FAN_STALL);
    for (const caller of [ANONYMOUS, PAIRED_DEVICE]) {
      built.actAs(caller);
      for (const id of [alert.id, 'not-an-alert']) {
        const response = await post(built.app, acknowledge(id));
        expect(outcome(response), `${caller.kind} ${id}`).toEqual([401, 'NOT_SIGNED_IN']);
        expect(validateCoreApiResponse('acknowledgeAlert', 401, response.json())).toEqual({ ok: true });
      }
    }
    expect(built.engine.units).toEqual([]);
    expect(acknowledgementLines(built)).toEqual([]);
    expect(alertsOf(built)[0]?.acknowledged).toBe(false);
  });

  it('a unit that is not committed: 503 NOT_READY, the alert as it was, NO line', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.FAN_STALL);
    built.actAs(operatorOf('TECHNICIAN'));
    const before = state(built);
    built.engine.failNextCommit(new ApiFailure(503, 'NOT_READY', 'The server is not ready. Try again shortly.'));
    const response = await post(built.app, acknowledge(alert.id));
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(built.engine.units).toEqual([{ label: ACKNOWLEDGE_UNIT_LABEL, committed: false, actions: ['acknowledgeAlert'], pendingReads: 2 }]);
    expect(alertsOf(built)).toBe(before.alerts);
    expect(acknowledgementLines(built)).toEqual([]);
  });

  it('an engine that is not running: 503 NOT_READY, no unit, no line', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.FAN_STALL);
    built.actAs(operatorOf('TECHNICIAN'));
    built.engine.running = false;
    expect(outcome(await post(built.app, acknowledge(alert.id)))).toEqual([503, 'NOT_READY']);
    expect(built.engine.units).toEqual([]);
    expect(acknowledgementLines(built)).toEqual([]);
  });

  it('an engine that stops right after the commit: the answer is still 204 with the revision of the unit (nothing is read afterwards), and the line is in the log', async () => {
    const built = await build();
    const alert = raise(built, FaultKind.FAN_STALL);
    const caller = operatorOf('SUPERVISOR');
    built.actAs(caller);
    built.engine.stopAfterUnit = true;
    const response = await post(built.app, acknowledge(alert.id));
    expect(response.statusCode).toBe(204);
    expect(response.headers[REVISION_HEADER_NAME]).toBe('41');
    expect(built.engine.running).toBe(false);
    expect(acknowledgementLines(built).map(ownMembers)).toEqual([{ operatorId: caller.operatorId, alertId: alert.id }]);
  });
});

describe('an unexpected failure', () => {
  it('answers 500 INTERNAL_ERROR with no detail on both operations, and is in the log and in the persistent error log by its name; no line of an acknowledgement is written', async () => {
    const errorLogFile = join(scratchDir, 'errors.log');
    const built = await build({ errorLogFile });
    const alert = raise(built, FaultKind.FAN_STALL);
    built.actAs(operatorOf('SUPERVISOR'));
    const marker = 'MARK-w40-alerts';
    for (const [operationId, call] of [
      ['listAlerts', () => built.app.inject({ method: 'GET', url: ALERTS })],
      ['acknowledgeAlert', () => post(built.app, acknowledge(alert.id))],
    ] as const) {
      built.engine.failNext(Object.assign(new RangeError(`broken ${marker}`), { code: 'W40_TEST' }));
      const response = await call();
      expect([operationId, ...outcome(response)]).toEqual([operationId, 500, 'INTERNAL_ERROR']);
      expect(response.body).not.toContain(marker);
      expect(validateCoreApiResponse(operationId, 500, response.json())).toEqual({ ok: true });
      expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    }
    const lines = built.log.lines().filter((line) => line['msg'] === 'unexpected error while handling a request');
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line['level'] === 50)).toBe(true);
    expect(acknowledgementLines(built)).toEqual([]);
    expect(alertsOf(built)[0]?.acknowledged).toBe(false);
    await built.app.close();
    const persisted = readFileSync(errorLogFile, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(persisted).toHaveLength(2);
    expect(persisted.every((entry) => entry['level'] === 'error' && entry['errorName'] === 'RangeError')).toBe(true);
  });
});
