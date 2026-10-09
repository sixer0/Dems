/**
 * The OpenAPI 3.1.0 document of the Core API v1 (masterplan/01_specs.md §14.9; D26, D31, D45;
 * AC-56; backend task 2026-10-04: 01_specs §7.1 API-12, §7.19; 02_plan §16; 04_client_integration_spec
 * §11 AR-1).
 *
 * The registry holds 97 operations (C3 §10.1: 89 + the STT configuration ops 90-92 + the camera-search
 * ops 93-97), and the builder
 * writes one of two documents from it:
 *
 * | | `offline` (the default) | `all` |
 * |---|---|---|
 * | Describes | What a client can call without the Core server: Simulated mode | The API as the Core server answers it: Live mode |
 * | Operations | 31: `GET /api/v1/health` (mock-core), the 9 book §21.2 endpoints, the 13 simulated capture/transcript endpoints (the in-app simulator, OD-17), the 3 STT configuration endpoints (ops 90-92) and the 5 camera-search endpoints (ops 93-97) | 97 |
 * | Who reads it | The API Reference page in Simulated mode: `createOpenApiDocument()` | The committed `openapi/openapi.json`, its drift test, and the API Reference page in Live mode |
 * | `info.version` | 0.2.0 (grew from 0.1.0 at M2: OD-17 adds the simulated capture ops) | 0.3.0 (grew from 0.2.1 at M2: capture/transcript ops 76-89) |
 * | Servers | mock-core | The Core server `http://127.0.0.1:4420`, then mock-core |
 * | Security | none: the simulator acts as the operator signed in to the console | Two schemes, the session cookie and HTTP bearer; each operation states which it takes |
 * | Badges | LIVE on health, SIMULATED on the thirty, RBAC + AUDIT on the export | LIVE on all 97: the Core server answers each over the network |
 * | Per operation | `x-badges`, `x-dems-mode`, `x-dems-source`, and `x-dems-rbac` on the four simulated commands | Also `x-dems-access`, `x-dems-audit`, `x-dems-services`, `security`, the Core server's text (`coreServerDescription`) and the statuses only the Core server sends |
 * | Response headers | `x-dems-simulated` on the nine | `x-request-id` on every answer of the Core server, `x-dems-epoch` and `x-dems-revision` on a 2xx of a POST |
 * | `components.responses` | none | The answers defined once for every operation |
 * | Realtime tag | mock-core's heartbeat socket | Both sockets; the Core server's protocol in full |
 *
 * The `offline` document was, byte for byte, the document of the baseline commit `acaff20` until M2.
 * OD-17 (D4) supersedes that pin: the in-app simulator now emulates v2, so the 13 simulated capture
 * and transcript operations join the ten baseline operations (offline grows 10 -> 23, `info.version`
 * 0.1.0 -> 0.2.0). test/api-openapi-scope.test.ts holds every section of it to the OD-17 scope and to
 * the baseline commit only where a section is unchanged. Nothing this file does for the `all` scope
 * may change it.
 *
 * - No vendor extension beyond `x-badges` (Scalar's native badge extension) and `x-dems-*`: no
 *   `x-scalar-*`, no `x-pre-request` / `x-post-response` scripts, no code-sample extension, so a
 *   document enables no renderer feature beyond display (D45). The names inside a `headers` map
 *   (`x-request-id`, `x-dems-epoch`, `x-dems-revision`, `x-dems-simulated`) are HTTP header names,
 *   not extensions.
 * - `components.schemas` are generated from the shared zod schemas (`CORE_API_SCHEMAS`) with
 *   `z.toJSONSchema` (JSON Schema 2020-12, the OpenAPI 3.1 dialect), so the document, the form
 *   validation, the server's validation and the simulator's bodies cannot drift apart.
 * - WebSockets cannot be modelled in OpenAPI: WS `/ws` is described in the Realtime tag, and its
 *   messages are components (`Heartbeat`; in the `all` scope the `Realtime*` and `*Slice` ones).
 *
 * The builder runs on demand (a few milliseconds), never at import time, so mock-core and the
 * mobile app pay nothing for importing `@dems/shared/api`. Every call returns a fresh object
 * that the caller may filter or hand to a renderer that mutates its input.
 *
 * `npm run openapi:gen -w @dems/shared` (scripts/gen-openapi.ts) writes the `all` scope to
 * packages/shared/openapi/openapi.json; the test fails when the committed file drifts from this
 * module.
 */
import { z } from 'zod';
import { palette } from '../tokens/tokens';
import {
  API_PAGE_LIMIT_DEFAULT,
  API_PAGE_LIMIT_MAX,
  CORE_HTTP_ORIGIN,
  CORE_SERVER_HTTP_ORIGIN,
  CORE_SERVER_PORT,
  CORE_SERVER_SERVICE_NAME,
  CORE_SERVER_WS_URL,
  CORE_WS_URL,
  EPOCH_HEADER_NAME,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_AFTER_MS,
  RECONNECT_BACKOFF_MS,
  RECONNECT_JITTER_MS,
  REALTIME_RESYNC_MIN_INTERVAL_MS,
  REQUEST_ID_HEADER_NAME,
  RETRY_AFTER_HEADER_NAME,
  REVISION_HEADER_NAME,
  SERVICE_NAME,
  WS_PATH,
} from './constants';
import {
  CORE_API_ENVELOPE_RESPONSES,
  CORE_API_SCHEMAS,
  CoreApiAccessKind,
  CoreApiMode,
  CoreApiScope,
  CoreApiService,
  CoreApiTag,
  coreApiAccessPermissions,
  describeCoreApiAccess,
  listCoreApiOperations,
  listCoreApiResponseStatuses,
  type CoreApiAccess,
  type CoreApiMethod,
  type CoreApiRegistryOperation,
  type CoreApiSchemaName,
} from './core-api';
import { CORE_API_EXAMPLES, HEARTBEAT_EXAMPLE, type OpenApiExample, type OperationExamples } from './examples';
import { REALTIME_CLIENT_EXAMPLES, REALTIME_SERVER_EXAMPLES } from './realtime-examples';
import {
  REALTIME_CLIENT_MESSAGES,
  REALTIME_CLOSE_CODES,
  REALTIME_SERVER_MESSAGES,
  RealtimePrincipal,
  canReceiveRealtimeMessage,
} from './realtime-messages';
import { REPLICATED_SLICE_NAMES, UNREPLICATED_SLICE_NAMES } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════════════

