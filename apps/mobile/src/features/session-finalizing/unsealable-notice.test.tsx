// Fix pass F-M7b (review row 88, R88-02 (c); rulings D178 (2), D183): a session the Core could not
// seal is shown on the tablet and the phone as a STATE of the recording, in the Core's own sentence -
// never as an operator error, and with no control. The state is read from the Core's alert.
import './testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import { unsealableSentence, type SimAlert } from '@dems/shared/sim';
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
  it('says that the recording could not be sealed and that its files are in quarantine on the Core, with the cause - politely, with no control', () => {
    mount([unsealable('NOTHING_SEALABLE')]);
    const notice = screen.getByTestId('session-unsealable');
    expect(screen.getByText('This recording could not be sealed. Its files were kept in quarantine on the Core. (NOTHING_SEALABLE)')).toBeTruthy();
    expect(en.common.sealUnsealable.notice.replace('{{cause}}', 'NOTHING_SEALABLE')).toBe(unsealableSentence('NOTHING_SEALABLE'));
    // A state, not an operator error: announced politely, nothing to press.
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(getMissingKeys()).toEqual([]);
  });

  it('for a named session it shows that session only; without one, the most recent', () => {
    mount([unsealable('NOTHING_SEALABLE', 'SES-20261010-0001', 1), unsealable('MANIFEST_INVALID', SESSION, 2)], 'SES-20261010-0001');
    expect(screen.getByText(unsealableSentence('NOTHING_SEALABLE'))).toBeTruthy();
    screen.unmount();
    mount([unsealable('NOTHING_SEALABLE', 'SES-20261010-0001', 1), unsealable('MANIFEST_INVALID', SESSION, 2)]);
    expect(screen.getByText(unsealableSentence('MANIFEST_INVALID'))).toBeTruthy();
  });

  it('CONTROL: nothing is drawn without that state - no alert, a resolved alert, another reason, another session', () => {
    mount([]);
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
    screen.unmount();
    mount([{ ...unsealable('NOTHING_SEALABLE'), active: false, resolvedAt: 2 }]);
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
    screen.unmount();
    mount([{ ...unsealable('NOTHING_SEALABLE'), params: { reason: 'CAPTURE_DISCOVERY_EMPTY' } }]);
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
    screen.unmount();
    mount([unsealable('NOTHING_SEALABLE')], 'SES-20261010-0001');
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
  });
});
