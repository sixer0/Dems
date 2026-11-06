// The biometric operations beside a BOOTED engine (plan rows W41 and W26; spec §7.1 API-7, §8.3
// ENG-8, §4.7, §9.3 RT-5). The other files of this folder leave the engine unbooted; this one
// runs the boot steps, so the engine host is rehydrated and takes the rows of the biometric units
// into its ring when they commit.
//
// What is proven: the rows of an enrolment, a sign-in, a reuse and a failure report continue the
// ONE chain the engine also writes (no divergence, nothing reloaded); each reaches the realtime
// channel as a state change BEFORE this folder's own publication of the same unit (`session.ended`
// comes after the delta that holds its `AUTH_FAILED` row); and the answer of each POST names the
// revision that holds its effect.
//
// A booted engine RUNS (decision D77): this file gives it a manual timer before the boot, so the
// engine ticks exactly when a test fires it, and every count here is relative to the trail AFTER
// the boot (the first start on a fresh seed writes a row of its own), never to the seed.
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../../test/support/core';
import { engineControl } from '../../../../engine';
import { manualTimer } from '../../../../../test/support/engine';
import { MINUTE } from '../../../../../test/support/identity';
import {
  INVESTIGATOR,
  biometricApp,
  biometricSignIn,
  pairDevice,
  passwordSession,
  reportFailure,
  setEnrolment,
  supervisorCookie,
  type BiometricApp,
  type PairedTestDevice,
} from './support';

// A clone, a booted app and many requests: under the load of parallel rows the default limits are too short (finding F-9 of the administration row).
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const db = useTestDatabase({ template: 'seed' });
let bio: BiometricApp;
let owner: Pool;
let tablet: PairedTestDevice;
const engineTimer = manualTimer();
/** The length of the trail when the journey of this file starts: the seed, the first start, and the pairing of the tablet. */
let rowsBefore = 0;

beforeAll(async () => {
  owner = db.ownerPool();
  bio = await biometricApp(db);
  engineControl(bio.app).useTimer(engineTimer.timer);
  await bio.app.readiness.boot();
  await engineControl(bio.app).idle();
  await bio.app.pipeline.drain();
  tablet = await pairDevice(bio, await supervisorCookie(bio), 'Interview tablet 01');
});

/** The publications so far as short names: a state change by the audit types it appends. */
function publicationNames(from = 0): string[] {
  return bio.published.slice(from).map((publication) => {
    if (publication.kind === 'state') {
      const change = publication.change as { ops?: ReadonlyArray<{ op: string; slice: string; rows?: ReadonlyArray<{ type: string }> }> };
      const types = (change.ops ?? []).filter((op) => op.op === 'append' && op.slice === 'audit').flatMap((op) => (op.rows ?? []).map((row) => row.type));
      return `state[${types.join(',')}]`;
    }
    if (publication.kind === 'session.ended') return `session.ended ${publication.reason} x${publication.sessionIds.length}`;
    if (publication.kind === 'admin.changed') return `admin.changed ${publication.resource}`;
    return publication.kind;
  });
}

/** The revision of the last published state change that appends an audit row of `type`. */
function revisionOf(type: string): number | undefined {
  let revision: number | undefined;
  for (const publication of bio.published) {
    if (publication.kind !== 'state') continue;
    const change = publication.change as { revision: number; ops?: ReadonlyArray<{ op: string; slice: string; rows?: ReadonlyArray<{ type: string }> }> };
    if ((change.ops ?? []).some((op) => op.op === 'append' && op.slice === 'audit' && (op.rows ?? []).some((row) => row.type === type))) revision = change.revision;
  }
  return revision;
}

const revisionHeader = (response: LightMyRequestResponse): number => Number(response.headers['x-dems-revision']);

