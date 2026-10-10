/**
 * The source facts of a real capture operation, handed to the engine (integration pass D11; row
 * 140's findings F-2 and F-5; contract C3 §2.6 "Device shapes", erratum PE-128-38; ux §8f.1
 * "Decided by the Core", §8f "'Is on' indicator"; SEC35-44 (4)).
 *
 * WHAT. Both clients draw the development badge and the "is on" indicator from slice
 * `captureDevices` and from nothing else. Two members of that slice are known to no row:
 *
 *   the class   `adapter` / `sourceClass` of a device whose stored row surfaces none - the built-in
 *               ids, which ARE the test sources (kind `FAKE`) of a development Core;
 *   "is on"     `sourceOpen`: true while the Core holds an open source of a `LOCAL_DEVICE` device,
 *               the short open of a pre-check included; never for another kind (C3 §2.6).
 *
 * This file builds the list of both from what the capture side says and hands it to the engine's
 * fact door `applyCaptureSourceFacts`. It decides nothing itself:
 *
 *   the class   every CAMERA and MIC the registry of the RUNNING operation lists, with the adapter
 *               kind the registry holds for it. `REAL_PRODUCTION` registers no development source
 *               (rule RG-2), so a built-in device gets nothing there; a device whose row already
 *               carries its adapter keeps it (the transition never rewrites one).
 *   "is on"     what the capture fence says is open NOW (`openSources()`): a running helper of
 *               this Mac's camera, its prepared microphone, the short open of a pre-check. The
 *               fence lists local devices only, and drops one the moment its handle is closed or
 *               its source is lost - so every close path (a stop, an interrupted recording, a
 *               failed start) clears the member, and a process start begins with none.
 *
 * NEVER IN CAPTURE OPERATION `SIMULATED` (decision D91 R-2, the D131 pin): nothing is subscribed,
 * no boot step is added, the door is never called - a simulated Core sends no class and no "is on".
 *
 * WHEN. Once after the boot (the registry is known), then after every change the fence tells and
 * after every event of the capture session (a start, the first durable fragment, every end): each
 * time the WHOLE list of that moment. The engine keeps the last list across a reset or a reload of
 * its state inside the process.
 *
 * While the engine is stopped (a shutdown, the quiesce of a reset) nothing is handed in: sources
 * that close then are told again by the next change or the next boot.
 *
 * FAILURES. A list the engine did not take is written to the log and to the persistent error log
 * (`CAPTURE_SOURCE_FACTS_NOT_APPLIED`); it never refuses a boot, a start or a stop. The next
 * change hands in the whole list again.
 *
 * The boot step is added in `onReady`: this module registers BEFORE the capture unit, and the step
 * must run after the fence's (`capture.fence`), which builds the registry.
 */
import type { CaptureSourceFact } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { captureFenceControl, captureOperationOf, storedDeviceListingOf } from '../../capture/fence';
import { sessionCapture } from '../../capture-session';
import { factDoorsOf, provideCaptureDeviceListing } from '../../engine';
import { describeError } from '../../plugins/logger';

/** The ID of the boot step. */
export const SOURCE_FACTS_BOOT_STEP = 'devices.sourceFacts';
/** The code of a list the engine did not take. */
export const SOURCE_FACTS_NOT_APPLIED = 'CAPTURE_SOURCE_FACTS_NOT_APPLIED';
const SOURCE = 'modules.devices.sourceFacts';
const SIMULATED = 'SIMULATED';

/** A registered device as the feed reads it (`CaptureDeviceDescriptor`, structurally). */
export interface RegisteredSource {
  readonly id: string;
  readonly deviceClass: string;
  readonly adapterKind: string;
}

/** Where the feed reads the capture side. Defaults: the capture fence of the app. */
export interface SourceFactsPorts {
  /** Every device the registry of the running operation lists; empty while there is none. */
  registered(): readonly RegisteredSource[];
  /** The local devices whose source is open now. */
  openSources(): readonly string[];
}

export interface CaptureSourceFactsFeed {
  /** Hands the whole list of this moment to the engine. Does nothing in `SIMULATED`. Never rejects. */
  changed(when: string): Promise<void>;
  /** Replaces ports: a rig whose registry is not the fence's own tells the feed where to read, and calls `changed`. */
  replace(ports: Partial<SourceFactsPorts>): void;
}

