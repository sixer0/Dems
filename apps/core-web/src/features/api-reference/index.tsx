/**
 * API Reference page `/developer/api` (masterplan/01_specs.md §14.9; research/04 §5.9;
 * 03_motion_spec M-PG-API; D26, D45, D49, D61, D62, D67). Replaces the step-38 stub: the export
 * name `ApiReferencePage` (imported by `routes/_app/developer/api.tsx`) and the root
 * `data-testid="page-api-reference"` (AC-48) are kept.
 *
 * Layout (12 columns from 1440 px; one column below):
 *   server strip 12
 *   (Live mode: the Try-it warning) 12
 *   renderer (Scalar, lazy chunk) 9 | Realtime WS panel 3
 *
 * Both modes (backend task 04_client_integration_spec §11; plan row W84):
 *
 * | | Simulated mode (as before) | Live mode |
 * |-|----------------------------|-----------|
 * | Document | `offline` scope: 33 operations with the DEMO dataset's examples (D62, D67); "Show Core-server endpoints" adds the other 66 with the badge CORE SERVER (AR-2) | `all` scope: 99 operations, every one LIVE, served from the page's origin; identifiers from the replica (AR-1, AR-3, AR-5) |
 * | Try-it | `simAwareFetch`: LIVE health to mock-core, SIMULATED endpoints answered by the one in-browser simulator, anything else blocked (AC-58); a Core-server operation rejected before any request (AR-2) | `liveTryItFetch`: `{page origin}/api/v1/*` to the network with the session cookie, the six operations of AR-3a rejected before any request, anything else blocked; never `sim.request` |
 * | Realtime panel | its own heartbeat client against mock-core | the console's one socket, read through the Live source (AR-7; no second socket, AC-C-18) |
 * | Banner | mock-core | the Core server's name, version and readiness (AR-6) |
 * | Warning | — | an `Alert` above the renderer: Try-it acts as the signed-in operator (AR-4) |
 *
 * Scalar and the demo-data import stay inside this folder (AC-73, R6); the renderer is a lazy chunk
 * of its own below the lazy route chunk. Nothing of a Try-it exchange is kept but its method, path
 * and status (AR-9).
 */
import { useCallback, useMemo, useState } from 'react'
import { Alert } from '@heroui/react'
import { Braces } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLiveSelector } from '@dems/shared/live'
import { useSim, useSimInstance } from '@dems/shared/sim'
import { PageHeader } from '@/components/shell/page-header'
import { coreHttpOrigin } from '@/lib/core-endpoint'
import { useWebLive, type WebLive } from '@/runtime'
import { apiDocumentJsonFor, buildApiDocumentFor, countOperations, replicaIdentifiersOf, type ApiDocumentView } from './api-document'
import { RealtimePanel } from './realtime-panel'
import { RendererPanel } from './renderer-panel'
import { ServerStrip } from './server-strip'
import { ServiceBanner } from './service-banner'
import { createSimAwareFetch, type TryItExchange } from './sim-fetch'
import { createLiveTryItFetch } from './try-it'
import './api-reference.css'

export function ApiReferencePage() {
  const live = useWebLive()
  return live ? <LiveApiReference /> : <SimulatedApiReference />
}

/** Flips `a` / `b` on every answered exchange (the response reveal of scalar-theme.ts). */
function useExchangeParity() {
  const [exchangeParity, setExchangeParity] = useState<'a' | 'b' | null>(null)
  const onExchange = useCallback((_exchange: TryItExchange) => {
    setExchangeParity((parity) => (parity === 'a' ? 'b' : 'a'))
  }, [])
  return { exchangeParity, onExchange }
}

function SimulatedApiReference() {
  const { t } = useTranslation()
  const sim = useSimInstance()
  const [includeSimulated, setIncludeSimulated] = useState(true)
  const [includeCoreServer, setIncludeCoreServer] = useState(false)
  const { exchangeParity, onExchange } = useExchangeParity()

  const view = useMemo<ApiDocumentView>(
    () => ({ mode: 'simulated', includeSimulated, includeCoreServer }),
    [includeSimulated, includeCoreServer],
  )
  const document = useMemo(() => buildApiDocumentFor(view), [view])
  const coreServerRefusal = includeCoreServer ? t('apiReference.tryIt.coreServerOnly') : undefined
  const customFetch = useMemo(
    () => createSimAwareFetch({ sim, onExchange, ...(coreServerRefusal !== undefined ? { coreServerRefusal } : {}) }),
    [sim, onExchange, coreServerRefusal],
  )
  const getDocumentJson = useCallback(() => apiDocumentJsonFor(view), [view])

  return (
    <div className="dems-page api-page" data-testid="page-api-reference" data-mode="simulated">
      <PageHeader
        icon={Braces}
        title={t('apiReference.title')}
        subtitle={t('apiReference.subtitle', { address: new URL(coreHttpOrigin()).host })}
        status={<ServiceBanner />}
      />
      <ServerStrip
        includeSimulated={includeSimulated}
        onIncludeSimulatedChange={setIncludeSimulated}
        includeCoreServer={includeCoreServer}
        onIncludeCoreServerChange={setIncludeCoreServer}
        operationCount={countOperations(document)}
        specVersion={document.info.version}
        getDocumentJson={getDocumentJson}
      />
      <div className="api-grid">
        <RendererPanel
          document={document}
          includeSimulated={includeSimulated}
          viewKey={`${includeSimulated ? 'all' : 'live'}${includeCoreServer ? '+core' : ''}`}
          customFetch={customFetch}
          exchangeParity={exchangeParity}
        />
        <RealtimePanel />
      </div>
    </div>
  )
}

function LiveApiReference() {
  const { t } = useTranslation()
  const { exchangeParity, onExchange } = useExchangeParity()
  const operator = useLiveSelector((source: WebLive | null) => source?.session?.operator.displayName ?? null)
  // AR-5: the identifiers of the examples follow the replica. `useSim` compares the three values
  // shallowly, so the document is rebuilt only when one of them changes.
  const identifiers = useSim(replicaIdentifiersOf)
  const view = useMemo<ApiDocumentView>(() => ({ mode: 'live', identifiers }), [identifiers])
  const document = useMemo(() => buildApiDocumentFor(view), [view])
  const secretRefusal = t('apiReference.tryIt.secretDenied')
  const customFetch = useMemo(() => createLiveTryItFetch({ secretRefusal, onExchange }), [secretRefusal, onExchange])
  const getDocumentJson = useCallback(() => apiDocumentJsonFor(view), [view])
  const address = new URL(coreHttpOrigin()).host

  return (
    <div className="dems-page api-page" data-testid="page-api-reference" data-mode="live">
      <PageHeader
        icon={Braces}
        title={t('apiReference.title')}
        subtitle={t('apiReference.subtitleLive', { address })}
        status={<ServiceBanner live />}
      />
      <ServerStrip
        mode="live"
        operationCount={countOperations(document)}
        specVersion={document.info.version}
        getDocumentJson={getDocumentJson}
      />
      <Alert status="warning" data-testid="api-live-warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            {t('apiReference.liveWarning.body', { operator: operator ?? t('apiReference.liveWarning.unknownOperator') })}
          </Alert.Description>
        </Alert.Content>
      </Alert>
      <div className="api-grid">
        <RendererPanel document={document} includeSimulated viewKey="core" customFetch={customFetch} exchangeParity={exchangeParity} />
        <RealtimePanel />
      </div>
    </div>
  )
}