describe('API-7 and ENG-8 with the engine running', () => {
  it('the engine is ready after the boot, with an epoch of at least 1, and runs on the timer this file gave it', () => {
    expect(bio.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(bio.app.engine.epoch).toBeGreaterThanOrEqual(1);
    expect(engineTimer.active()).toBeGreaterThanOrEqual(1);
  });

  it('each POST answer names the epoch and the revision of the state change that holds its audit row; session.ended of a reuse comes after the state change with its AUTH_FAILED', async () => {
    const epoch = String(bio.app.engine.epoch);
    const sessionToken = await passwordSession(bio.app, tablet, INVESTIGATOR.username);
    await bio.app.pipeline.drain();
    rowsBefore = (await readTrail(owner)).length;
    let mark = bio.published.length;
    const step = (): string[] => {
      const names = publicationNames(mark);
      mark = bio.published.length;
      return names;
    };

    // 7 on
    const enrolled = await setEnrolment(bio.app, sessionToken, { enabled: true });
    expect(enrolled.statusCode).toBe(200);
    expect(enrolled.headers['x-dems-epoch']).toBe(epoch);
    expect(revisionHeader(enrolled)).toBe(revisionOf('BIOMETRIC_ENROLLMENT_CHANGED'));
    expect(step()).toEqual(['state[BIOMETRIC_ENROLLMENT_CHANGED]']);
    const token = (enrolled.json() as { token: string }).token;

    // 8, a success
    bio.clock.advance(MINUTE);
    const signedIn = await biometricSignIn(bio.app, tablet.credential, token);
    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.headers['x-dems-epoch']).toBe(epoch);
    expect(revisionHeader(signedIn)).toBe(revisionOf('AUTH_SUCCESS'));
    expect(revisionHeader(signedIn)).toBeGreaterThan(revisionHeader(enrolled));
    // A sign-in on the device changes its signed-in operator: the channel is told (E-fix FX-C, R4).
    expect(step()).toEqual(['state[AUTH_SUCCESS]', 'device.session']);

    // 8, the reuse: a refusal carries neither header (API-7 speaks of 2xx answers).
    const replay = await biometricSignIn(bio.app, tablet.credential, token);
    expect(replay.statusCode).toBe(401);
    expect(replay.headers['x-dems-revision']).toBeUndefined();
    // The reuse ends the device's biometric session: its operator leaves the device (R4), then session.ended.
    expect(step()).toEqual(['state[AUTH_FAILED]', 'device.session', 'session.ended TOKEN_REUSE x1']);

    // 9
    const reported = await reportFailure(bio.app, tablet.credential, INVESTIGATOR.id);
    expect(reported.statusCode).toBe(200);
    expect(revisionHeader(reported)).toBe(revisionOf('AUTH_FAILED'));
    expect(revisionHeader(reported)).toBeGreaterThan(revisionHeader(signedIn));
    expect(step()).toEqual(['state[AUTH_FAILED]']);

    // 7 off: nothing is enrolled any more (the reuse revoked the family), so nothing changes: the current revision is named.
    const off = await setEnrolment(bio.app, sessionToken, { enabled: false });
    expect(off.statusCode).toBe(200);
    expect(revisionHeader(off)).toBe(revisionHeader(reported));
    expect(step()).toEqual([]);
  });

  it('the biometric rows continue the one chain: it verifies over all rows, also after a tick of the engine, which never saw its head diverge', async () => {
    await bio.app.pipeline.drain();
    const written = (await readTrail(owner)).slice(rowsBefore);
    expect(written.map((row) => row.type)).toEqual(['BIOMETRIC_ENROLLMENT_CHANGED', 'AUTH_SUCCESS', 'AUTH_FAILED', 'AUTH_FAILED']);

    // One tick of the engine on top of them: whatever it writes continues the same chain.
    engineTimer.fire();
    await engineControl(bio.app).idle();
    await bio.app.pipeline.drain();

    const rows = await readTrail(owner);
    const head = await readHead(owner);
    expect(rows.slice(rowsBefore, rowsBefore + 4).map((row) => row.type)).toEqual(['BIOMETRIC_ENROLLMENT_CHANGED', 'AUTH_SUCCESS', 'AUTH_FAILED', 'AUTH_FAILED']);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
    const lines = bio.log.lines();
    expect(lines.filter((line) => line['msg'] === 'audit head diverged')).toEqual([]);
    expect(lines.filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });
});
