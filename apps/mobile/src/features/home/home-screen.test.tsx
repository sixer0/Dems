// N-1 (masterplan/01_specs.md §8): the proof screen renders, starts "Connecting", goes "Live" on a heartbeat.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { HealthResponse } from '@dems/shared/api';
import { HeartbeatProvider, type SocketLike } from '@dems/shared/realtime';
import { HomeScreen } from '@/features/home/home-screen';

// Skia is proven on device (AC-31), not in jest.
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

const health: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-09-30T16:41:00.000Z',
  uptimeMs: 7000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
};

class FakeSocket implements SocketLike {
  readyState = 1;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

describe('HomeScreen', () => {
  const originalFetch = global.fetch;
  let socket: FakeSocket;

  beforeEach(() => {
    socket = new FakeSocket();
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => health,
    })) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows the title, then goes from Connecting to Live with the health version', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
    render(
      <HeroUINativeProvider>
        <QueryClientProvider client={queryClient}>
          <HeartbeatProvider socketFactory={() => socket}>
            <HomeScreen motionMode="normal" />
          </HeartbeatProvider>
        </QueryClientProvider>
      </HeroUINativeProvider>,
    );

    expect(screen.getByText('DEMS EDGE CLIENT')).toBeTruthy();
    expect(screen.getByTestId('heartbeat-chip')).toHaveTextContent(/Connecting/);

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
      });
    });

    expect(screen.getByTestId('heartbeat-chip')).toHaveTextContent(/Live/);
    expect(screen.getByTestId('heartbeat-seq')).toHaveTextContent('7');
    await waitFor(() => expect(screen.getByTestId('health-version')).toHaveTextContent(/v0\.1\.0/));
  });
});
