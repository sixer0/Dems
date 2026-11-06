// Start New Session (step 78; 04_mobile_specs §4.4, §3.6, §2.4; MA-11 MB 3, MA-29 steps 1–3):
// the MB 3 form with the shared zod schema, the create → precheck hand-over, the ARMED summary,
// the Start Recording hand-off to the monitor route (with and without 3-2-1), the §3.6 guards and
// the tablet panes. Real route file, real simulator (manual clock), stand-in monitor with the live
// route's own policy. Import order: the test setup, then the router harness (see their headers).
import './testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BackHandler } from 'react-native';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, PRECHECK_ORDER, PRECHECK_TOTAL_MAX_MS, ScenarioName } from '@dems/shared/sim';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import type { TestSim } from '@/runtime/testing/test-sim';
import { auditTypes, renderSessionNewApp, settle, type SessionNewHarness } from './testing/session-new-harness';

afterEach(() => {
  resetMotionStateForTests();
  jest.restoreAllMocks();
});

const next = () => screen.getByTestId('session-new-next');
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

async function openFlow(options: Parameters<typeof renderSessionNewApp>[0] = {}): Promise<SessionNewHarness> {
  const h = renderSessionNewApp(options);
  await settle();
  h.openFlow();
  return h;
}

/** Fills step 1 the way an operator does on MB 3: scan, TERSANGKA, a name. */
async function fillStep1(name = 'Ahmad Fauzi'): Promise<void> {
  // The zod resolver validates asynchronously: each edit settles before the next, as a person's would.
  const settleValidation = () => act(async () => {});
  fireEvent.press(screen.getByTestId('session-new-scan'));
  await settleValidation();
  fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
  await settleValidation();
  fireEvent.changeText(screen.getByTestId('session-new-subject-name'), name);
  await settleValidation();
}

