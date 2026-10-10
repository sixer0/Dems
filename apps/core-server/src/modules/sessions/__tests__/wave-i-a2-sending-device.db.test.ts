// FIX WAVE I, DRIVER A2 - finding G75b-04 of re-gate 75 (`gateway_check/10b_m5_regate.md` section
// 6), ruling D216 (2): every STORED audit row of a session action a PAIRED DEVICE sent names that
// device - SESSION_CREATED, PRECHECK_BLOCKED / PRECHECK_PASSED, RECORDING_STARTED,
// RECORDING_STOPPED, SESSION_CANCELLED - as the switch row does. Web-sent actions keep no device.
//
// The real app on a clone of the seed, as `dems_app`, with the engine booted on a manual clock and
// a manual timer (simulated capture: no worker, no device). A command of a device session is the
// hosted action under the principal stage 4 resolves for a paired device's bearer session: the
// operator, bound to `DEV-0001` (the idiom of `capture-config.db.test.ts`, finding G70-05). The
// rows are read from the TABLE as `dems_owner`, and the audit chain is verified at the end.
import { CAPTURE_CONNECT_MS, type AuditRow } from '@dems/shared/sim';
import { ActiveSessionSchema } from '@dems/shared/api';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { storedSlices } from '../../../../test/support/engine';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { devicesApp, type DevicesApp } from '../../devices/__tests__/support';
import { sessionInput } from './support';

const db = useTestDatabase({ template: 'seed' });
const DEVICE = 'DEV-0001';
const SESSION_TYPES = ['SESSION_CREATED', 'PRECHECK_BLOCKED', 'PRECHECK_PASSED', 'RECORDING_STARTED', 'RECORDING_STOPPED', 'SESSION_CANCELLED'];

let server: DevicesApp;
beforeAll(async () => {
  server = await devicesApp(db);
});

const sessionRows = (rows: readonly AuditRow[]): [string, string | null][] => rows.filter((row) => SESSION_TYPES.includes(row.type)).map((row) => [row.type, row.deviceId ?? null]);

describe('G75b-04: the stored rows of the session actions name the paired device that sent them', () => {
  it('a session driven from a device session: created, pre-check blocked, pre-check passed, cancelled; then created, passed, started, stopped - every row carries DEV-0001, and the stored state equals the committed state', async () => {
    const investigator = server.principal('INVESTIGATOR');
    const fromDevice = { ...investigator, deviceId: DEVICE };
    const before = await server.trailLength();

    // A process start leaves the Core link OFFLINE: the first pre-check ends BLOCKED, by itself, on a tick.
    await server.engine.command(fromDevice, 'createSession', sessionInput(investigator.operatorId, 'LP/2026/1010-0101'));
    await server.engine.command(fromDevice, 'beginPrecheck');
    expect(server.engine.slice('session')?.precheck.sendingDeviceId).toBe(DEVICE);
    await server.drive(6_000);
    expect(server.engine.slice('session')?.precheck.outcome).toBe('BLOCK');
    // The stored pre-check holds the member and reads back as the committed one (no migration: a member of the stored JSON).
    await server.app.pipeline.drain();
    expect(await storedSlices(server.owner)).toStrictEqual(withoutNegativeZeros(server.engine.state()));
    expect(ActiveSessionSchema.safeParse(server.engine.slice('session')).success).toBe(true);

    await server.engine.setTabletLink('CONNECTED');
    await server.engine.command(fromDevice, 'retryPrecheck');
    await server.drive(6_000);
    expect(server.engine.slice('session')?.state).toBe('ARMED');
    await server.engine.command(fromDevice, 'cancel');
    expect(server.engine.slice('session')).toBeNull();

    await server.engine.command(fromDevice, 'createSession', sessionInput(investigator.operatorId, 'LP/2026/1010-0102'));
    await server.engine.command(fromDevice, 'beginPrecheck');
    await server.drive(6_000);
    expect(server.engine.slice('session')?.state).toBe('ARMED');
    await server.engine.command(fromDevice, 'startRecording');
    await server.drive(CAPTURE_CONNECT_MS + 2_000);
    expect(server.engine.slice('session')).toMatchObject({ state: 'RECORDING' });
    await server.engine.command(fromDevice, 'stopRecording', 'Interview finished');
    await server.app.pipeline.drain();

    const rows = await server.since(before);
    expect(sessionRows(rows)).toEqual([
      ['SESSION_CREATED', DEVICE],
      ['PRECHECK_BLOCKED', DEVICE],
      ['PRECHECK_PASSED', DEVICE],
      ['SESSION_CANCELLED', DEVICE],
      ['SESSION_CREATED', DEVICE],
      ['PRECHECK_PASSED', DEVICE],
      ['RECORDING_STARTED', DEVICE],
      ['RECORDING_STOPPED', DEVICE],
    ]);
    // Additive: the actor is the operator as before, and no `details` key names the device.
    for (const row of rows.filter((candidate) => SESSION_TYPES.includes(candidate.type))) {
      expect(row.actorId, row.type).toBe(investigator.operatorId);
      expect(Object.keys(row.details), row.type).not.toContain('sendingDeviceId');
    }
    // The simulated seal runs to its end: the session closes as before.
    await server.drive(15_000);
    expect(server.engine.slice('session')?.state ?? 'SEALED').toBe('SEALED');
    await server.app.pipeline.drain();
    expect(await storedSlices(server.owner)).toStrictEqual(withoutNegativeZeros(server.engine.state()));
  });

  it('CONTROL - the same actions of a WEB console session carry no device; a web command on a pre-check a device started does not take its device', async () => {
    const supervisor = server.principal('SUPERVISOR');
    // Leave the sealed session's summary: a new session may open.
    if (server.engine.slice('session') !== null) await server.drive(5_000);
    const before = await server.trailLength();
    await server.engine.command(supervisor, 'createSession', sessionInput(supervisor.operatorId, 'LP/2026/1010-0103'));
    await server.engine.command(supervisor, 'beginPrecheck');
    expect(server.engine.slice('session')?.precheck).not.toHaveProperty('sendingDeviceId');
    await server.drive(6_000);
    expect(server.engine.slice('session')?.state).toBe('ARMED');
    await server.engine.command(supervisor, 'startRecording');
    await server.drive(CAPTURE_CONNECT_MS + 2_000);
    await server.engine.command(supervisor, 'stopRecording', 'Interview finished');
    await server.app.pipeline.drain();
    expect(sessionRows(await server.since(before))).toEqual([
      ['SESSION_CREATED', null],
      ['PRECHECK_PASSED', null],
      ['RECORDING_STARTED', null],
      ['RECORDING_STOPPED', null],
    ]);
    await server.drive(15_000);
    await server.app.pipeline.drain();

    // The audit chain of everything this file wrote is whole.
    const trail = await readTrail(server.owner);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(server.owner)).ok).toBe(true);
  });
});
