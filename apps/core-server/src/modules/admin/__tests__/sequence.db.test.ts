// The order of work of each administration operation, statement by statement (plan row W33; spec
// §8.2 ENG-23, ENG-27; database contract §5.6 AT-1, AT-2, AT-3, AT-C5; standing rule M13: the
// round trips of one command). A clone of the seed; the pool of the app records every statement
// it is asked to run, on the pool ("pool") and on a unit's connection ("unit"); the publications
// and the seam `sessionRegistry` add their own marks, so each operation leaves one timeline.
//
// What the timelines pin: every unit opens with the chain lock; the lock point of the rule comes
// before anything the unit decides on; the check is made before the write; the sessions are
// ended and the audit row is written INSIDE the unit; the publications leave AFTER its COMMIT;
// the engine's mirror is a unit of its own after that; a refusal ends in ROLLBACK and a change
// that changes nothing writes nothing. The timelines are printed for the document.
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import type { Headers } from '../../../../test/support/identity';
import * as biometricStore from '../../identity/biometric/store';
import * as identityStore from '../../identity/session-store';
import * as store from '../statements';
import {
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  USERS,
  adminApp,
  disableUrl,
  enableUrl,
  forgetCounters,
  putOperator,
  recordingPool,
  roleUrl,
  signInWeb,
  web,
  type AdminApp,
} from './support';

const db = useTestDatabase({ template: 'seed' });

// Under the load of several rows' runs a clone, a boot or a sign-in takes many times its usual
// time (seen: a 0.2 s test past the default 5 s). The limits of this file are wide enough for
// that; a real hang still fails, later.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });
let admin: AdminApp;
let owner: Pool;
let supervisor: Headers;
const timeline: string[] = [];

/** The name of a statement: a constant of this module's store or of the identity store, or what the core's unit, its writer and the engine issue. */
const NAMES = new Map<string, string>();
// This module's names are entered last: one of its statements has the text of an identity one.
for (const [prefix, module] of [
  ['identity', identityStore],
  ['biometric', biometricStore],
  ['admin', store],
] as const) {
  for (const [name, value] of Object.entries(module)) {
    if (typeof value === 'string') NAMES.set(value, `${prefix} ${name}`);
    else if (typeof value === 'object' && value !== null) for (const [key, text] of Object.entries(value)) NAMES.set(String(text), `${prefix} ${name}.${key}`);
  }
}

function nameOf(text: string, parameters: readonly unknown[]): string {
  const known = NAMES.get(text);
  if (known !== undefined) return known;
  if (text.startsWith('BEGIN')) return text;
  if (text.includes('audit_chain_lock()')) return 'chain lock';
  if (text.includes('set_config')) return 'statement timeout';
  if (text.startsWith('insert into "audit_log"')) return `INSERT audit_log ${String(parameters[3])}`;
  if (text.startsWith('insert into "events"')) return `INSERT events ${String(parameters[3])}`;
  if (/^select "id", "username", .* from "operators" order by/.test(text)) return 'engine SELECT operators (the mirror, ENG-3)';
  return text;
}

/**
 * How a unit opens is the core's: `BEGIN` at READ COMMITTED, the lock of the audit chain head
 * (AT-2), its time limit, and whatever else the core pins for a transaction. The core's tests
 * pin those statements; here an opening is ONE line of a timeline, so that a statement the core
 * adds to it does not change what this file says about the administration module.
 */
const UNIT_OPENS = ['unit  opens (BEGIN READ COMMITTED, the chain lock, the core\'s settings)'];
/** A statement of a unit that is not part of its opening: a named one, the audit insert, the end. */
const AFTER_OPENING = /^unit  (?:admin |identity |engine |INSERT |COMMIT$|ROLLBACK$)/;

/** The timeline with each opening as one line, and the openings themselves. */
function normalised(steps: readonly string[]): { steps: string[]; openings: string[][] } {
  const out: string[] = [];
  const openings: string[][] = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index] ?? '';
    if (!step.startsWith('unit  BEGIN')) {
      out.push(step);
      continue;
    }
    const opening = [step];
    while (index + 1 < steps.length && (steps[index + 1] ?? '').startsWith('unit  ') && !AFTER_OPENING.test(steps[index + 1] ?? '')) {
      index += 1;
      opening.push(steps[index] ?? '');
    }
    openings.push(opening);
    out.push(...UNIT_OPENS);
  }
  return { steps: out, openings };
}

