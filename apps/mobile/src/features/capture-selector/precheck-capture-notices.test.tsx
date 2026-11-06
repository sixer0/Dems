/**
 * Session New, the pre-check step: an unreachable capture device (task 3 row 138; ux spec §8e.2
 * situation B, §8e.3, §8g.3 the start rule; decisions D80(2), D80(6), D83, D114; the software half of
 * M4-NODEV-B-T / -P, M4-NODEV-NOCFG-T, M4-MIC-ACTIVE-T / -P). The real Start Session route on the
 * real simulator, as `features/session-new/precheck.test.tsx`.
 *
 * "Unreachable" is `online: false` of the device in `captureDevices`, which the Core writes before a
 * pre-check run; here it is written through the same INTERNAL action (`raiseCaptureWarning`, phase
 * `PRESENCE`), and the alert of the run through phase `PRECHECK`, as row 133's gate does.
 */
import '@/features/session-new/testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { OPERATORS, PRECHECK_TOTAL_MAX_MS, type Sim } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderSessionNewApp, settle, type SessionNewHarness } from '@/features/session-new/testing/session-new-harness';

beforeEach(() => {
  jest.useFakeTimers();
  resetMissingKeys();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

type Warning = Parameters<Sim['actions']['raiseCaptureWarning']>[0];
const absent = (subject: string): Warning => ({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject, phase: 'PRESENCE' }) as Warning;
const atPrecheck = (subject: string, over: Record<string, unknown> = {}): Warning => ({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject, phase: 'PRECHECK', ...over }) as Warning;

function startGate(test: TestSim, operator = 0): void {
  const result = test.sim.actions.createSession({
    caseNumber: 'LP/2026/1001-0008',
    subjectType: 'SAKSI',
    subjectName: 'Rahmat Hidayat',
    investigatorId: OPERATORS[operator]!.id,
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  });
  if (!result.ok) throw new Error(`createSession failed: ${result.reason}`);
  test.sim.actions.beginPrecheck();
}

/** Opens the gate with `devices` unreachable, resolves the eight checks, then raises the run's alerts. */
async function openGate(devices: readonly string[], options: { operator?: number; alerts?: readonly Warning[]; window?: 'phonePortrait' | 'tabletLandscape' } = {}) {
  const seen: string[] = [];
  const h: SessionNewHarness = renderSessionNewApp({
    operator: options.operator ?? 1,
    ...(options.window === undefined ? {} : { window: options.window }),
    setup: (test) => {
      const real = test.sim.request.bind(test.sim);
      (test.sim as { request: Sim['request'] }).request = (request) => {
        seen.push(`${request.method} ${request.path}`);
        return real(request);
      };
      for (const device of devices) test.sim.actions.raiseCaptureWarning(absent(device));
      startGate(test, options.operator ?? 1);
    },
  });
  await settle();
  h.openFlow('/session/new?step=2');
  h.tick(PRECHECK_TOTAL_MAX_MS);
  for (const alert of options.alerts ?? []) act(() => h.sim.actions.raiseCaptureWarning(alert));
  await settle();
  return { h, seen };
}

const value = (id: string) => screen.getByTestId(`session-new-check-${id}-value`);
const status = (id: string) => screen.getByTestId(`session-new-check-${id}-status`).props.accessibilityLabel as string;
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

describe('a camera unreachable at pre-check: a warning, a degraded start after the acknowledgement (D80(6); D60, 2026-11-04: one of four tracks)', () => {
  it('the row names the device from `params.rule` — never "lens fault" / "no signal" — with the count of the one search of the pre-check', async () => {
    const { h } = await openGate(['CAM-02'], { alerts: [atPrecheck('CAM-02', { searchResponderCount: 1, degraded: true })] });
    expect(h.state().session!.precheck.outcome).toBe('WARN');
    expect(status('LENS_2')).toBe('WARN');
    expect(value('LENS_2')).toHaveTextContent('Camera 2 (CAM-02) is not reachable. The session will record with one camera fewer.');
    expect(value('LENS_2')).not.toHaveTextContent(/fault|no signal|UNREACHABLE/i);
    expect(status('LENS_1')).toBe('PASS');
    const notices = screen.getByTestId('session-new-capture-notices');
    expect(within(notices).getByTestId('session-new-capture-notices-sentence-LENS_2')).toHaveTextContent('Camera 2 (CAM-02) is not reachable. The session will record with one camera fewer.');
    expect(within(notices).getByTestId('session-new-capture-notices-count-LENS_2')).toHaveTextContent('A search found 1 camera.');
    // Start is allowed, degraded, only after the operator acknowledges.
    expect(disabled('session-new-next')).toBe(true);
    fireEvent.press(screen.getByTestId('session-new-acknowledge'));
    expect(disabled('session-new-next')).toBe(false);
    // The existing Retry of the pre-check is still offered beside "Search again".
    expect(screen.getByTestId('session-new-retry-checks')).toBeTruthy();
    expect(screen.getByTestId('session-new-capture-notices-search')).toBeTruthy();
  });

  it('a later run in which the camera answers leaves no notice and no warning row', async () => {
    const { h } = await openGate(['CAM-02'], { alerts: [atPrecheck('CAM-02', { searchResponderCount: 1, degraded: true })] });
    expect(screen.getByTestId('session-new-capture-notices')).toBeTruthy();
    // The Core found it reachable again (row 133 resolves the alert and writes `online`), then the operator presses Retry.
    act(() => h.sim.actions.clearCaptureWarning(atPrecheck('CAM-02')));
    fireEvent.press(screen.getByTestId('session-new-retry-checks'));
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    expect(status('LENS_2')).toBe('PASS');
    expect(screen.queryByTestId('session-new-capture-notices')).toBeNull();
    expect(h.state().alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM')).toHaveLength(0);
  });
});

describe('two of four cameras unreachable: degraded, not blocked (D60, 2026-11-04)', () => {
  it('both named rows WARN with the one-camera-fewer sentence; Next stays disabled until the acknowledgement', async () => {
    const { h } = await openGate(['CAM-01', 'CAM-02']);
    // D60: the loss of two of FOUR tracks still leaves a recording camera - a degraded start, not a block.
    expect(h.state().session!.precheck.outcome).toBe('WARN');
    expect(status('LENS_1')).toBe('WARN');
    expect(status('LENS_2')).toBe('WARN');
    expect(value('LENS_1')).toHaveTextContent('Camera 1 (CAM-01) is not reachable. The session will record with one camera fewer.');
    expect(value('LENS_2')).toHaveTextContent('Camera 2 (CAM-02) is not reachable. The session will record with one camera fewer.');
    expect(disabled('session-new-next')).toBe(true);
    fireEvent.press(screen.getByTestId('session-new-acknowledge'));
    expect(disabled('session-new-next')).toBe(false);
  });

  it('every camera unreachable: both rows BLOCK, the blocked text says a session cannot start, Next stays disabled', async () => {
    // D60 (2026-11-04): the block needs ALL FOUR camera lines down (NO_CAMERA), not just the named two.
    const { h } = await openGate(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']);
    expect(h.state().session!.precheck.outcome).toBe('BLOCK');
    expect(status('LENS_1')).toBe('BLOCK');
    expect(status('LENS_2')).toBe('BLOCK');
    expect(value('LENS_1')).toHaveTextContent('No camera is reachable. A session cannot start.');
    expect(screen.getByTestId('session-new-gate-block')).toHaveTextContent(/No camera is reachable\. A session cannot start\./);
    expect(screen.getByTestId('session-new-gate-block')).not.toHaveTextContent(/fault|UNREACHABLE/);
    expect(disabled('session-new-next')).toBe(true);
    expect(screen.queryByTestId('session-new-acknowledge')).toBeNull();
  });
});

describe('the active microphone unreachable: blocked, with no switch at pre-check (D83; M4-MIC-ACTIVE)', () => {
  it('the row tells the operator to cancel and make the other microphone primary on Devices; no control changes the microphone here', async () => {
    const { h } = await openGate(['MIC-01']);
    expect(h.state().session!.precheck.outcome).toBe('BLOCK');
    expect(status('MIC_PRIMARY')).toBe('BLOCK');
    expect(value('MIC_PRIMARY')).toHaveTextContent('MIC 1 (MIC-01) is the microphone of the transcribed channel 1 and is not reachable. Cancel this session, assign another microphone to channel 1 on Devices, then start again.'); // D61 (2026-11-04): the active role became the transcribed channel
    expect(status('MIC_STANDBY')).toBe('PASS');
    expect(disabled('session-new-next')).toBe(true);
    // The only actions of the block: the microphone re-read (G17). No toggle, no "use the other one".
    const notices = screen.getByTestId('session-new-capture-notices');
    expect(within(notices).getByTestId('session-new-capture-notices-rescan-action').props.accessibilityLabel).toBe('Search again for microphones');
    expect(within(notices).queryByTestId('session-new-capture-notices-search')).toBeNull();
    expect(screen.queryByTestId(/capture-selector-edit|mic-source|make-primary|use-other/)).toBeNull();
    expect(screen.queryByText(/Use MIC 2|Switch to MIC 2|Make MIC 2 primary/i)).toBeNull();
    // The channels of the selector are untouched by the pre-check (D61, 2026-11-04: roles became numbered channels).
    expect(h.state().captureConfig.mics.find((mic) => mic.inputId === 'MIC-01')?.channel).toBe('MIC-01');
  });

  it('the standby microphone unreachable is a warning: "no standby microphone", a degraded start after the acknowledgement', async () => {
    const { h } = await openGate(['MIC-02']);
    expect(h.state().session!.precheck.outcome).toBe('WARN');
    expect(status('MIC_STANDBY')).toBe('WARN');
    expect(value('MIC_STANDBY')).toHaveTextContent('MIC 2 (MIC-02) is not reachable. The session will record without that microphone channel.'); // D61 (2026-11-04): channel 2 records beside the transcribed one; its loss is no longer "no standby"
    fireEvent.press(screen.getByTestId('session-new-acknowledge'));
    expect(disabled('session-new-next')).toBe(false);
  });
});

describe('the operator without CAPTURE_CONFIG (§8e.3; D80(2); M4-NODEV-NOCFG-T)', () => {
  it('sees the outcome as the notification only: the sentence and the count, "Search again" disabled with the role sentence, Retry works, no list is requested', async () => {
    // Operator 0 is the INVESTIGATOR: SESSION_START without CAPTURE_CONFIG.
    const { h, seen } = await openGate(['CAM-02'], { operator: 0, alerts: [atPrecheck('CAM-02', { searchResponderCount: 2, degraded: true })] });
    expect(value('LENS_2')).toHaveTextContent('Camera 2 (CAM-02) is not reachable. The session will record with one camera fewer.');
    expect(screen.getByTestId('session-new-capture-notices-count-LENS_2')).toHaveTextContent('A search found 2 cameras.');
    expect(disabled('session-new-capture-notices-search')).toBe(true);
    expect(screen.getByTestId('session-new-capture-notices-search-gate')).toHaveTextContent('Requires the Supervisor or Technician role');
    fireEvent.press(screen.getByTestId('session-new-capture-notices-search'));
    await settle();
    expect(seen.filter((line) => line.includes('/capture/'))).toEqual([]);
    expect(screen.queryByTestId('camera-search-list')).toBeNull();
    expect(screen.queryByTestId(/^camera-candidate-/)).toBeNull();
    // Their own Retry (SESSION_START) runs the checks again.
    const before = h.state().session!.precheck.startedAt;
    fireEvent.press(screen.getByTestId('session-new-retry-checks'));
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    expect(h.state().session!.precheck.startedAt).not.toBe(before);
    expect(status('LENS_2')).toBe('WARN');
  });

  it('the SUPERVISOR who started the session is gated too since the RB revocation: disabled with the role sentence, no search sent', async () => {
    // RB revocation (2026-10-29, carried by checkpoint f85e9c01; D60 sweep 2026-11-04): CAPTURE_CONFIG —
    // and with it the notice's "Search again" — is the TECHNICIAN's alone, and a technician never
    // starts a session (OD-10). No demonstration identity both starts the session and may search here.
    const { seen } = await openGate(['CAM-02'], { operator: 1, alerts: [atPrecheck('CAM-02', { searchResponderCount: 0, degraded: true })] });
    expect(disabled('session-new-capture-notices-search')).toBe(true);
    fireEvent.press(screen.getByTestId('session-new-capture-notices-search'));
    await settle();
    expect(seen.filter((line) => line === 'POST /api/v1/capture/discovery')).toHaveLength(0);
    expect(screen.queryByTestId('session-new-capture-notices-search-summary')).toBeNull();
  });
});

describe('nothing unreachable: the step is as before', () => {
  it('draws no notice block, no badge and no text field', async () => {
    await openGate([]);
    expect(screen.queryByTestId('session-new-capture-notices')).toBeNull();
    expect(screen.queryByTestId(/-source$/)).toBeNull();
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });

  it('task 4 row 169, the seeded selector: each preview meter reads the level of its input as before (no "Not measured")', async () => {
    await openGate([]);
    for (const channel of ['AUDIO-01', 'AUDIO-02']) {
      expect(screen.getByTestId(`session-new-meter-${channel}`)).toBeTruthy();
      expect(screen.queryByTestId(`session-new-meter-${channel}-not-measured`)).toBeNull();
    }
    expect(screen.queryByText(/has no source assigned/)).toBeNull();
  });
});

describe('task 4 row 169: an unassigned selector slot is a BLOCK item - the transcription slots, channel 2 too (decisions C18 (1), C25; D61, 2026-11-04)', () => {
  // D61 (2026-11-04): the roles became the numbered channels; the pre-check rows MIC_PRIMARY/MIC_STANDBY check channels 1 and 2.
  const SLOT_OF = { LENS_1: 'VIDEO-01', LENS_2: 'VIDEO-02', MIC_PRIMARY: 'MIC-01', MIC_STANDBY: 'MIC-02' } as const;
  const SENTENCE = {
    LENS_1: 'Camera 1 has no source assigned. Assign one on Devices.',
    LENS_2: 'Camera 2 has no source assigned. Assign one on Devices.',
    MIC_PRIMARY: 'Microphone 1 has no source assigned. Assign one on Devices.', // D61: `common.captureSlot.MIC-01`
    MIC_STANDBY: 'Microphone 2 has no source assigned. Assign one on Devices.', // D61
  } as const;
  type SlotCheck = keyof typeof SLOT_OF;
  const isSlotCheck = (id: string): id is SlotCheck => id in SLOT_OF;

  /**
   * The gate as a Core in its own capture answers it for an EMPTY selector (names register 5.2): the four
   * items of the slots are `BLOCK`, `value: 'NOT_ASSIGNED'`, `reasonCode: null`, `params { rule, slot }` and
   * NO device id. The double: the in-app simulator's blocked gate, with those four items and the selector's
   * lines put in place through the store (the simulator itself keeps today's behaviour, decision C21 (6)).
   */
  async function openUnassigned(checks: readonly SlotCheck[] = ['LENS_1', 'LENS_2', 'MIC_PRIMARY', 'MIC_STANDBY'], window?: 'phonePortrait' | 'tabletLandscape') {
    const { h } = await openGate(['CAM-01', 'CAM-02'], window === undefined ? {} : { window });
    act(() =>
      h.sim.store.setState((s) => ({
        captureConfig: {
          ...s.captureConfig,
          cameras: s.captureConfig.cameras.filter((line) => !checks.some((id) => SLOT_OF[id] === line.trackId)),
          mics: s.captureConfig.mics.filter((line) => !checks.some((id) => SLOT_OF[id] === line.channel)), // D61 (2026-11-04): the line is found by CHANNEL
        },
        session:
          s.session === null
            ? null
            : {
                ...s.session,
                precheck: {
                  ...s.session.precheck,
                  outcome: 'BLOCK' as const,
                  items: s.session.precheck.items.map((item) =>
                    isSlotCheck(item.id) && checks.includes(item.id)
                      ? { ...item, status: 'BLOCK' as const, value: 'NOT_ASSIGNED', reason: `${SLOT_OF[item.id]}: source not assigned`, reasonCode: null, params: { rule: 'sourceNotAssigned', slot: SLOT_OF[item.id] } }
                      : isSlotCheck(item.id)
                        ? { ...item, status: 'PASS' as const, value: 'READY', reason: null, reasonCode: null, params: {} }
                        : item,
                  ),
                },
              },
      })),
    );
    await settle();
    return h;
  }

  it('each of the four rows is drawn as a blocking item with its sentence - by slot name, no device id, never the raw value', async () => {
    const h = await openUnassigned();
    expect(h.state().session!.precheck.items.filter((item) => item.status === 'BLOCK' && item.params?.['deviceId'] === undefined)).toHaveLength(4);
    for (const id of ['LENS_1', 'LENS_2', 'MIC_PRIMARY', 'MIC_STANDBY'] as const) {
      expect(status(id)).toBe('BLOCK');
      expect(value(id)).toHaveTextContent(SENTENCE[id]);
      expect(value(id)).not.toHaveTextContent(/NOT_ASSIGNED|sourceNotAssigned|not reachable|no signal|fault/i);
      // No role line and no badge of a device: the selector holds no line for the slot.
      expect(screen.queryByTestId(`session-new-check-${id}-role`)).toBeNull();
      expect(screen.queryByTestId(`session-new-check-${id}-source`)).toBeNull();
    }
    // The blocked text names the four slots; the start stays closed; a BLOCK is not acknowledged.
    const block = screen.getByTestId('session-new-gate-block');
    for (const id of ['LENS_1', 'LENS_2', 'MIC_PRIMARY', 'MIC_STANDBY'] as const) expect(block).toHaveTextContent(new RegExp(SENTENCE[id].replace(/\./g, '\\.')));
    expect(disabled('session-new-next')).toBe(true);
    expect(screen.queryByTestId('session-new-acknowledge')).toBeNull();
    // It is not an unreachable device: no notice block, no "Search again".
    expect(screen.queryByTestId('session-new-capture-notices')).toBeNull();
  });

  it('with no microphone line no level of any channel is read: each preview meter says "Not measured", no bars and no number', async () => {
    const h = await openUnassigned();
    // D61 (2026-11-04): the unassigned slots above empty channels 1 and 2; the plane holds four lines, so clear the rest too.
    act(() => h.sim.store.setState((s) => ({ captureConfig: { ...s.captureConfig, mics: [] } })));
    await settle();
    expect(h.state().captureConfig.mics).toHaveLength(0);
    // The meters slice still holds frames under the built-in inputs: the screen does not read them.
    expect(Object.keys(h.state().audio.inputs).length).toBeGreaterThan(0);
    // Since row 183 (D172) the speak-to-test preview draws four tiles and four meters (CAPTURE_PAIRS, "Mic N (Camera N)");
    // this case reads the meters of channels 1 and 2 only - the four-channel claim of the plane is proven on Session Live.
    for (const channel of ['AUDIO-01', 'AUDIO-02']) {
      expect(screen.getByTestId(`session-new-meter-${channel}-not-measured`)).toHaveTextContent('Not measured');
      expect(screen.queryByTestId(`session-new-meter-${channel}`)).toBeNull();
    }
  });

  it('tablet landscape (the device column): the same four blocking rows and the same two meters without a level', async () => {
    await openUnassigned(undefined, 'tabletLandscape');
    for (const id of ['LENS_1', 'LENS_2', 'MIC_PRIMARY', 'MIC_STANDBY'] as const) {
      expect(status(id)).toBe('BLOCK');
      expect(value(id)).toHaveTextContent(SENTENCE[id]);
    }
    for (const channel of ['AUDIO-01', 'AUDIO-02']) {
      expect(screen.getByTestId(`session-new-meter-${channel}-not-measured`)).toHaveTextContent('Not measured');
      expect(screen.queryByTestId(`session-new-meter-${channel}`)).toBeNull();
    }
    expect(disabled('session-new-next')).toBe(true);
  });

  it('the channel-2 microphone ALONE unassigned blocks as the others do (C25): its row, its sentence, Next disabled, nothing to acknowledge', async () => {
    await openUnassigned(['MIC_STANDBY']);
    expect(status('MIC_STANDBY')).toBe('BLOCK');
    expect(value('MIC_STANDBY')).toHaveTextContent(SENTENCE.MIC_STANDBY);
    expect(status('MIC_PRIMARY')).toBe('PASS');
    expect(status('LENS_1')).toBe('PASS');
    expect(screen.getByTestId('session-new-gate-block')).toHaveTextContent(/Microphone 2 has no source assigned\. Assign one on Devices\./); // D61 (2026-11-04): the slot word is the numbered channel
    expect(disabled('session-new-next')).toBe(true);
    expect(screen.queryByTestId('session-new-acknowledge')).toBeNull();
    // D61: every HELD channel reads its own level - only the empty channel 2 has no input and no level.
    expect(screen.getByTestId('session-new-meter-AUDIO-02-not-measured')).toBeTruthy();
    expect(screen.queryByTestId('session-new-meter-AUDIO-01-not-measured')).toBeNull();
    expect(screen.getByTestId('session-new-meter-AUDIO-01')).toBeTruthy();
  });
});
