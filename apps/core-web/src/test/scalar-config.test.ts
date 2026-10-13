// Step 53: Scalar configuration (masterplan/01_specs.md §14.9; AC-57 config part; D45, D62, D67;
// AC-73 static part). The privacy and scope flags exactly as passed, the document Scalar renders
// (D62) with the DEMO dataset's example payloads, each validated against its OpenAPI schema, and
// the guarantee that no file outside features/api-reference imports Scalar.
import { describe, expect, it } from 'vitest'
import {
  CORE_API_SCHEMAS,
  listOpenApiOperations,
  type CoreApiSchemaName,
  type OpenApiDocument,
} from '@dems/shared/api'
import { DEMO_EVIDENCE_INDEX } from '@dems/shared/demo-data'
import {
  buildApiDocument,
  countOperations,
  DEMO_EXAMPLE_KEY,
  demoExampleTargets,
  findDocumentOperation,
} from '@/features/api-reference/api-document'
import { createScalarConfiguration, SCALAR_PRIVACY_FLAGS } from '@/features/api-reference/scalar-config'
import { EXCHANGE_ATTRIBUTE, SCALAR_CUSTOM_CSS, SCALAR_THEME_CSS } from '@/features/api-reference/scalar-theme'
import type { FetchLike } from '@/features/api-reference/sim-fetch'

const customFetch: FetchLike = async () => new Response(null, { status: 204 })

function makeConfig(includeSimulated = true) {
  return createScalarConfiguration({ content: buildApiDocument(includeSimulated), customFetch, customCss: SCALAR_CUSTOM_CSS })
}