/** Runs `work` and returns what it left on the timeline, with the status of its answer. */
async function recorded(label: string, work: () => Promise<LightMyRequestResponse>): Promise<{ status: number; steps: string[] }> {
  await admin.app.pipeline.drain();
  timeline.length = 0;
  const response = await work();
  await admin.app.pipeline.drain();
  const raw = [...timeline];
  console.info(`[w33] ${label}: ${response.statusCode}, ${raw.filter((step) => !step.startsWith('publish')).length} statements\n${raw.map((step) => `        ${step}`).join('\n')}`);
  const { steps, openings } = normalised(raw);
  // Every unit, this module's and the engine's, is one transaction at READ COMMITTED that takes the chain lock before its own first statement (AT-1, AT-2).
  for (const opening of openings) {
    expect(opening[0]).toBe('unit  BEGIN ISOLATION LEVEL READ COMMITTED');
    expect(opening).toContain('unit  chain lock');
  }
  return { status: response.statusCode, steps };
}

const STAGE_4 = 'pool  identity FIND_SESSION_BY_TRANSPORT.COOKIE';
/** `app.engine.mirrorOperators()`: a unit of the engine, after the unit of the change has committed. */
const MIRROR = [...UNIT_OPENS, 'unit  engine SELECT operators (the mirror, ENG-3)', 'unit  COMMIT'];

beforeAll(async () => {
  owner = db.ownerPool();
  admin = await adminApp(db, { createPool: recordingPool(timeline, nameOf) });
  supervisor = await signInWeb(admin, SUPERVISOR.username);
  // An open session of the operator the disable timeline disables: there is something to end.
  await signInWeb(admin, INVESTIGATOR.username);
  // The publications, on the same timeline: the seam is replaced by the test support already.
  const publish = admin.app.publish;
  admin.app.seams.replace('publish', (publication) => {
    timeline.push(`publish ${publication.kind}${publication.kind === 'state' ? ` (${publication.change.cause})` : ''}`);
    publish(publication);
  });
});

beforeEach(async () => {
  forgetCounters(admin);
  await admin.app.pipeline.drain();
  await putOperator(owner, INVESTIGATOR.id, { role: 'INVESTIGATOR', enabled: true });
  await putOperator(owner, SUPERVISOR.id, { role: 'SUPERVISOR', enabled: true });
  await putOperator(owner, TECHNICIAN.id, { role: 'TECHNICIAN', enabled: true });
  await admin.app.engine.mirrorOperators();
});

describe('operation 11 listUsers: a read', () => {
  it('two statements on the pool, no transaction: the session of stage 4 and the one list statement', async () => {
    const { status, steps } = await recorded('listUsers', () => web(admin.app, supervisor, 'GET', USERS));
    expect(status).toBe(200);
    expect(steps).toEqual([STAGE_4, 'pool  admin LIST_USERS']);
  });
});

