// The pairing module beside a BOOTED engine (plan rows W32 and W26; spec §7.1 API-7, §8.3 ENG-8,
// §4.7, §9.3 RT-5). The other files of this folder leave the engine unbooted; this one runs the
// boot steps, so the engine host is rehydrated and takes the rows of the pairing units into its
// ring when they commit.
//
// What is proven: the rows of an issue, a redeem, a failure, a rotation, a revoke and an unpair
// continue the ONE chain the engine also writes (no divergence, nothing reloaded); each reaches
// the realtime channel as a state change BEFORE the module's own publication of the same unit;
// and the answer of each POST names the revision that holds its effect.
//
// A booted engine RUNS (decision D77): this file gives it a manual timer before the boot, so the
// engine ticks exactly when a test fires it, and every count here is relative to the trail AFTER
// the boot (the first start on a fresh seed writes a row of its own), never to the seed.
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { engineControl } from '../../../engine';
import { manualTimer } from '../../../../test/support/engine';
import type { Headers } from '../../../../test/support/identity';
import { CODE_CANCEL, ROTATE, UNPAIR, devicePost, issueCode, pairingApp, portalPost, redeem, revokeUrl, supervisorCookie, wrongCodeFor, type PairingApp } from '../../../../test/support/pairing';

const db = useTestDatabase({ template: 'seed' });
let pairing: PairingApp;
let owner: Pool;
let cookie: Headers;
const engineTimer = manualTimer();
/** The length of the trail once the app has booted: what the seed holds and what the first start wrote. */
let rowsAfterBoot = 0;

beforeAll(async () => {
  owner = db.ownerPool();
  pairing = await pairingApp(db);
  engineControl(pairing.app).useTimer(engineTimer.timer);
  await pairing.app.readiness.boot();
  await engineControl(pairing.app).idle();
  await pairing.app.pipeline.drain();
  rowsAfterBoot = (await readTrail(owner)).length;
  cookie = await supervisorCookie(pairing);
});

/** The publications so far as short names: a state change by the audit types it appends. */
function publicationNames(from = 0): string[] {
  return pairing.published.slice(from).map((publication) => {
    if (publication.kind === 'state') {
      const change = publication.change as { ops?: ReadonlyArray<{ op: string; slice: string; rows?: ReadonlyArray<{ type: string }> }> };
      const types = (change.ops ?? []).filter((op) => op.op === 'append' && op.slice === 'audit').flatMap((op) => (op.rows ?? []).map((row) => row.type));
      return `state[${types.join(',')}]`;
    }
    if (publication.kind === 'admin.changed') return `admin.changed ${publication.resource}`;
    if (publication.kind === 'device.revoked') return `device.revoked ${publication.reason}`;
    return publication.kind;
  });
}

/** The revision of the published state change that appends an audit row of `type`; the last one when several did. */
function revisionOf(type: string): number | undefined {
  let revision: number | undefined;
  for (const publication of pairing.published) {
    if (publication.kind !== 'state') continue;
    const change = publication.change as { revision: number; ops?: ReadonlyArray<{ op: string; slice: string; rows?: ReadonlyArray<{ type: string }> }> };
    if ((change.ops ?? []).some((op) => op.op === 'append' && op.slice === 'audit' && (op.rows ?? []).some((row) => row.type === type))) revision = change.revision;
  }
  return revision;
}

const revisionHeader = (response: LightMyRequestResponse): number => Number(response.headers['x-dems-revision']);

