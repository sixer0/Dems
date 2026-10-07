/**
 * The OpenAPI document the page renders (01_specs §14.9; D62, D67).
 *
 * - `createOpenApiDocument()` (D62) builds a fresh 3.1.0 object per call, so Scalar, the
 *   "Show simulated endpoints" filter and the Download button each get their own copy.
 * - The example payloads Try-it prefills come from the DEMO dataset
 *   (`DEMO_EVIDENCE_INDEX.apiExamples`, `@dems/shared/demo-data`, D50/D67): the recording-scenario
 *   session for `POST /api/v1/session`, and the exported evidence item for
 *   `POST /api/v1/evidence/{id}/export` (path parameter, request and the 202 body). Each one is put
 *   FIRST in its `examples` map (Scalar prefills from the first), and an existing example with the
 *   same value is dropped so the dropdown carries no duplicate.
 *
 * The demo-data import stays inside this feature folder, so it lives in the lazy
 * `/developer/api` chunk only (R6, AC-73).
 *
 * Plan row W84 (backend task 04_client_integration_spec §11) adds the views of the page:
 *
 * | View | Document | Server | Examples |
 * |------|----------|--------|----------|
 * | Simulated (as before) | `offline` scope: ten operations, LIVE health, nine SIMULATED (one with "Show simulated endpoints" off) | mock-core, or the packaged page origin (`pointAtCoreOrigin`) | the DEMO dataset |
 * | Simulated, "Show Core-server endpoints" on (AR-2) | the same, plus the 65 operations only the Core server answers, each with the neutral badge `CORE SERVER` (`withCoreServerOperations`) | as above | as above |
 * | Live (AR-1, AR-3, AR-5) | `all` scope: 75 operations, every one LIVE | the page's own origin only (`pointAtPageOrigin`) | the contract's, with the session and evidence identifiers taken from the replica (`applyReplicaIdentifiers`) |
 */
import {
  API_BADGES,
  CORE_API_OPERATIONS,
  CORE_HTTP_ORIGIN,
  CORE_SERVER_HTTP_ORIGIN,
  CORE_SERVER_SERVICE_NAME,
  CORE_SERVER_WS_URL,
  CORE_WS_URL,
  CoreApiScope,
  createOpenApiDocument,
  isOfflineCoreApiOperation,
  listOpenApiOperations,
  serializeOpenApiDocument,
  type OpenApiBadge,
  type OpenApiDocument,
  type OpenApiMediaType,
  type OpenApiOperationObject,
} from '@dems/shared/api'
import { DEMO_EVIDENCE_INDEX } from '@dems/shared/demo-data'
import { toneHex } from '@dems/shared/tokens'
import { coreHttpOrigin, coreWsUrl } from '@/lib/core-endpoint'

/** Key of the demo-data example inside each `examples` map. */
export const DEMO_EXAMPLE_KEY = 'demoDataset'

const DEMO_SOURCE = 'Payload from the DEMO dataset (`@dems/shared/demo-data`, `DEMO_EVIDENCE_INDEX.apiExamples`). Synthetic data.'

/** One place a demo-data payload is applied (the test validates each against its schema). */
export type DemoExampleTarget =
  | { operationId: string; kind: 'request'; value: unknown; summary: string }
  | { operationId: string; kind: 'response'; status: number; value: unknown; summary: string }
  | { operationId: string; kind: 'pathParam'; name: string; value: string }

/** Every demo-data payload the page uses, and where it goes. */
export function demoExampleTargets(): DemoExampleTarget[] {
  const { sessionCreate, evidenceExport } = DEMO_EVIDENCE_INDEX.apiExamples
  return [
    {
      operationId: 'createSession',
      kind: 'request',
      value: sessionCreate.request,
      summary: 'DEMO dataset: the recording-scenario session',
    },
    { operationId: 'exportEvidence', kind: 'pathParam', name: 'id', value: evidenceExport.evidenceId },
    {
      operationId: 'exportEvidence',
      kind: 'request',
      value: evidenceExport.request,
      summary: `DEMO dataset: export ${evidenceExport.evidenceId}`,
    },
    {
      operationId: 'exportEvidence',
      kind: 'response',
      status: 202,
      value: evidenceExport.response,
      summary: `DEMO dataset: ${evidenceExport.response.exportId} (SUPERVISOR)`,
    },
  ]
}

