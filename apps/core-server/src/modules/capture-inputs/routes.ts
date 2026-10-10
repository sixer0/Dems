/**
 * Operation 97 `rescanCaptureInputs` (task 3 blueprint row 133; contract C3 §2.6 op 97 and the
 * rule "Microphones", §4 `INPUT_RESCAN_RATE_LIMITED` / `CAPTURE_NOT_READY`, §5.2
 * `CAPTURE_DISCOVERY_SEARCHED` with `scope: MIC_LOCAL`; specs R-10 AC-2, AC-4; decision D80(5);
 * check M4-MIC-RESCAN-1). The registry entry, the schema and the simulator answer are row 132's
 * (decision D106); this file builds the live path behind them.
 *
 *   POST /api/v1/capture/inputs/rescan      access CAPTURE_CONFIG (web, tablet, phone)      no body
 *
 * WHAT ONE CALL DOES. It re-reads the local microphone inputs through the reachability probe
 * (`AudioInputAdapter.enumerate()`): one entry per REGISTERED microphone with `present` and the
 * helper's named cause, other inputs counted only. It opens no device, no socket and sends no
 * probe; it registers nothing and never replaces a local device by a fake. `online` of each
 * registered microphone is written to the engine's state when it differs (so `captureDevices` is
 * published), and ONE `CAPTURE_DISCOVERY_SEARCHED` row is written. It raises and resolves no
 * alert: the alert of an unreachable microphone belongs to a pre-check run (C3 §5.4).
 *
 * ALLOWED WHILE A SESSION IS OPEN (C3 "Config lock"): it changes no configuration.
 *
 * REFUSALS, in order:
 *   403  stage 6: a role without CAPTURE_CONFIG, with the one ACCESS_DENIED row. Not built here.
 *   503  `NOT_READY` (`CAPTURE_NOT_READY`): the Core captures for real and no probe is provided
 *        yet, or the engine is not running. No audit row.
 *   429  `RATE_LIMITED` (`INPUT_RESCAN_RATE_LIMITED`), `retry-after`: less than
 *        `CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS` since the last accepted re-read of this Core. No
 *        audit row, nothing read.
 *
 * WITHOUT A PROBE IN SIMULATED CAPTURE the answer is from the device state: the registered
 * microphones with `present` (no adapter is registered there, rule RG-1).
 *
 * A CORE IN SIMULATED CAPTURE STATES NO SOURCE (decision D196; gate 70 finding G70-01; D91 ruling
 * R-2, D131): in capture operation `SIMULATED` no entry carries `adapter` or `sourceClass`,
 * whatever the answer was read from. Both clients draw the "Development source" badge from the
 * class the Core sent; until this fix operation 97 said `FAKE` / `DEVELOPMENT` on a simulated Core
 * and the web console drew the badge there. In a real operation every entry carries both, from the
 * adapter that was asked.
 *
 * ERRORS. A probe that fails is an unexpected failure: it reaches the error envelope, which
 * writes it to the log and to the persistent error log; the spacing slot it took stays taken.
 */
