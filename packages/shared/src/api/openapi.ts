/**
 * The OpenAPI 3.1.0 document of the Core API v1 (masterplan/01_specs.md §14.9; D26, D31, D45;
 * AC-56).
 *
 * - 10 operations from `CORE_API_OPERATIONS`: `GET /api/v1/health` is LIVE (mock-core) and the 9
 *   book §21.2 endpoints are SIMULATED (answered in the browser by the simulator).
 * - Each operation carries `x-badges` (Scalar's native badge extension: LIVE, SIMULATED, and
 *   RBAC + AUDIT on export), `x-dems-mode: live | simulated` and `x-dems-source` (book section);
 *   RBAC-checked operations also carry `x-dems-rbac`. No other vendor extension is used: no `x-scalar-*`,
 *   `x-pre-request` / `x-post-response` scripts or code-sample extensions, so the document enables
 *   no renderer feature beyond display (D45; test/openapi.test.ts keeps an allowlist).
 * - `components.schemas` are generated from the shared zod schemas (`CORE_API_SCHEMAS`) with
 *   `z.toJSONSchema` (JSON Schema 2020-12, the OpenAPI 3.1 dialect), so the document, the form
 *   validation and the simulator's bodies cannot drift apart.
 * - WebSockets cannot be modelled in OpenAPI: WS `/ws` is described in the Realtime tag, and its
 *   message is the `Heartbeat` component.
 *
 * The builder runs on demand (a few milliseconds), never at import time, so mock-core and the
 * mobile app pay nothing for importing `@dems/shared/api`. Every call returns a fresh object
 * that the caller may filter or hand to a renderer that mutates its input.
 *
 * `npm run openapi:gen -w @dems/shared` (scripts/gen-openapi.ts) writes
 * `serializeOpenApiDocument(createOpenApiDocument())` to packages/shared/openapi/openapi.json;
 * the test fails when the committed file drifts from this module.
 */
import { z } from 'zod';
import { palette } from '../tokens/tokens';
import {
  CORE_HTTP_ORIGIN,
  CORE_WS_URL,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_AFTER_MS,
  RECONNECT_BACKOFF_MS,
  RECONNECT_JITTER_MS,
} from './constants';
import {
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CoreApiMode,
  CoreApiTag,
  type CoreApiMethod,
  type CoreApiOperation,
  type CoreApiSchemaName,
} from './core-api';
import { CORE_API_EXAMPLES, HEARTBEAT_EXAMPLE, type OpenApiExample } from './examples';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════════════

export const OPENAPI_VERSION = '3.1.0';
/** `info.version`: the version of this API description (the server strip's "Spec version"). */
export const OPENAPI_DOCUMENT_VERSION = '0.1.0';
export const OPENAPI_TITLE = 'DEMS Core API';

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
  in: 'path';
  required: true;
  description: string;
  schema: { type: 'string'; pattern: string };
  example?: string;
}
export interface OpenApiOperationObject {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  parameters?: OpenApiParameterObject[];
  requestBody?: { required: boolean; content: { 'application/json': OpenApiMediaType } };
  responses: Record<string, OpenApiResponseObject>;
  'x-badges': OpenApiBadge[];
  'x-dems-mode': CoreApiMode;
  'x-dems-source': string;
  'x-dems-rbac'?: { permission: string; roles: string[]; audit: string[] };
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
  };
}

