// T-M14 (04_mobile_specs §10.1; MA-20): the §7.6 haptics map and the 400 ms coalescing.
// expo-haptics is the jest.setup.ts mock (jest.fn per call, real enums).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import {
  HAPTIC_EVENTS,
  HAPTIC_MIN_GAP_MS,
  createHapticsService,
  haptics,
  triggerHaptic,
  useHaptics,
  type HapticEvent,
  type HapticKind,
} from './haptics';
import { setMotionLogSink, type MotionLogRecord } from './log';
import { motionStore, resetMotionStateForTests } from './policy';

type ExpoCall = ['selectionAsync'] | ['impactAsync', Haptics.ImpactFeedbackStyle] | ['notificationAsync', Haptics.NotificationFeedbackType];

// The §7.6 table, written out independently of HAPTIC_EVENTS (row → events → expected call).
const SPEC_7_6: readonly (readonly [HapticEvent, ExpoCall])[] = [
  // Tab, rail, filter chip, segmented or stepper selection; Switch toggle → selectionAsync()
  ['tabSelect', ['selectionAsync']],
  ['railSelect', ['selectionAsync']],
  ['filterChipSelect', ['selectionAsync']],
  ['segmentSelect', ['selectionAsync']],
  ['stepperSelect', ['selectionAsync']],
  ['switchToggle', ['selectionAsync']],
  // Primary button press (Sign In, Next, Save) → impactAsync(Light)
  ['primaryPress', ['impactAsync', Haptics.ImpactFeedbackStyle.Light]],
  // Start Recording → impactAsync(Medium)
  ['recordStart', ['impactAsync', Haptics.ImpactFeedbackStyle.Medium]],
  // End Session hold completes → impactAsync(Heavy)
  ['endSessionHold', ['impactAsync', Haptics.ImpactFeedbackStyle.Heavy]],
  // Sign-in success, pairing success, Verify PASS, SEALED stamp → notificationAsync(Success)
  ['signInSuccess', ['notificationAsync', Haptics.NotificationFeedbackType.Success]],
  ['pairingSuccess', ['notificationAsync', Haptics.NotificationFeedbackType.Success]],
  ['verifyPass', ['notificationAsync', Haptics.NotificationFeedbackType.Success]],
  ['sealedStamp', ['notificationAsync', Haptics.NotificationFeedbackType.Success]],
  // Gate WARN, MIC clip latch, Storage LOW, Core link lost → notificationAsync(Warning)
  ['gateWarn', ['notificationAsync', Haptics.NotificationFeedbackType.Warning]],
  ['micClip', ['notificationAsync', Haptics.NotificationFeedbackType.Warning]],
  ['storageLow', ['notificationAsync', Haptics.NotificationFeedbackType.Warning]],
  ['coreLinkLost', ['notificationAsync', Haptics.NotificationFeedbackType.Warning]],
  // Sign-in failure, lockout, gate BLOCK, critical FAULT, Verify FAIL → notificationAsync(Error)
  ['signInFailure', ['notificationAsync', Haptics.NotificationFeedbackType.Error]],
  ['lockout', ['notificationAsync', Haptics.NotificationFeedbackType.Error]],
  ['gateBlock', ['notificationAsync', Haptics.NotificationFeedbackType.Error]],
  ['criticalFault', ['notificationAsync', Haptics.NotificationFeedbackType.Error]],
  ['verifyFail', ['notificationAsync', Haptics.NotificationFeedbackType.Error]],
  // Additions outside the §7.6 table, each with its source:
  // M-C-19 hold to confirm: light at 0 % and 50 %
  ['holdProgress', ['impactAsync', Haptics.ImpactFeedbackStyle.Light]],
  // 01_specs §5.5 row-18 proof screen toast button
  ['stackCheckTap', ['selectionAsync']],
];

const mocked = {
  selectionAsync: jest.mocked(Haptics.selectionAsync),
  impactAsync: jest.mocked(Haptics.impactAsync),
  notificationAsync: jest.mocked(Haptics.notificationAsync),
};

