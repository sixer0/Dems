/**
 * The named errors of the fake transport (HB-11; backend task 04_client_integration_spec §12.2,
 * TS-11 and TS-12; AC-C-17), and the masking every text of this folder goes through.
 *
 * | Class | Raised when | Where it surfaces |
 * |-------|-------------|-------------------|
 * | `FakeTransportRequestError` | A request is not the contract's: no such route, a body or a query its schema refuses, a credential in a URL, a credential of the wrong form | The fake `fetch` rejects with it and records it |
 * | `FakeTransportResponseError` | A scripted answer is not the contract's: a status the operation does not name, a body its schema refuses, a body on a 204, a header the contract requires | Thrown by the scripting call (`stage: 'scripting'`), or rejected and recorded when a responder function built the answer (`stage: 'answering'`) |
 * | `FakeTransportUnscriptedError` | A valid request arrives and no answer was scripted for its operation | The fake `fetch` rejects with it and records it |
 * | `FakeSocketUpgradeError` | A socket is opened in a way the contract forbids: another path, a credential in the URL or in a subprotocol, a credential of the wrong form | The constructor throws it and records it |
 * | `FakeSocketMessageError` | A message is not the contract's: a server message the union refuses or the principal may not get (`direction: 'server'`, thrown by the scripting call), or a client message the union refuses (`direction: 'client'`, thrown by `send` and recorded) | See left |
 * | `FakeTransportUsageError` | The fake itself is used wrongly (no socket yet, a held answer released twice) | Thrown by the call |
 *
 * A consumer may swallow a rejection: the typed client turns any transport rejection into its
 * `NETWORK` failure (CL-1). Every error that is not thrown into the test body is therefore also
 * RECORDED, and `assertNoViolations()` of the fake throws the first one. A test ends with it.
 *
 * No message of these errors holds a value of a request: only operation IDs, route templates,
 * reasons and issue paths with their issue codes. Whatever text does get in is masked first.
 */

/** A value with the prefix of a device credential, a session token or a biometric token (01_specs §4.1, §5.6). */
const CREDENTIAL_TOKEN = /\b(dvc|ses|bio)_[A-Za-z0-9_-]*/g;
const CREDENTIAL_PREFIX = /^(dvc|ses|bio)_/;

/** True when the text holds a value that has the prefix of a credential. */
export function holdsCredential(text: string): boolean {
  CREDENTIAL_TOKEN.lastIndex = 0;
  return CREDENTIAL_TOKEN.test(text);
}

/** The text with every credential-shaped value cut down to its prefix: `ses_***`. */
export function maskCredentials(text: string): string {
  return text.replace(CREDENTIAL_TOKEN, '$1_***');
}

/**
 * A header value as the inspection output of the call log shows it. `authorization` keeps its
 * scheme and the prefix of a known credential (`Bearer ses_***`); a cookie keeps its names; any
 * other value is masked like free text.
 */
export function maskHeaderValue(name: string, value: string): string {
  const key = name.toLowerCase();
  if (key === 'authorization' || key === 'proxy-authorization') {
    const parts = /^(\S+)\s+(\S.*)$/.exec(value.trim());
    if (!parts?.[1] || parts[2] === undefined) return '***';
    const prefix = CREDENTIAL_PREFIX.exec(parts[2]);
    return `${parts[1]} ${prefix?.[1] ? `${prefix[1]}_***` : '***'}`;
  }
  if (key === 'cookie') {
    return value
      .split(';')
      .map((pair) => maskCookiePair(pair))
      .join('; ');
  }
  if (key === 'set-cookie') {
    const [first = '', ...attributes] = value.split(';');
    return [maskCookiePair(first), ...attributes.map((attribute) => attribute.trim())].join('; ');
  }
  return maskCredentials(value);
}

function maskCookiePair(pair: string): string {
  const at = pair.indexOf('=');
  return at < 0 ? '***' : `${pair.slice(0, at).trim()}=***`;
}

