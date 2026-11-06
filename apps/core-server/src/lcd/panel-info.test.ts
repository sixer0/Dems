/**
 * Operation 114 `getPanelFirmware` (LCD bridge task): the route, its shape, and the two rules that
 * make it safe to put on a sign-in screen — it answers an ANONYMOUS caller, and a panel that is not
 * there is an empty answer rather than a failure.
 *
 * The app is the devices unit's own (`__tests__/support`): the real factory, no database, stage 4 a
 * stand-in that hands out ANONYMOUS unless the test says otherwise, stage 6 the REAL access rule.
 * The panel backend is the global `fetch` the test puts there.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelFirmwareResponseSchema, findCoreApiOperation, validateCoreApiResponse } from '@dems/shared/api';
import { unitApp, type UnitApp } from '../modules/devices/__tests__/support';
import { PANEL_INFO_CACHE_MS, createPanelFirmwareReader } from './panel-info';

const PANEL_INFO = '/api/v1/lcd/panel-info';
const STATUS_URL = 'http://127.0.0.1:8090/api/dems/status';
const BACKEND = { lcdBackendUrl: 'http://127.0.0.1:8090' };

const apps: UnitApp[] = [];

afterEach(async () => {
  for (const built of apps.splice(0)) await built.app.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The panel backend as the test describes it: every call is recorded, and none of them is the bridge's tick. */
function stubBackend(answer: () => Promise<Response>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    calls.push(String(input));
    return answer();
  }));
  return calls;
}
const json = (body: unknown, init: number | Response['status'] = 200): Promise<Response> =>
  Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: Number(init) }));

/** A live app whose bridge is configured (`null`: a Core with no panel bridge at all), with the engine stopped so no heartbeat competes with the test's own calls. */
async function appWithBackend(config: typeof BACKEND | null = BACKEND): Promise<UnitApp> {
  const built = await unitApp(undefined, config === null ? {} : config);
  apps.push(built);
  built.engine.running = false;
  return built;
}

it('registers GET /api/v1/lcd/panel-info once, as the registry entry says, and needs no permission', async () => {
  const built = await appWithBackend();
  const routes = built.registered.filter((route) => route.config?.operationId === 'getPanelFirmware');
  expect(routes.map((route) => `${String(route.method)} ${route.url}`)).toEqual(['GET /api/v1/lcd/panel-info']);

  const operation = findCoreApiOperation('getPanelFirmware');
  expect(operation).toBeDefined();
  // The rule that makes the sign-in screen possible, read from the registry rather than restated here.
  expect(operation?.access).toEqual({ kind: 'PUBLIC' });
  expect(operation?.audit).toMatchObject({ success: 'NONE-R' });
});

it('answers a caller with no session at all with the version the panel stated about itself', async () => {
  const calls = stubBackend(() => json({ panel_fw: 'v3.8', verdict: 'OK' }));
  const built = await appWithBackend();
  // No `actAs`: stage 4 leaves the request ANONYMOUS, which is what the sign-in screen is.
  const response = await built.app.inject({ method: 'GET', url: PANEL_INFO });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ panelFirmware: 'v3.8', verdict: 'OK' });
  expect(PanelFirmwareResponseSchema.safeParse(response.json()).success).toBe(true);
  expect(validateCoreApiResponse('getPanelFirmware', 200, response.json())).toEqual({ ok: true });
  expect(calls).toEqual([STATUS_URL]);
});

it('turns a panel backend that is not there into a 200 with two empty words, never a 500', async () => {
  stubBackend(() => Promise.reject(new Error('ECONNREFUSED')));
  const built = await appWithBackend();
  const response = await built.app.inject({ method: 'GET', url: PANEL_INFO });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ panelFirmware: '', verdict: '' });
  expect(validateCoreApiResponse('getPanelFirmware', 200, response.json())).toEqual({ ok: true });
});

