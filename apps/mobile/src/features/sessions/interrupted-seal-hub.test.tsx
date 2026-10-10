// Wave H, driver B (gates 75 / 89: G75-03, B-3; ruling D197): the Sessions hub names a sealed recording
// that was interrupted - on its row and on its detail - instead of the plain "Sealed". The history
// entry itself cannot carry a fault kind for a SEALED outcome (database CHECK), so the fact is read
// through the session's item (`interruptedSealOfSession`). Written RED: both read "Sealed".
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { screen, within } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderSessionsApp, settle } from './testing/sessions-harness';

afterEach(() => resetMissingKeys());

const WORDS = en.common.interruptedSeal;

describe('an interrupted seal in the Sessions hub', () => {
  it('the row of that session says so; the other sealed rows read "Sealed" (control)', async () => {
    let interruptedId = '';
    let plainId = '';
    renderSessionsApp({
      prepare(test) {
        const state = test.sim.store.getState();
        const sealed = state.sessionHistory.filter((entry) => entry.outcome === 'SEALED' && entry.evidenceId !== null);
        interruptedId = sealed[0]!.id;
        plainId = sealed[1]!.id;
        test.sim.store.setState({
          evidence: state.evidence.map((item) =>
            item.sessionId === interruptedId ? { ...item, custody: [item.custody[0]!, { at: item.endedAt, action: 'RECORDING_INTERRUPTED', actorId: null, detail: 'CAPTURE_FAULT' }, ...item.custody.slice(2)] } : item,
          ),
        });
      },
    });
    await settle();
    const chip = screen.getByTestId(`session-row-status-${interruptedId}`);
    expect(within(chip).getByText(WORDS.chip)).toBeTruthy();
    expect(within(chip).queryByText('Sealed')).toBeNull();
    expect(chip.props.accessibilityLabel).toBe(WORDS.title);
    expect(within(screen.getByTestId(`session-row-status-${plainId}`)).getByText('Sealed')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });
});