export const OPENAPI_VERSION = '3.1.0';
/** `info.version` of the `offline` scope: the version of that API description (the server strip's "Spec version"). */
// 0.2.0 since M2 (blueprint row 50; OD-17 D4): the in-app simulator emulates v2, so the 13 simulated
// capture/transcript operations join the ten baseline operations (offline grows 10 -> 23).
export const OPENAPI_DOCUMENT_VERSION = '0.2.0';
/** `info.version` of the `all` scope (API-12): the version of the Core server, which answers it. */
// 0.3.0 since M2 (blueprint row 50; C3 §8): the capture/transcript operations 76-89, the nine new
// error codes and audit types, and the modified operations of C3 §3. Was 0.2.1 since the contract
// close-out W83 (decision D184 DQ-8): a documented envelope 400, the all-scope texts of two statuses,
// the strict answers of contract A.
export const OPENAPI_CORE_SERVER_DOCUMENT_VERSION = '0.3.0';
export const OPENAPI_TITLE = 'DEMS Core API';

/**
 * The two security schemes of the `all` scope (API-12), by their `components.securitySchemes` name.
 * - `sessionCookie`: the session of a web console, in an `HttpOnly` cookie the browser attaches.
 * - `bearerAuth`: a paired device. `Authorization: Bearer` carries its device credential (`dvc_`)
 *   on the DEVICE operations and at sign-in, and its session token (`ses_`) once an operator is
 *   signed in on it.
 */
export const OpenApiSecurityScheme = { SESSION_COOKIE: 'sessionCookie', BEARER: 'bearerAuth' } as const;
export type OpenApiSecurityScheme = (typeof OpenApiSecurityScheme)[keyof typeof OpenApiSecurityScheme];

/**
 * The cookie name the document shows: the main instance's (ID-P7). The name is
 * `dems_session_<listen port>`, so a lane instance on another port uses another name.
 */
export const OPENAPI_SESSION_COOKIE_NAME = `dems_session_${CORE_SERVER_PORT}`;

/** Header on every simulated response (AC-58). The sim handlers set it; the OpenAPI document documents it. */
export const SIMULATED_HEADER_NAME = 'x-dems-simulated';
export const SIMULATED_HEADER_VALUE = '1';

/** Badges shown next to operation titles (`x-badges`) and in the page legend. Tones follow `StatusTone`. */
export const API_BADGES = {
  LIVE: { name: 'LIVE', tone: 'success', color: palette.success },
  SIMULATED: { name: 'SIMULATED', tone: 'warning', color: palette.warning },
  RBAC_AUDIT: { name: 'RBAC + AUDIT', tone: 'danger', color: palette.danger },
} as const;
export type ApiBadgeKey = keyof typeof API_BADGES;

/** The only `x-` extension keys the document may contain (D45): Scalar's display badge and our own namespace. */
export const OPENAPI_ALLOWED_EXTENSION = /^x-(badges$|dems-)/;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Document types (the subset this builder emits)
// ═══════════════════════════════════════════════════════════════════════════════════════

export type JsonSchemaObject = { [key: string]: unknown };
export interface OpenApiReference {
  $ref: string;
}
export interface OpenApiBadge {
  name: string;
  position?: 'before' | 'after';
  color?: string;
}
export interface OpenApiMediaType {
  schema: OpenApiReference;
  examples?: Record<string, OpenApiExample<unknown>>;
}
export interface OpenApiResponseObject {
  description: string;
  headers?: Record<string, OpenApiReference>;
  content?: { 'application/json': OpenApiMediaType };
}
export interface OpenApiParameterObject {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  description: string;
  /** A path parameter is a string with a pattern; a query parameter carries the JSON Schema of its member. */
  schema: { type?: string; pattern?: string; [key: string]: unknown };
  example?: string;
}
/** One alternative of `security`: the schemes a request needs together. `{}` means none is needed. */
export type OpenApiSecurityRequirement = Partial<Record<OpenApiSecurityScheme, string[]>>;
export type OpenApiSecuritySchemeObject =
  | { type: 'apiKey'; in: 'cookie'; name: string; description: string }
  | { type: 'http'; scheme: 'bearer'; description: string };

export interface OpenApiOperationObject {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  parameters?: OpenApiParameterObject[];
  requestBody?: { required: boolean; content: { 'application/json': OpenApiMediaType } };
  /** Scope `all` only: the credential the operation takes, from its access rule. `[]`: none. */
  security?: OpenApiSecurityRequirement[];
  responses: Record<string, OpenApiResponseObject>;
  'x-badges': OpenApiBadge[];
  'x-dems-mode': CoreApiMode;
  'x-dems-source': string;
  'x-dems-rbac'?: { permission: string; roles: string[]; audit: string[] };
  /** Scope `all` only: the access rule (01_specs §4.2), as its marker and its parts. */
  'x-dems-access'?: { rule: string; permissions: string[]; conditions: string[] };
  /** Scope `all` only: the audit rule (API-8). */
  'x-dems-audit'?: { success: string; denial: string; also: string[] };
  /** Scope `all` only: the services that answer the operation over the network. */
  'x-dems-services'?: string[];
}
export type OpenApiPathItem = Partial<Record<CoreApiMethod, OpenApiOperationObject>>;
export interface OpenApiTagObject {
  name: string;
  description: string;
  'x-dems-mode'?: CoreApiMode;
}
export interface OpenApiDocument {
  openapi: typeof OPENAPI_VERSION;
  info: { title: string; version: string; summary: string; description: string };
  servers: { url: string; description: string }[];
  tags: OpenApiTagObject[];
  paths: Record<string, OpenApiPathItem>;
  components: {
    schemas: Record<string, JsonSchemaObject>;
    headers: Record<string, { description: string; required: boolean; schema: JsonSchemaObject }>;
    /** Scope `all` only: the answers defined once for every operation (`CORE_API_ENVELOPE_RESPONSES`). */
    responses?: Record<string, OpenApiResponseObject>;
    /** Scope `all` only: the session cookie and HTTP bearer (API-12). */
    securitySchemes?: Record<OpenApiSecurityScheme, OpenApiSecuritySchemeObject>;
  };
}

