/**
 * THE LIVE PATH OF OPERATION 100 `confirmCaptureDeviceAddress` (task 4 blueprint row 197, M8 /
 * WP-12; the contract of row 194; the rule of row 97, `readdress.ts`; the engine door of row 196;
 * decisions U12 A7, C47 (29), C60 (4); findings SEC35-28, S13-11; AD-02).
 *
 *   #    operationId                  method and path                              access (registry)
 *   100  confirmCaptureDeviceAddress  POST /api/v1/capture/devices/address/confirm  CAPTURE_CONFIG, web console only
 *
 * THE ROUTE EDGE OF A RE-ADDRESS, and the ONE production caller of `operatorReaddressConfirmation`
 * and `confirmCameraReaddress` (static rule 6 of this folder: the closed list holds this file and
 * nothing else). A re-address happens when an operator's request reaches this handler - never from
 * the search, the candidate store, a timer, a tick or the capture session.
 *
 * WHO MAY CALL is stage 6's (`plugins/permission-guard`): `CAPTURE_CONFIG` and the condition
 * `WEB_CONSOLE_SESSION`, one `ACCESS_DENIED` row for a refusal. The body is stage 7's (three
 * members; a device id of a camera; an address of the strict form). This file reads no role.
 *
 * THE THREE SEAMS OF `readdress.ts`, as this file gives them:
 *   1. the caller's own candidate directory - the module's candidate state, asked with the
 *      SESSION of the request (handed in by the module's plugin). While the Core has no camera
 *      search the seam is absent and the answer is `503 DISCOVERY_NOT_READY`;
 *   2. the destination rule on the NEW address, before anything is written -
 *      `storedCameraAddressRuleOf` of the capture fence (the ONE binding of `decideDestination`
 *      for a stored camera address) on the host's NETWORK FACTS, which are INJECTED:
 *      `captureReaddressControl(app).provideNetworkFacts(reader)`. This file knows no interface,
 *      no subnet and no address. WITHOUT A READER, AND FOR A READER THAT ANSWERS NULL OR THROWS,
 *      EVERY ADDRESS IS REFUSED (`422`, fail-closed, decisions C55 / C60 (4)): the rule runs on
 *      the facts of a host of which nothing is known;
 *   3. the engine's door - `readdressCaptureDeviceIn` (row 196): the device row and the running
 *      engine's `captureDevices` slice change in the unit of this request, with its ONE audit
 *      entry `CAPTURE_DEVICE_ADDRESS_CHANGED`, or not at all.
 *
 * THE ANSWERS (contract of row 194; nothing is stored for any refusal, and no refusal writes an
 * audit entry besides stage 6's own):
 *   200  the camera as the registry holds it now
 *   409  CAPTURE_CONFIG_LOCKED            a session is open
 *   404  NOT_FOUND                        no registered camera of this id; or the candidate is
 *                                         unknown, expired or of another session (ONE answer)
 *   503  NOT_READY, DISCOVERY_NOT_READY   this Core has no camera search
 *   409  INVALID_STATE, READDRESS_*       the six reasons of the contract - the strings of
 *                                         `ReaddressRefusal`, nothing is mapped
 *   422  INVALID_INPUT,                   the destination rule refused the new address; one
 *        DISCOVERY_ADDRESS_NOT_ALLOWED    sentence, never the address, never the rule's own code
 *
 * AN OPEN SESSION. The operation is refused while a session is open (the selector's idle lock,
 * read before the unit and again inside it). So no running capture ever has its camera
 * re-addressed under it: the production camera adapter reads the stored address when it OPENS a
 * camera, and the next open after a confirmed change reads the new one.
 *
 * Nothing here reads or holds a credential, and nothing is sent to the new address. No log line
 * carries an address or an endpoint reference.
 */
