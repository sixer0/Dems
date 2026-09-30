import '@fontsource-variable/orbitron'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { HeartbeatProvider } from '@dems/shared/realtime'
import { HEALTH_QUERY_KEY } from './features/home/use-health'
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient()
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

/** Scaffold stand-in for the §5.5/§5.6 resync: refresh health after a WS reconnect. */
function resync() {
  void queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY })
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root element missing from index.html')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HeartbeatProvider onResync={resync}>
        <RouterProvider router={router} />
      </HeartbeatProvider>
    </QueryClientProvider>
  </StrictMode>,
)