/** Presses Next and lets react-hook-form's asynchronous submit (zod resolver) finish. */
async function pressNextAsync(): Promise<void> {
  fireEvent.press(next());
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** Step 1 → 2 → gate PASS → 3. */
async function goToReady(h: SessionNewHarness): Promise<void> {
  await fillStep1();
  await pressNextAsync();
  h.tick(PRECHECK_TOTAL_MAX_MS);
  fireEvent.press(next());
}

describe('step 1: Session Information (MB 3, D62)', () => {
  it('shows the MB 3 regions in order, with the investigator defaulting to the signed-in operator', async () => {
    await openFlow();
    expect(screen.getByTestId('screen-session-new')).toBeTruthy();
    expect(screen.getByText('Start New Session')).toBeTruthy();
    // Stepper: Session Info (current), Devices Check, Ready.
    const stepper = screen.getByTestId('session-new-stepper');
    expect(within(stepper).getByText('Session Info')).toBeTruthy();
    expect(within(stepper).getByText('Devices Check')).toBeTruthy();
    expect(within(stepper).getByText('Ready')).toBeTruthy();
    expect(screen.getByText('Session Information')).toBeTruthy();
    // MB 3 field order (Recording Profile added for web parity, 04 §4.4).
    const labels = ['Case Number', 'Subject Type', 'Subject Name', 'Investigator', 'Room / Location', 'Recording Profile', 'Notes (Optional)'];
    for (const label of labels) expect(screen.getAllByText(new RegExp(label.replace(/[()/]/g, '\\$&'))).length).toBeGreaterThanOrEqual(1);
    for (const code of ['TERSANGKA', 'SAKSI', 'LAINNYA']) expect(screen.getByTestId(`session-new-subject-${code}`)).toBeTruthy();
    expect(screen.getByText(i18n.t('common.subjectType.TERSANGKA'))).toBeTruthy();
    expect(screen.getByTestId('session-new-subject-SAKSI').props.accessibilityHint).toBe('Witness');
    expect(within(screen.getByTestId('session-new-investigator')).getByText('AKP Budi Santoso')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-room')).getByText('Interview Room 1')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-profile')).getByText('Standard (1080p / 25 fps)')).toBeTruthy();
    expect(disabled('session-new-next')).toBe(true);
  });

  it('validates with the shared schema: a wrong case format shows its message; Next stays disabled until valid', async () => {
    await openFlow();
    const caseInput = screen.getByTestId('session-new-case-number');
    fireEvent.changeText(caseInput, 'LP/123/2025');
    fireEvent(caseInput, 'blur');
    await act(async () => {});
    expect(screen.getByText('Use the case format LP/YYYY/MMDD-NNNN.')).toBeTruthy();
    expect(disabled('session-new-next')).toBe(true);

    // The simulated scan fills the next synthetic case number (SIM-GAP-1 adapter).
    fireEvent.press(screen.getByTestId('session-new-scan'));
    await act(async () => {});
    expect(screen.getByTestId('session-new-case-number').props.value).toBe('LP/2026/1001-0008');
    expect(screen.queryByText('Use the case format LP/YYYY/MMDD-NNNN.')).toBeNull();
    expect(disabled('session-new-next')).toBe(true); // subject type and name still missing

    fireEvent.press(screen.getByTestId('session-new-subject-TERSANGKA'));
    fireEvent.changeText(screen.getByTestId('session-new-subject-name'), '  Ahmad   Fauzi ');
    await act(async () => {});
    expect(disabled('session-new-next')).toBe(false);
  });

  it('the investigator Select (bottom sheet with search on phones) picks another investigator for the session', async () => {
    const h = await openFlow();
    fireEvent.press(screen.getByTestId('session-new-investigator'));
    // Mount on demand (F-79-2): the sheet content reports its layout, then the sheet opens a frame later.
    fireEvent(screen.getByTestId('sheet-content-signal'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    fireEvent.changeText(screen.getByTestId('session-new-investigator-search'), 'andi');
    expect(screen.queryByTestId('session-new-investigator-OPR-001')).toBeNull();
    fireEvent.press(screen.getByTestId('session-new-investigator-OPR-002'));
    await act(async () => {});
    expect(within(screen.getByTestId('session-new-investigator')).getByText('AKP Andi Pratama')).toBeTruthy();
    await fillStep1();
    await pressNextAsync();
    expect(h.state().session!.input.investigatorId).toBe('OPR-002');
  });

  it('long-pressing a subject type shows its English gloss (D28/Q3)', async () => {
    await openFlow();
    fireEvent(screen.getByTestId('session-new-subject-TERSANGKA'), 'longPress');
    expect(screen.getByTestId('session-new-subject-gloss').props.children).toBe(
      `${i18n.t('common.subjectType.TERSANGKA')} means ${i18n.t('common.subjectTypeGloss.TERSANGKA')}`,
    );
  });

  it('Next creates the session (normalised input) and starts the checks: CREATE → PRECHECK, step 2', async () => {
    const h = await openFlow();
    await fillStep1('  Ahmad   Fauzi ');
    expect(screen.getByTestId('session-new-case-number').props.value).toBe('LP/2026/1001-0008');
    expect(disabled('session-new-next')).toBe(false);
    await pressNextAsync();
    const session = h.state().session!;
    expect(session.state).toBe('PRECHECK');
    expect(session.input).toMatchObject({
      caseNumber: 'LP/2026/1001-0008',
      subjectType: 'TERSANGKA',
      subjectName: 'Ahmad Fauzi',
      investigatorId: OPERATORS[0]!.id,
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    expect(auditTypes(h.state())).toContain('SESSION_CREATED');
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
    expect(h.app.getSearchParams().step).toBe('2');
  });

  it('R2 (E-fix FX-M2, E2E-P-5): a TECHNICIAN is not shown the wizard: the route goes Home and nothing is created', async () => {
    // Before ruling R2 (decision D201) the wizard opened and only Next was refused (the next test).
    const h = await openFlow({ operator: 2 });
    await settle();
    expect(h.app.getPathname()).toBe('/home');
    expect(screen.getByTestId('screen-home')).toBeTruthy();
    expect(screen.queryByTestId('session-new-step-1')).toBeNull();
    expect(h.state().session).toBeNull();
  });

  it('a role without SESSION_START at Next (the signed-in operator changed while the wizard was open): the create error is shown and nothing is created', async () => {
    const h = await openFlow();
    await fillStep1();
    act(() => {
      h.sim.actions.signOut();
      expect(h.sim.actions.signIn(OPERATORS[2]!.username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    });
    await settle();
    // The entry was allowed, so the screen keeps its own rule for a loss (no second navigation).
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
    await pressNextAsync();
    expect(h.state().session).toBeNull();
    expect(screen.getByTestId('session-new-create-error')).toBeTruthy();
    expect(screen.getByText('Your role cannot start sessions. Ask an investigator or a supervisor.')).toBeTruthy();
  });

  it('a deep link that opens Start Session first with a stale ?step=3 shows step 1 and corrects the param', async () => {
    const h = renderSessionNewApp({ initialUrl: '/session/new?step=3' });
    await settle();
    await act(async () => {});
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
    expect(h.app.getSearchParams().step).toBe('1');
  });

  it('resumes a CREATE session left by a relaunch with its details prefilled', async () => {
    const operator = OPERATORS[0]!;
    await openFlow({
      setup: (test: TestSim) => {
        const result = test.sim.actions.createSession({
          caseNumber: 'LP/2026/1001-0008',
          subjectType: 'LAINNYA',
          subjectName: 'Dewi Lestari',
          investigatorId: operator.id,
          room: 'Interview Room 1',
          profileId: 'STANDARD_1080P25',
        });
        if (!result.ok) throw new Error(result.reason);
      },
    });
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
    expect(screen.getByTestId('session-new-case-number').props.value).toBe('LP/2026/1001-0008');
    expect(screen.getByTestId('session-new-subject-name').props.value).toBe('Dewi Lestari');
  });
});

describe('step 3 and the hand-off to the live monitor (MA-29 steps 1–3)', () => {
  it('Ready shows the ARMED summary; Start Recording (no countdown) lands on /session/live with the session RECORDING', async () => {
    resetMissingKeys();
    const h = await openFlow();
    await goToReady(h);
    expect(h.state().session!.state).toBe('ARMED');
    expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-ready')).getByText('LP/2026/1001-0008')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-ready')).getByText('Ahmad Fauzi')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-ready')).getByText('AKP Budi Santoso')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-ready')).getByText('All devices ready')).toBeTruthy();

    // Countdown off, then Start.
    fireEvent.press(screen.getByTestId('session-new-countdown'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('session-new-start'));
    });
    await act(async () => {});
    expect(h.app.getPathname()).toBe('/session/live');
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    expect(h.state().session!.state).toBe('RECORDING');
    expect(auditTypes(h.state())).toEqual(expect.arrayContaining(['SESSION_CREATED', 'PRECHECK_PASSED', 'RECORDING_STARTED']));
    // Neither route re-routed: no "A session is already active" toast from the wizard route.
    expect(screen.queryByText('A session is already active')).toBeNull();
    // MA-21 for the three steps: every key resolved.
    expect(getMissingKeys()).toEqual([]);
    // Replace, not push: Back from the monitor cannot return to ARMED.
    expect(router.canGoBack()).toBe(true); // Home is underneath
    act(() => router.back());
    expect(h.app.getPathname()).toBe('/home');
  });

  it('with the 3-2-1 countdown on, recording starts after three one-second digits; Cancel stops it', async () => {
    jest.useFakeTimers();
    try {
      const h = await openFlow();
      await goToReady(h);
      fireEvent.press(screen.getByTestId('session-new-start'));
      expect(screen.getByTestId('session-new-countdown-digit').props.children).toBe(3);
      fireEvent.press(screen.getByTestId('session-new-countdown-cancel'));
      expect(screen.queryByTestId('session-new-countdown-overlay')).toBeNull();
      expect(h.state().session!.state).toBe('ARMED');

      fireEvent.press(screen.getByTestId('session-new-start'));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('session-new-countdown-digit').props.children).toBe(2);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('session-new-countdown-digit').props.children).toBe(1);
      expect(h.state().session!.state).toBe('ARMED');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(h.state().session!.state).toBe('RECORDING');
      expect(h.app.getPathname()).toBe('/session/live');
      expect(screen.queryByText('A session is already active')).toBeNull();
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
    }
  });

  it('control: opening Start Session while RECORDING is refused by the route with its toast (the hand-off above had none)', async () => {
    const h = renderSessionNewApp({ setup: (test) => test.sim.actions.loadScenario(ScenarioName.RECORDING) });
    await settle();
    h.openFlow();
    await act(async () => {});
    expect(h.app.getPathname()).toBe('/session/live');
    expect(screen.getAllByText('A session is already active').length).toBeGreaterThan(0);
  });
});