export interface CreateOpenApiDocumentOptions {
  /** Default true. False keeps only the LIVE operations ("Show simulated endpoints" off). */
  includeSimulated?: boolean;
  /**
   * Default `offline`: the 31 operations a client can call without the Core server (OD-17; ops 90-92, 93-97). `all`:
   * every operation of the registry, as the Core server answers it (see the file header).
   */
  scope?: CoreApiScope;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Text
// ═══════════════════════════════════════════════════════════════════════════════════════

// The texts of the `offline` scope are those of the baseline document and do not change: they
// describe Simulated mode, where mock-core answers health and the in-app simulator the nine. The
// `all` scope has texts of its own, below, which describe the Core server.

const INFO_SUMMARY =
  'Core API v1 of the DEMS Edge Client demo: one live endpoint on the local mock-core, nine simulated in the browser.';

const INFO_DESCRIPTION = [
  'Reference for the Core API v1 of the **DEMS Edge Client demo** (device DEMS-IR-01). The design book (§21.2) names nine endpoints; this document adds their request and response bodies, plus the local service-liveness endpoint.',
  '### Live and simulated',
  [
    '| Badge | Meaning |',
    '|---|---|',
    `| **LIVE** | Served over the network by mock-core at \`${CORE_HTTP_ORIGIN}\`. |`,
    `| **SIMULATED** | Answered in the browser by the demo simulator. Responses carry \`${SIMULATED_HEADER_NAME}: ${SIMULATED_HEADER_VALUE}\`; no request leaves the machine. |`,
    '| **RBAC + AUDIT** | The simulator checks the role of the operator signed in to this console and writes a tamper-evident audit row. |',
  ].join('\n'),
  'Every operation also states `x-dems-mode: live` or `x-dems-mode: simulated`.',
  '### Not defined in the design book',
  [
    'The design book names the endpoint concepts only. It does not define:',
    '- authentication or login, pairing, metadata submission, evidence list, audit list or verification endpoints (left out here on purpose);',
    '- a WebSocket path or message schema (`/ws` and the heartbeat message are this demo\'s choice; see the Realtime tag);',
    '- request or response bodies (every body in this document is a demo definition);',
    '- an authentication scheme (the simulated endpoints act as the operator signed in to this console).',
  ].join('\n'),
  '### Examples',
  'Examples are frozen at 2026-10-01 10:00:00 WIB and follow the canonical demo dataset: session SES-20261001-0024 (case LP/2026/1001-0007, 00:18:42 into the recording) and evidence EV-20260930-0004, exported by the SUPERVISOR operator. Simulated responses write times at UTC+07:00 (WIB); mock-core writes UTC. The live simulator dates IDs from its own clock, so only the date part differs from these examples. All data is synthetic.',
].join('\n\n');

/** `info.summary` of the `all` scope, for a document of `count` operations. */
const coreServerInfoSummary = (count: number): string =>
  `Core API v1 of the DEMS Edge Client demo, as the Core server answers it: ${count} operations and one WebSocket channel.`;

/** `info.description` of the `all` scope. */
const CORE_SERVER_INFO_DESCRIPTION = [
  'Reference for the Core API v1 of the **DEMS Edge Client demo** (device DEMS-IR-01), as the **Core server** answers it. The design book (§21.2) names nine endpoints; this document adds their bodies, and the operations both clients need beyond them: sign-in, user administration, pairing, the session lifecycle, evidence, devices, storage, network and time, security and audit, system, alerts and the demo controls.',
  '### Who answers',
  [
    '| Service | Address | Answers |',
    '|---|---|---|',
    `| The Core server (\`${CORE_SERVER_SERVICE_NAME}\`) | \`${CORE_SERVER_HTTP_ORIGIN}\` | Every operation of this document and \`WS ${WS_PATH}\`. It keeps the Core state in PostgreSQL and is the only authority on who may do what. Loopback only. |`,
    `| mock-core (\`${SERVICE_NAME}\`) | \`${CORE_HTTP_ORIGIN}\` | \`GET /api/v1/health\` and a heartbeat-only \`WS ${WS_PATH}\`. It is the service of Simulated mode and answers no other operation. |`,
    `| The in-app simulator | none | In Simulated mode, the nine design-book operations (\`x-dems-mode: simulated\`), inside the app and without a request. Its answers carry \`${SIMULATED_HEADER_NAME}: ${SIMULATED_HEADER_VALUE}\`; the Core server never sends that header. |`,
  ].join('\n'),
  'Every operation carries the badge **LIVE**: the Core server answers it over the network. `x-dems-services` names the services that answer an operation, and `x-dems-mode` says whether the in-app simulator can answer it too (`simulated`) or only a service can (`live`).',
  '### Access',
  [
    'The Core server decides on every request, before the body is read, from the credential the request carries:',
    `- a **web console** sends the session cookie that \`signIn\` set (scheme \`${OpenApiSecurityScheme.SESSION_COOKIE}\`);`,
    `- a **paired device** sends \`Authorization: Bearer\` (scheme \`${OpenApiSecurityScheme.BEARER}\`): its device credential on the device operations and at sign-in, its session token once an operator is signed in.`,
  ].join('\n'),
  'A request carries one credential, never both. Each operation states its access rule as `x-dems-access` (PUBLIC, DEVICE, AUTHENTICATED, one permission, or the one any-of) and the audit row it writes as `x-dems-audit`. A refusal for a missing permission answers `403` and writes one audit row; the role and its permissions are read from the database for each request.',
  '### Answers every operation shares',
  `The answers that do not depend on the operation are defined once, under Responses: a malformed path, an unknown route, a wrong method, a server that is not ready, an Origin outside the allowed lists, two credentials in one request, the request throttle, a body over 65,536 bytes, and an unexpected failure. Every answer carries \`${REQUEST_ID_HEADER_NAME}\`, and an error repeats it as \`error.requestId\`. A 2xx answer of a POST carries \`${EPOCH_HEADER_NAME}\` and \`${REVISION_HEADER_NAME}\`: the state revision that holds the effect of the command.`,
  '### Lists',
  `A list is cursor-paged: \`cursor\` is the \`nextCursor\` of the page before, \`limit\` is 1 to ${API_PAGE_LIMIT_MAX} (${API_PAGE_LIMIT_DEFAULT} when omitted), and \`nextCursor\` is null on the last page.`,
  '### Not part of this API',
  [
    '- Media and evidence package files are not served: the clients keep their bundled demo media, and the server owns the records, the hashes and the verdicts.',
    '- No operation creates or deletes a user, changes a password or edits the role matrix.',
    '- No operation takes a file or resolves a path that a client sent.',
  ].join('\n'),
  '### Examples',
  'Examples are frozen at 2026-10-01 10:00:00 WIB and follow the canonical demo dataset: session SES-20261001-0024 (case LP/2026/1001-0007) and evidence EV-20260930-0004, exported by the SUPERVISOR operator. The nine design-book operations write times as ISO-8601 text; every other operation writes epoch milliseconds on the server clock. A password, a pairing code, a session token, a device credential and a biometric token appear only as placeholders that open nothing. All data is synthetic.',
].join('\n\n');

/** mock-core's socket, as the `offline` Realtime tag has always described it: three paragraphs. */
const MOCK_CORE_SOCKET_INTRO = `**LIVE** WebSocket \`${CORE_WS_URL}\` served by mock-core. OpenAPI 3.1 cannot describe a socket, so it is documented here and shown live in the Realtime panel next to this reference.`;
const MOCK_CORE_SOCKET_RULES = [
  `- Server to client only: one JSON \`Heartbeat\` message (see the Heartbeat model) per text frame every ${HEARTBEAT_INTERVAL_MS} ms, plus one immediately after connecting.`,
  '- `seq` counts ticks since the server started. `sessionState` is `null` in this demo phase.',
  '- Upgrades from origins other than the web dev origins and the service\'s own origins are refused with 403.',
  `- Clients show the link as STALE after ${HEARTBEAT_STALE_AFTER_MS} ms without a heartbeat and reconnect after ${RECONNECT_BACKOFF_MS.map((ms) => `${ms / 1000} s`).join(', ')} (the last delay repeats), plus up to ${RECONNECT_JITTER_MS} ms of jitter.`,
  '- Messages sent by clients are ignored.',
].join('\n');
const HEARTBEAT_EXAMPLE_BLOCK = `Example message:\n\n\`\`\`json\n${JSON.stringify(HEARTBEAT_EXAMPLE, null, 2)}\n\`\`\``;

/**
 * The tag texts. For the six tags of the `offline` scope these are the baseline's; the tags of the
 * operations that only the Core server answers have one text for both scopes.
 */
const TAG_DESCRIPTIONS: Record<CoreApiTag, string> = {
  [CoreApiTag.SERVICE]: 'Liveness of the local mock-core service. **LIVE.**',
  [CoreApiTag.SESSION]:
    'Session lifecycle (book §6.2): CREATE → PRECHECK → ARMED → RECORDING → STOPPING → FINALIZING → SEALED. **SIMULATED.**',
  [CoreApiTag.DEVICE]: 'Device health, audio channels and video tracks (book §6.1, §21.2). **SIMULATED.**',
  [CoreApiTag.STORAGE]: 'Evidence storage capacity and state. **SIMULATED.**',
  [CoreApiTag.EVIDENCE]: 'Authorized export with chain of custody (book §19.2, §19.3). **SIMULATED**, RBAC + audit.',
  [CoreApiTag.IDENTITY]:
    'Sign-in, the caller\'s own auth session, and biometric sign-in on a paired device. The server is the only authority: a web console holds its session in an `HttpOnly` cookie, a paired device sends a bearer value. Answered by the Core server.',
  [CoreApiTag.ADMINISTRATION]:
    'The role and permission matrix (read-only) and user administration: assign a role, enable, disable. Answered by the Core server.',
  [CoreApiTag.PAIRING]:
    'One-time pairing codes and the registry of paired devices. A device pairs by entering a code that a Supervisor issued. Answered by the Core server.',
  [CoreApiTag.DEMO]:
    'Scenarios, fault injection and the reset to the seed state, behind DEMO_CONTROL and the server-side demo flag. Answered by the Core server.',
  [CoreApiTag.NETWORK]:
    'The network of the Core device and its time service: simulated hardware signals, read-only. The time service is not the server clock, which stamps every record. Answered by the Core server.',
  [CoreApiTag.SECURITY]:
    'The security status, the audit log and its hash chain, the audit and log exports, and the operational events. Every signed-in role reads; the two exports need AUDIT_EXPORT. Answered by the Core server.',
  [CoreApiTag.SYSTEM]:
    'The Core device, its services, diagnostics, the simulated software update and the display preferences. Answered by the Core server.',
  [CoreApiTag.ALERTS]:
    'The alerts of the Core and their acknowledgement. Every alert was raised by a fault, and raising it wrote a FAULT_RAISED audit row. Answered by the Core server.',
  [CoreApiTag.REALTIME]: [MOCK_CORE_SOCKET_INTRO, MOCK_CORE_SOCKET_RULES, HEARTBEAT_EXAMPLE_BLOCK].join('\n\n'),
};

/**
 * Scope `all`: the texts of the five tags that the `offline` scope describes as mock-core's or the
 * simulator's. Here they describe the Core server, which answers every operation of the tag.
 */
const CORE_SERVER_TAG_DESCRIPTIONS: Partial<Record<CoreApiTag, string>> = {
  [CoreApiTag.SERVICE]:
    'Liveness of the service that answers: the Core server, or mock-core in Simulated mode. Public; it returns nothing of the Core state.',
  [CoreApiTag.SESSION]:
    'Session lifecycle (book §6.2): CREATE → PRECHECK → ARMED → RECORDING → STOPPING → FINALIZING → SEALED, with FAULT and RECOVERY after a critical fault. One session is open per Core. The commands need SESSION_START; markers, notes and snapshots need SESSION_NOTE; every role reads the open session and the history. Answered by the Core server; in Simulated mode the in-app simulator answers the four design-book operations.',
  [CoreApiTag.DEVICE]:
    'The devices of the Core (book §6.1, §21.2): health, audio channels, video tracks, the inventory and the device commands. AUDIO-01 and AUDIO-02 are reported separately in every answer. Answered by the Core server; in Simulated mode the in-app simulator answers the three design-book reads.',
  [CoreApiTag.STORAGE]:
    'Evidence storage: capacity, state, history and the retention policy. Answered by the Core server; in Simulated mode the in-app simulator answers the design-book status read.',
  [CoreApiTag.EVIDENCE]:
    'Evidence items with their tracks, hashes, custody chain and verification, and the authorized export with chain of custody (book §19.2, §19.3). No operation changes a sealed item, and none serves a media file. Answered by the Core server; in Simulated mode the in-app simulator answers the design-book export.',
};

/**
 * Scope `all`: the Realtime tag. It names both sockets, then describes the Core server's protocol
 * in full and mock-core's heartbeat with the rules and the example of the `offline` text.
 */
function allScopeRealtimeDescription(): string {
  return [
    `WebSocket \`${WS_PATH}\`. OpenAPI 3.1 cannot describe a socket, so it is documented here. Two services serve it:`,
    [
      '| Service | URL | Sends |',
      '|---|---|---|',
      `| The Core server (\`${CORE_SERVER_SERVICE_NAME}\`) | \`${CORE_SERVER_WS_URL}\` | The protocol of the section "Core server": \`hello\`, the heartbeat, the replicated Core state, the audio meters and the control messages |`,
      `| mock-core (\`${SERVICE_NAME}\`) | \`${CORE_WS_URL}\` | The heartbeat only (section "mock-core"): the socket of Simulated mode |`,
    ].join('\n'),
    coreServerRealtimeDescription(),
    '### mock-core',
    MOCK_CORE_SOCKET_RULES,
    HEARTBEAT_EXAMPLE_BLOCK,
  ].join('\n\n');
}

/**
 * Scope `all`: the socket of the Core server (01_specs §9; plan row W22). The tables are built from
 * the catalogue of `realtime-messages.ts` and every JSON block is an example of
 * `realtime-examples.ts`, so the text cannot name a message the union does not have.
 */
function coreServerRealtimeDescription(): string {
  const cell = (text: string) => text.replaceAll('|', '\\|');
  const jsonBlock = (title: string, value: unknown) => `${title}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  const principals = Object.values(RealtimePrincipal);
  return [
    '### Core server',
    `The Core server serves \`${CORE_SERVER_WS_URL}\` with the protocol below. A lane instance serves the same path on its own port.`,
    '**Who a connection is.** Decided once, at the upgrade, from the request headers only: the session cookie of a web console, or `Authorization: Bearer` of a paired device. Nothing in the URL, in a subprotocol or in a message authenticates. The principal stays for the life of the connection, so a client opens a new socket after a sign-in or a sign-out.',
    [
      '| Principal | Receives |',
      '|---|---|',
      ...principals.map(
        (principal) =>
          `| ${principal} | ${REALTIME_SERVER_MESSAGES.filter((message) => canReceiveRealtimeMessage(principal, message.type))
            .map((message) => `\`${message.type}\``)
            .join(', ')} |`,
      ),
    ].join('\n'),
    '**Server to client.** One JSON object per text frame; every message carries `type` and `v: 1`.',
    [
      '| `type` | Topic | Members | Model | Sent to |',
      '|---|---|---|---|---|',
      ...REALTIME_SERVER_MESSAGES.map(
        (message) => `| \`${message.type}\` | ${message.topic ?? 'none'} | ${cell(message.members)} | ${message.schema} | ${cell(message.sentTo)} |`,
      ),
    ].join('\n'),
    '**Client to server.** Anything else, or a message from a principal that may not send it, closes the connection with 1008.',
    [
      '| `type` | Members | Allowed for | Effect |',
      '|---|---|---|---|',
      ...REALTIME_CLIENT_MESSAGES.map(
        (message) => `| \`${message.type}\` | ${cell(message.members)} | ${message.principals.join(', ')} | ${cell(message.effect)} |`,
      ),
    ].join('\n'),
    [
      `**State.** After \`hello\` an OPERATOR connection gets one \`snapshot\` with the ${REPLICATED_SLICE_NAMES.length} replicated slices (the ReplicatedState model). Every later change is a \`delta\` whose \`revision\` is the previous one plus 1 within the \`epoch\`: revisions have no gap, and a state delta is never dropped.`,
      'A delta holds operations: `replace` carries one whole slice, `append` carries new rows of `audit` (with `head`, `total` and `dropped`) or of `events`. A slice that no operation names did not change.',
      `A client that sees a gap, or another epoch, sends \`resync\` (at most one in ${REALTIME_RESYNC_MIN_INTERVAL_MS / 1000} s) and gets a new \`snapshot\`. A demo reset, a scenario load and a server start begin a new epoch. A 2xx answer of a POST carries the same two numbers in \`${EPOCH_HEADER_NAME}\` and \`${REVISION_HEADER_NAME}\`, so a client knows which delta holds the effect of its command.`,
      `Not replicated: ${UNREPLICATED_SLICE_NAMES.map((name) => `\`${name}\``).join(', ')}. The audio frames travel in \`meters\` only; a client builds the other four itself, from the server time and from the answers of the identity and pairing operations.`,
    ].join(' '),
    '**Time.** `heartbeat.serverTime` is an ISO-8601 string, as mock-core writes it too. Every other time of the protocol is epoch milliseconds on the server clock.',
    '**Close codes.**',
    ['| Code | When | What a client does |', '|--:|---|---|', ...REALTIME_CLOSE_CODES.map((entry) => `| ${entry.code} | ${cell(entry.when)} | ${cell(entry.reaction)} |`)].join('\n'),
    '**Never in a message.** A password, a session token, a cookie value, a device credential, a biometric token, a pairing code or a QR payload, or any hash or salt of those; the `enabled` flag or the session list of another operator; the list of paired devices; the lockout state of another console. `admin.changed` names the list that changed and holds no row of it.',
    '**Examples.**',
    jsonBlock('`hello` to a signed-in investigator:', REALTIME_SERVER_EXAMPLES.hello.operator.value),
    jsonBlock('`hello` to a connection whose cookie no longer resolves to a session:', REALTIME_SERVER_EXAMPLES.hello.sessionInvalid.value),
    jsonBlock('`delta`:', REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value),
    jsonBlock('`meters`:', REALTIME_SERVER_EXAMPLES.meters.speaking.value),
    jsonBlock('`session.updated`:', REALTIME_SERVER_EXAMPLES['session.updated'].roleChanged.value),
    jsonBlock('`session.ended`:', REALTIME_SERVER_EXAMPLES['session.ended'].tokenReuse.value),
    jsonBlock('`device.revoked`:', REALTIME_SERVER_EXAMPLES['device.revoked'].revoked.value),
    jsonBlock('`admin.changed`:', REALTIME_SERVER_EXAMPLES['admin.changed'].users.value),
    jsonBlock('`subscribe`, sent by a client:', REALTIME_CLIENT_EXAMPLES.subscribe.meters.value),
    jsonBlock('`resync`, sent by a client:', REALTIME_CLIENT_EXAMPLES.resync.gap.value),
  ].join('\n\n');
}

