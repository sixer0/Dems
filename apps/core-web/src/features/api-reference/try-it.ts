/**
 * Try-it rules of the API Reference page that do not depend on the simulator (backend task
 * 04_client_integration_spec §11 AR-2, AR-3, AR-3a, AR-9; security design review SD-16; plan row
 * W84).
 *
 * | Mode | A request to | Goes |
 * |------|--------------|------|
 * | Live | `{page origin}/api/v1/*`, not one of the ten of AR-3a | To the network unchanged, with the browser's session cookie (`credentials: 'same-origin'`): the Core server answers as the signed-in operator and audits it. `sim.request` is never called |
 * | Live | One of the ten operations whose body or answer holds a secret | Nowhere: rejected before any request (`TryItRefusedError`, reason `SECRET`) |
 * | Live | Anything outside `{page origin}/api/v1` | Nowhere: `BlockedRequestError`, as in Simulated mode |
 * | Simulated, "Show Core-server endpoints" on | One of the 65 operations only the Core server answers | Nowhere: rejected before any request (`TryItRefusedError`, reason `CORE_SERVER`); the page never fabricates an answer (sim-fetch.ts) |
 *
 * The deny list is matched on the request as sent and again on a normalised form of its path
 * (percent-decoded, lower case, repeated and trailing slashes folded), so a spelling the server
 * might route to the same operation is refused too. A refusal is written to the page's own log
 * with the method and the path only (log.ts).
 */
import {
  API_BASE_PATH,
  CORE_API_OPERATIONS,
  isOfflineCoreApiOperation,
  matchCoreApiOperation,
  type CoreApiRegistryOperation,
} from '@dems/shared/api'
import { coreHttpOrigin } from '@/lib/core-endpoint'
import { logApiReference } from './log'
import type { FetchLike, TryItExchange } from './sim-fetch'

/**
 * AR-3a: the operations whose request body or answer holds a secret. Six of the backend task
 * (01_specs §7.7): a password (`signIn`), a biometric token (`setBiometricEnrollment`,
 * `signInWithBiometric`), a pairing code (`issuePairingCode`), a device credential
 * (`redeemPairingCode`, `rotateDeviceCredential`). Two of task 3 (blueprint row 113, fix round 1,
 * navigator finding N-2): a camera credential in the body (`setCaptureDeviceCredential`, op 89) and
 * the write-only STT credential in the body (`updateSttConfig`, op 91). Two of the camera connect
 * flow (task 3 R-9, blueprint row 132, decision D106; C3 §2.6 "Web Try-it", §10.1): a camera
 * credential in the body of the connection test (`testCaptureCandidateConnection`, op 95) and of the
 * adoption (`adoptCaptureCandidate`, op 96). Ten in all. They stay documented; only Try-it is
 * refused. The read and the test of the STT configuration (ops 90, 92) and the camera search, its
 * candidate read and the microphone re-read (ops 93, 94, 97) carry no credential and stay allowed.
 */
export const TRY_IT_DENIED_OPERATIONS = [
  'signIn',
  'setBiometricEnrollment',
  'signInWithBiometric',
  'issuePairingCode',
  'redeemPairingCode',
  'rotateDeviceCredential',
  'setCaptureDeviceCredential',
  'updateSttConfig',
  'testCaptureCandidateConnection',
  'adoptCaptureCandidate',
] as const
export type TryItDeniedOperation = (typeof TRY_IT_DENIED_OPERATIONS)[number]

const DENIED = new Set<string>(TRY_IT_DENIED_OPERATIONS)

/** AR-2: the operations only the Core server answers (75 minus the ten of the offline scope). */
export const CORE_SERVER_ONLY_OPERATIONS: readonly CoreApiRegistryOperation[] = CORE_API_OPERATIONS.filter(
  (operation) => !isOfflineCoreApiOperation(operation),
)
const CORE_SERVER_ONLY = new Set<string>(CORE_SERVER_ONLY_OPERATIONS.map((operation) => operation.operationId))

/** Rejection for a URL outside the Core API (nothing is sent). Re-exported by sim-fetch.ts. */
export class BlockedRequestError extends TypeError {
  readonly url: string
  constructor(url: string, coreOrigin: string = coreHttpOrigin()) {
    super(`Blocked: ${url} is outside the local Core API (${coreOrigin}${API_BASE_PATH}).`)
    this.name = 'BlockedRequestError'
    this.url = url
  }
}

/** Why a Try-it request was refused before it was sent. */
export type TryItRefusal = 'SECRET' | 'CORE_SERVER'

/** A Try-it request refused before any request (Scalar shows its message in its own toast and response panel). */
export class TryItRefusedError extends Error {
  readonly reason: TryItRefusal
  readonly method: string
  readonly path: string
  constructor(reason: TryItRefusal, message: string, method: string, path: string) {
    super(message)
    this.name = 'TryItRefusedError'
    this.reason = reason
    this.method = method
    this.path = path
  }
}

/** A path as a router might read it: percent-decoded, lower case, `//` folded, no trailing `/`. */
export function normaliseTryItPath(pathname: string): string {
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // Not valid percent-encoding: compare the raw text (the server refuses it as a malformed path).
  }
  const folded = decoded.toLowerCase().replace(/\/{2,}/g, '/')
  return folded.length > 1 ? folded.replace(/\/+$/, '') : folded
}