describe('leaving the flow (§3.6)', () => {
  type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

  it('Back during the checks asks "Cancel this session?"; Cancel session cancels it and returns Home', async () => {
    const h = await openFlow();
    await fillStep1();
    await pressNextAsync();
    expect(h.state().session!.state).toBe('PRECHECK');
    act(() => router.back());
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
    expect(h.app.getPathname()).toBe('/session/new');
    fireEvent.press(screen.getByTestId('back-guard-stay'));
    expect(h.state().session!.state).toBe('PRECHECK');

    act(() => router.back());
    await act(async () => {
      fireEvent.press(screen.getByTestId('back-guard-leave'));
    });
    await act(async () => {});
    expect(h.state().session).toBeNull();
    expect(auditTypes(h.state())).toContain('SESSION_CANCELLED');
    expect(h.app.getPathname()).toBe('/home');
  });

  it('step 1 with typed details asks "Discard this session?" before leaving; nothing was created', async () => {
    const h = await openFlow();
    fireEvent.changeText(screen.getByTestId('session-new-subject-name'), 'Ahmad Fauzi');
    await act(async () => {});
    fireEvent.press(screen.getByTestId('session-new-back'));
    expect(screen.getByText('Discard this session?')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('session-new-discard-confirm'));
    });
    await act(async () => {});
    expect(h.app.getPathname()).toBe('/home');
    expect(h.state().session).toBeNull();
  });

  it('when Start Session is the only screen, hardware Back asks first instead of closing the app', async () => {
    const listeners: BackListener[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler);
      return { remove: () => void listeners.splice(listeners.indexOf(handler), 1) };
    });
    const operator = OPERATORS[0]!;
    const h = renderSessionNewApp({
      initialUrl: '/session/new?step=2',
      setup: (test: TestSim) => {
        const result = test.sim.actions.createSession({
          caseNumber: 'LP/2026/1001-0008',
          subjectType: 'SAKSI',
          subjectName: 'Rahmat Hidayat',
          investigatorId: operator.id,
          room: 'Interview Room 1',
          profileId: 'STANDARD_1080P25',
        });
        if (!result.ok) throw new Error(result.reason);
        test.sim.actions.beginPrecheck();
      },
    });
    await settle();
    expect(router.canGoBack()).toBe(false);
    let consumed = false;
    act(() => {
      for (const listener of [...listeners].reverse()) {
        if (listener({} as Parameters<BackListener>[0])) {
          consumed = true;
          break;
        }
      }
    });
    expect(consumed).toBe(true);
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
    expect(h.state().session!.state).toBe('PRECHECK');
  });
});