const TAG_ORDER: readonly CoreApiTag[] = [
  CoreApiTag.SERVICE,
  CoreApiTag.IDENTITY,
  CoreApiTag.ADMINISTRATION,
  CoreApiTag.PAIRING,
  CoreApiTag.SESSION,
  CoreApiTag.DEVICE,
  CoreApiTag.STORAGE,
  CoreApiTag.EVIDENCE,
  CoreApiTag.NETWORK,
  CoreApiTag.SECURITY,
  CoreApiTag.SYSTEM,
  CoreApiTag.ALERTS,
  CoreApiTag.DEMO,
  CoreApiTag.REALTIME,
];

/** The servers of a document, by scope. */
const OFFLINE_SERVERS: OpenApiDocument['servers'] = [
  {
    url: CORE_HTTP_ORIGIN,
    description:
      'Local mock-core. It serves GET /api/v1/health and WS /ws; the simulated endpoints are answered in the browser.',
  },
];
const ALL_SERVERS: OpenApiDocument['servers'] = [
  {
    url: CORE_SERVER_HTTP_ORIGIN,
    description: `The Core server (${CORE_SERVER_SERVICE_NAME}), main instance: every operation of this document and WS ${WS_PATH}. Loopback only.`,
  },
  {
    url: CORE_HTTP_ORIGIN,
    description: `mock-core (${SERVICE_NAME}), the heartbeat-only service of Simulated mode: GET /api/v1/health and its heartbeat socket. It answers no other operation.`,
  },
];