export interface CreateOpenApiDocumentOptions {
  /** Default true. False keeps only the LIVE operations ("Show simulated endpoints" off). */
  includeSimulated?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Text
// ═══════════════════════════════════════════════════════════════════════════════════════

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

const TAG_DESCRIPTIONS: Record<CoreApiTag, string> = {
  [CoreApiTag.SERVICE]: 'Liveness of the local mock-core service. **LIVE.**',
  [CoreApiTag.SESSION]:
    'Session lifecycle (book §6.2): CREATE → PRECHECK → ARMED → RECORDING → STOPPING → FINALIZING → SEALED. **SIMULATED.**',
  [CoreApiTag.DEVICE]: 'Device health, audio channels and video tracks (book §6.1, §21.2). **SIMULATED.**',
  [CoreApiTag.STORAGE]: 'Evidence storage capacity and state. **SIMULATED.**',
  [CoreApiTag.EVIDENCE]: 'Authorized export with chain of custody (book §19.2, §19.3). **SIMULATED**, RBAC + audit.',
  [CoreApiTag.REALTIME]: [
    `**LIVE** WebSocket \`${CORE_WS_URL}\` served by mock-core. OpenAPI 3.1 cannot describe a socket, so it is documented here and shown live in the Realtime panel next to this reference.`,
    [
      `- Server to client only: one JSON \`Heartbeat\` message (see the Heartbeat model) per text frame every ${HEARTBEAT_INTERVAL_MS} ms, plus one immediately after connecting.`,
      '- `seq` counts ticks since the server started. `sessionState` is `null` in this demo phase.',
      '- Upgrades from origins other than the web dev origins and the service\'s own origins are refused with 403.',
      `- Clients show the link as STALE after ${HEARTBEAT_STALE_AFTER_MS} ms without a heartbeat and reconnect after ${RECONNECT_BACKOFF_MS.map((ms) => `${ms / 1000} s`).join(', ')} (the last delay repeats), plus up to ${RECONNECT_JITTER_MS} ms of jitter.`,
      '- Messages sent by clients are ignored.',
    ].join('\n'),
    `Example message:\n\n\`\`\`json\n${JSON.stringify(HEARTBEAT_EXAMPLE, null, 2)}\n\`\`\``,
  ].join('\n\n'),
};

const TAG_ORDER: readonly CoreApiTag[] = [
  CoreApiTag.SERVICE,
  CoreApiTag.SESSION,
  CoreApiTag.DEVICE,
  CoreApiTag.STORAGE,
  CoreApiTag.EVIDENCE,
  CoreApiTag.REALTIME,
];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Builder
// ═══════════════════════════════════════════════════════════════════════════════════════

const SCHEMA_REF_PREFIX = '#/components/schemas/';
const SIMULATED_HEADER_COMPONENT = 'XDemsSimulated';

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

function badgesFor(operation: CoreApiOperation): OpenApiBadge[] {
  const main = operation.mode === CoreApiMode.LIVE ? API_BADGES.LIVE : API_BADGES.SIMULATED;
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

function buildOperation(operation: CoreApiOperation): OpenApiOperationObject {
  const examples = CORE_API_EXAMPLES[operation.operationId];
  const simulated = operation.mode === CoreApiMode.SIMULATED;
  const built: OpenApiOperationObject = {
    operationId: operation.operationId,
    tags: [operation.tag],
    summary: operation.summary,
    description: operation.description,
    responses: {},
    'x-badges': badgesFor(operation),
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
  if (operation.requestBody) {
    const media: OpenApiMediaType = { schema: schemaRef(operation.requestBody.schema) };
    const requestExamples = copyExamples(examples?.request);
    if (requestExamples) media.examples = requestExamples;
    built.requestBody = { required: operation.requestBody.required, content: { 'application/json': media } };
  }
  const statuses = Object.keys(operation.responses)
    .map(Number)
    .sort((a, b) => a - b);
  for (const status of statuses) {
    const spec = operation.responses[status];
    if (!spec) continue;
    const response: OpenApiResponseObject = { description: spec.description };
    if (simulated) {
      response.headers = { [SIMULATED_HEADER_NAME]: { $ref: `#/components/headers/${SIMULATED_HEADER_COMPONENT}` } };
    }
    if (spec.schema) {
      const media: OpenApiMediaType = { schema: schemaRef(spec.schema) };
      const responseExamples = copyExamples(examples?.responses[status]);
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
  return built;
}

/** Builds a fresh OpenAPI 3.1.0 document object (see the file header). */
export function createOpenApiDocument(options: CreateOpenApiDocumentOptions = {}): OpenApiDocument {
  const includeSimulated = options.includeSimulated ?? true;
  const operations = CORE_API_OPERATIONS.filter(
    (operation) => includeSimulated || operation.mode === CoreApiMode.LIVE,
  );
  const paths: Record<string, OpenApiPathItem> = {};
  for (const operation of operations) {
    const item = (paths[operation.path] ??= {});
    item[operation.method] = buildOperation(operation);
  }
  const usedTags = new Set<CoreApiTag>(operations.map((operation) => operation.tag));
  usedTags.add(CoreApiTag.REALTIME);
  const tags: OpenApiTagObject[] = TAG_ORDER.filter((tag) => usedTags.has(tag)).map((tag) => {
    const object: OpenApiTagObject = { name: tag, description: TAG_DESCRIPTIONS[tag] };
    if (tag === CoreApiTag.REALTIME) object['x-dems-mode'] = CoreApiMode.LIVE;
    return object;
  });
  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: OPENAPI_TITLE,
      version: OPENAPI_DOCUMENT_VERSION,
      summary: INFO_SUMMARY,
      description: INFO_DESCRIPTION,
    },
    servers: [
      {
        url: CORE_HTTP_ORIGIN,
        description:
          'Local mock-core. It serves GET /api/v1/health and WS /ws; the simulated endpoints are answered in the browser.',
      },
    ],
    tags,
    paths,
    components: {
      schemas: buildComponentSchemas(),
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
