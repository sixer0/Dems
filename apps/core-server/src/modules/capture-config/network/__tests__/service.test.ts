// The camera network configuration without a database (task 4 blueprint row 108, WP-19d):
//   - the JOIN of the stored choice with the host's interfaces (`facts.ts`), and what the ONE
//     destination rule of the capture unit decides on it for a STORED camera address
//     (`storedCameraAddressRuleOf`, read-only for this row);
//   - the forms of a write, asked of that rule;
//   - operations 101 and 102 (`service.ts`) on a unit of work of this file: every refusal, the one
//     audit entry of a committed change, nothing on a refused one, and the hand-over to the reader
//     after the commit only.
//
// THE DOUBLES: the host is a table of interfaces written here (no interface of this Mac is read
// except in the one case that reads the operating system's table for its SHAPE); the store is a
// row in memory; the unit of work commits when its work resolves and forgets everything when it
// throws. The database, the real unit of the engine, stage 6 and the booted reader are
// `routes.db.test.ts`.
import { CAPTURE_NETWORK_CONFIG_DEFAULTS, CaptureNetworkConfigSchema, CaptureNetworkConfigUpdateRequestSchema, type CaptureNetworkConfigUpdateRequest } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { storedCameraAddressRuleOf, type CaptureNetworkFactsReader } from '../../../../capture/fence';
import type { AuditEntry } from '../../../../core';
import { ApiFailure } from '../../../../plugins/error-envelope';
import {
  cameraSubnetAccepted,
  changeNetworkConfig,
  factoryAddressAccepted,
  networkFactsOf,
  readHostInterfaces,
  readNetworkConfig,
  type HostInterface,
  type NetworkConfigSeams,
  type NetworkConfigStore,
  type StoredNetworkConfig,
} from '../index';

// ── The host of this file ──────────────────────────────────────────────────────────────────────