/** Scope `all`: the two security schemes (API-12). */
const SECURITY_SCHEMES: Record<OpenApiSecurityScheme, OpenApiSecuritySchemeObject> = {
  [OpenApiSecurityScheme.SESSION_COOKIE]: {
    type: 'apiKey',
    in: 'cookie',
    name: OPENAPI_SESSION_COOKIE_NAME,
    description: `The session of a web console. \`signIn\` sets it as an \`HttpOnly\`, \`SameSite=Strict\` cookie without an expiry, and its body then holds no token; the browser attaches the cookie to same-origin requests and to the socket upgrade. The name is \`dems_session_<listen port>\`: \`${OPENAPI_SESSION_COOKIE_NAME}\` on the main instance. It resolves only a session that is not bound to a device, and a POST that carries it must come from a web console origin.`,
  },
  [OpenApiSecurityScheme.BEARER]: {
    type: 'http',
    scheme: 'bearer',
    description:
      'A paired device. `Authorization: Bearer` carries the device credential (prefix `dvc_`) on the device operations and at sign-in, and the session token (prefix `ses_`) once an operator is signed in on the device. The server stores only a hash of either. One credential per request: a request that carries the session cookie and this header is refused. Neither value ever travels in a URL.',
  },
};

/**
 * Scope `all`: the credential an operation takes, from its access rule (01_specs §4.1, §4.2).
 * - PUBLIC: none (`[]`). `signIn` adds the console rule: a web console sends none and is known by
 *   its Origin, a paired device sends its device credential, so the bearer is optional there.
 * - DEVICE, and an operation that needs a device session: the bearer.
 * - Every other rule needs an OPERATOR: the session cookie of a web console, or the bearer of a
 *   paired device.
 */