/** 43 characters of the alphabet of a bearer secret, and nothing secret about them. */
const FAKE_SECRET_BODY = 'FAKE-TRANSPORT-TEST-VALUE-OPENS-NOTHING'.padEnd(43, '0');
const fakeCredential = (prefix: 'ses' | 'dvc' | 'bio'): string => `${prefix}_${FAKE_SECRET_BODY}`;

/**
 * Values with the form the contract gives a session token, a device credential and a biometric
 * token, for a test that needs one (a mobile client's bearer value, for example). They are built
 * here and open nothing.
 */
export const FAKE_CREDENTIALS = {
  sessionToken: fakeCredential('ses'),
  deviceCredential: fakeCredential('dvc'),
  biometricToken: fakeCredential('bio'),
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Reasons
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Why a request is not the contract's (`FakeTransportRequestError.reason`). */
export const FakeRequestViolation = {
  /** The URL cannot be read, or it has a fragment. */
  INVALID_URL: 'INVALID_URL',
  /** No operation has this path. */
  UNKNOWN_ROUTE: 'UNKNOWN_ROUTE',
  /** The path exists, with another method; or the method is neither GET nor POST (API-2). */
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  /** The path parameter does not match the pattern its operation states. */
  INVALID_PATH_PARAM: 'INVALID_PATH_PARAM',
  /** A path parameter, a query value or the user part of the URL holds a credential (CL-6a, SR-15). */
  CREDENTIAL_IN_URL: 'CREDENTIAL_IN_URL',
  /** The query does not parse with the operation's query schema. */
  INVALID_QUERY: 'INVALID_QUERY',
  /** A query on a POST, or on a GET whose operation states none. */
  UNEXPECTED_QUERY: 'UNEXPECTED_QUERY',
  /** A header is not text, or a body travels without `content-type: application/json`. */
  INVALID_HEADERS: 'INVALID_HEADERS',
  /** `Authorization` is not `Bearer` plus a session token or a device credential, or it travels with a cookie (ID-12). */
  INVALID_CREDENTIAL_FORM: 'INVALID_CREDENTIAL_FORM',
  /** A body on a GET, or on an operation that takes none. */
  UNEXPECTED_BODY: 'UNEXPECTED_BODY',
  /** The operation needs a body and none was sent. */
  MISSING_BODY: 'MISSING_BODY',
  /** The body is not text that holds JSON. */
  BODY_NOT_JSON: 'BODY_NOT_JSON',
  /** The body is larger than the contract's limit (API-4). */
  BODY_TOO_LARGE: 'BODY_TOO_LARGE',
  /** The body does not parse with the operation's request schema. */
  INVALID_BODY: 'INVALID_BODY',
} as const;
export type FakeRequestViolation = (typeof FakeRequestViolation)[keyof typeof FakeRequestViolation];

/** Why a scripted answer is not the contract's (`FakeTransportResponseError.reason`). */
export const FakeResponseViolation = {
  /** The answer was scripted for an operation ID the table does not hold. */
  UNKNOWN_OPERATION: 'UNKNOWN_OPERATION',
  /** The operation does not name this status, and it is no pipeline answer of the envelope. */
  UNDOCUMENTED_STATUS: 'UNDOCUMENTED_STATUS',
  /** A body on a status that has none (204). */
  UNEXPECTED_BODY: 'UNEXPECTED_BODY',
  /** The body does not parse with the schema of its status. */
  INVALID_BODY: 'INVALID_BODY',
  /** A body given as raw text: the Core server sends JSON only. */
  BODY_NOT_JSON: 'BODY_NOT_JSON',
  /** A header the contract requires is missing or malformed (API-7, `retry-after`, the request ID). */
  INVALID_HEADERS: 'INVALID_HEADERS',
  /** What a responder function returned is neither an answer, an outage nor "no answer". */
  NOT_A_REPLY: 'NOT_A_REPLY',
} as const;
export type FakeResponseViolation = (typeof FakeResponseViolation)[keyof typeof FakeResponseViolation];

/** Why opening a socket is not the contract's (`FakeSocketUpgradeError.reason`). */
export const FakeUpgradeViolation = {
  /** The URL cannot be read, or its scheme is neither `ws` nor `wss`. */
  INVALID_URL: 'INVALID_URL',
  /** The path is not the socket path of the contract. */
  UNKNOWN_ROUTE: 'UNKNOWN_ROUTE',
  /** The URL has a query: the contract states none, and no token is accepted there (SR-38). */
  UNEXPECTED_QUERY: 'UNEXPECTED_QUERY',
  /** The URL or a subprotocol holds a credential (SR-38). */
  CREDENTIAL_IN_URL: 'CREDENTIAL_IN_URL',
  /** An upgrade header is not text. */
  INVALID_HEADERS: 'INVALID_HEADERS',
  /** `Authorization` is not `Bearer` plus a session token or a device credential, or it travels with a cookie (ID-12). */
  INVALID_CREDENTIAL_FORM: 'INVALID_CREDENTIAL_FORM',
} as const;
export type FakeUpgradeViolation = (typeof FakeUpgradeViolation)[keyof typeof FakeUpgradeViolation];

/** Why a socket message is not the contract's (`FakeSocketMessageError.reason`). */
export const FakeMessageViolation = {
  /** The connection is not open: nothing can be sent on it. */
  NOT_OPEN: 'NOT_OPEN',
  /** The frame is not text. */
  NOT_TEXT: 'NOT_TEXT',
  /** The frame is not JSON. */
  NOT_JSON: 'NOT_JSON',
  /** A client frame larger than the contract's limit (RT-P4). */
  TOO_LARGE: 'TOO_LARGE',
  /** The message does not parse with the union of its direction. */
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  /** A server message before `hello`: every connection gets `hello` first. */
  HELLO_FIRST: 'HELLO_FIRST',
  /** A second `hello` on one connection. */
  HELLO_TWICE: 'HELLO_TWICE',
  /** The principal of the connection may not receive, or may not send, a message of this type. */
  NOT_FOR_PRINCIPAL: 'NOT_FOR_PRINCIPAL',
  /** The topic of the message is not among the topics `hello` gave this connection. */
  TOPIC_NOT_GIVEN: 'TOPIC_NOT_GIVEN',
  /** The server closes with a code the contract does not list. */
  UNDOCUMENTED_CLOSE_CODE: 'UNDOCUMENTED_CLOSE_CODE',
  /** The client closes with a code a socket does not accept (only 1000 and 3000 to 4999). */
  INVALID_CLOSE_CODE: 'INVALID_CLOSE_CODE',
} as const;
export type FakeMessageViolation = (typeof FakeMessageViolation)[keyof typeof FakeMessageViolation];

/** When a scripted answer or a server message was checked. */
export type FakeCheckStage = 'scripting' | 'answering';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Classes
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface FakeTransportErrorDetail<Reason extends string = string> {
  readonly reason: Reason;
  readonly operationId?: string | null;
  /** `path: issue code` per failed member. Never a value. */
  readonly issues?: readonly string[];
}

function sentence(what: string, detail: FakeTransportErrorDetail): string {
  const issues = detail.issues && detail.issues.length > 0 ? `: ${detail.issues.join('; ')}` : '';
  return maskCredentials(`${what} [${detail.reason}]${issues}`);
}

/** The base of every error this folder raises. `instanceof FakeTransportError` catches them all. */
export class FakeTransportError<Reason extends string = string> extends Error {
  override readonly name: string = 'FakeTransportError';
  /** The machine-readable cause: a member of the `Fake...Violation` set of the subclass. */
  readonly reason: Reason;
  /** The operation the error is about; `null` when no operation was matched, and for a socket. */
  readonly operationId: string | null;
  /** `path: issue code` per failed member, masked. Never a value. */
  readonly issues: readonly string[];

  constructor(what: string, detail: FakeTransportErrorDetail<Reason>) {
    super(sentence(what, detail));
    this.reason = detail.reason;
    this.operationId = detail.operationId ?? null;
    this.issues = (detail.issues ?? []).map((issue) => maskCredentials(issue));
  }
}

export interface FakeRequestErrorDetail extends FakeTransportErrorDetail<FakeRequestViolation> {
  readonly method: string;
  /** The route template of the matched operation, or the path with every unknown segment replaced. Never the URL. */
  readonly route: string;
}

/** A request that is not the contract's (TS-11). */
export class FakeTransportRequestError extends FakeTransportError<FakeRequestViolation> {
  override readonly name = 'FakeTransportRequestError';
  readonly method: string;
  readonly route: string;

  constructor(detail: FakeRequestErrorDetail) {
    super(
      `Fake transport: the request ${detail.method} ${detail.route}${detail.operationId ? ` (${detail.operationId})` : ''} is not the contract's`,
      detail,
    );
    this.method = detail.method;
    this.route = detail.route;
  }
}

export interface FakeResponseErrorDetail extends FakeTransportErrorDetail<FakeResponseViolation> {
  readonly operationId: string;
  readonly status: number | null;
  readonly stage: FakeCheckStage;
}

/** A scripted answer that is not the contract's (TS-12, AC-C-17). */
export class FakeTransportResponseError extends FakeTransportError<FakeResponseViolation> {
  override readonly name = 'FakeTransportResponseError';
  readonly status: number | null;
  /** `scripting`: thrown by the call that scripted the answer. `answering`: a responder function built it. */
  readonly stage: FakeCheckStage;

  constructor(detail: FakeResponseErrorDetail) {
    super(
      `Fake transport: the scripted ${detail.status === null ? '' : `${detail.status} `}answer of ${detail.operationId} is not the contract's (checked at ${detail.stage} time; mark it { violatesContract: true } if that is the test)`,
      detail,
    );
    this.status = detail.status;
    this.stage = detail.stage;
  }
}

/** A valid request for which the test scripted no answer. */
export class FakeTransportUnscriptedError extends FakeTransportError {
  override readonly name = 'FakeTransportUnscriptedError';

  constructor(operationId: string, method: string, route: string) {
    super(`Fake transport: no answer is scripted for ${method} ${route} (${operationId})`, { reason: 'NO_ANSWER_SCRIPTED', operationId });
  }
}

/** A socket opened in a way the contract forbids. */
export class FakeSocketUpgradeError extends FakeTransportError<FakeUpgradeViolation> {
  override readonly name = 'FakeSocketUpgradeError';

  constructor(reason: FakeUpgradeViolation, issues: readonly string[] = []) {
    super("Fake transport: the socket upgrade is not the contract's", { reason, issues });
  }
}

export interface FakeMessageErrorDetail {
  readonly reason: FakeMessageViolation;
  readonly direction: 'server' | 'client';
  /** The `type` member of the message, when it is a string. */
  readonly type?: string | null;
  readonly issues?: readonly string[];
}

/** A socket message that is not the contract's, or that cannot be sent in the state of the connection. */
export class FakeSocketMessageError extends FakeTransportError<FakeMessageViolation> {
  override readonly name = 'FakeSocketMessageError';
  /** `server`: a message the test scripted. `client`: a message the client under test sent. */
  readonly direction: 'server' | 'client';
  readonly type: string | null;

  constructor(detail: FakeMessageErrorDetail) {
    super(
      detail.direction === 'server'
        ? `Fake transport: the scripted server message${detail.type ? ` "${detail.type}"` : ''} is not the contract's (mark it { violatesContract: true } if that is the test)`
        : `Fake transport: the client message${detail.type ? ` "${detail.type}"` : ''} is not the contract's`,
      { reason: detail.reason, ...(detail.issues ? { issues: detail.issues } : {}) },
    );
    this.direction = detail.direction;
    this.type = detail.type ?? null;
  }
}

/** The fake itself is used wrongly. A programming error of the test, not a finding about the client. */
export class FakeTransportUsageError extends FakeTransportError {
  override readonly name = 'FakeTransportUsageError';

  constructor(message: string, reason = 'USAGE') {
    super(`Fake transport: ${message}`, { reason });
  }
}
