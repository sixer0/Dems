// An operator session that EXPIRES frees its candidate list at once (integration pass C1, decision
// D120; row 132's open item; C3 §3.1 "signOut and session expiry"; R-9 AC-4).
//
// The real app factory on a clone of the seed, as `dems_app`, booted, on the MANUAL clock: the
// expiry is the identity unit's own sweep at the server clock's time (`identityControl(app).sweep()`,
// what the 5 s sweeper calls), nothing here ends a session by hand. The adapter is a scripted one
// handed in through `provideAdapter`: no datagram leaves this host.
//
// The case that tells: the ABSOLUTE limit (8 h after sign-in) ends a session that was in use a
// moment ago, so its list is far from its own `expiresAt` (ten minutes). Before this pass that
// list stayed in memory until then.
import { randomUUID } from 'node:crypto';
import type { CaptureDiscoveryStateBody } from '@dems/shared/api';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { TOUCH, WEB_ORIGIN, signInOnWeb, type WebSession } from '../../../../test/support/identity';
import { CaptureAdapterKind, type OnvifCandidate, type OnvifDiscoveryAdapter, type WsDiscoveryResult } from '../../../capture/adapters';
import { delay, until } from '../../../capture/adapters/camera/__tests__/support';
import { noticesApp, type NoticesApp } from '../../capture-inputs/__tests__/support';
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS, identityControl } from '../../identity';
import { captureDiscoveryControl } from '../index';

const db = useTestDatabase({ template: 'seed' });
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const DISCOVERY = '/api/v1/capture/discovery';
const MINUTE = 60_000;
const pending: Array<(result: WsDiscoveryResult) => void> = [];
let calls = 0;
let server: NoticesApp;

const candidate = (host: string): OnvifCandidate => ({
  adapterKind: CaptureAdapterKind.ONVIF_RTSP,
  host,
  serviceAddress: `http://${host}/onvif/device_service`,
  endpointRef: `urn:uuid:${randomUUID()}`,
  vendor: 'V',
  model: 'M',
  name: 'N',
  testable: true,
  conflict: false,
  reason: null,
  registered: false,
  addressChanged: false,
  types: [],
  profileHints: [],
  locationHints: [],
  macHint: null,
  serialHint: null,
});
const found = (host: string): WsDiscoveryResult => ({
  candidates: [candidate(host)],
  responderCount: 1,
  interfaceCount: 1,
  truncated: false,
  counts: { datagramsReceived: 0, datagramsAccepted: 0, dropped: {}, repeats: 0, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 4, sendErrors: 0, handlerErrors: 0 },
});

beforeAll(async () => {
  server = await noticesApp(db);
  captureDiscoveryControl(server.app).provideAdapter(
    () =>
      ({
        discover: () =>
          new Promise<WsDiscoveryResult>((resolve) => {
            calls += 1;
            pending.push(resolve);
          }),
      }) as unknown as OnvifDiscoveryAdapter,
  );
});

async function settled(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) {
    await delay(10);
    await server.app.pipeline.drain();
    await server.engine.idle();
  }
  await captureDiscoveryControl(server.app).expirySettled();
}

/** One whole search of a web session on the scripted adapter; the session holds a list of one candidate after it. */
async function searchAs(session: WebSession, host: string): Promise<void> {
  const before = calls;
  server.clock.advance(130_000);
  const started = await server.app.inject({ method: 'POST', url: DISCOVERY, headers: { ...session.cookie, origin: WEB_ORIGIN } });
  expect(started.statusCode, started.body).toBe(202);
  await until(() => calls >= before + 1, 5_000);
  server.clock.advance(3_000);
  pending.at(-1)?.(found(host));
  await settled();
  expect((await server.app.inject({ method: 'GET', url: DISCOVERY, headers: session.cookie })).json<CaptureDiscoveryStateBody>().candidates).toHaveLength(1);
}
const touch = async (session: WebSession): Promise<number> => (await server.app.inject({ method: 'POST', url: TOUCH, headers: { ...session.cookie, origin: WEB_ORIGIN } })).statusCode;
const expiredRows = async (): Promise<number> => Number((await server.owner.query("SELECT count(*)::int AS n FROM public.audit_log WHERE type = 'AUTH_EXPIRED'")).rows[0]?.n);
const openSessions = async (): Promise<number> => Number((await server.owner.query('SELECT count(*)::int AS n FROM public.auth_sessions WHERE ended_at IS NULL')).rows[0]?.n);