describe('tablet layouts (§2.4)', () => {
  // Re-pinned by row 184 (M3-04 R6, I63 §4.3), citing D53: the column draws every check of PRECHECK_ORDER (12), was a literal eight.
  it('tablet landscape: vertical stepper | step content | live device column with every live check of PRECHECK_ORDER (twelve since D53)', async () => {
    await openFlow({ window: 'tabletLandscape' });
    expect(screen.getByTestId('pane-stepper')).toBeTruthy();
    expect(screen.getByTestId('pane-content')).toBeTruthy();
    expect(screen.getByTestId('pane-devices')).toBeTruthy();
    expect(screen.getByTestId('session-new-column-previews')).toBeTruthy();
    expect(PRECHECK_ORDER).toHaveLength(12); // D53
    for (const id of PRECHECK_ORDER) {
      expect(screen.getByTestId(`session-new-live-${id}`)).toBeTruthy();
    }
  });

  it('tablet portrait: vertical stepper | step content, no device column; step 2 previews sit in the content', async () => {
    const h = await openFlow({ window: 'tabletPortrait' });
    expect(screen.getByTestId('pane-stepper')).toBeTruthy();
    expect(screen.getByTestId('pane-content')).toBeTruthy();
    expect(screen.queryByTestId('pane-devices')).toBeNull();
    await fillStep1();
    await pressNextAsync();
    h.tick(200);
    expect(screen.getByTestId('session-new-previews')).toBeTruthy();
  });
});

