// Two properties of the module that only show when things happen at the same time (plan row
// W35; spec ENG-1, ENG-6, §7.9; database contract §4.17 to §4.19):
//
//   1. A read is ONE snapshot. An item is rows of three tables; a command that commits between
//      two statements of a read must not give an item whose status is of before and whose
//      custody chain is of after. Shown by holding a read back between its statements while a
//      verification of the same item commits.
//   2. Commands that arrive together are serialised by the engine's pipeline: each gets its own
//      export ID, its own audit row and its own custody entry, and the chain has no gap.
//
// The real app, booted, on this file's own clones of the seed template.
import { EvidenceDetailSchema, EvidencePageSchema } from '@dems/shared/api';
import type { Pool, PoolClient, QueryConfig } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import type { DatabaseConnection } from '../../../config';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { EVIDENCE, countOf, evidenceApp, exportUrl, itemUrl, storedCustody, storedState, trailLength, trailSince, verifyUrl } from './support';

const db = useTestDatabase({ template: 'seed' });

type PoolFactory = (connection: DatabaseConnection) => Pool;

interface Hold {
  /** Resolves when the statement has arrived and is being held back. */
  readonly reached: Promise<void>;
  /** Lets the held statement go to the database. */
  release(): void;
}

interface StatementGate {
  /** Wraps a pool factory: every checked-out connection passes its statements through the gate. */
  wrap(inner: PoolFactory): PoolFactory;
  /** The NEXT statement whose text matches is held back until `release()`. */
  holdNext(pattern: RegExp): Hold;
}

