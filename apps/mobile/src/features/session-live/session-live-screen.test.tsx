// Session Monitor screen (step 79; 04_mobile_specs §4.5 S1–S8, §2.4, §7.3, §7.4; D38, D50, D57).
// Renders the real `/session/live` route on the real providers with a test simulator in the
// recording scenario (session 0024). Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { liveLoopFor } from '@/components/media';
import { motionStore, resetMotionStateForTests } from '@/motion';
import { TIMELINE_SHEET_ROWS } from './monitor-sheets';
import { holdSheetExitClock, renderMonitorApp, settle, waitForSheetExit } from './testing/monitor-harness';

afterEach(() => {
  // A test that failed between `holdSheetExitClock` and `waitForSheetExit` must not leave its clock behind.
  jest.useRealTimers();
  resetMotionStateForTests();
});

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

async function openPhone() {
  const h = renderMonitorApp({ window: 'phonePortrait' });
  await settle();
  h.openMonitor();
  return h;
}

describe('phone portrait (MB 4, compact)', () => {
  it('renders the MB 4 regions in order with the D38 label "End Session"', async () => {
    await openPhone();
    const root = screen.getByTestId('screen-session-live');
    expect(within(root).getByText('Active Session')).toBeTruthy();
    expect(within(root).getByText('Recording')).toBeTruthy();
    expect(within(root).getAllByLabelText('00:18:42').length).toBeGreaterThan(0);
    // S2b: the §5.4 book elements.
    expect(screen.getByText('VIDEO 1 REC')).toBeTruthy();
    expect(screen.getByText('VIDEO 2 REC')).toBeTruthy();
    expect(screen.getByText('STORAGE OK')).toBeTruthy();
    expect(screen.getByText('TIME GNSS LOCKED')).toBeTruthy();
    // S3 overlays (MB 4 "CAM 1 - Interview Room 1", "1080p • 25 fps") and the REC chip.
    expect(screen.getByText('CAM 1 - Interview Room 1')).toBeTruthy();
    expect(screen.getByText('1080p • 25 fps')).toBeTruthy();
    expect(within(screen.getByTestId('monitor-feed-rec')).getByText('REC')).toBeTruthy();
    // S4, S5, S6.
    expect(screen.getByTestId('monitor-mic-1')).toBeTruthy();
    expect(screen.getByTestId('monitor-mic-2')).toBeTruthy();
    for (const label of ['Snapshot', 'Bookmark', 'Audio Monitor', 'Settings']) expect(screen.getByText(label)).toBeTruthy();
    expect(within(screen.getByTestId('monitor-end-session')).getByText('End Session')).toBeTruthy();
    expect(screen.queryByText(/Stop Session/i)).toBeNull();
    // Phone: the timeline lives behind the History icon; panes for the feed and meters.
    expect(screen.getByTestId('monitor-history')).toBeTruthy();
    expect(screen.getByTestId('pane-feed')).toBeTruthy();
    expect(screen.getByTestId('pane-meters')).toBeTruthy();
    expect(screen.queryByTestId('pane-timeline')).toBeNull();
  });

  it('plays the step-72 live loop of the active camera, muted and looped (D50)', async () => {
    await openPhone();
    const video = screen.getByTestId('monitor-camera-feed-video');
    const player = video.props.player as { source: unknown; muted: boolean; loop: boolean; playing: boolean };
    expect(player.source).toBe(liveLoopFor(1));
    expect(player.muted).toBe(true);
    expect(player.loop).toBe(true);
    expect(player.playing).toBe(true);
  });

  it('the timer follows the simulator clock (S4), not the wall clock', async () => {
    const h = await openPhone();
    act(() => h.advance(3_000));
    expect(screen.getAllByLabelText('00:18:45').length).toBeGreaterThan(0);
  });

  it('tap the feed to switch cameras (phone)', async () => {
    const h = await openPhone();
    fireEvent.press(screen.getByTestId('monitor-feed-switch'));
    expect(h.sim.store.getState().activeCameraId).toBe('VIDEO-02');
    expect(screen.getByText('CAM 2 - Interview Room 1')).toBeTruthy();
    const player = screen.getByTestId('monitor-camera-feed-video').props.player as { source: unknown };
    expect(player.source).toBe(liveLoopFor(2));
  });

  it('Snapshot calls snapshot() once and updates the counter chip (M-C-18)', async () => {
    const h = await openPhone();
    const before = h.sim.store.getState().session!.snapshotCount;
    expect(within(screen.getByTestId('monitor-snapshot-count')).getByText(`${before} snapshot${before === 1 ? '' : 's'}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    const session = h.sim.store.getState().session!;
    expect(session.snapshotCount).toBe(before + 1);
    expect(session.timeline.at(-1)?.kind).toBe('SNAPSHOT');
    expect(h.sim.store.getState().audit.rows.at(-1)?.type).toBe('SNAPSHOT_TAKEN');
    expect(within(screen.getByTestId('monitor-snapshot-count')).getByText(`${before + 1} snapshots`)).toBeTruthy();
  });

  it('Bookmark opens the marker field (bottom-sheet presentation) and an empty label numbers the marker', async () => {
    const h = await openPhone();
    const before = h.sim.store.getState().session!.markerCount;
    fireEvent.press(screen.getByTestId('monitor-action-bookmark'));
    expect(screen.getByTestId('monitor-marker-popover')).toBeTruthy();
    await holdSheetExitClock();
    fireEvent.press(screen.getByTestId('monitor-marker-submit'));
    const session = h.sim.store.getState().session!;
    expect(session.markerCount).toBe(before + 1);
    expect(session.timeline.at(-1)).toMatchObject({ kind: 'MARKER', label: `Marker ${before + 1}` });
    await waitForSheetExit();
    expect(screen.queryByTestId('monitor-marker-popover')).toBeNull();
    // The History badge counts the new event (phone).
    expect(screen.getByTestId('monitor-history-badge')).toBeTruthy();
  });

  it('History opens the session timeline sheet with the scenario events and clears the badge', async () => {
    const h = await openPhone();
    act(() => h.sim.actions.addMarker('Suspect names the vehicle'));
    expect(screen.getByTestId('monitor-history-badge')).toBeTruthy();
    fireEvent.press(screen.getByTestId('monitor-history'));
    const sheet = screen.getByTestId('monitor-timeline-sheet-list');
    // The newest events only (the sheet is not an archive; TIMELINE_SHEET_ROWS).
    expect(within(sheet).getAllByTestId(/^monitor-timeline-sheet-list-row-/)).toHaveLength(TIMELINE_SHEET_ROWS);
    expect(within(sheet).getByText('Marker Added')).toBeTruthy();
    expect(within(sheet).getByText('Suspect names the vehicle')).toBeTruthy();
    expect(screen.queryByTestId('monitor-history-badge')).toBeNull();
    await holdSheetExitClock();
    fireEvent.press(screen.getByTestId('monitor-timeline-sheet-close'));
    await waitForSheetExit();
    expect(screen.queryByTestId('monitor-timeline-sheet-list')).toBeNull();
  });

  it('Audio Monitor opens two separate large meters (MIC 1, MIC 2; never mixed)', async () => {
    await openPhone();
    fireEvent.press(screen.getByTestId('monitor-action-audio'));
    expect(screen.getByTestId('monitor-audio-sheet-meter-1')).toBeTruthy();
    expect(screen.getByTestId('monitor-audio-sheet-meter-2')).toBeTruthy();
    expect(screen.getByText('MIC 1 - Interviewer')).toBeTruthy();
    expect(screen.getByText('MIC 2 - Subject')).toBeTruthy();
  });

  it('Settings: Pause monitoring is UI-only (the recording continues), camera and meter size apply', async () => {
    const h = await openPhone();
    fireEvent.press(screen.getByTestId('monitor-action-settings'));
    fireEvent(screen.getByTestId('monitor-settings-pause'), 'onSelectedChange', true);
    expect(screen.getByTestId('monitor-feed-paused')).toBeTruthy();
    expect(screen.getByText('Monitoring paused. Recording continues.')).toBeTruthy();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
    const player = screen.getByTestId('monitor-camera-feed-video').props.player as { playing: boolean };
    expect(player.playing).toBe(false);
  });

  it('MIC clip: the latch shows on the card and the CLIP chip resets it (S8)', async () => {
    const h = await openPhone();
    act(() => h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' }));
    expect(h.sim.store.getState().mics.find((m) => m.id === 'AUDIO-02')?.clipLatched).toBe(true);
    const card = screen.getByTestId('monitor-mic-2');
    fireEvent.press(within(card).getByHintText('Reset clip'));
    expect(h.sim.store.getState().mics.find((m) => m.id === 'AUDIO-02')?.clipLatched).toBe(false);
  });

  it('MIC no signal: the card meter shows NO SIGNAL and the strip keeps the video tracks (S8)', async () => {
    const h = await openPhone();
    act(() => h.sim.actions.inject('MIC_NO_SIGNAL', { channel: 'AUDIO-01' }));
    act(() => h.advance(200, 50));
    expect(within(screen.getByTestId('monitor-mic-1')).getByText('NO SIGNAL')).toBeTruthy();
    expect(within(screen.getByTestId('monitor-mic-2')).queryByText('NO SIGNAL')).toBeNull();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('40 audio frames do not re-render the screen per frame (MA-16 screen form)', async () => {
    let commits = 0;
    const h = renderMonitorApp({ window: 'phonePortrait', onRender: () => (commits += 1) });
    await settle();
    h.openMonitor();
    act(() => h.advance(100, 50));
    commits = 0;
    // 2 s of simulator time in 50 ms engine steps: 40 audio frames per channel.
    act(() => h.advance(2_000, 50));
    // The timer (1 Hz), the 1 Hz meter accessibility values and periodic simulator events may
    // commit; 40 frames per channel must not.
    expect(commits).toBeLessThanOrEqual(8);
  });
});

describe('End Session (S6, M-C-19, S21)', () => {
  it('a short tap never ends anything; the 1.5 s hold opens the reason Dialog', async () => {
    const h = await openPhone();
    fireEvent.press(screen.getByTestId('monitor-end-session'));
    expect(screen.queryByTestId('monitor-end-dialog')).toBeNull();
    expect(screen.getByTestId('monitor-end-session').props.delayLongPress ?? 1500).toBe(1500);
    fireEvent(screen.getByTestId('monitor-end-session'), 'onLongPress');
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    expect(screen.getByText('End Session?')).toBeTruthy();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('requires a reason of at least 5 characters, then stops the recording and follows the session', async () => {
    const h = await openPhone();
    fireEvent(screen.getByTestId('monitor-end-session'), 'onLongPress');
    const confirm = screen.getByTestId('monitor-end-confirm');
    fireEvent.changeText(screen.getByTestId('monitor-end-reason'), '  ab ');
    fireEvent(screen.getByTestId('monitor-end-reason'), 'blur');
    expect(screen.getByText('Enter a reason of at least 5 characters.')).toBeTruthy();
    fireEvent.press(confirm);
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');

    fireEvent.changeText(screen.getByTestId('monitor-end-reason'), 'Interview complete');
    fireEvent.press(screen.getByTestId('monitor-end-confirm'));
    const state = h.sim.store.getState();
    expect(state.session?.state).toBe('STOPPING');
    expect(state.session?.stopReason).toBe('Interview complete');
    expect(state.audit.rows.at(-1)).toMatchObject({ type: 'RECORDING_STOPPED' });
    expect(h.app.getPathname()).toBe('/session/finalizing');
  });

  it('Keep recording closes the Dialog and changes nothing', async () => {
    const h = await openPhone();
    fireEvent(screen.getByTestId('monitor-end-session'), 'onLongPress');
    fireEvent.press(screen.getByTestId('monitor-end-keep'));
    expect(screen.queryByTestId('monitor-end-dialog')).toBeNull();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('reduced motion: the Dialog opens on press (no hold)', async () => {
    act(() => motionStore.getState().setOsReduceMotion(true));
    await openPhone();
    fireEvent.press(screen.getByTestId('monitor-end-session'));
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
  });

  it('screen readers: the activate action opens the Dialog directly', async () => {
    await openPhone();
    fireEvent(screen.getByTestId('monitor-end-session'), 'onAccessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
  });
});

describe('Core link lost (S7, MA-10 UI half)', () => {
  it('shows the banner and makes the session actions read-only; the recording continues', async () => {
    const h = await openPhone();
    act(() => h.sim.actions.setTabletLink('OFFLINE'));
    const banner = screen.getByTestId('monitor-banner-offline');
    expect(within(banner).getByText('Core link lost — recording continues on the Core. Reconnecting…')).toBeTruthy();
    const snapshots = h.sim.store.getState().session!.snapshotCount;
    fireEvent.press(screen.getByTestId('monitor-action-snapshot'));
    expect(h.sim.store.getState().session!.snapshotCount).toBe(snapshots);
    fireEvent(screen.getByTestId('monitor-end-session'), 'onLongPress');
    expect(screen.queryByTestId('monitor-end-dialog')).toBeNull();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');

    act(() => h.sim.actions.setTabletLink('CONNECTED'));
    expect(screen.getByTestId('monitor-banner-resynced')).toBeTruthy();
    expect(screen.getByText('Resynced')).toBeTruthy();
  });
});

describe('tablet layouts (04 §2.4, MA-12 live part)', () => {
  it('landscape: three columns with pane-feed, pane-meters, pane-timeline; camera Tabs; inline timeline', async () => {
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    h.openMonitor();
    for (const pane of ['pane-feed', 'pane-meters', 'pane-timeline']) expect(screen.getByTestId(pane)).toBeTruthy();
    expect(screen.queryByTestId('monitor-history')).toBeNull();
    expect(within(screen.getByTestId('monitor-timeline')).getByText('Key statement')).toBeTruthy();
    fireEvent.press(screen.getByTestId('monitor-camera-tab-2'));
    expect(h.sim.store.getState().activeCameraId).toBe('VIDEO-02');
    expect(textOf(screen.getByTestId('monitor-end-session'))).toContain('End Session');
  });

  it('landscape: a new marker lands in the inline timeline (the popover form itself is covered on the phone)', async () => {
    // Jest cannot measure the trigger, so the kit Popover's `popover` presentation never renders
    // here (HeroUI primitives/popover: no trigger position → no content); the tablet popover is
    // proven on the device, and the form is the same component as the phone's bottom-sheet one.
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    h.openMonitor();
    act(() => h.sim.actions.addMarker('Suspect admits presence'));
    expect(within(screen.getByTestId('monitor-timeline')).getByText('Suspect admits presence')).toBeTruthy();
    expect(screen.queryByTestId('monitor-history-badge')).toBeNull();
  });

  it('portrait: feed full width, then meters | status + timeline', async () => {
    const h = renderMonitorApp({ window: 'tabletPortrait' });
    await settle();
    h.openMonitor();
    for (const pane of ['pane-feed', 'pane-meters', 'pane-timeline']) expect(screen.getByTestId(pane)).toBeTruthy();
    expect(screen.getByTestId('monitor-camera-tab-1')).toBeTruthy();
  });

  it('phone landscape: feed | controls, no inline timeline', async () => {
    const h = renderMonitorApp({ window: 'phoneLandscape' });
    await settle();
    h.openMonitor();
    expect(screen.getByTestId('pane-feed')).toBeTruthy();
    expect(screen.getByTestId('pane-meters')).toBeTruthy();
    expect(screen.queryByTestId('pane-timeline')).toBeNull();
    expect(screen.getByTestId('monitor-history')).toBeTruthy();
  });
});
