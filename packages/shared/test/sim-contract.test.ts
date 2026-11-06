// Simulator contract (masterplan/01_specs.md §14.7): rng, clock, canonical dataset, the audit
// hash chain, evidence integrity, selectors and the export boundary.
// Step 32 owns the behaviour tests (sim-determinism, session-machine, audio, storage-math,
// hash-chain with inject('AUDIT_TAMPER'), sim-platform-neutral, sim-mobile-additions) and
// updated this file where the engine changed the contract: the dataset gained 7 items sealed
// today (D54 b) and every action is now implemented.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as root from '../src/index';
import { motion } from '../src/tokens/tokens';
import {
  appendAudit,
  AUDIO_FRAME_MS,
  buildEvidenceIntegrity,
  buildItemIntegrity,
  canonicalJSON,
  createIdleState,
  createManualClock,
  createRng,
  createRngStreams,
  createSim,
  deriveSeed,
  demoPackageIntegrityFor,
  emptyAuditLog,
  formatDuration,
  formatYmd,
  GENESIS_HASH,
  mulberry32,
  OPERATORS,
  selectEvidenceStats,
  selectPendingSummaryId,
  selectSealedHourly,
  selectStorage,
  selectSystemState,
  sha256Hex,
  SimNotImplementedError,
  selectSealedToday,
  startOfWibDay,
  tamperAuditRow,
  toSnapshot,
  toWibIso,
  verifyAuditChain,
  wibDateParts,
  type SimActions,
  EVIDENCE_NOT_SEALED_DIGEST,
  EVIDENCE_NOT_SEALED_SIGNATURE,
  hasSealedValues,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 2026-10-01 10:00 WIB
const SEED = 20261001;

describe('rng (mulberry32, one stream per subsystem)', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(SEED);
    const b = mulberry32(SEED);
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('keeps streams independent: drawing from one never shifts another', () => {
    const quiet = createRngStreams(SEED);
    const busy = createRngStreams(SEED);
    for (let i = 0; i < 100; i += 1) busy.get('audio:AUDIO-01').next();
    busy.get('some-new-subsystem').next();
    expect(busy.get('health').next()).toBe(quiet.get('health').next());
  });

  it('derives different sequences per salt and per epoch', () => {
    expect(deriveSeed(SEED, 'health')).not.toBe(deriveSeed(SEED, 'events'));
    expect(deriveSeed(SEED, 'health', 0)).not.toBe(deriveSeed(SEED, 'health', 1));
    const streams = createRngStreams(SEED);
    const first = streams.get('ids').next();
    streams.reseed(1);
    expect(streams.epoch).toBe(1);
    expect(streams.get('ids').next()).not.toBe(first);
  });

  it('keeps helpers in range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i += 1) {
      const n = rng.int(300, 700);
      expect(n).toBeGreaterThanOrEqual(300);
      expect(n).toBeLessThanOrEqual(700);
    }
    expect(rng.hex(64)).toMatch(/^[0-9a-f]{64}$/);
    expect(rng.poisson(0)).toBe(0);
    expect(Number.isFinite(rng.gauss(-52, 2))).toBe(true);
    expect(['a', 'b']).toContain(rng.pick(['a', 'b']));
  });
});

describe('clock (UTC+07:00 arithmetic, no Intl)', () => {
  it('formats WIB dates and times', () => {
    expect(wibDateParts(START)).toMatchObject({ year: 2026, month: 10, day: 1, hour: 10, minute: 0 });
    expect(formatYmd(Date.UTC(2026, 8, 30, 17, 30))).toBe('20261001'); // 00:30 WIB next day
    expect(toWibIso(START)).toBe('2026-10-01T10:00:00.000+07:00');
    expect(startOfWibDay(START)).toBe(Date.UTC(2026, 8, 30, 17, 0, 0));
    expect(formatDuration((18 * 60 + 42) * 1_000)).toBe('00:18:42');
  });

  it('a manual clock only moves when told', () => {
    const clock = createManualClock(START);
    expect(clock.now()).toBe(START);
    clock.advance(1_500);
    expect(clock.now()).toBe(START + 1_500);
    expect(clock.tz).toBe('+07:00');
  });

  it('keeps the audio frame period equal to the motion token (20 Hz)', () => {
    expect(AUDIO_FRAME_MS).toBe(motion.ambient.meterFrameMs);
  });
});

