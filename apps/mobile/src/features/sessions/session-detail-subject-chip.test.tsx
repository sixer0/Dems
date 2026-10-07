// Post-review fix FXR-M, findings W93-8 (RF2-1) and W93-9 (O-CF2-B-2) of code review W93 (decision D243).
//
// W93-8: on the tablet's Sessions detail pane two-word subject names broke INSIDE a word next to the subject
// chip ("Retno W / ulandari", "Siti Rahm / awati", test/11_final_check_cf2.md:133). The name had
// `flexShrink: 1` in a row without wrapping, so Yoga could shrink it below its longest word. Now the row wraps
// and the name is never shrunk (`flexShrink: 0`, capped at the row with `maxWidth: '100%'`): the chip moves
// under a long name, and a name longer than the row breaks between its words. Jest has no layout engine: the
// test checks the styles those two rules rest on, from the rendered detail.
// W93-9: the 'Sealed' chip over the hero photo read faded: its soft tone is see-through over a bright still.
// The chip now sits on an opaque backplate (the Evidence hero's recipe, black at 0.7).
// Device confirmation (the name wraps between words; the chip reads clearly): W94-W96.
//
// Import order: the feature setup, then the router harness (see their headers).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import { SessionOutcome } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderSessionsApp, settle } from './testing/sessions-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

const flat = (testID: string): ViewStyle =>
  (StyleSheet.flatten(screen.getAllByTestId(testID).filter((n) => typeof (n.type as unknown) === 'string')[0]!.props.style) ?? {}) as ViewStyle;

/** The alpha of a `#rrggbbaa` colour (1 for `#rrggbb`). */
const alphaOf = (hex: string): number => (hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1);

async function openIncompleteDetail() {
  const h = renderSessionsApp();
  await settle();
  const incomplete = h.history().find((entry) => entry.outcome === SessionOutcome.INCOMPLETE)!;
  fireEvent.press(screen.getByTestId(`session-row-${incomplete.id}`));
  await settle();
  expect(screen.getByTestId('screen-session-detail')).toBeTruthy();
  return incomplete;
}

describe('W93-8: the subject name wraps between words, never inside one', () => {
  it('the subject row wraps, and the name is not shrinkable below its own width (capped at the row)', async () => {
    const entry = await openIncompleteDetail();
    expect(screen.getByTestId('session-detail-subject-name')).toHaveTextContent(entry.subjectName);
    expect(flat('session-detail-subject-row')).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(flat('session-detail-subject-name')).toMatchObject({ flexShrink: 0, maxWidth: '100%' });
  });
});

describe('W93-9: the status chip over the hero photo has an opaque backplate', () => {
  it('the chip sits on a plate of at least 0.7 alpha, with a full corner radius', async () => {
    await openIncompleteDetail();
    const plate = flat('session-detail-status-plate');
    expect(typeof plate.backgroundColor).toBe('string');
    expect(alphaOf(String(plate.backgroundColor))).toBeGreaterThanOrEqual(0.69);
    expect(plate.position).toBe('absolute');
    expect(Number(plate.borderRadius)).toBeGreaterThan(100);
    expect(screen.getByTestId('session-detail-status')).toBeTruthy();
  });
});