/** A Core host: the office network on `eth0`, the camera port `eth1` inside 192.168.50.0/24, a loopback. */
const HOST: readonly HostInterface[] = [
  { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
  { name: 'eth0', internal: false, addresses: [{ address: '10.20.0.15', prefixLength: 16 }] },
  { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24 }] },
];
const CHOICE = { interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' };
const judged = (reader: CaptureNetworkFactsReader | undefined, address: string): string => {
  const decision = storedCameraAddressRuleOf(reader)(address, undefined);
  return decision.allowed ? `ALLOWED from ${String(decision.destination?.sourceAddress)}` : decision.refusal;
};

describe('the network facts: the stored choice joined with the interfaces of the host', () => {
  it('the context of a configured host: the subnet as stored, the camera interface\'s own address, the subnet of every other interface, every address of the host', () => {
    expect(networkFactsOf(CHOICE, HOST)).toEqual({
      cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
      cameraAddresses: [{ address: '192.168.50.1', alias: false }],
      otherInterfaceSubnets: [
        { network: '127.0.0.0', prefixLength: 8 },
        { network: '10.20.0.0', prefixLength: 16 },
      ],
      hostAddresses: ['127.0.0.1', '10.20.0.15', '192.168.50.1'],
    });
  });

  it('WITH THE READER HANDED IN, the rule allows a stored camera address inside the configured subnet, from the camera interface, and refuses one outside it', () => {
    const reader: CaptureNetworkFactsReader = () => networkFactsOf(CHOICE, HOST);
    expect(judged(reader, '192.168.50.101')).toBe('ALLOWED from 192.168.50.1');
    expect(judged(reader, '192.168.50.254')).toBe('ALLOWED from 192.168.50.1');
    // Outside the subnet, on the office network, the Core's own address, the edges of the subnet, a public address, a name.
    expect(judged(reader, '192.168.51.101')).toBe('OUTSIDE_CAMERA_SUBNET');
    expect(judged(reader, '10.20.0.99')).toBe('OTHER_INTERFACE_SUBNET');
    expect(judged(reader, '192.168.50.1')).toBe('HOST_ADDRESS');
    expect(judged(reader, '192.168.50.0')).toBe('NETWORK_ADDRESS');
    expect(judged(reader, '192.168.50.255')).toBe('SUBNET_BROADCAST');
    expect(judged(reader, '8.8.8.8')).toBe('PUBLIC_ADDRESS');
    expect(judged(reader, 'camera.local')).toBe('HOST_NAME');
  });

  it('WITH NULL EVERYTHING IS REFUSED: no reader, a reader that answers null, and every state that is "not configured"', () => {
    const inside = '192.168.50.101';
    expect(judged(undefined, inside)).toBe('NOT_CONFIGURED');
    expect(judged(() => null, inside)).toBe('NOT_CONFIGURED');
    const unknown: readonly (readonly [string, ReturnType<typeof networkFactsOf>])[] = [
      ['no row stored', networkFactsOf(null, HOST)],
      ['no interface chosen', networkFactsOf({ interfaceName: null, cameraSubnet: CHOICE.cameraSubnet }, HOST)],
      ['no subnet chosen', networkFactsOf({ interfaceName: 'eth1', cameraSubnet: null }, HOST)],
      ['an interface the host does not have', networkFactsOf({ ...CHOICE, interfaceName: 'eth9' }, HOST)],
      ['a loopback interface', networkFactsOf({ ...CHOICE, interfaceName: 'lo' }, HOST)],
      ['a host without interfaces', networkFactsOf(CHOICE, [])],
      ['a stored subnet that is no subnet', networkFactsOf({ ...CHOICE, cameraSubnet: '192.168.50.0' }, HOST)],
      ['a host address that cannot be read', networkFactsOf(CHOICE, [...HOST, { name: 'eth2', internal: false, addresses: [{ address: 'fe80::1', prefixLength: 64 }] }])],
      ['a prefix length that cannot be read', networkFactsOf(CHOICE, [...HOST, { name: 'eth2', internal: false, addresses: [{ address: '172.16.4.2', prefixLength: -1 }] }])],
    ];
    for (const [label, facts] of unknown) {
      expect(facts, label).toBeNull();
      expect(judged(() => facts, inside), label).toBe('NOT_CONFIGURED');
    }
    // CONTROL: the same address on the configured host is allowed.
    expect(judged(() => networkFactsOf(CHOICE, HOST), inside)).toBe('ALLOWED from 192.168.50.1');
  });

  it('facts the rule itself refuses: a stored subnet with host bits or outside the private ranges, and a camera interface without an address in the subnet', () => {
    expect(judged(() => networkFactsOf({ ...CHOICE, cameraSubnet: '192.168.50.7/24' }, HOST), '192.168.50.101')).toBe('NOT_CONFIGURED');
    expect(judged(() => networkFactsOf({ ...CHOICE, cameraSubnet: '8.8.8.0/24' }, HOST), '192.168.50.101')).toBe('NOT_CONFIGURED');
    expect(judged(() => networkFactsOf({ ...CHOICE, cameraSubnet: '192.168.0.0/8' }, HOST), '192.168.50.101')).toBe('NOT_CONFIGURED');
    // The interface is there and holds nothing in the camera subnet: no source, never another interface's route.
    const elsewhere = HOST.map((entry) => (entry.name === 'eth1' ? { ...entry, addresses: [] } : entry));
    expect(judged(() => networkFactsOf(CHOICE, elsewhere), '192.168.50.101')).toBe('NO_CAMERA_SOURCE');
  });

  it('what else the camera interface holds: a private address outside the subnet is a temporary address and no source for a stored camera; a link-local address is a host address only', () => {
    const host = HOST.map((entry) =>
      entry.name === 'eth1'
        ? { ...entry, addresses: [...entry.addresses, { address: '192.168.1.253', prefixLength: 24 }, { address: '169.254.7.9', prefixLength: 16 }] }
        : entry,
    );
    const facts = networkFactsOf(CHOICE, host);
    expect(facts?.cameraAddresses).toEqual([
      { address: '192.168.50.1', alias: false },
      { address: '192.168.1.253', alias: true },
    ]);
    expect(facts?.hostAddresses).toEqual(['127.0.0.1', '10.20.0.15', '192.168.50.1', '192.168.1.253', '169.254.7.9']);
    // A stored camera at a factory address is refused although a temporary address reaches it.
    expect(judged(() => facts, '192.168.1.64')).toBe('OUTSIDE_CAMERA_SUBNET');
    expect(judged(() => facts, '192.168.1.253')).toBe('HOST_ADDRESS');
    expect(judged(() => facts, '192.168.50.101')).toBe('ALLOWED from 192.168.50.1');
  });

  it('the facts follow the host at each call: an address the camera interface gains is the source of the next judgement', () => {
    let host: readonly HostInterface[] = HOST.map((entry) => (entry.name === 'eth1' ? { ...entry, addresses: [] } : entry));
    const reader: CaptureNetworkFactsReader = () => networkFactsOf(CHOICE, host);
    expect(judged(reader, '192.168.50.101')).toBe('NO_CAMERA_SOURCE');
    host = HOST;
    expect(judged(reader, '192.168.50.101')).toBe('ALLOWED from 192.168.50.1');
  });

  it('a reader whose host cannot be read throws, and the binding of the rule refuses and says so once', () => {
    let told = 0;
    const reader: CaptureNetworkFactsReader = () =>
      networkFactsOf(
        CHOICE,
        ((): readonly HostInterface[] => {
          throw new Error('row108: the interface table cannot be read');
        })(),
      );
    const decision = storedCameraAddressRuleOf(reader, () => (told += 1))('192.168.50.101', undefined);
    expect([decision.allowed, told]).toEqual([false, 1]);
  });

  it('the product\'s host reader answers the shape the join takes: names, a loopback flag and IPv4 addresses with a prefix length of 0 to 32 (read from this machine; no value is asserted)', () => {
    const interfaces = readHostInterfaces();
    expect(interfaces.length).toBeGreaterThan(0);
    expect(interfaces.some((entry) => entry.internal)).toBe(true);
    for (const entry of interfaces) {
      expect(typeof entry.name).toBe('string');
      for (const held of entry.addresses) {
        expect(held.address).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/);
        expect(Number.isInteger(held.prefixLength) && held.prefixLength >= 0 && held.prefixLength <= 32).toBe(true);
      }
    }
    // Whatever this machine holds, the join reads it: with no choice stored the answer is "not configured", never a throw.
    expect(networkFactsOf(null, interfaces)).toBeNull();
  });
});

