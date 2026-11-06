/**
 * Pure rules of the Evidence screens (step 83): filters, search, sort, chips, formatting, the
 * excerpt rule, the package join and the integrity verdicts (PASS for a pristine item, FAIL on
 * AUDIO-02 for the tampered evidence 0005; D51, D67), plus the scramble frames.
 */
import { describe, expect, it } from '@jest/globals';
import { DEMO_EVIDENCE_INDEX, getDemoEvidencePackage } from '@dems/shared/demo-data';
import { EvidenceStatus, type EvidenceItem } from '@dems/shared/sim';
import { HERO_STILL } from '@/components/media/brand-assets';
import { createTestSim } from '@/runtime/testing/test-sim';
import {
  EVIDENCE_FILTERS,
  EVIDENCE_STATUS_SPEC,
  EVIDENCE_TRACK_ORDER,
  coreIntegrityView,
  type CoreVerdict,
  LIFECYCLE_STAGES,
  checkExportReason,
  clampPosition,
  evidenceSuffixOf,
  excerptOffsetMs,
  failedCheckNames,
  fileSizeParts,
  filterEvidence,
  integrityFor,
  isArchivable,
  isExportable,
  isFiltered,
  isLiveLoopEvidence,
  lifecycleStatuses,
  matchesQuery,
  needsResync,
  normalizeQuery,
  packageFor,
  packageIntegrity,
  packageTimeSource,
  shortHash,
  simulatedIntegrity,
} from './evidence-model';
import { clipMsFor, mediaForEvidence, posterForEvidence } from './evidence-media';
import { RECORDED_VERIFY_V2_D5 } from './testing/verify-v2-recorded-d5';
import { SCRAMBLE_MAX_UPDATES, SCRAMBLE_MS, SCRAMBLE_STEP_MS, scrambleFrame } from './use-scramble';

/** The simulator's dataset at the demo instant (13 items, D61). */
function dataset(): EvidenceItem[] {
  return createTestSim().sim.store.getState().evidence;
}

const items = dataset();
const bySuffix = (suffix: string) => items.find((item) => item.id.endsWith(`-${suffix}`))!;

describe('list rules', () => {
  it('has the five MB 5 filters in order', () => {
    expect(EVIDENCE_FILTERS).toEqual(['ALL', 'RECORDED', 'SEALED', 'EXPORTED', 'UNDER_REVIEW']);
  });

  it('filters by status and keeps ARCHIVED only under All', () => {
    const sealed = filterEvidence(items, { filter: 'SEALED', query: '', sort: 'newest' });
    expect(sealed.length).toBeGreaterThan(0);
    expect(sealed.every((item) => item.status === EvidenceStatus.SEALED)).toBe(true);
    expect(filterEvidence(items, { filter: 'ALL', query: '', sort: 'newest' })).toHaveLength(items.length);
  });

  it('searches evidence ID, session ID, subject and case number, case-insensitively', () => {
    const target = bySuffix('0005');
    expect(matchesQuery(target, target.subjectName.toLowerCase())).toBe(true);
    expect(matchesQuery(target, `  ${target.sessionId.toUpperCase()} `)).toBe(true);
    expect(matchesQuery(target, target.caseNumber)).toBe(true);
    expect(matchesQuery(target, target.id.slice(-4))).toBe(true);
    expect(matchesQuery(target, 'zzz-not-there')).toBe(false);
    expect(matchesQuery(target, '')).toBe(true);
    expect(normalizeQuery(`a${' '.repeat(5)}b`)).toBe('a b');
    expect(normalizeQuery('x'.repeat(100))).toHaveLength(64);
  });

  it('sorts newest or oldest first by recording time', () => {
    const newest = filterEvidence(items, { filter: 'ALL', query: '', sort: 'newest' });
    const oldest = filterEvidence(items, { filter: 'ALL', query: '', sort: 'oldest' });
    expect(newest.map((item) => item.id)).toEqual(oldest.map((item) => item.id).reverse());
    for (let i = 1; i < newest.length; i += 1) expect(newest[i - 1]!.recordedAt).toBeGreaterThanOrEqual(newest[i]!.recordedAt);
  });

  it('knows when the list is filtered', () => {
    expect(isFiltered({ filter: 'ALL', query: '  ', sort: 'newest' })).toBe(false);
    expect(isFiltered({ filter: 'SEALED', query: '', sort: 'newest' })).toBe(true);
    expect(isFiltered({ filter: 'ALL', query: 'siti', sort: 'oldest' })).toBe(true);
  });
});