function securityFor(access: CoreApiAccess): OpenApiSecurityRequirement[] {
  const conditions: readonly string[] = access.conditions ?? [];
  const bearer: OpenApiSecurityRequirement = { [OpenApiSecurityScheme.BEARER]: [] };
  if (access.kind === CoreApiAccessKind.PUBLIC) return conditions.includes('CONSOLE_IDENTITY') ? [{}, bearer] : [];
  if (access.kind === CoreApiAccessKind.DEVICE || conditions.includes('DEVICE_SESSION')) return [bearer];
  return [{ [OpenApiSecurityScheme.SESSION_COOKIE]: [] }, bearer];
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Builder
// ═══════════════════════════════════════════════════════════════════════════════════════

const SCHEMA_REF_PREFIX = '#/components/schemas/';
const HEADER_REF_PREFIX = '#/components/headers/';
const SIMULATED_HEADER_COMPONENT = 'XDemsSimulated';
/** Scope `all`: headers of the Core server's answers (API-7; D36). */
const REQUEST_ID_HEADER_COMPONENT = 'XRequestId';
const EPOCH_HEADER_COMPONENT = 'XDemsEpoch';
const REVISION_HEADER_COMPONENT = 'XDemsRevision';
const ALLOW_HEADER_COMPONENT = 'Allow';
const RETRY_AFTER_HEADER_COMPONENT = 'RetryAfter';
/** The component of the WS `/ws` message: no operation refers to it, every scope holds it. */
const REALTIME_SCHEMA: CoreApiSchemaName = 'Heartbeat';

function schemaRef(name: CoreApiSchemaName): OpenApiReference {
  return { $ref: `${SCHEMA_REF_PREFIX}${name}` };
}

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/**
 * JSON Schema for every `CORE_API_SCHEMAS` entry, with cross-references as `$ref`s into
 * `components.schemas`. `io: 'input'` describes what a client may send and leaves objects
 * open (no `additionalProperties: false`), so clients may ignore fields added later. Two noisy
 * artefacts of the conversion are removed: zod's 1 KB ISO date-time regex (the `date-time`
 * format already says it) and the ±2^53 bounds zod adds to every integer.
 */
function buildComponentSchemas(): Record<string, JsonSchemaObject> {
  const registry = z.registry<{ id: string }>();
  const names = Object.keys(CORE_API_SCHEMAS) as CoreApiSchemaName[];
  for (const name of names) registry.add(CORE_API_SCHEMAS[name], { id: name });
  const { schemas } = z.toJSONSchema(registry, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'throw',
    uri: (id) => `${SCHEMA_REF_PREFIX}${id}`,
    override: ({ jsonSchema }) => {
      if (jsonSchema.format === 'date-time') delete jsonSchema.pattern;
      if (jsonSchema.type === 'integer') {
        if (jsonSchema.maximum === MAX_SAFE) delete jsonSchema.maximum;
        if (jsonSchema.minimum === -MAX_SAFE) delete jsonSchema.minimum;
      }
    },
  });
  const out: Record<string, JsonSchemaObject> = {};
  for (const name of names) {
    // Drop the per-schema `$schema` and `$id` the registry output adds: the document's dialect
    // already applies, and `$ref`s address components by path.
    const schema: JsonSchemaObject = { ...((schemas[name] ?? {}) as JsonSchemaObject) };
    delete schema.$schema;
    delete schema.$id;
    out[name] = schema;
  }
  return out;
}

/**
 * The components a scope's document holds: for `all` every schema, for `offline` the ones its
 * operations reach, directly or through a `$ref`, plus the realtime message. The order is the
 * order of `CORE_API_SCHEMAS`.
 */
function selectComponentSchemas(
  all: Record<string, JsonSchemaObject>,
  operations: readonly CoreApiRegistryOperation[],
  scope: CoreApiScope,
): Record<string, JsonSchemaObject> {
  if (scope === CoreApiScope.ALL) return all;
  const wanted = new Set<string>();
  const visit = (name: string): void => {
    if (wanted.has(name)) return;
    wanted.add(name);
    const text = JSON.stringify(all[name] ?? {});
    for (const match of text.matchAll(/"#\/components\/schemas\/([A-Za-z0-9_]+)"/g)) visit(match[1] ?? '');
  };
  visit(REALTIME_SCHEMA);
  for (const operation of operations) {
    if (operation.requestBody) visit(operation.requestBody.schema);
    if (operation.query) visit(operation.query.schema);
    for (const status of listCoreApiResponseStatuses(operation, scope)) {
      const name = operation.responses[status]?.schema;
      if (name) visit(name);
    }
  }
  const out: Record<string, JsonSchemaObject> = {};
  for (const name of Object.keys(all)) {
    const schema = all[name];
    if (wanted.has(name) && schema) out[name] = schema;
  }
  return out;
}

