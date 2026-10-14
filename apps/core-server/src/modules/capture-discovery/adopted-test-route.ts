/**
 * THE ROUTE OF OPERATION 108 `testCaptureDeviceConnection` (task 4 row 146b, M3; the contract of
 * row V3; the function of row 146, `adopted-test.ts`; decisions C58, C67; security addendum 04
 * W-6, AD-03 point 5, AD-12 "S13-04 (d)", AD-02 point 1).
 *
 *   #    operationId                  method and path                          access (registry)
 *   108  testCaptureDeviceConnection  POST /api/v1/capture/devices/{id}/test   CAPTURE_CONFIG, web console only
 *
 * ONE HANDLER THAT CALLS THE CONTROL: `adoptedCameraTestControl(app).test(caller, deviceId)`. The
 * order of the test, every refusal and both audit entries are the function's; this file decides
 * nothing about a camera, an address, a credential or a bound.
 *
 * WHO MAY CALL is stage 6's (`plugins/permission-guard`): `CAPTURE_CONFIG` and the condition
 * `WEB_CONSOLE_SESSION` - the access object of operation 95 - with one `ACCESS_DENIED` row for a
 * refusal. This file reads no role.
 *
 * NO BODY, BY CONSTRUCTION. The route has no body schema and the handler reads no body: what a
 * client sends beside the path is not looked at. The ONE input is the `{id}` of the path, held to
 * the pattern the registry entry gives for it (stage 7; a path outside it is `422`, and the
 * refusal quotes nothing). So no caller can aim the test: no address, port, path, profile or
 * credential member exists on this edge.
 *
 * THE ANSWERS (the function's own; this file maps nothing):
 *   200  the outcome of the test - a failed test is a result. TWO audit entries: the reader's
 *        CAPTURE_CREDENTIAL_REVEALED, then CAPTURE_DEVICE_CONNECTION_TESTED (the outcome and the
 *        count of usable profiles; a camera that did not answer is UNREACHABLE here)
 *   409  CAPTURE_CONFIG_LOCKED                    a session is open
 *   503  NOT_READY, DISCOVERY_NOT_READY           the reader and the destination rule were not
 *                                                 handed in (no production composition: a Core in
 *                                                 simulated capture, a development Core)
 *   404  NOT_FOUND                                no registered camera of this id - a microphone too
 *   409  INVALID_STATE, CANDIDATE_NOT_TESTABLE    a development source; a stored address the
 *                                                 destination rule refuses; NO NETWORK
 *                                                 CONFIGURATION (the rule refuses every address
 *                                                 then, decision C55)
 *   409  INVALID_STATE, CONNECTION_TEST_IN_PROGRESS
 *   429  RATE_LIMITED, CONNECTION_TEST_RATE_LIMITED | CONNECTION_TEST_LOCKOUT_GUARD, `retry-after`
 *   409  INVALID_STATE, CREDENTIAL_REQUIRED       nothing is stored for this camera
 *   503  NOT_READY, CREDENTIAL_STORE_NOT_READY    the stored credential could not be read
 * Every refusal above the last two stands before the credential is read: nothing is revealed,
 * nothing is sent, no audit entry is written.
 * THE LAST TWO COME AFTER THE READER WAS CALLED (row 146c, decision C75 (1)): the reader audits
 * its call, and the function writes the outcome entry BEFORE the refusal - UNREACHABLE with
 * `unreachableReason: CREDENTIAL_NOT_READ`. The same for a `409 CANDIDATE_NOT_TESTABLE` that comes
 * after the reader was called: the reader's own gate (CREDENTIAL_NOT_READ) or an adapter that
 * refused the camera before a request (NOT_SENT). A reveal never stands without a result; an
 * outcome entry that cannot be written fails the request as a fault.
 *
 * WHAT A `200` MAY STORE (row PR, decision C117; `adopted-profiles.ts`). A test whose stream half
 * judged a stream meets what is stored for the camera, in the unit of its outcome entry: a camera
 * with NO stored profile gets the judged statement stored (the adoption's own write; the entry's
 * message ends `; profiles stored: N`); a camera whose stored statement the stream no longer makes
 * gets NOTHING stored (the message ends `; STREAM_PROFILE_DIFFERS: stored N, stated N, differing N;
 * nothing stored`); stored and stated the same: nothing, as before. The answer of this route is
 * the same in all three - the contract's `CaptureDeviceConnectionTest` has no member for either
 * (a request of row PR to the writer of the contract). Still TWO audit entries, and no body.
 *
 * A CORE WITHOUT A RELAY PROGRAM (`captureRelayPath` not configured) is no refusal: the tester of
 * the module answers the ONVIF half's own outcome and judges no stream (`index.ts`, row 50) - and
 * so stores nothing: such a Core cannot give a camera its profiles.
 *
 * A CORE IN SIMULATED CAPTURE answers `503 DISCOVERY_NOT_READY`, as the contract states for a
 * Core whose reader was not provided. It does NOT answer the in-app simulator's synthetic `200`:
 * a server that contacted nothing does not say `REACHABLE`.
 *
 * Nothing here reads or holds a credential, and no log line of this file exists.
 */
import { CAPTURE_DEVICE_TEST_OPERATIONS, CaptureDeviceConnectionTestSchema, type CaptureDeviceConnectionTest, type CoreApiRegistryOperation } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notSignedIn } from '../../plugins/authenticate';
import { routeOfOperation } from '../../plugins/permission-guard';
import { adoptedCameraTestControl } from './adopted-test';

/** The operation this file answers. */
export const CAPTURE_DEVICE_TEST_MODULE_OPERATION = 'testCaptureDeviceConnection';

/** The registry entry of operation 108. Throws at load when the registry does not hold it or gives it no path parameter. */
export function captureDeviceTestOperation(): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_DEVICE_TEST_OPERATIONS.find((candidate) => candidate.operationId === CAPTURE_DEVICE_TEST_MODULE_OPERATION);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${CAPTURE_DEVICE_TEST_MODULE_OPERATION}`);
  if (operation.pathParam === undefined) throw new Error(`the registry entry of ${CAPTURE_DEVICE_TEST_MODULE_OPERATION} has no path parameter`);
  return operation;
}

/** Registers operation 108 on the app. Called once, by the module's plugin, after the control of the test was built. */
export function registerAdoptedCameraTestRoute(app: FastifyInstance): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const operation = captureDeviceTestOperation();
  const idPattern = operation.pathParam?.pattern;
  if (idPattern === undefined) throw new Error(`the registry entry of ${CAPTURE_DEVICE_TEST_MODULE_OPERATION} has no path parameter`);
  const control = adoptedCameraTestControl(app);

  // 108 testCaptureDeviceConnection
  routes.route({
    ...routeOfOperation(operation),
    // No `body`: the operation has none, and none is read.
    schema: { params: z.object({ id: z.string().regex(idPattern) }), response: { 200: CaptureDeviceConnectionTestSchema } },
    handler: async (request): Promise<CaptureDeviceConnectionTest> => {
      const { principal } = request;
      // Stage 6 lets only an operator reach this route; the same backstop the other routes of the module have.
      if (principal.kind !== 'OPERATOR') throw notSignedIn();
      return control.test({ principal }, request.params.id);
    },
  });
}
