// Row 118 (R-8; ux §8a tablet/phone columns; M6-STTCFG-TAB / M6-STTCFG-PHONE, automated part):
// the read-only transcription status in the SIMULATED source (the in-app simulator answers
// operation 90) and in the LIVE source (the typed client over the contract-checked fake transport).
// The component is rendered in isolation: it is mounted in Settings by row 68's screen.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, Pressable, Switch, Text, TextInput, View } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import type { ReactTestInstance } from 'react-test-renderer';
import { pickReplicatedState, type ReplicatedState, type SttConfig } from '@dems/shared/api';
import { createFakeTransport, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEMO_OPERATOR_PASSWORD, type Sim } from '@dems/shared/sim';
import { AppProviders } from '@/providers';
import { createMobileLive, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, type MobileLive } from '@/runtime';
import { createTestSim } from '@/runtime/testing/test-sim';
import { SttStatusBlock, TranscriptionSection } from './stt-status-section';

const PHONE: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
const TABLET: Metrics = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 24, right: 0, bottom: 0, left: 0 } };
const CONFIG_PATH = '/api/v1/transcription/config';

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

const queryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });

function setWindow(metrics: Metrics) {
  const { width, height } = metrics.frame;
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });
}

/** Anything a person can operate or type into: the "edit affordances" of the check M6-STTCFG-TAB/PHONE. */
function editAffordances(): string[] {
  const found: string[] = [];
  const operable = /^(button|switch|adjustable|checkbox|radio|radiogroup|combobox|spinbutton|search|tab|menuitem)$/;
  const walk = (node: ReactTestInstance) => {
    const props = (node.props ?? {}) as Record<string, unknown>;
    const handlers = Object.keys(props).filter((name) => /^(onPress|onLongPress|onChangeText|onValueChange|onChange|onSelectedChange|onSubmitEditing|onSelectionChange)$/.test(name) && typeof props[name] === 'function');
    const role = typeof props.accessibilityRole === 'string' ? props.accessibilityRole : typeof props.role === 'string' ? props.role : '';
    if (handlers.length > 0 || operable.test(role) || props.editable === true) found.push(`${String(props.testID ?? node.type)}:${[...handlers, role].filter(Boolean).join(',')}`);
    for (const child of node.children) if (typeof child !== 'string') walk(child);
  };
  // Only what the block draws: the providers' own wrappers (safe-area listener, keyboard) are not its controls.
  walk(screen.getByTestId('probe-root'));
  return found;
}

