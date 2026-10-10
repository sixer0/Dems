// Fix wave K, reconcile pass (S2's leftover; decision D216 (2)): the `ACCESS_DENIED` row of a REFUSED
// reset names the paired device that sent the request. Operations 73 / 75 are open to a device
// session that holds DEMO_CONTROL (the access rule asks the permission and the demo flag, not the
// kind of session), so the sender can be a device. A web console session sends none: the row says
// null, as before. The lineage row of a reset that RAN has no device column (schema 6): unchanged.
import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { createDemoReset, createResetHost, type ResetCall } from '../index';
import { recordingHost, recordingLogger } from './support';

const call = (overrides: Partial<ResetCall>): ResetCall => ({ operation: 'resetDemo', scenario: 'idle', actorId: 'OPR-002', requestId: 'req-kr-1', log: recordingLogger().log, ...overrides });

describe('the refused reset names the sending device (D216 (2))', () => {
  it('a paired device sent it: the refusal handed to the host carries the device; a web console session carries none (control)', async () => {
    const fromDevice = recordingHost();
    fromDevice.realSessions = ['SES-20261001-0001'];
    await expect(createDemoReset(fromDevice.host).run(call({ deviceId: 'DEV-0002' }))).rejects.toMatchObject({ statusCode: 409, code: 'RESET_BLOCKED_REAL_EVIDENCE' });
    expect(fromDevice.refusals).toEqual([{ operation: 'resetDemo', actorId: 'OPR-002', deviceId: 'DEV-0002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }]);

    for (const web of [{}, { deviceId: null }]) {
      const fromWeb = recordingHost();
      fromWeb.realSessions = ['SES-20261001-0001'];
      await expect(createDemoReset(fromWeb.host).run(call(web))).rejects.toMatchObject({ statusCode: 409 });
      expect(fromWeb.refusals).toEqual([{ operation: 'resetDemo', actorId: 'OPR-002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }]);
    }
  });

  it('the row the host writes: `deviceId` is the sender, null without one - never a constant', async () => {
    const rows: Record<string, unknown>[] = [];
    const app = { pipeline: { run: async (_label: string, work: (unit: unknown) => Promise<void>) => work({ audit: { append: async (row: Record<string, unknown>) => void rows.push(row) } }) } } as unknown as FastifyInstance;
    const host = createResetHost(app, () => {
      throw new Error('no routine is asked for by a refusal');
    });
    await host.auditRefusal({ operation: 'resetDemo', actorId: 'OPR-002', deviceId: 'DEV-0002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' });
    await host.auditRefusal({ operation: 'loadScenario', actorId: 'OPR-002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' });
    expect(rows.map((row) => [row['type'], row['actorId'], row['deviceId'], row['details']])).toEqual([
      ['ACCESS_DENIED', 'OPR-002', 'DEV-0002', { operationId: 'resetDemo', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }],
      ['ACCESS_DENIED', 'OPR-002', null, { operationId: 'loadScenario', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }],
    ]);
  });
});