describe('session expiry frees the candidate list at once', () => {
  it('ABSOLUTE limit: the older session expires in use, its list (nine minutes from its own expiry) is gone with the sweep; the younger session of the same operator keeps its list', async () => {
    const control = captureDiscoveryControl(server.app);
    const older = await signInOnWeb(server.identity, 'rina.wijaya');
    const olderSignedInAt = server.clock.now();
    // Seven hours later the same operator signs in again: two open sessions, eight-hour limits one hour apart.
    for (let minute = 0; minute < 7 * 60; minute += 10) {
      server.clock.advance(10 * MINUTE);
      expect(await touch(older)).toBeLessThan(300);
    }
    const younger = await signInOnWeb(server.identity, 'rina.wijaya');
    // Both stay in use up to the minute before the older one's limit, and each searches there.
    for (let minute = 0; minute < 50; minute += 10) {
      server.clock.advance(10 * MINUTE);
      expect([await touch(older), await touch(younger)].every((status) => status < 300)).toBe(true);
    }
    // The three sessions of the fixture were left alone all that time: they idle out here, holding no list.
    expect((await identityControl(server.app).sweep()).map((session) => session.endReason)).toEqual(['IDLE_EXPIRED', 'IDLE_EXPIRED', 'IDLE_EXPIRED']);
    await settled();
    await searchAs(older, '192.0.2.40');
    await searchAs(younger, '192.0.2.41');
    const held = control.heldLists();
    expect(held).toBeGreaterThanOrEqual(2);
    const rowsBefore = await expiredRows();
    const openBefore = await openSessions();

    // CONTROL: a sweep before the limit ends nothing and frees nothing.
    expect(await identityControl(server.app).sweep()).toEqual([]);
    await settled();
    expect(control.heldLists()).toBe(held);

    // Past the older session's absolute limit - and nowhere near its list's own expiry, nor the idle limit.
    const olderList = (await server.app.inject({ method: 'GET', url: DISCOVERY, headers: older.cookie })).json<CaptureDiscoveryStateBody>().search;
    const step = olderSignedInAt + SESSION_ABSOLUTE_TIMEOUT_MS - server.clock.now() + 1_000;
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(SESSION_IDLE_TIMEOUT_MS);
    server.clock.advance(step);
    // The list is alive by its own clock: more than a minute of its ten is left.
    expect((olderList?.expiresAt ?? 0) - server.clock.now()).toBeGreaterThan(MINUTE);
    const ended = await identityControl(server.app).sweep();
    expect(ended.map((session) => session.endReason)).toEqual(['ABSOLUTE_EXPIRED']);
    await settled();
    expect(await expiredRows()).toBe(rowsBefore + 1);
    expect(await openSessions()).toBe(openBefore - 1);
    // At once: no read of the list, no ten minutes.
    expect(control.heldLists()).toBe(held - 1);
    expect((await server.app.inject({ method: 'GET', url: DISCOVERY, headers: older.cookie })).statusCode).toBe(401);
    // The younger session of the SAME operator: open, and its list is still its own.
    const kept = await server.app.inject({ method: 'GET', url: DISCOVERY, headers: younger.cookie });
    expect(kept.statusCode).toBe(200);
    expect(kept.json<CaptureDiscoveryStateBody>().candidates.map((entry) => entry.host)).toEqual(['192.0.2.41']);
    expect(control.heldLists()).toBe(held - 1);
  });

  it('IDLE limit: a session left alone for fifteen minutes is ended by the sweep, and nothing of it stays held', async () => {
    const control = captureDiscoveryControl(server.app);
    const session = await signInOnWeb(server.identity, 'rina.wijaya');
    await searchAs(session, '192.0.2.42');
    const held = control.heldLists();
    server.clock.advance(SESSION_IDLE_TIMEOUT_MS + 1_000);
    const ended = await identityControl(server.app).sweep();
    expect(ended.map((entry) => entry.endReason)).toContain('IDLE_EXPIRED');
    await settled();
    // Every session that idled out with it (the younger one of the case above among them) is freed with it.
    expect(control.heldLists()).toBe(0);
    expect(held).toBeGreaterThanOrEqual(1);
    expect((await server.app.inject({ method: 'GET', url: DISCOVERY, headers: session.cookie })).statusCode).toBe(401);
  });
});
