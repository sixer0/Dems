/**
 * The development camera stub of a lane Core (fix wave H, driver D; gate 70 finding B-1; decision
 * D196; test strategy CR-5; capture spec §A.6.1 DS-15; SEC35-27 (6); not a test file).
 *
 * WHAT IT IS. The one supported way to give a RUNNING lane's Core a camera to search, test and
 * add: the fake ONVIF device of `fake-onvif-stub.ts` on 127.0.0.1, ephemeral ports, one fixture
 * account made at each start. The Core's own discovery adapter is built around the stub's
 * loopback target and handed in through `captureDiscoveryControl(app).provideAdapter(...)` - the
 * seam every database test of the search uses. The connection test and the adoption are the
 * product's own code, unchanged: they reach the stub because the candidate's address IS the stub.
 *
 * WHO MAY USE IT. The capture fence decides (`developmentDiscoveryAdmissionOf`):
 *   REAL_DEVELOPMENT   admitted;
 *   REAL_PRODUCTION    refused, `DEV_CAMERA_STUB_IN_PRODUCTION`: `prepare` throws and the launcher
 *                      (`lane-camera-stub-cli.ts`) does not start the Core;
 *   SIMULATED          ignored, and said so: nothing is started, the Core runs as it would without.
 * No file under `src/` imports this file or names the stub's target (static rules CPB1-12, G-R9):
 * the product's entry point `src/index.ts` cannot load it, with any flag or variable.
 *
 * NO NETWORK. With the factory provided, EVERY search of that Core - operation 93 and the one
 * search of a pre-check - is built here: the product's own factory (the WS-Discovery group) is
 * never used on that process (`provided ?? own` in `modules/capture-discovery/index.ts`). The
 * adapter binds 127.0.0.1 and sends its probes to the stub's port only; `ws-discovery.ts` refuses
 * any other unicast target. So a stub lane sends no multicast and no datagram to the real LAN.
 *
 * N = 1 (decision D126). Every device of the stub answers from the one address 127.0.0.1, and the
 * product lists a host that carries more than one endpoint reference as a conflict, not testable.
 * A second testable device needs a second loopback address, which this host cannot bind without
 * root. So the stub of a lane has ONE device.
 *
 * THE FIXTURE ACCOUNT is a fixture of a fake device, not a secret: two random words made at each
 * start, written to the fixture file (owner-only) so that `lane.sh` can print them for the person
 * or the gate that types them into the connect dialog. They are never written to the Core's log.
 *
 * PRESETS. What the stub answers can be changed while a client is driven, by writing ONE word to
 * the mode file (`lane.sh` prints its path): see `LaneCameraStubPreset`.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, rmSync, unwatchFile, watchFile, writeFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { createSystemTimers } from '../../src/capture';
import { createOnvifDiscoveryAdapter } from '../../src/capture/adapters';
import { DevelopmentDiscoveryIgnored, captureOperationDecisionOf, developmentDiscoveryAdmissionOf, type DevelopmentDiscoveryAdmission } from '../../src/capture/fence';
import { captureDiscoveryControl } from '../../src/modules/capture-discovery';
import { describeError } from '../../src/plugins/logger';
import { createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifCredential, type FakeOnvifStub } from './fake-onvif-stub';

/** The check the launcher names when the fence refuses the stub (the `check` of its final log line). */
export const LANE_CAMERA_STUB_CHECK = 'capture.cameraStub';
/** How many devices the stub of a lane has. One: see the header. */
export const LANE_CAMERA_STUB_DEVICES = 1;
/** How often the mode file is read for a change. */
export const LANE_CAMERA_STUB_MODE_POLL_MS = 500;
const SOURCE = 'laneCameraStub';

/**
 * What the stub answers. One word in the mode file; anything else is ignored (and logged).
 *
 *   NORMAL        a search lists the camera. A test with the fixture account: REACHABLE; with any
 *                 other account: AUTHENTICATION_FAILED (the camera refused it); Add as camera works
 *   AUTH_SCHEME   the camera accepts only a sign-in the Core does not answer: AUTHENTICATION_FAILED
 *                 with reason SCHEME_NOT_ALLOWED - the credential is NOT sent
 *   UNREACHABLE   the camera's service port is closed: UNREACHABLE
 *   NO_PROFILE    the camera lists no profile: WRONG_PROFILE
 *   NOT_H264      the camera has an H.265 profile only: NOT_H264
 *   EMPTY         no device answers a search: an empty search (the no-device notice)
 */
