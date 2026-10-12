/**
 * Sessions hub (04_mobile_specs §4.9; blueprint row 82): the list of `sessionHistory` including the
 * INCOMPLETE session, the filters and search, the active-session card while recording, the row
 * hand-offs (monitor, summary, evidence, detail), the tablet panes and the simulator-clock
 * pull-to-refresh. Real route files, real simulator (D61 dataset), real providers.
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { SessionOutcome, SubjectTypeLabel, startOfWibDay } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { REFRESH_MS } from './sessions-screen';
import { renderSessionsApp, settle } from './testing/sessions-harness';

function visibleRowIds(): string[] {
  return screen
    .queryAllByTestId(/^session-row-S/)
    .map((node) => String(node.props.testID).replace('session-row-', ''))
    .filter((id, index, all) => all.indexOf(id) === index);
}

describe('Sessions hub', () => {
  beforeEach(() => resetMissingKeys());
  // MA-21: every string the hub renders comes from an i18n key.
  afterEach(() => expect(getMissingKeys()).toEqual([]));

  it('lists the whole sessionHistory newest first, including the INCOMPLETE session', async () => {
    const h = renderSessionsApp();
    await settle();
    expect(screen.getByTestId('screen-sessions')).toBeTruthy();
    const history = h.history();
    const incomplete = history.filter((entry) => entry.outcome === SessionOutcome.INCOMPLETE);
    expect(incomplete).toHaveLength(1);
    expect(visibleRowIds()).toEqual(history.map((entry) => entry.id));

    const incompleteId = incomplete[0]!.id;
    expect(screen.getByTestId(`session-row-status-${incompleteId}`).props.accessibilityLabel).toBe('Incomplete');
    const sealed = history.find((entry) => entry.outcome === SessionOutcome.SEALED)!;
    expect(screen.getByTestId(`session-row-status-${sealed.id}`).props.accessibilityLabel).toBe('Sealed');
    // Subject chips take the simulator code and show the shared Indonesian term (step 78, MA-21).
    expect(screen.getByTestId(`session-row-subject-${incompleteId}`).props.accessibilityLabel).toBe(SubjectTypeLabel[incomplete[0]!.subjectType]);
    expect(screen.getByTestId('sessions-count')).toHaveTextContent(`${history.length} sessions`);
    expect(screen.queryByTestId('sessions-active')).toBeNull();
    expect(screen.getByTestId('sessions-start')).toBeTruthy();
  });

  it('filters by Sealed, Incomplete and Today, then All', async () => {
    const h = renderSessionsApp();
    await settle();
    const history = h.history();
    fireEvent.press(screen.getByTestId('sessions-filter-SEALED'));
    await settle();
    expect(visibleRowIds().sort()).toEqual(history.filter((e) => e.outcome === SessionOutcome.SEALED).map((e) => e.id).sort());

    fireEvent.press(screen.getByTestId('sessions-filter-INCOMPLETE'));
    await settle();
    expect(visibleRowIds().sort()).toEqual(history.filter((e) => e.outcome === SessionOutcome.INCOMPLETE).map((e) => e.id).sort());

    // D61: the follow-up interviews sealed today (seven in the dataset); the earlier days hold the rest.
    const dayStart = startOfWibDay(h.sim.store.getState().clock.now);
    const today = history.filter((e) => startOfWibDay(e.endedAt) === dayStart).map((e) => e.id);
    expect(today.length).toBeGreaterThan(0);
    expect(today.length).toBeLessThan(history.length);
    fireEvent.press(screen.getByTestId('sessions-filter-TODAY'));
    await settle();
    expect(visibleRowIds().sort()).toEqual(today.sort());

    fireEvent.press(screen.getByTestId('sessions-filter-ALL'));
    await settle();
    expect(visibleRowIds()).toHaveLength(history.length);
  });

  it('searches by subject, case number, session ID and evidence ID; an empty result offers "Clear filters"', async () => {
    const h = renderSessionsApp();
    await settle();
    const history = h.history();
    const target = history.find((entry) => entry.outcome === SessionOutcome.INCOMPLETE)!;

    // Recycled FlashList cells may sit in any tree order after a data change, so sets are compared
    // here; the newest-first order is asserted on the first render and in sessions-model.test.ts.
    fireEvent.changeText(screen.getByTestId('sessions-search'), target.subjectName.toUpperCase());
    await settle();
    expect(visibleRowIds().sort()).toEqual(history.filter((e) => e.subjectName === target.subjectName).map((e) => e.id).sort());

    // Follow-up interviews share their case number with the first interview (D61).
    fireEvent.changeText(screen.getByTestId('sessions-search'), target.caseNumber);
    await settle();
    const sameCase = history.filter((e) => e.caseNumber === target.caseNumber).map((e) => e.id);
    expect(sameCase.length).toBeGreaterThan(1);
    expect(visibleRowIds().sort()).toEqual(sameCase.sort());

    fireEvent.changeText(screen.getByTestId('sessions-search'), target.id.toLowerCase());
    await settle();
    expect(visibleRowIds()).toEqual([target.id]);

    fireEvent.changeText(screen.getByTestId('sessions-search'), target.evidenceId!);
    await settle();
    expect(visibleRowIds()).toEqual([target.id]);

    fireEvent.changeText(screen.getByTestId('sessions-search'), 'no-such-session');
    await settle();
    expect(visibleRowIds()).toEqual([]);
    expect(screen.getByTestId('sessions-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sessions-clear-filters'));
    await settle();
    expect(visibleRowIds()).toHaveLength(history.length);
  });

  it('while recording: the active card with the sim-clock timer, the RECORDING row first, Start disabled, a tap opens the monitor', async () => {
    const h = renderSessionsApp({ prepare: (test) => test.sim.actions.loadScenario('recording') });
    await settle();
    const session = h.sim.store.getState().session!;
    expect(screen.getByTestId('sessions-active')).toBeTruthy();
    expect(screen.getByTestId('sessions-active-id')).toHaveTextContent(session.id);
    const before = screen.getByTestId('sessions-active-timer').props.accessibilityLabel as string;
    act(() => h.advance(3_000));
    await settle();
    expect(screen.getByTestId('sessions-active-timer').props.accessibilityLabel).not.toBe(before);

    expect(visibleRowIds()[0]).toBe(session.id);
    expect(screen.getByTestId(`session-row-status-${session.id}`).props.accessibilityLabel).toBe('Recording');
    expect(screen.getByTestId(`session-row-live-${session.id}`)).toBeTruthy();
    expect(screen.getByTestId('sessions-start').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('sessions-start-busy')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`session-row-${session.id}`));
    await settle();
    expect(h.app.getPathname()).toBe('/session/live');
  });

  it('the active card returns to the monitor; an interrupted session opens recovery', async () => {
    const h = renderSessionsApp({ prepare: (test) => test.sim.actions.loadScenario('recording') });
    await settle();
    fireEvent.press(screen.getByTestId('sessions-active-action'));
    await settle();
    expect(h.app.getPathname()).toBe('/session/live');

    h.navigate('/sessions');
    await settle();
    act(() => h.sim.actions.inject('POWER_FAIL'));
    await settle();
    const session = h.sim.store.getState().session!;
    expect(session.state).toBe('FAULT');
    expect(screen.getByTestId(`session-row-status-${session.id}`).props.accessibilityLabel).toBe('Fault');
    expect(screen.getByTestId('sessions-active-fault')).toHaveTextContent(/Power failure/);
    fireEvent.press(screen.getByTestId(`session-row-${session.id}`));
    await settle();
    expect(h.app.getPathname()).toBe('/session/recovery');
  });

  it('a just-sealed session with an unacknowledged summary opens the summary', async () => {
    const h = renderSessionsApp({ prepare: (test) => test.sim.actions.loadScenario('finalizing') });
    await settle();
    const id = h.sim.store.getState().session!.id;
    expect(screen.getByTestId(`session-row-status-${id}`).props.accessibilityLabel).toBe('Finalizing');
    act(() => h.advance(12_000));
    await settle();
    expect(h.sim.store.getState().session!.state).toBe('SEALED');
    // Sealed once: listed from the history only, with the "Summary pending" chip.
    expect(visibleRowIds().filter((rowId) => rowId === id)).toHaveLength(1);
    expect(screen.getByTestId(`session-row-status-${id}`).props.accessibilityLabel).toBe('Sealed');
    expect(screen.getByTestId(`session-row-pending-${id}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`session-row-${id}`));
    await settle();
    expect(h.app.getPathname()).toBe(`/session/summary/${id}`);
  });

  it('phone: a sealed row opens its evidence; an incomplete row opens the session detail, Back returns', async () => {
    const h = renderSessionsApp();
    await settle();
    const history = h.history();
    const sealed = history.find((entry) => entry.outcome === SessionOutcome.SEALED && entry.evidenceId)!;
    fireEvent.press(screen.getByTestId(`session-row-${sealed.id}`));
    await settle();
    expect(h.app.getPathname()).toBe(`/evidence/${sealed.evidenceId}`);

    h.navigate('/sessions');
    await settle();
    const incomplete = history.find((entry) => entry.outcome === SessionOutcome.INCOMPLETE)!;
    fireEvent.press(screen.getByTestId(`session-row-${incomplete.id}`));
    await settle();
    expect(h.app.getPathname()).toBe(`/sessions/${incomplete.id}`);
    expect(screen.getByTestId('screen-session-detail')).toBeTruthy();
    expect(screen.getByTestId('session-detail-id')).toHaveTextContent(incomplete.id);
    expect(screen.getByTestId('session-detail-status').props.accessibilityLabel).toBe('Incomplete');
    expect(screen.getByTestId('session-detail-incomplete')).toBeTruthy();
    // Round two (JA2-29 / N-08): operator copy names no specification id.
    expect(screen.getByTestId('session-detail-incomplete')).toHaveTextContent(/It will never be sealed\./);
    expect(screen.getByTestId('session-detail-incomplete')).not.toHaveTextContent(/SYS-008|§/);
    fireEvent.press(screen.getByTestId('session-detail-back'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(h.app.getPathname()).toBe('/sessions');

    // The INCOMPLETE session's RECORDED item (never sealed, SYS-008) opens from the detail.
    fireEvent.press(screen.getByTestId(`session-row-${incomplete.id}`));
    await settle();
    fireEvent.press(screen.getByTestId('session-detail-action-evidence'));
    await settle();
    expect(h.app.getPathname()).toBe(`/evidence/${incomplete.evidenceId}`);
  });

  it('tablet landscape: filters | list | detail; a sealed row fills the detail pane and "View in Evidence" opens the Evidence pane', async () => {
    const h = renderSessionsApp({ window: 'tabletLandscape' });
    await settle();
    expect(screen.getByTestId('pane-filters')).toBeTruthy();
    expect(screen.getByTestId('pane-list')).toBeTruthy();
    expect(screen.getByTestId('pane-detail')).toBeTruthy();
    expect(screen.getByTestId('session-detail-empty')).toBeTruthy();
    const history = h.history();
    // The expanded filter pane shows the counts.
    expect(screen.getByTestId('sessions-filter-INCOMPLETE')).toHaveTextContent('Incomplete · 1');

    const sealed = history.find((entry) => entry.outcome === SessionOutcome.SEALED && entry.evidenceId)!;
    fireEvent.press(screen.getByTestId(`session-row-${sealed.id}`));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: sealed.id });
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.getByTestId('session-detail-pane')).toBeTruthy();
    expect(pane.getByTestId('session-detail-id')).toHaveTextContent(sealed.id);
    expect(screen.getByTestId(`session-row-glow-${sealed.id}`, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('screen-session-detail')).toBeNull();

    fireEvent.press(pane.getByTestId('session-detail-action-evidence'));
    await settle();
    expect(h.app.getPathname()).toBe('/evidence');
    expect(h.app.getSearchParams()).toMatchObject({ selected: sealed.evidenceId });
  });

  // Fix wave J round two (JT-20): the detail pane kept a session the filter had removed from the list.
  it('JT-20 tablet landscape: a filter that removes the selected session empties the pane and says so; "Clear filters" brings it back', async () => {
    const h = renderSessionsApp({ window: 'tabletLandscape' });
    await settle();
    const sealed = h.history().find((entry) => entry.outcome === SessionOutcome.SEALED && entry.evidenceId)!;
    fireEvent.press(screen.getByTestId(`session-row-${sealed.id}`));
    await settle();
    fireEvent.press(screen.getByTestId('sessions-filter-INCOMPLETE'));
    await settle();
    expect(screen.queryByTestId(`session-row-${sealed.id}`)).toBeNull();
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.queryByTestId('session-detail-id')).toBeNull();
    expect(pane.getByTestId('session-detail-filtered-out')).toHaveTextContent(new RegExp(`${sealed.id} is not in this list`));
    fireEvent.press(pane.getByTestId('session-detail-filtered-out-clear'));
    await settle();
    expect(within(screen.getByTestId('pane-detail')).getByTestId('session-detail-id')).toHaveTextContent(sealed.id);
  });

  it('tablet portrait: list 360 dp | detail; a deep link to /sessions/<id> hands over to the pane', async () => {
    const h = renderSessionsApp({ window: 'tabletPortrait' });
    await settle();
    expect(screen.queryByTestId('pane-filters')).toBeNull();
    const incomplete = h.history().find((entry) => entry.outcome === SessionOutcome.INCOMPLETE)!;
    h.navigate(`/sessions/${incomplete.id}`);
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: incomplete.id });
    expect(within(screen.getByTestId('pane-detail')).getByTestId('session-detail-id')).toHaveTextContent(incomplete.id);
  });

  it('pull-to-refresh runs on the simulator clock and stamps "Updated"', async () => {
    const h = renderSessionsApp();
    await settle();
    const control = screen.UNSAFE_getByProps({ testID: 'sessions-refresh' });
    act(() => control.props.onRefresh());
    await settle();
    expect(screen.UNSAFE_getByProps({ testID: 'sessions-refresh' }).props.refreshing).toBe(true);
    act(() => h.advance(REFRESH_MS - 100));
    await settle();
    expect(screen.UNSAFE_getByProps({ testID: 'sessions-refresh' }).props.refreshing).toBe(true);
    act(() => h.advance(200));
    await settle();
    expect(screen.UNSAFE_getByProps({ testID: 'sessions-refresh' }).props.refreshing).toBe(false);
    expect(screen.getByTestId('sessions-count')).toHaveTextContent(/Updated \d\d:\d\d:\d\d/);
    expect(visibleRowIds()).toHaveLength(h.history().length);
  });
});
