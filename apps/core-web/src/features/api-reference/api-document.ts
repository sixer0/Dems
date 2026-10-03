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
 */
import {
  CORE_HTTP_ORIGIN,
  CORE_WS_URL,
  createOpenApiDocument,
  serializeOpenApiDocument,
  type OpenApiDocument,
  type OpenApiMediaType,
  type OpenApiOperationObject,
} from '@dems/shared/api'
import { DEMO_EVIDENCE_INDEX } from '@dems/shared/demo-data'
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
 * The page's document: all 10 operations, or only the LIVE one when `includeSimulated` is false,
 * served from this build's Core origin (`pointAtCoreOrigin`).
 */
export function buildApiDocument(includeSimulated: boolean): OpenApiDocument {
  return applyDemoExamples(pointAtCoreOrigin(createOpenApiDocument({ includeSimulated })))
}

/** `openapi.json` text of the document the page shows (Download button). */
export function apiDocumentJson(includeSimulated: boolean): string {
  return serializeOpenApiDocument(buildApiDocument(includeSimulated))
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
