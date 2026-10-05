// Backend task, plan row W72: Finalization in LIVE mode. The row changes no production file of this
// folder [CS:§7.3, §17.4 Row 21 #3]; these tests prove the unchanged screen tells the truth on the app's
// real Live source over the contract-checked fake transport: what it shows is the Core's replicated
// session (the stop, the six steps, the seal, the evidence ID), it sends no Core command of its own,
// nothing starts on mount under StrictMode (decision D158), and the route sync hands over to the
// Summary, where the operator's press acknowledges — one session followed from the stop to the
// acknowledged summary, the row's own check in jest form.
//
// Import order: the sheet and list mocks, then the router harness, then the bed (see their headers).
import '@/features/sessions/testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import {
  CORE_ONLY_INPUT,
  SIMULATION_WORDING,
  recordCoreSession,
  renderLiveSummary,
  resetLiveSummaryBed,
  wordsUnder,
  type LiveSummaryBed,
  type LiveSummaryBedOptions,
} from '@/features/session-summary/testing/live-summary-bed';

jest.setTimeout(30_000);

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

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

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

const stepLabel = (index: number): string => String(screen.getByTestId(`finalizing-pipeline-step-${index}`).props.accessibilityLabel);

interface Recording {
  b: LiveSummaryBed;
  sessionId: string;
}

/** A session RECORDING on the Core, the app signed in and on the monitor's route (its stand-in keeps the live route's policy). */
async function onTheMonitor(options: LiveSummaryBedOptions = {}): Promise<Recording> {
  let sessionId = '';
  const b = await renderLiveSummary({
    ...options,
    setup: (engine) => {
      sessionId = recordCoreSession(engine);
    },
  });
  bed = b;
  await b.navigate('/session/live');
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return { b, sessionId };
}

/** The Core stops the recording (the monitor's End Session, sent by the monitor's own row): the delta moves the app to Finalization. */
async function coreStops(b: LiveSummaryBed): Promise<void> {
  await b.coreDo((engine) => engine.sim.actions.stopRecording('Interview completed'));
  await b.flush();
}

