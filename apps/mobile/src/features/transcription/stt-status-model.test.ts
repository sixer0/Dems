// Row 118 (R-8; ux §8a tablet/phone columns): the pure view model of the transcription status.
import { describe, expect, it } from '@jest/globals';
import { SttConfigSchema, type SttConfig } from '@dems/shared/api';
import { AuditType, DEMO_OPERATOR_PASSWORD, type SimState } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import { selectSttAuditMark, sttStatusOf, testOutcomeOf } from './stt-status-model';

const CONFIG: SttConfig = SttConfigSchema.parse({
  enabled: true,
  backend: 'omlx-server',
  endpoint: 'http://127.0.0.1:8555/v1',
  model: 'whisper-large-v3-turbo',
  language: 'id',
  diarization: true,
  credentialSet: true,
  credentialKind: 'REFERENCE',
  revision: 7,
  updatedBy: 'OPR-002',
  updatedAt: 1_790_000_000_000,
  pendingForNextSession: true,
  lastTest: { reachable: true, modelAvailable: true, testedAt: 1_790_000_100_000 },
});

describe('sttStatusOf', () => {
  it('copies exactly the facts of ux §8a and nothing else: no endpoint, no credential kind, no revision, no author', () => {
    const view = sttStatusOf(CONFIG);
    expect(view).toEqual({
      enabled: true,
      backend: 'omlx-server',
      model: 'whisper-large-v3-turbo',
      labelling: true,
      credentialSet: true,
      test: { outcome: 'READY', testedAt: 1_790_000_100_000 },
      pendingForNextSession: true,
    });
    const serialised = JSON.stringify(view);
    for (const secret of ['127.0.0.1', 'REFERENCE', 'OPR-002', '"revision"', 'endpoint']) expect(serialised).not.toContain(secret);
  });

  it('a configuration without a stored credential says "not set"', () => {
    const { credentialKind: _kind, ...rest } = CONFIG;
    const view = sttStatusOf({ ...rest, credentialSet: false });
    expect(view.credentialSet).toBe(false);
  });
});

describe('testOutcomeOf', () => {
  it('maps the last test to the four outcomes', () => {
    expect(testOutcomeOf(undefined)).toEqual({ outcome: 'NEVER', testedAt: null });
    expect(testOutcomeOf({ reachable: true, modelAvailable: true, testedAt: 5 })).toEqual({ outcome: 'READY', testedAt: 5 });
    expect(testOutcomeOf({ reachable: true, modelAvailable: false, testedAt: 6 })).toEqual({ outcome: 'MODEL_MISSING', testedAt: 6 });
    // A backend that did not answer is "unreachable" whatever `modelAvailable` says.
    expect(testOutcomeOf({ reachable: false, modelAvailable: true, testedAt: 7 })).toEqual({ outcome: 'UNREACHABLE', testedAt: 7 });
  });
});

describe('selectSttAuditMark', () => {
  const stateWith = (rows: { seq: number; type: string }[]): SimState => ({ audit: { rows } }) as unknown as SimState;

  it('is the seq of the newest STT_CONFIG_CHANGED row; 0 when there is none', () => {
    expect(selectSttAuditMark(stateWith([]))).toBe(0);
    expect(selectSttAuditMark(stateWith([{ seq: 1, type: AuditType.MIC_SILENT }]))).toBe(0);
    expect(
      selectSttAuditMark(
        stateWith([
          { seq: 1, type: AuditType.STT_CONFIG_CHANGED },
          { seq: 2, type: AuditType.MIC_SILENT },
          { seq: 3, type: AuditType.STT_CONFIG_CHANGED },
          { seq: 4, type: AuditType.MIC_SILENT },
        ]),
      ),
    ).toBe(3);
  });

  it('moves when the simulator saves the configuration (the web-edit signal) and not when it only tests it', () => {
    const { sim } = createTestSim();
    // Ruling 0034 of 2026-10-29 (packages/shared/sim/auth.ts): op 91 needs CAPTURE_CONFIG,
    // which only TECHNICIAN holds — the writer signs in as `rina.wijaya`.
    expect(sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const before = selectSttAuditMark(sim.store.getState());
    expect(before).toBe(0);
    sim.request({ method: 'POST', path: '/api/v1/transcription/config/test' });
    expect(selectSttAuditMark(sim.store.getState())).toBe(before);
    const saved = sim.request({ method: 'POST', path: '/api/v1/transcription/config', body: { revision: 1, enabled: false } });
    expect(saved.status).toBe(200);
    const after = selectSttAuditMark(sim.store.getState());
    expect(after).toBeGreaterThan(0);
    // An update that changes nothing writes no row (C3 §2.5): the mark stays.
    sim.request({ method: 'POST', path: '/api/v1/transcription/config', body: { revision: 2, enabled: false } });
    expect(selectSttAuditMark(sim.store.getState())).toBe(after);
    sim.stop();
  });
});