export const LaneCameraStubPreset = {
  NORMAL: 'NORMAL',
  AUTH_SCHEME: 'AUTH_SCHEME',
  UNREACHABLE: 'UNREACHABLE',
  NO_PROFILE: 'NO_PROFILE',
  NOT_H264: 'NOT_H264',
  EMPTY: 'EMPTY',
} as const;
export type LaneCameraStubPreset = (typeof LaneCameraStubPreset)[keyof typeof LaneCameraStubPreset];

/** The preset a mode file names: its first word, upper case. Null for anything that is no preset. */
export function laneCameraStubPresetOf(text: string): LaneCameraStubPreset | null {
  const word = text.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  return (Object.values(LaneCameraStubPreset) as string[]).includes(word) ? (word as LaneCameraStubPreset) : null;
}

/** A fixture account of one start: two words a person can type. Never a default of the product (C-N15). */
export function newLaneFixtureAccount(): FakeOnvifCredential {
  return { username: `stub${randomBytes(3).toString('hex')}`, secret: `fx${randomBytes(6).toString('hex')}` };
}

export interface LaneCameraStubOptions {
  /** Where the fixture account is written for `lane.sh` to print (owner-only). Null: nowhere. */
  readonly fixtureFile?: string | null;
  /** The file whose first word selects the preset while the Core runs. Null: no file is watched. */
  readonly modeFile?: string | null;
  /** The fixture account of this start. Default: `newLaneFixtureAccount()`. */
  readonly account?: FakeOnvifCredential;
}

export interface LaneCameraStub {
  /** What the fence answered. */
  readonly admission: DevelopmentDiscoveryAdmission;
  /** The running stub; null when the fence did not admit it. */
  readonly stub: FakeOnvifStub | null;
  /** The fixture account of the stub; null when the fence did not admit it. */
  readonly account: FakeOnvifCredential | null;
  /** Hands the discovery adapter to the Core. Call ONCE, after `app.ready()`. Does nothing when the stub was not admitted. */
  announce(): void;
  /** The preset in force. */
  preset(): LaneCameraStubPreset;
  /** Switches the stub. Resolves when it answers as the preset says. */
  apply(preset: LaneCameraStubPreset): Promise<void>;
  /** Stops the stub and the watch, removes the fixture file. Also run by the app's `onClose`. */
  stop(): Promise<void>;
}

const IGNORED_TEXT: Readonly<Record<DevelopmentDiscoveryIgnored, string>> = Object.freeze({
  NOT_REQUESTED: 'the camera stub was not asked for',
  SIMULATED_HAS_NO_SEARCH: 'the camera stub is ignored: this Core runs SIMULATED capture, which has no camera search. Start a development lane (capture operation REAL_DEVELOPMENT) to use it',
  CAPTURE_FENCE_REFUSES_BOOT: 'the camera stub is ignored: the capture fence refuses this configuration and stops the start',
});

/**
 * Asks the fence, and for an admitted stub starts it and registers its shutdown. Call BEFORE
 * `app.ready()`; a production configuration makes it throw `DevelopmentDiscoveryError` before
 * anything is started or bound.
 */
