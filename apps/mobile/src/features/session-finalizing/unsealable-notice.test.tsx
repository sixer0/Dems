// Fix pass F-M7b (review row 88, R88-02 (c); rulings D178 (2), D183): a session the Core could not
// seal is shown on the tablet and the phone as a STATE of the recording, in the Core's own sentence -
// never as an operator error, and with no control. The state is read from the Core's alert.
import './testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import { SEAL_UNSEALABLE_PLAIN_SENTENCE, unsealableSentence, type SimAlert } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { UnsealableNotice } from './unsealable-notice';

afterEach(() => resetMissingKeys());

const SESSION = 'SES-20261010-0007';
const unsealable = (cause: string, sessionId = SESSION, at = 1): SimAlert => ({ id: `ALR-00090${at}`, at, severity: 'CRITICAL', kind: 'SYSTEM', message: unsealableSentence(cause), active: true, acknowledged: false, resolvedAt: null, target: sessionId, params: { reason: 'UNSEALABLE', cause, sessionId } });

function mount(alerts: SimAlert[], sessionId: string | null = null) {
  const test = createTestSim();
  test.sim.store.setState(() => ({ alerts }));
  return render(
    <RuntimeTestProviders sim={test.sim}>
      <UnsealableNotice sessionId={sessionId} />
    </RuntimeTestProviders>,
  );
}

describe('the UNSEALABLE state on the Finalizing and the Recovery screen', () => {
  // Fix wave L (G75d-01, G75d-04; contract_wave_l.md sections 1 and 3) changed two things this file pinned:
  // the notice is drawn for the session the screen FOLLOWS only (no id = nothing; before: the newest notice of
  // ANY session), and the sentence is the shared one WITHOUT the code - the code is a detail line of its own.
  it('says that the recording could not be sealed and that its files are in quarantine on the Core, with the cause - politely, with no control', () => {
    mount([unsealable('NOTHING_SEALABLE')], SESSION);
    const notice = screen.getByTestId('session-unsealable');
    expect(screen.getByText(SEAL_UNSEALABLE_PLAIN_SENTENCE)).toBeTruthy();
    expect(SEAL_UNSEALABLE_PLAIN_SENTENCE).toBe('This recording could not be sealed. Its files were kept in quarantine on the Core.');
    expect(screen.getByTestId('session-unsealable-cause')).toHaveTextContent('Cause code: NOTHING_SEALABLE');
    expect(screen.getByText(`Session ${SESSION}`)).toBeTruthy();
    // No code as a sentence (G75d-04).
    expect(screen.queryByText(unsealableSentence('NOTHING_SEALABLE'))).toBeNull();
    expect(en.common.sealUnsealable.notice.replace('{{cause}}', 'NOTHING_SEALABLE')).toBe(unsealableSentence('NOTHING_SEALABLE'));
    // It does not block recording, and it says who closes it (the seed operator signed in here is no supervisor).
    expect(screen.getByTestId('session-unsealable-not-blocking')).toHaveTextContent('Recording is not blocked: a new session can be started.');
    expect(screen.getByTestId('session-unsealable-close')).toHaveTextContent('A supervisor acknowledges this notice to close it.');
    // A state, not an operator error: announced politely, nothing to press.
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(getMissingKeys()).toEqual([]);
  });

  it('for a named session it shows that session only; WITHOUT one it shows nothing (never the newest notice of another session)', () => {
    mount([unsealable('NOTHING_SEALABLE', 'SES-20261010-0001', 1), unsealable('MANIFEST_INVALID', SESSION, 2)], 'SES-20261010-0001');
    expect(screen.getByTestId('session-unsealable-cause')).toHaveTextContent('Cause code: NOTHING_SEALABLE');
    expect(screen.getByText('Session SES-20261010-0001')).toBeTruthy();
    screen.unmount();
    mount([unsealable('NOTHING_SEALABLE', 'SES-20261010-0001', 1), unsealable('MANIFEST_INVALID', SESSION, 2)]);
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
  });

  it('CONTROL: nothing is drawn without that state - no alert, a resolved alert, another reason, another session', () => {
    mount([], SESSION);
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
    screen.unmount();
    mount([{ ...unsealable('NOTHING_SEALABLE'), active: false, resolvedAt: 2 }], SESSION);
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
    screen.unmount();
    mount([{ ...unsealable('NOTHING_SEALABLE'), params: { reason: 'CAPTURE_DISCOVERY_EMPTY' } }], SESSION);
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
    screen.unmount();
    mount([unsealable('NOTHING_SEALABLE')], 'SES-20261010-0001');
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
  });
});
