/**
 * T-M15 (04_mobile_specs §10.1; MA-12): the Evidence list's filters, search and selection, with the
 * detail pane in a mocked expanded window (tablet landscape), plus the single-pane push on a phone.
 * Real route files, real simulator (13 dataset items, D61), real providers.
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { EvidenceStatus } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
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

  it('tablet landscape: a filter keeps the selection in the detail pane', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const id = h.idOf('0001');
    fireEvent.press(screen.getByTestId(`evidence-row-${id}`));
    await settle();
    fireEvent.press(screen.getByTestId('evidence-filter-RECORDED'));
    await settle();
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
