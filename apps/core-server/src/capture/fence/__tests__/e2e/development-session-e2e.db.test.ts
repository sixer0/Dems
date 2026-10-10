// END-TO-END PROOF of blueprint row 140 (R-11; check M5-LOCAL-E2E-1 with the FAKE sources): ONE
// REAL_DEVELOPMENT session on the generated camera and the generated microphone of both slots,
// through the PRODUCT path - adapter registry of the fence -> helpers -> the BUILT capture worker
// -> the capture-session unit - started, durable, stopped, sealed, and marked development all the
// way to the evidence item.
//
// A RUNNER CHECK, NOT A SUITE TEST: it starts the built worker and the development helper program
// with GENERATED inputs, so it runs only when asked for, under the heavy-host lock and the db lock:
//
//   DEMS_DEV_SESSION_E2E=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock \
//     npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts
//
// NO CAMERA AND NO MICROPHONE IS OPENED. The selector of the throw-away database names the four
// built-in test sources only (asserted before the start, and the run stops there otherwise); this
// Mac's camera and microphone are registered by the boot from the device LIST (a listing opens
// nothing) and are never assigned; `openSources()` of the fence is read while recording and after
// the stop and must be empty both times. Loopback only: the worker listens on the Core's two
// ingest ports 127.0.0.1:8554 and 8556. The clock and the timers are the system's.
//
// The fixture directory (`.data/test-row61-row140e2e-<pid>-<n>`: generated test picture, sealed)
// is LEFT in place: this file deletes nothing under `.data/`.
//
// ── THE ATTENDED RUN (THE USER'S; NEVER AN AGENT'S) ───────────────────────────────────────────────
// The same steps with THIS MAC'S CAMERA AND MICROPHONE in slot 1 (`CAM-03`, `MIC-03`) and the test
// sources in slot 2 run ONLY when `DEMS_LOCAL_SESSION_ATTENDED=1` is set, from the Terminal app:
//
//   DEMS_LOCAL_SESSION_ATTENDED=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock \
//     npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts
//
// It opens the camera for the recording (10 s) plus the time until the first fragment is durable
// (at most 40 s) and the stop; macOS asks for the permission of the Terminal the first time. A
// camera that cannot be opened ends the run as 'blocked: user action', never as a failure. THE
// MICROPHONE IS OPENED TOO, for the same time (its helper is started when the worker accepted the
// plan; macOS asks for that permission as well). Known state D128: this microphone delivered 8/9 of
// its declared rate - the run prints the microphone warnings it saw and judges none of them. The
// recording is sealed (encrypted) below `.data/test-row61-row140local-<pid>-<n>/media/` and nowhere
// else; numbers only are printed and written to `row140-result.json` there; nothing is played.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERATORS } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../../../test/support/config';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../../../test/support/identity';
import { buildApp } from '../../../../app';
import { sessionCapture, type SessionCaptureEvent } from '../../../../capture-session';
import { provisionDevelopmentSigningKey } from '../../../../sealing';
import { realBootFixture } from '../../../boot/__tests__/support';
import { captureFenceControl } from '../../index';

const ASKED = process.env.DEMS_DEV_SESSION_E2E === '1';
/** The user's attended run with this Mac's camera and microphone. No agent sets this. */
const ATTENDED = process.env.DEMS_LOCAL_SESSION_ATTENDED === '1';
const REPOSITORY = resolve(import.meta.dirname, '../../../../../../..');
const WORKER = resolve(REPOSITORY, 'apps/capture-worker/build/capture-worker');
// The private helper copy of `npm run capture:dev-setup` (the fence refuses a package manager's FFmpeg).
const HELPER = process.env.DEMS_CAPTURE_HELPER_FFMPEG ?? resolve(REPOSITORY, '.data/helpers/ffmpeg');
const TEST_SOURCES = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'];

