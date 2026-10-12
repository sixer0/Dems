/**
 * Microphone registration module (task 4, blueprint row 70, package WP-07c; contract
 * `packages/shared/src/api/capture-audio-cards.ts`; design addendum 04 section 4.2; security
 * addendum AD-07; plan review P12-F05 (c), P12-F06, P12-F07; decisions U10, C25, C31).
 *
 * WHAT THIS MODULE OWNS
 *   - the live paths of operations 98 `searchCaptureAudioCards` and 99 `registerCaptureAudioInput`
 *     (`routes.ts`), and what they do (`service.ts`);
 *   - the registration unit: the registry row of a `USB_AUDIO` microphone (through the registrar
 *     handed in) and its row in `capture_audio_inputs` (`statements.ts`, `store.ts`), in ONE unit;
 *   - the audit entries of both operations, through the shared detail builders;
 *   - "one listing at a time" and the spacing of the search (`createListingGate`).
 *
 * WHAT IT DOES NOT OWN. The contract of the two operations (row 63). The card listing and its
 * text rule (`capture/adapters/audio/card-listing.ts`, rows 64 and 155): the enumerator is HANDED
 * IN, this module reads no host and starts no process. The adapter that records from a card (rows
 * 67 and WP-13): registering an input makes a DEVICE ROW, not a recordable source. The role of a
 * microphone (the selector, operation 80; decision C25). No permission row: the permission is the
 * existing CAPTURE_CONFIG (the stored grants of SUPERVISOR and TECHNICIAN), so P12-F07 asks nothing.
 *
 * THE ENUMERATOR. `USB_AUDIO` is registrable in production capture only (`capture/adapters/
 * kinds.ts`). The product hands the enumerator in through `provideEnumerator`, which REFUSES in
 * every other capture operation; the production registry builder (row 85) is its caller. Without
 * an enumerator both operations answer `503 NOT_READY` (`DISCOVERY_NOT_READY`), list nothing,
 * store nothing and write no audit row: the answer of a `SIMULATED` and of a `REAL_DEVELOPMENT`
 * Core, and of a production Core until row 85 lands.
 *
 * ADMISSION. A registered microphone is handed to the adapter registry of the running operation
 * WHEN ITS UNIT COMMITTED (never for a unit that rolled back): by default the capture fence's
 * `admitDevice`, or a registry handed in (`provideAdmission`). A failure there does not undo the
 * registration: it is logged and persisted, and the next start of the Core serves the stored row.
 *
 * THE REGISTRAR. No statement of this module writes `capture_devices` (static rule SEC35-41 (c)).
 * The registry row is written by the registrar handed in (`provideRegistrar`), inside the unit of
 * the registration, as the camera adoption's is. The engine has no action that adds a microphone
 * yet (request filed): until its registrar is handed in, operation 99 answers `503` and stores
 * nothing, and this module's database test uses a stand-in with the unit's own connection.
 *
 * THIS MODULE IS NO WIRING UNIT of the adapter layer (static rule A-5): it imports nothing of
 * `capture/adapters`. What it reads of a listing is stated in `service.ts`.
 *
 * MOUNTED by `modules/capture-inputs` (its parent, the microphone module `app.ts` registers; the
 * unit list of `app.ts` is frozen, static rule P25). The plugin function opens no database connection, no socket and no
 * process, and registers no boot step: `buildApp()` works without PostgreSQL.
 */
import { isSessionActive } from '@dems/shared/sim';
import type { FastifyPluginAsync } from 'fastify';
import { captureFenceControl, captureOperationOf } from '../../../capture/fence';
import { describeError } from '../../../plugins/logger';
import { registerCaptureAudioCardsRoutes } from './routes';
import { createListingGate, type AudioCardEnumerator, type AudioCardsHost, type AudioCardsSeams, type ListingGate, type MicrophoneRegistrar, type RegisteredMicrophone } from './service';
import { createMicrophoneStore, type MicrophoneStore } from './store';

