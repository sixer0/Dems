// The two routes of the network-time module against the contract registry (plan row W37; module
// gate MODG; spec §7.12, §8.4 (Q15); AC-B-68). In-process, no database: the real app factory with
// a REAL headless simulator behind the seam `engine` (the engine double of the storage folder's
// test support, which is this row's too) and stage 4 as a stand-in. Stage 6 is the server's own.
// The same operations against PostgreSQL and the real engine host are in `network-time.db.test.ts`.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CORE_API_SCHEMAS,
  CoreApiAccessKind,
  CoreApiAuditNone,
  CoreApiTag,
  EPOCH_HEADER_NAME,
  NETWORK_TIME_EXAMPLES,
  REVISION_HEADER_NAME,
  findCoreApiOperation,
  matchCoreApiOperation,
  validateCoreApiResponse,
  type CoreApiSchemaName,
  type NetworkStatus,
  type TimeStatus,
} from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { hostedActionsOfOperation } from '../../../engine';
import { permissionGuard } from '../../../plugins/permission-guard';
import {
  ANONYMOUS,
  CLOCK_START,
  HOUR,
  PAIRED_DEVICE,
  ROLES,
  SECOND,
  bareRoutes,
  moduleApp,
  operatorOf,
  outcome,
  registryOperationsOf,
  registrySignatures,
  routeSignatures,
  type ModuleApp,
  type ModuleAppOptions,
} from '../../storage/__tests__/support';
import { NETWORK_TIME_MODULE_OPERATIONS, networkTimeModule } from '../index';

const NETWORK = '/api/v1/network/status';
const TIME = '/api/v1/time/status';

const scratchDir = mkdtempSync(join(tmpdir(), 'dems-w37-network-time-'));
const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

async function build(options: ModuleAppOptions = {}): Promise<ModuleApp> {
  const built = await moduleApp(options);
  apps.push(built.app);
  return built;
}

const network = async (built: ModuleApp): Promise<NetworkStatus> => (await built.app.inject({ method: 'GET', url: NETWORK })).json() as NetworkStatus;
const time = async (built: ModuleApp): Promise<TimeStatus> => (await built.app.inject({ method: 'GET', url: TIME })).json() as TimeStatus;

/** Every instant an answer of the two reads holds. */
function instantsOf(answers: { network: NetworkStatus; time: TimeStatus }): number[] {
  return [
    answers.network.tabletLink.changedAt,
    ...answers.network.network.bandwidth.history.map((point) => point.at),
    answers.time.time.lastSyncAt,
    ...answers.time.time.history.map((point) => point.at),
  ];
}