describe('chips and formatting', () => {
  it('Sealed is violet with a lock (D28/Q4); the other statuses follow 04 §4.10', () => {
    expect(EVIDENCE_STATUS_SPEC.SEALED).toEqual({ tone: 'sealed', icon: 'lock', filled: false });
    expect(EVIDENCE_STATUS_SPEC.RECORDED).toEqual({ tone: 'success', icon: 'dot', filled: true });
    expect(EVIDENCE_STATUS_SPEC.EXPORTED).toEqual({ tone: 'info', icon: 'upload', filled: false });
    expect(EVIDENCE_STATUS_SPEC.UNDER_REVIEW).toEqual({ tone: 'warning', icon: 'eye', filled: false });
  });

  it('formats sizes in decimal units and shortens hashes', () => {
    expect(fileSizeParts(3_200_000_000)).toEqual({ unit: 'gb', value: '3.2' });
    expect(fileSizeParts(804_000_000)).toEqual({ unit: 'mb', value: '804.0' });
    expect(fileSizeParts(4_000_000_000_000)).toEqual({ unit: 'tb', value: '4.0' });
    expect(fileSizeParts(Number.NaN)).toEqual({ unit: 'mb', value: '0.0' });
    expect(shortHash('0123456789abcdef0123456789abcdef')).toBe('01234567…89abcdef');
    expect(shortHash(null)).toBe('—');
  });
});

describe('package join (D61) and media', () => {
  it('joins every dataset item to its DEMO package by evidence suffix', () => {
    for (const item of items) {
      const pkg = packageFor(item.id);
      expect(pkg?.evidenceSuffix).toBe(evidenceSuffixOf(item.id));
      expect(pkg?.caseNumber).toBe(item.caseNumber);
    }
  });

  it('bundled media exist for EV 0001–0013; evidence 0014 plays the live loops; later items have none', () => {
    for (const item of items) expect(mediaForEvidence(item.id)).not.toBeNull();
    expect(isLiveLoopEvidence(DEMO_EVIDENCE_INDEX.liveSession.evidenceSuffixWhenSealed)).toBe(true);
    expect(mediaForEvidence('EV-20261001-0014')).not.toBeNull();
    expect(mediaForEvidence('EV-20261001-0099')).toBeNull();
    expect(posterForEvidence('EV-20261001-0099')).toBe(HERO_STILL);
    expect(posterForEvidence(bySuffix('0003').id)).toBe(mediaForEvidence(bySuffix('0003').id)!.poster['VIDEO-01']);
    expect(clipMsFor(getDemoEvidencePackage('0001'))).toBe(getDemoEvidencePackage('0001')!.excerptDurationMs);
    expect(clipMsFor(null)).toBe(0);
  });

  it('reads the sealed time source from the manifest', () => {
    expect(packageTimeSource(bySuffix('0001').id)).toBe('GNSS');
    expect(packageTimeSource('EV-20261001-0099')).toBeNull();
  });
});

describe('excerpt rule (64 §5)', () => {
  it('plays position p at p mod the clip length', () => {
    expect(excerptOffsetMs(0, 40_000)).toBe(0);
    expect(excerptOffsetMs(12_345, 40_000)).toBe(12_345);
    expect(excerptOffsetMs(40_000, 40_000)).toBe(0);
    expect(excerptOffsetMs(2_520_000, 40_000)).toBe(0);
    expect(excerptOffsetMs(2_519_000, 40_000)).toBe(39_000);
    expect(excerptOffsetMs(-5, 40_000)).toBe(0);
    expect(excerptOffsetMs(10, 0)).toBe(0);
  });

  it('clamps to the recording and re-seeks only past the drift tolerance (wrapping)', () => {
    expect(clampPosition(-1, 100)).toBe(0);
    expect(clampPosition(150, 100)).toBe(100);
    expect(needsResync(10.1, 10, 40)).toBe(false);
    expect(needsResync(11, 10, 40)).toBe(true);
    expect(needsResync(39.9, 0.1, 40)).toBe(false);
    expect(needsResync(Number.NaN, 1, 40)).toBe(false);
  });
});