import {
  ApiErrorCode,
  CAPTURE_DISCOVERY_OPERATIONS,
  CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS,
  CaptureDiscoveryReason,
  CaptureDiscoveryScope,
  CaptureDiscoveryTrigger,
  CaptureInputScanSchema,
  captureDiscoverySearchedDetails,
  type CaptureInputScan,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import { AuditType, Permission, isSessionActive } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { CaptureNotices, InputReading } from '../../capture-notices';
import { captureOperationOf } from '../../capture/fence';
import { ApiFailure } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';

export const CAPTURE_INPUTS_MODULE_OPERATIONS = ['rescanCaptureInputs'] as const;
export type CaptureInputsModuleOperation = (typeof CAPTURE_INPUTS_MODULE_OPERATIONS)[number];

/** Label of the unit that writes the search row. It appears in the pipeline's log lines. */
export const CAPTURE_INPUTS_UNIT_LABEL = 'captureInputs.rescanCaptureInputs';

/** The capture operation in which the Core states no adapter and no source class (decision D196, G70-01). */
const SIMULATED = 'SIMULATED';

const NOT_READY_TEXT = 'Capture is not ready yet.';
const LIMITED_TEXT = 'The microphones were read a moment ago. Try again shortly.';
const RESCANNED = 'Microphone inputs read again';
const SOURCE = 'captureInputs.rescan';

/** The registry entry of operation 97. Throws at load when the registry does not hold it. */
export function captureInputsOperation(operationId: CaptureInputsModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_DISCOVERY_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

export interface CaptureInputsRouteSeams {
  /** The no-device notices of the app: the probe and the presence writes. */
  notices(): Pick<CaptureNotices, 'probe' | 'notifier'>;
  /** The ID of this re-read for its audit row (`DSC-…`). */
  nextSearchId(now: number): string;
}

const notReady = (): ApiFailure => new ApiFailure(503, ApiErrorCode.NOT_READY, NOT_READY_TEXT, { details: { reason: CaptureDiscoveryReason.CAPTURE_NOT_READY } });

/** Registers operation 97 on the app. Called once, by the module's plugin. */
export function registerCaptureInputsRoutes(app: FastifyInstance, seams: CaptureInputsRouteSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  /** When the last accepted re-read of this Core began, or null. One Core, one spacing (C3 §7). */
  let lastAcceptedAt: number | null = null;

  routes.route({
    ...routeOfOperation(captureInputsOperation('rescanCaptureInputs')),
    schema: { response: { 200: CaptureInputScanSchema } },
    handler: async (request): Promise<CaptureInputScan> => {
      const { probe: probeOf, notifier } = seams.notices();
      const probe = probeOf();
      // Real capture with no adapter wired yet: nothing can be read, and a state answer would claim a re-read that did not happen.
      if (probe === null && app.config.captureMode === 'real') throw notReady();
      // 503 before the spacing: the engine's own refusal when it is not running.
      const before = app.engine.state();

      const now = app.clock.now();
      if (lastAcceptedAt !== null && now - lastAcceptedAt < CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS && now >= lastAcceptedAt) {
        const waitMs = CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS - (now - lastAcceptedAt);
        throw new ApiFailure(429, ApiErrorCode.RATE_LIMITED, LIMITED_TEXT, {
          details: { reason: CaptureDiscoveryReason.INPUT_RESCAN_RATE_LIMITED },
          headers: { 'retry-after': String(Math.max(1, Math.ceil(waitMs / 1_000))) },
        });
      }
      lastAcceptedAt = now;

      // The ONE decision of the capture operation (the fence's): a simulated Core states no adapter and no class.
      const statesSource = captureOperationOf(app.config) !== SIMULATED;
      const registered = before.captureDevices.devices.filter((device) => device.kind === 'MIC');
      const inputOf = (deviceId: string) => before.captureConfig.mics.find((mic) => mic.deviceId === deviceId)?.inputId ?? null;

      let inputs: CaptureInputScan['inputs'];
      let unregisteredCount = 0;
      if (probe === null) {
        // Simulated capture (real capture without a probe was refused above): the device state, and no word about a source.
        inputs = registered.map((device) => ({ deviceId: device.id, inputId: inputOf(device.id), present: device.online, errorCode: null }));
      } else {
        const reading: InputReading = await probe.microphones();
        const read = new Map(reading.microphones.map((entry) => [entry.deviceId, entry] as const));
        // One entry per REGISTERED microphone the adapters serve. A reading that names no registered
        // microphone is counted, never listed and never registered.
        inputs = registered.flatMap((device) => {
          const entry = read.get(device.id);
          if (entry === undefined) return [];
          return [{ deviceId: device.id, inputId: inputOf(device.id), present: entry.present, ...(statesSource ? { adapter: entry.adapterKind, sourceClass: entry.sourceClass } : {}), errorCode: entry.present ? null : entry.errorCode }];
        });
        unregisteredCount = reading.unregisteredCount + reading.microphones.filter((entry) => !registered.some((device) => device.id === entry.deviceId)).length;
        // `online` of the microphones: one unit per microphone whose state differs, none otherwise.
        for (const input of inputs) {
          if (registered.find((device) => device.id === input.deviceId)?.online !== input.present) await notifier.devicePresence(input.deviceId, input.present);
        }
      }

      const principal = request.principal;
      const actor = principal.kind === 'OPERATOR' ? { operatorId: principal.operatorId, deviceId: principal.deviceId } : { operatorId: null, deviceId: null };
      const searchId = seams.nextSearchId(now);
      const presentCount = inputs.filter((input) => input.present).length;
      const outcome = await app.engine.run(CAPTURE_INPUTS_UNIT_LABEL, async (scope) => {
        const session = scope.pending().session;
        await scope.unit.audit.append({
          type: AuditType.CAPTURE_DISCOVERY_SEARCHED,
          message: RESCANNED,
          actorId: actor.operatorId,
          deviceId: actor.deviceId,
          details: captureDiscoverySearchedDetails({
            searchId,
            scope: CaptureDiscoveryScope.MIC_LOCAL,
            trigger: CaptureDiscoveryTrigger.MANUAL,
            outcome: 'COMPLETE',
            responderCount: presentCount,
            newCount: unregisteredCount,
            registeredCount: inputs.length,
            interfaceCount: 0,
            sessionId: isSessionActive(session) ? (session?.id ?? null) : null,
            operationId: 'rescanCaptureInputs',
            permission: Permission.CAPTURE_CONFIG,
          }),
        });
        return undefined;
      });
      // Counts and codes only.
      request.log.info({ code: AuditType.CAPTURE_DISCOVERY_SEARCHED, source: SOURCE, searchId, registered: inputs.length, present: presentCount, unregistered: unregisteredCount, epoch: outcome.epoch, revision: outcome.revision }, RESCANNED);
      return { scannedAt: now, inputs, unregisteredCount };
    },
  });
}