describe('the forms of a write, asked of the destination rule', () => {
  it('a camera subnet: a private IPv4 network with a prefix length of 16 to 30 and no host bit', () => {
    for (const subnet of ['192.168.50.0/24', '10.0.0.0/16', '172.16.0.0/16', '172.31.255.252/30', '192.168.0.0/16', '10.200.4.0/22']) expect(cameraSubnetAccepted(subnet), subnet).toBe(true);
    for (const subnet of [
      '192.168.50.7/24', // host bits
      '192.168.50.0/31', // beyond the bound
      '192.168.50.0/32',
      '10.0.0.0/8', // below the bound
      '10.0.0.0/15',
      '8.8.8.0/24', // public
      '172.32.0.0/16',
      '169.254.0.0/16', // link-local
      '127.0.0.0/16', // loopback
      '224.0.0.0/24', // multicast
      '192.168.050.0/24', // a leading zero
      '192.168.50.0', // no prefix
      '192.168.50/24',
      'cameras/24',
      '',
    ])
      expect(cameraSubnetAccepted(subnet), subnet).toBe(false);
    // Every subnet the contract's schema admits and this check accepts is one the rule then reads: a camera inside it is judged, not "not configured".
    for (const subnet of ['192.168.50.0/24', '172.31.255.252/30', '10.200.4.0/22']) {
      const [network, prefix] = subnet.split('/') as [string, string];
      const own = network.replace(/\d+$/, (last) => String(Number(last) + 1));
      const camera = network.replace(/\d+$/, (last) => String(Number(last) + 2));
      const host: HostInterface[] = [{ name: 'eth1', internal: false, addresses: [{ address: own, prefixLength: Number(prefix) }] }];
      expect(judged(() => networkFactsOf({ interfaceName: 'eth1', cameraSubnet: subnet }, host), camera), subnet).toBe(`ALLOWED from ${own}`);
    }
  });

  it('a factory address: one strict private IPv4 host address', () => {
    for (const address of [...CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses, '10.0.0.1', '172.16.0.254']) expect(factoryAddressAccepted(address), address).toBe(true);
    for (const address of ['192.168.1.0', '192.168.1.255', '8.8.8.8', '127.0.0.1', '169.254.1.1', '224.0.0.1', '0.0.0.0', '192.168.01.64', '192.168.1.64/24', '192.168.1.64:80', '::ffff:192.168.1.64', 'camera', ''])
      expect(factoryAddressAccepted(address), address).toBe(false);
  });
});

