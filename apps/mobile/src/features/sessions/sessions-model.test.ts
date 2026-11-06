/**
 * Sessions hub view model (04_mobile_specs §4.9): rows from the simulator's `sessionHistory`
 * (including the INCOMPLETE session) plus the current session, filters, search, chip recipes and
 * the hand-off table. Pure functions against the real D61 dataset.
 */
import { describe, expect, it } from '@jest/globals';
import { SessionState } from '@dems/shared/domain';
import { DEFAULT_SEED, SessionOutcome, createIdleState, selectPendingSummaryId, selectSessionHistory, startOfWibDay } from '@dems/shared/sim';
import { TEST_START } from '@/runtime/testing/test-sim';
import {
  HUB_STATUS_SPEC,
  activeRow,
  activeStatusFor,
  buildRows,
  elapsedSeconds,
  evidenceHrefFor,
  evidenceSuffix,
  filterCounts,
  filterRows,
  handOffFor,
  historyRow,
  isFiltered,
  matchesQuery,
  normalizeQuery,
  sizeParts,
  type ActiveSessionFields,
} from './sessions-model';

const state = createIdleState({ now: TEST_START, seed: DEFAULT_SEED });
const history = selectSessionHistory(state);

const ACTIVE: ActiveSessionFields = {
  id: 'SES-20261001-0024',
  state: SessionState.RECORDING,
  caseNumber: 'LP/2026/1001-0007',
  subjectName: 'Ahmad Fauzi',
  subjectType: 'TERSANGKA',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  createdAt: TEST_START - 1_200_000,
  startedAt: TEST_START - 1_122_000,
  evidenceId: null,
  faultKind: null,
};

describe('sessions-model rows', () => {
  it('maps the whole history, newest first, with exactly one INCOMPLETE row', () => {
    const rows = buildRows(history, null, null);
    expect(rows.map((row) => row.id)).toEqual(history.map((entry) => entry.id));
    expect(rows.filter((row) => row.status === 'INCOMPLETE')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'SEALED')).toHaveLength(history.length - 1);
    const incomplete = rows.find((row) => row.status === 'INCOMPLETE')!;
    expect(incomplete.evidenceId).not.toBeNull();
    expect(incomplete.pendingSummary).toBe(false);
  });

  it('puts the current recording session first and never lists a sealed current session twice', () => {
    const rows = buildRows(history, ACTIVE, null);
    expect(rows[0]).toMatchObject({ id: ACTIVE.id, status: 'RECORDING', active: true, durationMs: null, endedAt: null });
    expect(rows).toHaveLength(history.length + 1);

    const sealedCurrent = { ...ACTIVE, id: history[0]!.id, state: SessionState.SEALED };
    expect(buildRows(history, sealedCurrent, null)).toHaveLength(history.length);
  });

  it('maps current-session states to hub statuses (setup and sealed states are not listed)', () => {
    expect(activeStatusFor(SessionState.RECORDING)).toBe('RECORDING');
    expect(activeStatusFor(SessionState.STOPPING)).toBe('FINALIZING');
    expect(activeStatusFor(SessionState.FINALIZING)).toBe('FINALIZING');
    expect(activeStatusFor(SessionState.FAULT)).toBe('FAULT');
    expect(activeStatusFor(SessionState.RECOVERY)).toBe('FAULT');
    for (const state of [SessionState.CREATE, SessionState.PRECHECK, SessionState.ARMED, SessionState.SEALED, null]) {
      expect(activeStatusFor(state)).toBeNull();
    }
    expect(activeRow({ ...ACTIVE, state: SessionState.ARMED })).toBeNull();
    expect(activeRow({ ...ACTIVE, startedAt: null, state: SessionState.FAULT })?.startedAt).toBe(ACTIVE.createdAt);
  });

  it('flags the sealed session whose summary is still unacknowledged', () => {
    const sealed = history.find((entry) => entry.outcome === SessionOutcome.SEALED)!;
    expect(historyRow(sealed, sealed.id).pendingSummary).toBe(true);
    expect(historyRow(sealed, null).pendingSummary).toBe(false);
    expect(selectPendingSummaryId(state)).toBeNull();
  });
});