// Fix wave J round two (JT-22, JA2-22 / JT-13, JA2-09).
describe('round two: New Session says what is true at each step', () => {
  it('JT-22: the countdown caption follows the switch; JA2-22: at Ready only "Devices Check" is a button, "Session Info" is text', async () => {
    const h = await openFlow();
    await goToReady(h);
    expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
    expect(screen.getByText('Recording starts after a 3-2-1 countdown.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('session-new-countdown'));
    expect(screen.queryByText('Recording starts after a 3-2-1 countdown.')).toBeNull();
    expect(screen.getByText('Recording starts at once, without a countdown.')).toBeTruthy();

    const info = screen.getByTestId('session-new-stepper-step-0');
    const checks = screen.getByTestId('session-new-stepper-step-1');
    expect(info.props.accessibilityRole).toBe('text');
    expect(checks.props.accessibilityRole).toBe('button');
    fireEvent.press(checks);
    expect(screen.getByTestId('session-new-step-2')).toBeTruthy();
  });

  // Fix wave Q (CT-08): the tablet said "Recording Profile: Standard (1080p / 25 fps)" on New Session and Ready of a
  // Core whose selector records H264_720P30 - one press from the sealed item that states 720p30.
  it('CT-08: on a Core in its own capture step 1 and Ready state the selector\'s lines in force, never the profileId label; CONTROL: a simulated Core keeps its label', async () => {
    const h = await openFlow();
    // CONTROL (the simulated lane, pinned): the form's own choice.
    expect(screen.getByTestId('session-new-profile')).toBeTruthy();
    expect(screen.queryByTestId('session-new-profile-configured')).toBeNull();
    expect(screen.getAllByText('Standard (1080p / 25 fps)').length).toBeGreaterThan(0);

    // The Core states its own capture (the host clock is its time source), and its selector lines name 720p30.
    act(() => {
      h.sim.store.setState((state) => ({
        time: { ...state.time, hostClock: true },
        captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => ({ ...line, profile: 'H264_720P30' })) },
      }));
    });
    expect(screen.queryByTestId('session-new-profile')).toBeNull();
    expect(screen.getByTestId('session-new-profile-lines')).toHaveTextContent('VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30 · VIDEO-03: H264_720P30 · VIDEO-04: H264_720P30'); // D60 (2026-11-04): four video tracks in force
    expect(screen.queryByText('Standard (1080p / 25 fps)')).toBeNull();
    expect(screen.queryByText(/1080p/)).toBeNull();

    await goToReady(h);
    expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
    expect(within(screen.getByTestId('session-new-summary-profile')).getByText('VIDEO-01: H264_720P30 · VIDEO-02: H264_720P30 · VIDEO-03: H264_720P30 · VIDEO-04: H264_720P30')).toBeTruthy(); // D60 (2026-11-04): four tracks in the summary too
    expect(screen.queryByText(/1080p/)).toBeNull();

    // A selector that states no profile: "Not reported", never a model figure.
    act(() => {
      h.sim.store.setState((state) => ({
        captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map(({ profile: _profile, ...line }) => line) as typeof state.captureConfig.cameras },
        ...(state.session ? { session: { ...state.session, captureConfig: null } as typeof state.session } : {}),
      }));
    });
    expect(within(screen.getByTestId('session-new-summary-profile')).getByText('Not reported')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });

  it('JA2-09: a long subject name is drawn whole on Ready (two lines), never cut to one', async () => {
    const h = await openFlow();
    const name = 'Judge A2 Wijayakusuma Hadiningrat';
    await fillStep1(name);
    await pressNextAsync();
    h.tick(PRECHECK_TOTAL_MAX_MS);
    fireEvent.press(next());
    const shown = within(screen.getByTestId('session-new-summary-subject')).getByText(name);
    expect(shown.props.numberOfLines).toBe(2);
  });
});
