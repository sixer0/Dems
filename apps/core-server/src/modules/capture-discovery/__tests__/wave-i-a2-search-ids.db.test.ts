// FIX WAVE I, DRIVER A2 - finding G70b-07 of re-gate 70, against PostgreSQL: the statement that
// reads the highest stored search number runs as `dems_app`, and a Core that is STARTED AGAIN on
// the same database gives no search ID of its audit chain a second time.
//
// Two processes, one after the other, on one clone of the seed (the real app factory, simulated capture, the scripted
// discovery adapter of `capture-discovery.db.test.ts`: no datagram is sent). The rows are read
// from the table as `dems_owner`.
import { CAPTURE_SEARCH_ID_PATTERN, type CaptureDiscoveryStateBody } from '@dems/shared/api';
import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { FIXED_NOW, engineApp, type EngineApp } from '../../../../test/support/engine';
import { WEB_ORIGIN, signInOnWeb, type IdentityApp } from '../../../../test/support/identity';
import type { OnvifDiscoveryAdapter, WsDiscoveryResult } from '../../../capture/adapters';
import { captureDiscoveryControl, readLastSearchNumber } from '../index';

const db = useTestDatabase({ template: 'seed' });
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const DISCOVERY = '/api/v1/capture/discovery';
const RESCAN = '/api/v1/capture/inputs/rescan';
const EMPTY: WsDiscoveryResult = {
  candidates: [],
  responderCount: 0,
  interfaceCount: 1,
  truncated: false,
  counts: { datagramsReceived: 0, datagramsAccepted: 0, dropped: {}, repeats: 0, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 4, sendErrors: 0, handlerErrors: 0 },
};
type Target = typeof db;
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Process {
  readonly server: EngineApp;
  search(): Promise<string>;
  post(url: string): Promise<LightMyRequestResponse>;
}

/** One PROCESS on `target`, started at `startAt`: booted, signed in, with a scripted adapter whose every search finds nothing. */
async function processOn(target: Target, startAt: number): Promise<Process> {
  const server = await engineApp(target, db.run.dataDir, { startAt, logLevel: 'info' });
  await server.app.readiness.boot();
  await server.app.pipeline.drain();
  captureDiscoveryControl(server.app).provideAdapter(() => ({ discover: async () => EMPTY }) as unknown as OnvifDiscoveryAdapter);
  const { cookie } = await signInOnWeb({ app: server.app, cookieName: server.app.config.sessionCookieName } as unknown as IdentityApp, 'rina.wijaya');
  const post = (url: string): Promise<LightMyRequestResponse> => server.app.inject({ method: 'POST', url, headers: { ...cookie, origin: WEB_ORIGIN } });
  const search = async (): Promise<string> => {
    // Clear of every bound of a search.
    server.clock.advance(130_000);
    const started = await post(DISCOVERY);
    expect(started.statusCode, started.body).toBe(202);
    for (let turn = 0; turn < 20; turn += 1) {
      await delay(10);
      await server.app.pipeline.drain();
    }
    const state = (await server.app.inject({ method: 'GET', url: DISCOVERY, headers: cookie })).json<CaptureDiscoveryStateBody>();
    expect(state.search?.state).toBe('COMPLETE');
    return state.search?.searchId ?? '';
  };
  return { server, search, post };
}
const storedIds = async (target: Target): Promise<string[]> =>
  (await readTrail(target.ownerPool())).filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED').map((row) => String((row.details as Record<string, unknown>)['searchId']));

describe('G70b-07: search IDs across a restart of the Core on one database', () => {
  it('the second process goes on from the highest stored number; a microphone re-read between them does not move it; no ID is stored twice and the chain verifies', async () => {
    const target = db;
    const first = await processOn(target, FIXED_NOW);
    expect(captureDiscoveryControl(first.server.app).searchesStarted()).toBe(0);
    const firstIds = [await first.search(), await first.search()];
    expect(firstIds).toEqual(['DSC-000001', 'DSC-000002']);
    // Operation 97 writes the same audit type with a clock ID of thirteen digits: no counter.
    first.server.clock.advance(130_000);
    expect((await first.post(RESCAN)).statusCode).toBe(200);
    await first.server.app.pipeline.drain();
    // The statement itself, as the runtime role.
    expect(await first.server.app.db.read('test.lastSearchNumber', (pool) => readLastSearchNumber({ query: (text) => pool.query(text) }))).toBe(2);
    const closedAt = first.server.clock.now();
    await first.server.app.close();

    // THE RESTART: a new process, its counter at 0. Before the fix its first search was DSC-000001 again.
    const second = await processOn(target, closedAt + 60_000);
    expect(captureDiscoveryControl(second.server.app).searchesStarted()).toBe(0);
    expect([await second.search(), await second.search()]).toEqual(['DSC-000003', 'DSC-000004']);
    expect(captureDiscoveryControl(second.server.app).searchesStarted()).toBe(2);

    const ids = await storedIds(target);
    const camera = ids.filter((id) => /^DSC-[0-9]{6,9}$/.test(id));
    expect(camera).toEqual(['DSC-000001', 'DSC-000002', 'DSC-000003', 'DSC-000004']);
    expect(ids.filter((id) => /^DSC-[0-9]{13}$/.test(id))).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(CAPTURE_SEARCH_ID_PATTERN);
    const trail = await readTrail(target.ownerPool());
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(target.ownerPool())).ok).toBe(true);
  });
});
