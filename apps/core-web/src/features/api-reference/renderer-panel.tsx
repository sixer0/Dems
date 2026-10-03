import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpenText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { OpenApiDocument } from '@dems/shared/api'
import { useRouteEnterDelay } from '@/components/shell'
import { useMotionPolicy } from '@/motion'
import { PANEL_BEAT_MS, RENDERER_SWAP_MS } from './choreography'
import { ApiPanel, ApiPanelBoundary } from './panel'
import { createScalarConfiguration } from './scalar-config'
import { EXCHANGE_ATTRIBUTE, SCALAR_CUSTOM_CSS } from './scalar-theme'
import type { FetchLike } from './sim-fetch'

// Scalar is the heaviest dependency of the app (Vue plus the API client): its own lazy chunk.
const ScalarRenderer = lazy(() => import('./scalar-renderer'))

/**
 * The chunk request starts on the renderer panel's beat (M-PG-API), never earlier than this, so
 * the page frame and the Realtime panel paint first, and a page that unmounts at once (a quick
 * navigation, or a route test) never starts the 1.2 MB-gzip download and evaluation.
 */
export const RENDERER_ARM_MIN_MS = 200

export interface RendererPanelProps {
  document: OpenApiDocument
  /** True while the document holds the simulated operations (the cross-fade key). */
  includeSimulated: boolean
  customFetch: FetchLike
  /** Flips `a` / `b` on every answered Try-it exchange (response reveal in scalar-theme.ts); null before the first. */
  exchangeParity: 'a' | 'b' | null
}

/**
 * The renderer inside an L2 card (9 columns; 01_specs §14.9). A skeleton holds the space while the
 * Scalar chunk loads; a renderer failure shows the fallback with a rate-limited retry. The
 * "Show simulated endpoints" switch swaps the document, and the renderer cross-fades (160 ms)
 * because Scalar re-renders everything.
 */
export function RendererPanel({ document, includeSimulated, customFetch, exchangeParity }: RendererPanelProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  // Read once per mount: a later beat change must not restart the wait.
  const [armDelay] = useState(() => Math.max(RENDERER_ARM_MIN_MS, m.reduced ? 0 : routeDelay + PANEL_BEAT_MS.renderer))
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), armDelay)
    return () => clearTimeout(timer)
  }, [armDelay])
  const configuration = useMemo(
    () => createScalarConfiguration({ content: document, customFetch, customCss: SCALAR_CUSTOM_CSS }),
    [document, customFetch],
  )
  const exchange = exchangeParity === null ? {} : { [EXCHANGE_ATTRIBUTE]: exchangeParity }
  return (
    <ApiPanel id="renderer" icon={BookOpenText} title={t('apiReference.renderer.title')} className="api-renderer-panel" bodyClassName="api-renderer-body">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={includeSimulated ? 'all' : 'live'}
          className="dems-api-renderer"
          data-testid="api-renderer"
          data-filter={includeSimulated ? 'all' : 'live'}
          {...exchange}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: m.seconds(RENDERER_SWAP_MS) } }}
          exit={{ opacity: 0, transition: { duration: m.seconds(RENDERER_SWAP_MS) } }}
        >
          <ApiPanelBoundary
            panel="renderer"
            fallback={{ title: t('apiReference.states.rendererTitle'), body: t('apiReference.states.rendererBody') }}
          >
            {armed ? (
              <Suspense fallback={<RendererSkeleton label={t('apiReference.states.loading')} />}>
                <ScalarRenderer configuration={configuration} />
              </Suspense>
            ) : (
              <RendererSkeleton label={t('apiReference.states.loading')} />
            )}
          </ApiPanelBoundary>
        </motion.div>
      </AnimatePresence>
    </ApiPanel>
  )
}

function RendererSkeleton({ label }: { label: string }) {
  return (
    <div className="api-renderer-skeleton" role="status" aria-label={label} data-testid="api-renderer-loading">
      <p className="api-note">{label}</p>
      <Skeleton className="h-6 w-2/5 rounded-md" />
      <Skeleton className="h-4 w-4/5 rounded-md" />
      <Skeleton className="h-4 w-3/5 rounded-md" />
      <Skeleton className="api-renderer-skeleton-block rounded-lg" />
    </div>
  )
}