export async function prepareLaneCameraStub(app: FastifyInstance, options: LaneCameraStubOptions = {}): Promise<LaneCameraStub> {
  const fixtureFile = options.fixtureFile ?? null;
  const modeFile = options.modeFile ?? null;
  // A fixture file of an earlier run names an account that opens nothing any more: it goes before the decision.
  if (fixtureFile !== null) rmSync(fixtureFile, { force: true });

  // THE FENCE DECIDES (throws for REAL_PRODUCTION).
  const admission = developmentDiscoveryAdmissionOf(captureOperationDecisionOf(app.config), true);
  if (!admission.admitted) {
    app.log.warn({ code: 'LANE_CAMERA_STUB_IGNORED', source: SOURCE, operation: admission.operation, reason: admission.ignored }, IGNORED_TEXT[admission.ignored]);
    return { admission, stub: null, account: null, announce: () => undefined, preset: () => LaneCameraStubPreset.NORMAL, apply: async () => undefined, stop: async () => undefined };
  }

  const account = options.account ?? newLaneFixtureAccount();
  const ports = await freeFakeOnvifPorts();
  const stub = createFakeOnvifStub({ ports, credential: account, devices: LANE_CAMERA_STUB_DEVICES });
  await stub.start();

  let preset: LaneCameraStubPreset = LaneCameraStubPreset.NORMAL;
  let announced = false;
  let stopped = false;
  /** One switch at a time: a second word written while a listener closes waits for it. */
  let switching: Promise<void> = Promise.resolve();

  const apply = (next: LaneCameraStubPreset): Promise<void> => {
    switching = switching.then(async () => {
      if (stopped) return;
      stub.setDiscoveryMode(next === LaneCameraStubPreset.EMPTY ? 'SILENT' : 'NORMAL');
      stub.setDeviceMode(next === LaneCameraStubPreset.AUTH_SCHEME ? 'BASIC_ONLY' : next === LaneCameraStubPreset.NO_PROFILE ? 'NO_PROFILE' : next === LaneCameraStubPreset.NOT_H264 ? 'H265_ONLY' : 'NORMAL');
      if (next === LaneCameraStubPreset.UNREACHABLE) await stub.closeDeviceListener();
      else await stub.openDeviceListener();
      preset = next;
      app.log.info({ code: 'LANE_CAMERA_STUB_PRESET', source: SOURCE, preset: next }, 'the camera stub answers as the preset says');
    });
    return switching;
  };

  /** A failure of a switch or of a read of the mode file: the stub keeps what it answered, and the team finds the line tomorrow. */
  const failed = (code: string, message: string, error: unknown): void => {
    app.log.error({ err: error, code, source: SOURCE }, message);
    app.errorLog.append({ level: 'error', source: SOURCE, message, ...describeError(error), code, context: { preset } });
  };

  const readMode = (): void => {
    if (modeFile === null || stopped) return;
    let text: string;
    try {
      text = readFileSync(modeFile, 'utf8');
    } catch (error) {
      failed('LANE_CAMERA_STUB_MODE_UNREADABLE', 'the mode file of the camera stub could not be read: the stub keeps its preset', error);
      return;
    }
    const wanted = laneCameraStubPresetOf(text);
    if (wanted === null) {
      app.log.warn({ code: 'LANE_CAMERA_STUB_MODE_UNKNOWN', source: SOURCE, presets: Object.values(LaneCameraStubPreset).join(',') }, 'the mode file of the camera stub names no preset: the stub keeps its preset');
      return;
    }
    if (wanted === preset) return;
    apply(wanted).catch((error: unknown) => failed('LANE_CAMERA_STUB_SWITCH_FAILED', 'the camera stub could not switch its preset', error));
  };

  // The files of this start. The account is a fixture of a fake device; it is still owner-only and never logged.
  if (fixtureFile !== null) writeFileSync(fixtureFile, `username=${account.username}\nsecret=${account.secret}\n`, { mode: 0o600 });
  if (modeFile !== null) {
    writeFileSync(modeFile, `${LaneCameraStubPreset.NORMAL}\n`, { mode: 0o600 });
    watchFile(modeFile, { interval: LANE_CAMERA_STUB_MODE_POLL_MS, persistent: false }, readMode);
  }

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    if (modeFile !== null) unwatchFile(modeFile, readMode);
    await switching.catch(() => undefined);
    await stub.stop();
    if (fixtureFile !== null) rmSync(fixtureFile, { force: true });
  };
  app.addHook('onClose', stop);

  app.log.info(
    // Ports and counts only: the account is in the fixture file, never here.
    { code: 'LANE_CAMERA_STUB_STARTED', source: SOURCE, operation: admission.operation, devices: LANE_CAMERA_STUB_DEVICES, bound: stub.addresses().bound.map((entry) => `${entry.listener}:${entry.address}:${String(entry.port)}`).join(',') },
    'the camera stub listens on loopback: every camera search of this Core goes to it and to nothing else',
  );

  return {
    admission,
    stub,
    account,
    announce() {
      if (announced) throw new Error('the camera stub was announced twice');
      announced = true;
      const timers = createSystemTimers();
      // The product's own adapter around the stub's loopback target: the only destination it ever probes.
      captureDiscoveryControl(app).provideAdapter((registered) => createOnvifDiscoveryAdapter({ timers, newMessageId: randomUUID, registered, loopbackFixture: stub.addresses().discovery }));
    },
    preset: () => preset,
    apply,
    stop,
  };
}