function statementGate(): StatementGate {
  let pending: { readonly pattern: RegExp; arrived(): void; readonly open: Promise<void> } | null = null;

  const gated = (client: PoolClient): PoolClient =>
    new Proxy(client, {
      get(target, property, receiver) {
        if (property === 'query') {
          return async (query: string | QueryConfig, values?: unknown[]) => {
            const text = typeof query === 'string' ? query : query.text;
            const hold = pending;
            if (hold !== null && hold.pattern.test(text)) {
              pending = null;
              hold.arrived();
              await hold.open;
            }
            const send = target.query.bind(target) as (statement: string | QueryConfig, parameters?: unknown[]) => Promise<unknown>;
            return values === undefined ? send(query) : send(query, values);
          };
        }
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });

  return {
    wrap(inner) {
      return (connection) =>
        new Proxy(inner(connection), {
          get(target, property, receiver) {
            if (property === 'connect') return async () => gated(await target.connect());
            const value: unknown = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
          },
        });
    },
    holdNext(pattern) {
      let arrived = (): void => {};
      let release = (): void => {};
      const reached = new Promise<void>((resolve) => {
        arrived = resolve;
      });
      const open = new Promise<void>((resolve) => {
        release = resolve;
      });
      pending = { pattern, arrived, open };
      return { reached, release };
    },
  };
}

describe('a read is one snapshot of the three tables', () => {
  it('getEvidence: a verification that commits between the item statement and the custody statement is not half-seen', async () => {
    const gate = statementGate();
    const target = await db.another({ slug: 'w35_snapshot_item' });
    const host = await evidenceApp(target, db.run.dataDir, { wrapPool: gate.wrap });
    const owner = target.ownerPool();
    const session = await host.signIn('INVESTIGATOR');
    const item = host.engine.slice('evidence').find((entry) => entry.status === 'SEALED' && !entry.tampered && entry.verification.status === 'NOT_RUN');
    if (item === undefined) throw new Error('the seed has such an item');
    const custodyBefore = await storedCustody(owner, item.id);

    // The read has begun and has read the item's row; its next statement (the tracks) is held.
    const hold = gate.holdNext(/from "evidence_tracks"/);
    const reading = host.get(itemUrl(item.id), session);
    await hold.reached;

    // Meanwhile a verification of the same item is committed: verification PASS and one more custody entry.
    const verified = await host.post(verifyUrl(item.id), session);
    expect(verified.statusCode).toBe(200);
    expect(await storedState(owner, item.id)).toMatchObject({ verificationStatus: 'PASS' });
    expect(await storedCustody(owner, item.id)).toHaveLength(custodyBefore.length + 1);

    hold.release();
    const response = await reading;
    expect(response.statusCode).toBe(200);
    const { evidence } = EvidenceDetailSchema.parse(response.json());
    // The whole item is as it was BEFORE the verification: not a row of before with a chain of after.
    expect(evidence.verification).toEqual({ status: 'NOT_RUN', at: null });
    expect(evidence.custody).toHaveLength(custodyBefore.length);
    expect(evidence.custody.map((entry) => entry.action)).not.toContain('VERIFIED');

    // A read that starts after the commit sees all of it.
    const after = EvidenceDetailSchema.parse((await host.get(itemUrl(item.id), session)).json()).evidence;
    expect(after.verification.status).toBe('PASS');
    expect(after.custody.at(-1)?.action).toBe('VERIFIED');
    expect(after.custody).toHaveLength(custodyBefore.length + 1);
  });

  it('listEvidence: an export that commits between the item statement and the custody statement is not half-seen in any item of the page', async () => {
    const gate = statementGate();
    const target = await db.another({ slug: 'w35_snapshot_list' });
    const host = await evidenceApp(target, db.run.dataDir, { wrapPool: gate.wrap });
    const investigator = await host.signIn('INVESTIGATOR');
    const supervisor = await host.signIn('SUPERVISOR');
    const item = host.engine.slice('evidence').find((entry) => entry.status === 'SEALED' && !entry.tampered);
    if (item === undefined) throw new Error('the seed has such an item');

    const hold = gate.holdNext(/from "evidence_custody"/);
    const reading = host.get(EVIDENCE, investigator);
    await hold.reached;
    expect((await host.post(exportUrl(item.id), supervisor, { reason: 'Prosecutor request' })).statusCode).toBe(202);
    hold.release();

    const page = EvidencePageSchema.parse((await reading).json());
    const listed = page.items.find((entry) => entry.id === item.id);
    // SEALED and no EXPORTED entry: both of before. Never "SEALED with an EXPORTED entry".
    expect(listed?.status).toBe('SEALED');
    expect(listed?.custody.map((entry) => entry.action)).not.toContain('EXPORTED');
    expect(listed?.custody).toHaveLength(item.custody.length);

    const again = EvidencePageSchema.parse((await host.get(EVIDENCE, investigator)).json()).items.find((entry) => entry.id === item.id);
    expect(again?.status).toBe('EXPORTED');
    expect(again?.custody.at(-1)?.action).toBe('EXPORTED');
  });
});

describe('ENG-6: commands that arrive together are serialised', () => {
  it('two exports and ten verifications of one item at once: every one is accepted, each with its own row, export ID and custody entry, and the chain has no gap', async () => {
    const target = await db.another({ slug: 'w35_together' });
    const host = await evidenceApp(target, db.run.dataDir);
    const owner = target.ownerPool();
    const supervisor = await host.signIn('SUPERVISOR');
    const investigator = await host.signIn('INVESTIGATOR');
    const technician = await host.signIn('TECHNICIAN');
    const item = host.engine.slice('evidence').find((entry) => entry.status === 'SEALED' && !entry.tampered);
    if (item === undefined) throw new Error('the seed has such an item');
    const before = { trail: await trailLength(owner), custody: await storedCustody(owner, item.id), exports: await countOf(owner, 'exports'), revision: host.engine.revision };

    const answers = await Promise.all([
      host.post(exportUrl(item.id), supervisor, { reason: 'First copy for the court' }),
      host.post(exportUrl(item.id), supervisor, { reason: 'Second copy for the court' }),
      ...Array.from({ length: 10 }, (_, index) => host.post(verifyUrl(item.id), index % 2 === 0 ? investigator : technician)),
    ]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([202, 202, ...Array<number>(10).fill(200)]);

    // Two different export IDs, consecutive.
    const exportIds = answers.slice(0, 2).map((answer) => (answer.json() as { exportId: string }).exportId).sort();
    expect(exportIds).toEqual(['EXP-000032', 'EXP-000033']);
    expect(await countOf(owner, 'exports')).toBe(before.exports + 2);

    // Twelve rows, one per command, each naming its caller; the chain links without a gap and verifies.
    const rows = await trailSince(owner, before.trail);
    expect(rows).toHaveLength(12);
    expect(rows.filter((row) => row.type === 'EVIDENCE_EXPORTED')).toHaveLength(2);
    expect(rows.filter((row) => row.type === 'EVIDENCE_VERIFIED')).toHaveLength(10);
    expect(rows.filter((row) => row.actorId === host.operator('INVESTIGATOR').id)).toHaveLength(5);
    expect(rows.filter((row) => row.actorId === host.operator('TECHNICIAN').id)).toHaveLength(5);
    const trail = await readTrail(owner);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true });

    // Twelve custody entries more, numbered without a gap, and the old ones as they were.
    const custody = await storedCustody(owner, item.id);
    expect(custody.slice(0, before.custody.length)).toEqual(before.custody);
    expect(custody.map((entry) => entry.seq)).toEqual(custody.map((_, index) => index + 1));
    expect(custody).toHaveLength(before.custody.length + 12);

    // Every answer names a revision of its own: twelve consecutive ones.
    const revisions = answers.map((answer) => Number(answer.headers['x-dems-revision'])).sort((a, b) => a - b);
    expect(revisions).toEqual(Array.from({ length: 12 }, (_, index) => before.revision + 1 + index));
    expect(host.engine.revision).toBe(before.revision + 12);
    expect(host.database.connections.inUse).toBe(0);
  });
});