function expoCalls(): ExpoCall[] {
  const calls: { order: number; call: ExpoCall }[] = [];
  mocked.selectionAsync.mock.invocationCallOrder.forEach((order) => calls.push({ order, call: ['selectionAsync'] }));
  mocked.impactAsync.mock.calls.forEach((args, i) =>
    calls.push({
      order: mocked.impactAsync.mock.invocationCallOrder[i] ?? 0,
      call: ['impactAsync', args[0] as Haptics.ImpactFeedbackStyle],
    }),
  );
  mocked.notificationAsync.mock.calls.forEach((args, i) =>
    calls.push({
      order: mocked.notificationAsync.mock.invocationCallOrder[i] ?? 0,
      call: ['notificationAsync', args[0] as Haptics.NotificationFeedbackType],
    }),
  );
  return calls.sort((a, b) => a.order - b.order).map((c) => c.call);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetMotionStateForTests();
  // The shared service keeps its window between tests, while each test's fake clock restarts.
  haptics.reset();
});

afterEach(() => {
  haptics.reset();
  setMotionLogSink(null);
  jest.useRealTimers();
});

describe('T-M14 §7.6 haptics map', () => {
  it('covers exactly the §7.6 events plus the two documented additions', () => {
    expect(Object.keys(HAPTIC_EVENTS).sort()).toEqual(SPEC_7_6.map(([event]) => event).sort());
  });

  it.each(SPEC_7_6)('%s → %j', (event, expected) => {
    const service = createHapticsService();
    expect(service.trigger(event)).toBe('fired');
    expect(expoCalls()).toEqual([expected]);
  });

  it('uses a 400 ms minimum gap (§7.6)', () => {
    expect(HAPTIC_MIN_GAP_MS).toBe(400);
  });
});

describe('T-M14 400 ms coalescing', () => {
  function recordingService() {
    const played: { at: number; kind: HapticKind }[] = [];
    const service = createHapticsService({
      driver: async (kind) => {
        played.push({ at: Date.now(), kind });
      },
      isEnabled: () => true,
    });
    return { service, played };
  }

  it('fires the first event at once and drops same-strength or weaker events inside the window', () => {
    const { service, played } = recordingService();
    const t0 = Date.now();
    const outcomes = [service.trigger('tabSelect')];
    for (let i = 0; i < 4; i += 1) {
      jest.advanceTimersByTime(50);
      outcomes.push(service.trigger('filterChipSelect'));
    }
    jest.advanceTimersByTime(HAPTIC_MIN_GAP_MS);
    expect(outcomes).toEqual(['fired', 'dropped', 'dropped', 'dropped', 'dropped']);
    expect(played).toEqual([{ at: t0, kind: 'selection' }]);
  });

  it('plays a stronger event once, when the window ends', () => {
    const { service, played } = recordingService();
    const t0 = Date.now();
    expect(service.trigger('primaryPress')).toBe('fired');
    jest.advanceTimersByTime(100);
    expect(service.trigger('signInFailure')).toBe('queued');
    jest.advanceTimersByTime(HAPTIC_MIN_GAP_MS - 101);
    expect(played).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(played).toEqual([
      { at: t0, kind: 'light' },
      { at: t0 + HAPTIC_MIN_GAP_MS, kind: 'error' },
    ]);
    // The trailing haptic opened a new window: a weaker event in it is dropped.
    jest.advanceTimersByTime(50);
    expect(service.trigger('micClip')).toBe('dropped');
  });

  it('keeps only the strongest pending event', () => {
    const { service, played } = recordingService();
    service.trigger('tabSelect');
    jest.advanceTimersByTime(50);
    expect(service.trigger('gateWarn')).toBe('queued');
    jest.advanceTimersByTime(50);
    expect(service.trigger('recordStart')).toBe('dropped');
    jest.advanceTimersByTime(50);
    expect(service.trigger('criticalFault')).toBe('queued');
    jest.advanceTimersByTime(HAPTIC_MIN_GAP_MS);
    expect(played.map((p) => p.kind)).toEqual(['selection', 'error']);
  });

  it('never plays more than one haptic per 400 ms under a 20 Hz stream (never tied to 20 Hz data)', () => {
    const { service, played } = recordingService();
    const events: HapticEvent[] = ['micClip', 'tabSelect', 'criticalFault', 'primaryPress'];
    for (let i = 0; i < 40; i += 1) {
      service.trigger(events[i % events.length] as HapticEvent);
      jest.advanceTimersByTime(50);
    }
    jest.advanceTimersByTime(HAPTIC_MIN_GAP_MS);
    expect(played.length).toBeGreaterThan(1);
    expect(played.length).toBeLessThanOrEqual(Math.ceil((40 * 50) / HAPTIC_MIN_GAP_MS) + 1);
    for (let i = 1; i < played.length; i += 1) {
      expect((played[i]?.at ?? 0) - (played[i - 1]?.at ?? 0)).toBeGreaterThanOrEqual(HAPTIC_MIN_GAP_MS);
    }
  });

  it('cancelPending drops a queued haptic', () => {
    const { service, played } = recordingService();
    service.trigger('tabSelect');
    service.trigger('verifyFail');
    service.cancelPending();
    jest.advanceTimersByTime(HAPTIC_MIN_GAP_MS);
    expect(played).toHaveLength(1);
  });
});

