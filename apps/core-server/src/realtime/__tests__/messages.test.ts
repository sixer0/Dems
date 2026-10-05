// Every message the channel builds is a member of the contract's union, by its own schema (plan
// row W42; spec §9.4, §9.5; AC-B-46). Pure: the builders of `messages.ts` against the schemas of
// `@dems/shared/api`, with a real simulator state for the two state messages.
import {
  AdminChangedMessageSchema,
  DeltaMessageSchema,
  DeviceRevokedMessageSchema,
  HeartbeatSchema,
  HelloMessageSchema,
  MetersMessageSchema,
  REALTIME_SERVER_MESSAGES,
  REPLICATED_SLICE_NAMES,
  SessionEndedMessageSchema,
  SessionUpdatedMessageSchema,
  SnapshotMessageSchema,
  UNREPLICATED_SLICE_NAMES,
  WsServerMessageSchema,
} from '@dems/shared/api';
import { ROLE_PERMISSIONS } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { pickDurable } from '../../db/mapping';
import { createHost } from '../../../test/support/seed';
import { changesRecords, deltaOps, type EngineStateChange } from '../../engine';
import {
  adminChangedText,
  deltaText,
  deviceRevokedText,
  heartbeatText,
  helloText,
  metersText,
  sessionEndedText,
  sessionUpdatedText,
  snapshotText,
} from '../messages';

const AT = Date.UTC(2031, 0, 1);
const parse = (text: string): unknown => JSON.parse(text);

