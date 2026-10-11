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
import { shortHash, summaryTimeSource } from './summary.model';
import type { EvidenceItem, Sim } from '@dems/shared/sim';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
import { PANE_REFLOW } from '@/layout';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('session summary screen', () => {
unmountBeforeTheHooksOfThisGroup();

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
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-c2-signature.test.tsx` (test-suite consolidation, D233): every case as it was.
// Wave H, driver C2 (mobile) - finding 3 of the common brief on the Session Summary (G81-02 /
// G89-03, MAJOR): the chip "SIMULATED" beside Signature is drawn only for a SIMULATED signature. A
// REAL Ed25519 signature (`signature.simulated === false`) names its algorithm and Core key; the
// only qualifier is the development-key line, from the item's `signature.developmentKey`.
describe('the signature row', () => {
unmountBeforeTheHooksOfThisGroup();
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
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-z2-time-source.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave H, closing pass Z2 (driver A's request line of 10:20:55Z, item 3: "the Summary Start / End
// chips say GNSS from the simulator's `time` slice"; ruling D203 (1); closing pass Z1's line of
// 10:30:00Z). The two time-source chips of the Session Summary repeat the time source of the session.
//
// | Rule | Case |
// |------|------|
// | The chip reads THE SESSION'S OWN MEMBER (`startTimeSource` / `endTimeSource` of its history entry) when the Core states it; the ring of the live `time` slice is only the fallback of an entry without the members | "the member wins" |
// | On a Core whose time is the host system clock (`time.hostClock`) an `RTC` member reads "Host system clock", in a neutral chip - never "GNSS", never a success mark | "host clock" |
// | CONTROL: the simulator's sealed session keeps its GNSS chips | both |
//
// Import order matters: the gorhom mock, then the router harness.
describe('the time-source chips', () => {
unmountBeforeTheHooksOfThisGroup();
beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
});
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

const HOST_CLOCK = { hostClock: true, source: 'RTC', locked: false, stratum: 0, offsetMs: 0, lastSyncAt: 0, gnss: { locked: false, satellites: 0 }, ntp: { server: '', reachable: false, stratum: 0 }, rtc: { driftPpm: 0 }, history: [] };
const setEntry = (sim: Sim, sessionId: string, patch: Record<string, unknown>) =>
  act(() => sim.store.setState((s) => ({ sessionHistory: s.sessionHistory.map((entry) => (entry.id === sessionId ? { ...entry, ...patch } : entry)) })));
const chipsOf = (testID: 'summary-start' | 'summary-end') => within(screen.getByTestId(testID));

describe('the time-source chips of the Session Summary', () => {
  it('the member wins: an entry that says RTC reads RTC although the live slice\'s ring says GNSS', async () => {
    const h = renderFlowApp({ scenario: 'sealed' });
    await settle();
    // CONTROL: the simulator's sealed session.
    expect(chipsOf('summary-start').getByText('GNSS')).toBeTruthy();
    expect(chipsOf('summary-end').getByText('GNSS')).toBeTruthy();

    setEntry(h.sim, h.sessionId!, { startTimeSource: 'RTC', endTimeSource: 'RTC' });
    await settle();
    for (const id of ['summary-start', 'summary-end'] as const) {
      expect(chipsOf(id).queryByText('GNSS')).toBeNull();
      expect(chipsOf(id).getByText('RTC')).toBeTruthy();
    }
  });

  it('host clock: a Core in its own capture reads "Host system clock" on both chips - no GNSS, no RTC code', async () => {
    const h = renderFlowApp({ scenario: 'sealed' });
    await settle();
    setEntry(h.sim, h.sessionId!, { startTimeSource: 'RTC', endTimeSource: 'RTC' });
    act(() => h.sim.store.setState({ time: HOST_CLOCK as never }));
    await settle();
    for (const id of ['summary-start', 'summary-end'] as const) {
      expect(chipsOf(id).getByText('Host system clock')).toBeTruthy();
      expect(chipsOf(id).queryByText('GNSS')).toBeNull();
      expect(chipsOf(id).queryByText('RTC')).toBeNull();
      expect(chipsOf(id).getByLabelText('Time source Host system clock')).toBeTruthy();
    }
  });

  it('the rule (pure)', () => {
    // The member, else the ring; null when neither knows.
    expect(summaryTimeSource({ member: 'RTC', ring: 'GNSS', hostClock: false })).toEqual({ source: 'RTC', host: false });
    expect(summaryTimeSource({ member: null, ring: 'GNSS', hostClock: false })).toEqual({ source: 'GNSS', host: false });
    expect(summaryTimeSource({ member: undefined, ring: null, hostClock: false })).toBeNull();
    // The host clock names an RTC member; a member that says otherwise is repeated as stated.
    expect(summaryTimeSource({ member: 'RTC', ring: null, hostClock: true })).toEqual({ source: 'RTC', host: true });
    expect(summaryTimeSource({ member: 'GNSS', ring: null, hostClock: true })).toEqual({ source: 'GNSS', host: false });
    // The host clock keeps no ring: nothing is read from it there.
    expect(summaryTimeSource({ member: null, ring: 'GNSS', hostClock: true })).toBeNull();
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-m1-tablet-taps.test.tsx` (test-suite consolidation, D233): every case as it was.
// Wave K, driver M1 - gate finding G81b-03 (MAJOR) on the Session Summary itself.
//
// On the tablet the right pane holds the session details, the hashes, the "Sealed files" block
// (which arrives from the Core AFTER the pane mounted) and the two closing buttons. Under reduced
// motion the pane's layout transition left its native box at the height it had before that block
// arrived; everything below lay outside the box and took no touch (the view tree of the gate:
// pane [176..580], buttons at 1376). The cause and the device proof: implementation/142 section 2;
// the shared rule: `src/layout/layout.test.tsx` ("a pane under reduced motion").
//
// Held here, on the screen: with reduced motion neither pane of the tablet Summary (nor the one pane
// of the phone) carries a layout transition, the closing controls are INSIDE the summary pane, and
// they answer a press.
describe('the panes under reduced motion', () => {
unmountBeforeTheHooksOfThisGroup();
beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
});
afterEach(() => {
  resetMotionStateForTests();
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

const layoutOf = (testID: string): unknown => (screen.getByTestId(testID).props as { layout?: unknown }).layout;

describe('G81b-03 - the panes of the Session Summary under reduced motion', () => {
  it('tablet: `pane-summary` and `pane-finalization` carry no layout transition; "Done", "View in Evidence" and the hash rows are inside the summary pane and answer a press', async () => {
    resetMotionStateForTests({ linkMotion: 'off' });
    renderFlowApp({ scenario: 'sealed', window: 'tabletLandscape' });
    await settle();
    expect(layoutOf('pane-summary')).toBeUndefined();
    expect(layoutOf('pane-finalization')).toBeUndefined();
    const pane = within(screen.getByTestId('pane-summary'));
    // No closing control is drawn outside the pane that owns it (the tablet has no pinned bar).
    expect(pane.getByTestId('summary-done')).toBeTruthy();
    expect(pane.getByTestId('summary-view-evidence')).toBeTruthy();
    fireEvent.press(pane.getByTestId('summary-hash-manifest'));
    await settle();
    expect(screen.getByTestId('summary-hash-sheet')).toBeTruthy();
  });

  it('tablet: "Done" answers (the summary is acknowledged and left)', async () => {
    resetMotionStateForTests({ linkMotion: 'off' });
    const h = renderFlowApp({ scenario: 'sealed', window: 'tabletLandscape' });
    await settle();
    expect(h.sim.store.getState().lastSealedAcknowledged).toBe(false);
    fireEvent.press(within(screen.getByTestId('pane-summary')).getByTestId('summary-done'));
    await settle();
    expect(h.sim.store.getState().lastSealedAcknowledged).toBe(true);
    expect(h.app.getPathname()).toBe('/home');
  });

  it('phone: the one pane carries no layout transition either (its "Sealed files" rows are inside it)', async () => {
    resetMotionStateForTests({ linkMotion: 'off' });
    renderFlowApp({ scenario: 'sealed', window: 'phonePortrait' });
    await settle();
    expect(layoutOf('pane-summary')).toBeUndefined();
  });

  it('CONTROL: under full motion the panes keep their re-flow spring', async () => {
    resetMotionStateForTests();
    renderFlowApp({ scenario: 'sealed', window: 'tabletLandscape' });
    await settle();
    expect(layoutOf('pane-summary')).toBe(PANE_REFLOW);
  });
});
});
