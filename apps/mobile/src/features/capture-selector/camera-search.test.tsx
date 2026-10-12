/**
 * The camera search on the Devices screen of the tablet and the phone (task 3 row 138; ux spec §8c
 * flow 9, §8d.10 flow 10 on these clients; the software half of M4-DISC-T / -P, M4-DISC-EMPTY-T / -P,
 * M4-DISC-RBAC-T / -P, M4-CONN-PTR-T / -P; M4-UX-UNIT). Real route files, real simulator, real
 * providers, as `capture-selector.test.tsx`.
 *
 * The in-app simulator answers a search at once (COMPLETE, two responders) and never refuses one, so
 * the states it cannot reach (S3, S5, S7-S12) are driven by answering operations 93 / 94 in the place
 * of the simulator for one test (`answers`): the same door the app uses (`sim.request`), nothing else.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import '@/features/devices/testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { TextInput } from 'react-native';
import { simCaptureCandidates, simCaptureDiscoverySearch, type CaptureCandidate, type CaptureDiscoveryStateBody } from '@dems/shared/api';
import type { Sim } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { renderDevicesApp, settle, type DevicesHarness } from '@/features/devices/testing/devices-harness';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
import { isSimulatedCoreSearch } from './camera-search-panel';
import { captureSelectorEn } from './i18n';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('camera search', () => {
unmountBeforeTheHooksOfThisGroup();

beforeEach(() => resetMissingKeys());
// MA-21: every string the panel renders comes from an i18n key.
afterEach(() => {
  expect(getMissingKeys()).toEqual([]);
  jest.useRealTimers();
});

type SimRequest = Parameters<Sim['request']>[0];
type SimResponse = ReturnType<Sim['request']>;
const DISCOVERY = '/api/v1/capture/discovery';

/** Records every request of the app to the simulator; `answers` may answer in its place for one test. */
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

const respond = (status: number, body: unknown, headers: Record<string, string> = {}): SimResponse => ({ status, headers, body }) as SimResponse;
const refusal = (status: number, code: string, reason: string, headers: Record<string, string> = {}): SimResponse =>
  respond(status, { error: { code, message: 'refused', details: { reason } } }, headers);

const now = (h: DevicesHarness): number => h.sim.store.getState().clock.now;
const searchAt = (at: number, over: Partial<ReturnType<typeof simCaptureDiscoverySearch>> = {}) => ({ ...simCaptureDiscoverySearch('DSC-000042', at, at + 600_000, false), ...over });
const view = (h: DevicesHarness, over: Partial<CaptureDiscoveryStateBody> = {}): CaptureDiscoveryStateBody => ({ search: searchAt(now(h)), candidates: simCaptureCandidates(), truncated: false, ...over });
const candidate = (over: Partial<CaptureCandidate>): CaptureCandidate => ({ ...simCaptureCandidates()[0]!, ...over });

const action = () => screen.getByTestId('camera-search-action');
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const searchAudit = (h: DevicesHarness) => h.sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED');

/** Opens Devices AFTER the watcher is in place, so the entry read is counted too. */
async function openDevices(options: Parameters<typeof renderDevicesApp>[0] = {}) {
  const h = renderDevicesApp({ user: 'andi.pratama', ...options, initialUrl: '/' });
  const requests = watch(h);
  h.navigate('/devices');
  await settle();
  return { h, requests };
}

describe('entry and idle (§8c.1, S2)', () => {
  it('opening the screen reads the caller\'s own result once and starts NO search (R-9 AC-1)', async () => {
    const { h, requests } = await openDevices();
    const panel = screen.getByTestId('camera-search');
    expect(within(panel).getByText('Camera search')).toBeTruthy();
    expect(screen.getByTestId('camera-search-intro')).toHaveTextContent('Search the network for cameras. A search only lists the cameras that answer; it changes no setting.');
    expect(action().props.accessibilityLabel).toBe('Search for cameras');
    expect(disabled('camera-search-action')).toBe(false);
    expect(requests.count(`GET ${DISCOVERY}`)).toBe(1);
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(0);
    expect(searchAudit(h)).toHaveLength(0);
    // No address, subnet, port or filter field anywhere (§8c.1 "Not offered").
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });
});