describe('MODG: the route list of the network-time module equals its registry operations', () => {
  it('registers exactly the two operations of the registry tag Network, each with the method, the path and the operation ID of the registry', async () => {
    const fromModule = routeSignatures(await bareRoutes(networkTimeModule));
    const fromRegistry = registrySignatures(CoreApiTag.NETWORK);
    console.info(`[w37] MODG routes of src/modules/network-time: ${fromModule.join(' | ')}`);
    console.info(`[w37] MODG registry, tag Network (56-57):      ${fromRegistry.join(' | ')}`);
    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual(['GET /api/v1/network/status getNetworkStatus', 'GET /api/v1/time/status getTimeStatus']);
    expect(registryOperationsOf(CoreApiTag.NETWORK).map((operation) => operation.operationId)).toEqual([...NETWORK_TIME_MODULE_OPERATIONS]);
  });

  it('in the real app: the same two routes, nothing else under /api/v1/network or /api/v1/time, and each matches its registry entry', async () => {
    const { registered } = await build();
    const own = registered.filter((route) => (NETWORK_TIME_MODULE_OPERATIONS as readonly string[]).includes(String(route.config?.operationId)));
    expect(routeSignatures(own)).toEqual(registrySignatures(CoreApiTag.NETWORK));
    expect(routeSignatures(registered.filter((route) => route.url.startsWith('/api/v1/network') || route.url.startsWith('/api/v1/time')))).toEqual(routeSignatures(own));
    for (const route of own) expect(matchCoreApiOperation(String(route.method), route.url)?.operation.operationId).toBe(route.config?.operationId);
  });

  it('the operations are 56 and 57 of the specification, both reads: the area has no command', () => {
    const operations = NETWORK_TIME_MODULE_OPERATIONS.map((operationId) => findCoreApiOperation(operationId));
    expect(operations.map((operation) => Number(/operation (\d+)/.exec(operation?.source ?? '')?.[1]))).toEqual([56, 57]);
    expect(operations.map((operation) => operation?.method)).toEqual(['get', 'get']);
    expect(operations.map((operation) => operation?.audit)).toEqual(Array(2).fill({ success: CoreApiAuditNone.READ, denial: 'ACCESS_DENIED' }));
    expect(operations.some((operation) => operation !== undefined && 'requestBody' in operation)).toBe(false);
    // No simulator action stands behind either: nothing here can change the state.
    expect(NETWORK_TIME_MODULE_OPERATIONS.flatMap((operationId) => hostedActionsOfOperation(operationId))).toEqual([]);
  });

  it('the 200 schema of each route is the registry\'s own object; no route has a body, a query or a path parameter', async () => {
    const named = (name: CoreApiSchemaName | undefined): unknown => (name === undefined ? undefined : CORE_API_SCHEMAS[name]);
    for (const route of await bareRoutes(networkTimeModule)) {
      const operation = findCoreApiOperation(String(route.config?.operationId));
      const schema = route.schema as { body?: unknown; querystring?: unknown; params?: unknown; response?: Record<number, unknown> } | undefined;
      expect(schema?.response?.[200], operation?.operationId).toBe(named(operation?.responses[200]?.schema));
      expect(Object.keys(schema?.response ?? {})).toEqual(['200']);
      expect([schema?.body, schema?.querystring, schema?.params]).toEqual([undefined, undefined, undefined]);
    }
  });

  it('no route carries a hook or a rule of its own: the route configuration is the operation ID and nothing else', async () => {
    for (const route of await bareRoutes(networkTimeModule)) {
      expect(route.config).toEqual({ operationId: route.config?.operationId });
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onResponse', 'onError'] as const) {
        expect(route[hook], `${String(route.config?.operationId)} ${hook}`).toBeUndefined();
      }
    }
  });

  it('the rules stage 6 applies to the two routes are the registry\'s: AUTHENTICATED, no permission', async () => {
    const { app } = await build();
    const rules = permissionGuard(app)
      .registeredRules()
      .filter((rule) => (NETWORK_TIME_MODULE_OPERATIONS as readonly string[]).includes(rule.operationId));
    expect(rules.map((rule) => [rule.operationId, rule.method, rule.url, rule.kind, rule.permissions, rule.denial])).toEqual([
      ['getNetworkStatus', 'GET', NETWORK, CoreApiAccessKind.AUTHENTICATED, [], null],
      ['getTimeStatus', 'GET', TIME, CoreApiAccessKind.AUTHENTICATED, [], null],
    ]);
    expect(permissionGuard(app).routeProblems()).toEqual([]);
  });
});