/** Promise jobs, then the query library's 0 ms notification timer, then the jobs it released. */
async function flushAsync(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

const wholeText = (): string => JSON.stringify(screen.toJSON());

const postSave = (sim: Sim, body: Record<string, unknown>) => sim.request({ method: 'POST', path: CONFIG_PATH, body });

describe('the affordance counter can fail (negative control)', () => {
  it('finds a switch, a field and a press handler when they are drawn', () => {
    const { unmount } = render(
      <View testID="probe-root">
        <Switch testID="control-switch" value={false} onValueChange={() => undefined} />
        <TextInput testID="control-field" editable onChangeText={() => undefined} />
        <Pressable testID="control-press" onPress={() => undefined} accessibilityRole="button">
          <Text>Save</Text>
        </Pressable>
      </View>,
    );
    const found = editAffordances().join(' | ');
    expect(found).toContain('control-switch');
    expect(found).toContain('control-field');
    expect(found).toContain('control-press');
    unmount();
  });
});

describe('SIMULATED source: operation 90 answered by the in-app simulator', () => {
  let sim: Sim;
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    resetDebugLaunchForTests();
    sim = createTestSim().sim;
  });
  afterEach(() => sim.stop());

  const mount = (metrics: Metrics = PHONE, ui = <TranscriptionSection />) =>
    render(
      <AppProviders sim={sim} queryClient={queryClient()} safeAreaMetrics={metrics} heartbeatSocketFactory={() => new InertSocket()}>
        <View testID="probe-root">{ui}</View>
      </AppProviders>,
    );
  const signIn = (username: string) => expect(sim.actions.signIn(username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);

  for (const [name, metrics] of [
    ['phone', PHONE],
    ['tablet', TABLET],
  ] as const) {
    it(`${name}: shows enabled, backend, model, labelling, credential "not set" and "not tested yet"; 0 edit affordances`, async () => {
      signIn('budi.santoso'); // INVESTIGATOR: op 90 is read by every signed-in role
      setWindow(metrics);
      const { unmount } = mount(metrics);
      await flushAsync();
      await flushAsync();

      expect(screen.getByTestId('stt-status-enabled-chip')).toHaveTextContent(/Enabled/);
      expect(screen.getByTestId('stt-status-backend')).toHaveTextContent(/Local CPU/);
      expect(screen.getByTestId('stt-status-model')).toHaveTextContent(/ggml-large-v3-turbo/);
      expect(screen.getByTestId('stt-status-labelling')).toHaveTextContent(/On$/);
      expect(screen.getByTestId('stt-status-credential')).toHaveTextContent(/Not set$/);
      expect(screen.getByTestId('stt-status-test-chip')).toHaveTextContent(/Not tested yet/);
      expect(screen.queryByTestId('stt-status-test-at')).toBeNull();
      expect(screen.queryByTestId('stt-status-pending')).toBeNull();
      // No Save, no Test connection, no field, no switch, no picker, no retry: nothing to operate.
      expect(editAffordances()).toEqual([]);
      for (const word of ['Save', 'Test connection', 'Edit', 'Change backend']) expect(screen.queryByText(word)).toBeNull();
      unmount();
    });
  }

  it('follows a web edit: one saved change (op 91) appends its audit row and the status reads again', async () => {
    // Ruling 0034 of 2026-10-29: op 91 needs CAPTURE_CONFIG (TECHNICIAN only). This device stays
    // only the reader; the "web console" writer that the save emulates holds the grant.
    signIn('rina.wijaya');
    const { unmount } = mount();
    await flushAsync();
    await flushAsync();
    expect(screen.getByTestId('stt-status-enabled-chip')).toHaveTextContent(/Enabled/);

    act(() => {
      expect(postSave(sim, { revision: 1, enabled: false, backend: 'omlx-server', endpoint: 'http://127.0.0.1:8555/v1', model: 'whisper-large-v3-turbo', diarization: false }).status).toBe(200);
    });
    await flushAsync();
    await flushAsync();

    expect(screen.getByTestId('stt-status-enabled-chip')).toHaveTextContent(/Disabled/);
    expect(screen.getByTestId('stt-status-backend')).toHaveTextContent(/oMLX server/);
    expect(screen.getByTestId('stt-status-model')).toHaveTextContent(/whisper-large-v3-turbo/);
    expect(screen.getByTestId('stt-status-labelling')).toHaveTextContent(/Off$/);
    // The endpoint is the web console's: the tablet and the phone never draw it.
    expect(wholeText()).not.toContain('127.0.0.1');
    expect(editAffordances()).toEqual([]);
    unmount();
  });

  it('a credential is never shown, only "set": neither a secret value nor a reference target reaches the screen', async () => {
    // Ruling 0034 of 2026-10-29: op 91 needs CAPTURE_CONFIG (TECHNICIAN only); this bed is the web
    // default (no deviceConsole), so the credential-carrying body answers as the web console's.
    signIn('rina.wijaya');
    const SECRET = ['secret', 'value', 'marker'].join('-');
    const REFERENCE = 'omlx-settings:auth.api_key';
    const { unmount } = mount();
    await flushAsync();
    await flushAsync();
    act(() => {
      expect(postSave(sim, { revision: 1, credential: { kind: 'SECRET', value: SECRET } }).status).toBe(200);
    });
    await flushAsync();
    await flushAsync();
    expect(screen.getByTestId('stt-status-credential')).toHaveTextContent(/Set$/);
    act(() => {
      expect(postSave(sim, { revision: 2, credential: { kind: 'REFERENCE', ref: REFERENCE } }).status).toBe(200);
    });
    await flushAsync();
    await flushAsync();
    expect(screen.getByTestId('stt-status-credential')).toHaveTextContent(/Set$/);
    const drawn = wholeText();
    expect(drawn).not.toContain(SECRET);
    expect(drawn).not.toContain('omlx-settings');
    expect(drawn).not.toContain('REFERENCE');
    expect(drawn).not.toContain('ENCRYPTED');
    unmount();
  });

  it('the last connection test is shown with its time, and the pending note when a session is open', async () => {
    signIn('rina.wijaya'); // TECHNICIAN
    act(() => {
      expect(sim.request({ method: 'POST', path: `${CONFIG_PATH}/test` }).status).toBe(200);
    });
    const { unmount } = mount();
    await flushAsync();
    await flushAsync();
    expect(screen.getByTestId('stt-status-test-chip')).toHaveTextContent(/Reachable, model available/);
    expect(screen.getByTestId('stt-status-test-at')).toBeTruthy();
    unmount();
  });

  it('a read that fails shows a plain card with a rate-limited retry (3 s countdown), never the raw error', async () => {
    signIn('budi.santoso');
    const request = jest.spyOn(sim, 'request').mockImplementation(() => ({ status: 503, headers: {}, body: { error: { code: 'NOT_READY', message: 'secret-detail-should-not-show' } } }));
    const { unmount } = mount(PHONE, <SttStatusBlock />);
    await flushAsync();
    await flushAsync();
    expect(screen.getByTestId('stt-status-error')).toBeTruthy();
    expect(screen.getByText('The transcription status could not be read')).toBeTruthy();
    expect(wholeText()).not.toContain('secret-detail-should-not-show');
    expect(screen.queryByTestId('stt-status-card')).toBeNull();

    const calls = request.mock.calls.length;
    fireEvent.press(screen.getByTestId('stt-status-retry'));
    await flushAsync();
    expect(request.mock.calls.length).toBe(calls + 1);
    expect(screen.getByTestId('stt-status-retry')).toHaveTextContent(/Retry in 3s/);
    // During the cooldown a second press reads nothing.
    fireEvent.press(screen.getByTestId('stt-status-retry'));
    await flushAsync();
    expect(request.mock.calls.length).toBe(calls + 1);
    request.mockRestore();
    unmount();
  });

  it('signed out: no read is made and the block says so', async () => {
    const request = jest.spyOn(sim, 'request');
    const { unmount } = mount(PHONE, <SttStatusBlock />);
    await flushAsync();
    expect(screen.getByTestId('stt-status-signed-out')).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
    unmount();
  });
});

