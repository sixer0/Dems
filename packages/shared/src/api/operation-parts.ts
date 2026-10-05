/**
 * Texts and response specs the Core-server operations share (backend task: 2026-10-04 01_specs
 * §7.2, §7.3). Internal to `src/api`: `index.ts` does not re-export this module.
 *
 * 01_specs §7.3 lists the answers that are "common to many operations" and leaves them out of
 * its operation tables: 401 (every operation that is not PUBLIC), 403 `NOT_PERMITTED` (every
 * operation with a permission), 403 `ORIGIN_NOT_ALLOWED`, 400 and 422 (every operation with a
 * body). The registry spells them out per operation, with these texts, so a reader of one
 * operation sees every answer its own rules can produce. What no operation repeats is defined once
 * in `CORE_API_ENVELOPE_RESPONSES` (`core-api.ts`).
 */
import type { Permission } from '../sim/vocabulary';
import { DEVICE_CREDENTIAL_REQUIRED_REASON, type CoreApiResponseSpec } from './contract-model';

/** Last paragraph of every operation that only the Core server answers. */
export const CORE_SERVER_NOTE =
  'Core server only: the in-app simulator has no such operation, so it is not available in Simulated mode.';

/**
 * Last paragraph of an operation that hosts a simulator action (01_specs §7.17): the server calls
 * the shared action under the caller's identity, so both modes run the same code.
 */
export const hostedNote = (action: string): string =>
  `Core server only: the server runs the shared simulator action \`${action}\` under the caller's identity. In Simulated mode a client calls that action in its own simulator and sends no request.`;

/** Last paragraph of a read that answers slices of the Core state (API-6). */
export const STATE_READ_NOTE =
  'Core server only: the answer holds the named slices in their wire form, the same JSON as the `state` topic of the socket (API-6). In Simulated mode a client reads them from its own simulator and sends no request.';

/** Last paragraph of a list read (API-9). */
export const LIST_READ_NOTE =
  'Core server only: the rows come from the stored tables, which may hold more than the rings a client receives on the socket. In Simulated mode a client reads the list from its own simulator and sends no request.';

/** For the six operations whose body or answer holds a secret (01_specs §7.7; AR-3a). */
export const SECRET_NOTE =
  'The body or the answer holds a secret. It is never logged, and the API Reference offers no "Try it" for this operation in Live mode.';

/** `source` of an operation of the backend task. */
export const backendSource = (section: string, operation: number): string =>
  `Backend task 2026-10-04, 01_specs ${section}, operation ${operation} (not in the design book)`;

function refusal(description: string) {
  return { description, schema: 'ApiError' } as const satisfies CoreApiResponseSpec;
}

export const INVALID_JSON = refusal('The body is not a JSON object (INVALID_JSON).');

export const INVALID_INPUT = refusal(
  'The body or the path parameter does not match its schema (INVALID_INPUT). Free text that holds U+0000 or an unpaired surrogate is refused here (API-13).',
);

/** 422 of an operation whose only input is the path parameter. */
export const INVALID_PATH_PARAMETER = refusal('The path parameter does not match its pattern (INVALID_INPUT).');

/** 422 of a list read (SR-64: a query is validated like a body). */
export const INVALID_QUERY = refusal(
  'A query parameter does not match its schema (INVALID_INPUT): a value outside its set, a `limit` outside 1 to 200, a cursor that is not one, or text that holds U+0000 or an unpaired surrogate (API-13).',
);

/** 401 of an operation that needs an OPERATOR. */
export const NOT_SIGNED_IN = refusal(
  'No valid session (NOT_SIGNED_IN): none was sent, it expired or ended, or the request carried two credentials (`details.reason: CREDENTIAL_CONFLICT`).',
);

/** 401 of an operation that needs a DEVICE. */
export const NO_DEVICE_CREDENTIAL = refusal(
  'No valid device credential or device session (NOT_SIGNED_IN), or two credentials in one request (`details.reason: CREDENTIAL_CONFLICT`).',
);

const ORIGIN = 'the `Origin` is not on the list that fits the credential (ORIGIN_NOT_ALLOWED)';
const REVOKED = 'the device of the credential or of the session is no longer paired (DEVICE_REVOKED; one ACCESS_DENIED audit row)';

/** 403 of an operation that a retired device may still call: only the Origin guard refuses. */
export const ORIGIN_REFUSED = refusal(`Refused: ${ORIGIN}.`);

/** The 403 part of an operation with the condition `DEVICE_CREDENTIAL` (decision D113): an `extra` of `forbidden`. */
export const DEVICE_CREDENTIAL_REFUSED = `the request presented the session token of an operator who is signed in on this device, not the device credential itself (DEVICE_NOT_PAIRED, \`details.reason: ${DEVICE_CREDENTIAL_REQUIRED_REASON}\`; no audit row)`;

/** 403 of an operation whose only refusals are the Origin guard and a retired device, plus `extra`. */
export function forbidden(...extra: string[]) {
  return refusal(`Refused: ${[...extra, REVOKED, ORIGIN].join('; ')}.`);
}

/** 403 of an operation that needs `permission`: the denial is audited before the answer (RB-4). */
export function notPermitted(permission: Permission, ...extra: string[]) {
  return forbidden(`the operator's role lacks ${permission} (NOT_PERMITTED; one ACCESS_DENIED audit row)`, ...extra);
}

/** 403 of the one operation that needs one of two permissions (`setStoragePolicy`). */
export function notPermittedAnyOf(first: Permission, second: Permission) {
  return forbidden(`the operator's role holds neither ${first} nor ${second} (NOT_PERMITTED; one ACCESS_DENIED audit row)`);
}

/**
 * 403 of the audit export and the log export (RB-5): the denial keeps today's audit type
 * EXPORT_DENIED; the code is NOT_PERMITTED (FORBIDDEN stays the code of `exportEvidence` only).
 */
export function exportNotPermitted(permission: Permission) {
  return forbidden(`the operator's role lacks ${permission} (NOT_PERMITTED; one EXPORT_DENIED audit row)`);
}

/** The demo flag, checked after the permission (DC-1, DC-2). */
export const DEMO_FLAG_OFF = 'the demo flag of the server is off (DEMO_DISABLED; no audit row)';