/** The list for the door: the registry's sources with their adapter kind, and every open device. */
export function sourceFactsOf(registered: readonly RegisteredSource[], open: readonly string[]): CaptureSourceFact[] {
  const facts = registered.filter((device) => device.deviceClass === 'CAMERA' || device.deviceClass === 'MIC').map((device): CaptureSourceFact => ({ deviceId: device.id, adapter: device.adapterKind, open: open.includes(device.id) }));
  const named = new Set(facts.map((fact) => fact.deviceId));
  for (const deviceId of [...new Set(open)].sort()) if (!named.has(deviceId)) facts.push({ deviceId, open: true });
  return facts;
}

const feeds = new WeakMap<object, CaptureSourceFactsFeed>();

/** The feed of an app. Available after the devices module was registered. */
export function captureSourceFacts(app: { readonly stages: object }): CaptureSourceFactsFeed {
  const feed = feeds.get(app.stages);
  if (feed === undefined) throw new Error('the source-facts feed is not mounted: the devices module registers it');
  return feed;
}

/** Mounts the feed on the app. Called once, by the module. */
export function mountCaptureSourceFacts(app: FastifyInstance): CaptureSourceFactsFeed {
  // The fence is read at each use: it is mounted after this module, and never before `onReady`.
  const ports: SourceFactsPorts = {
    registered: () => captureFenceControl(app).registry()?.list() ?? [],
    openSources: () => captureFenceControl(app).openSources(),
  };

  const feed: CaptureSourceFactsFeed = {
    changed(when) {
      if (captureFenceControl(app).operation === SIMULATED) return Promise.resolve();
      // An engine that is stopped (a shutdown closes the sources after it) takes nothing and holds nothing:
      // not a failure. The next start begins with no open source, and its boot step hands the list in.
      if (!app.engine.running) return Promise.resolve();
      const facts = sourceFactsOf(ports.registered(), ports.openSources());
      // The door is reached inside the chain: an engine that has none (a stand-in behind the seam) is a failure of the hand-over, said below.
      return Promise.resolve()
        .then(() => factDoorsOf(app.engine).applyCaptureSourceFacts(facts))
        .then(
          () => undefined,
          (err: unknown) => {
            const message = 'the source facts of the capture operation were not handed to the engine: the device list keeps what it said';
            app.log.error({ err, code: SOURCE_FACTS_NOT_APPLIED, when }, message);
            app.errorLog.append({ level: 'error', source: SOURCE, message, ...describeError(err), code: SOURCE_FACTS_NOT_APPLIED, context: { when, sources: facts.length, open: facts.filter((fact) => fact.open).length } });
          },
        );
    },
    replace(next) {
      Object.assign(ports, next);
    },
  };
  feeds.set(app.stages, feed);

  // THE DEVICE LIST OF THE RUNNING OPERATION (fix F-M4; review row 69, finding R69-03; decision
  // D178). Handed to the engine NOW, at registration - before the boot reads the stored registry -
  // and applied by it at every rehydration: in `REAL_PRODUCTION` a stored camera or microphone of a
  // development kind (this Mac's camera and microphone of an earlier development boot, the four
  // generated test sources) is in no state, so in no answer of operations 76 / 77, no replicated
  // slice and no roster. `SIMULATED` has no rule: every stored kind is listed and inert (D83 O-2).
  // An engine behind the seam that cannot hold the rule stops the registration (fail closed).
  const listing = storedDeviceListingOf(captureOperationOf(app.config));
  if (listing !== null) provideCaptureDeviceListing(app.engine, listing);

  app.addHook('onReady', async () => {
    const fence = captureFenceControl(app);
    if (fence.operation === SIMULATED) return;
    fence.onOpenSourcesChanged(() => void feed.changed('OPEN_SOURCES_CHANGED'));
    sessionCapture(app).on((event) => feed.changed(event.type));
    app.readiness.addBootStep({ id: SOURCE_FACTS_BOOT_STEP, run: () => feed.changed('BOOT') });
  });
  return feed;
}
