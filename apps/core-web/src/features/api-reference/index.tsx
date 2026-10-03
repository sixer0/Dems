/**
 * API Reference page `/developer/api` (masterplan/01_specs.md §14.9; research/04 §5.9;
 * 03_motion_spec M-PG-API; D26, D45, D49, D61, D62, D67). Replaces the step-38 stub: the export
 * name `ApiReferencePage` (imported by `routes/_app/developer/api.tsx`) and the root
 * `data-testid="page-api-reference"` (AC-48) are kept.
 *
 * Layout (12 columns from 1440 px; one column below):
 *   server strip 12
 *   renderer (Scalar, lazy chunk) 9 | Realtime WS panel 3
 *
 * - The OpenAPI document is `createOpenApiDocument()` (D62) with the DEMO dataset's example
 *   payloads (D67), rebuilt only when "Show simulated endpoints" changes.
 * - Try-it goes through `simAwareFetch`: LIVE health to mock-core, SIMULATED endpoints answered by
 *   the one in-browser simulator (`sim.request` via the adapter), anything else blocked (AC-58).
 * - Scalar and the demo-data import stay inside this folder (AC-73, R6); the renderer is a lazy
 *   chunk of its own below the lazy route chunk.
 */
import { useCallback, useMemo, useState } from 'react'
import { Braces } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSimInstance } from '@dems/shared/sim'
import { PageHeader } from '@/components/shell/page-header'
import { coreHttpOrigin } from '@/lib/core-endpoint'
import { apiDocumentJson, buildApiDocument, countOperations } from './api-document'
import { RealtimePanel } from './realtime-panel'
import { RendererPanel } from './renderer-panel'
import { ServerStrip } from './server-strip'
import { ServiceBanner } from './service-banner'
import { createSimAwareFetch, type TryItExchange } from './sim-fetch'
import './api-reference.css'

export function ApiReferencePage() {
  const { t } = useTranslation()
  const sim = useSimInstance()
  const [includeSimulated, setIncludeSimulated] = useState(true)
  const [exchangeParity, setExchangeParity] = useState<'a' | 'b' | null>(null)

  const document = useMemo(() => buildApiDocument(includeSimulated), [includeSimulated])
  const onExchange = useCallback((_exchange: TryItExchange) => {
    setExchangeParity((parity) => (parity === 'a' ? 'b' : 'a'))
  }, [])
  const customFetch = useMemo(() => createSimAwareFetch({ sim, onExchange }), [sim, onExchange])
  const getDocumentJson = useCallback(() => apiDocumentJson(includeSimulated), [includeSimulated])

  return (
    <div className="dems-page api-page" data-testid="page-api-reference">
      <PageHeader
        icon={Braces}
        title={t('apiReference.title')}
        subtitle={t('apiReference.subtitle', { address: new URL(coreHttpOrigin()).host })}
        status={<ServiceBanner />}
      />
      <ServerStrip
        includeSimulated={includeSimulated}
        onIncludeSimulatedChange={setIncludeSimulated}
        operationCount={countOperations(document)}
        getDocumentJson={getDocumentJson}
      />
      <div className="api-grid">
        <RendererPanel
          document={document}
          includeSimulated={includeSimulated}
          customFetch={customFetch}
          exchangeParity={exchangeParity}
        />
        <RealtimePanel />
      </div>
    </div>
  )
}
