// FIX WAVE K, DRIVER S2 - re-gate findings G89b-04 (verify rows), G94b-03 (export rows), G75c-09
// (SUMMARY_ACKNOWLEDGED), rule of D216 (2): every STORED audit row of an action a PAIRED DEVICE sent
// names that device; the same actions of a web console session keep no device. And the two facts of
// operations 40 / 42 this wave adds (G94b-06, G94b-11 / -12), read THROUGH THE ROUTES.
//
// The real app on a clone of the seed, as `dems_app`, the engine on a manual clock (simulated
// capture: no worker, no device). A command of a device session is the hosted action under the
// principal stage 4 resolves for a paired device's bearer session - the operator bound to
// `DEV-0001` (the idiom of `wave-i-a2-sending-device.db.test.ts`). Rows are read from the TABLE as
// `dems_owner`; the chain is verified at the end.
import { CAPTURE_CONNECT_MS, DEFAULT_EXPORT_DESTINATION, type AuditRow } from '@dems/shared/sim';
import { validateCoreApiResponse } from '@dems/shared/api';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { devicesApp, type DevicesApp } from '../../devices/__tests__/support';
import { sessionInput } from '../../sessions/__tests__/support';

const db = useTestDatabase({ template: 'seed' });
const DEVICE = 'DEV-0001';

let server: DevicesApp;
beforeAll(async () => {
  server = await devicesApp(db);
});

const named = (rows: readonly AuditRow[], types: readonly string[]): [string, string | null][] => rows.filter((row) => types.includes(row.type)).map((row) => [row.type, row.deviceId ?? null]);
const sealedItemId = (): string => server.engine.slice('evidence').find((item) => item.status === 'SEALED' && item.tampered !== true)?.id ?? '';

async function recordAndSeal(principal: ReturnType<DevicesApp['principal']>, caseNumber: string): Promise<string> {
  await server.engine.setTabletLink('CONNECTED');
  await server.engine.command(principal, 'createSession', sessionInput(principal.operatorId, caseNumber));
  await server.engine.command(principal, 'beginPrecheck');
  await server.drive(6_000);
  expect(server.engine.slice('session')?.state).toBe('ARMED');
  await server.engine.command(principal, 'startRecording');
  await server.drive(CAPTURE_CONNECT_MS + 2_000);
  await server.engine.command(principal, 'stopRecording', 'Interview finished');
  await server.drive(20_000);
  expect(server.engine.slice('session')?.state).toBe('SEALED');
  return server.engine.slice('session')?.id ?? '';
}

