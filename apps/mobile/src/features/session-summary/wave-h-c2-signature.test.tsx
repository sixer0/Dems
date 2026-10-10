// Wave H, driver C2 (mobile) - finding 3 of the common brief on the Session Summary (G81-02 /
// G89-03, MAJOR): the chip "SIMULATED" beside Signature is drawn only for a SIMULATED signature. A
// REAL Ed25519 signature (`signature.simulated === false`) names its algorithm and Core key; the
// only qualifier is the development-key line, from the item's `signature.developmentKey`.
import '@/features/session-finalizing/testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { EvidenceItem } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderFlowApp, settle } from '@/features/session-finalizing/testing/flow-harness';
import { resetStampedForTests } from './stamp-once';

const CORE_KEY = 'CORE-KEY-EVSIGN-01';

beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
});
afterEach(() => {
  resetMotionStateForTests();
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

/** The Summary of the session just sealed, with the signature of its item as a Core states it. */
async function summaryWith(window: 'phonePortrait' | 'tabletLandscape', signature: Record<string, unknown> | null) {
  const h = renderFlowApp({ scenario: 'sealed', window });
  await settle();
  if (signature !== null) {
    act(() => {
      const state = h.sim.store.getState();
      h.sim.store.setState({ evidence: state.evidence.map((item) => (item.sessionId === h.sessionId ? ({ ...item, integritySource: 'REAL', signature }) as unknown as EvidenceItem : item)) });
    });
    await settle();
  }
  return h;
}
const real = (more: Record<string, unknown> = {}) => ({ value: 'c'.repeat(128), keyId: CORE_KEY, algorithm: 'Ed25519', simulated: false, ...more });

describe('G81-02 / G89-03 - the signature row of the Session Summary', () => {
  it.each(['tabletLandscape', 'phonePortrait'] as const)('%s: a REAL signature has NO "SIMULATED" chip; the row names "Ed25519, Core key ..." and the development-key line', async (window) => {
    await summaryWith(window, real({ developmentKey: true }));
    const row = screen.getByTestId('summary-hash-signature');
    expect(screen.queryByTestId('summary-signature-simulated')).toBeNull();
    expect(within(row).queryByText('SIMULATED')).toBeNull();
    expect(String(row.props.accessibilityLabel)).not.toMatch(/simulated/i);
    expect(screen.getByTestId('summary-signature-real')).toHaveTextContent(`Ed25519, Core key ${CORE_KEY}`);
    expect(screen.getByTestId('summary-signature-key-class-DEVELOPMENT')).toHaveTextContent('Signed with a DEVELOPMENT key — not a production signature');
    // The full value: no "simulated signature" note under it.
    fireEvent.press(row);
    await settle();
    expect(screen.queryByText(/A simulated signature for this demo/)).toBeNull();
  });

  it('a REAL signature whose key class the item does not report: "Signing key class: not reported"', async () => {
    await summaryWith('phonePortrait', real());
    expect(screen.queryByTestId('summary-signature-simulated')).toBeNull();
    expect(screen.getByTestId('summary-signature-key-class-UNKNOWN')).toHaveTextContent('Signing key class: not reported');
  });

  it('CONTROL: a simulated signature keeps its "SIMULATED" chip and its note', async () => {
    await summaryWith('phonePortrait', null);
    expect(within(screen.getByTestId('summary-signature-simulated')).getByText('SIMULATED')).toBeTruthy();
    expect(screen.queryByTestId('summary-signature-real')).toBeNull();
    expect(screen.queryByTestId(/^summary-signature-key-class-/)).toBeNull();
    fireEvent.press(screen.getByTestId('summary-hash-signature'));
    await settle();
    expect(screen.getByText(/A simulated signature for this demo/)).toBeTruthy();
  });
});
