// Integration pass E3 item 6: the v2 demo items of a seed, pure (`../demo-packages`) and through
// `prepareSeed` with a port double. No database, no file, no process.
import { DEMO_TAMPERED_FRAGMENT_TRACK, type CompleteSealInput } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { fromRows, toRows } from '../../mapping';
import { buildSeedState } from '../dataset';
import { seedDemoItemsOf, seedDemoSealProblem, withSeedSealedPackages, type SeedDemoItem, type SeedDemoPackages, type SeedDemoSeal } from '../demo-packages';
import { prepareSeed } from '../seed';

const NOW = 1_791_570_000_000;
const state = buildSeedState({ now: NOW });
const HASH = { algorithm: 'argon2id', memoryKib: 19_456, passes: 2, parallelism: 1, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2) };
const hashPassword = async () => HASH as never;

const sealOf = (item: SeedDemoItem, index: number): SeedDemoSeal => {
  const seal: CompleteSealInput = {
    sessionId: item.sessionId,
    sealedAt: NOW,
    manifestSha256: `${index}a`.repeat(32),
    signature: { value: `${index}c`.repeat(64), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
    tracks: [
      { trackId: 'VIDEO-01', sizeBytes: 4_000_000 + index, sha256: `${index}1`.repeat(32) },
      { trackId: 'VIDEO-02', sizeBytes: 4_100_000 + index, sha256: `${index}2`.repeat(32) },
    ],
    interrupted: false,
    durableEndAt: item.startedAt + 8_000,
    transcriptSha256: null,
    labelsStatus: null,
    developmentSources: true,
  };
  return {
    evidenceId: item.evidenceId,
    sessionId: item.sessionId,
    seal,
    mediaMs: 8_000,
    tampered: item.evidenceId.endsWith('-0005'),
    sourceRows: [
      { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'FAKE' },
      { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' },
      { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'FAKE' },
      { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'FAKE' },
    ],
  };
};
function port(answer: (items: readonly SeedDemoItem[]) => Awaited<ReturnType<SeedDemoPackages['seal']>>): SeedDemoPackages & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    seal: async (items) => (calls.push('seal'), answer(items)),
    place: async () => (calls.push('place'), { placed: [], notPlaced: [] }),
    discard: async () => void calls.push('discard'),
  };
}

describe('the two demo items of a dataset', () => {
  it('the tamper item (sequence 5) first, then the first clean SEALED demo item; described whole from the dataset', () => {
    const items = seedDemoItemsOf(state);
    expect(items.map((item) => item.evidenceId.slice(-4))).toEqual(['0005', '0001']);
    for (const item of items) {
      const dataset = state.evidence.find((entry) => entry.id === item.evidenceId);
      expect(item).toMatchObject({ sessionId: dataset?.sessionId, caseNumber: dataset?.caseNumber, subject: { name: dataset?.subjectName, type: dataset?.subjectType }, device: { deviceId: state.device.id }, operator: { investigatorId: dataset?.investigatorId } });
      expect(item.startedAt).toBe(dataset?.recordedAt);
    }
  });

  it('NEVER ONE ALONE: a dataset without the tamper item, or without a clean sealed item, gives none', () => {
    expect(seedDemoItemsOf({ ...state, evidence: state.evidence.filter((item) => !item.id.endsWith('-0005')) })).toEqual([]);
    expect(seedDemoItemsOf({ ...state, evidence: state.evidence.filter((item) => item.id.endsWith('-0005')) })).toEqual([]);
    expect(seedDemoItemsOf({ ...state, sessionHistory: [] })).toEqual([]);
  });
});

