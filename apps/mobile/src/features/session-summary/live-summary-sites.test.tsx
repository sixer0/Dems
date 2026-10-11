// Backend task, plan row W72: the Session Summary in LIVE mode — settle site S2-4 (the acknowledgement,
// operation 37 `acknowledgeSessionSummary`, through Done, View in Evidence and Back) and S4-4 (whether a
// request is needed is read from the replica before the call), each with its success, its refusal (a
// 403 named by its example `notPermitted`: the denied toast, AC-C-48), an outage and a limit; the
// pending control (LB-1, AC-C-57/58); the StrictMode rule (decision D158: nothing is sent on mount);
// and the screen shows the Core's data. All on the app's real Live source over the contract-checked
// fake transport.
//
// Import order: the sheet and list mocks, then the router harness, then the bed (see their headers).
import '@/features/sessions/testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { rateLimited } from '@dems/shared/live/testing';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { shortHash } from './summary.model';
import {
  CORE_ONLY_INPUT,
  SIMULATION_WORDING,
  renderLiveSummary,
  resetLiveSummaryBed,
  sealCoreSession,
  wordsUnder,
  type LiveSummaryBed,
  type LiveSummaryBedOptions,
} from './testing/live-summary-bed';

let bed: LiveSummaryBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveSummaryBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
});

const DENIED = 'Not permitted';
const DENIED_ROLE = 'Requires the Investigator role';
const OFFLINE = 'Core server unreachable';
const OFFLINE_HINT = 'Nothing was changed.';
const LIMIT = 'The Core server is limiting requests from this tablet';
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