describe('D216 (2), wave K: the stored rows of verify, export and summary acknowledge name the paired device that sent them', () => {
  it('from a device session: SUMMARY_ACKNOWLEDGED, EVIDENCE_VERIFIED (with the operation), EVIDENCE_EXPORTED and EXPORT_DENIED carry DEV-0001; the actor is the operator as before', async () => {
    const investigator = { ...server.principal('INVESTIGATOR'), deviceId: DEVICE };
    const supervisor = { ...server.principal('SUPERVISOR'), deviceId: DEVICE };
    const sessionId = await recordAndSeal(investigator, 'LP/2026/1011-0201');
    const before = await server.trailLength();

    await server.engine.command(investigator, 'acknowledgeSummary', sessionId);
    const evidenceId = sealedItemId();
    expect(evidenceId).not.toBe('');
    await server.engine.command(investigator, 'verify', evidenceId);
    await server.engine.command(investigator, 'exportEvidence', evidenceId, { reason: 'Case file handover', destination: '' });
    await server.engine.command(supervisor, 'exportEvidence', evidenceId, { reason: 'Case file handover', destination: '' });
    await server.app.pipeline.drain();

    const rows = await server.since(before);
    const types = ['SUMMARY_ACKNOWLEDGED', 'EVIDENCE_VERIFIED', 'EVIDENCE_VERIFY_FAILED', 'EXPORT_DENIED', 'EVIDENCE_EXPORTED'];
    expect(named(rows, types)).toEqual([
      ['SUMMARY_ACKNOWLEDGED', DEVICE],
      ['EVIDENCE_VERIFIED', DEVICE],
      ['EXPORT_DENIED', DEVICE],
      ['EVIDENCE_EXPORTED', DEVICE],
    ]);
    const byType = (type: string): AuditRow | undefined => rows.find((row) => row.type === type);
    expect(byType('SUMMARY_ACKNOWLEDGED')).toMatchObject({ actorId: investigator.operatorId, sessionId });
    expect(byType('EVIDENCE_VERIFIED')).toMatchObject({ actorId: investigator.operatorId, evidenceId, details: { operationId: 'verifyEvidence' } });
    expect(byType('EVIDENCE_EXPORTED')).toMatchObject({ actorId: supervisor.operatorId, evidenceId });
    // No `details` key names the device: the row states it once.
    for (const row of rows.filter((candidate) => types.includes(candidate.type))) expect(Object.keys(row.details), row.type).not.toContain('sendingDeviceId');
  });

  it('CONTROL - the same actions of a WEB console session carry no device', async () => {
    const investigator = server.principal('INVESTIGATOR');
    const supervisor = server.principal('SUPERVISOR');
    const sessionId = await recordAndSeal(investigator, 'LP/2026/1011-0202');
    const before = await server.trailLength();
    await server.engine.command(investigator, 'acknowledgeSummary', sessionId);
    const evidenceId = sealedItemId();
    await server.engine.command(investigator, 'verify', evidenceId);
    await server.engine.command(investigator, 'exportEvidence', evidenceId, { reason: 'Case file handover', destination: '' });
    await server.engine.command(supervisor, 'exportEvidence', evidenceId, { reason: 'Case file handover', destination: '' });
    await server.app.pipeline.drain();
    expect(named(await server.since(before), ['SUMMARY_ACKNOWLEDGED', 'EVIDENCE_VERIFIED', 'EXPORT_DENIED', 'EVIDENCE_EXPORTED'])).toEqual([
      ['SUMMARY_ACKNOWLEDGED', null],
      ['EVIDENCE_VERIFIED', null],
      ['EXPORT_DENIED', null],
      ['EVIDENCE_EXPORTED', null],
    ]);
  });
});

describe('G94b-06 / G94b-11 / G94b-12 through the routes: the archive fact of operation 42 and the default destination of operation 40', () => {
  it('operation 40 states the default destination of THIS Core (simulated capture: the simulated text); operation 42 without a destination records it and says that NO archive is written for an item of the demonstration data', async () => {
    const evidenceId = sealedItemId();
    const read = await server.get('SUPERVISOR', `/api/v1/evidence/${evidenceId}`);
    expect(read.statusCode).toBe(200);
    const detail = read.json() as { exportDestinationDefault?: string };
    expect(validateCoreApiResponse('getEvidence', 200, detail)).toEqual({ ok: true });
    expect(detail.exportDestinationDefault).toBe(DEFAULT_EXPORT_DESTINATION);

    const before = await server.trailLength();
    const accepted = await server.post('SUPERVISOR', `/api/v1/evidence/${evidenceId}/export`, { reason: 'Case file handover for the prosecutor' });
    expect(accepted.statusCode).toBe(202);
    const body = accepted.json() as { exportId: string; archiveOnCore?: boolean };
    expect(validateCoreApiResponse('exportEvidence', 202, body)).toEqual({ ok: true });
    // An item of the demonstration data has no sealed package in this Core's store: the request is recorded, no job, no archive.
    expect(body.archiveOnCore).toBe(false);
    await server.app.pipeline.drain();
    const row = (await server.since(before)).find((candidate) => candidate.type === 'EVIDENCE_EXPORTED');
    expect(row).toMatchObject({ deviceId: null, details: { exportId: body.exportId, destination: detail.exportDestinationDefault } });

    const trail = await readTrail(server.owner);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(server.owner)).ok).toBe(true);
  });
});