describe('API-7 and ENG-8 with the engine running', () => {
  it('the engine is ready after the boot, with an epoch of at least 1, and runs on the timer this file gave it', () => {
    expect(pairing.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(pairing.app.engine.epoch).toBeGreaterThanOrEqual(1);
    expect(engineTimer.active()).toBeGreaterThanOrEqual(1);
  });

  it('each POST answer names the epoch and the revision of the state change that holds its audit row; the module\'s own publication of a unit comes after that state change', async () => {
    const epoch = String(pairing.app.engine.epoch);
    let mark = pairing.published.length;
    const step = (): string[] => {
      const names = publicationNames(mark);
      mark = pairing.published.length;
      return names;
    };

    // 15 issue
    const issued = await issueCode(pairing, cookie);
    expect(issued.response.headers['x-dems-epoch']).toBe(epoch);
    expect(revisionHeader(issued.response)).toBe(revisionOf('PAIRING_CODE_ISSUED'));
    expect(step()).toEqual(['state[PAIRING_CODE_ISSUED]', 'admin.changed PAIRING_CODE']);

    // 18 redeem, a failure: API-7 speaks of 2xx answers; a refusal carries neither header, and its row is published.
    const failed = await redeem(pairing.app, wrongCodeFor(issued.code));
    expect(failed.statusCode).toBe(401);
    expect(failed.headers['x-dems-revision']).toBeUndefined();
    expect(failed.headers['x-dems-epoch']).toBeUndefined();
    expect(step()).toEqual(['state[PAIRING_FAILED]', 'admin.changed PAIRING_CODE']);

    // 18 redeem, the right code
    const paired = await redeem(pairing.app, issued.code);
    expect(paired.statusCode).toBe(201);
    expect(paired.headers['x-dems-epoch']).toBe(epoch);
    expect(revisionHeader(paired)).toBe(revisionOf('PAIRING_SUCCESS'));
    expect(revisionHeader(paired)).toBeGreaterThan(revisionHeader(issued.response));
    expect(step()).toEqual(['state[PAIRING_SUCCESS]', 'admin.changed DEVICES', 'admin.changed PAIRING_CODE']);
    const { deviceId, deviceCredential } = paired.json() as { deviceId: string; deviceCredential: string };

    // 23 rotate
    const rotated = await devicePost(pairing.app, ROTATE, deviceCredential);
    expect(rotated.statusCode).toBe(200);
    expect(revisionHeader(rotated)).toBe(revisionOf('DEVICE_CREDENTIAL_ROTATED'));
    expect(step()).toEqual(['state[DEVICE_CREDENTIAL_ROTATED]', 'admin.changed DEVICES']);

    // 17 cancel with no code active: nothing replicated changes; the current revision is named.
    const idle = await portalPost(pairing.app, CODE_CANCEL, cookie);
    expect(idle.statusCode).toBe(204);
    expect(idle.headers['x-dems-epoch']).toBe(epoch);
    expect(revisionHeader(idle)).toBe(revisionHeader(rotated));
    expect(step()).toEqual([]);

    // 20 revoke: the state change with the row first, then `device.revoked` for the sockets, then the portal's list.
    const revoked = await portalPost(pairing.app, revokeUrl(deviceId), cookie, { reason: 'Revoked beside a running engine' });
    expect(revoked.statusCode).toBe(200);
    expect(revisionHeader(revoked)).toBe(revisionOf('DEVICE_REVOKED'));
    expect(step()).toEqual(['state[DEVICE_REVOKED]', 'device.revoked REVOKED', 'admin.changed DEVICES']);

    // 22 unpair of a second device
    const second = await issueCode(pairing, cookie);
    const other = (await redeem(pairing.app, second.code)).json() as { deviceCredential: string };
    step();
    const unpaired = await devicePost(pairing.app, UNPAIR, other.deviceCredential);
    expect(unpaired.statusCode).toBe(204);
    expect(unpaired.headers['x-dems-epoch']).toBe(epoch);
    expect(revisionHeader(unpaired)).toBe(revisionOf('UNPAIRED'));
    expect(step()).toEqual(['state[UNPAIRED]', 'device.revoked UNPAIRED', 'admin.changed DEVICES']);
  });

  it('the pairing rows continue the one chain: it verifies over all rows, also after a tick of the engine, which never saw its head diverge', async () => {
    await pairing.app.pipeline.drain();
    // Exactly the rows of the test above since the boot (and the supervisor's sign-in): the engine has not ticked.
    const written = (await readTrail(owner)).slice(rowsAfterBoot).map((row) => row.type);
    expect(written).toEqual([
      'AUTH_SUCCESS',
      'PAIRING_CODE_ISSUED',
      'PAIRING_FAILED',
      'PAIRING_SUCCESS',
      'DEVICE_CREDENTIAL_ROTATED',
      'DEVICE_REVOKED',
      'PAIRING_CODE_ISSUED',
      'PAIRING_SUCCESS',
      'UNPAIRED',
    ]);

    // One tick of the engine on top of them: whatever it writes continues the same chain.
    engineTimer.fire();
    await engineControl(pairing.app).idle();
    await pairing.app.pipeline.drain();

    const rows = await readTrail(owner);
    const head = await readHead(owner);
    expect(rows.slice(rowsAfterBoot, rowsAfterBoot + written.length).map((row) => row.type)).toEqual(written);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
    const lines = pairing.log.lines();
    expect(lines.filter((line) => line['msg'] === 'audit head diverged')).toEqual([]);
    expect(lines.filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });

  it('the engine\'s own slices are not touched by pairing: the replicated state names no paired device, no code and no credential', () => {
    const state = JSON.stringify(pairing.app.engine.state());
    expect(state).not.toMatch(/dvc_[A-Za-z0-9_-]{43}/);
    expect(state).not.toMatch(/DEMS-PAIR/);
    // What a client learns of pairing through the state topic are the audit rows and the events.
    const audit = pairing.app.engine.slice('audit') as unknown as { rows?: ReadonlyArray<{ type: string }> } | ReadonlyArray<{ type: string }>;
    const rows = Array.isArray(audit) ? audit : ((audit as { rows?: ReadonlyArray<{ type: string }> }).rows ?? []);
    expect(rows.some((row) => row.type === 'PAIRING_SUCCESS')).toBe(true);
  });
});