describe('a search and its list (S4; §8c.3, §8c.4)', () => {
  it('one press = one search: the summary, the rows in the Core\'s order, New / Already registered, the freshness line; one audit row', async () => {
    const { h, requests } = await openDevices();
    fireEvent.press(action());
    await settle();
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(1);
    expect(searchAudit(h)).toHaveLength(1);
    expect(screen.getByTestId('camera-search-summary')).toHaveTextContent('2 found · 1 new · 1 already registered');
    const [fresh, registered] = simCaptureCandidates();
    const list = screen.getByTestId('camera-search-list');
    const rows = within(list).getAllByTestId(/^camera-candidate-CND-/);
    expect(rows.map((row) => row.props.testID)).toEqual([`camera-candidate-${fresh!.candidateId}`, `camera-candidate-${registered!.candidateId}`]);
    expect(screen.getByTestId(`camera-candidate-address-${fresh!.candidateId}`)).toHaveTextContent('127.0.0.1');
    expect(screen.getByTestId(`camera-candidate-model-${fresh!.candidateId}`)).toHaveTextContent('DEMS Test source');
    expect(screen.getByTestId(`camera-candidate-name-${fresh!.candidateId}`)).toHaveTextContent('Test camera 3');
    expect(screen.getByTestId(`camera-candidate-status-${fresh!.candidateId}`).props.accessibilityLabel).toBe('New');
    expect(screen.getByTestId(`camera-candidate-status-${registered!.candidateId}`).props.accessibilityLabel).toBe('Already registered');
    expect(screen.getByTestId(`camera-candidate-device-${registered!.candidateId}`)).toHaveTextContent('Camera 1 (CAM-01)');
    expect(screen.getByTestId('camera-search-freshness')).toHaveTextContent(/^Searched at \d\d:\d\d:\d\d\. Kept until \d\d:\d\d:\d\d\.$/);
    expect(screen.getByTestId('camera-search-owner')).toHaveTextContent('Only you see this list, on this device.');
    expect(screen.getByTestId('camera-search-trust')).toHaveTextContent('Make, model and name are what each device announced. They are not checked.');
    expect(action().props.accessibilityLabel).toBe('Search again');
    // Never drawn: the ids and the endpoint reference.
    const text = JSON.stringify(screen.toJSON());
    expect(text).not.toMatch(/urn:uuid|DSC-\d{6}/);
  });

  it('a registered row offers "View device" and no Connect; "Search again" replaces the list with a new search', async () => {
    const { h, requests } = await openDevices();
    fireEvent.press(action());
    await settle();
    const [fresh, registered] = simCaptureCandidates();
    expect(screen.queryByTestId(`camera-candidate-connect-${registered!.candidateId}`)).toBeNull();
    expect(screen.getByTestId(`camera-candidate-view-${registered!.candidateId}`)).toBeTruthy();
    expect(screen.queryByTestId(`camera-candidate-view-${fresh!.candidateId}`)).toBeNull();
    fireEvent.press(action());
    await settle();
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(2);
    expect(searchAudit(h)).toHaveLength(2);
    expect(screen.getByTestId('camera-search-list')).toBeTruthy();
  });

  it('Simulated mode draws no "Development sources" group and no badge, although every candidate is a test source (D83, D91)', async () => {
    await openDevices();
    fireEvent.press(action());
    await settle();
    expect(simCaptureCandidates().every((entry) => entry.sourceClass === 'DEVELOPMENT')).toBe(true);
    expect(screen.queryByTestId('camera-search-development')).toBeNull();
    expect(screen.queryByText('Development sources')).toBeNull();
    expect(screen.queryByText('Development source')).toBeNull();
  });
});

