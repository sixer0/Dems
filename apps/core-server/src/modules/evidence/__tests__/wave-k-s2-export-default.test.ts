// Fix wave K, driver S2 - re-gate 94 notes G94b-11 (an export request without a destination was
// recorded as "Case file transfer (simulated)" on a Core in its OWN capture) and G94b-12 (web and
// mobile pre-selected different destinations): ONE default, the Core's, true to its capture mode.
// The route hands the hosted action `withDestinationDefault(...)` and operation 40 states
// `exportDestinationDefault` (`exportDestinationDefaultOf`); the route itself is held by
// `wave-k-s2-sending-device.db.test.ts`.
import { CORE_API_EXAMPLES, EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE, EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE, EvidenceDetailSchema, EvidenceExportAcceptedSchema } from '@dems/shared/api';
import { DEFAULT_EXPORT_DESTINATION, DEFAULT_EXPORT_DESTINATION_REAL, createManualClock, createSim } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { exportDestinationDefaultOf, withDestinationDefault } from '../export-request';

describe('G94b-11 / G94b-12: one default export destination, true to the mode of the Core', () => {
  it('a Core in its own capture names the destination without "simulated"; a Core in simulated capture keeps the word (control)', () => {
    expect(exportDestinationDefaultOf('real')).toBe('Case file transfer');
    expect(exportDestinationDefaultOf('real')).not.toMatch(/simulated/i);
    expect(exportDestinationDefaultOf('simulated')).toBe('Case file transfer (simulated)');
    expect([DEFAULT_EXPORT_DESTINATION_REAL, DEFAULT_EXPORT_DESTINATION]).toEqual([exportDestinationDefaultOf('real'), exportDestinationDefaultOf('simulated')]);
    expect(EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE).toBe(exportDestinationDefaultOf('real'));
  });

  it('a request without a destination takes the default of the mode; a named destination is never replaced', () => {
    expect(withDestinationDefault({ reason: 'Case file handover', destination: '' }, 'real')).toEqual({ reason: 'Case file handover', destination: 'Case file transfer' });
    expect(withDestinationDefault({ reason: 'Case file handover', destination: '   ' }, 'real').destination).toBe('Case file transfer');
    // A Core in simulated capture hands the request on as it is: the hosted action names the simulator's default, which is that Core's.
    const empty = { reason: 'Case file handover', destination: '' };
    expect(withDestinationDefault(empty, 'simulated')).toBe(empty);
    const named = { reason: 'Case file handover', destination: 'Encrypted USB drive' };
    expect(withDestinationDefault(named, 'real')).toBe(named);
  });

  it('WHAT IS RECORDED: the audit row and the custody entry of a request the Core handed its real-capture default say "Case file transfer" - without the hand-over the simulator writes its own "(simulated)" (the finding)', () => {
    const rowOf = (destination: string): { row: unknown; custody: unknown } => {
      const sim = createSim({ clock: createManualClock(Date.UTC(2026, 9, 11, 3, 0, 0)), storage: null, authStorage: null, capture: 'simulated' });
      sim.actions.signIn('andi.pratama', 'demo-2026');
      const evidenceId = sim.store.getState().evidence.find((item) => item.status === 'SEALED')?.id ?? '';
      expect(sim.actions.exportEvidence(evidenceId, withDestinationDefault({ reason: 'Case file handover', destination }, 'real'))).toMatchObject({ ok: true });
      const state = sim.store.getState();
      return { row: state.audit.rows.at(-1)?.details['destination'], custody: state.evidence.find((item) => item.id === evidenceId)?.custody.at(-1)?.detail };
    };
    expect(rowOf('')).toEqual({ row: 'Case file transfer', custody: 'Case file transfer' });
    // The finding, shown: the same request NOT handed the Core's default.
    const sim = createSim({ clock: createManualClock(Date.UTC(2026, 9, 11, 3, 0, 0)), storage: null, authStorage: null, capture: 'simulated' });
    sim.actions.signIn('andi.pratama', 'demo-2026');
    const evidenceId = sim.store.getState().evidence.find((item) => item.status === 'SEALED')?.id ?? '';
    sim.actions.exportEvidence(evidenceId, { reason: 'Case file handover', destination: '' });
    expect(sim.store.getState().audit.rows.at(-1)?.details['destination']).toBe('Case file transfer (simulated)');
  });

  it('the contract: operation 40 takes `exportDestinationDefault` (the productSealed example carries it); operation 42 takes `archiveOnCore`', () => {
    const example = CORE_API_EXAMPLES.getEvidence?.responses?.[200]?.['productSealed']?.value as Record<string, unknown>;
    expect(example['exportDestinationDefault']).toBe(EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE);
    expect(EvidenceDetailSchema.safeParse(example).success).toBe(true);
    expect(EvidenceDetailSchema.safeParse({ ...example, exportDestinationDefault: '' }).success).toBe(false);
    expect(EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE.archiveOnCore).toBe(false);
    expect(EvidenceExportAcceptedSchema.safeParse(EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE).success).toBe(true);
    expect(EvidenceExportAcceptedSchema.safeParse({ ...EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE, archiveOnCore: 'no' }).success).toBe(false);
  });
});
