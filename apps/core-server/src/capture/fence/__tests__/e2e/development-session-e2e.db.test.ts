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
//
// ── THE SPEECH RUN (fix wave H, driver E; ruling D198 on gate 81, condition C1) ───────────────────
// The GENERATED run with `DEMS_CAPTURE_DEV_FAKE_MIC=speech` and STT ENABLED on `cpu-local`: the
// first test microphone plays the speech fixture of `npm run capture:dev-setup` (synthetic speech
// made on this machine, copied into the throw-away data directory of the run), the REAL speech
// engine of this host decodes the session on the CPU, and the session seals with a transcript that
// HAS SEGMENTS. Still no device. It runs only when asked for, alone, under both locks, and needs
// the fixture, the built worker, the helper copy and the engine files under `.cache/stt/`:
//
//   DEMS_DEV_SPEECH_SESSION_E2E=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock \
//     npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts
//
// It uses the Core's two ingest ports 127.0.0.1:8554 and 8556: NOT while another real-capture Core
// (a lane) is up. No duration, speed or rate of the engine is measured, printed or written (D230).
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERATORS } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../../../test/support/config';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../../../test/support/identity';
import { buildApp } from '../../../../app';
import { sessionCapture, type SessionCaptureEvent } from '../../../../capture-session';
import { sessionPackageDir } from '../../../../evidence-verify';
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
/** The speech run (fix wave H). No agent run of a lane-holding host: see the header. */
const SPEECH_ASKED = process.env.DEMS_DEV_SPEECH_SESSION_E2E === '1';
/** What `npm run capture:dev-setup` writes: synthetic speech and its reference text. */
const SPEECH_FIXTURE_DIR = resolve(REPOSITORY, '.data/dev-fixtures/speech-mic');
/** The speech engine files of this host (rows 107-110, 77), as `.data/transcriber/host.json` of a development Core names them. */
const STT_ENGINE = {
  binaryPath: resolve(REPOSITORY, '.cache/stt/whisper.cpp/build/bin/whisper-cli'),
  vadBinaryPath: resolve(REPOSITORY, '.cache/stt/whisper.cpp/build/bin/whisper-vad-speech-segments'),
  modelDir: resolve(REPOSITORY, '.cache/stt/models'),
  model: 'ggml-large-v3-turbo',
  modelVersion: 'large-v3-turbo',
  vadModel: 'ggml-silero-v6.2.0',
};

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
  // The GENERATED run with the speech microphone and STT enabled (fix wave H): long enough for several sentences of the fixture.
  SPEECH: {
    label: 'wavehspeech',
    slug: 'wave_h_speech_e2e',
    seconds: 30,
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

/**
 * The command lines of the processes that hold `text` (the helper's arguments carry the session's listener address and
 * pipe paths; the speech engine's carry the session's scratch folder). Command lines only, the process id removed and the
 * repository root shown as `.`: what a failed "none is left" assertion prints, so the survivor is named (pass H-Y).
 */
function commandLinesWith(text: string): string[] {
  try {
    return execFileSync('/usr/bin/pgrep', ['-fl', text], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.replace(/^\d+\s+/, '').replaceAll(REPOSITORY, '.').trim())
      .filter((line) => line !== '');
  } catch {
    // pgrep answers status 1 for "none".
    return [];
  }
}

/** How many processes hold `text` in their command line. */
function processesWith(text: string): number {
  return commandLinesWith(text).length;
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
    if (mode === 'SPEECH') {
      // The speech run: STT ON, on the CPU engine of this host. The fixture is copied into the data
      // directory of THIS run (owner-only), and the host file names the engine files.
      await owner.query('UPDATE public.stt_config SET enabled = true');
      expect((await owner.query<{ backend: string; model: string; enabled: boolean }>('SELECT backend, model, enabled FROM public.stt_config')).rows).toEqual([{ backend: 'cpu-local', model: STT_ENGINE.model, enabled: true }]);
      for (const folder of [`${fixture.dataDir}/dev-fixtures`, `${fixture.dataDir}/dev-fixtures/speech-mic`, `${fixture.dataDir}/transcriber`]) {
        mkdirSync(folder, { recursive: true, mode: 0o700 });
        chmodSync(folder, 0o700);
      }
      copyFileSync(`${SPEECH_FIXTURE_DIR}/dialogue.wav`, `${fixture.dataDir}/dev-fixtures/speech-mic/dialogue.wav`);
      chmodSync(`${fixture.dataDir}/dev-fixtures/speech-mic/dialogue.wav`, 0o600);
      writeFileSync(
        `${fixture.dataDir}/transcriber/host.json`,
        `${JSON.stringify({ version: 1, cpuLocal: { binaryPath: STT_ENGINE.binaryPath, modelDir: STT_ENGINE.modelDir, modelVersions: { [STT_ENGINE.model]: STT_ENGINE.modelVersion } }, vad: { binaryPath: STT_ENGINE.vadBinaryPath, modelDir: STT_ENGINE.modelDir, model: STT_ENGINE.vadModel } })}\n`,
        { mode: 0o600 },
      );
    } else {
      // No speech runtime on a test host: STT is switched off in THIS throw-away database (as rows 71b / 82b do).
      await owner.query('UPDATE public.stt_config SET enabled = false');
    }
    if (mode === 'LOCAL') {
      // What a development Core holds once its boot registered this Mac's two devices and an operator
      // assigned them to slot 1 (the boot finds these two rows and inserts nothing; D106 (4), D74(2)).
      await owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-03', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', true, 'LOCAL_DEVICE'), ('MIC-03', 'MIC', 'AVFOUNDATION', 'MacBook Air Microphone', true, 'LOCAL_DEVICE')");
      await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-03', mic_primary_id = 'MIC-03', mic_standby_id = 'MIC-02'");
    }
    const log = captureLog();
    const app: FastifyInstance = buildApp({
      config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, captureWorkerPath: WORKER, ...(mode === 'SPEECH' ? { captureDevFakeMic: 'speech' as const } : {}) }),
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
    // The speech run: the fence vouched for the fixture and said so once; every other run plays the tones.
    expect(fence.outcome()?.fakeMic.source).toBe(mode === 'SPEECH' ? 'SPEECH' : 'TONE');
    expect(log.lines().filter((line) => (line as { code?: unknown }).code === 'DEV_FAKE_MIC_SPEECH')).toHaveLength(mode === 'SPEECH' ? 1 : 0);
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
    /** The speech run: the audio source of every chunk the transcriber planned, as its checkpoint named it while it existed (the scratch is removed at the seal). */
    const chunkSources = new Map<number, string | null>();
    /** Whether a chunk was being decoded, or had been, while the session still RECORDED (the engine beside the capture: `M6-DF-1`). A fact, not asserted: a short recording may end first. */
    let decodeSeenWhileRecording = false;
    const readChunkSources = (): void => {
      try {
        const checkpoint = JSON.parse(readFileSync(`${fixture.mediaStoreDir}/.transcriber/sessions/${sessionId}/transcript-checkpoint.json`, 'utf8')) as { chunks?: { chunkIndex: number; audioSource: string | null; status: string }[] };
        for (const chunk of checkpoint.chunks ?? []) chunkSources.set(chunk.chunkIndex, chunk.audioSource);
        if (sessionOf()?.state === 'RECORDING' && (checkpoint.chunks ?? []).some((chunk) => chunk.status === 'RUNNING' || chunk.status === 'DONE')) decodeSeenWhileRecording = true;
      } catch {
        // Not there yet, being replaced, or already removed: the next read sees it.
      }
    };
    for (let second = 0; second < expected.seconds; second += 1) {
      await sleep(1_000);
      if (mode === 'SPEECH') readChunkSources();
    }
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

    // STOP: the worker first, then the helpers; no CAPTURE process is left.
    const stopped = await post(`/api/v1/session/${sessionId}/stop`, { reason: 'Interview complete' });
    expect(stopped.statusCode, stopped.body).toBe(202);
    await until('the capture of the session ended', 30_000, () => (events.some((event) => event.type === 'STOPPED') ? true : null), () => ({ events: events.map((event) => event.type), codes: codes().slice(-12) }));
    await sessionCapture(app).idle();
    expect(sessionCapture(app).liveSessionId()).toBeNull();
    // Pass H-Y (checkpoint wave H, red A6): the speech ENGINE is not a capture process. It decodes beside the capture and the
    // transcript step of the seal waits for it (transcript spec section A.5 "Sealing interaction", D223; `specs` E.5), so in the
    // speech run a decode of THIS session's scratch may still run at this instant - and only that. Everything else that names
    // the session (worker, camera helper, microphone helper - the looping fixture one too) must be gone now; the engine must
    // be gone once the seal completed (asserted below, with the scratch).
    const scratchDir = `${fixture.mediaStoreDir}/.transcriber/sessions/${sessionId}`;
    const shown = (path: string): string => path.replaceAll(REPOSITORY, '.');
    const isEngineOfThisSession = (line: string): boolean => mode === 'SPEECH' && line.includes(`${shown(scratchDir)}/`) && [STT_ENGINE.binaryPath, STT_ENGINE.vadBinaryPath].some((program) => line.includes(shown(program)));
    const namedAfterStop = commandLinesWith(`/${sessionId}/`);
    expect(namedAfterStop.filter((line) => !isEngineOfThisSession(line))).toEqual([]);
    expect(commandLinesWith(`rtsp://127.0.0.1:8554/${sessionId}/`).concat(commandLinesWith(`rtsp://127.0.0.1:8556/${sessionId}/`), commandLinesWith(`${fixture.dataDir}/run/capture/${sessionId}/`))).toEqual([]);
    expect(commandLinesWith('dev-fixtures/speech-mic/dialogue.wav').filter((line) => line.includes(shown(fixture.dataDir)))).toEqual([]);
    const engineProcessesAfterStop = namedAfterStop.length;
    expect(fence.openSources()).toEqual([]);
    expect(await fence.leftoverHelpers()).toEqual([]);

    // SEALED, and the development mark reaches the item and its verification.
    // The speech run waits for the transcript step, which decodes on the CPU: its bound is the step's own, not a figure of the engine.
    await until('the session is SEALED', mode === 'SPEECH' ? 1_500_000 : 120_000, () => (mode === 'SPEECH' ? readChunkSources() : undefined, sessionOf()?.state === 'SEALED' ? true : null), () => ({ state: sessionOf()?.state, steps: sessionOf()?.finalization.steps.map((step) => [step.id, step.status]), codes: codes().slice(-15) }));
    // The seal's close-out: the outcome was handled (the scratch of the session is discarded there, R80-04). From here NO
    // process names the session - the engine included - and the session's transcriber scratch is gone.
    await until('the seal reported its outcome', 10_000, () => (codes().includes('SEALING_COMPLETE') ? true : null), () => codes().slice(-15));
    expect(commandLinesWith(`/${sessionId}/`)).toEqual([]);
    expect(existsSync(scratchDir)).toBe(false);
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
    if (mode === 'SPEECH') {
      // THE TRANSCRIPT OF A PRODUCT SESSION WITH SPEECH (gate 81 condition C1; `M6-TF-1` on `cpu-local`).
      const document = JSON.parse(readFileSync(`${sessionPackageDir(app.config.mediaStoreDir, sessionId)}/transcript/transcript.json`, 'utf8')) as {
        header: { backend: string; language: string; state: string; chunks: number; failed_chunks: number; model: { id: string; name: string | null; version: string | null; quantisation: string | null; sha256: string | null } };
        segments: { index: number; start_ms: number; end_ms: number; text: string }[];
        intervals: { source: string; from_ms: number; to_ms: number | null }[];
        qa_flags: string[];
      };
      // State ASSEMBLED in the sealed document; on the ITEM the summary says it in the slice's word, `READY` (the one map
      // `SLICE_STATE` of `sealing/finalize-transcript/commit.ts`: manifest ASSEMBLED -> READY, every chunk committed). Nothing failed.
      // Pass H-Y: this line asked the item for the manifest's word when the case first ran to here; the item was right.
      expect(item?.transcript).toMatchObject({ state: 'READY', revision: 0, backendUnreachable: false });
      expect(item?.transcript?.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(document.header).toMatchObject({ backend: 'cpu-local', language: 'id', state: 'ASSEMBLED', failed_chunks: 0 });
      // Chunks were planned and segments came back: the engine transcribed this session.
      expect(document.header.chunks).toBeGreaterThan(0);
      expect(document.segments.length).toBeGreaterThan(0);
      for (const segment of document.segments) {
        expect(segment.end_ms).toBeGreaterThan(segment.start_ms);
        expect(segment.text.trim()).not.toBe('');
      }
      expect(document.qa_flags).not.toContain('no_speech');
      // Each chunk carries its audio source: the flag of a chunk without one is absent, the intervals name the primary
      // test microphone, and every chunk the checkpoint showed while it existed named that microphone.
      expect(document.qa_flags).not.toContain('intervals_incomplete');
      expect(document.intervals.length).toBeGreaterThanOrEqual(1);
      expect([...new Set(document.intervals.map((interval) => interval.source))]).toEqual(['MIC-01']);
      expect(chunkSources.size).toBeGreaterThan(0);
      expect([...new Set(chunkSources.values())]).toEqual(['MIC-01']);
      // Model provenance complete for `cpu-local`: name, the declared version, the quantisation and the hash of the model file.
      expect(document.header.model).toMatchObject({ id: STT_ENGINE.model, name: STT_ENGINE.model, version: STT_ENGINE.modelVersion });
      expect(document.header.model.quantisation).toEqual(expect.any(String));
      expect(document.header.model.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect((verified.json() as { transcriptState?: unknown }).transcriptState).toMatchObject({ code: 'READY', sealedState: 'ASSEMBLED', documentSealed: true, failedChunks: 0 });
      // `M6-DF-1` in this session: the fragments of both camera files are numbered without a gap and without a repeat.
      const numbered = (await owner.query<{ track_id: string; seq: number }>('SELECT track_id, seq FROM public.recording_fragments WHERE session_id = $1 ORDER BY track_id, seq', [sessionId])).rows;
      for (const track of ['VIDEO-01', 'VIDEO-02']) {
        const seqs = numbered.filter((row) => row.track_id === track).map((row) => Number(row.seq));
        expect(seqs.length, track).toBeGreaterThan(0);
        expect(seqs, track).toEqual(seqs.map((_, index) => (seqs[0] ?? 0) + index));
      }
      expect(app.engine.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT').map((fault) => String(fault.target))).toEqual([]);
      // The transcript operation answers the sealed segments.
      const read = await app.inject({ method: 'GET', url: `/api/v1/evidence/${evidenceId}/transcript`, headers: { cookie, origin: WEB_ORIGIN } });
      expect(read.statusCode, read.body).toBe(200);
      expect((read.json() as { segments: unknown[] }).segments).toHaveLength(document.segments.length);
      // The words against the reference text of the fixture: which heard words the reference does not hold. A list, never a rate.
      const wordsOf = (text: string): string[] => text.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter((word) => word !== '');
      const reference = new Set(wordsOf((JSON.parse(readFileSync(`${SPEECH_FIXTURE_DIR}/dialogue.reference.json`, 'utf8')) as { text: string }).text));
      const heard = document.segments.flatMap((segment) => wordsOf(segment.text));
      result({ verdict: 'pass', check: 'M6-TF-1 cpu-local in a product session (speech microphone)', fragments, evidenceId, transcriptState: { item: item?.transcript?.state, sealedDocument: document.header.state, verify: (verified.json() as { transcriptState?: { code?: unknown; sealedState?: unknown } }).transcriptState }, failedChunks: document.header.failed_chunks, chunks: document.header.chunks, segments: document.segments.length, chunkSourcesSeen: Object.fromEntries(chunkSources), decodeSeenWhileRecording, fragmentSeqContiguous: true, qaFlags: document.qa_flags, model: document.header.model, heardWords: heard.length, heardWordsNotInReference: heard.filter((word) => !reference.has(word)), referenceWordsNotHeard: [...reference].filter((word) => !heard.includes(word)), engineProcessesAfterStop, processesOfSessionAfterSeal: 0, transcriberScratchGone: true, intervalSources: [...new Set(document.intervals.map((interval) => interval.source))], verify: body.overall });
      return;
    }
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

// THE SPEECH RUN (fix wave H; gate 81 condition C1). Skipped unless asked for AND the fixture and the engine files are there.
describe.skipIf(!SPEECH_ASKED || !existsSync(`${SPEECH_FIXTURE_DIR}/dialogue.wav`) || !existsSync(STT_ENGINE.binaryPath))('wave H: a development session on the SPEECH microphone with STT enabled on cpu-local (no device)', () => {
  it('seals ASSEMBLED with segments > 0, chunks > 0 that each name the primary test microphone, and complete model provenance; verify PASS', () => developmentSession('SPEECH'), 1_800_000);
});

// THE USER'S ATTENDED RUN (M5-LOCAL-E2E-1 with the real devices). NOT RUN BY ANY AGENT: it opens this Mac's camera.
describe.skipIf(!ATTENDED)('row 140 ATTENDED: this Mac\'s camera and microphone in slot 1, the test sources in slot 2 (the user runs this, present at the Mac)', () => {
  it('a development session on the local devices starts, reaches durable, records 10 s, stops and is sealed with the LOCAL_DEVICE class on its camera file - or ends as "blocked: user action"', () => developmentSession('LOCAL'), 300_000);
});
