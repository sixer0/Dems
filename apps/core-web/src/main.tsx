import '@fontsource-variable/orbitron'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { I18nextProvider } from 'react-i18next'
import type { SimErrorReport } from '@dems/shared/sim'
import { z } from 'zod'
import { webErrorSink } from './runtime/error-sink'

/**
 * Zod runs without its JIT (security review F-62-03). Zod probes `Function('')` when the first object
 * schema is built, and the packaged CSP (`script-src 'self'`) reports every probe. Static imports are
 * evaluated before this module's body, so the modules that build schemas (the simulator, the i18n
 * setup and the routes) are loaded by `start()` below, after the call, in their original order. `./runtime/boot`
 * stands where the simulator stood: it loads the simulator's modules first, and it is the one place
 * that decides which data source this page load gets.
 */
z.config({ jitless: true })

/**
 * Entry (masterplan/01_specs.md §4.1, §14.2; backend task 04_client_integration_spec §3.1, §5.1).
 * The one data source and the query client are created here and handed to the router context, so
 * the route guards read auth outside React; the providers themselves live in `routes/__root.tsx`.
 *
 * The data source is the in-browser simulator (Simulated mode, the default and the only mode of
 * a production or packaged build) or the Live source that talks to the Core server through the
 * dev server's own origin (Live mode, dev builds). `bootCoreRuntime` resolves the mode once and
 * builds exactly one of them; a Live page opened under `localhost` gets neither, and is told why.
 */
const queryClient = new QueryClient()

/** No client-log endpoint exists on mock-core (D3/D4, D41(g)); simulator faults go to the dev console. */
function reportSimError(report: SimErrorReport) {
  if (!import.meta.env.DEV) return
  const log = report.level === 'error' ? console.error : console.warn
  log('[core-web] simulator', report)
}

/**
 * CPW1-7, widened by FXR-W W92-2: a start-up that rejects would leave `#root` empty. That covers a
 * start-up chunk that fails to load (`./runtime/boot`, `./i18n`, `./router`, the Live refusal
 * screen; for example after a rebuild renamed the chunks under an open tab), a data source whose
 * start-up rejects or throws, and a router that throws while it is built. The page shows this one
 * sentence instead, built with the DOM alone, and its own log gets one record without the error's
 * text (a start-up error can carry an address or a request). Nothing is started in its place: no
 * fallback to the simulator (AC-C-25, ADQ-7).
 */
const BOOT_FAILED_SENTENCE = 'The console could not start; reload the page to try again.'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root element missing from index.html')

/** Loads the start-up chunks, starts the one data source and renders. Every rejection lands in the `catch` below. */
async function start(root: HTMLElement): Promise<void> {
  const { bootCoreRuntime } = await import('./runtime/boot')
  const { i18n } = await import('./i18n')
  const { createAppRouter } = await import('./router')

  const runtime = await bootCoreRuntime({ onSimError: reportSimError })
  if (runtime.kind === 'REFUSED') {
    // WT-2a: Live mode at an address the Core server does not accept. No data source was built.
    const { LiveHostRefusalScreen } = await import('./runtime/live-host-refusal')
    createRoot(root).render(
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <LiveHostRefusalScreen refusal={runtime.refusal} onUseSimulated={runtime.useSimulated} />
        </I18nextProvider>
      </StrictMode>,
    )
    return
  }
  // Simulated: the simulator, started and stopped by its provider as before. Live: the Live source,
  // already started; it lives as long as this page, and the provider only provides it.
  const router = createAppRouter({ sim: runtime.sim, queryClient, coreMode: runtime.coreMode })
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

try {
  await start(rootElement)
} catch (error) {
  webErrorSink.report({
    level: 'error',
    source: 'main.boot',
    message: 'The start-up was rejected (a start-up chunk, the data source or the router). The page shows a static sentence and starts no other source in its place (AC-C-25). The error text is not recorded.',
    at: Date.now(),
    context: { errorName: error instanceof Error ? error.name : typeof error },
  })
  const notice = document.createElement('p')
  notice.setAttribute('role', 'alert')
  notice.className = 'flex min-h-dvh items-center justify-center bg-background p-6 text-center text-foreground'
  notice.textContent = BOOT_FAILED_SENTENCE
  rootElement.replaceChildren(notice)
}