export { CAPTURE_AUDIO_CARDS_MODULE_OPERATIONS, captureAudioCardsOperation, type CaptureAudioCardsModuleOperation } from './routes';
export {
  ASSUMED_CARD_FACTS,
  REGISTER_UNIT_LABEL,
  SEARCH_UNIT_LABEL,
  createListingGate,
  registerAudioInput,
  searchAudioCards,
  type AudioCardEnumerator,
  type AudioCardListing,
  type AudioCardsCaller,
  type AudioCardsHost,
  type AudioCardsSeams,
  type AudioCardsUnit,
  type AudioInputRegistrationOutcome,
  type ListingGate,
  type ListedAudioCard,
  type ListingPurpose,
  type MicrophoneRegistrar,
  type RegisteredMicrophone,
} from './service';
export { CAPTURE_AUDIO_CARD_WRITES, INSERT_AUDIO_INPUT, READ_AUDIO_INPUT_OF_CARD, READ_REGISTERED_AUDIO_INPUTS, REFRESH_AUDIO_INPUT } from './statements';
export { MicrophoneRowMissing, createMicrophoneStore, type AudioInputFacts, type AudioInputKey, type MicrophoneStore, type Queryable, type RegisteredAudioInput, type StoredAudioInput } from './store';

/** Hands a committed microphone to an adapter registry. What it answers is for the log only. */
export type MicrophoneAdmission = (device: RegisteredMicrophone) => unknown;

/** `code` of the refusal of an enumerator outside production capture. */
export const AUDIO_CARD_ENUMERATOR_REFUSED = 'AUDIO_CARD_ENUMERATOR_NEEDS_PRODUCTION_CAPTURE';

export class AudioCardEnumeratorRefusedError extends Error {
  readonly code = AUDIO_CARD_ENUMERATOR_REFUSED;
  constructor() {
    super('the enumerator of the sound cards is accepted in production capture only');
    this.name = 'AudioCardEnumeratorRefusedError';
  }
}

/** What a test may put in the place of the module's own parts. */
export interface CaptureAudioCardsTestParts {
  /** The enumerator, whatever the capture operation of the test Core is; null takes it away again. */
  readonly enumerator?: AudioCardEnumerator | null;
  readonly admission?: MicrophoneAdmission;
  /** The writer of the registry row (a stand-in with the unit's own connection, until the engine has the action). */
  readonly registrar?: MicrophoneRegistrar;
  readonly store?: MicrophoneStore;
  readonly gate?: ListingGate;
}

/** What this module offers beside its routes. */
export interface CaptureAudioCardsControl {
  /**
   * Hands in the enumerator of the card listing. Once per app, and in `REAL_PRODUCTION` only:
   * every other capture operation is refused with `AudioCardEnumeratorRefusedError`.
   */
  provideEnumerator(enumerator: AudioCardEnumerator): void;
  /** Hands in the writer of the registry row of a microphone. Once per app. Without it operation 99 answers `503`. */
  provideRegistrar(registrar: MicrophoneRegistrar): void;
  /** Hands in the adapter registry's admission in the place of the capture fence's. Once per app. */
  provideAdmission(admission: MicrophoneAdmission): void;
  /** True when both operations can list: an enumerator was handed in. */
  ready(): boolean;
  /** True when operation 99 can store: an enumerator and a registrar were handed in. */
  registrable(): boolean;
  /** Listings let through since the process began (0 at boot: nothing lists in the background). */
  listingsStarted(): number;
  /**
   * A TEST puts its own parts in the place of the module's (a fake enumerator on a simulated
   * Core, a registry of its own, a store whose second write fails, a gate on a clock of its own).
   * No production file calls it: the module's static test holds that.
   */
  replaceForTest(parts: CaptureAudioCardsTestParts): void;
}

interface ControlState extends CaptureAudioCardsControl {
  enumerator: AudioCardEnumerator | null;
  admission: MicrophoneAdmission | null;
  registrar: MicrophoneRegistrar | null;
  store: MicrophoneStore;
  gate: ListingGate;
}

// Keyed by the app's stage registry: one object per app (the `captureDiscoveryControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The module's controls of an app. Available once the module is registered. */
export function captureAudioCardsControl(app: { readonly stages: object }): CaptureAudioCardsControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the capture-audio-cards module is not loaded: register it before app.ready(), then call it after');
  return control;
}

const SOURCE = 'captureAudioCards';
const PRODUCTION = 'REAL_PRODUCTION';
const ADMIT_FAILED = 'a registered microphone could not be handed to the adapter registry: it is served after the next start of the Core';

/**
 * The id of a listing for its audit row: `DSC-` and the Core clock in milliseconds, thirteen
 * digits (the form of the microphone re-read, operation 97; never an id of the camera search's
 * six-digit counter). Two listings of one process never share an id: a second one within the same
 * millisecond takes the next number.
 */
