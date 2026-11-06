// Backend task, plan row W72: the Sessions hub in LIVE mode, on the app's real Live source over the
// contract-checked fake transport [CS:§7.3 "features/sessions", S4-5]: the rows, the pending-summary
// chip, the active card and the detail are the Core's replicated state; nothing is sent (no command, no
// read) on mount, under StrictMode or by pull-to-refresh; the refresh stamp reads the Live clock; and no
// text claims a simulation. Follow-up (decision D169, finding F-1 of the row's report): while the Core
// link is down a refresh records no "Updated" time and a notice above the rows says the list is what
// the device last received; outside LIVE neither happens.
//
// Import order: the sheet and list mocks, then the router harness, then the bed (see their headers).
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { selectSessionHistory } from '@dems/shared/sim';
import { HERO_STILL } from '@/components/media/brand-assets';
import { demoMediaForEvidence } from '@/components/media/demo-media';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import {
  CORE_ONLY_INPUT,
  SIMULATION_WORDING,
  recordCoreSession,
  renderLiveSummary,
  resetLiveSummaryBed,
  sealCoreSession,
  wordsUnder,
  type LiveSummaryBed,
  type LiveSummaryBedOptions,
  type WindowName,
} from '@/features/session-summary/testing/live-summary-bed';
import { REFRESH_MS } from './sessions-screen';
import { renderSessionsApp, settle as settleSimulated } from './testing/sessions-harness';

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

function visibleRowIds(): string[] {
  return screen
    .queryAllByTestId(/^session-row-S/)
    .map((node) => String(node.props.testID).replace('session-row-', ''))
    .filter((id, index, all) => all.indexOf(id) === index);
}

const refreshControl = () => screen.UNSAFE_getByProps({ testID: 'sessions-refresh' });

interface Hub {
  b: LiveSummaryBed;
  sessionId: string;
}

/** A session sealed on the Core (summary pending), the app signed in and on the hub. */
async function hubWithSealed(options: LiveSummaryBedOptions & { url?: string } = {}): Promise<Hub> {
  let sessionId = '';
  const b = await renderLiveSummary({
    ...options,
    setup: (engine) => {
      sessionId = sealCoreSession(engine);
    },
  });
  bed = b;
  await b.navigate(options.url ?? '/sessions');
  await b.elapse(500);
  expect(screen.getByTestId('screen-sessions')).toBeTruthy();
  return { b, sessionId };
}