describe('each builder gives a message of its schema and of the union', () => {
  it('hello: with and without a reason, for each principal', () => {
    const cases = [
      { principal: 'ANONYMOUS', reason: null, topics: ['heartbeat'] },
      { principal: 'ANONYMOUS', reason: 'SESSION_INVALID', topics: ['heartbeat'] },
      { principal: 'ANONYMOUS', reason: 'DEVICE_REVOKED', topics: ['heartbeat'] },
      { principal: 'DEVICE', reason: null, topics: ['heartbeat', 'control'] },
      { principal: 'OPERATOR', reason: null, topics: ['heartbeat', 'control', 'state', 'meters', 'admin'] },
    ] as const;
    for (const entry of cases) {
      const message = parse(helloText({ connectionId: '00000000-0000-4000-8000-000000000001', epoch: 3, serverTime: AT, ...entry }));
      expect(HelloMessageSchema.safeParse(message).success, `${entry.principal} ${String(entry.reason)}`).toBe(true);
      expect(WsServerMessageSchema.safeParse(message).success).toBe(true);
      expect(Object.hasOwn(message as object, 'reason')).toBe(entry.reason !== null);
    }
    // The contract refuses a reason on a principal, and topics beyond the principal's: the builder is checked by it.
    expect(HelloMessageSchema.safeParse(parse(helloText({ connectionId: 'a', epoch: 0, principal: 'OPERATOR', reason: 'SESSION_INVALID', topics: ['heartbeat'], serverTime: AT }))).success).toBe(false);
    expect(HelloMessageSchema.safeParse(parse(helloText({ connectionId: 'a', epoch: 0, principal: 'ANONYMOUS', reason: null, topics: ['heartbeat', 'state'], serverTime: AT }))).success).toBe(false);
  });

  it('heartbeat: the unchanged member, with an ISO time and a session state or null', () => {
    for (const sessionState of [null, 'RECORDING', 'SEALED'] as const) {
      const message = parse(heartbeatText({ seq: 7, now: AT, uptimeMs: 7_000, clients: 3, sessionState }));
      expect(HeartbeatSchema.safeParse(message).success).toBe(true);
      expect(message).toEqual({ type: 'heartbeat', v: 1, seq: 7, serverTime: '2031-01-01T00:00:00.000Z', uptimeMs: 7_000, intervalMs: 1000, clients: 3, sessionState });
    }
  });

  it('snapshot: exactly the 28 replicated slices of a real state, and none of the five others', async () => {
    for (const scenario of ['idle', 'recording', 'finalizing', 'fault-demo'] as const) {
      const host = await createHost({ scenario });
      // The whole simulator state goes in: what is not replicated stays behind.
      const message = parse(snapshotText(3, 128, AT, host.state() as never)) as { state: Record<string, unknown> };
      const parsed = SnapshotMessageSchema.safeParse(message);
      expect(parsed.success, scenario).toBe(true);
      expect(Object.keys(message.state).sort()).toEqual([...REPLICATED_SLICE_NAMES].sort());
      for (const name of UNREPLICATED_SLICE_NAMES) expect(name in message.state, name).toBe(false);
      expect(message.state).toEqual(JSON.parse(JSON.stringify(pickDurable(host.state()))));
    }
  });

  it('delta: the ops of a real change, unchanged', async () => {
    const host = await createHost({ scenario: 'recording' });
    const before = pickDurable(host.state());
    host.drive(5_000);
    host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.addMarker('Key statement'));
    const ops = deltaOps(before, pickDurable(host.state()));
    const change: EngineStateChange = { epoch: 3, revision: 129, at: AT, cause: 'command', records: changesRecords(ops), ops };
    const message = parse(deltaText(change));
    expect(DeltaMessageSchema.safeParse(message).success).toBe(true);
    expect(message).toEqual({ type: 'delta', v: 1, epoch: 3, revision: 129, serverTime: AT, ops: JSON.parse(JSON.stringify(ops)) });
    expect(ops.some((op) => op.op === 'append' && op.slice === 'audit')).toBe(true);
    expect(ops.some((op) => op.op === 'replace')).toBe(true);
  });

  it('meters: the audio slice of a real state', async () => {
    const host = await createHost({ scenario: 'recording' });
    host.drive(1_000);
    const message = parse(metersText(AT, 22_440, host.state().audio));
    expect(MetersMessageSchema.safeParse(message).success).toBe(true);
    expect(message).toMatchObject({ type: 'meters', v: 1, at: AT, seq: 22_440 });
  });

  it('the four control messages', () => {
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      const message = parse(sessionUpdatedText('OPR-003', role, ROLE_PERMISSIONS[role]));
      expect(SessionUpdatedMessageSchema.safeParse(message).success, role).toBe(true);
      expect(message).toEqual({ type: 'session.updated', v: 1, operator: { id: 'OPR-003', role }, permissions: [...ROLE_PERMISSIONS[role]], reason: 'ROLE_CHANGED' });
    }
    for (const reason of ['SIGNED_OUT', 'IDLE_EXPIRED', 'ABSOLUTE_EXPIRED', 'ROTATED', 'USER_DISABLED', 'TOKEN_REUSE'] as const) {
      expect(SessionEndedMessageSchema.safeParse(parse(sessionEndedText(reason))).success, reason).toBe(true);
      expect(parse(sessionEndedText(reason))).toEqual({ type: 'session.ended', v: 1, reason });
    }
    for (const reason of ['REVOKED', 'UNPAIRED'] as const) {
      expect(DeviceRevokedMessageSchema.safeParse(parse(deviceRevokedText(reason))).success, reason).toBe(true);
      expect(parse(deviceRevokedText(reason))).toEqual({ type: 'device.revoked', v: 1, reason });
    }
    for (const resource of ['USERS', 'DEVICES', 'PAIRING_CODE'] as const) {
      expect(AdminChangedMessageSchema.safeParse(parse(adminChangedText(resource))).success, resource).toBe(true);
      expect(parse(adminChangedText(resource))).toEqual({ type: 'admin.changed', v: 1, resource });
    }
  });

  it('there is a builder for every member of the union, and no other', () => {
    expect(REALTIME_SERVER_MESSAGES.map((entry) => entry.type).sort()).toEqual(
      ['hello', 'heartbeat', 'snapshot', 'delta', 'meters', 'session.updated', 'session.ended', 'device.revoked', 'admin.changed'].sort(),
    );
  });
});
