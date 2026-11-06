// Operation 82 `listAudioSourceIntervals` in capture mode `simulated` (integration pass D4; C3
// §2.2, §2.3): the route, its access rule, its refusals and its paging, on the real app factory
// with the memory engine behind the seam. The read of `session_audio_intervals` (capture mode
// `real`) is `audio-intervals.db.test.ts`.
import { AudioSourceIntervalPageSchema, CORE_API_OPERATIONS, CoreApiAccessKind, type AudioSourceIntervalEntry, type AudioSourceIntervalPage } from '@dems/shared/api';
import type { OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { permissionGuard } from '../../../plugins/permission-guard';
import { intervalCursorOf, intervalPositionOf, pageOfIntervals } from '../index';
import { unitApp, type UnitApp } from './memory-engine';
import { OTHER_SESSION, on, sessionInput } from './support';

const apps: UnitApp[] = [];
afterEach(async () => {
  for (const unit of apps.splice(0)) await unit.close();
});

/** A recording session of the memory engine. Resolves with the app and the session ID. */
async function recording(caller: OperatorRole | null = 'INVESTIGATOR'): Promise<{ unit: UnitApp; id: string }> {
  const unit = await unitApp();
  apps.push(unit);
  const { memory } = unit;
  memory.host.sim.actions.setTabletLink('CONNECTED');
  memory.act('INVESTIGATOR', (actions) => actions.createSession(sessionInput(memory.host.operator('INVESTIGATOR').id)));
  memory.act('INVESTIGATOR', (actions) => actions.beginPrecheck());
  memory.host.drive(5_000);
  if (memory.session?.state === 'PRECHECK') memory.act('INVESTIGATOR', (actions) => actions.acknowledgePrecheckWarnings());
  memory.act('INVESTIGATOR', (actions) => actions.startRecording());
  memory.host.drive(2_000);
  expect(memory.session?.state).toBe('RECORDING');
  unit.actAs(caller);
  return { unit, id: memory.session?.id ?? '' };
}

const pageOf = (response: LightMyRequestResponse): AudioSourceIntervalPage => {
  expect(response.statusCode).toBe(200);
  return AudioSourceIntervalPageSchema.parse(response.json());
};
const codeOf = (response: LightMyRequestResponse): string => (response.json() as { error: { code: string } }).error.code;

describe('operation 82: the access rule is the registry\'s', () => {
  it('any signed-in operator: the guard holds the rule AUTHENTICATED for the route; nobody without a session; every role reads', async () => {
    const { unit, id } = await recording(null);
    const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === 'listAudioSourceIntervals');
    expect(operation?.access.kind).toBe(CoreApiAccessKind.AUTHENTICATED);
    const rule = permissionGuard(unit.app).registeredRules().find((candidate) => candidate.operationId === 'listAudioSourceIntervals');
    expect(rule?.kind).toBe(CoreApiAccessKind.AUTHENTICATED);
    expect(rule?.permissions).toEqual([]);

    const anonymous = await unit.get(on(id, 'audio-source'));
    expect([anonymous.statusCode, codeOf(anonymous)]).toEqual([401, 'NOT_SIGNED_IN']);
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      unit.actAs(role);
      expect(pageOf(await unit.get(on(id, 'audio-source'))).items, role).toHaveLength(1);
    }
    // A read: no unit of the engine, no audit row of the guard (nobody was refused a permission).
    expect(unit.memory.units).toEqual([]);
    expect(unit.database.committed.auditSeqs).toEqual([]);
  });

  it('GET on the path of operation 81 is an operation now: it no longer answers 405', async () => {
    const { unit, id } = await recording();
    const response = await unit.get(on(id, 'audio-source'));
    expect(response.statusCode).toBe(200);
    expect(response.headers['allow']).toBeUndefined();
  });
});