/** Finds an operation of a document by its operationId. */
export function findDocumentOperation(document: OpenApiDocument, operationId: string): OpenApiOperationObject | null {
  for (const item of Object.values(document.paths)) {
    for (const operation of [item.get, item.post]) {
      if (operation?.operationId === operationId) return operation
    }
  }
  return null
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function prependExample(media: OpenApiMediaType, value: unknown, summary: string): void {
  const rest = Object.entries(media.examples ?? {}).filter(
    ([key, example]) => key !== DEMO_EXAMPLE_KEY && !sameJson(example.value, value),
  )
  // A JSON copy keeps the document independent of the shared demo-data constant.
  const copy: unknown = JSON.parse(JSON.stringify(value))
  media.examples = { [DEMO_EXAMPLE_KEY]: { summary, description: DEMO_SOURCE, value: copy }, ...Object.fromEntries(rest) }
}

/** Applies the demo-data payloads to a document (in place; the document is a fresh copy). */
export function applyDemoExamples(document: OpenApiDocument): OpenApiDocument {
  for (const target of demoExampleTargets()) {
    const operation = findDocumentOperation(document, target.operationId)
    if (!operation) continue // filtered out ("Show simulated endpoints" off)
    if (target.kind === 'pathParam') {
      const parameter = operation.parameters?.find((p) => p.name === target.name)
      if (parameter) parameter.example = target.value
    } else if (target.kind === 'request') {
      const media = operation.requestBody?.content['application/json']
      if (media) prependExample(media, target.value, target.summary)
    } else {
      const media = operation.responses[String(target.status)]?.content?.['application/json']
      if (media) prependExample(media, target.value, target.summary)
    }
  }
  return document
}

/**
 * Points the document at this build's Core (06_packaging_spec §3.4). Dev mode: untouched (the
 * shared document already names 127.0.0.1:4400). Packaged mode: `servers[0].url` becomes the page
 * origin, so Scalar's Try-it URLs pass `simAwareFetch`'s origin check, and the two address strings
 * (the LIVE row of `info.description`, the Realtime tag's WS URL) follow it. App-side because
 * packages/shared/src/api is step 54's while it runs (D110); the end pass may move this into a
 * shared `serverUrl` option.
 */
export function pointAtCoreOrigin(document: OpenApiDocument): OpenApiDocument {
  const origin = coreHttpOrigin()
  if (origin === CORE_HTTP_ORIGIN) return document
  const wsUrl = coreWsUrl()
  const swap = (text: string) =>
    text.replaceAll(`\`${CORE_HTTP_ORIGIN}\``, `\`${origin}\``).replaceAll(`\`${CORE_WS_URL}\``, `\`${wsUrl}\``)
  document.servers = document.servers.map((server, index) => (index === 0 ? { ...server, url: origin } : server))
  document.info.description = swap(document.info.description)
  for (const tag of document.tags) tag.description = swap(tag.description)
  return document
}

/**
 * The page's document in Simulated mode: all 10 operations, or only the LIVE one when
 * `includeSimulated` is false, served from this build's Core origin (`pointAtCoreOrigin`).
 */
export function buildApiDocument(includeSimulated: boolean): OpenApiDocument {
  return applyDemoExamples(pointAtCoreOrigin(createOpenApiDocument({ includeSimulated })))
}

/** `openapi.json` text of the document the page shows (Download button). */
export function apiDocumentJson(includeSimulated: boolean): string {
  return serializeOpenApiDocument(buildApiDocument(includeSimulated))
}

// ── Plan row W84: the views of both modes ────────────────────────────────────────────────

/** The badge of AR-2: neutral, shown on the operations only the Core server answers in Simulated mode. */
export const CORE_SERVER_BADGE: OpenApiBadge = { name: 'CORE SERVER', position: 'after', color: toneHex.default }

/** The identifiers Live examples take from the replica (AR-5); null when the replica holds none. */
export interface ReplicaIdentifiers {
  /** The open session (`session.id`). */
  openSessionId: string | null
  /** The last sealed session (`lastSealedSessionId`): the one a summary acknowledges. */
  lastSealedSessionId: string | null
  /** The first sealed evidence item (`evidence[].sealedAt` set). */
  firstSealedEvidenceId: string | null
}

export const NO_REPLICA_IDENTIFIERS: ReplicaIdentifiers = { openSessionId: null, lastSealedSessionId: null, firstSealedEvidenceId: null }

/** What a view of the page is. */
export type ApiDocumentView =
  | { mode: 'simulated'; includeSimulated: boolean; includeCoreServer: boolean }
  | { mode: 'live'; identifiers: ReplicaIdentifiers }

/** The replica's identifiers of AR-5, from the parts of the state that hold them. */
export function replicaIdentifiersOf(state: {
  session: { id: string } | null
  lastSealedSessionId: string | null
  evidence: readonly { id: string; sealedAt: number | null }[]
}): ReplicaIdentifiers {
  return {
    openSessionId: state.session?.id ?? null,
    lastSealedSessionId: state.lastSealedSessionId,
    firstSealedEvidenceId: state.evidence.find((item) => item.sealedAt !== null)?.id ?? null,
  }
}

const CORE_SERVER_ONLY_IDS = new Set(
  CORE_API_OPERATIONS.filter((operation) => !isOfflineCoreApiOperation(operation)).map((operation) => operation.operationId),
)

/**
 * AR-2: adds to a Simulated document (in place; it is a fresh copy) the operations only the Core
 * server answers, as the `all` scope describes them, with `CORE SERVER` in place of their LIVE
 * badge. The ten operations, their texts and the document's `info` and `servers` stay as they
 * are; the components the added operations name, their tags, the shared answers, headers and
 * security schemes are added beside the existing ones (no name of the `offline` scope is replaced).
 */
export function withCoreServerOperations(document: OpenApiDocument): OpenApiDocument {
  const all = createOpenApiDocument({ scope: CoreApiScope.ALL })
  for (const { path, method, operation } of listOpenApiOperations(all)) {
    if (!CORE_SERVER_ONLY_IDS.has(operation.operationId)) continue
    operation['x-badges'] = [CORE_SERVER_BADGE, ...operation['x-badges'].filter((badge) => badge.name !== API_BADGES.LIVE.name)]
    const item = (document.paths[path] ??= {})
    item[method] = operation
  }
  const components = document.components
  components.schemas = { ...all.components.schemas, ...components.schemas }
  components.headers = { ...all.components.headers, ...components.headers }
  if (all.components.responses) components.responses = { ...all.components.responses, ...components.responses }
  if (all.components.securitySchemes) components.securitySchemes = { ...all.components.securitySchemes, ...components.securitySchemes }
  const used = new Set(listOpenApiOperations(document).flatMap((entry) => entry.operation.tags))
  const existing = new Map(document.tags.map((tag) => [tag.name, tag]))
  document.tags = all.tags
    .filter((tag) => existing.has(tag.name) || used.has(tag.name))
    .map((tag) => existing.get(tag.name) ?? tag)
  return document
}

/**
 * AR-3: the Live document is served from the page's own origin and from nowhere else (section 4.2
 * of the spec: in Live mode the page talks to the Core server through its own origin). One server;
 * the Core server's address in `info` and in the tag texts follows it, as `pointAtCoreOrigin` does
 * for a packaged build (W83 KI-18 place 8).
 */
export function pointAtPageOrigin(document: OpenApiDocument): OpenApiDocument {
  const origin = coreHttpOrigin()
  const wsUrl = coreWsUrl()
  const swap = (text: string) =>
    text.replaceAll(`\`${CORE_SERVER_HTTP_ORIGIN}\``, `\`${origin}\``).replaceAll(`\`${CORE_SERVER_WS_URL}\``, `\`${wsUrl}\``)
  document.servers = [
    {
      url: origin,
      description: `The Core server (${CORE_SERVER_SERVICE_NAME}) through this page's own origin: every operation of this document and WS /ws. Try it sends real requests as the signed-in operator.`,
    },
  ]
  document.info.description = swap(document.info.description)
  for (const tag of document.tags) tag.description = swap(tag.description)
  return document
}

/** The path templates whose `{id}` is a session or an evidence item (AR-5), and where its value comes from. */
function replicaIdentifierFor(path: string, operationId: string, ids: ReplicaIdentifiers): string | null | undefined {
  if (path.startsWith('/api/v1/evidence/{id}')) return ids.firstSealedEvidenceId
  if (path.startsWith('/api/v1/session/{id}')) {
    return operationId === 'acknowledgeSessionSummary' ? ids.lastSealedSessionId : ids.openSessionId
  }
  return undefined
}

/**
 * AR-5: the session and evidence identifiers of the path examples come from the replica, never
 * from the frozen example identifiers (which do not exist on another day). When the replica holds
 * none, the example is removed, so Try-it asks for the identifier instead of sending a dead one.
 * Other identifiers (operators, devices, alerts) are seeded and stay as the contract gives them.
 */
export function applyReplicaIdentifiers(document: OpenApiDocument, ids: ReplicaIdentifiers): OpenApiDocument {
  for (const { path, operation } of listOpenApiOperations(document)) {
    const value = replicaIdentifierFor(path, operation.operationId, ids)
    if (value === undefined) continue
    const parameter = operation.parameters?.find((candidate) => candidate.in === 'path' && candidate.name === 'id')
    if (!parameter) continue
    if (value === null) delete parameter.example
    else parameter.example = value
  }
  return document
}

/** The Live document (AR-1, AR-3, AR-5): 75 operations, every one LIVE, served from the page's origin. */
export function buildLiveApiDocument(ids: ReplicaIdentifiers): OpenApiDocument {
  return applyReplicaIdentifiers(pointAtPageOrigin(createOpenApiDocument({ scope: CoreApiScope.ALL })), ids)
}

/** The document of a view of the page. */
export function buildApiDocumentFor(view: ApiDocumentView): OpenApiDocument {
  if (view.mode === 'live') return buildLiveApiDocument(view.identifiers)
  const document = buildApiDocument(view.includeSimulated)
  return view.includeCoreServer ? withCoreServerOperations(document) : document
}

/** AR-8: `openapi.json` text of the document of the current view (Download button). */
export function apiDocumentJsonFor(view: ApiDocumentView): string {
  return serializeOpenApiDocument(buildApiDocumentFor(view))
}

/** Number of operations in a document (server strip). */
export function countOperations(document: OpenApiDocument): number {
  let count = 0
  for (const item of Object.values(document.paths)) {
    if (item.get) count += 1
    if (item.post) count += 1
  }
  return count
}