describe('Finalization in LIVE mode follows the Core', () => {
  it('stop → STOPPING → six steps → SEALED → the Summary → Done: the Core\'s data throughout, ONE command (the acknowledgement)', async () => {
    const { b, sessionId } = await onTheMonitor();
    await coreStops(b);
    expect(b.app.getPathname()).toBe('/session/finalizing');
    expect(b.state().session?.state).toBe('STOPPING');
    expect(screen.getByTestId('finalizing-session-id')).toHaveTextContent(sessionId);
    expect(within(screen.getByTestId('finalizing-status')).getByText('Ending recording and closing tracks…')).toBeTruthy();
    expect(within(screen.getByTestId('finalizing-case')).getByText(CORE_ONLY_INPUT.caseNumber)).toBeTruthy();
    expect(within(screen.getByTestId('finalizing-subject')).getByText(CORE_ONLY_INPUT.subjectName)).toBeTruthy();
    expect(within(screen.getByTestId('finalizing-evidence')).getByText('Assigned when finalizing starts')).toBeTruthy();

    // The Core's tracks close (1.5 s); FINALIZING arrives with the evidence ID the Core assigned.
    await b.elapse(1_750);
    expect(b.state().session?.state).toBe('FINALIZING');
    const evidenceId = b.state().session!.evidenceId!;
    expect(evidenceId).toBe(b.engine.sim.store.getState().session!.evidenceId);
    expect(within(screen.getByTestId('finalizing-evidence')).getByText(evidenceId)).toBeTruthy();
    expect(stepLabel(0)).toMatch(/^Step 1 of 6, Finalize tracks, (in progress|completed)$/);

    // A step resolves on the Core, then the progress line follows the replica.
    await b.elapse(2_000);
    expect(screen.getByTestId('finalizing-progress').props.children).not.toBe('0% complete');
    const claims = wordsUnder('screen-session-finalizing').filter((word) => SIMULATION_WORDING.test(word));
    expect(claims).toEqual([]);

    // The seal: the route sync replaces Finalization with the Summary (FINALIZING → SEALED, §3.7 trigger 3).
    for (let i = 0; i < 40 && b.app.getPathname() === '/session/finalizing'; i += 1) await b.elapse(250);
    expect(b.state().session?.state).toBe('SEALED');
    expect(b.app.getPathname()).toBe(`/session/summary/${sessionId}`);
    expect(screen.getByTestId('summary-session-id')).toHaveTextContent(sessionId);
    expect(within(screen.getByTestId('summary-evidence-id')).getByText(evidenceId)).toBeTruthy();
    expect(b.state().lastSealedAcknowledged).toBe(false);

    // Nothing was sent on the way: Finalization and the Summary only read the replica.
    expect(b.commandsSinceSignIn()).toEqual([]);

    fireEvent.press(screen.getByTestId('summary-done'));
    await b.flush();
    await b.elapse(250);
    expect(b.app.getPathname()).toBe('/home');
    expect(b.state().lastSealedAcknowledged).toBe(true);
    expect(b.commandsSinceSignIn()).toEqual(['acknowledgeSessionSummary']);
    expect(b.requests('acknowledgeSessionSummary').map((call) => call.params.id)).toEqual([sessionId]);
    expect(getMissingKeys()).toEqual([]);
  });

  it('hardware Back while the Core finalizes is consumed and sends nothing; the screen stays', async () => {
    const pressBack = spyHardwareBack();
    const { b } = await onTheMonitor();
    await coreStops(b);
    await b.elapse(2_000);
    expect(b.state().session?.state).toBe('FINALIZING');
    expect(pressBack()).toBe(true);
    await b.flush();
    expect(b.app.getPathname()).toBe('/session/finalizing');
    expect(screen.queryAllByText('Finalizing — please wait').length).toBeGreaterThan(0);
    expect(b.commandsSinceSignIn()).toEqual([]);
  });

  it('the link drops while the Core finalizes: the screen keeps the last replicated step and sends nothing; when the link is back the Core\'s seal arrives and the Summary opens', async () => {
    const { b, sessionId } = await onTheMonitor();
    await coreStops(b);
    await b.elapse(2_000);
    expect(b.state().session?.state).toBe('FINALIZING');
    const before = String(screen.getByTestId('finalizing-progress').props.children);
    b.setReachable(false);
    // The Core keeps sealing while this device is away.
    await b.elapse(9_000, 500);
    expect(b.engine.sim.store.getState().session?.state).toBe('SEALED');
    expect(b.state().session?.state).toBe('FINALIZING');
    expect(b.app.getPathname()).toBe('/session/finalizing');
    expect(String(screen.getByTestId('finalizing-progress').props.children)).toBe(before);
    b.setReachable(true);
    for (let i = 0; i < 30 && b.app.getPathname() === '/session/finalizing'; i += 1) await b.elapse(500, 250);
    expect(b.state().session?.state).toBe('SEALED');
    expect(b.app.getPathname()).toBe(`/session/summary/${sessionId}`);
    expect(b.commandsSinceSignIn()).toEqual([]);
  });

  it('StrictMode (decision D158): the stop, the pipeline and the hand-off under StrictMode send nothing; the Summary opens once', async () => {
    const { b, sessionId } = await onTheMonitor({ strict: true });
    await coreStops(b);
    expect(b.app.getPathname()).toBe('/session/finalizing');
    for (let i = 0; i < 50 && b.app.getPathname() === '/session/finalizing'; i += 1) await b.elapse(250);
    expect(b.app.getPathname()).toBe(`/session/summary/${sessionId}`);
    await b.elapse(2_000);
    expect(b.app.getPathname()).toBe(`/session/summary/${sessionId}`);
    expect(b.commandsSinceSignIn()).toEqual([]);
  });

  it('opened with no session on the Core: "No finalization in progress", Home offered, nothing sent', async () => {
    const b = await renderLiveSummary();
    bed = b;
    await b.navigate('/session/finalizing');
    expect(screen.getByTestId('finalizing-idle')).toBeTruthy();
    expect(b.commandsSinceSignIn()).toEqual([]);
  });
});