describe('flow 10 on the tablet and the phone: the pointer only (§8d.10; D80(3); M4-CONN-PTR)', () => {
  it.each(['phonePortrait', 'tabletLandscape'] as const)('%s: Connect is drawn disabled with the web-console sentence; a press sends nothing; no text field exists', async (window) => {
    const { requests } = await openDevices({ window });
    fireEvent.press(action());
    await settle();
    const [fresh] = simCaptureCandidates();
    const connect = screen.getByTestId(`camera-candidate-connect-${fresh!.candidateId}`);
    expect(connect.props.accessibilityState?.disabled).toBe(true);
    expect(connect.props.accessibilityLabel).toBe('Connect 127.0.0.1. Connect this camera from the web console.');
    expect(screen.getByTestId(`camera-candidate-web-only-${fresh!.candidateId}`)).toHaveTextContent('Connect this camera from the web console.');
    expect(screen.getByTestId('camera-search-web-only-note')).toHaveTextContent('Camera passwords are entered on the web console only. Open Devices on the web console and search there.');
    const before = [...requests.seen];
    fireEvent.press(connect);
    await settle();
    expect(requests.seen).toEqual(before);
    expect(requests.seen.filter((line) => /candidates|credential/.test(line))).toEqual([]);
    // 0 password fields and 0 text inputs in the view tree of the whole screen.
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    expect(screen.UNSAFE_queryAllByProps({ secureTextEntry: true })).toHaveLength(0);
  });

  it('while a session is open the web-console sentence stays; no second reason is stacked on it', async () => {
    const { h } = await openDevices();
    fireEvent.press(action());
    await settle();
    act(() => h.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Rahmat Hidayat', investigatorId: h.sim.store.getState().auth.operatorId ?? '', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' }));
    await settle();
    const [fresh] = simCaptureCandidates();
    expect(screen.getByTestId(`camera-candidate-web-only-${fresh!.candidateId}`)).toHaveTextContent('Connect this camera from the web console.');
    expect(screen.queryByText(/cannot be connected while a session is open/)).toBeNull();
    // D80(4): a search is still allowed while a session is open and not recording.
    expect(disabled('camera-search-action')).toBe(false);
  });
});

describe('the gate of G13 (§8c.6; M4-DISC-RBAC)', () => {
  it('a role without CAPTURE_CONFIG: the button stays in place, disabled, with the two-role sentence; 0 calls of operations 93 and 94; no list', async () => {
    const { h, requests } = await openDevices({ user: 'budi.santoso' });
    expect(disabled('camera-search-action')).toBe(true);
    expect(action().props.accessibilityHint).toBe('Requires the Supervisor or Technician role');
    expect(screen.getByTestId('camera-search-gate')).toHaveTextContent('Requires the Supervisor or Technician role');
    fireEvent.press(action());
    await settle();
    expect(requests.seen.filter((line) => line.endsWith(DISCOVERY))).toEqual([]);
    expect(screen.queryByTestId('camera-search-list')).toBeNull();
    expect(searchAudit(h)).toHaveLength(0);
    // Negative control: the same screen for a SUPERVISOR does read (the first describe counts 1).
  });

  it('an unknown role reads "Checking your permissions…": disabled, never the role sentence', async () => {
    const { h } = await openDevices();
    act(() => h.sim.actions.signOut('USER'));
    await settle();
    // The auth gate may take the screen away on sign-out; where the panel is still drawn it must be checking.
    const gate = screen.queryByTestId('camera-search-gate');
    if (gate !== null) {
      expect(gate).toHaveTextContent('Checking your permissions…');
      expect(disabled('camera-search-action')).toBe(true);
    }
  });

  it('S14: while a session records the button is disabled with its sentence, and no search is sent', async () => {
    const { h, requests } = await openDevices({ recording: true });
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
    expect(disabled('camera-search-action')).toBe(true);
    expect(screen.getByTestId('camera-search-gate')).toHaveTextContent('Camera search is not available while a session is recording.');
    fireEvent.press(action());
    await settle();
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(0);
  });

  it('S14 by the answer: 409 DISCOVERY_NOT_ALLOWED_WHILE_RECORDING is drawn as that disabled state, not as a note', async () => {
    const { h, requests } = await openDevices();
    act(() => h.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0009', subjectType: 'SAKSI', subjectName: 'Rahmat Hidayat', investigatorId: h.sim.store.getState().auth.operatorId ?? '', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' }));
    await settle();
    requests.answer((request) => (request.method === 'POST' && request.path === DISCOVERY ? refusal(409, 'INVALID_STATE', 'DISCOVERY_NOT_ALLOWED_WHILE_RECORDING') : undefined));
    fireEvent.press(action());
    await settle();
    expect(disabled('camera-search-action')).toBe(true);
    expect(screen.getByTestId('camera-search-gate')).toHaveTextContent('Camera search is not available while a session is recording.');
    expect(screen.queryByTestId('camera-search-busy')).toBeNull();
  });
});