describe('the rows of the sealed items', () => {
  const items = seedDemoItemsOf(state);
  const packages = items.map(sealOf);
  const sealed = withSeedSealedPackages(state, packages);

  it('each item carries its seal: version 2, the real signature, two camera files, the development mark; the tamper item names VIDEO-02; the other eleven items are the same objects', () => {
    const tamper = sealed.evidence.find((item) => item.id === items[0]?.evidenceId);
    const clean = sealed.evidence.find((item) => item.id === items[1]?.evidenceId);
    expect(tamper).toMatchObject({ integritySource: 'DEMO_PACKAGE', manifestVersion: 2, developmentSources: true, tampered: true, tamperedTrackId: DEMO_TAMPERED_FRAGMENT_TRACK, manifestHash: packages[0]?.seal.manifestSha256, durationMs: 8_000, sealedAt: NOW });
    expect(clean).toMatchObject({ manifestVersion: 2, tampered: false, tamperedTrackId: null, signature: { algorithm: 'Ed25519', simulated: false }, sizeBytes: 8_100_002 });
    expect(clean?.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02']);
    expect(clean?.endedAt).toBe((clean?.recordedAt ?? 0) + 8_000);
    // Identity, case, custody and status are the dataset's.
    const before = state.evidence.find((item) => item.id === clean?.id);
    expect([clean?.caseNumber, clean?.subjectName, clean?.custody, clean?.status]).toEqual([before?.caseNumber, before?.subjectName, before?.custody, before?.status]);
    expect(sealed.evidence.filter((item, index) => item === state.evidence[index])).toHaveLength(11);
    expect(sealed.audit).toBe(state.audit);
  });

  it('THE CORE BOOTS ON THEM: the rows of that state map and read back as the same items (stored = committed)', () => {
    const rows = toRows(sealed, { at: NOW, seededAt: NOW, lastResetAt: null });
    expect(rows.evidenceItems.filter((row) => row.manifestVersion === 2).map((row) => [row.integritySource, row.signatureSimulated, row.signatureAlgorithm, row.developmentSources])).toEqual([
      ['DEMO_PACKAGE', false, 'Ed25519', true],
      ['DEMO_PACKAGE', false, 'Ed25519', true],
    ]);
    const back = fromRows({ ...rows, authSessions: [], pairingCodes: [], pairedDevices: [] } as never);
    for (const item of items) expect(back.evidence.find((entry) => entry.id === item.evidenceId)).toEqual(sealed.evidence.find((entry) => entry.id === item.evidenceId));
  });

  it('a seal the row cannot be written from is named: another item, no development mark, the tamper mark on the wrong item, a missing source row', () => {
    expect(seedDemoSealProblem(items, packages)).toBeNull();
    expect(seedDemoSealProblem(items, packages.slice(0, 1))).not.toBeNull();
    expect(seedDemoSealProblem(items, [...packages].reverse())).not.toBeNull();
    expect(seedDemoSealProblem(items, packages.map((entry) => ({ ...entry, seal: { ...entry.seal, developmentSources: false } })))).not.toBeNull();
    expect(seedDemoSealProblem(items, packages.map((entry) => ({ ...entry, tampered: !entry.tampered })))).not.toBeNull();
    expect(seedDemoSealProblem(items, packages.map((entry) => ({ ...entry, sourceRows: entry.sourceRows.slice(1) })))).not.toBeNull();
  });
});

describe('prepareSeed with the port: both items or the dataset as it is', () => {
  const plain = prepareSeed({ now: NOW }, { hashPassword });

  it('SEALED: two v2 rows, eight source rows, the audit rows untouched; place is the caller\'s', async () => {
    const double = port((items) => ({ status: 'SEALED', packages: items.map(sealOf) }));
    const prepared = await prepareSeed({ now: NOW }, { hashPassword, demoPackages: double });
    expect(prepared.demo.report).toMatchObject({ status: 'SEALED', items: [{ tampered: true }, { tampered: false }] });
    expect(prepared.rows.evidenceItems.filter((row) => row.manifestVersion === 2)).toHaveLength(2);
    expect(prepared.demo.sourceRows.map((row) => [row.slot, row.adapterKind, row.recordedAt])).toEqual(Array.from({ length: 2 }, () => [['VIDEO-01', 'FAKE', NOW], ['VIDEO-02', 'FAKE', NOW], ['MIC-PRIMARY', 'FAKE', NOW], ['MIC-STANDBY', 'FAKE', NOW]]).flat());
    expect(prepared.rows.auditLog).toEqual((await plain).rows.auditLog);
    expect(prepared.expectedHead).toEqual((await plain).expectedHead);
    expect(double.calls).toEqual(['seal']);
  });

  it('NEVER A HALF ITEM: a port that skips, rejects, or returns a seal that cannot be used leaves every row exactly as without the port, and the reason is in the report', async () => {
    const rowsOf = async (double: SeedDemoPackages) => prepareSeed({ now: NOW }, { hashPassword, demoPackages: double });
    const expected = (await plain).rows;
    const skipped = await rowsOf(port(() => ({ status: 'SKIPPED', reason: 'HELPER_ABSENT', message: 'the helper program /x/ffmpeg cannot be started' })));
    expect(skipped.rows.evidenceItems).toEqual(expected.evidenceItems);
    expect(skipped.rows.evidenceTracks).toEqual(expected.evidenceTracks);
    expect(skipped.rows.sessionHistory).toEqual(expected.sessionHistory);
    expect(skipped.demo).toEqual({ report: { status: 'SKIPPED', reason: 'HELPER_ABSENT', message: 'the helper program /x/ffmpeg cannot be started', items: [] }, sourceRows: [] });

    const rejecting = port(() => {
      throw new Error('boom');
    });
    const rejected = await rowsOf(rejecting);
    expect(rejected.rows.evidenceItems).toEqual(expected.evidenceItems);
    expect(rejected.demo.report).toMatchObject({ status: 'SKIPPED', reason: 'GENERATION_FAILED' });
    expect(rejecting.calls).toEqual(['seal', 'discard']);

    const half = port((items) => ({ status: 'SEALED', packages: items.slice(0, 1).map(sealOf) }));
    const unusable = await rowsOf(half);
    expect(unusable.rows.evidenceItems).toEqual(expected.evidenceItems);
    expect(unusable.demo.report).toMatchObject({ status: 'SKIPPED', reason: 'SEAL_NOT_USABLE' });
    expect(half.calls).toEqual(['seal', 'discard']);

    // A port that claims SEALED with no package at all: not usable either.
    const none = port(() => ({ status: 'SEALED', packages: [] }));
    const empty = await rowsOf(none);
    expect(empty.rows.evidenceItems).toEqual(expected.evidenceItems);
    expect(empty.demo.report).toMatchObject({ status: 'SKIPPED', reason: 'SEAL_NOT_USABLE' });
  });
});
