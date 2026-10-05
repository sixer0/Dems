// Backend task, plan row W68: the Session Monitor in LIVE mode — settle site S2-1 (`useMonitorActions.run`
// with its consumers Snapshot, Marker and End Session) and S4-2 (the timeline's newest node read after
// `addMarker`), each with its success, its refusal (a 403 named by its example `notPermitted`: the denied
// toast, AC-C-48) and an outage, on the app's real Live source over the contract-checked fake transport.
// The stop also covers the Core as the judge of the reason (422 `INVALID_REASON`, F59), a session another
// console already stopped (409), a limit (429, LB-10) and the pending control (LB-1, AC-C-57/58 in their
// mobile form), with "Keep recording" held while the stop is out.
//
// Import order: the gorhom mock, then the router harness, then the bed (see their headers).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { rateLimited, refusal } from '@dems/shared/live/testing';
import { timelineTime } from '@/components/composed/session-timeline.math';
import { LiveFeed } from './live-feed';
import { waitForSheetExit } from './testing/monitor-harness';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed, type LiveMonitorBedOptions } from './testing/live-monitor-bed';

let bed: LiveMonitorBed | null = null;

beforeEach(async () => {
  await resetLiveMonitorBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

const DENIED = 'Not permitted';
const DENIED_ROLE = 'Requires the Investigator role';
const OFFLINE = 'Core server unreachable';
const OFFLINE_HINT = 'Nothing was changed.';
const CAPTURED = 'Snapshot captured';
const REASON = 'Interview complete';
const isBusy = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.busy === true;
const toastShown = (text: string) => screen.queryAllByText(text).length > 0;
const markerToastShown = () => screen.queryAllByText(/^Marker added at /).length > 0;
const feedSignals = () => {
  const props = screen.UNSAFE_getByType(LiveFeed).props as { shutterSignal: number; snapshotSignal: number };
  return { shutter: props.shutterSignal, snapshot: props.snapshotSignal };
};

async function openMonitor(options: LiveMonitorBedOptions = {}): Promise<LiveMonitorBed> {
  const b = await renderLiveMonitor(options);
  bed = b;
  await b.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return b;
}

async function pressAndSettle(testID: string, b: LiveMonitorBed): Promise<void> {
  fireEvent.press(screen.getByTestId(testID));
  await b.flush();
  await b.elapse(200);
}

/** The Dialog opens on a tap under the motion test switch and on the 1.5 s hold in full motion (F-4 of W67). */
function openEndDialog(): void {
  fireEvent.press(screen.getByTestId('monitor-end-session'));
  if (screen.queryByTestId('monitor-end-dialog') === null) fireEvent(screen.getByTestId('monitor-end-session'), 'onLongPress');
  expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
}

function typeReason(text: string): void {
  fireEvent.changeText(screen.getByTestId('monitor-end-reason'), text);
}

describe('S2-1 Snapshot (operation 36): the shutter at the press, the rest on the settle (LB-4)', () => {
  it('success: one request; the flash at the press, the flight, the counter and the toast once the Core holds the snapshot (answer before delta)', async () => {
    const b = await openMonitor();
    const before = b.state().session!.snapshotCount;
    const signals = feedSignals();
    b.order = 'answer-first';
    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    await b.flush();
    await b.elapse(200);
    // The Core answered 204; its delta is not here yet, so the continuation waits (CL-16).
    expect(b.requests('takeSessionSnapshot')).toHaveLength(1);
    expect(feedSignals()).toEqual({ shutter: signals.shutter + 1, snapshot: signals.snapshot });
    expect(toastShown(CAPTURED)).toBe(false);
    expect(isBusy('monitor-action-snapshot')).toBe(true);
    // A second press while the snapshot is out sends nothing (LB-1).
    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    await b.flush();
    expect(b.requests('takeSessionSnapshot')).toHaveLength(1);

    b.sendHeldDeltas();
    await b.flush();
    expect(b.state().session!.snapshotCount).toBe(before + 1);
    expect(feedSignals()).toEqual({ shutter: signals.shutter + 1, snapshot: signals.snapshot + 1 });
    expect(toastShown(CAPTURED)).toBe(true);
    expect(screen.getByText(`${before + 1} snapshots`)).toBeTruthy();
    expect(isBusy('monitor-action-snapshot')).toBe(false);
  });

  it('refusal: 403 (example notPermitted) → the denied toast naming the role; no flight, no counter change, no success toast; the tile idle', async () => {
    const b = await openMonitor();
    const before = b.state().session!.snapshotCount;
    const signals = feedSignals();
    b.fake.answerOnce('takeSessionSnapshot', b.fake.example('takeSessionSnapshot', 403, 'notPermitted'));
    await pressAndSettle('monitor-action-snapshot', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(DENIED_ROLE)).toBe(true);
    expect(toastShown(CAPTURED)).toBe(false);
    expect(b.state().session!.snapshotCount).toBe(before);
    expect(feedSignals().snapshot).toBe(signals.snapshot);
    expect(isBusy('monitor-action-snapshot')).toBe(false);
  });

  it('pending (LB-1): answer 1 s late — the tile busy at once, no spinner at 300 ms, the kit Spinner in place of the icon at 500 ms, gone after the answer', async () => {
    const b = await openMonitor({ answerDelayMs: 1_000 });
    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    await b.flush();
    expect(isBusy('monitor-action-snapshot')).toBe(true);
    await b.elapse(300, 100);
    expect(screen.queryByTestId('monitor-action-snapshot-spinner')).toBeNull();
    await b.elapse(200, 100);
    expect(screen.getByTestId('monitor-action-snapshot-spinner')).toBeTruthy();
    await b.elapse(600, 100);
    expect(screen.queryByTestId('monitor-action-snapshot-spinner')).toBeNull();
    expect(isBusy('monitor-action-snapshot')).toBe(false);
    expect(toastShown(CAPTURED)).toBe(true);
    expect(b.requests('takeSessionSnapshot')).toHaveLength(1);
  });

  it('outage: "Core server unreachable. Nothing was changed."; nothing captured; the tile idle; the next press sends again', async () => {
    const b = await openMonitor();
    const before = b.state().session!.snapshotCount;
    b.fake.failOnce('takeSessionSnapshot');
    await pressAndSettle('monitor-action-snapshot', b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(toastShown(CAPTURED)).toBe(false);
    expect(b.state().session!.snapshotCount).toBe(before);
    expect(isBusy('monitor-action-snapshot')).toBe(false);
    await pressAndSettle('monitor-action-snapshot', b);
    expect(b.requests('takeSessionSnapshot')).toHaveLength(2);
    expect(b.state().session!.snapshotCount).toBe(before + 1);
  });
});

describe('S2-1 Marker (operation 34) and S4-2 (the timeline tail read in `ok`)', () => {
  const LABEL = 'Suspect names the vehicle';

  async function submitMarker(b: LiveMonitorBed, label = LABEL): Promise<void> {
    fireEvent.press(screen.getByTestId('monitor-action-bookmark'));
    await b.flush();
    expect(screen.getByTestId('monitor-marker-popover')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('monitor-marker-input'), label);
    fireEvent.press(screen.getByTestId('monitor-marker-submit'));
    await b.flush();
    await b.elapse(200);
  }

  it('success: one request with the label; the toast shows the time of the Core\'s marker, read once the delta is in; the field closes', async () => {
    const b = await openMonitor();
    const markers = b.state().session!.markerCount;
    b.order = 'answer-first';
    await submitMarker(b);
    expect(b.requests('addSessionMarker')).toHaveLength(1);
    expect(b.requests('addSessionMarker')[0]?.body).toEqual({ label: LABEL });
    // Answered, delta not yet here: no toast, the field still open with its text, the button busy.
    expect(markerToastShown()).toBe(false);
    expect(screen.getByTestId('monitor-marker-popover')).toBeTruthy();
    expect(screen.getByTestId('monitor-marker-input').props.value).toBe(LABEL);
    expect(isBusy('monitor-marker-submit')).toBe(true);

    b.sendHeldDeltas();
    await b.flush();
    const node = b.state().session!.timeline.at(-1)!;
    expect(b.state().session!.markerCount).toBe(markers + 1);
    expect(node).toMatchObject({ kind: 'MARKER', label: LABEL });
    // S4-2: the toast's time is the Core's marker, not the tablet's clock at the press.
    expect(node.at).toBe(b.engine.sim.store.getState().session!.timeline.at(-1)!.at);
    expect(toastShown(`Marker added at ${timelineTime(node.at)}`)).toBe(true);
    await waitForSheetExit();
    expect(screen.queryByTestId('monitor-marker-popover')).toBeNull();
  });

  it('refusal: 403 (example notPermitted) → the denied toast; no marker toast; the field stays open with the label', async () => {
    const b = await openMonitor();
    const markers = b.state().session!.markerCount;
    b.fake.answerOnce('addSessionMarker', b.fake.example('addSessionMarker', 403, 'notPermitted'));
    await submitMarker(b);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(DENIED_ROLE)).toBe(true);
    expect(markerToastShown()).toBe(false);
    expect(b.state().session!.markerCount).toBe(markers);
    expect(screen.getByTestId('monitor-marker-popover')).toBeTruthy();
    expect(screen.getByTestId('monitor-marker-input').props.value).toBe(LABEL);
    expect(isBusy('monitor-marker-submit')).toBe(false);
  });

  it('outage: the offline toast; no marker; the field stays open with the label; a second submit goes through', async () => {
    const b = await openMonitor();
    const markers = b.state().session!.markerCount;
    b.fake.failOnce('addSessionMarker');
    await submitMarker(b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(markerToastShown()).toBe(false);
    expect(b.state().session!.markerCount).toBe(markers);
    expect(screen.getByTestId('monitor-marker-input').props.value).toBe(LABEL);
    fireEvent.press(screen.getByTestId('monitor-marker-submit'));
    await b.flush();
    await b.elapse(200);
    expect(b.requests('addSessionMarker')).toHaveLength(2);
    expect(b.state().session!.markerCount).toBe(markers + 1);
    expect(markerToastShown()).toBe(true);
  });
});

describe('S2-1 End Session (operation 26): the Dialog is busy, closes on the 202, stays on every refusal', () => {
  it('success: one stop with the trimmed reason; the Core\'s STOPPING takes the screen to /session/finalizing', async () => {
    const b = await openMonitor();
    openEndDialog();
    typeReason(`  ${REASON}  `);
    await pressAndSettle('monitor-end-confirm', b);
    expect(b.requests('stopSession')).toHaveLength(1);
    expect(b.requests('stopSession')[0]?.body).toEqual({ reason: REASON });
    expect(b.engine.sim.store.getState().session?.stopReason).toBe(REASON);
    expect(b.state().session?.state).toBe('STOPPING');
    expect(b.app.getPathname()).toBe('/session/finalizing');
  });

  it('refusal: 403 (example notPermitted) → the denied toast; the Dialog stays open with the reason; the confirm idle; still RECORDING', async () => {
    const b = await openMonitor();
    b.fake.answerOnce('stopSession', b.fake.example('stopSession', 403, 'notPermitted'));
    openEndDialog();
    typeReason(REASON);
    await pressAndSettle('monitor-end-confirm', b);
    expect(toastShown(DENIED)).toBe(true);
    expect(toastShown(DENIED_ROLE)).toBe(true);
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    expect(screen.getByTestId('monitor-end-reason').props.value).toBe(REASON);
    expect(isBusy('monitor-end-confirm')).toBe(false);
    expect(b.state().session?.state).toBe('RECORDING');
    expect(b.app.getPathname()).toBe('/session/live');
  });

  it('outage: the offline toast; the Dialog stays open with the reason (LB-6); a second confirm stops the recording', async () => {
    const b = await openMonitor();
    b.fake.failOnce('stopSession');
    openEndDialog();
    typeReason(REASON);
    await pressAndSettle('monitor-end-confirm', b);
    expect(toastShown(OFFLINE)).toBe(true);
    expect(toastShown(OFFLINE_HINT)).toBe(true);
    expect(screen.getByTestId('monitor-end-reason').props.value).toBe(REASON);
    expect(b.state().session?.state).toBe('RECORDING');
    await pressAndSettle('monitor-end-confirm', b);
    expect(b.requests('stopSession')).toHaveLength(2);
    expect(b.app.getPathname()).toBe('/session/finalizing');
  });

  it('422 INVALID_REASON (F59: the Core is the judge) → the reason field says so, no toast; editing the reason clears it', async () => {
    const b = await openMonitor();
    b.fake.answerOnce('stopSession', b.fake.example('stopSession', 422, 'invalidReason'));
    openEndDialog();
    typeReason(REASON);
    await pressAndSettle('monitor-end-confirm', b);
    expect(screen.getByTestId('monitor-end-reason-refused')).toBeTruthy();
    expect(screen.getByText('Enter a reason of at least 5 characters.')).toBeTruthy();
    expect(toastShown(OFFLINE)).toBe(false);
    expect(toastShown(DENIED)).toBe(false);
    expect(toastShown('That action could not be completed. Please try again.')).toBe(false);
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    expect(b.state().session?.state).toBe('RECORDING');
    typeReason(`${REASON}, all parties agree`);
    expect(screen.queryByTestId('monitor-end-reason-refused')).toBeNull();
    await pressAndSettle('monitor-end-confirm', b);
    expect(b.app.getPathname()).toBe('/session/finalizing');
  });

  it('409 (another console stopped the session first, Q16) → the step-79 warning "The session is no longer recording."', async () => {
    const b = await openMonitor();
    b.fake.answerOnce('stopSession', refusal(409, 'INVALID_STATE', 'Session SES-20261001-0024 is STOPPING.'));
    openEndDialog();
    typeReason(REASON);
    await pressAndSettle('monitor-end-confirm', b);
    expect(toastShown('The session is no longer recording.')).toBe(true);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(isBusy('monitor-end-confirm')).toBe(false);
  });

  it('a 429 is a limit, not an outage (LB-10): the limit toast with the seconds; no offline wording, no banner; the Dialog keeps the reason', async () => {
    const b = await openMonitor();
    b.fake.answerOnce('stopSession', rateLimited(30));
    openEndDialog();
    typeReason(REASON);
    await pressAndSettle('monitor-end-confirm', b);
    expect(toastShown('The Core server is limiting requests from this tablet')).toBe(true);
    expect(toastShown('Try again in 30 s.')).toBe(true);
    expect(toastShown(OFFLINE)).toBe(false);
    expect(screen.queryByTestId('monitor-banner-offline')).toBeNull();
    expect(screen.getByTestId('monitor-end-reason').props.value).toBe(REASON);
    expect(b.state().session?.state).toBe('RECORDING');
  });

  it('pending (LB-1; AC-C-57/58, mobile form): answer 1 s late — one request for two presses, busy at once, no spinner at 300 ms, the spinner at 500 ms; "Keep recording" disabled and the Dialog held while the stop is out', async () => {
    const b = await openMonitor({ answerDelayMs: 1_000 });
    openEndDialog();
    typeReason(REASON);
    fireEvent.press(screen.getByTestId('monitor-end-confirm'));
    fireEvent.press(screen.getByTestId('monitor-end-confirm'));
    await b.flush();
    expect(b.requests('stopSession')).toHaveLength(1);
    expect(isBusy('monitor-end-confirm')).toBe(true);
    await b.elapse(300, 100);
    expect(screen.queryByTestId('monitor-end-confirm-spinner')).toBeNull();
    expect(within(screen.getByTestId('monitor-end-confirm')).queryByText('Ending…')).toBeNull();
    await b.elapse(200, 100);
    expect(screen.getByTestId('monitor-end-confirm-spinner')).toBeTruthy();
    expect(within(screen.getByTestId('monitor-end-confirm')).getByText('Ending…')).toBeTruthy();
    // The stop has left the device: "Keep recording" is disabled and the Dialog stays until the answer (D166).
    expect(screen.getByTestId('monitor-end-keep').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('monitor-end-keep'));
    await b.flush();
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    await b.elapse(600, 100);
    expect(b.requests('stopSession')).toHaveLength(1);
    expect(b.app.getPathname()).toBe('/session/finalizing');
  });

  it('pending: an answer after 50 ms shows no spinner at any 10 ms step', async () => {
    const b = await openMonitor({ answerDelayMs: 50 });
    openEndDialog();
    typeReason(REASON);
    fireEvent.press(screen.getByTestId('monitor-end-confirm'));
    for (let step = 0; step < 8; step += 1) {
      await b.elapse(10, 10);
      expect(screen.queryByTestId('monitor-end-confirm-spinner')).toBeNull();
    }
    await b.elapse(200);
    expect(b.app.getPathname()).toBe('/session/finalizing');
  });
});
