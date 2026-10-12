/**
 * T-M15 (04_mobile_specs §10.1; MA-12): the Evidence list's filters, search and selection, with the
 * detail pane in a mocked expanded window (tablet landscape), plus the single-pane push on a phone.
 * Real route files, real simulator (13 dataset items, D61), real providers.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { EvidenceStatus, verificationOfRecordFailed } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { FlashList } from '@shopify/flash-list';
import { renderEvidenceApp, settle } from './testing/evidence-harness';

function visibleRowIds(): string[] {
  return screen
    .queryAllByTestId(/^evidence-row-EV-/)
    .map((node) => String(node.props.testID).replace('evidence-row-', ''))
    .filter((id, index, all) => all.indexOf(id) === index);
}

describe('T-M15 Evidence list', () => {
  beforeEach(() => resetMissingKeys());
  // MA-21: every string the list renders comes from an i18n key.
  afterEach(() => expect(getMissingKeys()).toEqual([]));

  // Fix wave J, JM-03 (reproduced on the tablet, normal launch: EV-20261012-0067, sealed on the tablet, was in the
  // view tree ONE ROW ABOVE the viewport of the list; the list showed -0066 first until it was pulled down).
  // jsdom has no scroll position, so the rule held here is the cause's: the list does not hold the visible
  // content in place when a row is inserted before it.
  it('JM-03 - the list does not keep its place when a newer item is inserted at the top (the new item is the first row to see)', async () => {
    renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    const list = screen.UNSAFE_getByType(FlashList);
    expect(list.props.testID).toBe('evidence-rows');
    expect(list.props.maintainVisibleContentPosition).toEqual({ disabled: true });
  });

  // Fix wave J, JT-04 (truth rule 3b; contract_wave_j.md J-S 8): the tampered item, with a FAIL of record on the Core,
  // read plain "Sealed" in the list. The verification of record is the status the row states.
  it('JT-04 - an item whose verification of record FAILED reads "Sealed · verification FAILED" in its row (chip and spoken label); the others keep "Sealed"', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    const sealed = h.sim.store.getState().evidence.filter((item) => item.status === 'SEALED');
    const [failed, control] = [sealed[0]!, sealed[1]!];
    act(() => {
      h.sim.store.setState((state) => ({
        evidence: state.evidence.map((item) => (item.id === failed.id ? { ...item, verification: { status: 'FAIL' as const, at: item.sealedAt } } : item)),
      }));
    });
    await settle();
    expect(verificationOfRecordFailed(h.sim.store.getState().evidence.find((item) => item.id === failed.id))).toBe(true);
    expect(screen.getByTestId(`evidence-row-status-${failed.id}`)).toHaveTextContent('Sealed · verification FAILED');
    expect(String(screen.getByTestId(`evidence-row-${failed.id}`).props.accessibilityLabel)).toContain('Sealed · verification FAILED');
    expect(screen.getByTestId(`evidence-row-status-${control.id}`)).toHaveTextContent(/^Sealed$/);
  });

  it('lists every dataset item newest first, with violet Sealed chips', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    expect(screen.getByTestId('screen-evidence')).toBeTruthy();
    const items = h.sim.store.getState().evidence;
    const ids = visibleRowIds();
    expect(ids).toHaveLength(items.length);
    const newestFirst = items.slice().sort((a, b) => b.recordedAt - a.recordedAt).map((item) => item.id);
    expect(ids).toEqual(newestFirst);
    const sealed = items.find((item) => item.status === EvidenceStatus.SEALED)!;
    const chip = screen.getByTestId(`evidence-row-status-${sealed.id}`);
    expect(chip.props.accessibilityLabel).toBe('Sealed');
    expect(screen.getByTestId('evidence-count')).toHaveTextContent(`${items.length} items`);
  });

  it('filters by status chip (Sealed, Exported, Recorded, Under Review, then All)', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    const items = h.sim.store.getState().evidence;
    for (const status of [EvidenceStatus.SEALED, EvidenceStatus.EXPORTED, EvidenceStatus.RECORDED, EvidenceStatus.UNDER_REVIEW]) {
      fireEvent.press(screen.getByTestId(`evidence-filter-${status}`));
      await settle();
      const expected = items.filter((item) => item.status === status).map((item) => item.id).sort();
      expect(visibleRowIds().sort()).toEqual(expected);
      expect(expected.length).toBeGreaterThan(0);
    }
    fireEvent.press(screen.getByTestId('evidence-filter-ALL'));
    await settle();
    expect(visibleRowIds()).toHaveLength(items.length);
  });

  it('searches by subject, case number and session ID; an empty result offers "Clear filters"', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    const items = h.sim.store.getState().evidence;
    const target = items.find((item) => item.id.endsWith('-0005'))!;

    fireEvent.changeText(screen.getByTestId('evidence-search'), target.subjectName.toUpperCase());
    await settle();
    expect(visibleRowIds()).toEqual(items.filter((item) => item.subjectName === target.subjectName).map((item) => item.id));

    // Follow-up interviews share their case number with the first interview (D61).
    fireEvent.changeText(screen.getByTestId('evidence-search'), target.caseNumber);
    await settle();
    const sameCase = items.filter((item) => item.caseNumber === target.caseNumber);
    expect(visibleRowIds().sort()).toEqual(sameCase.map((item) => item.id).sort());
    expect(sameCase.map((item) => item.id)).toContain(target.id);

    fireEvent.changeText(screen.getByTestId('evidence-search'), target.sessionId.toLowerCase());
    await settle();
    expect(visibleRowIds()).toEqual([target.id]);

    fireEvent.changeText(screen.getByTestId('evidence-search'), 'no-such-evidence');
    await settle();
    expect(visibleRowIds()).toEqual([]);
    expect(screen.getByTestId('evidence-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('evidence-clear-filters'));
    await settle();
    expect(visibleRowIds()).toHaveLength(items.length);
  });

  it('tablet landscape: pane-list and pane-detail side by side; selecting a row fills the detail pane', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    expect(screen.getByTestId('pane-list')).toBeTruthy();
    expect(screen.getByTestId('pane-detail')).toBeTruthy();
    expect(screen.getByTestId('evidence-detail-empty')).toBeTruthy();

    const id = h.idOf('0004');
    fireEvent.press(screen.getByTestId(`evidence-row-${id}`));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: id });
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.getByTestId('evidence-detail-pane')).toBeTruthy();
    expect(pane.getByTestId('evidence-detail-id')).toHaveTextContent(id);
    // The list stays on screen (no push) and the selected row carries glow e2.
    expect(screen.getByTestId('screen-evidence')).toBeTruthy();
    expect(screen.queryByTestId('screen-evidence-detail')).toBeNull();
    expect(screen.getByTestId(`evidence-row-glow-${id}`, { includeHiddenElements: true })).toBeTruthy();
  });

  // Fix wave M (G89d-03): in the narrow list pane the duration ran on under the row's menu button ("00:00").
  it('the row\'s chips wrap and the duration is one unshrinkable line of its own text, so it is never cut under the menu button', async () => {
    const { StyleSheet } = jest.requireActual<typeof import('react-native')>('react-native');
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const id = h.idOf('0004');
    const duration = screen.getByTestId(`evidence-row-duration-${id}`);
    expect(String(duration.props.children)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(duration.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(duration.props.style)).toMatchObject({ flexShrink: 0 });
    const chips = screen.getByTestId(`evidence-row-chips-${id}`);
    expect(StyleSheet.flatten(chips.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(within(chips).getByTestId(`evidence-row-duration-${id}`)).toBeTruthy();
    // The menu button is not in the chips row: it belongs to the trailing column.
    expect(within(chips).queryByTestId(`evidence-row-menu-${id}`)).toBeNull();
  });

  // Fix wave J round two (JT-20) REPLACES "a filter keeps the selection in the detail pane": the pane kept an item
  // the filter had removed from the list. It now follows the list.
  it('JT-20 tablet landscape: a filter that removes the selected item empties the pane and says so; "Clear filters" brings it back', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const id = h.idOf('0001');
    fireEvent.press(screen.getByTestId(`evidence-row-${id}`));
    await settle();
    expect(within(screen.getByTestId('pane-detail')).getByTestId('evidence-detail-id')).toHaveTextContent(id);
    fireEvent.press(screen.getByTestId('evidence-filter-RECORDED'));
    await settle();
    expect(screen.queryByTestId(`evidence-row-${id}`)).toBeNull();
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.queryByTestId('evidence-detail-id')).toBeNull();
    expect(pane.getByTestId('evidence-detail-filtered-out')).toHaveTextContent(new RegExp(`${id} is not in this list`));
    fireEvent.press(pane.getByTestId('evidence-detail-filtered-out-clear'));
    await settle();
    expect(within(screen.getByTestId('pane-detail')).getByTestId('evidence-detail-id')).toHaveTextContent(id);
  });

  it('JT-20 CONTROL: a filter that still holds the selected item keeps it in the pane', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const id = h.idOf('0001');
    fireEvent.press(screen.getByTestId(`evidence-row-${id}`));
    await settle();
    fireEvent.press(screen.getByTestId('evidence-filter-SEALED'));
    await settle();
    expect(screen.getByTestId(`evidence-row-${id}`)).toBeTruthy();
    expect(within(screen.getByTestId('pane-detail')).getByTestId('evidence-detail-id')).toHaveTextContent(id);
  });

  it('tablet landscape: a deep link to /evidence/<id> hands over to the detail pane', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const id = h.idOf('0007');
    h.navigate(`/evidence/${id}`);
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: id });
    expect(within(screen.getByTestId('pane-detail')).getByTestId('evidence-detail-id')).toHaveTextContent(id);
  });

  it('phone portrait: selecting a row pushes the detail route (MB 6), Back returns to the list', async () => {
    const h = renderEvidenceApp({ window: 'phonePortrait' });
    await settle();
    expect(screen.queryByTestId('pane-detail')).toBeNull();
    const id = h.idOf('0002');
    fireEvent.press(screen.getByTestId(`evidence-row-${id}`));
    await settle();
    expect(h.app.getPathname()).toBe(`/evidence/${id}`);
    expect(screen.getByTestId('screen-evidence-detail')).toBeTruthy();
    expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
    fireEvent.press(screen.getByTestId('evidence-detail-back'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(h.app.getPathname()).toBe('/evidence');
  });
});
