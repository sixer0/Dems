// The source-facts feed without a database (integration pass D11): the list handed to the engine's
// fact door, and the feed's own rules - never in SIMULATED, the whole list at each change, a
// failed hand-over is logged and persisted and never thrown. The wiring to a booted Core (boot
// step, the slice the clients read) is held on PostgreSQL in `source-class.db.test.ts`; "is on"
// through a session on scripted helpers in `capture/fence/__tests__/development-session.db.test.ts`.
import { DEFAULT_SEED, applyCaptureSourceFactsTransition, createIdleState, type CaptureSourceFact } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import { captureFenceControl } from '../../../capture/fence';
import { SOURCE_FACTS_NOT_APPLIED, captureSourceFacts, sourceFactsOf } from '../index';

const registered = [
  { id: 'CAM-01', deviceClass: 'CAMERA', adapterKind: 'FAKE' },
  { id: 'CAM-03', deviceClass: 'CAMERA', adapterKind: 'LOCAL_DEVICE' },
  { id: 'MIC-01', deviceClass: 'MIC', adapterKind: 'FAKE' },
  { id: 'POE-SWITCH', deviceClass: 'POE', adapterKind: 'FAKE' },
];

describe('sourceFactsOf: the list for the fact door', () => {
  it('every CAMERA and MIC of the registry with its adapter kind and whether it is open; a switch is no source; an open device the registry does not list is still said open', () => {
    expect(sourceFactsOf(registered, ['CAM-03', 'MIC-09'])).toEqual([
      { deviceId: 'CAM-01', adapter: 'FAKE', open: false },
      { deviceId: 'CAM-03', adapter: 'LOCAL_DEVICE', open: true },
      { deviceId: 'MIC-01', adapter: 'FAKE', open: false },
      { deviceId: 'MIC-09', open: true },
    ]);
  });

  it('an empty registry (REAL_PRODUCTION of this phase) gives no class to anything: a built-in device stays as its row says', () => {
    const state = createIdleState({ now: Date.UTC(2026, 9, 1, 3, 0, 0), seed: DEFAULT_SEED });
    expect(applyCaptureSourceFactsTransition(state, sourceFactsOf([], []))).toBe(state);
    // CONTROL: the same state with the development registry does gain the class on a built-in camera, and "is on" where it is open.
    const marked = applyCaptureSourceFactsTransition(state, sourceFactsOf(registered, ['CAM-01']));
    expect(marked.captureDevices.devices.find((device) => device.id === 'CAM-01')).toMatchObject({ adapter: 'FAKE', sourceClass: 'DEVELOPMENT', sourceOpen: true });
    expect(marked.captureDevices.devices.find((device) => device.id === 'CAM-02')?.adapter).toBeUndefined();
    // Every close path hands in the list again with nothing open: the member is removed, the class stays.
    const closed = applyCaptureSourceFactsTransition(marked, sourceFactsOf(registered, []));
    expect(closed.captureDevices.devices.find((device) => device.id === 'CAM-01')).toMatchObject({ adapter: 'FAKE', sourceClass: 'DEVELOPMENT' });
    expect(closed.captureDevices.devices.find((device) => device.id === 'CAM-01')?.sourceOpen).toBeUndefined();
  });
});

describe('the feed of an app', () => {
  /** A real app (no database, never booted) whose engine seam holds a recording fact door. */
  async function feedOf(captureMode: 'simulated' | 'real', door: (facts: readonly CaptureSourceFact[]) => Promise<unknown>) {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ captureMode, logLevel: 'error' }), logStream: log.stream });
    await app.ready();
    const entries: Array<{ code?: string | undefined; level: string }> = [];
    const append = app.errorLog.append.bind(app.errorLog);
    app.errorLog.append = (entry) => {
      entries.push({ code: entry.code, level: entry.level });
      return append(entry);
    };
    const engine = { running: true, applyStorageVolume: async () => ({ value: false }), noteTranscriptRevision: async () => ({ value: false }), applyCaptureSourceFacts: door };
    app.seams.replace('engine', engine as never);
    return { app, log, entries, engine, feed: captureSourceFacts(app) };
  }

  it('SIMULATED: the door is never called, whatever the ports say (D91 R-2, the D131 pin)', async () => {
    const taken: CaptureSourceFact[][] = [];
    const { app, feed } = await feedOf('simulated', async (facts) => void taken.push([...facts]));
    expect(captureFenceControl(app).operation).toBe('SIMULATED');
    feed.replace({ registered: () => registered, openSources: () => ['CAM-03'] });
    await feed.changed('TEST');
    expect(taken).toEqual([]);
    await app.close();
  });

  it('a real capture operation: each change hands in the WHOLE list of that moment - open after an open, not open after the close; a hand-over that fails is logged and persisted and never thrown', async () => {
    const taken: CaptureSourceFact[][] = [];
    let fail = false;
    const { app, feed, entries, log, engine } = await feedOf('real', async (facts) => {
      if (fail) throw new Error('the unit did not commit');
      taken.push([...facts]);
      return { value: true };
    });
    // CONTROL of the case above: the same call does reach the door when the operation is real.
    expect(captureFenceControl(app).operation).not.toBe('SIMULATED');
    let open: string[] = [];
    feed.replace({ registered: () => registered, openSources: () => open });
    await feed.changed('BOOT');
    open = ['CAM-03'];
    await feed.changed('OPEN_SOURCES_CHANGED');
    open = [];
    await feed.changed('STOPPED');
    expect(taken.map((facts) => facts.filter((fact) => fact.open).map((fact) => fact.deviceId))).toEqual([[], ['CAM-03'], []]);
    expect(taken.every((facts) => facts.length === 3)).toBe(true);

    // A stopped engine (a shutdown closes the sources after it) is handed nothing, and that is no failure.
    engine.running = false;
    open = ['CAM-03'];
    await feed.changed('OPEN_SOURCES_CHANGED');
    expect(taken).toHaveLength(3);
    expect(entries).toEqual([]);
    engine.running = true;

    fail = true;
    await expect(feed.changed('STARTED')).resolves.toBeUndefined();
    expect(entries).toEqual([{ code: SOURCE_FACTS_NOT_APPLIED, level: 'error' }]);
    expect(log.lines().filter((line) => line['code'] === SOURCE_FACTS_NOT_APPLIED)).toHaveLength(1);
    await app.close();
  });
});