describe('S3: a bounded search (§8c.2, §8c.8; M4-UX-UNIT)', () => {
  it('the bar follows the Core clock and only grows; the hint is a fixed number; the END is operation 94\'s answer, never the bar', async () => {
    jest.useFakeTimers();
    const { h, requests } = await openDevices();
    const startedAt = now(h);
    const running = searchAt(startedAt, { state: 'RUNNING', windowMs: 3_000, completesAt: startedAt + 3_000, responderCount: 0, newCount: 0, registeredCount: 0 });
    let complete = false;
    requests.answer((request) => {
      if (request.path !== DISCOVERY) return undefined;
      if (request.method === 'POST') return respond(202, { ...running, created: true });
      return respond(200, complete ? view(h, { search: { ...running, state: 'COMPLETE', responderCount: 2, newCount: 1, registeredCount: 1 } }) : { search: running, candidates: [], truncated: false });
    });
    fireEvent.press(action());
    await settle();
    expect(screen.getByTestId('camera-search-status')).toHaveTextContent('Searching the network for cameras…');
    expect(screen.getByTestId('camera-search-hint')).toHaveTextContent('This takes up to 3 seconds.');
    expect(disabled('camera-search-action')).toBe(true);
    expect(screen.queryByTestId('camera-search-list')).toBeNull();
    const value = () => screen.getByTestId('camera-search-progress').props.accessibilityValue.now as number;
    expect(value()).toBe(0);

    const readsBefore = requests.count(`GET ${DISCOVERY}`);
    h.run(1_500);
    act(() => jest.advanceTimersByTime(1_500));
    await settle();
    expect(value()).toBe(50);
    // No faster than once per second: at most one read in 1.5 s.
    expect(requests.count(`GET ${DISCOVERY}`) - readsBefore).toBeLessThanOrEqual(1);
    // The hint is the same fixed number: no countdown.
    expect(screen.getByTestId('camera-search-hint')).toHaveTextContent('This takes up to 3 seconds.');

    h.run(3_000);
    act(() => jest.advanceTimersByTime(3_000));
    await settle();
    // The window is over on the bar, and the Core still answers RUNNING: the search has NOT ended.
    expect(value()).toBe(100);
    expect(screen.getByTestId('camera-search-status')).toHaveTextContent('Finishing the search…');
    expect(screen.queryByTestId('camera-search-list')).toBeNull();
    expect(requests.count(`GET ${DISCOVERY}`) - readsBefore).toBeLessThanOrEqual(5);

    complete = true;
    act(() => jest.advanceTimersByTime(1_000));
    await settle();
    expect(screen.getByTestId('camera-search-summary')).toHaveTextContent('2 found · 1 new · 1 already registered');
    expect(screen.queryByTestId('camera-search-searching')).toBeNull();
    // Nothing keeps reading once the search is complete.
    const settled = requests.count(`GET ${DISCOVERY}`);
    act(() => jest.advanceTimersByTime(5_000));
    await settle();
    expect(requests.count(`GET ${DISCOVERY}`)).toBe(settled);
  });
});

