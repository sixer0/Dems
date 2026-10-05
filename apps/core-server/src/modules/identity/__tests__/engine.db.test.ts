// The identity core beside a BOOTED engine (plan rows W24 and W26; spec §7.1 API-7, §8.3 ENG-8,
// §9.3 RT-5). The other files of this folder leave the engine unbooted; this one runs the boot
// steps, so the engine host is rehydrated and takes the rows of the identity units into its
// ring when they commit.
//
// What is proven: the rows of a sign-in, a failed attempt and a sign-out continue the ONE chain
// the engine also writes (no divergence, nothing reloaded), each reaches the realtime channel
// as a state change, and the answer of each POST names the revision that holds its effect.
//
// A booted engine RUNS (decision D77): on the system timer it would tick every 50 ms and write
// rows of its own at moments no test chooses. This file gives it a manual timer before the boot,
// so the engine ticks exactly when a test fires it, and every count here is relative to the trail
// AFTER the boot (the first start on a fresh seed writes a row of its own), never to the seed.
import { OPERATORS } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { engineControl } from '../../../engine';
import { manualTimer } from '../../../../test/support/engine';
import type { Publication } from '../../../realtime';
import { SIGN_OUT, TOUCH, identityApp, signInOnWeb, webPost, webSignIn, type IdentityApp } from '../../../../test/support/identity';

const db = useTestDatabase({ template: 'seed' });
let identity: IdentityApp;
let owner: Pool;
const published: Publication[] = [];
const engineTimer = manualTimer();
/** The length of the trail once the app has booted: what the seed holds and what the first start wrote. */
let rowsAfterBoot = 0;

const SUPERVISOR = OPERATORS[1]!;

beforeAll(async () => {
  owner = db.ownerPool();
  identity = await identityApp(db);
  identity.app.seams.replace('publish', (publication) => void published.push(publication));
  engineControl(identity.app).useTimer(engineTimer.timer);
  await identity.app.readiness.boot();
  await engineControl(identity.app).idle();
  await identity.app.pipeline.drain();
  rowsAfterBoot = (await readTrail(owner)).length;
});

/** The state changes published so far that append audit rows, as `[revision, audit types]`. */
function auditChanges(): Array<[number, string[]]> {
  const changes: Array<[number, string[]]> = [];
  for (const publication of published) {
    if (publication.kind !== 'state') continue;
    const change = publication.change as { revision: number; ops?: ReadonlyArray<{ op: string; slice: string; rows?: ReadonlyArray<{ type: string }> }> };
    const types = (change.ops ?? []).filter((op) => op.op === 'append' && op.slice === 'audit').flatMap((op) => (op.rows ?? []).map((row) => row.type));
    if (types.length > 0) changes.push([change.revision, types]);
  }
  return changes;
}

describe('API-7 and ENG-8 with the engine running', () => {
  it('the engine is ready after the boot, with an epoch of at least 1, and runs on the timer this file gave it', () => {
    expect(identity.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(identity.app.engine.epoch).toBeGreaterThanOrEqual(1);
    expect(engineTimer.active()).toBeGreaterThanOrEqual(1);
  });

  it('each POST answer names the epoch and the revision of the state change that holds its audit row', async () => {
    const epoch = String(identity.app.engine.epoch);

    const signedIn = await signInOnWeb(identity, SUPERVISOR.username);
    expect(signedIn.response.headers['x-dems-epoch']).toBe(epoch);
    const signInRevision = Number(signedIn.response.headers['x-dems-revision']);
    expect(auditChanges().find(([, types]) => types.includes('AUTH_SUCCESS'))?.[0]).toBe(signInRevision);

    const failed = await webSignIn(identity.app, SUPERVISOR.username, 'not-the-password-w24');
    expect(failed.statusCode).toBe(401);
    // API-7 speaks of 2xx answers; a refusal carries neither header.
    expect(failed.headers['x-dems-revision']).toBeUndefined();
    expect(auditChanges().some(([, types]) => types.includes('AUTH_FAILED'))).toBe(true);

    identity.clock.advance(60_000);
    const touched = await webPost(identity.app, TOUCH, signedIn.cookie);
    expect(touched.headers['x-dems-epoch']).toBe(epoch);
    // A touch writes no replicated row: the current revision is named.
    expect(Number(touched.headers['x-dems-revision'])).toBeGreaterThanOrEqual(signInRevision);

    const signedOut = await webPost(identity.app, SIGN_OUT, signedIn.cookie);
    expect(signedOut.statusCode).toBe(204);
    const signOutRevision = Number(signedOut.headers['x-dems-revision']);
    expect(auditChanges().find(([, types]) => types.includes('AUTH_SIGNED_OUT'))?.[0]).toBe(signOutRevision);
    expect(signOutRevision).toBeGreaterThan(signInRevision);
  });

  it('the identity rows continue the one chain: it verifies over all rows, also after a tick of the engine, which never saw its head diverge', async () => {
    await identity.app.pipeline.drain();
    // Exactly the three rows of the test above since the boot: the engine has not ticked.
    const written = (await readTrail(owner)).slice(rowsAfterBoot);
    expect(written.map((row) => row.type)).toEqual(['AUTH_SUCCESS', 'AUTH_FAILED', 'AUTH_SIGNED_OUT']);

    // One tick of the engine on top of them: whatever it writes continues the same chain.
    engineTimer.fire();
    await engineControl(identity.app).idle();
    await identity.app.pipeline.drain();

    const rows = await readTrail(owner);
    const head = await readHead(owner);
    expect(rows.length).toBeGreaterThanOrEqual(rowsAfterBoot + 3);
    expect(rows.slice(rowsAfterBoot, rowsAfterBoot + 3).map((row) => row.type)).toEqual(['AUTH_SUCCESS', 'AUTH_FAILED', 'AUTH_SIGNED_OUT']);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
    const lines = identity.log.lines();
    expect(lines.filter((line) => line['msg'] === 'audit head diverged')).toEqual([]);
    expect(lines.filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });
});
