// Closing-fix row CF-M2, defect R-T-1 (decision D212): in the Evidence detail's More menu the
// disabled Archive item showed only its reason, "Archiving needs the Supervisor role", and no title
// (re-test `P07e_evidence_more_menu.png`; the title area flat at luminance 37, no glyph).
//
// Cause: the kit's `Menu.Item` lays its children out in a row and `Menu.ItemTitle` has `flex: 1`
// (zero basis), so a `Menu.ItemDescription` placed beside it took its full text width and squeezed the
// title to nothing (`evidence-detail.tsx:338-346` before the fix; the row menu's Export and Archive
// items had the same pair). The fix stacks title and description in one `flex: 1` column, the kit's
// documented pattern (`MenuItemText`).
//
// Jest has no layout engine, so this proves the structure that decides the layout: title and reason
// share one column of their own (flex 1, not a row) inside the item, and the title text is there.
// The device re-test confirms the pixels.
//
// Import order: the test setup first, then the router harness (see their headers).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { evidenceEn } from './i18n';
import { renderEvidenceApp, settle, type DemoUsername } from './testing/evidence-harness';
import { layoutAncestors, stubMeasure } from './testing/kit-helpers';

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

const HIDDEN = { includeHiddenElements: true } as const;

function openMenu(triggerID: string, itemID: string): ReactTestInstance {
  stubMeasure(triggerID);
  fireEvent.press(screen.getByTestId(triggerID));
  layoutAncestors(itemID);
  return screen.getByTestId(itemID, HIDDEN);
}

/** The nearest host element holding both nodes. */
function commonHost(a: ReactTestInstance, b: ReactTestInstance): ReactTestInstance | null {
  const chain = new Set<ReactTestInstance>();
  for (let node: ReactTestInstance | null = a; node; node = node.parent) chain.add(node);
  let node: ReactTestInstance | null = b;
  while (node && !chain.has(node)) node = node.parent;
  while (node && typeof node.type !== 'string') node = node.parent;
  return node;
}

/** Title and reason stacked in a column of their own (flex 1), inside the item. */
function expectStacked(item: ReactTestInstance, title: string, reason: string): void {
  const titleNode = within(item).getByText(title, HIDDEN);
  const reasonNode = within(item).getByText(reason, HIDDEN);
  const host = commonHost(titleNode, reasonNode);
  expect(host).not.toBeNull();
  const style = (StyleSheet.flatten(host!.props.style) ?? {}) as ViewStyle;
  expect(style.flexDirection ?? 'column').toBe('column');
  expect(style.flex).toBe(1);
  // The column is inside the item, below the item's own row.
  let inside = false;
  for (let node: ReactTestInstance | null = host; node; node = node.parent) if (node === item) inside = true;
  expect(inside).toBe(true);
  expect(host).not.toBe(item);
}

async function openDetail(user: DemoUsername, suffix: string) {
  const h = renderEvidenceApp({ user });
  await settle();
  const id = h.idOf(suffix);
  h.navigate(`/evidence/${id}`);
  await settle();
  expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
  return { h, id };
}

describe('R-T-1: a disabled menu item keeps its visible title above its reason', () => {
  it('Evidence detail > More (INVESTIGATOR): "Archive" over "Archiving needs the Supervisor role"', async () => {
    const { id } = await openDetail('budi.santoso', '0001');
    const item = openMenu('evidence-action-more', 'evidence-more-archive');
    expectStacked(item, evidenceEn.actions.archive, evidenceEn.actions.archiveDisabled);
    // Still disabled: a press opens no dialog.
    fireEvent.press(item);
    await settle();
    expect(screen.queryByText(evidenceEn.actions.archiveTitle.replace('{{id}}', id), HIDDEN)).toBeNull();
    // Download manifest is unchanged: a title only.
    const manifest = screen.getByTestId('evidence-more-manifest', HIDDEN);
    expect(within(manifest).getByText(evidenceEn.actions.downloadManifest, HIDDEN)).toBeTruthy();
  });

  it('Evidence list row menu (INVESTIGATOR): the disabled Archive item, same structure', async () => {
    const h = renderEvidenceApp({ user: 'budi.santoso' });
    await settle();
    const id = h.idOf('0001');
    const item = openMenu(`evidence-row-menu-${id}`, `evidence-row-archive-${id}`);
    expectStacked(item, evidenceEn.actions.archive, evidenceEn.actions.archiveDisabled);
  });

  it('SUPERVISOR: Archive is enabled, shows its title and no reason, and still opens the dialog', async () => {
    const { id } = await openDetail('andi.pratama', '0001');
    const item = openMenu('evidence-action-more', 'evidence-more-archive');
    expect(within(item).getByText(evidenceEn.actions.archive, HIDDEN)).toBeTruthy();
    expect(within(item).queryByText(evidenceEn.actions.archiveDisabled, HIDDEN)).toBeNull();
    fireEvent.press(item);
    await settle();
    expect(screen.getByText(evidenceEn.actions.archiveTitle.replace('{{id}}', id), HIDDEN)).toBeTruthy();
  });
});
