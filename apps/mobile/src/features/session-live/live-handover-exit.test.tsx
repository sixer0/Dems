// Closing-fix row CF-M1, defect R-P-1 (High; re-test round, decision D213/D214).
//
// On dems2_phone a stop made on the web while the phone showed the monitor ended, in 1 of 2 runs, in the
// native red screen `addViewAt: failed to insert view [22216] into parent [20378] at index 1`, preceded by
// `Tried to remove view [21688] of parent [20372] at index 0, but got view tag 19014`
// (`test/assets/retest/p_phone/68_p4_device_log_app_process_1303_1304.txt`): Fabric and the native view
// tree disagreed about the children of the monitor's own root (20372) and of the screen's content wrapper
// (20378) while the Finalizing hand-over removed the monitor. Reanimated's layout-animation proxy keeps a
// view with an `exiting` animation alive after React removed it and shifts the indices of the next mount
// instructions around that ghost; the link banner ("Resynced", with its FadeOut) was on screen.
//
// Jest has no Fabric mounting layer, so the crash itself is the device proof's (CF-M1 report §1). What is
// held here is the structure that takes Reanimated's ghosts out of the hand-over:
// - the monitor sits under `LayoutAnimationConfig skipExiting` with a non-collapsable host view, and that
//   wrapper is what the hand-over unmounts (so Reanimated is told, before the commit, to run no exiting
//   animation below it: `setShouldAnimateExiting` on unmount);
// - the link banner has no `exiting` animation, and it lives in a container of its own;
// - the hand-over still draws the Finalizing card in the commit that drops the monitor, with the banner
//   on screen right before it (the device picture).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StyleSheet, type ViewStyle } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import type { ReactTestInstance } from 'react-test-renderer';
import { resetFinalizingHandoverForTests } from '@/features/session-finalizing/handover';
import { motionStore, resetMotionStateForTests } from '@/motion';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from './testing/live-monitor-bed';

let bed: LiveMonitorBed | null = null;

beforeEach(async () => {
  await resetLiveMonitorBed();
  resetFinalizingHandoverForTests();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
  resetMotionStateForTests();
});

/** The composite `LayoutAnimationConfig` elements above a node. */
function configsAbove(node: ReactTestInstance): ReactTestInstance[] {
  const found: ReactTestInstance[] = [];
  for (let current: ReactTestInstance | null = node.parent; current; current = current.parent) {
    if (current.type === LayoutAnimationConfig) found.push(current);
  }
  return found;
}

/** Every element below `root` that declares an `exiting` animation. */
function exitingBelow(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll((node) => node.props?.exiting !== undefined && node.props?.exiting !== null, { deep: true });
}

/** Opens the monitor, then makes the link drop and come back so "Resynced" is on screen (the device picture before the crash). */
async function monitorWithResyncedBanner(): Promise<LiveMonitorBed> {
  const b = await renderLiveMonitor({ window: 'phonePortrait' });
  bed = b;
  await b.openMonitor();
  b.setReachable(false);
  await b.flush();
  await b.elapse(1_000, 250);
  expect(screen.getByTestId('monitor-banner-offline')).toBeTruthy();
  b.setReachable(true);
  await b.elapse(1_500, 250);
  expect(screen.getByTestId('monitor-banner-resynced')).toBeTruthy();
  return b;
}

describe('R-P-1: the Finalizing hand-over removes the monitor with no exiting animation below it', () => {
  it('the monitor is under LayoutAnimationConfig skipExiting, whose single child is a host view that is never flattened', async () => {
    const b = await renderLiveMonitor({ window: 'phonePortrait' });
    bed = b;
    await b.openMonitor();
    const monitor = screen.getByTestId('screen-session-live');
    const configs = configsAbove(monitor);
    expect(configs.filter((config) => config.props.skipExiting === true)).toHaveLength(1);
    const boundary = screen.getByTestId('session-live-exit-boundary');
    expect(boundary.props.collapsable).toBe(false);
    expect(configsAbove(boundary)[0]?.props.skipExiting).toBe(true);
    expect(configs[0]!.props.children.props.testID).toBe('session-live-exit-boundary');
  });

  it('the banner has no exiting animation (offline and resynced) and sits in a container of its own that Fabric never flattens', async () => {
    await monitorWithResyncedBanner();
    const banner = screen.getByTestId('monitor-banner-resynced');
    const slot = screen.getByTestId('monitor-banner-slot');
    expect(slot.props.collapsable).toBe(false);
    expect(exitingBelow(slot)).toEqual([]);
    let node: ReactTestInstance | null = banner;
    while (node && node !== slot) {
      expect(node.props?.exiting).toBeUndefined();
      node = node.parent;
    }
  });

  it.each([
    ['reduced motion (the device launch)', true],
    ['full motion', false],
  ])('a web stop while "Resynced" shows: the skipExiting wrapper is what unmounts, before the Finalizing card is drawn in its place (%s)', async (_label, reduced) => {
    motionStore.getState().setOsReduceMotion(reduced);
    const unmounts: { skipExiting: unknown; bannerOnScreen: boolean; exitingInMonitor: number }[] = [];
    const real = LayoutAnimationConfig.prototype.setShouldAnimateExiting;
    jest.spyOn(LayoutAnimationConfig.prototype, 'setShouldAnimateExiting').mockImplementation(function (this: LayoutAnimationConfig) {
      const monitor = screen.queryByTestId('screen-session-live');
      unmounts.push({
        skipExiting: this.props.skipExiting,
        bannerOnScreen: screen.queryByTestId('monitor-banner-resynced') !== null,
        exitingInMonitor: monitor ? exitingBelow(monitor).length : -1,
      });
      real.call(this);
    });
    const b = await monitorWithResyncedBanner();
    await b.changeOnCore((engine) => engine.sim.actions.stopRecording('Stopped on the web (R-P-1)'));
    await b.flush();
    await b.elapse(400);
    expect(b.state().session?.state).toBe('STOPPING');
    expect(screen.queryByTestId('screen-session-live')).toBeNull();
    expect(screen.queryAllByTestId('finalizing-card').length + screen.queryAllByTestId('screen-session-finalizing').length).toBeGreaterThan(0);
    // The wrapper told Reanimated to skip exiting while the banner (and, in full motion, the feed's
    // exiting cross-fade) was still in the monitor it removed.
    expect(unmounts.length).toBe(1);
    expect(unmounts[0]!.skipExiting).toBe(true);
    expect(unmounts[0]!.bannerOnScreen).toBe(true);
  });
});

describe('the monitor file keeps the banner out of Reanimated\'s exiting bookkeeping (static, with negative controls)', () => {
  const read = (relative: string) => readFileSync(join(__dirname, relative), 'utf8');
  const bannerHasExiting = (source: string) => /\bexiting=\{/.test(source);
  it('connection-banner.tsx declares no exiting animation; the check sees one when it is there', () => {
    const source = read('connection-banner.tsx');
    expect(bannerHasExiting(source)).toBe(false);
    expect(bannerHasExiting(source.replace('accessibilityLiveRegion=', 'exiting={FadeOut} accessibilityLiveRegion='))).toBe(true);
  });
  it('the flatten-safe style helper sees an overflow clip (sanity of the readers above)', () => {
    expect(((StyleSheet.flatten([{ overflow: 'hidden' }]) ?? {}) as ViewStyle).overflow).toBe('hidden');
  });
});