/** What a run expects of its sources. GENERATED: the four test sources. LOCAL: this Mac's camera and microphone in slot 1. */
const MODES = {
  GENERATED: {
    label: 'row140e2e',
    slug: 'r140_e2e',
    seconds: 6,
    assigned: TEST_SOURCES,
    kinds: ['FAKE', 'FAKE', 'FAKE', 'FAKE'],
    rows: [['MIC-PRIMARY', 'MIC-01', 'FAKE'], ['MIC-STANDBY', 'MIC-02', 'FAKE'], ['VIDEO-01', 'CAM-01', 'FAKE'], ['VIDEO-02', 'CAM-02', 'FAKE']],
    cameras: ['CAM-01', 'CAM-02'],
    onWhileRecording: [] as string[],
    tracks: ['CAM-01 FAKE', 'CAM-02 FAKE'],
    audioClasses: ['FAKE'],
  },
  LOCAL: {
    label: 'row140local',
    slug: 'r140_local_attended',
    seconds: 10,
    assigned: ['CAM-02', 'CAM-03', 'MIC-02', 'MIC-03'],
    kinds: ['FAKE', 'LOCAL_DEVICE', 'FAKE', 'LOCAL_DEVICE'],
    rows: [['MIC-PRIMARY', 'MIC-03', 'LOCAL_DEVICE'], ['MIC-STANDBY', 'MIC-02', 'FAKE'], ['VIDEO-01', 'CAM-03', 'LOCAL_DEVICE'], ['VIDEO-02', 'CAM-02', 'FAKE']],
    cameras: ['CAM-03', 'CAM-02'],
    onWhileRecording: ['CAM-03', 'MIC-03'],
    tracks: ['CAM-03 LOCAL_DEVICE', 'CAM-02 FAKE'],
    audioClasses: ['LOCAL_DEVICE', 'FAKE'],
  },
} as const;
type Mode = keyof typeof MODES;

const db = useTestDatabase({ template: 'seed' });
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

async function until<Value>(what: string, limitMs: number, read: () => Promise<Value | null> | Value | null, diagnose: () => unknown = () => null): Promise<Value> {
  for (const started = Date.now(); Date.now() - started < limitMs; ) {
    const value = await read();
    if (value !== null) return value;
    await sleep(250);
  }
  throw new Error(`not reached within ${limitMs} ms: ${what} ${JSON.stringify(diagnose())}`);
}

/** The processes whose command line holds `text` (the helper's arguments carry the session's listener address and pipe paths). Counts only. */
function processesWith(text: string): number {
  try {
    return execFileSync('/usr/bin/pgrep', ['-f', text], { encoding: 'utf8' }).trim().split('\n').filter((line) => line !== '').length;
  } catch {
    // pgrep answers status 1 for "none".
    return 0;
  }
}

/** What the one recorded session of this file showed; null until it ran. */
let seen: { micHelpersWhileRecording: number; micFaults: string[] } | null = null;