/**
 * True for an operation whose every answer over the network is the Core server's: all but health,
 * which mock-core answers too. The nine design-book operations are among them: in the `all` scope
 * they are described as the Core server answers them.
 */
function isCoreServerOperation(operation: CoreApiRegistryOperation): boolean {
  return operation.services.includes(CoreApiService.CORE_SERVER) && !operation.services.includes(CoreApiService.MOCK_CORE);
}

/**
 * Contract gap 2 of D36: the query parameters of a GET are the members of its `query` schema. Each
 * member becomes one `in: query` parameter with that member's JSON Schema.
 */
export function buildOpenApiQueryParameters(schema: JsonSchemaObject | undefined): OpenApiParameterObject[] {
  const properties = (schema?.properties ?? {}) as Record<string, JsonSchemaObject>;
  const required = new Set((schema?.required as string[] | undefined) ?? []);
  return Object.entries(properties).map(([name, member]) => {
    const { description, ...rest } = member;
    return {
      name,
      in: 'query',
      required: required.has(name),
      description: typeof description === 'string' ? description : name,
      schema: rest,
    };
  });
}

/**
 * `offline`: LIVE for health, SIMULATED for the nine. `all`: LIVE for every operation, because the
 * Core server answers each one over the network (AR-3); `x-dems-mode` still says which nine the
 * in-app simulator can answer.
 */
function badgesFor(operation: CoreApiRegistryOperation, scope: CoreApiScope): OpenApiBadge[] {
  const main = scope === CoreApiScope.ALL || operation.mode === CoreApiMode.LIVE ? API_BADGES.LIVE : API_BADGES.SIMULATED;
  const badges: OpenApiBadge[] = [{ name: main.name, position: 'after', color: main.color }];
  if (operation.rbac && operation.tag === CoreApiTag.EVIDENCE) {
    badges.push({ name: API_BADGES.RBAC_AUDIT.name, position: 'after', color: API_BADGES.RBAC_AUDIT.color });
  }
  return badges;
}

function copyExamples(
  examples: Readonly<Record<string, OpenApiExample<unknown>>> | undefined,
): Record<string, OpenApiExample<unknown>> | undefined {
  if (!examples) return undefined;
  // A JSON round trip (examples are plain JSON) keeps each document independent of the shared
  // example constants; structuredClone is not in every runtime that type-checks this module.
  return JSON.parse(JSON.stringify(examples)) as Record<string, OpenApiExample<unknown>>;
}

/**
 * The examples of one status. The `all` scope lists the Core server's own first (F84-3:
 * `coreServerResponses`), so a renderer that prefills from the first shows the Core server's answer;
 * the `offline` scope reads `responses` only, as before.
 */
function responseExamplesFor(
  examples: OperationExamples | undefined,
  status: number,
  all: boolean,
): Readonly<Record<string, OpenApiExample<unknown>>> | undefined {
  const shared = examples?.responses[status];
  const coreServer = all ? examples?.coreServerResponses?.[status] : undefined;
  return coreServer ? { ...coreServer, ...shared } : shared;
}

function buildOperation(
  operation: CoreApiRegistryOperation,
  scope: CoreApiScope,
  schemas: Record<string, JsonSchemaObject>,
): OpenApiOperationObject {
  const examples = CORE_API_EXAMPLES[operation.operationId];
  const all = scope === CoreApiScope.ALL;
  // The simulator's header belongs to the simulator's answers, which the `offline` scope describes.
  const simulated = !all && operation.mode === CoreApiMode.SIMULATED;
  const coreServer = all && isCoreServerOperation(operation);
  const built: OpenApiOperationObject = {
    operationId: operation.operationId,
    tags: [operation.tag],
    summary: operation.summary,
    description: all ? (operation.coreServerDescription ?? operation.description) : operation.description,
    responses: {},
    'x-badges': badgesFor(operation, scope),
    'x-dems-mode': operation.mode,
    'x-dems-source': operation.source,
  };
  if (operation.pathParam) {
    const parameter: OpenApiParameterObject = {
      name: operation.pathParam.name,
      in: 'path',
      required: true,
      description: operation.pathParam.description,
      schema: { type: 'string', pattern: operation.pathParam.pattern.source },
    };
    const example = examples?.pathParams?.[operation.pathParam.name];
    if (example !== undefined) parameter.example = example;
    built.parameters = [parameter];
  }
  if (operation.query) {
    built.parameters = [...(built.parameters ?? []), ...buildOpenApiQueryParameters(schemas[operation.query.schema])];
  }
  if (operation.requestBody) {
    const media: OpenApiMediaType = { schema: schemaRef(operation.requestBody.schema) };
    const requestExamples = copyExamples(examples?.request);
    if (requestExamples) media.examples = requestExamples;
    built.requestBody = { required: operation.requestBody.required, content: { 'application/json': media } };
  }
  if (all) built.security = securityFor(operation.access);
  // `offline` leaves out a status that only the Core server sends (01_specs §7.19).
  for (const status of listCoreApiResponseStatuses(operation, scope)) {
    const spec = operation.responses[status];
    if (!spec) continue;
    const response: OpenApiResponseObject = { description: all ? (spec.coreServerDescription ?? spec.description) : spec.description };
    if (simulated) {
      response.headers = { [SIMULATED_HEADER_NAME]: { $ref: `${HEADER_REF_PREFIX}${SIMULATED_HEADER_COMPONENT}` } };
    }
    if (coreServer) {
      response.headers = { [REQUEST_ID_HEADER_NAME]: { $ref: `${HEADER_REF_PREFIX}${REQUEST_ID_HEADER_COMPONENT}` } };
      if (operation.method === 'post' && status >= 200 && status <= 299) {
        response.headers[EPOCH_HEADER_NAME] = { $ref: `${HEADER_REF_PREFIX}${EPOCH_HEADER_COMPONENT}` };
        response.headers[REVISION_HEADER_NAME] = { $ref: `${HEADER_REF_PREFIX}${REVISION_HEADER_COMPONENT}` };
      }
    }
    if (spec.schema) {
      const media: OpenApiMediaType = { schema: schemaRef(spec.schema) };
      const responseExamples = copyExamples(responseExamplesFor(examples, status, all));
      if (responseExamples) media.examples = responseExamples;
      response.content = { 'application/json': media };
    }
    built.responses[String(status)] = response;
  }
  if (operation.rbac) {
    built['x-dems-rbac'] = {
      permission: operation.rbac.permission,
      roles: [...operation.rbac.roles],
      audit: [...operation.rbac.audit],
    };
  }
  if (all) {
    built['x-dems-access'] = {
      rule: describeCoreApiAccess(operation.access),
      permissions: [...coreApiAccessPermissions(operation.access)],
      conditions: [...(operation.access.conditions ?? [])],
    };
    built['x-dems-audit'] = {
      success: operation.audit.success,
      denial: operation.audit.denial,
      also: [...(operation.audit.also ?? [])],
    };
    built['x-dems-services'] = [...operation.services];
  }
  return built;
}