describe('LIVE source: operation 90 through the typed client of the Live source', () => {
  let fake: FakeTransport;
  let mobile: MobileLive | undefined;
  let engine: ReturnType<typeof createTestSim>;

  const wire = (): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(engine.sim.store.getState())) as ReplicatedState);
  const LIVE_CONFIG: SttConfig = {
    enabled: true,
    backend: 'omlx-server',
    endpoint: 'http://127.0.0.1:8555/v1',
    model: 'whisper-large-v3-turbo',
    language: 'id',
    diarization: true,
    credentialSet: true,
    credentialKind: 'ENCRYPTED',
    revision: 3,
    updatedAt: 1_790_000_000_000,
    pendingForNextSession: true,
    lastTest: { reachable: false, modelAvailable: false, testedAt: 1_790_000_050_000 },
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    resetDebugLaunchForTests();
    fake = createFakeTransport({ epoch: 2, revision: 10 });
    engine = createTestSim({ start: fake.clock.now() });
    // The Core's engine is signed in as the operator who saves on the web console — TECHNICIAN since
    // ruling 0034 of 2026-10-29 revoked CAPTURE_CONFIG from SUPERVISOR (op 91 needs it).
    expect(engine.sim.actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    fake.scriptSignedInStart(wire());
    fake.onConnect((connection) => {
      if (connection.state === 'OPEN') connection.heartbeat();
    });
  });
  afterEach(() => {
    mobile?.stop();
    mobile = undefined;
    engine.sim.stop();
    fake.assertNoViolations();
  });

  function mountLive() {
    const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
    if (created === null) throw new Error('jest is a debug build: a Live source is built');
    mobile = created;
    return render(
      <AppProviders sim={created.sim} queryClient={queryClient()} safeAreaMetrics={PHONE} heartbeatSocketFactory={() => new InertSocket()}>
        <View testID="probe-root">
          <TranscriptionSection />
        </View>
      </AppProviders>,
    );
  }

  it('reads operation 90 with GET and no body; shows the answer; the credential kind, the endpoint and the revision never reach the screen', async () => {
    fake.answer('getSttConfig', { status: 200, body: LIVE_CONFIG });
    const { unmount } = mountLive();
    await flushAsync();
    await flushAsync();

    const calls = fake.log.requestsOf('getSttConfig');
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.method).toBe('GET');
    expect(screen.getByTestId('stt-status-backend')).toHaveTextContent(/oMLX server/);
    expect(screen.getByTestId('stt-status-credential')).toHaveTextContent(/Set$/);
    expect(screen.getByTestId('stt-status-test-chip')).toHaveTextContent(/Not reachable/);
    expect(screen.getByTestId('stt-status-pending')).toBeTruthy();
    const drawn = wholeText();
    for (const hidden of ['127.0.0.1', 'ENCRYPTED', 'REFERENCE']) expect(drawn).not.toContain(hidden);
    // Read-only: the only operation this block ever asks for is operation 90.
    expect(fake.log.requestsOf('updateSttConfig')).toHaveLength(0);
    expect(fake.log.requestsOf('testSttConnection')).toHaveLength(0);
    expect(editAffordances()).toEqual([]);
    unmount();
  });

  it('follows a web edit: a new STT_CONFIG_CHANGED row in the replicated audit slice reads operation 90 again', async () => {
    fake.answer('getSttConfig', { status: 200, body: LIVE_CONFIG });
    const { unmount } = mountLive();
    await flushAsync();
    await flushAsync();
    const before = fake.log.requestsOf('getSttConfig').length;
    expect(screen.getByTestId('stt-status-enabled-chip')).toHaveTextContent(/Enabled/);

    // The Core's engine saves the configuration (what op 91 does) and the audit slice travels to this device.
    fake.answer('getSttConfig', { status: 200, body: { ...LIVE_CONFIG, enabled: false, revision: 4, pendingForNextSession: false } });
    act(() => {
      expect(engine.sim.request({ method: 'POST', path: CONFIG_PATH, body: { revision: 1, enabled: false } }).status).toBe(200);
    });
    const audit = JSON.parse(JSON.stringify(engine.sim.store.getState().audit));
    act(() => {
      fake.connection().delta([{ op: 'replace', slice: 'audit', value: audit }] as never, { revision: 11 });
    });
    await flushAsync();
    await flushAsync();

    expect(fake.log.requestsOf('getSttConfig').length).toBe(before + 1);
    expect(screen.getByTestId('stt-status-enabled-chip')).toHaveTextContent(/Disabled/);
    expect(screen.queryByTestId('stt-status-pending')).toBeNull();
    unmount();
  });

  it('the Core refuses or fails: a plain card, the raw answer is not drawn', async () => {
    fake.fail('getSttConfig');
    const { unmount } = mountLive();
    await flushAsync();
    await flushAsync();
    expect(screen.getByTestId('stt-status-error')).toBeTruthy();
    expect(screen.queryByTestId('stt-status-card')).toBeNull();
    unmount();
  });
});