describe('operation 12 assignUserRole: one unit, then the mirror', () => {
  it('a change: lock every operator row, read the roles of the rule, compare-and-set, the permissions, the row, the answer; COMMIT; the publications; the mirror', async () => {
    const { status, steps } = await recorded('assignUserRole, a change', () => web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR', reason: 'shift' }));
    expect(status).toBe(200);
    expect(steps).toEqual([
      STAGE_4,
      ...UNIT_OPENS,
      'unit  admin LOCK_OPERATORS',
      'unit  admin READ_ROLES_HOLDING',
      'unit  admin ASSIGN_ROLE',
      'unit  admin READ_ROLE_PERMISSIONS',
      'unit  INSERT audit_log ROLE_CHANGED',
      'unit  admin READ_USER',
      'unit  COMMIT',
      'publish state (native)',
      'publish session.updated',
      'publish admin.changed',
      ...MIRROR,
      'publish state (operators)',
    ]);
  });

  it('409 LAST_ADMIN: the lock, the roles of the rule, and ROLLBACK: no write was sent, nothing is published, no mirror', async () => {
    const { status, steps } = await recorded('assignUserRole, 409 LAST_ADMIN', () => web(admin.app, supervisor, 'POST', roleUrl(SUPERVISOR.id), { role: 'INVESTIGATOR' }));
    expect(status).toBe(409);
    expect(steps).toEqual([STAGE_4, ...UNIT_OPENS, 'unit  admin LOCK_OPERATORS', 'unit  admin READ_ROLES_HOLDING', 'unit  ROLLBACK']);
  });

  it('404: the lock, and ROLLBACK', async () => {
    const { status, steps } = await recorded('assignUserRole, 404', () => web(admin.app, supervisor, 'POST', roleUrl('OPR-999'), { role: 'INVESTIGATOR' }));
    expect(status).toBe(404);
    expect(steps).toEqual([STAGE_4, ...UNIT_OPENS, 'unit  admin LOCK_OPERATORS', 'unit  ROLLBACK']);
  });

  it('the role the operator already has: the lock and the read of the answer; no write, no row, no publication, no mirror', async () => {
    const { status, steps } = await recorded('assignUserRole, unchanged', () => web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'TECHNICIAN' }));
    expect(status).toBe(200);
    expect(steps).toEqual([STAGE_4, ...UNIT_OPENS, 'unit  admin LOCK_OPERATORS', 'unit  admin READ_USER', 'unit  COMMIT']);
  });

  it('422 and 403: no unit of this module at all', async () => {
    const invalid = await recorded('assignUserRole, 422', () => web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: 'ROOT' }));
    expect(invalid.status).toBe(422);
    expect(invalid.steps).toEqual([STAGE_4]);
    const technician = await signInWeb(admin, TECHNICIAN.username);
    const denied = await recorded('assignUserRole, 403', () => web(admin.app, technician, 'POST', roleUrl(TECHNICIAN.id), { role: 'SUPERVISOR' }));
    expect(denied.status).toBe(403);
    // The one unit is the guard's, with its denial row.
    expect(denied.steps).toEqual([STAGE_4, ...UNIT_OPENS, 'unit  INSERT audit_log ACCESS_DENIED', 'unit  COMMIT', 'publish state (native)']);
  });
});

describe('operation 14 disableUser: one unit, then the mirror', () => {
  it('a change: lock, the roles of the rule, compare-and-set, the sessions ended through the registry, the tokens revoked, the row, the answer; COMMIT; the publications; the mirror', async () => {
    const { status, steps } = await recorded('disableUser, a change', () => web(admin.app, supervisor, 'POST', disableUrl(INVESTIGATOR.id), { reason: 'leave' }));
    expect(status).toBe(200);
    expect(steps).toEqual([
      STAGE_4,
      ...UNIT_OPENS,
      'unit  admin LOCK_OPERATORS',
      'unit  admin READ_ROLES_HOLDING',
      'unit  admin DISABLE_OPERATOR',
      'unit  identity END_SESSIONS_OF_OPERATOR',
      'unit  biometric REVOKE_TOKENS.OPERATOR',
      'unit  INSERT audit_log USER_DISABLED',
      'unit  admin READ_USER',
      'unit  COMMIT',
      'publish state (native)',
      'publish session.ended',
      'publish admin.changed',
      // The slice holds no `enabled` flag: the mirror finds nothing to publish.
      ...MIRROR,
    ]);
  });

  it('409 LAST_ADMIN: the lock, the roles of the rule, and ROLLBACK: no session was ended', async () => {
    const { status, steps } = await recorded('disableUser, 409 LAST_ADMIN', () => web(admin.app, supervisor, 'POST', disableUrl(SUPERVISOR.id)));
    expect(status).toBe(409);
    expect(steps).toEqual([STAGE_4, ...UNIT_OPENS, 'unit  admin LOCK_OPERATORS', 'unit  admin READ_ROLES_HOLDING', 'unit  ROLLBACK']);
  });

  it('already disabled: the lock and the read of the answer', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'TECHNICIAN', enabled: false });
    const { status, steps } = await recorded('disableUser, unchanged', () => web(admin.app, supervisor, 'POST', disableUrl(TECHNICIAN.id)));
    expect(status).toBe(200);
    expect(steps).toEqual([STAGE_4, ...UNIT_OPENS, 'unit  admin LOCK_OPERATORS', 'unit  admin READ_USER', 'unit  COMMIT']);
  });
});

