// Session Summary (step 80; 04_mobile_specs §4.7, §3.6, §2.4; SCR-02; MA-29 summary part).
// Renders the real `/session/summary/[sessionId]` route with a test simulator whose session 0024 has
// just been sealed (summary pending). Import order: the gorhom mock, the router harness, the flow harness.
import '@/features/session-finalizing/testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { haptics, resetMotionStateForTests } from '@/motion';
import { renderFlowApp, settle } from '@/features/session-finalizing/testing/flow-harness';
import { resetStampedForTests } from './stamp-once';
import { shortHash } from './summary.model';

beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
});

afterEach(() => {
  resetMotionStateForTests();
  jest.restoreAllMocks();
});

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

function spyHardwareBack() {
  const listeners: BackListener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler);
    return { remove: () => void listeners.splice(listeners.indexOf(handler), 1) };
  });
  return () => {
    let consumed = false;
    act(() => {
      for (const listener of [...listeners].reverse()) {
        if (listener({} as Parameters<BackListener>[0])) {
          consumed = true;
          break;
        }
      }
    });
    return consumed;
  };
}

function acknowledgements(h: ReturnType<typeof renderFlowApp>): number {
  return h.sim.store.getState().audit.rows.filter((row) => row.type === 'SUMMARY_ACKNOWLEDGED').length;
}

async function openSealed(window: Parameters<typeof renderFlowApp>[0] extends infer O ? (O extends { window?: infer W } ? W : never) : never = 'phonePortrait') {
  const h = renderFlowApp({ scenario: 'sealed', window });
  await settle();
  return h;
}

