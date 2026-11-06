// Closing pass F-X, item 1 (fix F-M7b decisions 4 and 9; controller decision D186 (4)): operation 33
// `recoverSession` THROUGH HTTP on a Core that booted in capture mode `real`. When the open session
// is FINALIZING with a FAILED sealing step the operation re-queues the seal and answers `202` with
// state FINALIZING (contract C3, erratum of op 33); in every other case it does what it always did.
//
// WHAT STANDS IN: the engine's `state()` is read through a view that shows the open session as
// FINALIZING with a failed step (no seal ran here: the session was only created). Everything else
// is the product: the route, the stages, the sealing host of a real-mode boot and its controller.
import { validateCoreApiResponse } from '@dems/shared/api';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { sealingHost } from '../../../sealing-host';
import { SESSION, errorOf, on, outcome, seeded, sessionInput, sessionsApp, type SessionsApp } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'fxop33' });
const fixture = realBootFixture('fxop33');
fixture.provisionKey();
afterAll(() => fixture.remove());

async function realCore(slug: string): Promise<SessionsApp> {
  const target = await db.another({ template: 'seed', slug });
  await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  return sessionsApp(target, fixture.dataDir, {
    config: {
      dataDir: fixture.dataDir,
      mediaStoreDir: fixture.mediaStoreDir,
      captureMode: 'real',
      demoControls: false,
      captureDevSources: true,
      captureHelperFfmpegPath: '/bin/echo',
      captureWorkerPath: fixture.worker(`worker-${slug}`, 'capture-worker/0.4.0'),
    },
  });
}

/** The engine as it is, with its open session shown in `state` / with these finalization steps. */
function showSession(server: SessionsApp, state: string, steps: readonly string[]): () => void {
  const real = server.app.engine;
  const view = new Proxy(real, {
    get(target, key, receiver) {
      if (key !== 'state') return Reflect.get(target, key, receiver) as unknown;
      return () => {
        const now = target.state();
        return now.session === null ? now : { ...now, session: { ...now.session, state, finalization: { ...now.session.finalization, steps: steps.map((status, index) => ({ id: `STEP-${index}`, status })) } } };
      };
    },
  });
  server.app.seams.replace('engine', view as never);
  return () => server.app.seams.replace('engine', real);
}

describe('operation 33 on a real-mode Core: the retry of a failed seal on demand', () => {
  it('FINALIZING with a FAILED sealing step answers 202 with state FINALIZING, valid by the contract, and its RECOVERY_STARTED row (reason SEAL_RETRY) names the operator who asked; the controls answer as before', async () => {
    const server = await realCore('fxop33_real');
    expect(sealingHost(server.app).mounted).toBe(true);
    const investigator = await server.signIn('INVESTIGATOR');
    const created = await server.post(investigator, SESSION, sessionInput(seeded('INVESTIGATOR').id));
    expect(created.statusCode).toBe(201);
    const id = (created.json() as { sessionId: string }).sessionId;

    // CONTROL 1: the session as it is (not in FAULT, no failed seal): the hosted action refuses, as always.
    expect(outcome(await server.post(investigator, on(id, 'recover')))).toEqual([409, 'INVALID_STATE']);

    // CONTROL 2: FINALIZING while its steps run (none failed): no retry; the hosted action answers for the session's true state.
    let restore = showSession(server, 'FINALIZING', ['done', 'active', 'pending']);
    const running = await server.post(investigator, on(id, 'recover'));
    restore();
    expect(outcome(running)).toEqual([409, 'INVALID_STATE']);

    // THE CASE.
    restore = showSession(server, 'FINALIZING', ['done', 'error', 'pending']);
    let response = await server.post(investigator, on(id, 'recover'));
    const written = await server.written(async () => {
      // Both requests are inside the window: the first that finds no run under way writes the row.
      await sealingHost(server.app).settled();
      response = await server.post(investigator, on(id, 'recover'));
      await sealingHost(server.app).settled();
    });
    restore();
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ sessionId: id, state: 'FINALIZING' });
    expect(validateCoreApiResponse('recoverSession', 202, response.json())).toEqual({ ok: true });
    // Tidy pass F-Y, item 8 (ruling D186 (8), decision D189): the retry on demand is AUDITED by the sealing host since
    // fix F-M7c - `RECOVERY_STARTED` with `reason: SEAL_RETRY` - and the row names WHO asked: the operator of the request.
    // (Until F-M7c this line asserted that no such row is written; the hosted recovery's own row is still not written.)
    const retries = written.filter((row) => row.type === 'RECOVERY_STARTED');
    // One row per retry that found no run under way (the request before the window may still be writing its own).
    expect(retries.length).toBeGreaterThanOrEqual(1);
    expect(retries.map((row) => [row.sessionId, (row.details as { reason?: unknown }).reason, row.actorId])).toEqual(retries.map(() => [id, 'SEAL_RETRY', seeded('INVESTIGATOR').id]));

    // CONTROL 3: another session's ID is never the retry.
    restore = showSession(server, 'FINALIZING', ['error']);
    const other = await server.post(investigator, on('SES-20200101-0001', 'recover'));
    restore();
    expect(other.statusCode).not.toBe(202);
    expect(errorOf(other).code).not.toBeUndefined();

    // A role without SESSION_START is refused before the branch (stage 6).
    restore = showSession(server, 'FINALIZING', ['error']);
    const technician = await server.signIn('TECHNICIAN');
    const refused = await server.post(technician, on(id, 'recover'));
    restore();
    expect(refused.statusCode).toBe(403);
  });
});
