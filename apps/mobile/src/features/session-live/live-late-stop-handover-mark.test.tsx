// Blueprint row 62 (B11, RK-5; prepares M5-SW-T): wait point 4 of a late stop. When another console stops the
// recording, the REAL `/session/live` route writes one quiet `runtime.diag.lateStop.handover` record in the
// commit that draws Finalizing in place, with the device instant and the Core-clock instant of that commit.
// On the app's own Live source over the contract-checked fake transport (W68's `live-monitor-bed`).
//
// Import order: the gorhom mock, then the router harness, then the bed (see their headers).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { resetFinalizingHandoverForTests } from '@/features/session-finalizing/handover';
import { runtimeLog } from '@/runtime/log';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from './testing/live-monitor-bed';

const HANDOVER = 'runtime.diag.lateStop.handover';
let bed: LiveMonitorBed | null = null;

beforeEach(async () => {
  await resetLiveMonitorBed();
  resetFinalizingHandoverForTests();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

describe('row 62: the in-place hand-over is logged with citable instants', () => {
  it('no record while the monitor shows; exactly one after a stop pushed from another console; nothing printed', async () => {
    const printed: unknown[][] = [];
    const spies = (['info', 'warn', 'error', 'log'] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        printed.push(args);
      }),
    );
    try {
      const b = await renderLiveMonitor({ window: 'tabletLandscape' });
      bed = b;
      const before = runtimeLog.records().length;
      await b.openMonitor();
      expect(screen.getByTestId('screen-session-live')).toBeTruthy();
      const sessionId = b.state().session?.id ?? null;
      // Negative control: the recording runs on, the monitor stays, no hand-over record.
      await b.runCore(1_000);
      await b.flush();
      expect(runtimeLog.records().slice(before).filter((r) => r.source === HANDOVER)).toEqual([]);

      await b.changeOnCore((engine) => engine.sim.actions.stopRecording('Stopped on the web (row 62)'));
      await b.flush();
      await b.elapse(400);

      expect(b.app.getPathname()).toBe('/session/finalizing');
      const records = runtimeLog.records().slice(before).filter((r) => r.source === HANDOVER);
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ level: 'info' });
      const context = records[0]?.context ?? {};
      expect(context['sessionId']).toBe(sessionId);
      // Both instants are ISO strings with milliseconds; in LIVE the Core-clock one is present.
      for (const key of ['handoverAt', 'handoverAtCore'] as const) {
        expect(String(context[key])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
      expect(printed.filter((args) => JSON.stringify(args).includes(HANDOVER))).toEqual([]);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