// ── Operations 101 and 102 on a unit of work of this file ──────────────────────────────────────

const TECHNICIAN = { operatorId: 'OPR-003', deviceId: null };
const NOW = 1_760_000_000_000;

interface Bench {
  readonly seams: NetworkConfigSeams;
  row(): StoredNetworkConfig | null;
  put(row: StoredNetworkConfig | null): void;
  readonly audits: AuditEntry[];
  readonly committed: StoredNetworkConfig[];
  readonly notes: Record<string, unknown>[];
  readonly failures: string[];
  readonly state: { sessionOpen: boolean; sessionOpensInUnit: boolean; available: boolean; interfaces: () => readonly HostInterface[]; hostReads: number; failAudit: boolean; loseTheWrite: boolean; units: number };
}

function bench(): Bench {
  let row: StoredNetworkConfig | null = null;
  const audits: AuditEntry[] = [];
  const committed: StoredNetworkConfig[] = [];
  const notes: Record<string, unknown>[] = [];
  const failures: string[] = [];
  const state: Bench['state'] = { sessionOpen: false, sessionOpensInUnit: false, available: true, interfaces: () => HOST, hostReads: 0, failAudit: false, loseTheWrite: false, units: 0 };
  // The store works on the row a unit sees; the unit puts it back when it rolls back.
  const store: NetworkConfigStore = {
    read: async () => row,
    async insert(_db, write, revision) {
      if (row !== null || state.loseTheWrite) return false;
      row = { ...write.values, revision, updatedBy: write.operatorId, updatedAt: write.now };
      return true;
    },
    async update(_db, write, expectedRevision) {
      if (row === null || row.revision !== expectedRevision || state.loseTheWrite) return false;
      row = { ...write.values, revision: row.revision + 1, updatedBy: write.operatorId, updatedAt: write.now };
      return true;
    },
  };
  const db = { query: async () => ({ rows: [], rowCount: 0 }) };
  const seams: NetworkConfigSeams = {
    store,
    available: () => state.available,
    interfaces: () => {
      state.hostReads += 1;
      return state.interfaces();
    },
    committed: (stored) => void committed.push(stored),
    host: {
      now: () => NOW,
      sessionOpen: () => state.sessionOpen,
      read: (_label, work) => work(db),
      async unit(_label, work) {
        state.units += 1;
        const before = row;
        const pendingAudits: AuditEntry[] = [];
        const tasks: (() => void)[] = [];
        try {
          const value = await work({
            db,
            sessionOpen: () => state.sessionOpen || state.sessionOpensInUnit,
            async audit(entry) {
              if (state.failAudit) throw Object.assign(new Error('row108: the audit writer failed'), { code: 'ROW108_INJECTED' });
              pendingAudits.push(entry);
            },
            afterCommit: (task) => void tasks.push(task),
          });
          audits.push(...pendingAudits);
          for (const task of tasks) task();
          return value;
        } catch (error) {
          row = before;
          throw error;
        }
      },
      note: (fields) => void notes.push(fields),
      failed: (source) => void failures.push(source),
    },
  };
  return { seams, row: () => row, put: (next) => void (row = next), audits, committed, notes, failures, state };
}

const refusalOf = async (work: Promise<unknown>): Promise<[number, string, unknown]> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof ApiFailure) return [error.statusCode, error.code, (error.details as Record<string, unknown> | undefined)?.['reason'] ?? null];
    throw error;
  }
  throw new Error('row108: the call was not refused');
};
const change = (target: Bench, body: CaptureNetworkConfigUpdateRequest) => changeNetworkConfig(target.seams, TECHNICIAN, CaptureNetworkConfigUpdateRequestSchema.parse(body));
/** Everything a refusal must leave as it was. */
const untouched = (target: Bench, row: StoredNetworkConfig | null): void => {
  expect(target.row()).toEqual(row);
  expect([target.audits.length, target.committed.length, target.notes.length]).toEqual([0, 0, 0]);
};