/** `INVALID_PATH` → `InvalidPath`: the `components.responses` name of an envelope-level answer. */
function envelopeResponseName(code: string, reason: string | undefined): string {
  return (reason ?? code)
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Scope `all`: the answers defined once for every operation, as `components.responses`. */
function buildEnvelopeResponses(): Record<string, OpenApiResponseObject> {
  const out: Record<string, OpenApiResponseObject> = {};
  for (const entry of CORE_API_ENVELOPE_RESPONSES) {
    const reason = 'reason' in entry ? entry.reason : undefined;
    const response: OpenApiResponseObject = {
      description: `${entry.status} ${entry.codes.join(' or ')}${reason ? ` (\`details.reason: ${reason}\`)` : ''}. ${entry.description}`,
      content: { 'application/json': { schema: schemaRef('ApiError') } },
    };
    if ('header' in entry) {
      const component = entry.header === RETRY_AFTER_HEADER_NAME ? RETRY_AFTER_HEADER_COMPONENT : ALLOW_HEADER_COMPONENT;
      response.headers = { [entry.header]: { $ref: `${HEADER_REF_PREFIX}${component}` } };
    }
    out[envelopeResponseName(entry.codes[0], reason)] = response;
  }
  return out;
}

/** Scope `all`: the header components of the Core server's answers. */
const CORE_SERVER_HEADERS: OpenApiDocument['components']['headers'] = {
  [REQUEST_ID_HEADER_COMPONENT]: {
    description: 'The ID of the request in the Core server\'s log. An error envelope repeats it as `error.requestId`.',
    required: true,
    schema: { type: 'string', minLength: 1 },
  },
  [EPOCH_HEADER_COMPONENT]: {
    description: 'The epoch of the Core state: it counts demo resets and scenario loads. An integer, sent as decimal text (API-7).',
    required: true,
    schema: { type: 'integer', minimum: 0 },
  },
  [REVISION_HEADER_COMPONENT]: {
    description:
      'The revision of the delta that holds the command\'s effect (the current revision when nothing replicated changed). An integer, sent as decimal text; it restarts at 0 with each epoch (API-7).',
    required: true,
    schema: { type: 'integer', minimum: 0 },
  },
  [ALLOW_HEADER_COMPONENT]: {
    description: 'The methods the path accepts.',
    required: true,
    schema: { type: 'string' },
  },
  [RETRY_AFTER_HEADER_COMPONENT]: {
    description: 'Whole seconds until the caller\'s key is counted afresh.',
    required: true,
    schema: { type: 'integer', minimum: 0 },
  },
};

/** Builds a fresh OpenAPI 3.1.0 document object (see the file header). */
export function createOpenApiDocument(options: CreateOpenApiDocumentOptions = {}): OpenApiDocument {
  const includeSimulated = options.includeSimulated ?? true;
  const scope = options.scope ?? CoreApiScope.OFFLINE;
  const all = scope === CoreApiScope.ALL;
  const inScope = listCoreApiOperations(scope);
  const operations = inScope.filter((operation) => includeSimulated || operation.mode === CoreApiMode.LIVE);
  const schemas = selectComponentSchemas(buildComponentSchemas(), inScope, scope);
  const paths: Record<string, OpenApiPathItem> = {};
  for (const operation of operations) {
    const item = (paths[operation.path] ??= {});
    item[operation.method] = buildOperation(operation, scope, schemas);
  }
  const usedTags = new Set<CoreApiTag>(operations.map((operation) => operation.tag));
  usedTags.add(CoreApiTag.REALTIME);
  const tags: OpenApiTagObject[] = TAG_ORDER.filter((tag) => usedTags.has(tag)).map((tag) => {
    const object: OpenApiTagObject = { name: tag, description: TAG_DESCRIPTIONS[tag] };
    if (all) object.description = CORE_SERVER_TAG_DESCRIPTIONS[tag] ?? object.description;
    if (tag === CoreApiTag.REALTIME) {
      object['x-dems-mode'] = CoreApiMode.LIVE;
      // Scope `all` documents both sockets; the offline text stays as it is.
      if (all) object.description = allScopeRealtimeDescription();
    }
    return object;
  });
  if (all) {
    return {
      openapi: OPENAPI_VERSION,
      info: {
        title: OPENAPI_TITLE,
        version: OPENAPI_CORE_SERVER_DOCUMENT_VERSION,
        summary: coreServerInfoSummary(operations.length),
        description: CORE_SERVER_INFO_DESCRIPTION,
      },
      servers: ALL_SERVERS.map((server) => ({ ...server })),
      tags,
      paths,
      components: {
        schemas,
        // No operation of this scope documents the simulator's header: the Core server never sends it.
        headers: { ...CORE_SERVER_HEADERS },
        responses: buildEnvelopeResponses(),
        securitySchemes: {
          [OpenApiSecurityScheme.SESSION_COOKIE]: { ...SECURITY_SCHEMES[OpenApiSecurityScheme.SESSION_COOKIE] },
          [OpenApiSecurityScheme.BEARER]: { ...SECURITY_SCHEMES[OpenApiSecurityScheme.BEARER] },
        },
      },
    };
  }
  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: OPENAPI_TITLE,
      version: OPENAPI_DOCUMENT_VERSION,
      summary: INFO_SUMMARY,
      description: INFO_DESCRIPTION,
    },
    servers: OFFLINE_SERVERS.map((server) => ({ ...server })),
    tags,
    paths,
    components: {
      schemas,
      headers: {
        [SIMULATED_HEADER_COMPONENT]: {
          description: 'Present on every simulated response: the in-browser simulator answered, not the network.',
          required: true,
          schema: { type: 'string', const: SIMULATED_HEADER_VALUE },
        },
      },
    },
  };
}

/** Stable text form: 2-space JSON plus a trailing newline (what openapi.json holds). */
export function serializeOpenApiDocument(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export interface OpenApiOperationEntry {
  path: string;
  method: CoreApiMethod;
  operation: OpenApiOperationObject;
}

/** Every operation of a document, in path order. */
export function listOpenApiOperations(document: OpenApiDocument): OpenApiOperationEntry[] {
  const entries: OpenApiOperationEntry[] = [];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post'] as const) {
      const operation = item[method];
      if (operation) entries.push({ path, method, operation });
    }
  }
  return entries;
}