describe('canonical dataset (§14.7, D28)', () => {
  const state = createIdleState({ now: START, seed: SEED });

  it('has the device, the 3 operators and no password in state', () => {
    expect(state.device).toMatchObject({ id: 'DEMS-IR-01', name: 'Interview Room 1', softwareVersion: '2.4.1' });
    expect(state.update.availableVersion).toBe('2.5.0');
    expect(OPERATORS.map((o) => [o.username, o.displayName, o.role, o.initials])).toEqual([
      ['budi.santoso', 'AKP Budi Santoso', 'INVESTIGATOR', 'BS'],
      ['andi.pratama', 'AKP Andi Pratama', 'SUPERVISOR', 'AP'],
      ['rina.wijaya', 'Rina Wijaya', 'TECHNICIAN', 'RW'],
    ]);
    expect(canonicalJSON(state)).not.toContain('demo-2026');
  });

  it('storage: 804 GB of 4.0 TB used = 20%, 3.2 TB free (D28/Q1)', () => {
    const storage = selectStorage(state);
    expect(storage.usedBytes).toBe(804e9);
    expect(storage.totalBytes).toBe(4e12);
    expect(storage.usedPercent).toBe(20);
    expect((storage.freeBytes / 1e12).toFixed(1)).toBe('3.2');
    expect(storage.state).toBe('READY');
  });

  it('evidence: the 6 step-31 items over the previous 2 days, unchanged, then 7 sealed today (D54 b)', () => {
    expect(state.evidence.slice(0, 6).map((e) => [e.id, e.sessionId, e.subjectName, e.subjectType, e.status])).toEqual([
      ['EV-20260929-0001', 'SES-20260929-0011', 'Siti Rahma', 'SAKSI', 'SEALED'],
      ['EV-20260929-0002', 'SES-20260929-0012', 'Budi Hartono', 'SAKSI', 'SEALED'],
      ['EV-20260930-0003', 'SES-20260930-0013', 'Rudi Setiawan', 'TERSANGKA', 'UNDER_REVIEW'],
      ['EV-20260930-0004', 'SES-20260930-0014', 'Maya Lestari', 'SAKSI', 'EXPORTED'],
      ['EV-20260930-0005', 'SES-20260930-0015', 'Dewi Anggraini', 'LAINNYA', 'SEALED'],
      ['EV-20260930-0006', 'SES-20260930-0016', 'Hendra Wijaya', 'SAKSI', 'RECORDED'],
    ]);
    expect(state.evidence.slice(6).map((e) => [e.id, e.sessionId, e.status])).toEqual([
      ['EV-20261001-0007', 'SES-20261001-0017', 'SEALED'],
      ['EV-20261001-0008', 'SES-20261001-0018', 'SEALED'],
      ['EV-20261001-0009', 'SES-20261001-0019', 'SEALED'],
      ['EV-20261001-0010', 'SES-20261001-0020', 'SEALED'],
      ['EV-20261001-0011', 'SES-20261001-0021', 'SEALED'],
      ['EV-20261001-0012', 'SES-20261001-0022', 'SEALED'],
      ['EV-20261001-0013', 'SES-20261001-0023', 'SEALED'],
    ]);
    // Today's items are follow-up interviews in the existing cases.
    const cases = new Set(state.evidence.slice(0, 6).map((e) => e.caseNumber));
    expect(state.evidence.slice(6).every((e) => cases.has(e.caseNumber))).toBe(true);
    expect(selectEvidenceStats(state)).toMatchObject({ total: 13, sealed: 10, recorded: 1, exported: 1, underReview: 1, pending: 1, sealedToday: 7 });
    for (const item of state.evidence.slice(0, 6)) {
      expect(item.recordedAt).toBeLessThan(startOfWibDay(START));
      expect(item.signature).toMatchObject({ simulated: true, algorithm: 'SIMULATED-SHA256' });
      // Fix wave J (truth rule 3a): the seed's RECORDED item was never sealed - no track, the null digest, no verdict.
      if (item.sealedAt === null) {
        expect(item).toMatchObject({ id: 'EV-20260930-0006', status: 'RECORDED', tracks: [], manifestHash: EVIDENCE_NOT_SEALED_DIGEST, signature: EVIDENCE_NOT_SEALED_SIGNATURE, verification: { status: 'NOT_RUN', at: null } });
        expect(hasSealedValues(item)).toBe(false);
        continue;
      }
      expect(hasSealedValues(item)).toBe(true);
      expect(item.manifestHash).not.toBe(EVIDENCE_NOT_SEALED_DIGEST);
      expect(item.tracks.map((t) => t.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']);
      expect(item.tracks.every((t) => /^[0-9a-f]{64}$/.test(t.sha256))).toBe(true);
    }
  });

  it('session history mirrors the evidence, including the one INCOMPLETE session', () => {
    expect(state.sessionHistory).toHaveLength(13);
    const incomplete = state.sessionHistory.filter((s) => s.outcome === 'INCOMPLETE');
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]).toMatchObject({ evidenceId: 'EV-20260930-0006', faultKind: 'POWER_FAIL' });
    // Step 32: sessions 0017-0023 were today's follow-ups, so the next session is 0024.
    expect(state.meta.counters).toMatchObject({ session: 24, caseNumber: 8, evidence: 14 });
    expect(selectPendingSummaryId(state)).toBeNull();
  });

  it('evidence integrity: dataset items carry their DEMO package hashes; other items recompute exactly (step 54)', () => {
    const item = state.evidence[0];
    if (!item) throw new Error('no evidence');
    // Review 40 §5.c: the 13 dataset items display and verify the step-93 package values.
    expect(item.integritySource).toBe('DEMO_PACKAGE');
    const pkg = demoPackageIntegrityFor({
      evidenceId: item.id,
      sessionId: item.sessionId,
      caseNumber: item.caseNumber,
      subjectName: item.subjectName,
    });
    expect(item.manifestHash).toBe(pkg?.manifestSha256);
    expect(item.tracks.map((track) => track.sha256)).toEqual(pkg?.tracks);
    expect(item.signature.value).toBe(sha256Hex(item.manifestHash + item.signature.keyId));
    // A session without a package (another subject) keeps the synthetic, recomputable hashes.
    const input = {
      evidenceId: item.id,
      sessionId: item.sessionId,
      caseNumber: item.caseNumber,
      recordedAt: item.recordedAt,
      endedAt: item.endedAt,
      sizeBytes: item.sizeBytes,
    };
    const synthetic = buildItemIntegrity({ ...input, subjectName: 'Someone Else' });
    const again = buildEvidenceIntegrity(input);
    expect(synthetic.integritySource).toBe('SIMULATED');
    expect(synthetic.manifestHash).toBe(again.manifestHash);
    expect(synthetic.tracks).toEqual(again.tracks);
    expect(again.signature.value).toBe(sha256Hex(again.manifestHash + again.signature.keyId));
  });

  it('idle system state is READY, with 7 items sealed today across several hours (D54 b)', () => {
    expect(selectSystemState(state)).toEqual({ state: 'READY', flags: [], severity: 'OK' });
    const hourly = selectSealedHourly(state);
    expect(hourly).toHaveLength(24);
    expect(selectSealedToday(state)).toBe(7);
    expect(hourly.filter((count) => count > 0).length).toBeGreaterThanOrEqual(3);
    // At 10:00 WIB the follow-ups sit in office hours (07:00 onwards), all before now.
    expect(hourly.slice(0, 7).every((count) => count === 0)).toBe(true);
    expect(state.evidence.every((e) => e.sealedAt === null || e.sealedAt < START)).toBe(true);
  });

  it('is identical for the same instant (deterministic)', () => {
    expect(canonicalJSON(createIdleState({ now: START, seed: SEED }))).toBe(canonicalJSON(state));
  });
});