describe('operation 82: the intervals of the open session', () => {
  it('before any switch: one open interval of the ACTIVE input, opened by the start', async () => {
    const { unit, id } = await recording();
    const session = unit.memory.session;
    expect(pageOf(await unit.get(on(id, 'audio-source')))).toEqual({
      items: [{ sessionId: id, seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: null, fromAt: session?.startedAt, toAt: null, switchedBy: null, reason: 'START' }],
      nextCursor: null,
    });
    expect(session?.audioSource).toMatchObject({ activeInputId: 'MIC-01', standbyInputId: 'MIC-02' });
  });

  it('operation 81 is retired (audit row 149; D5, N-29, N-30): a refused switch opens no interval - the session keeps the one of its start; paged by the interval number', async () => {
    const { unit, id } = await recording();
    unit.memory.host.drive(3_000);
    // The hosted action of operation 81 refuses for the pairing (row 150); its route answers 409 itself (`routes.ts`).
    expect(() => unit.memory.act('INVESTIGATOR', (actions) => actions.switchAudioSource('MIC-02'))).toThrow(expect.objectContaining({ code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' }));
    const all = pageOf(await unit.get(on(id, 'audio-source')));
    expect(all.nextCursor).toBeNull();
    expect(all.items.map((item) => [item.seq, item.inputId, item.reason, item.switchedBy, item.toMs === null])).toEqual([[1, 'MIC-01', 'START', null, true]]);
    expect(unit.memory.session?.audioSource).toMatchObject({ activeInputId: 'MIC-01', standbyInputId: 'MIC-02' });

    const first = pageOf(await unit.get(`${on(id, 'audio-source')}?limit=1`));
    expect(first.items.map((item) => item.seq)).toEqual([1]);
    expect(first.nextCursor).toBeNull();
    expect(pageOf(await unit.get(`${on(id, 'audio-source')}?cursor=0`))).toEqual({ items: [], nextCursor: null });
  });

  it('404 for a session that is not the open one, and when no session is open; 422 for a query or an {id} outside the contract', async () => {
    const { unit, id } = await recording();
    const other = await unit.get(on(OTHER_SESSION, 'audio-source'));
    expect([other.statusCode, codeOf(other)]).toEqual([404, 'NOT_FOUND']);
    for (const query of ['cursor=MIC-01', 'cursor=1234567890', 'cursor=-1', 'limit=0', 'limit=abc']) {
      const refused = await unit.get(`${on(id, 'audio-source')}?${query}`);
      expect([refused.statusCode, codeOf(refused)], query).toEqual([422, 'INVALID_INPUT']);
    }
    const malformed = await unit.get(on('SES-1', 'audio-source'));
    expect(malformed.statusCode).toBe(422);

    const idle = await unitApp();
    apps.push(idle);
    idle.actAs('SUPERVISOR');
    const none = await idle.get(on(OTHER_SESSION, 'audio-source'));
    expect([none.statusCode, codeOf(none)]).toEqual([404, 'NOT_FOUND']);
  });
});

describe('the cursor and the page, as pure rules', () => {
  const entry = (seq: number): AudioSourceIntervalEntry => ({ sessionId: 'SES-20261001-0001', seq, inputId: 'MIC-01', role: 'PRIMARY', fromMs: seq * 10, toMs: null, fromAt: 1, toAt: null, switchedBy: null, reason: 'START' });
  const five = [4, 3, 2, 1, 0].map(entry);

  it('a cursor is the interval number as decimal text; anything else is no cursor', () => {
    expect(intervalCursorOf(entry(12))).toBe('12');
    expect([intervalPositionOf('0'), intervalPositionOf('12'), intervalPositionOf('999999999')]).toEqual([0, 12, 999_999_999]);
    expect(['', '-1', '1.5', '1e3', ' 1', '1234567890', 'MIC-01'].map(intervalPositionOf)).toEqual([null, null, null, null, null, null, null]);
  });

  it('pages walk the list to its end without a repeat; an interval opened meanwhile shifts nothing', () => {
    const seen: number[] = [];
    let cursor: string | null = null;
    let list = five;
    do {
      const page = pageOfIntervals(list, cursor === null ? null : intervalPositionOf(cursor), 2);
      seen.push(...page.items.map((item) => item.seq));
      cursor = page.nextCursor;
      // A switch opens interval 5 while the client pages.
      list = [entry(5), ...five];
    } while (cursor !== null);
    expect(seen).toEqual([4, 3, 2, 1, 0]);
    expect(pageOfIntervals(five, null, 5)).toEqual({ items: five, nextCursor: null });
    expect(pageOfIntervals([], null, 5)).toEqual({ items: [], nextCursor: null });
  });
});
