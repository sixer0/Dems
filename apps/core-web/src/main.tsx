import '@fontsource-variable/orbitron'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { SimErrorReport } from '@dems/shared/sim'
import { z } from 'zod'

/**
 * Zod runs without its JIT (security review F-62-03). Zod probes `Function('')` when the first object
 * schema is built, and the packaged CSP (`script-src 'self'`) reports every probe. Static imports are
 * evaluated before this module's body, so the modules that build schemas (the simulator, the i18n
 * setup and the routes) are loaded here, after the call, in their original order.
 */
z.config({ jitless: true })
const { createSim } = await import('@dems/shared/sim')
await import('./i18n')
const { createAppRouter } = await import('./router')

/**
 * Entry (masterplan/01_specs.md §4.1, §14.2). The one simulator and the query client are created
 * here and handed to the router context, so the route guards read auth outside React; the
 * providers themselves live in `routes/__root.tsx`.
 */
const queryClient = new QueryClient()

/** No client-log endpoint exists on mock-core (D3/D4, D41(g)); simulator faults go to the dev console. */
function reportSimError(report: SimErrorReport) {
  if (!import.meta.env.DEV) return
  const log = report.level === 'error' ? console.error : console.warn
  log('[core-web] simulator', report)
}

const sim = createSim({ onError: reportSimError })
const router = createAppRouter({ sim, queryClient })

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root element missing from index.html')

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