describe('operation 101 getCaptureNetworkConfig', () => {
  it('an empty table: the contract\'s defaults, revision 1, NO interface and NO subnet, `configured: false`, nobody wrote it; valid against the contract', async () => {
    const target = bench();
    const answer = await readNetworkConfig(target.seams);
    expect(answer).toEqual({
      configured: false,
      interfaceName: null,
      cameraSubnet: null,
      factoryAddresses: ['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.1.13'],
      aliasHost: 253,
      aliasMinutes: 30,
      cameraIpStart: 101,
      revision: 1,
      updatedAt: null,
      updatedBy: null,
    });
    expect(CaptureNetworkConfigSchema.safeParse(answer).success).toBe(true);
    // A read writes nothing and reads no host: the Core chooses no interface.
    expect([target.row(), target.state.hostReads, target.state.units]).toEqual([null, 0, 0]);
  });

  it('a stored row as it is; `configured` only when BOTH the interface and the subnet are chosen', async () => {
    const target = bench();
    const row: StoredNetworkConfig = { interfaceName: 'eth1', cameraSubnet: null, factoryAddresses: ['192.168.1.64'], aliasHost: 200, aliasMinutes: 60, cameraIpStart: 110, revision: 4, updatedBy: 'OPR-003', updatedAt: NOW - 5 };
    target.put(row);
    expect(await readNetworkConfig(target.seams)).toEqual({ ...row, configured: false });
    target.put({ ...row, cameraSubnet: '192.168.50.0/24' });
    expect(await readNetworkConfig(target.seams)).toMatchObject({ configured: true, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24', revision: 4 });
  });
});

describe('operation 102 updateCaptureNetworkConfig', () => {
  it('the first change INSERTS the row at revision 2, writes ONE entry that names the changed settings and no value, and hands the committed row to the reader', async () => {
    const target = bench();
    const answer = await change(target, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' });
    expect(answer).toMatchObject({ configured: true, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24', revision: 2, updatedAt: NOW, updatedBy: 'OPR-003', aliasHost: 253 });
    expect(CaptureNetworkConfigSchema.safeParse(answer).success).toBe(true);
    expect(target.row()).toMatchObject({ interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24', revision: 2, updatedBy: 'OPR-003', updatedAt: NOW });
    expect(target.audits).toEqual([
      {
        type: 'CAPTURE_NETWORK_CONFIG_CHANGED',
        message: 'Camera network configuration changed',
        actorId: 'OPR-003',
        deviceId: null,
        details: { changedFields: 'interfaceName,cameraSubnet', revision: 2, operationId: 'updateCaptureNetworkConfig', permission: 'CAPTURE_COMMISSION' },
      },
    ]);
    expect(target.committed).toEqual([target.row()]);
    // The log line: names of settings and two facts, never a value.
    expect(target.notes).toEqual([{ code: 'CAPTURE_NETWORK_CONFIG_CHANGED', source: 'captureNetworkConfig', changedFields: 'interfaceName,cameraSubnet', revision: 2, configured: true }]);
    expect(JSON.stringify([target.audits, target.notes])).not.toMatch(/eth1|192\.168/);
  });

  it('a later change is compare-and-set on the revision; a setting the body does not carry stays; each committed change is ONE entry', async () => {
    const target = bench();
    await change(target, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' });
    const answer = await change(target, { revision: 2, aliasMinutes: 45, factoryAddresses: ['192.168.1.64', '10.0.0.5'] });
    expect(answer).toMatchObject({ revision: 3, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24', aliasMinutes: 45, factoryAddresses: ['192.168.1.64', '10.0.0.5'], aliasHost: 253, cameraIpStart: 101 });
    expect(target.audits.map((entry) => entry.details)).toEqual([
      { changedFields: 'interfaceName,cameraSubnet', revision: 2, operationId: 'updateCaptureNetworkConfig', permission: 'CAPTURE_COMMISSION' },
      { changedFields: 'factoryAddresses,aliasMinutes', revision: 3, operationId: 'updateCaptureNetworkConfig', permission: 'CAPTURE_COMMISSION' },
    ]);
    expect(target.committed.map((row) => row.revision)).toEqual([2, 3]);
    // Null clears a choice: the Core is "not configured" again, and says so with the same one entry.
    const cleared = await change(target, { revision: 3, interfaceName: null });
    expect(cleared).toMatchObject({ configured: false, interfaceName: null, cameraSubnet: '192.168.50.0/24', revision: 4 });
    expect(target.audits[2]?.details).toMatchObject({ changedFields: 'interfaceName', revision: 4 });
    expect(target.committed[2]).toMatchObject({ interfaceName: null, revision: 4 });
  });

  it('a body that changes nothing: 200 with the unchanged revision, no statement, no entry, nothing handed to the reader, no host read', async () => {
    const target = bench();
    expect(await change(target, { revision: 1 })).toMatchObject({ revision: 1, updatedAt: null });
    expect(await change(target, { revision: 1, aliasHost: 253, interfaceName: null, factoryAddresses: [...CAPTURE_NETWORK_CONFIG_DEFAULTS.factoryAddresses] })).toMatchObject({ revision: 1 });
    untouched(target, null);
    await change(target, { revision: 1, interfaceName: 'eth1' });
    const row = target.row();
    const reads = target.state.hostReads;
    // The stored interface repeated, while the host no longer has it: an unchanged setting is not judged again.
    target.state.interfaces = () => [];
    expect(await change(target, { revision: 2, interfaceName: 'eth1', aliasMinutes: 30 })).toMatchObject({ revision: 2, interfaceName: 'eth1' });
    expect([target.row(), target.audits.length, target.committed.length, target.state.hostReads]).toEqual([row, 1, 1, reads]);
  });

  it('409 CAPTURE_CONFIG_LOCKED while a session is open - before the unit, and for a session that opened meanwhile, inside it; nothing stored, no entry', async () => {
    const target = bench();
    target.state.sessionOpen = true;
    expect(await refusalOf(change(target, { revision: 1, interfaceName: 'eth1' }))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect(target.state.units).toBe(0);
    target.state.sessionOpen = false;
    target.state.sessionOpensInUnit = true;
    expect(await refusalOf(change(target, { revision: 1, interfaceName: 'eth1' }))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect(target.state.units).toBe(1);
    untouched(target, null);
    // The lock comes before the Core's own refusal: a Core that cannot commission says "locked" while a session is open.
    target.state.sessionOpen = true;
    target.state.available = false;
    expect(await refusalOf(change(target, { revision: 1, interfaceName: 'eth1' }))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
  });

  it('409 INVALID_STATE / COMMISSIONING_NOT_AVAILABLE on a Core that is not in production capture: no unit is opened, the host is not read', async () => {
    const target = bench();
    target.state.available = false;
    expect(await refusalOf(change(target, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect([target.state.units, target.state.hostReads]).toEqual([0, 0]);
    untouched(target, null);
    // The read answers on such a Core.
    expect(await readNetworkConfig(target.seams)).toMatchObject({ configured: false, revision: 1 });
  });

  it('409 INVALID_STATE / REVISION_CONFLICT for a stale revision, with the current one; before any value is judged', async () => {
    const target = bench();
    expect(await refusalOf(change(target, { revision: 2, interfaceName: 'eth1' }))).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    untouched(target, null);
    await change(target, { revision: 1, interfaceName: 'eth1' });
    const row = target.row();
    try {
      // A stale revision with a setting that would be refused too: the revision is the answer.
      await change(target, { revision: 1, cameraSubnet: '192.168.50.7/24' });
      throw new Error('row108: not refused');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiFailure);
      expect((error as ApiFailure).details).toEqual({ reason: 'REVISION_CONFLICT', currentRevision: 2 });
    }
    expect([target.row(), target.audits.length, target.committed.length]).toEqual([row, 1, 1]);
  });

  it('a write another writer got ahead of (the compare-and-set finds no row): 409 REVISION_CONFLICT, no entry, nothing handed to the reader', async () => {
    const target = bench();
    target.state.loseTheWrite = true;
    expect(await refusalOf(change(target, { revision: 1, interfaceName: 'eth1' }))).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    untouched(target, null);
  });

  it('422 INVALID_INPUT / NETWORK_CONFIG_NOT_ALLOWED: an interface the host does not have, a loopback interface, host bits in the subnet, a factory address listed twice - each stores nothing and writes no entry', async () => {
    const refused: readonly (readonly [string, CaptureNetworkConfigUpdateRequest])[] = [
      ['an interface the host does not have', { revision: 1, interfaceName: 'eth9' }],
      ['a loopback interface', { revision: 1, interfaceName: 'lo' }],
      ['host bits in the subnet', { revision: 1, cameraSubnet: '192.168.50.7/24' }],
      ['host bits in a /30', { revision: 1, cameraSubnet: '10.0.0.6/30' }],
      ['a factory address listed twice', { revision: 1, factoryAddresses: ['192.168.1.64', '192.168.1.108', '192.168.1.64'] }],
      ['one good setting beside a refused one', { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.7/24' }],
    ];
    for (const [label, body] of refused) {
      const target = bench();
      expect(await refusalOf(change(target, body)), label).toEqual([422, 'INVALID_INPUT', 'NETWORK_CONFIG_NOT_ALLOWED']);
      untouched(target, null);
    }
    // The refusal quotes nothing of the body.
    const target = bench();
    try {
      await change(target, { revision: 1, interfaceName: 'eth9', cameraSubnet: '192.168.50.0/24' });
    } catch (error) {
      expect(JSON.stringify([(error as ApiFailure).message, (error as ApiFailure).details])).not.toMatch(/eth9|192\.168/);
      expect((error as ApiFailure).details).toEqual({ in: 'body', reason: 'NETWORK_CONFIG_NOT_ALLOWED' });
    }
    // CONTROL: the same body with an interface the host has is stored.
    expect(await change(target, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' })).toMatchObject({ configured: true, revision: 2 });
  });

  it('NO AUTOMATIC CHOICE: the host is read only to compare a name the body states, and never when the body states none', async () => {
    const target = bench();
    await change(target, { revision: 1, cameraSubnet: '192.168.50.0/24', aliasHost: 200 });
    expect(target.state.hostReads).toBe(0);
    expect(target.row()).toMatchObject({ interfaceName: null, cameraSubnet: '192.168.50.0/24' });
    await change(target, { revision: 2, interfaceName: 'eth0' });
    expect(target.state.hostReads).toBe(1);
    // What the technician wrote is stored, although the host holds an interface inside the chosen subnet.
    expect(target.row()).toMatchObject({ interfaceName: 'eth0', cameraSubnet: '192.168.50.0/24' });
  });

  it('a host whose interfaces cannot be read: 409 COMMISSIONING_NOT_AVAILABLE, one persisted failure, nothing stored - the name is not accepted unjudged', async () => {
    const target = bench();
    target.state.interfaces = () => {
      throw new Error('row108: the interface table cannot be read');
    };
    expect(await refusalOf(change(target, { revision: 1, interfaceName: 'eth1' }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(target.failures).toEqual(['captureNetworkConfig.hostInterfaces']);
    untouched(target, null);
    // A change that names no interface does not need the host.
    expect(await change(target, { revision: 1, aliasMinutes: 20 })).toMatchObject({ revision: 2, aliasMinutes: 20 });
  });

  it('a unit that rolls back (the audit writer fails) leaves the row as it was and hands NOTHING to the reader', async () => {
    const target = bench();
    await change(target, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' });
    const row = target.row();
    target.state.failAudit = true;
    await expect(change(target, { revision: 2, cameraSubnet: '192.168.60.0/24' })).rejects.toThrow(/audit writer failed/);
    expect([target.row(), target.audits.length, target.committed.length, target.notes.length]).toEqual([row, 1, 1, 1]);
    // CONTROL: the same change commits once the writer works, and only then does the reader get it.
    target.state.failAudit = false;
    await change(target, { revision: 2, cameraSubnet: '192.168.60.0/24' });
    expect(target.committed.map((stored) => stored.cameraSubnet)).toEqual(['192.168.50.0/24', '192.168.60.0/24']);
  });
});
