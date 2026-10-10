/**
 * Fix wave K, driver M2 - item 7: the camera search in the PHONE layout (gate 70 re-gate: `M4-DISC-P`,
 * `M4-DISC-EMPTY-P`, `M4-CONN-PTR-P` "NOT PROVEN on the phone" - the phone sat on the simulated lane,
 * whose Core answers the search 503). The three states are held here in the phone window, over the
 * real route files and the simulator's own door (`sim.request`), so the re-check on the device only
 * has to confirm them. The tablet runs of the same states are `camera-search.test.tsx`.
 *
 * | Check | The phone shows |
 * |-------|-----------------|
 * | M4-DISC-P | one press = one search; the summary, the rows in the Core's order, New / Already registered |
 * | M4-DISC-EMPTY-P | "No camera answered the search", its body and "Search again" |
 * | M4-CONN-PTR-P | Connect drawn disabled with "Connect this camera from the web console."; a press sends nothing; NO password field and no text input on the whole screen |
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen, within } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { simCaptureCandidates, simCaptureDiscoverySearch } from '@dems/shared/api';
import type { Sim } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderDevicesApp, settle, type DevicesHarness } from '@/features/devices/testing/devices-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => {
  expect(getMissingKeys()).toEqual([]);
  jest.useRealTimers();
});

type SimRequest = Parameters<Sim['request']>[0];
type SimResponse = ReturnType<Sim['request']>;
const DISCOVERY = '/api/v1/capture/discovery';
const PHONE = 'phonePortrait' as const;

function watch(h: DevicesHarness) {
  const real = h.sim.request.bind(h.sim);
  const seen: string[] = [];
  const box: { answers: ((request: SimRequest) => SimResponse | undefined) | null } = { answers: null };
  (h.sim as { request: Sim['request'] }).request = (request) => {
    seen.push(`${request.method} ${request.path}`);
    return box.answers?.(request) ?? real(request);
  };
  return {
    seen,
    count: (line: string) => seen.filter((entry) => entry === line).length,
    answer(next: typeof box.answers) {
      box.answers = next;
    },
  };
}
const respond = (status: number, body: unknown): SimResponse => ({ status, headers: {}, body }) as SimResponse;
const action = () => screen.getByTestId('camera-search-action');

async function openDevicesOnPhone() {
  const h = renderDevicesApp({ user: 'andi.pratama', window: PHONE, initialUrl: '/' });
  const requests = watch(h);
  h.navigate('/devices');
  await settle();
  return { h, requests };
}

describe('the camera search in the PHONE layout', () => {
  it('M4-DISC-P: one press = one search; the summary and the rows in the Core\'s order, New / Already registered', async () => {
    const { requests } = await openDevicesOnPhone();
    expect(action().props.accessibilityLabel).toBe('Search for cameras');
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(0);
    fireEvent.press(action());
    await settle();
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(1);
    expect(screen.getByTestId('camera-search-summary')).toHaveTextContent('2 found · 1 new · 1 already registered');
    const [fresh, registered] = simCaptureCandidates();
    const rows = within(screen.getByTestId('camera-search-list')).getAllByTestId(/^camera-candidate-CND-/);
    expect(rows.map((row) => row.props.testID)).toEqual([`camera-candidate-${fresh!.candidateId}`, `camera-candidate-${registered!.candidateId}`]);
    expect(screen.getByTestId(`camera-candidate-status-${fresh!.candidateId}`).props.accessibilityLabel).toBe('New');
    expect(screen.getByTestId(`camera-candidate-status-${registered!.candidateId}`).props.accessibilityLabel).toBe('Already registered');
    expect(screen.getByTestId('camera-search-trust')).toHaveTextContent('Make, model and name are what each device announced. They are not checked.');
  });

  it('M4-DISC-EMPTY-P: "No camera answered the search", its body and "Search again"', async () => {
    const { h, requests } = await openDevicesOnPhone();
    requests.answer((request) => {
      if (request.path !== DISCOVERY) return undefined;
      const at = h.sim.store.getState().clock.now;
      const empty = { ...simCaptureDiscoverySearch('DSC-000042', at, at + 600_000, false), responderCount: 0, newCount: 0, registeredCount: 0, interfaceCount: 1 };
      return request.method === 'POST' ? respond(202, { ...empty, created: true }) : respond(200, { search: empty, candidates: [], truncated: false });
    });
    fireEvent.press(action());
    await settle();
    const empty = screen.getByTestId('camera-search-empty');
    expect(within(empty).getByText('No camera answered the search')).toBeTruthy();
    expect(within(empty).getByText('Check that each camera is powered and on the same network as the Core, then search again.')).toBeTruthy();
    expect(action().props.accessibilityLabel).toBe('Search again');
    expect(screen.queryByTestId('camera-search-list')).toBeNull();
  });

  it('M4-CONN-PTR-P: "Connect this camera from the web console."; a press sends nothing; no password field and no text input', async () => {
    const { requests } = await openDevicesOnPhone();
    fireEvent.press(action());
    await settle();
    const [fresh] = simCaptureCandidates();
    const connect = screen.getByTestId(`camera-candidate-connect-${fresh!.candidateId}`);
    expect(connect.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId(`camera-candidate-web-only-${fresh!.candidateId}`)).toHaveTextContent('Connect this camera from the web console.');
    expect(screen.getByTestId('camera-search-web-only-note')).toHaveTextContent('Camera passwords are entered on the web console only. Open Devices on the web console and search there.');
    const before = [...requests.seen];
    fireEvent.press(connect);
    await settle();
    expect(requests.seen).toEqual(before);
    expect(requests.seen.filter((line) => /candidates|credential/.test(line))).toEqual([]);
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    expect(screen.UNSAFE_queryAllByProps({ secureTextEntry: true })).toHaveLength(0);
  });
});
