// W-1 (masterplan/01_specs.md §8): the placeholder renders, starts "Connecting", goes "Live" on a heartbeat.
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@dems/shared/api'
import { HeartbeatProvider, type SocketLike } from '@dems/shared/realtime'
import { HomePage } from '@/features/home/home-page'

const health: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-09-30T16:41:00.000Z',
  uptimeMs: 7000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
}

class FakeSocket implements SocketLike {
  readyState = 1
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
}

describe('HomePage', () => {
  let socket: FakeSocket

  beforeEach(() => {
    socket = new FakeSocket()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(health), { status: 200 })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the title, then goes from Connecting to Live with the health version', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <HeartbeatProvider socketFactory={() => socket}>
          <HomePage motionMode="normal" />
        </HeartbeatProvider>
      </QueryClientProvider>,
    )

    // The enter transition starts at opacity 0; skipped animations settle on the next frame.
    await waitFor(() => expect(screen.getByText('DEMS EDGE CLIENT')).toBeVisible())
    expect(screen.getByTestId('heartbeat-chip')).toHaveTextContent('Connecting')

    act(() => {
      socket.onmessage?.({
        data: JSON.stringify({
          type: 'heartbeat',
          v: 1,
          seq: 7,
          serverTime: '2026-09-30T16:41:07.000Z',
          uptimeMs: 7000,
          intervalMs: 1000,
          clients: 1,
          sessionState: null,
        }),
      })
    })

    expect(screen.getByTestId('heartbeat-chip')).toHaveTextContent('Live')
    await waitFor(() => expect(screen.getByTestId('health-version')).toHaveTextContent('v0.1.0'))
    expect(screen.getByText('23:41:07')).toBeInTheDocument()
  })
})