import {
  ApiErrorCode,
  CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE,
  CAPTURE_READDRESS_OPERATIONS,
  CAPTURE_READDRESS_REFUSAL_SENTENCES,
  CaptureDeviceAddressConfirmRequestSchema,
  CaptureDeviceAddressConfirmationSchema,
  CaptureDiscoveryReason,
  CaptureReaddressReason,
  type CaptureDeviceAddressConfirmation,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import { isSessionActive } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { storedCameraAddressRuleOf, type CaptureNetworkFactsReader } from '../../capture/fence';
import { readdressCaptureDeviceIn } from '../../engine';
import { notSignedIn } from '../../plugins/authenticate';
import { ApiFailure } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import {
  ReaddressRefusal,
  ReaddressRefused,
  confirmCameraReaddress,
  operatorReaddressConfirmation,
  type DeviceReaddresser,
  type ReaddressCandidates,
  type ReaddressRule,
  type ReaddressSeams,
} from './readdress';

/** The operation this file answers. */
export const CAPTURE_READDRESS_MODULE_OPERATION = 'confirmCaptureDeviceAddress';

const SOURCE = 'captureReaddress';
const LOCKED_TEXT = 'The capture configuration cannot be changed while a session is open.';
const NOT_FOUND_TEXT = 'No camera or candidate has this ID.';
const NOT_READY_TEXT = 'The camera search is not ready. Try again shortly.';
const FACTS_UNREADABLE = 'the network facts of this host could not be read for a camera re-address: the address was refused';
/** The code of the note and the error-log entry of a reader that threw. Nothing of what was thrown travels. */
export const READDRESS_NETWORK_FACTS_UNREADABLE = 'READDRESS_NETWORK_FACTS_UNREADABLE';

/** The registry entry of operation 100. Throws at load when the registry does not hold it. */
export function captureReaddressOperation(): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_READDRESS_OPERATIONS.find((candidate) => candidate.operationId === CAPTURE_READDRESS_MODULE_OPERATION);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${CAPTURE_READDRESS_MODULE_OPERATION}`);
  return operation;
}

// ── The answers of a refusal ───────────────────────────────────────────────────────────────────

const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, LOCKED_TEXT);
const notFound = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, NOT_FOUND_TEXT);
const notReady = (): ApiFailure => new ApiFailure(503, ApiErrorCode.NOT_READY, NOT_READY_TEXT, { details: { reason: CaptureDiscoveryReason.DISCOVERY_NOT_READY } });
/** One sentence and one reason for every rule: never the address, never the rule's own code (row 94's ruling). */
const addressNotAllowed = (): ApiFailure =>
  new ApiFailure(422, ApiErrorCode.INVALID_INPUT, CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE, { details: { in: 'body', reason: CaptureDiscoveryReason.DISCOVERY_ADDRESS_NOT_ALLOWED } });

const CONTRACT_REASONS: ReadonlySet<string> = new Set(Object.values(CaptureReaddressReason));
const isContractReason = (code: string): code is CaptureReaddressReason => CONTRACT_REASONS.has(code);

/**
 * The contract's answer for a refusal of `readdress.ts`. The six `READDRESS_*` reasons of the
 * contract ARE the refusal's code (held equal by a test). `NOT_CONFIRMED` cannot be reached from a
 * route (the confirmation is made here, the caller is an operator): it is not mapped and travels
 * as the fault it would be.
 */
export function readdressRefusedAnswer(refused: ReaddressRefused): ApiFailure | null {
  switch (refused.code) {
    case ReaddressRefusal.CAPTURE_LOCKED:
      return locked();
    case ReaddressRefusal.NOT_READY:
      return notReady();
    case ReaddressRefusal.CANDIDATE_UNKNOWN:
    case ReaddressRefusal.DEVICE_UNKNOWN:
      return notFound();
    case ReaddressRefusal.ADDRESS_NOT_ALLOWED:
      return addressNotAllowed();
    case ReaddressRefusal.NOT_CONFIRMED:
      return null;
    default:
      return isContractReason(refused.code) ? new ApiFailure(409, ApiErrorCode.INVALID_STATE, CAPTURE_READDRESS_REFUSAL_SENTENCES[refused.code], { details: { reason: refused.code } }) : null;
  }
}

// ── The control: the injected network facts ────────────────────────────────────────────────────

export interface CaptureReaddressControl {
  /**
   * Hands in the reader of the host's network facts (`CaptureNetworkFactsReader` of the capture
   * fence: the camera interface's subnet and addresses, the other interfaces' subnets, the host's
   * own addresses; null = not configured). Once per app: a second reader is refused, so that a
   * later caller cannot put wider facts in the place of the product's.
   */
  provideNetworkFacts(reader: CaptureNetworkFactsReader): void;
  /** True when a reader was handed in. False: every re-address is refused by the rule. */
  factsProvided(): boolean;
  /**
   * FOR TESTS ONLY: the destination rule itself, in the place of the product's binding. Every
   * camera double of a test host lives on loopback, which the product's rule refuses on any
   * facts; the permissive rule is a value under `test/` (AD-02 (2)). No production file calls it
   * (static rule 4 of this folder).
   */
  replaceForTest(parts: { readonly addressRule: ReaddressRule | null }): void;
}

interface ControlState extends CaptureReaddressControl {
  rule(): ReaddressRule;
}

/**
 * THE PRODUCT'S RULE: the fence's one binding of the destination rule for a stored camera address
 * (`storedCameraAddressRuleOf`), on what the injected reader answers at THIS judgement. `reader`
 * answers the reader that was handed in, or null: then - as for a reader that answers null or
 * throws - the binding runs on the facts of a host of which nothing is known and refuses every
 * address. `unreadable` is told of a reader that threw.
 */
export function readdressRuleOf(reader: () => CaptureNetworkFactsReader | null, unreadable: () => void): ReaddressRule {
  return (host, port) => storedCameraAddressRuleOf(reader() ?? undefined, unreadable)(host, port);
}

// Keyed by the app's stage registry: one object per app (the `captureDiscoveryControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

function stateOf(app: FastifyInstance): ControlState {
  const known = controls.get(app.stages);
  if (known !== undefined) return known;
  let reader: CaptureNetworkFactsReader | null = null;
  let replaced: ReaddressRule | null = null;
  const unreadable = (): void => {
    app.log.error({ source: SOURCE, code: READDRESS_NETWORK_FACTS_UNREADABLE }, FACTS_UNREADABLE);
    app.errorLog.append({ level: 'error', source: SOURCE, message: FACTS_UNREADABLE, code: READDRESS_NETWORK_FACTS_UNREADABLE, context: {} });
  };
  const bound = readdressRuleOf(() => reader, unreadable);
  const control: ControlState = {
    provideNetworkFacts(given) {
      if (reader !== null) throw new Error('the network facts reader of the camera re-address was handed in already');
      reader = given;
    },
    factsProvided: () => reader !== null,
    replaceForTest(parts) {
      replaced = parts.addressRule;
    },
    rule: () => replaced ?? bound,
  };
  controls.set(app.stages, control);
  return control;
}

/** The re-address controls of an app. Made at the first call, by the module's plugin or by the composition, whichever comes first. */
export function captureReaddressControl(app: FastifyInstance): CaptureReaddressControl {
  return stateOf(app);
}

// ── The route ──────────────────────────────────────────────────────────────────────────────────

export interface CaptureReaddressRouteSeams {
  /** The module's candidate state, by the caller's session on the server clock; null while this Core has no camera search. */
  candidates(): ReaddressCandidates | null;
}

/** THE ENGINE'S DOOR (row 196), as the seam of `readdress.ts` takes it. The instant is not stored: no member of the registry holds one. */
export const engineDeviceReaddresser: DeviceReaddresser = async (scope, change) => {
  await readdressCaptureDeviceIn(scope, { deviceId: change.deviceId, address: change.address });
};

/** Registers operation 100 on the app. Called once, by the module's plugin. */
export function registerCaptureReaddressRoute(app: FastifyInstance, given: CaptureReaddressRouteSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const control = stateOf(app);
  const seams: ReaddressSeams = {
    host: {
      now: () => app.clock.now(),
      state: () => app.engine.state(),
      engineUnit: (label, work) => app.engine.run(label, work),
      note: (fields, message) => app.log.info(fields, message),
    },
    candidates: () => given.candidates(),
    addressRule: () => control.rule(),
    readdresser: () => engineDeviceReaddresser,
  };

  // 100 confirmCaptureDeviceAddress
  routes.route({
    ...routeOfOperation(captureReaddressOperation()),
    schema: { body: CaptureDeviceAddressConfirmRequestSchema, response: { 200: CaptureDeviceAddressConfirmationSchema } },
    handler: async (request): Promise<CaptureDeviceAddressConfirmation> => {
      const { principal } = request;
      // Stage 6 lets only an operator reach this route; the same backstop the search routes have.
      if (principal.kind !== 'OPERATOR') throw notSignedIn();
      const { deviceId } = request.body;
      // The contract's order: the idle lock, then "no registered camera of this id" (404, the answer of an unknown candidate too).
      const state = app.engine.state();
      if (isSessionActive(state.session)) throw locked();
      if (!state.captureDevices.devices.some((entry) => entry.id === deviceId && entry.kind === 'CAMERA')) throw notFound();
      try {
        // THE OPERATOR'S ACT: the body of THIS request is the confirmation. Nothing else makes one.
        await confirmCameraReaddress(seams, { principal }, operatorReaddressConfirmation(request.body));
      } catch (error) {
        const answer = error instanceof ReaddressRefused ? readdressRefusedAnswer(error) : null;
        if (answer !== null) throw answer;
        throw error;
      }
      const device = app.engine.state().captureDevices.devices.find((entry) => entry.id === deviceId);
      if (device === undefined) throw notFound();
      return { deviceId, device };
    },
  });
}
