// The two identity worlds of the shared dataset (PT GSP, ruling of 30 Oct 2026) and the state a
// factory database is seeded from. The demonstration dataset keeps its three operators and its
// history; the factory state holds the two vendor accounts and NOTHING else.
import { describe, expect, it } from 'vitest';
import {
  ALL_OPERATORS,
  DEMO_OPERATOR_IDS,
  FACTORY_OPERATORS,
  FACTORY_OPERATOR_IDS,
  OPERATORS,
  OPERATOR_IDS,
  createFactoryState,
  GENESIS_HASH,
  PairingState,
  createIdleState,
  operatorName,
} from '../src/sim';

const NOW = 1_790_823_600_000; // 2026-10-01T03:00:00.000Z
const IDENTITY = { installationDeviceId: 'DEMS-BENCH-01', installationName: 'DEMS Bench GSP', certificateFingerprint: '0C:86:21:74:C3:33:AC:07:21:E8:9C:FE:CE:D9:99:85' };

describe('the dataset separates the demonstration identities from the factory identities', () => {
  it('OPERATORS is the demonstration dataset: three accounts, none of them a vendor', () => {
    expect(OPERATORS.map((operator) => operator.id)).toEqual([DEMO_OPERATOR_IDS.BUDI, DEMO_OPERATOR_IDS.ANDI, DEMO_OPERATOR_IDS.RINA]);
    expect(OPERATORS.map((operator) => operator.username)).toEqual(['budi.santoso', 'andi.pratama', 'rina.wijaya']);
    expect(FACTORY_OPERATORS.map((operator) => operator.id)).toEqual([FACTORY_OPERATOR_IDS.VENDOR_ROOT, FACTORY_OPERATOR_IDS.VENDOR_TEKNISI]);
    expect(FACTORY_OPERATORS.map((operator) => operator.username)).toEqual(['root', 'gsp.teknisi']);
    // A vendor is a supervisor or a technician: the two roles the pre-deliver procedure needs.
    expect(FACTORY_OPERATORS.map((operator) => operator.role)).toEqual(['SUPERVISOR', 'TECHNICIAN']);
  });

  it('the two worlds share no id, and ALL_OPERATORS names both', () => {
    const demo = OPERATORS.map((operator) => operator.id);
    expect(FACTORY_OPERATORS.some((operator) => demo.includes(operator.id))).toBe(false);
    expect(ALL_OPERATORS.map((operator) => operator.id)).toEqual([...demo, ...FACTORY_OPERATORS.map((operator) => operator.id)]);
    expect(Object.values(OPERATOR_IDS).sort()).toEqual(ALL_OPERATORS.map((operator) => operator.id).sort());
  });

  it('an actor of either world is named by its own display name (audit messages, screens)', () => {
    expect(operatorName(OPERATOR_IDS.ANDI)).toBe('AKP Andi Pratama');
    expect(operatorName(OPERATOR_IDS.VENDOR_ROOT)).toBe('PT GSP (root)');
    expect(operatorName(OPERATOR_IDS.VENDOR_TEKNISI)).toBe('PT GSP (teknisi)');
    expect(operatorName(null)).toBe('System');
  });

  it('the idle baseline — the demonstration dataset — holds the three demo accounts and no vendor', () => {
    const state = createIdleState({ now: NOW, seed: 20261001 });
    expect(state.operators.map((operator) => operator.id)).toEqual(OPERATORS.map((operator) => operator.id));
    expect(state.evidence.length).toBeGreaterThan(0);
    expect(state.audit.total).toBeGreaterThan(0);
  });
});

describe('createFactoryState: the state of a unit leaving the workshop', () => {
  it('holds the two vendor identities and no demonstration result', () => {
    const state = createFactoryState(NOW, IDENTITY);
    expect(state.operators).toEqual(FACTORY_OPERATORS.map((operator) => ({ ...operator })));
    expect(state.sessionHistory).toEqual([]);
    expect(state.evidence).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.alerts).toEqual([]);
    expect(state.session).toBeNull();
    expect(state.audit).toEqual({ rows: [], head: GENESIS_HASH, total: 0, dropped: 0 });
    expect(state.meta.counters).toEqual({ event: 1, session: 1, caseNumber: 1, evidence: 1, item: 1 });
  });

  it("is named by the unit's own configuration, and stays unpaired", () => {
    const state = createFactoryState(NOW, IDENTITY);
    expect([state.device.id, state.device.name, state.device.room]).toEqual(['DEMS-BENCH-01', 'DEMS Bench GSP', 'DEMS Bench GSP']);
    expect(state.pairing.state).toBe(PairingState.UNPAIRED);
    expect(state.pairing.pairedAt).toBeNull();
    expect(state.pairing.certificateFingerprint).toBe(IDENTITY.certificateFingerprint);
    // The hardware identity is provisioning's to fill; the factory state invents none.
    expect(state.device.identity.serialNumber).toBe('');
  });

  it('carries no capture selector: the technician arranges the cameras and microphones on site', () => {
    const state = createFactoryState(NOW, IDENTITY);
    expect(state.captureDevices).toEqual({ devices: [] });
    expect(state.captureConfig.cameras).toEqual([]);
    expect(state.captureConfig.mics).toEqual([]);
  });

  it('is pure: the same instant and the same name give the same state', () => {
    expect(createFactoryState(NOW, IDENTITY)).toEqual(createFactoryState(NOW, IDENTITY));
  });
});
