// AC-B-90, SR-18: two instances on two ports, used with one cookie jar (plan row W24; spec §5.1
// ID-P7; security design review SD-08). Cookies are scoped by host, not by port, so one browser
// profile sends every cookie it holds for 127.0.0.1 to both the main console and a lane.
//
// The two app instances here are the main instance (port 4420) and lane 1 (port 4421), built by
// the real factory and never listening. They share ONE cloned database on purpose: a token of
// either instance is then a valid row for both, so what keeps them apart in this test is the
// cookie NAME alone, which is the thing under test. (In the demo each instance has its own
// database as well.)
import { OPERATORS } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readTrail } from '../../../../test/support/core';
import { SESSION, SIGN_OUT, bearer, errorOf, identityApp, sessionOfToken, setCookies, webSignIn, type IdentityApp } from '../../../../test/support/identity';

const db = useTestDatabase({ template: 'seed' });
let main: IdentityApp;
let lane: IdentityApp;
let owner: Pool;

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
/** The web console of the main instance and of lane 1 (their Vite dev servers). */
const MAIN_CONSOLE = 'http://127.0.0.1:5173';
const LANE_CONSOLE = 'http://127.0.0.1:5176';

/** A browser's cookie jar for the host 127.0.0.1: it ignores ports. */
class CookieJar {
  readonly #cookies = new Map<string, string>();

  store(response: LightMyRequestResponse): void {
    for (const header of setCookies(response)) {
      const [pair, ...attributes] = header.split('; ');
      const separator = pair?.indexOf('=') ?? -1;
      if (pair === undefined || separator < 0) continue;
      const name = pair.slice(0, separator);
      if (attributes.includes('Max-Age=0')) this.#cookies.delete(name);
      else this.#cookies.set(name, pair.slice(separator + 1));
    }
  }

  /** What the browser sends to ANY port of the host. */
  header(): Record<string, string> {
    return this.#cookies.size === 0 ? {} : { cookie: [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ') };
  }

  names(): string[] {
    return [...this.#cookies.keys()].sort();
  }

  value(name: string): string {
    return this.#cookies.get(name) ?? '';
  }
}

beforeAll(async () => {
  owner = db.ownerPool();
  main = await identityApp(db, { port: 4420 });
  lane = await identityApp(db, { port: 4421 });
});

describe('AC-B-90: one cookie jar, two instances', () => {
  const jar = new CookieJar();

  it('each instance names its cookie after its own listen port', () => {
    expect([main.cookieName, lane.cookieName]).toEqual(['dems_session_4420', 'dems_session_4421']);
  });

  it('a sign-in on the second instance leaves the first instance\'s cookie and session valid', async () => {
    const first = await webSignIn(main.app, SUPERVISOR.username, undefined, { origin: MAIN_CONSOLE, ...jar.header() });
    expect(first.statusCode).toBe(200);
    jar.store(first);
    expect(jar.names()).toEqual(['dems_session_4420']);
    const mainToken = jar.value('dems_session_4420');
    const before = (await readTrail(owner)).length;

    // The browser sends the main instance's cookie to the lane as well.
    const second = await webSignIn(lane.app, INVESTIGATOR.username, undefined, { origin: LANE_CONSOLE, ...jar.header() });
    expect(second.statusCode).toBe(200);
    expect(setCookies(second).map((header) => header.split('=')[0])).toEqual(['dems_session_4421']);
    jar.store(second);
    expect(jar.names()).toEqual(['dems_session_4420', 'dems_session_4421']);
    // The first cookie was not replaced, and its session was not taken for a presented one.
    expect(jar.value('dems_session_4420')).toBe(mainToken);
    expect(await sessionOfToken(owner, mainToken)).toMatchObject({ operatorId: SUPERVISOR.id, endedAt: null, endReason: null });
    const row = (await readTrail(owner)).slice(before);
    expect(row.map((written) => [written.type, written.actorId, written.details])).toEqual([['AUTH_SUCCESS', INVESTIGATOR.id, { method: 'PASSWORD' }]]);

    // With the whole jar, each instance answers its own session.
    const onMain = await main.app.inject({ method: 'GET', url: SESSION, headers: jar.header() });
    const onLane = await lane.app.inject({ method: 'GET', url: SESSION, headers: jar.header() });
    expect([onMain.statusCode, onLane.statusCode]).toEqual([200, 200]);
    expect((onMain.json() as { operator: { id: string } }).operator.id).toBe(SUPERVISOR.id);
    expect((onLane.json() as { operator: { id: string } }).operator.id).toBe(INVESTIGATOR.id);
  });

  it('each instance ignores the other\'s cookie: alone it is no credential, although its token is a valid row', async () => {
    const mainCookie = `dems_session_4420=${jar.value('dems_session_4420')}`;
    const laneCookie = `dems_session_4421=${jar.value('dems_session_4421')}`;
    const laneOnMain = await main.app.inject({ method: 'GET', url: SESSION, headers: { cookie: laneCookie } });
    const mainOnLane = await lane.app.inject({ method: 'GET', url: SESSION, headers: { cookie: mainCookie } });
    expect([laneOnMain.statusCode, errorOf(laneOnMain).code]).toEqual([401, 'NOT_SIGNED_IN']);
    expect([mainOnLane.statusCode, errorOf(mainOnLane).code]).toEqual([401, 'NOT_SIGNED_IN']);
    // The name decides, not the value: the same token under the instance's own name resolves.
    const renamed = await main.app.inject({ method: 'GET', url: SESSION, headers: { cookie: `dems_session_4420=${jar.value('dems_session_4421')}` } });
    expect(renamed.statusCode).toBe(200);
  });

  it('the other instance\'s cookie beside a bearer value is not a second credential', async () => {
    const response = await main.app.inject({
      method: 'GET',
      url: SESSION,
      headers: { ...bearer(`ses_${'Q'.repeat(43)}`), cookie: `dems_session_4421=${jar.value('dems_session_4421')}` },
    });
    // Not the 401 of a conflict: the plain 401 of a bearer value that resolves to nothing.
    expect(response.statusCode).toBe(401);
    expect(errorOf(response).details).toBeUndefined();
  });

  it('a sign-out on one instance clears only that instance\'s cookie and ends only its session', async () => {
    const out = await lane.app.inject({ method: 'POST', url: SIGN_OUT, headers: { origin: LANE_CONSOLE, ...jar.header() } });
    expect(out.statusCode).toBe(204);
    expect(setCookies(out).map((header) => header.split('=')[0])).toEqual(['dems_session_4421']);
    jar.store(out);
    expect(jar.names()).toEqual(['dems_session_4420']);

    expect((await main.app.inject({ method: 'GET', url: SESSION, headers: jar.header() })).statusCode).toBe(200);
    expect((await lane.app.inject({ method: 'GET', url: SESSION, headers: jar.header() })).statusCode).toBe(401);
  });
});