describe('operation 56 getNetworkStatus', () => {
  it.each(ROLES)('%s reads the two slices in their wire form: 200, valid against the contract, equal to the committed state', async (role) => {
    const built = await build();
    built.actAs(operatorOf(role));
    const response = await built.app.inject({ method: 'GET', url: NETWORK });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(validateCoreApiResponse('getNetworkStatus', 200, body)).toEqual({ ok: true });
    const state = built.engine.sim.store.getState();
    expect(Object.keys(body)).toEqual(['network', 'tabletLink']);
    expect(body).toEqual(JSON.parse(JSON.stringify({ network: state.network, tabletLink: state.tabletLink })));
    // Both slices from ONE committed state; a read: no command, no state revision header, no cookie.
    expect(built.engine.reads).toEqual({ state: 1, slices: [] });
    expect(built.engine.commands).toEqual([]);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('the answer has the members of the contract example, slice by slice', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const body = await network(built);
    const example = NETWORK_TIME_EXAMPLES['getNetworkStatus']?.responses?.[200]?.['linked']?.value as NetworkStatus;
    expect(Object.keys(body.network).sort()).toEqual(Object.keys(example.network).sort());
    expect(Object.keys(body.tabletLink).sort()).toEqual(Object.keys(example.tabletLink).sort());
    expect(body.network.domains.map((domain) => domain.id)).toEqual(example.network.domains.map((domain) => domain.id));
  });

  it('the tablet link is the engine\'s slice: what the server set from real connections is what a client reads, stamped by the clock', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    const before = (await network(built)).tabletLink;
    built.clock.advance(42_000);
    // What `app.engine.setTabletLink` runs inside its unit: the hosted, internal action (X-2).
    built.engine.sim.actions.setTabletLink(before.state === 'CONNECTED' ? 'OFFLINE' : 'CONNECTED');
    const after = (await network(built)).tabletLink;
    expect(after).toEqual({ state: before.state === 'CONNECTED' ? 'OFFLINE' : 'CONNECTED', changedAt: CLOCK_START + 42_000 });
  });

  it('whatever the committed slice holds is answered: a link that is down, with no speed', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    const state = built.engine.sim.store.getState();
    // The double's committed state, set directly: the area has no fault of its own in the simulator today.
    built.engine.sim.store.setState({ network: { ...state.network, linkUp: false, linkSpeedMbps: 0 } });
    const body = await network(built);
    expect(validateCoreApiResponse('getNetworkStatus', 200, body)).toEqual({ ok: true });
    expect([body.network.linkUp, body.network.linkSpeedMbps]).toEqual([false, 0]);
    expect(body.network).toEqual(JSON.parse(JSON.stringify(built.engine.sim.store.getState().network)));
  });
});

describe('operation 57 getTimeStatus', () => {
  it.each(ROLES)('%s reads the slice under its name: 200, valid against the contract, equal to the committed state', async (role) => {
    const built = await build();
    built.actAs(operatorOf(role));
    const response = await built.app.inject({ method: 'GET', url: TIME });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(validateCoreApiResponse('getTimeStatus', 200, body)).toEqual({ ok: true });
    expect(Object.keys(body)).toEqual(['time']);
    expect(body).toEqual(JSON.parse(JSON.stringify({ time: built.engine.sim.store.getState().time })));
    expect(built.engine.reads).toEqual({ state: 0, slices: ['time'] });
    expect(built.engine.commands).toEqual([]);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('the answer has the members of the contract example and no time of the server itself', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const body = await time(built);
    const example = NETWORK_TIME_EXAMPLES['getTimeStatus']?.responses?.[200]?.['gnss']?.value as TimeStatus;
    expect(Object.keys(body.time).sort()).toEqual(Object.keys(example.time).sort());
    expect(body.time).toMatchObject({ source: 'GNSS', locked: true, stratum: 1 });
    // The slice is the time service of the Core DEVICE. The server clock is not a member of it.
    expect(Object.keys(body.time)).not.toContain('serverTime');
    expect(Object.keys(body.time)).not.toContain('now');
  });

  it('a lost time source is answered as the slice has it (the demo fault GNSS_LOSS: NTP, then RTC holdover)', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.sim.actions.inject('GNSS_LOSS');
    const onNtp = await time(built);
    expect(validateCoreApiResponse('getTimeStatus', 200, onNtp)).toEqual({ ok: true });
    expect(onNtp.time).toMatchObject({ source: 'NTP', gnss: { locked: false } });
    built.engine.sim.actions.inject('GNSS_LOSS', { fallback: 'RTC' });
    const onRtc = await time(built);
    expect(validateCoreApiResponse('getTimeStatus', 200, onRtc)).toEqual({ ok: true });
    expect(onRtc.time).toMatchObject({ source: 'RTC', gnss: { locked: false } });
    expect(onRtc.time).toEqual(JSON.parse(JSON.stringify(built.engine.sim.store.getState().time)));
  });
});

