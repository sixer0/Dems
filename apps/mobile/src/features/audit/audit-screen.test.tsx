/**
 * Operator Audit View (step 87; 04_mobile_specs §4.16; row 87 check "its test lists audit rows
 * including AUTH_SUCCESS with method BIOMETRIC and the session events MA-29 names"). Real route
 * file, real providers, real simulator (82 dataset rows at load).
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/audit-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { FaultKind, selectAuditChainBreak } from '@dems/shared/sim';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { renderAuditApp, runSessionFlow, settle } from './testing/audit-harness';
import { pressMenuItem } from './testing/kit-helpers';

/** Rendered row numbers in DOM order (FlashList keeps data order on a fresh mount; a recycled cell may sit anywhere). */
function visibleSeqs(): number[] {
  return screen
    .queryAllByTestId(/^audit-row-\d+$/)
    .map((node) => Number(String(node.props.testID).replace('audit-row-', '')))
    .filter((seq, index, all) => all.indexOf(seq) === index);
}

async function search(text: string) {
  fireEvent.changeText(screen.getByTestId('audit-search'), text);
  await settle();
}

describe('Operator Audit View', () => {
  beforeEach(() => resetMissingKeys());
  // MA-21: every string the screen renders comes from an i18n key.
  afterEach(() => expect(getMissingKeys()).toEqual([]));

  it('renders the audit list newest first with the chain intact and labels by event code', async () => {
    const h = renderAuditApp();
    await settle();
    expect(screen.getByTestId('screen-audit')).toBeTruthy();
    expect(screen.getByTestId('audit-chain-chip-ok')).toBeTruthy();
    const rows = h.sim.store.getState().audit.rows;
    const seqs = visibleSeqs();
    expect(seqs.length).toBeGreaterThan(5);
    expect(seqs[0]).toBe(rows.at(-1)!.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => b - a));
    expect(screen.getByTestId('audit-count')).toHaveTextContent(`${rows.length} of ${rows.length} entries`);
    expect(screen.getByTestId('audit-chain-total')).toHaveTextContent(`${h.sim.store.getState().audit.total} entries`);

    // Labels come from `common.auditType` by code; the simulator's English message is never shown.
    for (const seq of seqs) {
      const row = rows.find((candidate) => candidate.seq === seq)!;
      const event = screen.getByTestId(`audit-row-event-${seq}`);
      if (row.message !== event.props.children) expect(screen.queryByText(row.message)).toBeNull();
    }
  });

  it('lists AUTH_SUCCESS with method BIOMETRIC and the MA-29 session events', async () => {
    const h = renderAuditApp({ biometric: true, before: runSessionFlow });
    await settle();
    const rows = h.sim.store.getState().audit.rows;

    const signIn = rows.filter((row) => row.type === 'AUTH_SUCCESS').at(-1)!;
    expect(signIn.details).toMatchObject({ method: 'BIOMETRIC' });
    await search('sign-in succeeded biometric');
    expect(Math.max(...visibleSeqs())).toBe(signIn.seq);
    expect(screen.getByTestId(`audit-row-event-${signIn.seq}`)).toHaveTextContent('Sign-in succeeded');
    expect(screen.getByTestId(`audit-row-secondary-${signIn.seq}`)).toHaveTextContent('Biometric');
    expect(screen.getByTestId(`audit-row-actor-${signIn.seq}`)).toHaveTextContent('AKP Budi Santoso');

    const sessionId = h.sim.store.getState().lastSealedSessionId!;
    const expected: [string, string][] = [
      ['SESSION_CREATED', 'Session created'],
      ['PRECHECK_PASSED', 'Pre-check passed'],
      ['RECORDING_STARTED', 'Recording started'],
      ['RECORDING_STOPPED', 'Recording ended'],
      ['EVIDENCE_SEALED', 'Evidence sealed'],
    ];
    await search(sessionId);
    const shown = visibleSeqs();
    for (const [type, label] of expected) {
      const row = rows.find((candidate) => candidate.type === type && candidate.sessionId === sessionId);
      expect(row).toBeDefined();
      expect(shown).toContain(row!.seq);
      expect(screen.getByTestId(`audit-row-event-${row!.seq}`)).toHaveTextContent(label);
    }
  });

  it('filters by category chip, severity, operator and search; an empty result offers Clear filters', async () => {
    const h = renderAuditApp();
    await settle();
    const rows = h.sim.store.getState().audit.rows;

    fireEvent.press(screen.getByTestId('audit-category-AUTH'));
    await settle();
    const auth = visibleSeqs();
    expect(auth.length).toBeGreaterThan(0);
    for (const seq of auth) expect(screen.getByTestId(`audit-row-category-${seq}`).props.accessibilityLabel).toBe('Authentication');

    fireEvent.press(screen.getByTestId('audit-category-ALL'));
    await settle();
    pressMenuItem('audit-filter-menu', 'audit-operator-OPR-001');
    await settle();
    const mine = visibleSeqs();
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((seq) => rows.find((row) => row.seq === seq)!.actorId === 'OPR-001')).toBe(true);
    expect(screen.getByTestId('audit-filter-menu')).toHaveTextContent('1 filter on');

    pressMenuItem('audit-filter-menu', 'audit-operator-ALL');
    await settle();
    pressMenuItem('audit-filter-menu', 'audit-severity-CRITICAL');
    await settle();
    const critical = rows.filter((row) => row.severity === 'CRITICAL').map((row) => row.seq).reverse();
    if (critical.length > 0) expect([...visibleSeqs()].sort((a, b) => b - a)).toEqual(critical.slice(0, visibleSeqs().length));
    else expect(screen.getByTestId('audit-empty')).toBeTruthy();

    pressMenuItem('audit-filter-menu', 'audit-severity-ALL');
    await settle();
    await search('no-such-entry');
    expect(screen.getByTestId('audit-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('audit-clear-filters'));
    await settle();
    expect(Math.max(...visibleSeqs())).toBe(rows.at(-1)!.seq);
  });

  it('opens an entry in the sheet: actor, UTC+07:00 time, the record without the message, both hashes', async () => {
    const h = renderAuditApp();
    await settle();
    const row = h.sim.store.getState().audit.rows.at(-1)!;
    fireEvent.press(screen.getByTestId(`audit-row-${row.seq}`));
    await settle();
    fireEvent(screen.getByTestId('sheet-content-signal'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 600 } } });
    await settle();
    const detail = screen.getByTestId(`audit-detail-${row.seq}`);
    expect(within(detail).getByTestId('audit-detail-time')).toHaveTextContent(/UTC\+07:00$/);
    expect(within(detail).getByTestId('audit-detail-prev-hash')).toHaveTextContent(row.prevHash);
    expect(within(detail).getByTestId('audit-detail-hash')).toHaveTextContent(row.hash);
    const json = String(within(detail).getByTestId('audit-detail-json').props.children);
    expect(JSON.parse(json)).toMatchObject({ seq: row.seq, type: row.type });
    expect(json).not.toContain(row.message);
    expect(within(detail).getByTestId('audit-detail-chain').props.accessibilityLabel).toBe('Linked');

    fireEvent.press(screen.getByTestId('audit-sheet-close'));
    await settle();
    expect(screen.queryByTestId(`audit-detail-${row.seq}`)).toBeNull();
  });

  it('AUDIT_TAMPER: Discontinuity chip, Alert at the simulator break, broken row, Verify FAIL; clearing restores PASS', async () => {
    const h = renderAuditApp();
    await settle();
    act(() => h.sim.actions.inject(FaultKind.AUDIT_TAMPER));
    await settle();
    const breakSeq = selectAuditChainBreak(h.sim.store.getState())!.seq;

    expect(screen.getByTestId('audit-chain-chip-broken')).toBeTruthy();
    expect(screen.getByTestId('audit-tamper-alert')).toHaveTextContent(new RegExp(`entry #${breakSeq}\\.`));
    expect(screen.getByTestId(`audit-row-chain-${breakSeq}-BROKEN`)).toBeTruthy();
    expect(screen.getByTestId(`audit-row-glow-${breakSeq}`, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getAllByTestId(/^audit-row-chain-\d+-BROKEN$/)).toHaveLength(1);
    expect(screen.getByTestId(`audit-chain-link-${breakSeq}`).props.accessibilityLabel).toContain('Broken');

    fireEvent.press(screen.getByTestId('audit-verify'));
    await waitFor(() => expect(screen.getByTestId('audit-verify-FAIL')).toBeTruthy());
    const verify = h.sim.actions.verifyAuditChain();
    expect(verify.ok ? null : verify.seq).toBe(breakSeq);
    expect(screen.getByTestId('audit-verify-text')).toHaveTextContent(`Breaks at entry #${breakSeq}: Hash mismatch`);

    // "Show entry" opens the broken entry; its hash no longer matches its content.
    fireEvent.press(screen.getByTestId('audit-tamper-show'));
    await settle();
    fireEvent(screen.getByTestId('sheet-content-signal'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 600 } } });
    await settle();
    expect(within(screen.getByTestId(`audit-detail-${breakSeq}`)).getByTestId('audit-detail-broken')).toBeTruthy();
    fireEvent.press(screen.getByTestId('audit-sheet-close'));
    await settle();

    fireEvent.press(screen.getByTestId('audit-tamper-acknowledge'));
    await settle();
    expect(screen.getByTestId('audit-tamper-acknowledged')).toBeTruthy();
    expect(screen.queryByTestId('audit-tamper-acknowledge')).toBeNull();

    act(() => h.sim.actions.clearFault(FaultKind.AUDIT_TAMPER));
    await settle();
    expect(screen.getByTestId('audit-chain-chip-ok')).toBeTruthy();
    expect(screen.queryByTestId('audit-tamper-alert')).toBeNull();
    fireEvent.press(screen.getByTestId('audit-verify'));
    await waitFor(() => expect(screen.getByTestId('audit-verify-PASS')).toBeTruthy());
  });

  it('Live inserts new entries with the fresh highlight; Live off holds them back until Resume', async () => {
    const h = renderAuditApp();
    await settle();
    act(() => h.sim.actions.deviceCommand('MIC-01', 'TEST_SIGNAL'));
    await settle();
    const first = h.sim.store.getState().audit.rows.at(-1)!;
    expect(first.type).toBe('DEVICE_COMMAND');
    expect(Math.max(...visibleSeqs())).toBe(first.seq);
    expect(screen.getByTestId(`audit-row-fresh-${first.id}`)).toBeTruthy();

    fireEvent(screen.getByTestId('audit-live'), 'selectedChange', false);
    await settle();
    act(() => h.sim.actions.deviceCommand('MIC-02', 'TEST_SIGNAL'));
    await settle();
    expect(Math.max(...visibleSeqs())).toBe(first.seq);
    expect(screen.getByTestId('audit-count')).toHaveTextContent(/^\d+ of \d+ entries$/);
    expect(screen.getByTestId('audit-resume')).toHaveTextContent(/^1 new entry · Resume live$/);

    fireEvent.press(screen.getByTestId('audit-resume'));
    await settle();
    expect(Math.max(...visibleSeqs())).toBe(first.seq + 1);
    expect(screen.queryByTestId('audit-resume')).toBeNull();
  });

  it('tablet: list | detail panes; a row opens in the pane, no sheet', async () => {
    const h = renderAuditApp({ window: 'tabletLandscape' });
    await settle();
    expect(screen.getByTestId('audit-panes')).toBeTruthy();
    expect(screen.getByTestId('audit-detail-empty')).toBeTruthy();
    const row = h.sim.store.getState().audit.rows.at(-2)!;
    fireEvent.press(screen.getByTestId(`audit-row-${row.seq}`));
    await settle();
    const pane = screen.getByTestId('audit-detail-pane');
    expect(within(pane).getByTestId('audit-detail-title')).toHaveTextContent(i18n.t(`common.auditType.${row.type}`));
    expect(within(pane).getByTestId(`audit-detail-${row.seq}`)).toBeTruthy();
    expect(screen.getByTestId(`audit-row-selected-${row.seq}`, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('audit-sheet')).toBeNull();
  });
});