describe('audit hash chain (§14.7 events.ts)', () => {
  it('seeds the history through the real chain, which verifies', () => {
    const state = createIdleState({ now: START, seed: SEED });
    expect(state.audit.rows.length).toBeGreaterThan(20);
    expect(state.audit.rows[0]?.prevHash).toBe(GENESIS_HASH);
    expect(verifyAuditChain(state.audit)).toEqual({ ok: true, checked: state.audit.rows.length, head: state.audit.head });
    const times = state.audit.rows.map((r) => r.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('hash = sha256(prevHash ‖ canonicalJSON(body))', () => {
    const { row } = appendAudit(emptyAuditLog(), { type: 'SYSTEM_BOOT', message: 'boot' }, START);
    const { prevHash: _p, hash: _h, ...body } = row;
    expect(row.hash).toBe(sha256Hex(GENESIS_HASH + canonicalJSON(body)));
    expect(row).toMatchObject({ seq: 1, id: 'AUD-000001', category: 'SYSTEM', severity: 'INFO' });
  });

  it('fails at exactly the tampered index', () => {
    let log = emptyAuditLog();
    for (let i = 0; i < 10; i += 1) log = appendAudit(log, { type: 'FRAME_HASH', message: `frame ${i}` }, START + i).log;
    expect(verifyAuditChain(log).ok).toBe(true);
    expect(verifyAuditChain(tamperAuditRow(log, 6))).toEqual({
      ok: false,
      checked: 6,
      index: 6,
      seq: 7,
      reason: 'HASH_MISMATCH',
    });
    // Re-hashing the tampered row moves the break to the next link.
    const rows = log.rows.slice();
    const target = rows[3];
    if (!target) throw new Error('row missing');
    const altered = { ...target, message: 'rewritten' };
    const { prevHash: _p, hash: _h, ...body } = altered;
    rows[3] = { ...altered, hash: sha256Hex(altered.prevHash + canonicalJSON(body)) };
    expect(verifyAuditChain({ ...log, rows })).toMatchObject({ ok: false, index: 4, reason: 'PREV_LINK_BROKEN' });
  });

  it('keeps 1000 rows and verifies from the oldest kept row as the anchor', () => {
    let log = emptyAuditLog();
    for (let i = 0; i < 1_005; i += 1) log = appendAudit(log, { type: 'WRITE_VERIFIED', message: 'ok' }, START + i).log;
    expect(log.rows).toHaveLength(1_000);
    expect(log).toMatchObject({ total: 1_005, dropped: 5 });
    expect(log.rows[0]?.seq).toBe(6);
    expect(verifyAuditChain(log).ok).toBe(true);
  });

  it('canonicalJSON sorts keys, drops undefined and rejects lossy values', () => {
    expect(canonicalJSON({ b: 1, a: [true, null, 'x'], c: undefined, d: -0 })).toBe('{"a":[true,null,"x"],"b":1,"d":0}');
    expect(() => canonicalJSON({ x: Number.NaN })).toThrow(TypeError);
    expect(() => canonicalJSON({ x: () => 1 })).toThrow(TypeError);
  });

  it('verifyAuditChain() on a live sim passes', () => {
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null });
    expect(sim.actions.verifyAuditChain().ok).toBe(true);
  });
});

describe('store contract', () => {
  it('snapshot = state minus audio, clock and auth', () => {
    const state = createIdleState({ now: START, seed: SEED });
    const snapshot = toSnapshot(state) as Record<string, unknown>;
    expect('clock' in snapshot || 'auth' in snapshot || 'audio' in snapshot).toBe(false);
    expect(Object.keys(snapshot)).toHaveLength(Object.keys(state).length - 3);
  });

  it('audio frames are plain numbers and booleans (SCR-01)', () => {
    const frame = createIdleState({ now: START, seed: SEED }).audio.inputs['MIC-02']!;
    for (const value of Object.values(frame)) expect(['number', 'boolean']).toContain(typeof value);
  });

  it('setTabletLink updates the Devices row and writes one audit row', () => {
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null });
    const before = sim.store.getState().audit.total;
    sim.actions.setTabletLink('OFFLINE');
    sim.actions.setTabletLink('OFFLINE'); // no-op
    const state = sim.store.getState();
    expect(state.tabletLink.state).toBe('OFFLINE');
    expect(state.otherDevices.find((d) => d.id === 'TABLET')).toMatchObject({ online: false, status: 'OFFLINE' });
    expect(state.audit.total).toBe(before + 1);
    expect(selectSystemState(state).state).toBe('ATTENTION');
  });

  it('step 32 implemented every action: none throws SimNotImplementedError any more', () => {
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null });
    const actions: (keyof SimActions)[] = [
      'createSession', 'beginPrecheck', 'acknowledgePrecheckWarnings', 'retryPrecheck', 'startRecording',
      'stopRecording', 'cancel', 'recover', 'addMarker', 'addNote', 'snapshot', 'acknowledgeSummary',
      'verify', 'exportEvidence', 'archiveEvidence', 'exportAudit', 'inject', 'clearFault', 'resetClip',
      'acknowledgeAlert', 'loadScenario', 'runDiagnostics', 'deviceCommand', 'setStoragePolicy',
      'startSoftwareUpdate', 'pair', 'unpair',
    ];
    for (const name of actions) {
      const action = sim.actions[name] as (...args: unknown[]) => unknown;
      try {
        action();
      } catch (error) {
        // Called with no arguments, some actions refuse (illegal transition, unknown ID); none is a stub.
        expect(error).not.toBeInstanceOf(SimNotImplementedError);
      }
    }
    expect(createSim({ scenario: 'recording', clock: createManualClock(START), storage: null, authStorage: null }).store.getState().session?.state).toBe('RECORDING');
  });
});

describe('export boundary (rev 3: the simulator only through @dems/shared/sim)', () => {
  it('the root barrel does not re-export the simulator', () => {
    expect('createSim' in root).toBe(false);
    expect('SimProvider' in root).toBe(false);
    const source = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/from '\.\/sim/);
  });

  it('package.json maps ./sim to src/sim/index.ts', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {
      exports: Record<string, string>;
    };
    expect(pkg.exports['./sim']).toBe('./src/sim/index.ts');
  });
});