describe('Q15, ENG-13: every instant of the two reads follows the injected clock', () => {
  it('second by second: the newest point of each history is the clock\'s second, and no instant lies outside the window of the manual clock', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    // The double's simulator built its dataset at the manual clock's start: its oldest point is a day before it.
    const oldest = CLOCK_START - 2 * 24 * HOUR;
    // The test's own guard: this machine's clock stands outside that window.
    expect(Date.now()).toBeLessThan(oldest);

    for (let second = 1; second <= 20; second += 1) {
      built.clock.advance(SECOND);
      built.engine.tick();
      const now = built.clock.now();
      const answers = { network: await network(built), time: await time(built) };
      expect(answers.network.network.bandwidth.history.at(-1)?.at).toBe(now);
      expect(answers.time.time.history.at(-1)?.at).toBeLessThanOrEqual(now);
      expect(answers.time.time.lastSyncAt).toBeLessThanOrEqual(now);
      expect(instantsOf(answers).filter((at) => at < oldest || at > now)).toEqual([]);
    }
    // Within 20 s the time service synchronised (every 16 s) and logged a point: both at the clock.
    const answers = { network: await network(built), time: await time(built) };
    expect(answers.time.time.lastSyncAt).toBeGreaterThan(CLOCK_START);
    expect(answers.time.time.history.at(-1)?.at).toBeGreaterThan(CLOCK_START);
  });

  it('a jump of the clock is followed at the next step: three hours ahead, then every new instant is there', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    built.clock.advance(SECOND);
    built.engine.tick();
    const before = { network: await network(built), time: await time(built) };

    built.clock.advance(3 * HOUR);
    built.engine.tick();
    const now = built.clock.now();
    expect(now).toBe(CLOCK_START + SECOND + 3 * HOUR);
    const after = { network: await network(built), time: await time(built) };
    expect(after.network.network.bandwidth.history.at(-1)?.at).toBe(now);
    expect(after.time.time.history.at(-1)?.at).toBe(now);
    expect(after.time.time.lastSyncAt).toBe(now);
    // What was stamped before the jump kept its instant.
    expect(after.network.network.bandwidth.history.at(-2)?.at).toBe(before.network.network.bandwidth.history.at(-1)?.at);
    expect(after.network.tabletLink.changedAt).toBe(before.network.tabletLink.changedAt);
  });

  it('a clock that stands still gives the same answers, however much real time passes between two reads', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.clock.advance(5 * SECOND);
    built.engine.tick();
    const first = { network: await network(built), time: await time(built) };
    await new Promise((resolve) => setTimeout(resolve, 30));
    built.engine.tick();
    expect({ network: await network(built), time: await time(built) }).toEqual(first);
  });
});

describe('who may call is stage 6\'s, from the registry', () => {
  it.each([
    ['nobody', ANONYMOUS],
    ['a paired device without an operator', PAIRED_DEVICE],
  ])('%s: 401 NOT_SIGNED_IN on both operations, no row, the engine untouched', async (_label, principal) => {
    const built = await build();
    built.actAs(principal);
    for (const [operationId, url] of [
      ['getNetworkStatus', NETWORK],
      ['getTimeStatus', TIME],
    ] as const) {
      const response = await built.app.inject({ method: 'GET', url });
      expect([operationId, ...outcome(response)]).toEqual([operationId, 401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(operationId, 401, response.json())).toEqual({ ok: true });
    }
    expect(built.database.committed.auditSeqs).toEqual([]);
    expect(built.engine.reads).toEqual({ state: 0, slices: [] });
  });

  it('an operator on a paired device reads both', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR', 'DEV-0001'));
    expect((await built.app.inject({ method: 'GET', url: NETWORK })).statusCode).toBe(200);
    expect((await built.app.inject({ method: 'GET', url: TIME })).statusCode).toBe(200);
    expect(built.database.committed.auditSeqs).toEqual([]);
  });
});