it('says nothing it cannot support: a refused status, a body that is no JSON and a shape that is not the backend all answer empty', async () => {
  const built = await appWithBackend();
  for (const answer of [
    () => json('nope', 503),
    () => json('<html>not json</html>'),
    () => json({ health: 'ok' }),
    () => json({ panel_fw: 12, verdict: 'OK' }),
  ]) {
    stubBackend(answer);
    const response = await built.app.inject({ method: 'GET', url: PANEL_INFO });
    expect([response.statusCode, response.json()], String(answer)).toEqual([200, { panelFirmware: '', verdict: '' }]);
  }
});

it('keeps the sign-in screen alive on a Core with no panel bridge at all: an empty answer and no network call', async () => {
  const calls = stubBackend(() => json({ panel_fw: 'v3.8', verdict: 'OK' }));
  const built = await appWithBackend(null);
  const response = await built.app.inject({ method: 'GET', url: PANEL_INFO });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ panelFirmware: '', verdict: '' });
  expect(calls).toEqual([]);
});

describe('the reader behind the route', () => {
  /** The same answer reused until five seconds pass, so a polling screen cannot flood the panel backend. */
  it('asks the backend once and reuses that answer for five seconds', async () => {
    let at = 1_000;
    const calls: string[] = [];
    const reader = createPanelFirmwareReader({
      url: 'http://127.0.0.1:8090',
      now: () => at,
      fetch: (async (input: unknown) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ panel_fw: 'v3.8', verdict: 'OK' }));
      }) as unknown as typeof globalThis.fetch,
    });
    expect(await reader.read()).toEqual({ panelFirmware: 'v3.8', verdict: 'OK' });
    at += PANEL_INFO_CACHE_MS - 1;
    expect(await reader.read()).toEqual({ panelFirmware: 'v3.8', verdict: 'OK' });
    expect(calls).toHaveLength(1);
    at += 1;
    expect(await reader.read()).toEqual({ panelFirmware: 'v3.8', verdict: 'OK' });
    expect(calls).toHaveLength(2);
  });

  /** Two callers during one slow answer open one request, not two. */
  it('joins the call that is already in flight', async () => {
    let release!: (value: Response) => void;
    const waiting = new Promise<Response>((resolve) => { release = resolve; });
    let calls = 0;
    const reader = createPanelFirmwareReader({
      url: 'http://127.0.0.1:8090',
      fetch: (async () => { calls += 1; return waiting; }) as unknown as typeof globalThis.fetch,
    });
    const first = reader.read();
    const second = reader.read();
    release(new Response(JSON.stringify({ panel_fw: 'v4.0', verdict: 'PANEL-DIAM' })));
    expect(await first).toEqual({ panelFirmware: 'v4.0', verdict: 'PANEL-DIAM' });
    expect(await second).toEqual({ panelFirmware: 'v4.0', verdict: 'PANEL-DIAM' });
    expect(calls).toBe(1);
  });

  /** A failed read is cached too: a dead backend is asked again after the window, not on every key press. */
  it('holds the empty answer for the same five seconds when the backend failed', async () => {
    let at = 0;
    let calls = 0;
    const reader = createPanelFirmwareReader({
      url: 'http://127.0.0.1:8090',
      now: () => at,
      fetch: (async () => { calls += 1; return new Response('boom', { status: 500 }); }) as unknown as typeof globalThis.fetch,
    });
    expect(await reader.read()).toEqual({ panelFirmware: '', verdict: '' });
    at = PANEL_INFO_CACHE_MS - 1;
    expect(await reader.read()).toEqual({ panelFirmware: '', verdict: '' });
    expect(calls).toBe(1);
  });

  it('trims what the tool said and keeps it inside the length the contract gives', async () => {
    const reader = createPanelFirmwareReader({
      url: 'http://127.0.0.1:8090',
      fetch: (async () => new Response(JSON.stringify({ panel_fw: '  v3.8-build-of-twelve  ', verdict: 'OK' }))) as unknown as typeof globalThis.fetch,
    });
    const answer = await reader.read();
    expect(PanelFirmwareResponseSchema.safeParse(answer).success).toBe(true);
    expect(answer.panelFirmware.length).toBeLessThanOrEqual(12);
    expect(answer.panelFirmware).toBe('v3.8-build-o');
  });
});