describe('sessions-model filters and search', () => {
  const rows = buildRows(history, ACTIVE, null);

  it('All, Sealed, Incomplete and Today (WIB day of the simulator clock)', () => {
    expect(filterRows(rows, { filter: 'ALL', query: '' }, TEST_START)).toHaveLength(rows.length);
    expect(filterRows(rows, { filter: 'SEALED', query: '' }, TEST_START).every((row) => row.status === 'SEALED')).toBe(true);
    expect(filterRows(rows, { filter: 'INCOMPLETE', query: '' }, TEST_START).map((row) => row.status)).toEqual(['INCOMPLETE']);
    // D61: the interviews sealed today (seven in the dataset), plus the current recording.
    const sealedToday = history.filter((entry) => startOfWibDay(entry.endedAt) === startOfWibDay(TEST_START)).length;
    expect(sealedToday).toBeGreaterThan(0);
    const today = filterRows(rows, { filter: 'TODAY', query: '' }, TEST_START);
    expect(today).toHaveLength(sealedToday + 1);
    expect(today[0]!.id).toBe(ACTIVE.id);
    expect(filterCounts(rows, '', TEST_START)).toEqual({
      ALL: rows.length,
      SEALED: history.length - 1,
      INCOMPLETE: 1,
      TODAY: sealedToday + 1,
    });
  });

  it('searches session ID, case number, subject and evidence ID, case-insensitively', () => {
    const target = rows.find((row) => row.status === 'INCOMPLETE')!;
    expect(matchesQuery(target, target.id.toLowerCase())).toBe(true);
    expect(matchesQuery(target, `  ${target.subjectName.toUpperCase()}  `)).toBe(true);
    expect(matchesQuery(target, target.caseNumber)).toBe(true);
    expect(matchesQuery(target, target.evidenceId!)).toBe(true);
    expect(matchesQuery(target, 'zzz')).toBe(false);
    expect(normalizeQuery(`  a   b ${'x'.repeat(80)}`)).toHaveLength(64);
    expect(isFiltered({ filter: 'ALL', query: '   ' })).toBe(false);
    expect(isFiltered({ filter: 'TODAY', query: '' })).toBe(true);
  });
});

describe('sessions-model chips and hand-offs', () => {
  it('uses the D28/Q4 recipes: Sealed violet with a lock, Recording danger dot, Incomplete amber', () => {
    expect(HUB_STATUS_SPEC.SEALED).toEqual({ tone: 'sealed', icon: 'lock', filled: false });
    expect(HUB_STATUS_SPEC.RECORDING).toEqual({ tone: 'danger', icon: 'dot', filled: true });
    expect(HUB_STATUS_SPEC.INCOMPLETE.tone).toBe('warning');
    expect(HUB_STATUS_SPEC.FAULT.tone).toBe('danger');
  });

  it('routes each row: monitor, finalization, recovery, summary, evidence (phone) or detail', () => {
    const rows = buildRows(history, null, null);
    const sealed = rows.find((row) => row.status === 'SEALED' && row.evidenceId)!;
    const incomplete = rows.find((row) => row.status === 'INCOMPLETE')!;
    const recording = activeRow(ACTIVE)!;

    expect(handOffFor(recording, false)).toEqual({ kind: 'live', href: '/session/live' });
    expect(handOffFor(recording, true).kind).toBe('live');
    expect(handOffFor(activeRow({ ...ACTIVE, state: SessionState.FINALIZING })!, false).href).toBe('/session/finalizing');
    expect(handOffFor(activeRow({ ...ACTIVE, state: SessionState.RECOVERY })!, false).href).toBe('/session/recovery');
    expect(handOffFor({ ...sealed, pendingSummary: true }, true)).toEqual({ kind: 'summary', href: `/session/summary/${sealed.id}` });
    expect(handOffFor(sealed, false)).toEqual({ kind: 'evidence', href: `/evidence/${sealed.evidenceId}` });
    expect(handOffFor(sealed, true)).toEqual({ kind: 'detail', href: `/sessions/${sealed.id}` });
    expect(handOffFor(incomplete, false)).toEqual({ kind: 'detail', href: `/sessions/${incomplete.id}` });
    expect(evidenceHrefFor('EV-20261001-0013', true)).toBe('/evidence?selected=EV-20261001-0013');
    expect(evidenceHrefFor('EV-20261001-0013', false)).toBe('/evidence/EV-20261001-0013');
  });

  it('formats sizes, the live elapsed time and evidence suffixes', () => {
    expect(sizeParts(1_490_000_000)).toEqual({ unit: 'gb', value: '1.5' });
    expect(sizeParts(820_000_000)).toEqual({ unit: 'mb', value: '820.0' });
    expect(sizeParts(null)).toBeNull();
    expect(elapsedSeconds(1_000, null, 62_999)).toBe(61);
    expect(elapsedSeconds(1_000, 31_000, 99_000)).toBe(30);
    expect(elapsedSeconds(null, null, 5_000)).toBe(0);
    expect(evidenceSuffix('EV-20261001-0013')).toBe('0013');
    expect(evidenceSuffix(null)).toBeNull();
  });
});