describe('AC-57: Scalar privacy and scope flags', () => {
  it('passes telemetry off, no default fonts, no developer tools, agent and MCP disabled', () => {
    const config = makeConfig()
    expect(config.telemetry).toBe(false)
    expect(config.withDefaultFonts).toBe(false)
    expect(config.showDeveloperTools).toBe('never')
    expect(config.agent).toEqual({ disabled: true })
    expect(config.mcp).toEqual({ disabled: true })
    expect(config.persistAuth).toBe(false)
    expect(config.hideClientButton).toBe(true)
    expect(config.documentDownloadType).toBe('none')
    expect(config).toMatchObject(SCALAR_PRIVACY_FLAGS)
  })

  it('sets no proxy, no external URLs, no plugins and no remote source', () => {
    const config = makeConfig() as Record<string, unknown>
    for (const key of ['proxyUrl', 'proxy', 'externalUrls', 'plugins', 'url', 'spec', 'sources', 'servers', 'baseServerURL']) {
      expect(config, key).not.toHaveProperty(key)
    }
  })

  it('renders our theme, dark only, and routes Try-it through the given customFetch', () => {
    const config = makeConfig()
    expect(config).toMatchObject({ theme: 'none', layout: 'modern', forceDarkModeState: 'dark', hideDarkModeToggle: true })
    expect(config.customFetch).toBe(customFetch)
    expect(config.customCss.startsWith(SCALAR_THEME_CSS)).toBe(true)
    // Vitest stubs CSS modules, `?raw` included, with '' (css: false); in Vite the string is the
    // generated file. So check the wiring here and the injected <style> in the browser (log §3).
    expect(sourceOf('features/api-reference/scalar-theme.ts')).toContain(
      "import scalarThemeCss from '@dems/shared/theme/scalar.css?raw'",
    )
    expect(config.customCss).toContain(EXCHANGE_ATTRIBUTE)
    // 04 §5.9 status colours (D49): 3xx blue, 4xx amber, 5xx red.
    expect(config.customCss).toMatch(/\/Status\/3'\] > span\[style\] \{ background-color: var\(--scalar-color-blue\)/)
    expect(config.customCss).toMatch(/\/Status\/4'\] > span\[style\] \{ background-color: var\(--scalar-color-orange\)/)
    expect(config.customCss).not.toMatch(/@import|fonts\.scalar\.com|url\(\s*['"]?https?:/)
  })
})

describe('D62: the document Scalar renders', () => {
  it('is a fresh OpenAPI 3.1.0 object with 44 operations: health LIVE, 43 SIMULATED', () => {
    const config = makeConfig()
    const doc = config.content
    expect(doc.openapi).toBe('3.1.0')
    // 23 until task 3 M6 row 113 added the three simulated STT configuration operations (C3 §2.5).
    // 26 until task 3 row 132 added the five simulated operations 93-97 of the camera search (C3 §2.6).
    // 31 until task 4 row 63 added the two simulated sound-card operations 98-99 (design addendum 4.2).
    // 33 until task 4 row 194 added the simulated operation 100, the confirmed re-address.
    // 34 until task 4 row 102 added the seven simulated commissioning operations 101-107.
    // 41 until task 4 row V3 added the simulated operation 108, the stored-credential connection test.
    // 42 until task 4 row 116 added the two simulated operations 109-110 of the installation acceptance.
    expect(countOperations(doc)).toBe(44)
    const live = listOpenApiOperations(doc).filter((e) => e.operation['x-dems-mode'] === 'live')
    expect(live.map((e) => `${e.method} ${e.path}`)).toEqual(['get /api/v1/health'])
    expect(live[0]?.operation['x-badges'].map((b) => b.name)).toEqual(['LIVE'])
    expect(makeConfig().content).not.toBe(doc)
  })

  it('"Show simulated endpoints" off keeps the LIVE operation only', () => {
    const doc = makeConfig(false).content
    expect(countOperations(doc)).toBe(1)
    expect(Object.keys(doc.paths)).toEqual(['/api/v1/health'])
  })

  it('names no host but the local mock-core', () => {
    const text = JSON.stringify(makeConfig().content)
    const hosts = new Set([...text.matchAll(/\b(?:https?|wss?):\/\/([^/\s"'`)\\]+)/g)].map((m) => m[1]))
    expect([...hosts]).toEqual(['127.0.0.1:4400'])
  })
})

/** The `components.schemas` name a `$ref` points at. */
function refName(ref: string | undefined): CoreApiSchemaName {
  const name = ref?.replace('#/components/schemas/', '') ?? ''
  expect(name in CORE_API_SCHEMAS, `unknown $ref ${ref}`).toBe(true)
  return name as CoreApiSchemaName
}

function mediaOf(doc: OpenApiDocument, operationId: string, where: 'request' | number) {
  const operation = findDocumentOperation(doc, operationId)
  expect(operation, operationId).not.toBeNull()
  return where === 'request'
    ? operation?.requestBody?.content['application/json']
    : operation?.responses[String(where)]?.content?.['application/json']
}

describe('D67: demo-data example payloads', () => {
  const doc = buildApiDocument(true)
  const targets = demoExampleTargets()

  it('uses all four DEMO_EVIDENCE_INDEX.apiExamples payloads', () => {
    expect(targets).toHaveLength(4)
    expect(targets.map((t) => t.value)).toEqual([
      DEMO_EVIDENCE_INDEX.apiExamples.sessionCreate.request,
      DEMO_EVIDENCE_INDEX.apiExamples.evidenceExport.evidenceId,
      DEMO_EVIDENCE_INDEX.apiExamples.evidenceExport.request,
      DEMO_EVIDENCE_INDEX.apiExamples.evidenceExport.response,
    ])
  })

  it.each(demoExampleTargets().map((t) => [`${t.operationId} ${t.kind}${t.kind === 'response' ? ` ${t.status}` : ''}`, t] as const))(
    '%s is applied first and validates against its OpenAPI schema',
    (_label, target) => {
      if (target.kind === 'pathParam') {
        const parameter = findDocumentOperation(doc, target.operationId)?.parameters?.find((p) => p.name === target.name)
        expect(parameter?.example).toBe(target.value)
        expect(new RegExp(parameter?.schema.pattern ?? '^$').test(target.value)).toBe(true)
        return
      }
      const media = mediaOf(doc, target.operationId, target.kind === 'request' ? 'request' : target.status)
      const keys = Object.keys(media?.examples ?? {})
      expect(keys[0]).toBe(DEMO_EXAMPLE_KEY)
      expect(media?.examples?.[DEMO_EXAMPLE_KEY]?.value).toEqual(target.value)
      // No duplicate of the same payload under another name.
      const same = keys.filter((k) => JSON.stringify(media?.examples?.[k]?.value) === JSON.stringify(target.value))
      expect(same).toEqual([DEMO_EXAMPLE_KEY])
      const parsed = CORE_API_SCHEMAS[refName(media?.schema.$ref)].safeParse(target.value)
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
    },
  )

  it('every other example in the document still validates against its schema', () => {
    for (const { operation } of listOpenApiOperations(doc)) {
      const medias = [
        ['request', operation.requestBody?.content['application/json']] as const,
        ...Object.entries(operation.responses).map(([status, r]) => [status, r.content?.['application/json']] as const),
      ]
      for (const [where, media] of medias) {
        if (!media?.examples) continue
        const schema = CORE_API_SCHEMAS[refName(media.schema.$ref)]
        for (const [name, example] of Object.entries(media.examples)) {
          const parsed = schema.safeParse(example.value)
          expect(parsed.success, `${operation.operationId} ${where} ${name}`).toBe(true)
        }
      }
    }
  })
})

// ── AC-73 static part: Scalar stays inside features/api-reference ───────────────────────────
// Every source file under src/ as text (Vite glob, `?raw`), keyed by its path relative to src/.
const RAW = import.meta.glob<string>(['../**/*.ts', '../**/*.tsx'], { query: '?raw', import: 'default', eager: true })
const SOURCES = new Map(
  Object.entries(RAW)
    .map(([key, text]) => [key.replace(/^\.\.\//, '').replace(/^\.\//, 'test/'), text] as const)
    .filter(([path]) => path !== 'test/scalar-config.test.ts'),
)
const SCALAR_IMPORT = new RegExp(`(?:from\\s+|import\\s*\\(\\s*|import\\s+)['"]@${'scalar'}/`)

function sourceOf(path: string): string {
  const text = SOURCES.get(path)
  expect(text, path).toBeTypeOf('string')
  return text ?? ''
}

describe('AC-73 (static): no @scalar import outside features/api-reference', () => {
  it('finds Scalar imports only in the feature folder, and the runtime import only in the lazy renderer', () => {
    expect(SOURCES.size).toBeGreaterThan(100)
    const importers = [...SOURCES].filter(([, text]) => SCALAR_IMPORT.test(text)).map(([path]) => path)
    expect(importers.length).toBeGreaterThan(0)
    for (const path of importers) expect(path.startsWith('features/api-reference/'), path).toBe(true)
    const runtime = importers.filter((path) =>
      sourceOf(path)
        .split('\n')
        .some((line) => SCALAR_IMPORT.test(line) && !/^\s*import type /.test(line)),
    )
    expect(runtime).toEqual(['features/api-reference/scalar-renderer.tsx'])
  })

  it('loads the renderer module only through a dynamic import', () => {
    const importers = [...SOURCES].filter(([, text]) => /['"]\.\/scalar-renderer['"]/.test(text))
    expect(importers.map(([path]) => path)).toEqual(['features/api-reference/renderer-panel.tsx'])
    const text = importers[0]?.[1] ?? ''
    expect(text).toMatch(/lazy\(\(\) => import\('\.\/scalar-renderer'\)\)/)
    expect(text).not.toMatch(/^import .*'\.\/scalar-renderer'/m)
  })
})