describe('operation 13 enableUser: one unit, then the mirror', () => {
  it('a change: lock the one row, compare-and-set, the row, the answer; COMMIT; the publication; the mirror', async () => {
    await putOperator(owner, TECHNICIAN.id, { role: 'TECHNICIAN', enabled: false });
    const { status, steps } = await recorded('enableUser, a change', () => web(admin.app, supervisor, 'POST', enableUrl(TECHNICIAN.id), { reason: 'back' }));
    expect(status).toBe(200);
    expect(steps).toEqual([
      STAGE_4,
      ...UNIT_OPENS,
      'unit  admin LOCK_OPERATOR',
      // Row 133 (D51): a disabled account is asked for the purge-kept mark before the compare-and-set.
      'unit  admin READ_PURGE_KEPT',
      'unit  admin ENABLE_OPERATOR',
      'unit  INSERT audit_log USER_ENABLED',
      'unit  admin READ_USER',
      'unit  COMMIT',
      'publish state (native)',
      'publish admin.changed',
      ...MIRROR,
    ]);
  });

  it('already enabled: the lock and the read of the answer; 404: the lock, and ROLLBACK', async () => {
    const unchanged = await recorded('enableUser, unchanged', () => web(admin.app, supervisor, 'POST', enableUrl(TECHNICIAN.id)));
    expect(unchanged.status).toBe(200);
    expect(unchanged.steps).toEqual([STAGE_4, ...UNIT_OPENS, 'unit  admin LOCK_OPERATOR', 'unit  admin READ_USER', 'unit  COMMIT']);
    const unknown = await recorded('enableUser, 404', () => web(admin.app, supervisor, 'POST', enableUrl('OPR-999')));
    expect(unknown.status).toBe(404);
    expect(unknown.steps).toEqual([STAGE_4, ...UNIT_OPENS, 'unit  admin LOCK_OPERATOR', 'unit  ROLLBACK']);
  });
});

describe('M13: what one command costs on this host', () => {
  it('prints the round trips and the time of each operation over 20 calls', async () => {
    const median = (values: number[]): number => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)] ?? 0;
    interface Sample {
      readonly ms: number;
      /** The statements the call sent, the mirror's included. */
      readonly statements: number;
      /** The statements a unit opens with, as the core has them today. */
      readonly opening: number;
    }
    const timed = async (call: () => Promise<LightMyRequestResponse>): Promise<Sample> => {
      await admin.app.pipeline.drain();
      timeline.length = 0;
      const started = performance.now();
      const response = await call();
      const ms = performance.now() - started;
      expect(response.statusCode).toBe(200);
      const raw = timeline.filter((step) => !step.startsWith('publish'));
      return { ms, statements: raw.length, opening: normalised(raw).openings[0]?.length ?? 0 };
    };
    const report = (label: string, samples: readonly Sample[]): Sample => {
      const times = samples.map((sample) => sample.ms);
      const last = samples.at(-1) ?? { ms: 0, statements: 0, opening: 0 };
      expect(samples.every((sample) => sample.statements === last.statements)).toBe(true);
      console.info(`[w33] cost of ${label}: ${last.statements} round trips; median ${median(times).toFixed(1)} ms, maximum ${Math.max(...times).toFixed(1)} ms over ${samples.length} calls`);
      return last;
    };

    const list: Sample[] = [];
    const role: Sample[] = [];
    const disable: Sample[] = [];
    const enable: Sample[] = [];
    for (let index = 0; index < 20; index += 1) {
      list.push(await timed(() => web(admin.app, supervisor, 'GET', USERS)));
      role.push(await timed(() => web(admin.app, supervisor, 'POST', roleUrl(TECHNICIAN.id), { role: index % 2 === 0 ? 'INVESTIGATOR' : 'TECHNICIAN' })));
      disable.push(await timed(() => web(admin.app, supervisor, 'POST', disableUrl(TECHNICIAN.id))));
      enable.push(await timed(() => web(admin.app, supervisor, 'POST', enableUrl(TECHNICIAN.id))));
    }
    // One read of stage 4 in each. A write is its unit (the opening, its own statements, COMMIT)
    // and the mirror's unit (the opening, one read, COMMIT).
    expect(report('listUsers', list).statements).toBe(2);
    const changed = report('assignUserRole (a change)', role);
    const open = changed.opening;
    expect(open).toBeGreaterThanOrEqual(2);
    console.info(`[w33] a unit opens with ${open} statements (BEGIN and the core's own)`);
    expect(changed.statements).toBe(1 + (open + 6 + 1) + (open + 1 + 1));
    expect(report('disableUser (a change, no open session)', disable).statements).toBe(1 + (open + 7 + 1) + (open + 1 + 1));
    // Row 133 / D51: + READ_PURGE_KEPT (the purge-kept mark is asked before the compare-and-set).
    expect(report('enableUser (a change)', enable).statements).toBe(1 + (open + 5 + 1) + (open + 1 + 1));
  });
});
