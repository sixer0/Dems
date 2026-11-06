// Storage math (AC-54; D28/Q1; 04 §9 #17): at load 804 GB of 4.0 TB = 20% USED, 3.2 TB free;
// estimated remaining = free ÷ 8.2 GB/h (±1 min); recording grows the volume at 8.2 GB/h;
// the storage faults force LOW (86%) and FULL (98.6%) and clear back exactly.
import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createSim,
  GB,
  RECORDING_BYTES_PER_HOUR,
  recordingBytes,
  selectStorage,
  storageStateFor,
  STORAGE_FULL_PERCENT,
  STORAGE_LOW_PERCENT,
  TB,
  type ScenarioName,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB
const MINUTE = 60_000;

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  return { sim, clock, run, state: () => sim.store.getState() };
}

describe('at load (AC-54, AC-75 data)', () => {
  it('used = 804 GB of 4.0 TB = 20% USED, 3.2 TB free, READY', () => {
    const storage = selectStorage(harness().state());
    expect(storage.usedBytes).toBe(804 * GB);
    expect(storage.totalBytes).toBe(4 * TB);
    expect(storage.usedPercent).toBe(20);
    expect(storage.usedRatioPercent).toBeCloseTo(20.1, 6);
    expect(storage.freeBytes).toBe(3_196 * GB);
    expect((storage.freeBytes / TB).toFixed(1)).toBe('3.2');
    expect(storage.state).toBe('READY');
  });

  it('estimated remaining = free ÷ 8.2 GB/h, within ±1 min', () => {
    const storage = selectStorage(harness().state());
    const expectedMs = (3_196 / 8.2) * 3_600_000; // ≈ 389 h 45 min
    expect(Math.abs(storage.estimatedRemainingMs - expectedMs)).toBeLessThanOrEqual(MINUTE);
    expect(RECORDING_BYTES_PER_HOUR).toBe(8.2 * GB);
  });

  it('the 24 h usage history ends at the load value and never decreases', () => {
    const { history } = harness().state().storage;
    expect(history).toHaveLength(24);
    expect(history.at(-1)).toMatchObject({ at: START, usedBytes: 804 * GB });
    for (let index = 1; index < history.length; index += 1) {
      expect(history[index]!.usedBytes).toBeGreaterThanOrEqual(history[index - 1]!.usedBytes);
    }
    // Today's sealed sessions show up as steps in the curve.
    expect(history[0]!.usedBytes).toBeLessThan(804 * GB);
  });
});

describe('while recording (8.2 GB/h)', () => {
  it('the evidence volume and the session grow by recordingBytes(elapsed); the estimate drops 1 s per second', () => {
    const h = harness('recording');
    const before = selectStorage(h.state());
    const bytesBefore = h.state().session?.bytesWritten ?? 0;
    expect(bytesBefore).toBe(recordingBytes((18 * 60 + 42) * 1_000));
    h.run(60_000, 100);
    const after = selectStorage(h.state());
    const session = h.state().session;
    const elapsed = h.clock.now() - (session?.startedAt ?? 0);
    expect(session?.bytesWritten).toBe(recordingBytes(elapsed));
    expect(after.usedBytes - before.usedBytes).toBe((session?.bytesWritten ?? 0) - bytesBefore);
    expect(before.estimatedRemainingMs - after.estimatedRemainingMs).toBeCloseTo(60_000, -2);
    expect(h.state().storage.writeBytesPerSec).toBe(Math.round((8.2 * GB) / 3_600));
  });

  it('after a live session seals, the volume grew by exactly the evidence size (stop between 1 Hz ticks)', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.actions.createSession({
      caseNumber: 'LP/2026/1001-0008',
      subjectType: 'SAKSI',
      subjectName: 'Bytes Saksi',
      investigatorId: 'OPR-001',
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    const before = selectStorage(h.state()).usedBytes;
    h.sim.actions.startRecording();
    h.run(42_350); // ends mid-second: the last 350 ms are not yet counted by the 1 Hz tick
    h.sim.actions.stopRecording('Interview completed');
    h.run(12_000);
    const evidence = h.state().evidence.at(-1);
    expect(h.state().session?.state).toBe('SEALED');
    expect(selectStorage(h.state()).usedBytes - before).toBe(evidence?.sizeBytes);
  });

  it('the sealed evidence size equals the bytes the session wrote', () => {
    const h = harness('recording');
    h.run(5_000);
    // Step 54 (review 40 M5): session commands need a signed-in operator with SESSION_START.
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.actions.stopRecording('Interview completed');
    h.run(12_000);
    const session = h.state().session;
    const evidence = h.state().evidence.at(-1);
    expect(session?.state).toBe('SEALED');
    expect(evidence?.sizeBytes).toBe(session?.bytesWritten);
    expect(evidence?.sizeBytes).toBe(recordingBytes((session?.stoppedAt ?? 0) - (session?.startedAt ?? 0)));
    expect(h.state().storage.writeBytesPerSec).toBe(0);
  });
});

describe('StorageState thresholds and the storage faults', () => {
  it('READY below 85%, LOW from 85%, FULL from 98%', () => {
    expect(storageStateFor(84.9)).toBe('READY');
    expect(storageStateFor(STORAGE_LOW_PERCENT)).toBe('LOW');
    expect(storageStateFor(97.99)).toBe('LOW');
    expect(storageStateFor(STORAGE_FULL_PERCENT)).toBe('FULL');
  });

  it('STORAGE_LOW → 86% LOW, STORAGE_FULL → 98.6% FULL, and clearing restores the exact usage', () => {
    const h = harness();
    h.sim.actions.inject('STORAGE_LOW');
    expect(selectStorage(h.state())).toMatchObject({ state: 'LOW', usedPercent: 86 });
    h.sim.actions.inject('STORAGE_FULL');
    expect(selectStorage(h.state())).toMatchObject({ state: 'FULL', usedBytes: 3_944 * GB });
    expect(selectStorage(h.state()).estimatedRemainingMs).toBeLessThan(7 * 3_600_000);
    h.sim.actions.clearFault('STORAGE_FULL');
    expect(selectStorage(h.state())).toMatchObject({ state: 'LOW', usedPercent: 86 });
    h.sim.actions.clearFault('STORAGE_LOW');
    expect(selectStorage(h.state())).toMatchObject({ state: 'READY', usedBytes: 804 * GB, usedPercent: 20 });
    expect(h.state().storage.simulatedFillBytes).toBe(0);
  });

  it('recording while LOW keeps counting real bytes under the simulated fill', () => {
    const h = harness('recording');
    const natural = selectStorage(h.state()).usedBytes;
    h.sim.actions.inject('STORAGE_LOW');
    h.run(10_000, 100);
    const grown = (h.state().session?.bytesWritten ?? 0) - recordingBytes((18 * 60 + 42) * 1_000);
    h.sim.actions.clearFault('STORAGE_LOW');
    expect(selectStorage(h.state()).usedBytes).toBe(natural + grown);
  });
});
