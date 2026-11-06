// The two pure functions of the storage module (plan row W37; spec §7.11): the design-book
// summary of operation 53 and the patch of operation 55. No app, no database.
import { CORE_API_EXAMPLES, STORAGE_EXAMPLES, StoragePolicyRequestSchema, StorageStatusResponseSchema, type StoragePolicyRequest } from '@dems/shared/api';
import { RECORDING_BYTES_PER_HOUR, createManualClock, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { policyPatchOf, storageStatusOf, type StorageStatusSource } from '../index';
import { CLOCK_START, engineDouble } from './support';

const TB = 1_000_000_000_000;

function source(evidence: { totalBytes: number; usedBytes: number }, over: Partial<SimState['storage']> = {}): StorageStatusSource {
  return {
    storage: {
      state: 'READY',
      volumes: [
        { id: 'NVME-SYS', kind: 'SYSTEM', label: 'NVMe (system)', totalBytes: 2 * TB, usedBytes: 212_000_000_000 },
        { id: 'HDD-EVIDENCE', kind: 'EVIDENCE', label: 'HDD (evidence)', ...evidence },
      ],
      writeBytesPerSec: 2_277_778,
      bitrateMbps: 18.3,
      history: [],
      lastWriteVerifiedAt: null,
      ...over,
    },
    storagePolicy: { retentionPolicy: 'YEAR_1', retentionDays: 400, autoArchive: false },
  };
}

describe('storageStatusOf: the design-book summary', () => {
  it('on the idle dataset it is the example the contract gives for the operation', async () => {
    const { sim } = await engineDouble(createManualClock(CLOCK_START));
    const example = CORE_API_EXAMPLES['getStorageStatus']?.responses?.[200]?.['atLoad']?.value;
    expect(example).toBeDefined();
    expect(storageStatusOf(sim.store.getState())).toEqual(example);
  });

  it('every member, from the evidence volume, the storage slice and the policy slice', () => {
    const state = source({ totalBytes: 4 * TB, usedBytes: 1 * TB });
    expect(storageStatusOf(state)).toEqual({
      state: 'READY',
      totalBytes: 4 * TB,
      usedBytes: 1 * TB,
      freeBytes: 3 * TB,
      usedPercent: 25,
      estimatedRemainingMs: Math.round(((3 * TB) / RECORDING_BYTES_PER_HOUR) * 3_600_000),
      writeBytesPerSec: 2_277_778,
      bitrateMbps: 18.3,
      volumes: [
        { id: 'NVME-SYS', kind: 'SYSTEM', label: 'NVMe (system)', totalBytes: 2 * TB, usedBytes: 212_000_000_000 },
        { id: 'HDD-EVIDENCE', kind: 'EVIDENCE', label: 'HDD (evidence)', totalBytes: 4 * TB, usedBytes: 1 * TB },
      ],
      retention: { policy: 'YEAR_1', days: 400, autoArchive: false },
    });
  });

  it('the totals are the EVIDENCE volume\'s, not the system volume\'s and not a sum', () => {
    const answer = storageStatusOf(source({ totalBytes: 8 * TB, usedBytes: 6 * TB }));
    expect([answer.totalBytes, answer.usedBytes, answer.freeBytes, answer.usedPercent]).toEqual([8 * TB, 6 * TB, 2 * TB, 75]);
  });

  it('the state is the slice\'s own, the percentage is rounded to a whole number, the remaining time is a whole number of milliseconds', () => {
    const low = storageStatusOf(source({ totalBytes: 4 * TB, usedBytes: 3_456_789_012_345 }, { state: 'LOW' }));
    expect(low.state).toBe('LOW');
    expect(low.usedPercent).toBe(86);
    expect(Number.isInteger(low.estimatedRemainingMs)).toBe(true);
    expect(low.estimatedRemainingMs).toBe(Math.round(((4 * TB - 3_456_789_012_345) / RECORDING_BYTES_PER_HOUR) * 3_600_000));
    expect(StorageStatusResponseSchema.safeParse(low).success).toBe(true);
  });

  it('a full volume answers 100 %, 0 bytes free and 0 ms remaining; a volume that reports more than its size never answers a negative number', () => {
    const full = storageStatusOf(source({ totalBytes: 4 * TB, usedBytes: 4 * TB }, { state: 'FULL', writeBytesPerSec: 0 }));
    expect([full.state, full.usedPercent, full.freeBytes, full.estimatedRemainingMs, full.writeBytesPerSec]).toEqual(['FULL', 100, 0, 0, 0]);
    expect(StorageStatusResponseSchema.safeParse(full).success).toBe(true);
    const over = storageStatusOf(source({ totalBytes: 4 * TB, usedBytes: 4 * TB + 5 }));
    expect([over.freeBytes, over.estimatedRemainingMs]).toEqual([0, 0]);
  });

  it('copies the five members of a volume and nothing else of it, and changes neither slice', () => {
    const state = source({ totalBytes: 4 * TB, usedBytes: 1 * TB });
    (state.storage.volumes[1] as unknown as Record<string, unknown>)['mountPoint'] = '/srv/evidence';
    const frozen = JSON.stringify(state);
    const answer = storageStatusOf(state);
    expect(Object.keys(answer.volumes[1] ?? {})).toEqual(['id', 'kind', 'label', 'totalBytes', 'usedBytes']);
    expect(answer.volumes[1]).not.toBe(state.storage.volumes[1]);
    expect(JSON.stringify(state)).toBe(frozen);
    expect(Object.keys(answer)).toEqual(['state', 'totalBytes', 'usedBytes', 'freeBytes', 'usedPercent', 'estimatedRemainingMs', 'writeBytesPerSec', 'bitrateMbps', 'volumes', 'retention']);
  });

  it('no instant is in the answer: the summary is the same at any clock', async () => {
    const clock = createManualClock(CLOCK_START);
    const { sim } = await engineDouble(clock);
    const first = storageStatusOf(sim.store.getState());
    clock.advance(86_400_000);
    expect(storageStatusOf(sim.store.getState())).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(/"at"|At"|serverTime/);
  });
});

describe('policyPatchOf: what of a body reaches the hosted action', () => {
  it.each<[string, StoragePolicyRequest, object]>([
    ['nothing', {}, {}],
    ['the policy alone', { retentionPolicy: 'YEAR_1' }, { retentionPolicy: 'YEAR_1' }],
    ['the days alone', { retentionDays: 45 }, { retentionDays: 45 }],
    ['the automatic archive alone, switched off', { autoArchive: false }, { autoArchive: false }],
    ['all three', { retentionPolicy: 'CASE_CLOSURE', retentionDays: 1_200, autoArchive: true }, { retentionPolicy: 'CASE_CLOSURE', retentionDays: 1_200, autoArchive: true }],
  ])('%s: a member is in the patch exactly when the body held it', (_label, body, patch) => {
    expect(policyPatchOf(body)).toEqual(patch);
    expect(Object.keys(policyPatchOf(body))).toEqual(Object.keys(patch));
  });

  it('a member that is present but undefined is not passed on as a key', () => {
    const patch = policyPatchOf({ retentionPolicy: undefined, retentionDays: undefined, autoArchive: undefined });
    expect(Object.keys(patch)).toEqual([]);
  });

  it('`false` and the smallest number of days are values, not absences', () => {
    expect(policyPatchOf({ autoArchive: false, retentionDays: 1 })).toEqual({ autoArchive: false, retentionDays: 1 });
  });

  it('nothing else of a body is copied, whatever it holds', () => {
    const body = { retentionDays: 30, actorId: 'OPR-002', at: 1, role: 'SUPERVISOR' } as unknown as StoragePolicyRequest;
    expect(policyPatchOf(body)).toEqual({ retentionDays: 30 });
  });

  it('the request examples of the contract parse, and each becomes the patch it names', () => {
    const examples = STORAGE_EXAMPLES['setStoragePolicy']?.request ?? {};
    expect(Object.keys(examples)).toEqual(['oneYear', 'noAutoArchive']);
    for (const example of Object.values(examples)) {
      const parsed = StoragePolicyRequestSchema.parse(example.value);
      expect(policyPatchOf(parsed)).toEqual(example.value);
    }
  });
});