describe('T-M14 switch, reduce motion and failures', () => {
  it('plays nothing while the in-app Haptics switch is off, and plays again once it is on', () => {
    motionStore.getState().setHapticsEnabled(false);
    expect(triggerHaptic('tabSelect')).toBe('disabled');
    expect(expoCalls()).toEqual([]);
    motionStore.getState().setHapticsEnabled(true);
    expect(triggerHaptic('tabSelect')).toBe('fired');
    expect(expoCalls()).toEqual([['selectionAsync']]);
  });

  it('drops a pending haptic when the switch turns off before the window ends', () => {
    triggerHaptic('tabSelect');
    expect(triggerHaptic('gateBlock')).toBe('queued');
    motionStore.getState().setHapticsEnabled(false);
    jest.advanceTimersByTime(HAPTIC_MIN_GAP_MS);
    expect(expoCalls()).toEqual([['selectionAsync']]);
  });

  it('is not reduced by reduce motion (a separate preference, §7.6)', () => {
    resetMotionStateForTests({ osReduceMotion: true, reduceMotionOverride: true, linkMotion: 'off' });
    expect(triggerHaptic('verifyPass')).toBe('fired');
    expect(expoCalls()).toEqual([['notificationAsync', Haptics.NotificationFeedbackType.Success]]);
  });

  it('reports a failing haptic and never throws', async () => {
    const records: MotionLogRecord[] = [];
    setMotionLogSink((r) => records.push(r));
    const service = createHapticsService({
      driver: () => Promise.reject(new Error('no vibrator')),
      isEnabled: () => true,
    });
    expect(() => service.trigger('micClip')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(records).toEqual([
      expect.objectContaining({
        level: 'warn',
        source: 'motion.haptics.play',
        message: 'no vibrator',
        context: { kind: 'warning' },
      }),
    ]);
  });

  it('useHaptics returns a stable trigger bound to the app service', () => {
    const { result, rerender } = renderHook(() => useHaptics());
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
    expect(result.current('recordStart')).toBe('fired');
    expect(expoCalls()).toEqual([['impactAsync', Haptics.ImpactFeedbackStyle.Medium]]);
  });
});

describe('MA-20: every haptic goes through the one service', () => {
  // Same check as `grep -rn "Haptics\." apps/mobile/src | grep -v motion/haptics`, kept as a test
  // so a later screen cannot bypass the service unnoticed.
  const SRC = join(__dirname, '..');

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  }

  // Known pre-existing hit, outside step 69's write paths: the row-18 proof screen calls
  // Haptics.selectionAsync() as 01_specs §5.5 specifies. Reported for a controller ruling
  // (route it through triggerHaptic('stackCheckTap')); remove this entry once it does.
  const PENDING_OWNER_CHANGE = new Set([['features', 'home', 'home-screen.tsx'].join(sep)]);

  it('finds no Haptics.* call outside src/motion/haptics', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !relative(SRC, file).startsWith(['motion', 'haptics'].join(sep)))
      .filter((file) => !PENDING_OWNER_CHANGE.has(relative(SRC, file)))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ file: relative(SRC, file), line: i + 1, text: line }))
          .filter((l) => /Haptics\./.test(l.text)),
      );
    expect(offenders).toEqual([]);
  });
});
