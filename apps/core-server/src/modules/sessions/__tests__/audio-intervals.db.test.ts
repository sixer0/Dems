// Operation 82 `listAudioSourceIntervals` on PostgreSQL as `dems_app` (integration pass D4; C3 §2.2,
// §2.4; dbc-3 §B.5). The intervals are written with the PRODUCT'S OWN statements of
// `src/capture-session` (the unit that writes them from the capture worker's records), then read
// through the route of a Core that booted in capture mode `real`.
//
// WHAT STANDS IN: no capture worker runs here (the boot fixture's stand-in program only says HELLO),
// so the rows are planted by the test, as `dems_app`, in the open session's name. What a worker
// writes into them is the subject of `src/capture-session/__tests__/session-capture.db.test.ts`.
import { AudioSourceIntervalPageSchema, type AudioSourceIntervalPage } from '@dems/shared/api';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { CLOSE_OPEN_AUDIO_INTERVAL, INSERT_AUDIO_INTERVAL, sessionCapture } from '../../../capture-session';
import { readIntervalPage } from '../index';
import { OTHER_SESSION, SESSION, on, seeded, sessionInput, sessionsApp, type SessionsApp } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'd4op82' });
const fixture = realBootFixture('d4op82');
fixture.provisionKey();
afterAll(() => fixture.remove());

const pageOf = (response: LightMyRequestResponse): AudioSourceIntervalPage => {
  expect(response.statusCode).toBe(200);
  return AudioSourceIntervalPageSchema.parse(response.json());
};

async function realCore(slug: string): Promise<SessionsApp> {
  const target = await db.another({ template: 'seed', slug });
  // No speech runtime on a test host: the transcriber is not the subject here.
  await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  const server = await sessionsApp(target, fixture.dataDir, {
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
  expect(sessionCapture(server.app).real).toBe(true);
  return server;
}

describe('operation 82 in capture mode real: the rows of session_audio_intervals', () => {
  it('answers the stored intervals of the open session, newest first, with media times; pages by the interval number; another session\'s rows are not listed', async () => {
    const server = await realCore('d4op82_real');
    const investigator = await server.signIn('INVESTIGATOR');
    const created = await server.post(investigator, SESSION, sessionInput(seeded('INVESTIGATOR').id));
    expect(created.statusCode).toBe(201);
    const id = (created.json() as { sessionId: string }).sessionId;

    // Nothing recorded yet: an empty page, not a derived interval.
    expect(pageOf(await server.get(investigator, on(id, 'audio-source')))).toEqual({ items: [], nextCursor: null });

    // The table numbers the intervals of a session from 1 (`session_audio_intervals_seq_check`).
    // The interval of the start, a switch (close + open, as operation 81 writes them), and a
    // second switch; then rows of ANOTHER session. All as dems_app, with the unit's statements.
    const pool = server.app.db.pool;
    const START = 1_791_500_000_000;
    await pool.query(INSERT_AUDIO_INTERVAL, [id, 1, 'MIC-01', 'PRIMARY', 21, START, null, 'START']);
    await pool.query(CLOSE_OPEN_AUDIO_INTERVAL, [id, 5_303, START + 5_282]);
    await pool.query(INSERT_AUDIO_INTERVAL, [id, 2, 'MIC-02', 'STANDBY', 5_303, START + 5_282, investigator.operator.id, 'MANUAL']);
    await pool.query(CLOSE_OPEN_AUDIO_INTERVAL, [id, 9_000, START + 8_979]);
    await pool.query(INSERT_AUDIO_INTERVAL, [id, 3, 'MIC-01', 'PRIMARY', 9_000, START + 8_979, investigator.operator.id, 'MANUAL']);
    await pool.query(INSERT_AUDIO_INTERVAL, [OTHER_SESSION, 1, 'MIC-02', 'PRIMARY', 0, START, null, 'START']);

    const all = pageOf(await server.get(investigator, on(id, 'audio-source')));
    expect(all).toEqual({
      items: [
        { sessionId: id, seq: 3, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 9_000, toMs: null, fromAt: START + 8_979, toAt: null, switchedBy: investigator.operator.id, reason: 'MANUAL' },
        { sessionId: id, seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 5_303, toMs: 9_000, fromAt: START + 5_282, toAt: START + 8_979, switchedBy: investigator.operator.id, reason: 'MANUAL' },
        { sessionId: id, seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: 5_303, fromAt: START, toAt: START + 5_282, switchedBy: null, reason: 'START' },
      ],
      nextCursor: null,
    });

    const seen: number[] = [];
    let cursor: string | null = null;
    do {
      const page: AudioSourceIntervalPage = pageOf(await server.get(investigator, `${on(id, 'audio-source')}?limit=2${cursor === null ? '' : `&cursor=${cursor}`}`));
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((item) => item.seq));
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(seen).toEqual([3, 2, 1]);

    // Every role reads (AUTHENTICATED); nobody without a session; the other session is not the open one.
    expect(pageOf(await server.get(await server.signIn('TECHNICIAN'), on(id, 'audio-source'))).items).toHaveLength(3);
    expect((await server.get(null, on(id, 'audio-source'))).statusCode).toBe(401);
    expect((await server.get(investigator, on(OTHER_SESSION, 'audio-source'))).statusCode).toBe(404);

    // The reader alone, as dems_app: the other session's row is its own list.
    expect((await readIntervalPage(pool, OTHER_SESSION, null, 50)).items.map((item) => [item.sessionId, item.seq, item.inputId])).toEqual([[OTHER_SESSION, 1, 'MIC-02']]);
  });

  it('a GET writes nothing: no audit row and no table moves', async () => {
    const server = await realCore('d4op82_nowrite');
    const supervisor = await server.signIn('SUPERVISOR');
    const investigator = await server.signIn('INVESTIGATOR');
    const id = ((await server.post(investigator, SESSION, sessionInput(seeded('INVESTIGATOR').id))).json() as { sessionId: string }).sessionId;
    await server.app.db.pool.query(INSERT_AUDIO_INTERVAL, [id, 1, 'MIC-01', 'PRIMARY', 0, 1_791_500_000_000, null, 'START']);
    const written = await server.written(async () => {
      expect(pageOf(await server.get(supervisor, on(id, 'audio-source'))).items).toHaveLength(1);
      expect((await server.get(supervisor, on(OTHER_SESSION, 'audio-source'))).statusCode).toBe(404);
    });
    expect(written).toEqual([]);
    expect((await server.owner.query('SELECT count(*)::int AS n FROM public.session_audio_intervals')).rows[0]?.n).toBe(1);
  });
});

describe('operation 82 in capture mode simulated: the state\'s own derivation, the table is not asked', () => {
  it('a row in the table is NOT answered where no worker writes it; the open session before its start has no interval', async () => {
    const target = await db.another({ template: 'seed', slug: 'd4op82_sim' });
    const server = await sessionsApp(target, db.run.dataDir);
    expect(sessionCapture(server.app).real).toBe(false);
    const investigator = await server.signIn('INVESTIGATOR');
    const id = ((await server.post(investigator, SESSION, sessionInput(seeded('INVESTIGATOR').id))).json() as { sessionId: string }).sessionId;
    await target.ownerPool().query(INSERT_AUDIO_INTERVAL, [id, 1, 'MIC-02', 'PRIMARY', 77, 1_791_500_000_000, null, 'START']);
    expect(pageOf(await server.get(investigator, on(id, 'audio-source')))).toEqual({ items: [], nextCursor: null });
  });
});
