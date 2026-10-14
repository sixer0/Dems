// The SESSION_HOLDER fact on PostgreSQL as `dems_app` (integration pass D6, finding F-D4-3; C3 §2.2:
// "the operator who created the open session, or any SUPERVISOR"; SEC35-18; C3 §5.3), and the
// answer of operation 81 for an input that is no input of the session (F-D4-4; C3 §4).
//
// WHAT IS REAL: the app factory, every request stage, the guard's read of `active_session`, the
// engine host and its unit, the audit chain. Capture mode `simulated` (no worker).
// WHAT STANDS IN: the second INVESTIGATOR. The seed holds one operator per role, so a second one is
// planted by `dems_owner` BEFORE the boot, as a copy of the seeded investigator's row and
// credential row under another ID and user name (a throw-away database; no secret is read or printed).
import { AudioSourceStateSchema } from '@dems/shared/api';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { cookieValue, webSignIn } from '../../../../test/support/identity';
import { errorOf, on, seeded, sessionInput, sessionsApp, SESSION, type Caller, type SessionsApp } from '../../../modules/sessions/__tests__/support';
import { READ_OPEN_SESSION_CREATOR } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'd6holder' });
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const SECOND = { id: 'OPR-777', username: 'second.investigator' } as const;

async function recordingCore(slug: string): Promise<{ server: SessionsApp; creator: Caller; second: Caller; supervisor: Caller; id: string }> {
  const dataDir = mkdtempSync(join(tmpdir(), 'dems-d6-holder-'));
  roots.push(dataDir);
  const target = await db.another({ template: 'seed', slug });
  const first = seeded('INVESTIGATOR');
  const owner = target.ownerPool();
  await owner.query(
    `INSERT INTO public.operators (id, username, rank, name, display_name, initials, role_id, enabled, created_at, updated_at)
     SELECT $1, $2, rank, 'Second Investigator', 'Second Investigator', 'SI', role_id, true, created_at, updated_at FROM public.operators WHERE id = $3`,
    [SECOND.id, SECOND.username, first.id],
  );
  await owner.query(
    `INSERT INTO public.operator_credentials (operator_id, algorithm, memory_kib, passes, parallelism, salt, hash, hashed_at)
     SELECT $1, algorithm, memory_kib, passes, parallelism, salt, hash, hashed_at FROM public.operator_credentials WHERE operator_id = $2`,
    [SECOND.id, first.id],
  );
  const server = await sessionsApp(target, dataDir);
  const creator = await server.signIn('INVESTIGATOR');
  const supervisor = await server.signIn('SUPERVISOR');
  const signedIn = await webSignIn(server.app, SECOND.username);
  const token = signedIn.statusCode === 200 ? cookieValue(signedIn, server.app.config.sessionCookieName) : null;
  if (token === null) throw new Error(`the sign-in of the second investigator answered ${signedIn.statusCode}`);
  const second: Caller = { operator: { ...first, id: SECOND.id, username: SECOND.username }, cookie: { cookie: `${server.app.config.sessionCookieName}=${token}` } };

  await server.engine.setTabletLink('CONNECTED');
  const created = await server.post(creator, SESSION, sessionInput(first.id));
  expect(created.statusCode).toBe(201);
  const id = (created.json() as { sessionId: string }).sessionId;
  const principal = server.principal('INVESTIGATOR');
  await server.engine.command(principal, 'beginPrecheck');
  await server.drive(5_000);
  if (server.engine.slice('session')?.state === 'PRECHECK') await server.engine.command(principal, 'acknowledgePrecheckWarnings');
  await server.engine.command(principal, 'startRecording');
  await server.drive(3_000);
  expect(server.engine.slice('session')?.state).toBe('RECORDING');
  return { server, creator, second, supervisor, id };
}

describe('the schema this pass was written against', () => {
  it('schema version 15, contract dbc-16: no migration', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([15, 'dbc-16']);
  });
});

describe('SESSION_HOLDER on operation 81 (C3 §2.2): the creator of the open session, or any SUPERVISOR', () => {
  it('the creator passes; another operator of the same role is refused 403 with one ACCESS_DENIED row that names the condition; a SUPERVISOR passes', async () => {
    const { server, creator, second, supervisor, id } = await recordingCore('d6holder_81');
    // The fact the guard reads is the creator; the column it read before this pass is NULL.
    expect(READ_OPEN_SESSION_CREATOR).toContain('created_by');
    expect((await server.owner.query('SELECT created_by, started_by FROM public.active_session')).rows).toEqual([{ created_by: creator.operator.id, started_by: null }]);

    // NEGATIVE CONTROL FIRST: an operator who holds SESSION_START (same role) and did not create the session.
    const denied = await server.written(async () => {
      const refused = await server.post(second, on(id, 'audio-source'), { inputId: 'MIC-02' });
      expect([refused.statusCode, errorOf(refused).code]).toEqual([403, 'NOT_PERMITTED']);
    });
    expect(denied.map((row) => [row.type, row.actorId, row.details])).toEqual([['ACCESS_DENIED', SECOND.id, { operationId: 'switchAudioSource', permission: 'SESSION_START', role: 'INVESTIGATOR', reason: 'SESSION_HOLDER' }]]);
    expect(server.engine.slice('session')?.audioSource?.activeInputId).toBe('MIC-01');

    // The creator.
    const switched = await server.post(creator, on(id, 'audio-source'), { inputId: 'MIC-02' });
    expect(switched.statusCode).toBe(200);
    expect(AudioSourceStateSchema.parse(switched.json()).activeInputId).toBe('MIC-02');
    // A SUPERVISOR who did not create it.
    const back = await server.post(supervisor, on(id, 'audio-source'), { inputId: 'MIC-01' });
    expect(back.statusCode).toBe(200);
    expect(AudioSourceStateSchema.parse(back.json()).activeInputId).toBe('MIC-01');
  });

  it('F-D4-4: a well-formed input that is no input of the session is 409 AUDIO_SOURCE_CONFLICT (not 404); nothing is written and the source stays', async () => {
    const { server, creator, id } = await recordingCore('d6holder_409');
    const written = await server.written(async () => {
      const refused = await server.post(creator, on(id, 'audio-source'), { inputId: 'MIC-09' });
      expect([refused.statusCode, errorOf(refused).code, errorOf(refused).details?.['reason']]).toEqual([409, 'AUDIO_SOURCE_CONFLICT', 'NO_SUCH_INPUT']);
    });
    expect(written.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED')).toEqual([]);
    expect(server.engine.slice('session')?.audioSource?.activeInputId).toBe('MIC-01');
    // The orders before it stand: another form is 422, another session 404.
    expect((await server.post(creator, on(id, 'audio-source'), { inputId: 'MIC-9' })).statusCode).toBe(422);
    expect((await server.post(creator, on('SES-20200101-0001', 'audio-source'), { inputId: 'MIC-09' })).statusCode).toBe(404);
  });
});