describe('the hub in LIVE mode lists the Core\'s sessions', () => {
  it.each<WindowName>(['phonePortrait', 'tabletLandscape'])('%s: the Core\'s history newest first, the Core-only session on top with "Summary pending"; no simulation wording; nothing sent', async (window) => {
    const { b, sessionId } = await hubWithSealed({ window });
    const history = selectSessionHistory(b.state());
    expect(history.map((entry) => entry.id)).toEqual(selectSessionHistory(b.engine.sim.store.getState()).map((entry) => entry.id));
    expect(visibleRowIds()).toEqual(history.map((entry) => entry.id));
    expect(visibleRowIds()[0]).toBe(sessionId);
    expect(within(screen.getByTestId(`session-row-${sessionId}`)).getByText(CORE_ONLY_INPUT.subjectName)).toBeTruthy();
    expect(screen.getByTestId(`session-row-pending-${sessionId}`)).toBeTruthy();
    expect(screen.getByTestId(`session-row-status-${sessionId}`).props.accessibilityLabel).toBe('Sealed');
    expect(screen.getByTestId('sessions-count')).toHaveTextContent(`${history.length} sessions`);
    expect(wordsUnder('screen-sessions').filter((word) => SIMULATION_WORDING.test(word))).toEqual([]);
    // The link is up: no link notice (D169).
    expect(screen.queryByTestId('sessions-link-down')).toBeNull();
    expect(b.commandsSinceSignIn()).toEqual([]);
    expect(getMissingKeys()).toEqual([]);
  });

  it('phone: the pending row hands off to the Core\'s Summary; the summary is acknowledged only by its own Done', async () => {
    const { b, sessionId } = await hubWithSealed();
    fireEvent.press(screen.getByTestId(`session-row-${sessionId}`));
    await b.flush();
    await b.elapse(250);
    expect(b.app.getPathname()).toBe(`/session/summary/${sessionId}`);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(0);
    fireEvent.press(screen.getByTestId('summary-done'));
    await b.flush();
    await b.elapse(250);
    expect(b.requests('acknowledgeSessionSummary')).toHaveLength(1);
    expect(b.state().lastSealedAcknowledged).toBe(true);
  });

  it('tablet: the detail pane of the Core-only session shows the Core\'s case, subject, investigator and evidence ID', async () => {
    const { b, sessionId } = await hubWithSealed({ window: 'tabletLandscape' });
    await b.navigate(`/sessions?selected=${sessionId}`);
    const pane = within(screen.getByTestId('pane-detail'));
    expect(pane.getByTestId('session-detail-id')).toHaveTextContent(sessionId);
    expect(within(pane.getByTestId('session-detail-case')).getByText(CORE_ONLY_INPUT.caseNumber)).toBeTruthy();
    expect(within(pane.getByTestId('session-detail-subject')).getByText(CORE_ONLY_INPUT.subjectName)).toBeTruthy();
    expect(within(pane.getByTestId('session-detail-investigator')).getByText('AKP Budi Santoso')).toBeTruthy();
    expect(within(pane.getByTestId('session-detail-evidence')).getByText(b.state().session!.evidenceId!)).toBeTruthy();
    expect(pane.getByTestId('session-detail-pending')).toBeTruthy();
    expect(wordsUnder('pane-detail').filter((word) => SIMULATION_WORDING.test(word))).toEqual([]);
    expect(b.commandsSinceSignIn()).toEqual([]);
  });

  it('posters: a session recorded on the Core shows the room still; a row of the Core\'s seeded dataset keeps that package\'s own poster (RESIDUAL-W66-1, W83 ledger #41: the history carries no media reference)', async () => {
    const { b, sessionId } = await hubWithSealed();
    const coreOnly = b.state().sessionHistory.find((entry) => entry.id === sessionId)!;
    expect(screen.UNSAFE_getByProps({ recyclingKey: sessionId }).props.source).toBe(HERO_STILL);
    expect(coreOnly.evidenceId).not.toBeNull();
    // The Core's evidence counter continues after the seeded dataset (13 packages), so a recording made
    // on the Core never matches a bundled package by its number.
    expect(demoMediaForEvidence(coreOnly.evidenceId!.slice(-4))).toBeUndefined();
    const seeded = selectSessionHistory(b.state()).find((entry) => entry.evidenceId !== null && demoMediaForEvidence(entry.evidenceId.slice(-4)) !== undefined)!;
    expect(screen.UNSAFE_getByProps({ recyclingKey: seeded.id }).props.source).toBe(demoMediaForEvidence(seeded.evidenceId!.slice(-4))!.poster['VIDEO-01']);
  });
});

describe('the active card follows the Core', () => {
  it('a recording on the Core: the card shows its ID and the time on the Live clock; the Core\'s stop turns it to finalization; nothing sent', async () => {
    let sessionId = '';
    const b = await renderLiveSummary({
      setup: (engine) => {
        sessionId = recordCoreSession(engine, 12_000);
      },
    });
    bed = b;
    await b.navigate('/sessions');
    expect(screen.getByTestId('sessions-active-id')).toHaveTextContent(sessionId);
    expect(screen.getByTestId('sessions-active-rec')).toBeTruthy();
    const startedAt = b.state().session!.startedAt!;
    const elapsed = () => Math.floor((b.state().clock.now - startedAt) / 1_000);
    expect(elapsed()).toBeGreaterThanOrEqual(12);
    const timerBefore = String(screen.getByTestId('sessions-active-timer').props.accessibilityLabel);
    await b.elapse(3_000);
    expect(String(screen.getByTestId('sessions-active-timer').props.accessibilityLabel)).not.toBe(timerBefore);
    await b.coreDo((engine) => engine.sim.actions.stopRecording('Interview completed'));
    // STOPPING: the card turns to finalization at once (the Core's delta) ...
    expect(b.state().session?.state).toBe('STOPPING');
    expect(screen.queryByTestId('sessions-active-rec')).toBeNull();
    expect(within(screen.getByTestId('sessions-active-action')).getByText('Open finalization')).toBeTruthy();
    // ... and at the Core's FINALIZING the route sync opens Finalization (§3.7 trigger 3), as in Simulated mode.
    await b.elapse(2_000);
    expect(b.state().session?.state).toBe('FINALIZING');
    expect(b.app.getPathname()).toBe('/session/finalizing');
    expect(b.commandsSinceSignIn()).toEqual([]);
  });
});