describe('integrity: the package result, "verified by the Core" (D51)', () => {
  it('a pristine item (EV 0001) is PASS with four track rows and the DEMO precomputed label', () => {
    const model = integrityFor(bySuffix('0001'), Date.now());
    expect(model.source).toBe('package');
    expect(model.verdict).toBe('PASS');
    expect(model.failed).toEqual([]);
    expect(model.label).toBe('DEMO - precomputed');
    expect(model.tracks.map((row) => row.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']);
    expect(model.tracks.every((row) => row.ok && row.expected === row.actual)).toBe(true);
    expect(model.manifestHash).toBe(getDemoEvidencePackage('0001')!.signature.signedDigest);
    expect(model.signature.algorithm).toBe('Ed25519');
    expect(model.certificate?.sha256).toBe(DEMO_EVIDENCE_INDEX.certificate.sha256);
  });

  it('the tampered item (EV 0005) is FAIL on exactly its altered track, AUDIO-02', () => {
    const model = integrityFor(bySuffix('0005'), Date.now());
    expect(model.verdict).toBe('FAIL');
    expect(model.failed).toEqual(['track:AUDIO-02']);
    expect(failedCheckNames(model.failed)).toEqual(['AUDIO-02']);
    const audio2 = model.tracks.find((row) => row.trackId === 'AUDIO-02')!;
    expect(audio2.ok).toBe(false);
    expect(audio2.actual).not.toBe(audio2.expected);
    expect(model.tracks.filter((row) => !row.ok)).toHaveLength(1);
    expect(model.checks.every((row) => row.ok)).toBe(true);
  });

  it('every package but 0005 passes (13 PASS, 1 FAIL across the 14 packages)', () => {
    const verdicts = DEMO_EVIDENCE_INDEX.packages.map((pkg) => packageIntegrity(pkg).verdict);
    expect(verdicts.filter((v) => v === 'PASS')).toHaveLength(13);
    expect(verdicts.filter((v) => v === 'FAIL')).toHaveLength(1);
  });

  it('without a package it falls back to the simulator record, labelled SIMULATED', () => {
    const item = { ...bySuffix('0001'), id: 'EV-20261001-0099' };
    const model = integrityFor(item, Date.now());
    expect(model.source).toBe('simulated');
    expect(model.label).toBe('SIMULATED');
    expect(model.signature.algorithm).toBe('SIMULATED-SHA256');
    expect(simulatedIntegrity(bySuffix('0001'), Date.now()).verdict).toBe('PASS');
  });
});

describe('M3-14: the eight-track order of the integrity rows (audit row 205, D161)', () => {
  /** An item that holds the given tracks, each with a stand-in sealed hash (not a real digest). */
  const withTracks = (trackIds: readonly string[]): EvidenceItem => {
    const base = bySuffix('0001');
    return { ...base, tracks: trackIds.map((trackId) => ({ ...base.tracks[0]!, trackId, sha256: `sealed-${trackId}` })) } as EvidenceItem;
  };
  const EIGHT = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'];

  it('EVIDENCE_TRACK_ORDER is the eight tracks, cameras first', () => {
    expect([...EVIDENCE_TRACK_ORDER]).toEqual(EIGHT);
  });

  it('an 8-track item gives 8 rows in EVIDENCE_TRACK_ORDER, from the sealed hashes, before an answer', () => {
    const shuffled = withTracks(['AUDIO-04', 'VIDEO-03', 'AUDIO-01', 'VIDEO-01', 'AUDIO-03', 'VIDEO-04', 'AUDIO-02', 'VIDEO-02']);
    const view = coreIntegrityView(shuffled, null);
    expect(view.tracks).toHaveLength(8);
    expect(view.tracks.map((row) => row.trackId)).toEqual(EIGHT);
    expect(view.tracks.map((row) => row.expected)).toEqual(EIGHT.map((id) => `sealed-${id}`));
    expect(view.failed).toEqual([]);
  });

  it('a recorded D5 v2 answer (no v1 tracks, row 206 fixture) keeps the 8 rows of an 8-track item', () => {
    const d5 = RECORDED_VERIFY_V2_D5.d5Pass.body as unknown as CoreVerdict;
    expect(d5.tracks).toEqual([]);
    const view = coreIntegrityView(withTracks(EIGHT), d5);
    expect(view.tracks.map((row) => row.trackId)).toEqual(EIGHT);
  });

  it('a v1 answer that fails AUDIO-03 names it (the shared 4-track order dropped it)', () => {
    const item = withTracks(EIGHT);
    const verdict = {
      evidenceId: item.id,
      ok: false,
      at: 1791500000000,
      manifestOk: true,
      signatureOk: true,
      tracks: EIGHT.map((trackId) => ({ trackId, ok: trackId !== 'AUDIO-03', expected: `sealed-${trackId}`, actual: trackId === 'AUDIO-03' ? 'other' : `sealed-${trackId}` })),
    } as unknown as CoreVerdict;
    const view = coreIntegrityView(item, verdict);
    expect(view.tracks).toHaveLength(8);
    expect(view.failed).toEqual(['track:AUDIO-03']);
  });

  it('rule: a 4-track demo item gives its 4 rows, not 8 (rows only for tracks the item holds or the Core answered)', () => {
    const demo = bySuffix('0001');
    expect(demo.tracks.map((track) => track.trackId).sort()).toEqual(['AUDIO-01', 'AUDIO-02', 'VIDEO-01', 'VIDEO-02']);
    expect(coreIntegrityView(demo, null).tracks.map((row) => row.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']);
    expect(packageIntegrity(getDemoEvidencePackage('0001')!).tracks).toHaveLength(4);
  });

  it('rule: an item with no track and no answer keeps the four rows of the shared order (pre-M3-14 behaviour)', () => {
    expect(coreIntegrityView(withTracks([]), null).tracks.map((row) => row.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']);
  });

  it('packageIntegrity sorts an 8-track package into EVIDENCE_TRACK_ORDER (VIDEO-03 no longer first)', () => {
    const pkg = getDemoEvidencePackage('0001')!;
    const extra = ['AUDIO-04', 'VIDEO-03', 'AUDIO-03', 'VIDEO-04'].map((trackId) => ({ id: `track:${trackId}`, ok: true, expected: 'x', actual: 'x' }));
    const wide = { ...pkg, verification: { ...pkg.verification, checks: [...extra, ...pkg.verification.checks] } } as typeof pkg;
    expect(packageIntegrity(wide).tracks.map((row) => row.trackId)).toEqual(EIGHT);
  });
});

describe('lifecycle and export rules', () => {
  it('marks earlier stages done and the current one active', () => {
    const statuses = lifecycleStatuses('SEALED_LOCAL_EVIDENCE');
    expect(statuses).toHaveLength(LIFECYCLE_STAGES.length);
    expect(statuses.indexOf('active')).toBe(LIFECYCLE_STAGES.indexOf('SEALED_LOCAL_EVIDENCE'));
    expect(statuses.slice(0, 7).every((s) => s === 'done')).toBe(true);
    expect(lifecycleStatuses('UNKNOWN').every((s) => s === 'pending')).toBe(true);
  });

  it('exports sealed, reviewed and exported items; archives all but RECORDED and ARCHIVED', () => {
    expect(isExportable('SEALED')).toBe(true);
    expect(isExportable('UNDER_REVIEW')).toBe(true);
    expect(isExportable('EXPORTED')).toBe(true);
    expect(isExportable('RECORDED')).toBe(false);
    expect(isExportable('ARCHIVED')).toBe(false);
    expect(isArchivable('RECORDED')).toBe(false);
    expect(isArchivable('ARCHIVED')).toBe(false);
    expect(isArchivable('SEALED')).toBe(true);
  });

  it('needs an export reason of at least 5 characters after trimming (S21)', () => {
    expect(checkExportReason('   abcd  ').valid).toBe(false);
    expect(checkExportReason(' abcde ')).toEqual({ value: 'abcde', length: 5, valid: true });
    expect(checkExportReason('x'.repeat(501)).valid).toBe(false);
  });
});

describe('scramble (M-C-21)', () => {
  it('600 ms, at most 20 text updates', () => {
    expect(SCRAMBLE_MS).toBe(600);
    expect(SCRAMBLE_MAX_UPDATES).toBe(20);
    expect(SCRAMBLE_STEP_MS * (SCRAMBLE_MAX_UPDATES - 1)).toBeCloseTo(600);
  });

  it('reveals left to right and keeps non-hex characters', () => {
    const target = 'abcdef0123…4567';
    const zero = () => 0;
    expect(scrambleFrame(target, 1, zero)).toBe(target);
    const half = scrambleFrame(target, 0.5, zero);
    expect(half.slice(0, 7)).toBe(target.slice(0, 7));
    expect(half).toContain('…');
    expect(scrambleFrame(target, 0, zero).replace('…', '')).toMatch(/^0+$/);
  });
});