/** A path template of the registry as a pattern over a normalised path. */
function templatePattern(template: string): RegExp {
  const source = template
    .toLowerCase()
    .split('/')
    .map((segment) => (/^\{\w+\}$/.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/')
  return new RegExp(`^${source}$`)
}

const DENIED_ROUTES = CORE_API_OPERATIONS.filter((operation) => DENIED.has(operation.operationId)).map((operation) => ({
  operationId: operation.operationId,
  pattern: templatePattern(operation.path),
}))

/**
 * The denied operation a request names, or null. A request is denied when it matches one of the
 * six as sent, or when its normalised path is one of theirs and it is not another (allowed)
 * operation of the same path (`GET /api/v1/pairing/code` reads the code's status, never the code,
 * and stays allowed beside the denied `POST`).
 */
export function deniedTryItOperation(method: string, pathname: string): TryItDeniedOperation | null {
  const exact = matchCoreApiOperation(method, pathname)
  if (exact && DENIED.has(exact.operation.operationId)) return exact.operation.operationId as TryItDeniedOperation
  if (exact) return null
  const normalised = normaliseTryItPath(pathname)
  const allowed = matchCoreApiOperation(method, normalised)
  if (allowed && !DENIED.has(allowed.operation.operationId)) return null
  const route = DENIED_ROUTES.find((candidate) => candidate.pattern.test(normalised))
  return route ? (route.operationId as TryItDeniedOperation) : null
}

/**
 * The Core-server-only operation a request names, or null (AR-2). The ten operations of the
 * offline scope never match: the registry's routes do not overlap, so `GET /api/v1/session/current`
 * is `getCurrentSession`, whatever template another operation has.
 */
export function coreServerOnlyOperation(method: string, pathname: string): string | null {
  const match = matchCoreApiOperation(method, pathname)
  return match && CORE_SERVER_ONLY.has(match.operation.operationId) ? match.operation.operationId : null
}

export interface LiveTryItFetchOptions {
  /** The sentence of AR-3a, in the page's language: the message of a refusal. */
  secretRefusal: string
  /** The network `fetch`. Defaults to the global `fetch` (the browser attaches the session cookie). */
  networkFetch?: FetchLike
  /** Called after every answered exchange (not for refused, blocked or failed ones). */
  onExchange?: (exchange: TryItExchange) => void
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function isRequest(input: string | URL | Request): input is Request {
  return typeof input === 'object' && !(input instanceof URL)
}

/** The headers of the request, as a plain record (a `Headers` of the request, then `init.headers` over it). */
function requestHeaders(input: string | URL | Request, init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {}
  if (isRequest(input)) input.headers.forEach((value, name) => (headers[name] = value))
  if (init?.headers !== undefined) new Headers(init.headers).forEach((value, name) => (headers[name] = value))
  return headers
}

async function requestBodyText(input: string | URL | Request, init?: RequestInit): Promise<string | undefined> {
  if (init?.body !== undefined && init.body !== null) {
    if (typeof init.body === 'string') return init.body
    return new Response(init.body).text()
  }
  if (isRequest(input) && input.body !== null) return input.clone().text()
  return undefined
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

/**
 * Builds Scalar's `customFetch` for Live mode (AR-3, AR-3a). The request is passed on as a URL and
 * a plain init (method, headers, body text, `credentials: 'same-origin'`, the abort signal), so
 * nothing but what Scalar built travels, and the body is read once, here, and kept nowhere.
 */
export function createLiveTryItFetch(options: LiveTryItFetchOptions): FetchLike {
  const { secretRefusal, onExchange } = options
  const networkFetch: FetchLike = options.networkFetch ?? ((input, init) => globalThis.fetch(input, init))
  const coreBase = coreHttpOrigin()
  const coreOrigin = new URL(coreBase).origin

  return async function liveTryItFetch(input, init) {
    const raw = requestUrl(input)
    let url: URL
    try {
      url = new URL(raw, coreBase)
    } catch {
      throw new BlockedRequestError(raw, coreBase)
    }
    const method = (init?.method ?? (isRequest(input) ? input.method : undefined) ?? 'GET').toUpperCase()
    const inCoreApi =
      url.origin === coreOrigin && (url.pathname === API_BASE_PATH || url.pathname.startsWith(`${API_BASE_PATH}/`))
    if (!inCoreApi) {
      const blocked = new BlockedRequestError(url.origin + url.pathname, coreBase)
      logApiReference('warn', 'liveTryIt.blocked', blocked, 'A Try-it request outside the Core API was blocked.', {
        method,
        path: url.pathname,
      })
      throw blocked
    }
    if (deniedTryItOperation(method, url.pathname) !== null) {
      const refused = new TryItRefusedError('SECRET', secretRefusal, method, url.pathname)
      logApiReference('warn', 'liveTryIt.denied', refused, 'A Try-it request of an operation that carries a secret was refused.', {
        method,
        path: url.pathname,
      })
      throw refused
    }

    const body = method === 'GET' || method === 'HEAD' ? undefined : await requestBodyText(input, init)
    const signal = init?.signal ?? (isRequest(input) ? input.signal : undefined)
    let response: Response
    try {
      response = await networkFetch(url.href, {
        method,
        headers: requestHeaders(input, init),
        ...(body !== undefined ? { body } : {}),
        credentials: 'same-origin',
        ...(signal ? { signal } : {}),
      })
    } catch (error) {
      if (!isAbort(error)) {
        logApiReference('warn', 'liveTryIt.network', error, 'A Try-it request did not reach the Core server.', {
          method,
          path: url.pathname,
        })
      }
      throw error
    }
    onExchange?.({ mode: 'live', method, path: url.pathname, status: response.status })
    return response
  }
}