describe('the answers that are not this module\'s own', () => {
  it('405 with `allow: GET` for a POST on either path: the area has no command', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    for (const url of [NETWORK, TIME]) {
      const response = await built.app.inject({ method: 'POST', url, headers: { origin: 'http://127.0.0.1:5173' }, payload: { linkUp: false, offsetMs: 0 } });
      expect([url, ...outcome(response)]).toEqual([url, 405, 'METHOD_NOT_ALLOWED']);
      expect(response.headers['allow']).toBe('GET');
    }
    expect(built.engine.commands).toEqual([]);
  });

  it('nothing a client sends changes an answer: a query string and headers that name a time are not read', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const plain = { network: await network(built), time: await time(built) };
    const headers = { 'x-dems-time': '1', date: 'Thu, 01 Jan 1970 00:00:00 GMT', 'x-forwarded-for': '10.0.0.9' };
    const withInput = {
      network: (await built.app.inject({ method: 'GET', url: `${NETWORK}?at=1&ip=10.0.0.9`, headers })).json() as NetworkStatus,
      time: (await built.app.inject({ method: 'GET', url: `${TIME}?now=1&source=RTC`, headers })).json() as TimeStatus,
    };
    expect(withInput).toEqual(plain);
  });

  it('503 NOT_READY from the readiness stage while the engine is not ready, and from the host itself when it has stopped', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.app.readiness.set('engine', false);
    for (const [operationId, url] of [
      ['getNetworkStatus', NETWORK],
      ['getTimeStatus', TIME],
    ] as const) {
      const response = await built.app.inject({ method: 'GET', url });
      expect([operationId, ...outcome(response)]).toEqual([operationId, 503, 'NOT_READY']);
      expect(validateCoreApiResponse(operationId, 503, response.json())).toEqual({ ok: true });
    }
    expect(built.engine.reads).toEqual({ state: 0, slices: [] });

    built.app.readiness.set('engine', true);
    built.engine.running = false;
    expect(outcome(await built.app.inject({ method: 'GET', url: NETWORK }))).toEqual([503, 'NOT_READY']);
    expect(outcome(await built.app.inject({ method: 'GET', url: TIME }))).toEqual([503, 'NOT_READY']);
  });

  it('an unexpected failure answers 500 INTERNAL_ERROR with no detail, and is in the log and in the persistent error log by its name', async () => {
    const errorLogFile = join(scratchDir, 'errors.log');
    const built = await build({ errorLogFile });
    built.actAs(operatorOf('TECHNICIAN'));
    const marker = 'MARK-w37-network-time-detail';
    for (const [operationId, url] of [
      ['getNetworkStatus', NETWORK],
      ['getTimeStatus', TIME],
    ] as const) {
      built.engine.failNext(Object.assign(new RangeError(`broken ${marker}`), { code: 'W37_TEST' }));
      const response = await built.app.inject({ method: 'GET', url });
      expect([operationId, ...outcome(response)]).toEqual([operationId, 500, 'INTERNAL_ERROR']);
      expect(response.body).not.toContain(marker);
      expect(validateCoreApiResponse(operationId, 500, response.json())).toEqual({ ok: true });
    }
    expect(built.log.lines().filter((line) => line['msg'] === 'unexpected error while handling a request')).toHaveLength(2);
    await built.app.close();
    const persisted = readFileSync(errorLogFile, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(persisted).toHaveLength(2);
    expect(persisted.every((entry) => entry['level'] === 'error' && entry['errorName'] === 'RangeError')).toBe(true);
  });

  it('a slice that does not fit the contract never leaves the server: the response schema refuses the answer (500)', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const state = built.engine.sim.store.getState();
    built.engine.sim.store.setState({ time: { ...state.time, source: 'SUNDIAL' as never }, tabletLink: { ...state.tabletLink, secret: 'MARK-w37-extra' } as never });
    const timeAnswer = await built.app.inject({ method: 'GET', url: TIME });
    expect(outcome(timeAnswer)).toEqual([500, 'INTERNAL_ERROR']);
    expect(timeAnswer.body).not.toContain('SUNDIAL');
    const networkAnswer = await built.app.inject({ method: 'GET', url: NETWORK });
    expect(outcome(networkAnswer)).toEqual([500, 'INTERNAL_ERROR']);
    expect(networkAnswer.body).not.toContain('MARK-w37-extra');
  });
});