describe('Session Summary (04 §4.7)', () => {
  it('shows the SEALED stamp, the details, four track hashes, manifest, signature and lifecycle', async () => {
    const trigger = jest.spyOn(haptics, 'trigger');
    const h = await openSealed();
    const state = h.sim.store.getState();
    const entry = state.sessionHistory.find((e) => e.id === h.sessionId)!;
    const item = state.evidence.find((e) => e.sessionId === h.sessionId)!;

    expect(screen.getByTestId('screen-session-summary')).toBeTruthy();
    expect(screen.getByText('Session Summary')).toBeTruthy();
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(screen.getByTestId('summary-session-id')).toHaveTextContent(h.sessionId!);
    expect(trigger.mock.calls.filter(([event]) => event === 'sealedStamp')).toHaveLength(1);

    // Details (§4.7): case, subject + chip, investigator, room, start/end, duration, size, evidence ID.
    expect(within(screen.getByTestId('summary-case')).getByText(entry.caseNumber)).toBeTruthy();
    expect(within(screen.getByTestId('summary-subject')).getByText(entry.subjectName)).toBeTruthy();
    expect(screen.getByTestId('summary-start')).toBeTruthy();
    expect(screen.getByTestId('summary-end')).toBeTruthy();
    expect(within(screen.getByTestId('summary-evidence-id')).getByText(item.id)).toBeTruthy();

    // Hashes: VIDEO-01/02, AUDIO-01/02 in order, short form; manifest; signature marked SIMULATED.
    for (const id of ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']) {
      const sha = item.tracks.find((t) => t.trackId === id)!.sha256;
      expect(within(screen.getByTestId(`summary-hash-${id}`)).getByText(shortHash(sha))).toBeTruthy();
    }
    expect(within(screen.getByTestId('summary-hash-manifest')).getByText(shortHash(item.manifestHash))).toBeTruthy();
    expect(within(screen.getByTestId('summary-signature-simulated')).getByText('SIMULATED')).toBeTruthy();

    // The finished pipeline and the lifecycle at SEALED LOCAL EVIDENCE.
    expect(screen.getByTestId('summary-finalization')).toBeTruthy();
    expect(screen.getByText(/^Sealed \d+\.\d s after the recording ended$/)).toBeTruthy();
    expect(String(screen.getByTestId('summary-lifecycle-stepper-step-7').props.accessibilityLabel)).toBe(
      'Stage 8 of 12, Sealed local evidence, current',
    );
    expect(getMissingKeys()).toEqual([]);
  });

  it('SCR-02: Done acknowledges exactly once and returns Home', async () => {
    const h = await openSealed();
    expect(h.sim.store.getState().lastSealedAcknowledged).toBe(false);
    fireEvent.press(screen.getByTestId('summary-done'));
    expect(h.sim.store.getState().lastSealedAcknowledged).toBe(true);
    expect(acknowledgements(h)).toBe(1);
    expect(h.app.getPathname()).toBe('/home');
  });

  it('View in Evidence acknowledges and opens the evidence detail', async () => {
    const h = await openSealed();
    const evidenceId = h.sim.store.getState().session!.evidenceId!;
    fireEvent.press(screen.getByTestId('summary-view-evidence'));
    expect(acknowledgements(h)).toBe(1);
    expect(h.app.getPathname()).toBe(`/evidence/${evidenceId}`);
  });

  it('§3.6: hardware Back acknowledges and returns Home (consumed, never leaves the app)', async () => {
    const pressBack = spyHardwareBack();
    const h = await openSealed();
    expect(pressBack()).toBe(true);
    expect(acknowledgements(h)).toBe(1);
    expect(h.app.getPathname()).toBe('/home');
  });

  it('a tap on a hash opens the full value in a sheet', async () => {
    const h = await openSealed();
    const sha = h.sim.store.getState().evidence.find((e) => e.sessionId === h.sessionId)!.tracks.find((t) => t.trackId === 'VIDEO-01')!.sha256;
    fireEvent.press(screen.getByTestId('summary-hash-VIDEO-01'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByTestId('summary-hash-sheet-value')).toHaveTextContent(sha);
    expect(screen.getByText('VIDEO-01 · Camera 1')).toBeTruthy();
  });

  it('the stamp plays once per session: a second visit draws it still, with no haptic', async () => {
    const first = await openSealed();
    first.app.unmount();
    const trigger = jest.spyOn(haptics, 'trigger');
    // Same process, new render of the same pending summary.
    const again = renderFlowApp({ scenario: 'sealed' });
    await settle();
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(trigger.mock.calls.filter(([event]) => event === 'sealedStamp')).toHaveLength(0);
    expect(again.sessionId).toBe(first.sessionId);
  });

  it('a past session renders without a stamp and without acknowledging anything', async () => {
    const trigger = jest.spyOn(haptics, 'trigger');
    const probe = renderFlowApp({ scenario: 'sealed' });
    const past = probe.sim.store.getState().sessionHistory.find((e) => e.id !== probe.sessionId && e.outcome === 'SEALED')!;
    probe.app.unmount();
    trigger.mockClear();
    const h = renderFlowApp({ scenario: 'sealed', initialUrl: `/session/summary/${past.id}` });
    await settle();
    expect(screen.getByTestId('summary-session-id')).toHaveTextContent(past.id);
    expect(trigger.mock.calls.filter(([event]) => event === 'sealedStamp')).toHaveLength(0);
    expect(screen.queryByTestId('summary-finalization')).toBeNull();
    fireEvent.press(screen.getByTestId('summary-done'));
    expect(acknowledgements(h)).toBe(0);
    expect(h.app.getPathname()).toBe('/home');
  });

  it('an unknown session ID says so and offers Home', async () => {
    const h = renderFlowApp({ scenario: 'sealed', initialUrl: '/session/summary/SES-20261001-9999' });
    await settle();
    expect(screen.getByTestId('summary-not-found')).toBeTruthy();
    expect(screen.getByText('Session SES-20261001-9999 is not in this Core’s history.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('summary-notice-action'));
    expect(h.app.getPathname()).toBe('/home');
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet: summary and pipeline side by side (pane-finalization | pane-summary)', async () => {
    await openSealed('tabletLandscape');
    expect(screen.getByTestId('pane-finalization')).toBeTruthy();
    expect(screen.getByTestId('pane-summary')).toBeTruthy();
    expect(within(screen.getByTestId('pane-finalization')).getByTestId('summary-pipeline')).toBeTruthy();
    expect(within(screen.getByTestId('pane-summary')).getByTestId('summary-hashes')).toBeTruthy();
  });
});