export function createAudioCardSearchIds(): (now: number) => string {
  let last = 0;
  return (now) => {
    last = Math.max(Math.trunc(now), last + 1);
    return `DSC-${String(last).padStart(13, '0')}`;
  };
}

export const captureAudioCardsModule: FastifyPluginAsync = async (app) => {
  // The ONE decision of the capture operation (the fence's function): this module reads no flag.
  const production = captureOperationOf(app.config) === PRODUCTION;
  const codeOf = (error: unknown): string => describeError(error).code ?? describeError(error).errorName;

  const control: ControlState = {
    enumerator: null,
    admission: null,
    registrar: null,
    store: createMicrophoneStore(),
    gate: createListingGate(() => app.clock.now()),
    provideEnumerator(enumerator) {
      if (!production) throw new AudioCardEnumeratorRefusedError();
      if (control.enumerator !== null) throw new Error('the enumerator of the sound cards was provided twice');
      control.enumerator = enumerator;
    },
    provideRegistrar(registrar) {
      if (control.registrar !== null) throw new Error('the registrar of microphones was provided twice');
      control.registrar = registrar;
    },
    provideAdmission(admission) {
      if (control.admission !== null) throw new Error('the admission of registered microphones was provided twice');
      control.admission = admission;
    },
    ready: () => control.enumerator !== null,
    registrable: () => control.enumerator !== null && control.registrar !== null,
    listingsStarted: () => control.gate.started(),
    replaceForTest(parts) {
      if (parts.enumerator !== undefined) control.enumerator = parts.enumerator;
      if (parts.admission !== undefined) control.admission = parts.admission;
      if (parts.registrar !== undefined) control.registrar = parts.registrar;
      if (parts.store !== undefined) control.store = parts.store;
      if (parts.gate !== undefined) control.gate = parts.gate;
    },
  };
  controls.set(app.stages, control);

  /** The capture fence's registry of the running operation: what a boot would give the stored row. */
  const fenceAdmission: MicrophoneAdmission = (device) => captureFenceControl(app).admitDevice(device);

  const admit = (device: RegisteredMicrophone): void => {
    try {
      const admission = (control.admission ?? fenceAdmission)(device);
      app.log.info({ code: 'CAPTURE_DEVICE_ADMITTED', source: `${SOURCE}.admit`, deviceId: device.id, admission: typeof admission === 'string' ? admission : null }, 'registered microphone handed to the adapter registry');
    } catch (error) {
      const described = describeError(error);
      const code = codeOf(error);
      app.log.error({ source: `${SOURCE}.admit`, code, deviceId: device.id }, ADMIT_FAILED);
      app.errorLog.append({ level: 'error', source: `${SOURCE}.admit`, message: ADMIT_FAILED, code, errorName: described.errorName, stackTrace: described.stackTrace, context: { deviceId: device.id } });
    }
  };

  const host: AudioCardsHost = {
    now: () => app.clock.now(),
    // The engine's own refusal (503) when it is not running: nothing is listed for a Core that cannot store.
    sessionOpen: () => isSessionActive(app.engine.state().session),
    read: (label, work) => app.db.read(label, (pool) => work({ query: (text, values) => pool.query(text, values) })),
    async unit(label, work) {
      const outcome = await app.engine.run(label, (scope) =>
        work({
          db: { query: (text, values) => scope.unit.query(text, values) },
          scope,
          sessionOpen: () => isSessionActive(scope.pending().session),
          audit: async (entry) => {
            await scope.unit.audit.append(entry);
          },
          afterCommit: (task) => scope.unit.afterCommit(task),
        }),
      );
      return outcome.value;
    },
    note: (fields, message) => app.log.info(fields, message),
    failed(source, message, error, context = {}) {
      const described = describeError(error);
      const code = codeOf(error);
      app.log.error({ source, code, ...context }, message);
      app.errorLog.append({ level: 'error', source, message, code, errorName: described.errorName, stackTrace: described.stackTrace, context });
    },
  };

  const nextSearchId = createAudioCardSearchIds();
  // Read at each call: a test may have put parts of its own in (`replaceForTest`).
  const seams = (): AudioCardsSeams => ({ host, store: control.store, gate: control.gate, enumerator: () => control.enumerator, registrar: () => control.registrar, admit, nextSearchId });

  registerCaptureAudioCardsRoutes(app, seams);
};