/** One development session through the product path, start to sealed item. `LOCAL` is the user's attended run. */
async function developmentSession(mode: Mode): Promise<void> {
  {
    const expected = MODES[mode];
    const fixture = realBootFixture(expected.label);
    provisionDevelopmentSigningKey({ dataDir: fixture.dataDir, now: Date.now() });
    const target = await db.another({ template: 'seed', slug: expected.slug });
    const owner = target.ownerPool();
    // No speech runtime on a test host: STT is switched off in THIS throw-away database (as rows 71b / 82b do).
    await owner.query('UPDATE public.stt_config SET enabled = false');
    if (mode === 'LOCAL') {
      // What a development Core holds once its boot registered this Mac's two devices and an operator
      // assigned them to slot 1 (the boot finds these two rows and inserts nothing; D106 (4), D74(2)).
      await owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-03', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', true, 'LOCAL_DEVICE'), ('MIC-03', 'MIC', 'AVFOUNDATION', 'MacBook Air Microphone', true, 'LOCAL_DEVICE')");
      await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-03', mic_primary_id = 'MIC-03', mic_standby_id = 'MIC-02'");
    }
    const log = captureLog();
    const app: FastifyInstance = buildApp({
      config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, captureWorkerPath: WORKER }),
      logStream: log.stream,
      errorLogFile: `${fixture.dataDir}/error.log`,
    });
    let closed = false;
    target.onCleanup(async () => {
      if (!closed) await app.close();
    });
    app.addHook('onClose', async () => {
      closed = true;
    });
    await app.ready();
    await app.readiness.boot();
    await app.capture.boot();
    const fence = captureFenceControl(app);
    expect(fence.operation).toBe('REAL_DEVELOPMENT');
    const events: SessionCaptureEvent[] = [];
    sessionCapture(app).on((event) => void events.push(event));
    const codes = (): string[] => log.lines().map((line) => String((line as { code?: unknown }).code ?? '')).filter((code) => code !== '');

    // GENERATED: NEVER A REAL DEVICE - the selector must name the four built-in test sources, and the registry must say they are kind FAKE.
    // LOCAL (attended): exactly this Mac's camera and microphone in slot 1, the test sources in slot 2.
    const state = app.engine.state();
    const assigned = [...state.captureConfig.cameras.map((camera) => camera.deviceId), ...state.captureConfig.mics.map((mic) => mic.deviceId)].sort();
    expect(assigned).toEqual(expected.assigned);
    const registry = fence.registry();
    expect(assigned.map((id) => registry?.describe(id).adapterKind)).toEqual(expected.kinds);
    expect(fence.openSources()).toEqual([]);

    const investigator = OPERATORS.find((operator) => operator.role === 'INVESTIGATOR');
    if (investigator === undefined) throw new Error('no seeded investigator');
    const signedIn = await webSignIn(app, investigator.username);
    const token = cookieValue(signedIn, app.config.sessionCookieName);
    if (signedIn.statusCode !== 200 || token === null) throw new Error(`the sign-in answered ${signedIn.statusCode}`);
    const cookie = `${app.config.sessionCookieName}=${token}`;
    const post = (url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> => app.inject({ method: 'POST', url, headers: { cookie, origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });
    const sessionOf = () => app.engine.state().session;

    await app.engine.setTabletLink('CONNECTED');
    const created = await post('/api/v1/session', { caseNumber: 'LP/2026/1009-0140', subjectType: 'SAKSI', subjectName: 'Generated Subject', investigatorId: investigator.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    expect([200, 201], created.body).toContain(created.statusCode);
    const sessionId = sessionOf()?.id ?? '';
    expect((await post(`/api/v1/session/${sessionId}/start`)).statusCode).toBe(202);
    await until('the pre-check ends', 20_000, () => (sessionOf()?.state === 'ARMED' || (sessionOf()?.state === 'PRECHECK' && sessionOf()?.precheck.completedAt !== null) ? true : null), () => sessionOf()?.precheck);
    if (sessionOf()?.state === 'PRECHECK') expect((await post(`/api/v1/session/${sessionId}/precheck/acknowledge`)).statusCode).toBe(200);

    // START.
    const started = await post(`/api/v1/session/${sessionId}/start`);
    expect(started.statusCode, started.body).toBe(200);
    expect(sessionOf()).toMatchObject({ state: 'RECORDING', captureDurable: false });
    // MR-S1: the four source rows, each with the kind of the device that feeds the slot.
    expect((await owner.query<{ slot: string; device_id: string; adapter_kind: string }>('SELECT slot, device_id, adapter_kind FROM public.session_capture_sources WHERE session_id = $1 ORDER BY slot', [sessionId])).rows.map((row) => [row.slot, row.device_id, row.adapter_kind])).toEqual(expected.rows);
    const result = (facts: Record<string, unknown>): void => {
      // Numbers, identifiers and codes only: nothing of the picture or the sound.
      writeFileSync(`${fixture.dataDir}/row140-result.json`, `${JSON.stringify({ check: 'M5-LOCAL-E2E-1', mode, sessionId, ...facts }, null, 1)}\n`);
      console.info(`[row140 e2e ${mode}] ${JSON.stringify({ sessionId, ...facts })}; left at ${fixture.dataDir.replace(REPOSITORY, '.')}`);
    };
    if (mode === 'LOCAL') {
      // A local camera that could not be opened (no permission yet, in use, not found) is the USER's to
      // act on: the run ends here as 'blocked: user action' (D89(e)), never as a failed check. The
      // session ends by itself when no camera connects, or records the test camera only.
      await until('the capture said which cameras opened', 30_000, () => (events.some((event) => event.type === 'STARTED' || event.type === 'FAILED_START') ? true : null), () => codes().slice(-12));
      const startedEvent = events.find((event) => event.type === 'STARTED');
      if (startedEvent === undefined || (startedEvent.type === 'STARTED' && startedEvent.camerasNotOpened.includes('CAM-03'))) {
        const cause = log.lines().filter((line) => (line as { code?: unknown }).code === 'CAPTURE_CAMERA_NOT_OPENED').map((line) => String(((line as { err?: { code?: unknown } }).err?.code ?? 'UNKNOWN')));
        result({ verdict: 'blocked: user action', reason: 'this Mac\'s camera could not be opened', causes: cause });
        if (sessionOf()?.state === 'RECORDING' && sessionOf()?.captureDurable === true) await post(`/api/v1/session/${sessionId}/stop`, { reason: 'Attended run blocked' });
        await sessionCapture(app).idle();
        return;
      }
    }

    // DURABLE: the built worker wrote its first fragment from the generated picture.
    await until('the first durable fragment', 40_000, () => (sessionOf()?.captureDurable === true ? true : sessionOf()?.state !== 'RECORDING' ? Promise.reject(new Error(`the session left RECORDING: ${sessionOf()?.state} ${JSON.stringify(codes().slice(-12))}`)) : null), () => codes().slice(-12));
    await sleep(expected.seconds * 1_000);
    // `STARTED` is said when every source was opened (each helper has a settle time), `DURABLE` at the first fragment: either may come first.
    expect(events[0]?.type).toBe('CONNECTING');
    expect(events.map((event) => event.type).sort()).toEqual(['CONNECTING', 'DURABLE', 'STARTED']);
    expect(events.find((event) => event.type === 'STARTED')).toMatchObject({ cameras: expected.cameras, camerasNotOpened: [] });
    // Two camera helpers push to this session's two loopback listeners. GENERATED: no local source is on. LOCAL: exactly this Mac's two.
    expect(processesWith(`rtsp://127.0.0.1:8554/${sessionId}/`) + processesWith(`rtsp://127.0.0.1:8556/${sessionId}/`)).toBe(2);
    expect([...fence.openSources()].sort()).toEqual(expected.onWhileRecording);
    seen = {
      micHelpersWhileRecording: processesWith(`${fixture.dataDir}/run/capture/${sessionId}/`),
      micFaults: app.engine.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT' || fault.kind === 'MIC_SILENT').map((fault) => `${fault.kind}@${String(fault.target)}`),
    };
    const fragments = (await owner.query<{ track_id: string; n: string }>('SELECT track_id, count(*)::text AS n FROM public.recording_fragments WHERE session_id = $1 GROUP BY track_id ORDER BY track_id', [sessionId])).rows.map((row) => `${row.track_id}:${row.n}`);
    if (mode === 'LOCAL' && !fragments.some((entry) => entry.startsWith('VIDEO-01:'))) {
      // This Mac's camera was started and delivered nothing that reached the file (the permission
      // question still open or answered "no", or the camera taken by another application): the
      // user's to act on, not a failed check. The session is stopped; whether it seals is not judged.
      result({ verdict: 'blocked: user action', reason: 'this Mac\'s camera delivered no recorded fragment', fragments, causes: codes().filter((code) => code.startsWith('CAPTURE_')).slice(-8) });
      await post(`/api/v1/session/${sessionId}/stop`, { reason: 'Attended run blocked' });
      await sessionCapture(app).idle();
      return;
    }
    expect(fragments).toHaveLength(2);

    // STOP: the worker first, then the helpers; none is left.
    const stopped = await post(`/api/v1/session/${sessionId}/stop`, { reason: 'Interview complete' });
    expect(stopped.statusCode, stopped.body).toBe(202);
    await until('the capture of the session ended', 30_000, () => (events.some((event) => event.type === 'STOPPED') ? true : null), () => ({ events: events.map((event) => event.type), codes: codes().slice(-12) }));
    await sessionCapture(app).idle();
    expect(sessionCapture(app).liveSessionId()).toBeNull();
    expect(processesWith(`/${sessionId}/`)).toBe(0);
    expect(fence.openSources()).toEqual([]);
    expect(await fence.leftoverHelpers()).toEqual([]);

    // SEALED, and the development mark reaches the item and its verification.
    await until('the session is SEALED', 120_000, () => (sessionOf()?.state === 'SEALED' ? true : null), () => ({ state: sessionOf()?.state, steps: sessionOf()?.finalization.steps.map((step) => [step.id, step.status]), codes: codes().slice(-15) }));
    const evidenceId = sessionOf()?.evidenceId ?? '';
    const item = app.engine.state().evidence.find((entry) => entry.id === evidenceId);
    expect(item).toMatchObject({ sessionId, status: 'SEALED', integritySource: 'REAL', manifestVersion: 2, developmentSources: true });
    const verified = await post(`/api/v1/evidence/${evidenceId}/verify`);
    expect(verified.statusCode, verified.body).toBe(200);
    const body = verified.json() as { ok: boolean; overall: string; sources: { code: string; development: boolean | null; tracks: { deviceId: string; sourceClass: string }[]; audioIntervals: { micDeviceId: string; sourceClass: string }[] } };
    expect(body).toMatchObject({ ok: true, overall: 'PASS', sources: { code: 'DEVELOPMENT', development: true } });
    expect(body.sources.tracks.map((track) => `${track.deviceId} ${track.sourceClass}`)).toEqual(expected.tracks);
    expect(body.sources.audioIntervals.length).toBeGreaterThanOrEqual(1);
    expect(body.sources.audioIntervals.every((interval) => (expected.audioClasses as readonly string[]).includes(interval.sourceClass))).toBe(true);
    result({ verdict: 'pass', seconds: expected.seconds, fragments, microphoneHelpersWhileRecording: seen.micHelpersWhileRecording, microphoneFaultsWhileRecording: seen.micFaults, evidenceId, developmentSources: true, verify: body.overall, sources: body.sources.tracks.map((track) => `${track.deviceId} ${track.sourceClass}`) });
  }
}

describe.skipIf(!ASKED)('row 140 end to end with the BUILT worker and GENERATED sources (no device)', () => {
  it('a development session starts, reaches durable, stops and is sealed; four FAKE source rows; no local source is ever on; the item and its verification say DEVELOPMENT', () => developmentSession('GENERATED'), 300_000);

  // Found by this row, fixed by row 71c (request of 16:28:30Z): before its line no production code started
  // a microphone helper and the built worker logged `no_mic_delivers_samples` + two `MIC_DISCONNECTED`
  // (measured in this file's first run, when this case was `it.fails`).
  it('both generated microphone helpers run while the session records, and no microphone fault is raised', () => {
    expect(seen).not.toBeNull();
    expect(seen?.micHelpersWhileRecording).toBe(2);
    expect(seen?.micFaults).toEqual([]);
  });
});

// THE USER'S ATTENDED RUN (M5-LOCAL-E2E-1 with the real devices). NOT RUN BY ANY AGENT: it opens this Mac's camera.
describe.skipIf(!ATTENDED)('row 140 ATTENDED: this Mac\'s camera and microphone in slot 1, the test sources in slot 2 (the user runs this, present at the Mac)', () => {
  it('a development session on the local devices starts, reaches durable, records 10 s, stops and is sealed with the LOCAL_DEVICE class on its camera file - or ends as "blocked: user action"', () => developmentSession('LOCAL'), 300_000);
});