describe('the other states (S5, S7-S12)', () => {
  it('S5 empty: the title, the body and "Search again"', async () => {
    const { h, requests } = await openDevices();
    requests.answer((request) => {
      if (request.path !== DISCOVERY) return undefined;
      const empty = searchAt(now(h), { responderCount: 0, newCount: 0, registeredCount: 0, interfaceCount: 1 });
      return request.method === 'POST' ? respond(202, { ...empty, created: true }) : respond(200, { search: empty, candidates: [], truncated: false });
    });
    fireEvent.press(action());
    await settle();
    const empty = screen.getByTestId('camera-search-empty');
    expect(within(empty).getByText('No camera answered the search')).toBeTruthy();
    expect(within(empty).getByText('Check that each camera is powered and on the same network as the Core, then search again.')).toBeTruthy();
    expect(action().props.accessibilityLabel).toBe('Search again');
    expect(disabled('camera-search-action')).toBe(false);
  });

  it('S7 and the row marks: truncated warning, "Cannot be connected" twice with its sentence, the address-changed line; device text is drawn literally', async () => {
    const { h, requests } = await openDevices();
    const markup = '<Text onPress={x}>**Cam** [a](http://x)</Text>';
    const candidates = [
      candidate({ candidateId: 'CND-0000000000C1', conflict: true, testable: false, name: markup }),
      candidate({ candidateId: 'CND-0000000000F0', testable: false, vendor: null, model: null, name: null }),
      candidate({ candidateId: 'CND-0000000000A0', status: 'REGISTERED', deviceId: 'CAM-02', addressChanged: true }),
    ];
    requests.answer((request) => {
      if (request.path !== DISCOVERY) return undefined;
      const found = searchAt(now(h), { responderCount: 3, newCount: 2, registeredCount: 1, interfaceCount: 2 });
      return request.method === 'POST' ? respond(202, { ...found, created: true }) : respond(200, { search: found, candidates, truncated: true });
    });
    fireEvent.press(action());
    await settle();
    expect(screen.getByTestId('camera-search-truncated')).toHaveTextContent('More than 64 devices answered. The first 64 are listed.');
    expect(screen.getByTestId('camera-search-networks')).toHaveTextContent('Searched 2 networks.');
    expect(screen.getByTestId('camera-candidate-reason-CND-0000000000C1')).toHaveTextContent('Two devices announce the same identity. Neither can be connected.');
    expect(screen.getByTestId('camera-candidate-reason-CND-0000000000F0')).toHaveTextContent('This device announced an address that is not its own.');
    expect(screen.getByTestId('camera-candidate-model-CND-0000000000F0')).toHaveTextContent('Make and model not announced');
    expect(screen.queryByTestId('camera-candidate-name-CND-0000000000F0')).toBeNull();
    expect(screen.getByTestId('camera-candidate-address-changed-CND-0000000000A0')).toHaveTextContent('This camera now answers from another address than the registered one.');
    // Neither untestable row offers Connect; the announced text is one text node, exactly as sent.
    expect(screen.queryByTestId('camera-candidate-connect-CND-0000000000C1')).toBeNull();
    expect(screen.queryByTestId('camera-candidate-connect-CND-0000000000F0')).toBeNull();
    const name = screen.getByTestId('camera-candidate-name-CND-0000000000C1');
    expect(name.props.children).toBe(markup);
    expect(name.props.numberOfLines).toBe(1);
    expect(screen.getByTestId('camera-candidate-CND-0000000000C1').props.accessibilityLabel).toContain(markup);
    // The answer's order.
    expect(within(screen.getByTestId('camera-search-list')).getAllByTestId(/^camera-candidate-CND-[0-9A-F]{12}$/).map((row) => row.props.testID)).toEqual([
      'camera-candidate-CND-0000000000C1',
      'camera-candidate-CND-0000000000F0',
      'camera-candidate-CND-0000000000A0',
    ]);
  });

  it('S8: a FAILED search reads "could not be completed", the failure code is not drawn', async () => {
    const { h, requests } = await openDevices();
    requests.answer((request) => {
      if (request.path !== DISCOVERY) return undefined;
      const failed = searchAt(now(h), { state: 'FAILED', failureReason: 'NO_ELIGIBLE_INTERFACE', responderCount: 0, newCount: 0, registeredCount: 0 });
      return request.method === 'POST' ? respond(202, { ...failed, created: true }) : respond(200, { search: failed, candidates: [], truncated: false });
    });
    fireEvent.press(action());
    await settle();
    expect(screen.getByTestId('camera-search-failed')).toHaveTextContent('The search could not be completed. Nothing was changed.');
    expect(JSON.stringify(screen.toJSON())).not.toContain('NO_ELIGIBLE_INTERFACE');
    expect(screen.queryByTestId('camera-search-empty')).toBeNull();
    expect(action().props.accessibilityLabel).toBe('Search again');
  });

  it('S9: 503 reads "not available on this Core right now" with Retry — one call per press, none by itself', async () => {
    jest.useFakeTimers();
    const { requests } = await openDevices();
    requests.answer((request) => (request.method === 'POST' && request.path === DISCOVERY ? refusal(503, 'NOT_READY', 'DISCOVERY_NOT_READY') : undefined));
    fireEvent.press(action());
    await settle();
    expect(screen.getByTestId('camera-search-unavailable')).toHaveTextContent(/Camera search is not available on this Core right now\./);
    // Fix wave J (JA2-N10): no "yet" - the sentence promises nothing.
    expect(screen.getByTestId('camera-search-unavailable')).not.toHaveTextContent(/\byet\b/);
    act(() => jest.advanceTimersByTime(60_000));
    await settle();
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(1);
    fireEvent.press(screen.getByTestId('camera-search-retry'));
    await settle();
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(2);
  });

  it('S10: another operator is searching — an inline note, the button stays enabled, nothing is polled', async () => {
    jest.useFakeTimers();
    const { requests } = await openDevices();
    requests.answer((request) => (request.method === 'POST' && request.path === DISCOVERY ? refusal(409, 'INVALID_STATE', 'DISCOVERY_IN_PROGRESS') : undefined));
    fireEvent.press(action());
    await settle();
    expect(screen.getByTestId('camera-search-busy')).toHaveTextContent('Another operator is searching right now. Search again when their search has finished.');
    expect(disabled('camera-search-action')).toBe(false);
    const reads = requests.count(`GET ${DISCOVERY}`);
    act(() => jest.advanceTimersByTime(10_000));
    await settle();
    expect(requests.count(`GET ${DISCOVERY}`)).toBe(reads);
  });

  it('S11: 429 shows the fixed seconds of the answer, disables the button until then and re-enables it; no search is sent by itself', async () => {
    jest.useFakeTimers();
    const { requests } = await openDevices();
    requests.answer((request) => (request.method === 'POST' && request.path === DISCOVERY ? refusal(429, 'RATE_LIMITED', 'DISCOVERY_RATE_LIMITED', { 'retry-after': '7' }) : undefined));
    fireEvent.press(action());
    await settle();
    const sentence = 'The Core server is limiting requests from this console. Try again in 7 s.';
    expect(screen.getByTestId('camera-search-limited')).toHaveTextContent(sentence);
    expect(disabled('camera-search-action')).toBe(true);
    act(() => jest.advanceTimersByTime(4_000));
    await settle();
    // Not a countdown: the same sentence with the same number.
    expect(screen.getByTestId('camera-search-limited')).toHaveTextContent(sentence);
    expect(disabled('camera-search-action')).toBe(true);
    act(() => jest.advanceTimersByTime(3_100));
    await settle();
    expect(screen.queryByTestId('camera-search-limited')).toBeNull();
    expect(disabled('camera-search-action')).toBe(false);
    expect(requests.count(`POST ${DISCOVERY}`)).toBe(1);
  });

  it('S12: a result the Core no longer keeps is removed at the next read on focus, with its sentence', async () => {
    const { requests } = await openDevices();
    fireEvent.press(action());
    await settle();
    expect(screen.getByTestId('camera-search-list')).toBeTruthy();
    // The Core dropped the result (expiry, restart, a new sign-in): operation 94 now answers `search: null`.
    requests.answer((request) => (request.method === 'GET' && request.path === DISCOVERY ? respond(200, { search: null, candidates: [], truncated: false }) : undefined));
    act(() => router.push('/devices/CAM-01'));
    await settle();
    act(() => router.back());
    await settle();
    expect(screen.getByTestId('camera-search-expired')).toHaveTextContent('This search result is no longer kept. Search again to see the cameras.');
    expect(screen.queryByTestId('camera-search-list')).toBeNull();
    expect(action().props.accessibilityLabel).toBe('Search again');
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-m2-phone-discovery.test.tsx` (test-suite consolidation, D233): every case as it was.
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
describe('the phone layout', () => {
unmountBeforeTheHooksOfThisGroup();
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
});

// Fix wave J (JA2-N10; headline 5): a SIMULATED Core has no camera search - the rule that tells it apart.
describe('fix wave J - `isSimulatedCoreSearch`', () => {
  it('Live data, a device list, no device that states a source class = a simulated Core; everything else is not', () => {
    const plain = [{}, {}];
    const real = [{ sourceClass: 'DEVELOPMENT' }, {}];
    expect(isSimulatedCoreSearch(plain, true)).toBe(true);
    expect(isSimulatedCoreSearch(real, true)).toBe(false);
    // A Core the client knows nothing of yet is not called simulated.
    expect(isSimulatedCoreSearch([], true)).toBe(false);
    // Simulated client mode: the in-app simulator searches (its own demonstration), unchanged.
    expect(isSimulatedCoreSearch(plain, false)).toBe(false);
  });

  it('the copy: no "yet", no "connects to nothing"; the simulated-Core sentence says what to do instead', () => {
    const search = captureSelectorEn.search;
    expect(search.intro).not.toMatch(/connects to nothing/);
    expect(search.unavailable).not.toMatch(/\byet\b/);
    expect(search.simulatedCore).toMatch(/simulated/);
    expect(search.simulatedCore).toMatch(/Camera Devices/);
    expect(search.simulatedCore).not.toMatch(/\byet\b|Retry/);
  });
});
