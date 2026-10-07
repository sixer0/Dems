// E-fix row FX-M2, defect E2E-P-2 (decision D199/D201): the Stack Check proof card said "wired to the
// local mock-core over adb reverse" while the app was Live on the Core server. The line now follows the
// runtime's Core link source (`useCoreLink().source`): Simulated, mock-core heartbeat or Live.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { HealthResponse } from '@dems/shared/api';
import { HeartbeatProvider, type SocketLike } from '@dems/shared/realtime';
import { HomeScreen, STACK_PROOF_SOURCE_LINE } from '@/features/home/home-screen';
import { RuntimeContractProvider, createRuntimeContract, type CoreLinkSource } from '@/runtime';

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

class InertSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

const textOf = (testID: string): string => {
  const node = screen.getByTestId(testID);
  const children = node.props.children as unknown;
  return Array.isArray(children) ? children.join('') : String(children);
};

function renderWithSource(source: CoreLinkSource) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HeroUINativeProvider>
      <QueryClientProvider client={queryClient}>
        <RuntimeContractProvider value={createRuntimeContract({ coreLink: { source, state: 'ONLINE' } })}>
          <HeartbeatProvider socketFactory={() => new InertSocket()}>
            <HomeScreen motionMode="normal" />
          </HeartbeatProvider>
        </RuntimeContractProvider>
      </QueryClientProvider>
    </HeroUINativeProvider>,
  );
}

describe('Stack Check names the data source the app really uses (E2E-P-2)', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => health })) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('LIVE: the card says Live and the Core server; it no longer claims the local mock-core', () => {
    renderWithSource('LIVE');
    const line = textOf('stack-proof-source');
    expect(line).toBe(STACK_PROOF_SOURCE_LINE.LIVE);
    expect(line).toMatch(/^Data source: Live\./);
    expect(line).toMatch(/Core server/);
    expect(line).not.toMatch(/mock-core/);
    // The defect's sentence is gone from the whole screen.
    expect(screen.queryByText(/wired to the local mock-core/)).toBeNull();
  });

  it('HEARTBEAT: the card names the mock-core heartbeat over adb reverse', () => {
    renderWithSource('HEARTBEAT');
    expect(textOf('stack-proof-source')).toBe(STACK_PROOF_SOURCE_LINE.HEARTBEAT);
    expect(textOf('stack-proof-source')).toMatch(/^Data source: mock-core heartbeat\./);
  });

  it('SIMULATED (also the value outside the runtime provider): the card says the Core runs inside the app', () => {
    renderWithSource('SIMULATED');
    expect(textOf('stack-proof-source')).toBe(STACK_PROOF_SOURCE_LINE.SIMULATED);
    expect(textOf('stack-proof-source')).toMatch(/^Data source: Simulated\. The Core runs inside the app/);
  });

  it('the three lines differ, and none claims a source it is not (the LIVE line never says Simulated)', () => {
    const lines = Object.values(STACK_PROOF_SOURCE_LINE);
    expect(new Set(lines).size).toBe(3);
    expect(STACK_PROOF_SOURCE_LINE.LIVE).not.toMatch(/simulat/i);
    expect(STACK_PROOF_SOURCE_LINE.SIMULATED).not.toMatch(/Core server/);
  });
});