describe('S4-5: the refresh stamp reads the Live clock (no change)', () => {
  it('success: pull-to-refresh lasts REFRESH_MS on the Live clock, stamps that time, and sends nothing', async () => {
    const { b } = await hubWithSealed();
    const from = b.state().clock.now;
    act(() => refreshControl().props.onRefresh());
    await b.flush();
    expect(refreshControl().props.refreshing).toBe(true);
    await b.elapse(REFRESH_MS - 200, 100);
    expect(refreshControl().props.refreshing).toBe(true);
    await b.elapse(400, 100);
    expect(refreshControl().props.refreshing).toBe(false);
    // The stamp is the press time on the Live clock plus REFRESH_MS (the Core's time, not the wall clock).
    const pressedAt = b.state().clock.now;
    expect(pressedAt).toBeGreaterThanOrEqual(from);
    expect(screen.getByTestId('sessions-count')).toHaveTextContent(new RegExp(`· Updated ${formatDate(from + REFRESH_MS, DATE_PATTERNS.time)}$`));
    expect(b.commandsSinceSignIn()).toEqual([]);
  });

  it('outage (D169): with the link down a refresh records no "Updated" time (the stamp from before the outage stays); the rows keep the last replica; the Core\'s newer session arrives with the link, without a refresh; nothing is sent', async () => {
    const { b, sessionId } = await hubWithSealed();
    // A refresh while the link is up stamps the Live clock.
    const before = b.state().clock.now;
    act(() => refreshControl().props.onRefresh());
    await b.flush();
    await b.elapse(REFRESH_MS + 200, 100);
    const stampBefore = `Updated ${formatDate(before + REFRESH_MS, DATE_PATTERNS.time)}`;
    expect(screen.getByTestId('sessions-count')).toHaveTextContent(new RegExp(`· ${stampBefore}$`));
    // Another console acknowledges the summary: the hub follows the Core's delta (the chip goes).
    await b.coreDo((engine) => engine.sim.actions.acknowledgeSummary(sessionId));
    expect(screen.queryByTestId(`session-row-pending-${sessionId}`)).toBeNull();
    b.setReachable(false);
    await b.elapse(1_000);
    // While this device is away the Core records, seals and (another console) acknowledges one more
    // session, so no summary waits and no route resync is due when the link comes back.
    await b.coreDo((engine) => {
      const next = sealCoreSession(engine, 8_000, { ...CORE_ONLY_INPUT, caseNumber: 'LP/2026/1006-0473', subjectName: 'Sari Core Lestari' });
      engine.sim.actions.acknowledgeSummary(next);
    });
    await b.elapse(2_000, 500);
    const pressedAt = b.state().clock.now;
    act(() => refreshControl().props.onRefresh());
    await b.flush();
    await b.elapse(REFRESH_MS + 200, 100);
    expect(refreshControl().props.refreshing).toBe(false);
    // Nothing was received: the stamp is still the one from before the outage, not the press time.
    expect(screen.getByTestId('sessions-count')).toHaveTextContent(new RegExp(`· ${stampBefore}$`));
    expect(screen.getByTestId('sessions-count')).not.toHaveTextContent(`Updated ${formatDate(pressedAt + REFRESH_MS, DATE_PATTERNS.time)}`);
    expect(visibleRowIds()[0]).toBe(sessionId);
    expect(screen.queryByText('Sari Core Lestari')).toBeNull();
    const requestsWhileDown = b.fake.log.operationIds().length;
    b.setReachable(true);
    for (let i = 0; i < 30 && screen.queryByText('Sari Core Lestari') === null; i += 1) await b.elapse(500, 250);
    expect(b.app.getPathname()).toBe('/sessions');
    expect(screen.getByText('Sari Core Lestari')).toBeTruthy();
    expect(visibleRowIds()[1]).toBe(sessionId);
    // Only the reconnect's own housekeeping went out (the session check of the new socket); no command.
    expect(b.fake.log.operationIds().slice(requestsWhileDown).filter((id) => id !== 'getAuthSession' && id !== 'touchSession')).toEqual([]);
    expect(b.commandsSinceSignIn()).toEqual([]);
  });

  it('the link notice (D169): above the rows while the Core link is down, through the reconnect attempts; gone at the first heartbeat; a refresh then stamps again', async () => {
    const { b, sessionId } = await hubWithSealed();
    // No summary waits across the outage, so the reconnect's route resync (§3.7 trigger 2) keeps the hub.
    await b.coreDo((engine) => engine.sim.actions.acknowledgeSummary(sessionId));
    expect(screen.queryByTestId('sessions-link-down')).toBeNull();
    b.setReachable(false);
    await b.elapse(1_000);
    const notice = screen.getByTestId('sessions-link-down');
    expect(within(notice).getByText('Core server unreachable')).toBeTruthy();
    expect(within(notice).getByText('This list is what this device last received from the Core server. It updates by itself once the connection is back.')).toBeTruthy();
    // It stays while the socket keeps trying (no flicker), the rows stay usable.
    for (let i = 0; i < 6; i += 1) {
      await b.elapse(500, 250);
      expect(screen.getByTestId('sessions-link-down')).toBeTruthy();
    }
    expect(visibleRowIds().length).toBeGreaterThan(0);
    b.setReachable(true);
    for (let i = 0; i < 30 && screen.queryByTestId('sessions-link-down') !== null; i += 1) await b.elapse(500, 250);
    expect(screen.queryByTestId('sessions-link-down')).toBeNull();
    expect(b.app.getPathname()).toBe('/sessions');
    const from = b.state().clock.now;
    act(() => refreshControl().props.onRefresh());
    await b.flush();
    await b.elapse(REFRESH_MS + 200, 100);
    expect(screen.getByTestId('sessions-count')).toHaveTextContent(new RegExp(`· Updated ${formatDate(from + REFRESH_MS, DATE_PATTERNS.time)}$`));
    expect(wordsUnder('screen-sessions').filter((word) => SIMULATION_WORDING.test(word))).toEqual([]);
    expect(getMissingKeys()).toEqual([]);
  });

  it('Simulated mode (D169): no link notice and the refresh stamps as before', async () => {
    const h = renderSessionsApp();
    await settleSimulated();
    expect(screen.getByTestId('screen-sessions')).toBeTruthy();
    expect(screen.queryByTestId('sessions-link-down')).toBeNull();
    act(() => refreshControl().props.onRefresh());
    await settleSimulated();
    act(() => h.advance(REFRESH_MS + 100));
    await settleSimulated();
    expect(screen.getByTestId('sessions-count')).toHaveTextContent(/Updated \d\d:\d\d:\d\d$/);
    expect(screen.queryByTestId('sessions-link-down')).toBeNull();
  });
});

describe('StrictMode (decision D158): the hub starts nothing on mount', () => {
  it('opening the hub and its detail under StrictMode, and a refresh, send nothing', async () => {
    let id = '';
    const b = await renderLiveSummary({
      strict: true,
      window: 'tabletLandscape',
      setup: (engine) => {
        id = sealCoreSession(engine);
      },
    });
    bed = b;
    const sessionId = id;
    await b.navigate(`/sessions?selected=${sessionId}`);
    await b.elapse(500);
    act(() => refreshControl().props.onRefresh());
    await b.elapse(REFRESH_MS + 300, 100);
    expect(within(screen.getByTestId('pane-detail')).getByTestId('session-detail-id')).toHaveTextContent(sessionId);
    expect(b.commandsSinceSignIn()).toEqual([]);
  });
});