/** Captures the screen's hardware-Back listeners (install before the render). */
function spyHardwareBack(): () => boolean {
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

interface Opened {
  b: LiveSummaryBed;
  sessionId: string;
  evidenceId: string;
}

/** A session sealed on the Core (summary pending), the app signed in, the Summary opened. */
async function openSealedSummary(options: LiveSummaryBedOptions = {}): Promise<Opened> {
  let sessionId = '';
  const b = await renderLiveSummary({
    ...options,
    setup: (engine) => {
      sessionId = sealCoreSession(engine);
      options.setup?.(engine);
    },
  });
  bed = b;
  await b.navigate(`/session/summary/${sessionId}`);
  await b.elapse(500);
  expect(screen.getByTestId('screen-session-summary')).toBeTruthy();
  const evidenceId = b.state().session?.evidenceId ?? '';
  return { b, sessionId, evidenceId };
}

async function pressAndSettle(testID: string, b: LiveSummaryBed): Promise<void> {
  fireEvent.press(screen.getByTestId(testID));
  await b.flush();
  await b.elapse(250);
}

const acknowledgements = (b: LiveSummaryBed) => b.engine.sim.store.getState().audit.rows.filter((row) => row.type === 'SUMMARY_ACKNOWLEDGED').length;

describe('the Summary in LIVE mode shows the Core\'s data and claims no simulation', () => {
  it('the hero, details, hashes, finalization and lifecycle come from the replica; only the signature says SIMULATED (the contract calls it so)', async () => {
    const { b, sessionId, evidenceId } = await openSealedSummary();
    const item = b.state().evidence.find((entry) => entry.sessionId === sessionId)!;
    expect(item.id).toBe(evidenceId);
    expect(screen.getByTestId('summary-session-id')).toHaveTextContent(sessionId);
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(within(screen.getByTestId('summary-case')).getByText(CORE_ONLY_INPUT.caseNumber)).toBeTruthy();
    expect(within(screen.getByTestId('summary-subject')).getByText(CORE_ONLY_INPUT.subjectName)).toBeTruthy();
    expect(within(screen.getByTestId('summary-investigator')).getByText('AKP Budi Santoso')).toBeTruthy();
    expect(within(screen.getByTestId('summary-evidence-id')).getByText(evidenceId)).toBeTruthy();
    for (const id of ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']) {
      const sha = item.tracks.find((track) => track.trackId === id)!.sha256;
      expect(within(screen.getByTestId(`summary-hash-${id}`)).getByText(shortHash(sha))).toBeTruthy();
    }
    expect(within(screen.getByTestId('summary-hash-manifest')).getByText(shortHash(item.manifestHash))).toBeTruthy();
    // The Core's SEALED session stays its current session until the next create (server finding F-7),
    // so the finished pipeline with the Core's own step instants is shown.
    expect(screen.getByTestId('summary-finalization')).toBeTruthy();
    expect(screen.getByText(/^Sealed \d+\.\d s after the recording ended$/)).toBeTruthy();
    // Rule 8: nothing claims a simulation except the signature row, which the contract itself calls a
    // simulated signature (`api/state-slices.ts`, evidence `signature`; decision D158 DC-4).
    const claims = wordsUnder('screen-session-summary').filter((word) => SIMULATION_WORDING.test(word));
    const signature = new Set(wordsUnder('summary-hash-signature').filter((word) => SIMULATION_WORDING.test(word)));
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.filter((word) => !signature.has(word))).toEqual([]);
    expect(screen.queryByTestId('summary-link-down')).toBeNull();
    // Opening the Summary sent nothing (decision D158).
    expect(b.commandsSinceSignIn()).toEqual([]);
    expect(getMissingKeys()).toEqual([]);
  });

  it('an ID the Core does not know says so and sends nothing', async () => {
    const b = await renderLiveSummary();
    bed = b;
    await b.navigate('/session/summary/SES-20261006-0999');
    expect(screen.getByTestId('summary-not-found')).toBeTruthy();
    expect(screen.getByText('Session SES-20261006-0999 is not in this Core’s history.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('summary-notice-action'));
    await b.flush();
    expect(b.app.getPathname()).toBe('/home');
    expect(b.commandsSinceSignIn()).toEqual([]);
  });
});

describe('S2-4: Done, View in Evidence and Back acknowledge through the Core, then navigate in ok', () => {
  it('success: Done sends one acknowledgement for this session; Home opens after the Core\'s 204; the replica says acknowledged', async () => {
    const { b, sessionId } = await openSealedSummary();
    expect(b.state().lastSealedAcknowledged).toBe(false);
    await pressAndSettle('summary-done', b);
    expect(b.requests('acknowledgeSessionSummary').map((call) => call.params.id)).toEqual([sessionId]);
    expect(b.state().lastSealedAcknowledged).toBe(true);
    expect(acknowledgements(b)).toBe(1);
    expect(b.app.getPathname()).toBe('/home');
    expect(b.commandsSinceSignIn()).toEqual(['acknowledgeSessionSummary']);
  });

  it('success: View in Evidence acknowledges once and opens the Core\'s evidence item', async () => {
    const { b, evidenceId } = await openSealedSummary();
    await pressAndSettle('summary-view-evidence', b);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(1);
    expect(b.app.getPathname()).toBe(`/evidence/${evidenceId}`);
  });

  it('success: hardware Back acknowledges once and returns Home (consumed, never leaves the app)', async () => {
    const pressBack = spyHardwareBack();
    const { b } = await openSealedSummary();
    expect(pressBack()).toBe(true);
    await b.flush();
    await b.elapse(250);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(1);
    expect(b.app.getPathname()).toBe('/home');
  });

  it('refusal: a 403 (example notPermitted) → the denied toast with the role; the Summary stays, Done is idle; a second press sends again', async () => {
    const { b } = await openSealedSummary();
    b.fake.answerOnce('acknowledgeSessionSummary', b.fake.example('acknowledgeSessionSummary', 403, 'notPermitted'));
    await pressAndSettle('summary-done', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(DENIED_ROLE)).toBe(true);
    expect(toastShown('The summary could not be acknowledged. Please try again.')).toBe(false);
    expect(b.app.getPathname()).toMatch(/^\/session\/summary\//);
    expect(isBusy('summary-done')).toBe(false);
    expect(b.state().lastSealedAcknowledged).toBe(false);
    expect(acknowledgements(b)).toBe(0);
    await pressAndSettle('summary-done', b);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(2);
    expect(b.app.getPathname()).toBe('/home');
  });

  it('refusal on View in Evidence: the denied toast; no evidence route; the control is idle', async () => {
    const { b } = await openSealedSummary();
    b.fake.answerOnce('acknowledgeSessionSummary', b.fake.example('acknowledgeSessionSummary', 403, 'notPermitted'));
    await pressAndSettle('summary-view-evidence', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(b.app.getPathname()).toMatch(/^\/session\/summary\//);
    expect(isBusy('summary-view-evidence')).toBe(false);
  });

  it('outage: "Core server unreachable. Nothing was changed."; the Summary stays; a second press succeeds', async () => {
    const { b } = await openSealedSummary();
    b.fake.failOnce('acknowledgeSessionSummary');
    await pressAndSettle('summary-done', b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(b.app.getPathname()).toMatch(/^\/session\/summary\//);
    expect(isBusy('summary-done')).toBe(false);
    expect(b.state().lastSealedAcknowledged).toBe(false);
    await pressAndSettle('summary-done', b);
    expect(b.app.getPathname()).toBe('/home');
    expect(acknowledgements(b)).toBe(1);
  });

  it('a limit (429) is worded as a limit with the seconds, never as an outage, and shows no link notice (LB-10)', async () => {
    const { b } = await openSealedSummary();
    b.fake.answerOnce('acknowledgeSessionSummary', rateLimited(12));
    await pressAndSettle('summary-done', b);
    expect(toastShown(LIMIT)).toBe(true);
    expect(toastShown('Try again in 12 s.')).toBe(true);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(screen.queryByTestId('summary-link-down')).toBeNull();
    expect(b.app.getPathname()).toMatch(/^\/session\/summary\//);
    expect(isBusy('summary-done')).toBe(false);
  });
});

describe('S4-4: whether a request is needed is read from the replica before the call', () => {
  it('a summary another console acknowledged on the Core: Done sends nothing and goes Home', async () => {
    const { b, sessionId } = await openSealedSummary();
    await b.coreDo((engine) => engine.sim.actions.acknowledgeSummary(sessionId));
    expect(b.state().lastSealedAcknowledged).toBe(true);
    await pressAndSettle('summary-done', b);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(0);
    expect(b.app.getPathname()).toBe('/home');
  });

  it('a past session of the Core\'s history: no stamp, no acknowledgement, Done goes Home', async () => {
    let past = '';
    const b = await renderLiveSummary({
      setup: (engine) => {
        sealCoreSession(engine);
        past = engine.sim.store.getState().sessionHistory.find((entry) => entry.outcome === 'SEALED' && entry.subjectName !== CORE_ONLY_INPUT.subjectName)!.id;
      },
    });
    bed = b;
    await b.navigate(`/session/summary/${past}`);
    expect(screen.getByTestId('summary-session-id')).toHaveTextContent(past);
    expect(screen.queryByTestId('summary-finalization')).toBeNull();
    await pressAndSettle('summary-done', b);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(0);
    expect(b.app.getPathname()).toBe('/home');
  });
});

describe('the pending control (LB-1; AC-C-57, AC-C-58)', () => {
  it('an answer 1 s late: Done is busy at once, the spinner only after the reveal delay; Done, View in Evidence and Back together send ONE request', async () => {
    const pressBack = spyHardwareBack();
    const { b } = await openSealedSummary({ answerDelayMs: 1_000 });
    fireEvent.press(screen.getByTestId('summary-done'));
    await b.flush();
    expect(isBusy('summary-done')).toBe(true);
    fireEvent.press(screen.getByTestId('summary-done'));
    fireEvent.press(screen.getByTestId('summary-view-evidence'));
    expect(pressBack()).toBe(true);
    fireEvent.press(screen.getByTestId('summary-back'));
    await b.flush();
    await b.elapse(300, 100);
    expect(screen.queryByTestId('summary-done-spinner')).toBeNull();
    await b.elapse(200, 100);
    expect(within(screen.getByTestId('summary-done')).getByTestId('summary-done-spinner')).toBeTruthy();
    expect(screen.queryByTestId('summary-view-evidence-spinner')).toBeNull();
    expect(b.app.getPathname()).toMatch(/^\/session\/summary\//);
    await b.elapse(700, 100);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(1);
    expect(b.app.getPathname()).toBe('/home');
  });

  it('a fast answer (50 ms): no spinner at any step', async () => {
    const { b } = await openSealedSummary({ answerDelayMs: 50 });
    fireEvent.press(screen.getByTestId('summary-done'));
    for (let step = 0; step < 6 && b.app.getPathname() !== '/home'; step += 1) {
      await b.elapse(10, 10);
      expect(screen.queryByTestId('summary-done-spinner')).toBeNull();
    }
    await b.elapse(100, 50);
    expect(b.app.getPathname()).toBe('/home');
  });
});

describe('the Core link (M1: one call, `useCoreLinkNotice`)', () => {
  it('while the summary waits and the link is down: the notice says why; a press stays; when the link is back the notice goes and Done finishes', async () => {
    const { b } = await openSealedSummary();
    b.setReachable(false);
    await b.elapse(1_000);
    expect(screen.getByTestId('summary-link-down')).toBeTruthy();
    expect(screen.getByText('Your acknowledgement of this summary is recorded on the Core server. Done and View in Evidence finish once the connection is back.')).toBeTruthy();
    await pressAndSettle('summary-done', b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(b.app.getPathname()).toMatch(/^\/session\/summary\//);
    expect(isBusy('summary-done')).toBe(false);
    b.setReachable(true);
    await b.elapse(8_000, 500);
    expect(screen.queryByTestId('summary-link-down')).toBeNull();
    await pressAndSettle('summary-done', b);
    expect(b.app.getPathname()).toBe('/home');
    expect(acknowledgements(b)).toBe(1);
  });
});

describe('StrictMode (decision D158): the acknowledgement is the operator\'s press, never the mount', () => {
  it('opening the Summary under StrictMode sends nothing; one press sends exactly one request', async () => {
    const { b } = await openSealedSummary({ strict: true });
    await b.elapse(1_000);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(0);
    await pressAndSettle('summary-done', b);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(1);
    expect(b.app.getPathname()).toBe('/home');
  });
});
