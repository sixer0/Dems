/**
 * Simulator reads for Home (04_mobile_specs §5.1, §5.6; D19). The engine publishes a new state on
 * every 50 ms tick, and `useSim` re-renders only when the selected value changes (shallow), so every
 * selector here returns primitives, or arrays of primitives or of state objects that the engine
 * keeps by reference. The view-model maths live in `home-model.ts`.
 *
 * Every function that calls a hook is named `use…` (D66: the device build runs the React Compiler).
 */
import { useMemo } from 'react';
import {
  CORE_NOT_RUNNING_LABEL,
  captureMicLines,
  isCoreNotRunningKind,
  isHostClockTime,
  isPlatformNotReported,
  sealBlockedNoticeOf,
  micInputOfChannel,
  selectActiveAlerts,
  selectDeviceStats,
  selectElapsedMs,
  selectPendingSummaryId,
  selectRecentSessions,
  selectSealedToday,
  selectStorage,
  selectUnacknowledgedAlertCount,
  startOfWibDay,
  systemStatus,
  useSim,
  type SimAlert,
  type SimState,
  type SystemFlag,
} from '@dems/shared/sim';
import { useRecordingTickerSeconds } from '@/runtime';
import { useRealCaptureView } from '@/features/devices/camera-preview';
import { useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { micLineDeviceIdOf, micLineReportOf, sourceStateWord, type SourceStateKind } from '@/features/capture-selector/source-state';
import type { SessionState } from '@dems/shared/domain';
import {
  cameraTileFor,
  chipRowFor,
  homeStatusFor,
  micTileFor,
  micTileSourceRole,
  realCaptureMicTileFor,
  primaryActionFor,
  recentRowsFor,
  storageTileFor,
  type ChipSpec,
  type HomeStatus,
  type HomeTile,
  type PrimaryAction,
  type RecentRow,
} from './home-model';

const FLAG_SEPARATOR = '\u001f';

/** `systemStatus()` as a flat string list (state, then one entry per flag), shallow-stable. */
function statusKey(s: SimState): string[] {
  const status = systemStatus(s);
  // Closing pass J (item 4): a BLOCKED SEAL is the critical state by the Core's own alert
  // (`sealBlockedNoticeOf`), not by a fault flag - none stands for it.
  const state = sealBlockedNoticeOf(s) !== null ? 'CRITICAL' : status.state;
  // Closing pass J (G75b-03, D217 (5)): the restart fault of a Core in its own capture is worded from its
  // member `coreNotRunning` - "Core was not running", never "Power failure" (an id without a key shows its message).
  const notRunning = isCoreNotRunningKind(s, 'POWER_FAIL');
  return [
    state,
    ...status.flags.map((f) => (f.id === 'POWER_FAIL' && notRunning ? [f.severity, CORE_NOT_RUNNING_FLAG_ID, CORE_NOT_RUNNING_LABEL] : [f.severity, f.id, f.message]).join(FLAG_SEPARATOR)),
  ];
}

/** The id of the Home flag line of the restart fault of a Core in its own capture (no i18n key: its text is the shared label). */
export const CORE_NOT_RUNNING_FLAG_ID = 'CORE_NOT_RUNNING';

/** H2: the system status (ring state, tone, copy, flag lines). */
export function useHomeStatus(): HomeStatus {
  const key = useSim(statusKey);
  return useMemo(() => {
    const [state, ...flags] = key;
    return homeStatusFor({
      state: state as HomeStatus['kind'],
      flags: flags.map((entry) => {
        const [severity, id, message] = entry.split(FLAG_SEPARATOR);
        return { severity: severity as SystemFlag['severity'], id: id ?? '', message: message ?? '' };
      }),
    });
    // `key` is shallow-stable (useSim + useShallow), so its identity is the memo key.
  }, [key]);
}

export interface HomeSession {
  state: SessionState | null;
  sessionId: string | null;
  /** SEALED only: the summary still waits for acknowledgement (SCR-02). */
  summaryPending: boolean;
}

/** The current session as Home needs it (primary action, status card). */
export function useHomeSession(): HomeSession {
  const [state, sessionId, pendingId] = useSim((s) => [s.session?.state ?? null, s.session?.id ?? null, selectPendingSummaryId(s)] as const);
  return useMemo(
    () => ({ state, sessionId, summaryPending: pendingId !== null && pendingId === sessionId }),
    [state, sessionId, pendingId],
  );
}

/** H4: Start Session, or the way back to the active session (§3.7 table). */
export function usePrimaryAction(): PrimaryAction {
  const session = useHomeSession();
  return useMemo(
    () => primaryActionFor(session.state, { sessionId: session.sessionId, summaryAcknowledged: !session.summaryPending }),
    [session],
  );
}

/**
 * Whole seconds of the current recording (clock-derived, S4), 1 Hz. In LIVE the Core clock's ticker when it is
 * ahead of the store (post-review fix FXR-M, W93-1: the same second as the monitor and the Recording bar, which
 * share that ticker; `runtime/recording-elapsed.ts`).
 */
export function useElapsedSeconds(): number {
  const fromStore = useSim((s) => Math.floor(selectElapsedMs(s) / 1000));
  return Math.max(fromStore, useRecordingTickerSeconds());
}

/** H3: Camera, Microphone and Storage tiles. */
export function useHomeTiles(): readonly HomeTile[] {
  const cams = useSim((s) => {
    const stats = selectDeviceStats(s);
    return { camerasOnline: stats.camerasOnline, camerasTotal: stats.camerasTotal };
  });
  const micStates = useSim((s) => s.mics.map((m) => `${m.state}${m.clipLatched ? '+clip' : ''}`));
  const storage = useSim((s) => {
    const summary = selectStorage(s);
    return { usedPercent: summary.usedPercent, state: summary.state };
  });
  // Fix wave I (re-gate 75, the Home microphone item): on a Core in REAL capture the tile states what the Core
  // reported for the microphones ON the lines - the PRIMARY line first - not the track's simulated word alone.
  const realCapture = useRealCaptureView();
  const { live } = useSourceBadgeMode();
  const micLines = useSim((s) => {
    if (!realCapture) return [] as string[];
    const lines = captureMicLines(s);
    return s.mics.map((m) => {
      const inputId = micInputOfChannel(lines, m.id);
      const primary = lines.find((line) => line.inputId === inputId)?.role === 'PRIMARY';
      return `${sourceStateWord(micLineReportOf(s, m.id), live).kind}|${primary ? 'P' : ''}`;
    });
  });
  return useMemo(() => {
    const signal = micTileFor(
      micStates.map((entry) => ({
        state: entry.replace('+clip', '') as 'READY' | 'NO_SIGNAL' | 'CLIP',
        clipLatched: entry.endsWith('+clip'),
      })),
    );
    const microphone = realCapture
      ? realCaptureMicTileFor(
          micLines.map((entry) => {
            const [state = 'UNKNOWN', primary = ''] = entry.split('|');
            return { state: state as SourceStateKind, primary: primary === 'P' };
          }),
          signal,
        )
      : signal;
    return [cameraTileFor(cams), microphone, storageTileFor(storage)];
  }, [cams, micStates, storage, realCapture, micLines]);
}

/** H5: the three most recent sessions ("Today 09:35" is decided per WIB day, not per second). */
export function useRecentRows(count = 3): RecentRow[] {
  const history = useSim((s) => selectRecentSessions(s, count));
  const dayStart = useSim((s) => startOfWibDay(s.clock.now));
  return useMemo(() => recentRowsFor(history, dayStart, count), [history, dayStart, count]);
}

/** Tablet: items sealed today (web Dashboard H; D61: 7 at load). */
export function useSealedToday(): number {
  return useSim(selectSealedToday);
}

/** Bell: the unacknowledged count and the latest active alerts (newest first, at most `limit`). */
export function useAlertSummary(limit = 5): { count: number; alerts: SimAlert[] } {
  const count = useSim(selectUnacknowledgedAlertCount);
  const active = useSim(selectActiveAlerts);
  const alerts = useMemo(() => active.slice(-limit).reverse(), [active, limit]);
  return { count, alerts };
}

/** Tablet: the Security, Time & Network chip row (plus Storage when `withStorage`). */
export function useChipRow(withStorage = false): ChipSpec[] {
  const input = useSim((s) => {
    const storage = selectStorage(s);
    return {
      posture: s.security.posture as string,
      // Closing pass J (D217 (7)): the Core's own statement that it computes no posture, read by name.
      platformNotReported: isPlatformNotReported(s.security),
      timeSource: s.time.source as string,
      timeLocked: s.time.locked,
      // Fix wave I (G75b-06): the Core's own fact "this is the host's system clock".
      hostClock: isHostClockTime(s.time),
      linkUp: s.network.linkUp,
      usedPercent: storage.usedPercent,
      storageState: storage.state,
    };
  });
  return useMemo(
    () =>
      chipRowFor({
        posture: input.posture,
        platformNotReported: input.platformNotReported,
        timeSource: input.timeSource,
        timeLocked: input.timeLocked,
        hostClock: input.hostClock,
        linkUp: input.linkUp,
        ...(withStorage ? { storage: { usedPercent: input.usedPercent, state: input.storageState } } : {}),
      }),
    [input, withStorage],
  );
}

export interface DeviceTileInfo {
  kind: 'camera' | 'mic';
  /** Track id (`VIDEO-01`, `AUDIO-02`). */
  trackId: string;
  deviceId: string;
  /** The simulator's state word (`READY`, `FAULT`, `NO_SIGNAL`, `CLIP`, or `OFFLINE`). */
  state: string;
  /** MIC tiles while a session records: the input is the active one or the hot standby (row 73, MB-01); else null. */
  sourceRole: 'ACTIVE' | 'STANDBY' | null;
  /**
   * Fix wave I - MIC tiles on a Core in REAL capture: the registered microphone ON this tile's line (the
   * selector's, not the track's built-in one) and the word of what the Core reported for it; null elsewhere.
   */
  line: { readonly deviceId: string | null; readonly stateKey: string; readonly tone: string } | null;
}

/** Tablet: the four device tiles (2 cameras, 2 mics), in dataset order. */
export function useDeviceTiles(): DeviceTileInfo[] {
  const realCapture = useRealCaptureView();
  const { live } = useSourceBadgeMode();
  const cams = useSim((s) => s.cameras.map((c) => `${c.id}|${c.deviceId}|${c.online ? c.lens : 'OFFLINE'}`));
  // The pair is the session's (`audioSource`), with the meters' member behind it; primitives only, so
  // the 20 Hz `audio` slice never re-renders the tiles.
  const mics = useSim((s) => {
    const recording = s.session?.state === 'RECORDING';
    const activeInputId = s.session?.audioSource?.activeInputId ?? s.audio.activeInputId;
    const lines = captureMicLines(s);
    return s.mics.map((m) => {
      const role = micTileSourceRole({ recording, inputId: micInputOfChannel(lines, m.id), activeInputId });
      const word = realCapture ? sourceStateWord(micLineReportOf(s, m.id), live) : null;
      const line = word === null ? '' : `${micLineDeviceIdOf(s, m.id) ?? ''}~${word.key}~${word.tone}`;
      return `${m.id}|${m.deviceId}|${m.clipLatched ? 'CLIP' : m.state}|${role ?? ''}|${line}`;
    });
  });
  return useMemo(() => {
    const parse = (kind: DeviceTileInfo['kind']) => (entry: string): DeviceTileInfo => {
      const [trackId = '', deviceId = '', state = '', role = '', line = ''] = entry.split('|');
      const [lineDevice = '', stateKey = '', tone = ''] = line.split('~');
      return {
        kind,
        trackId,
        deviceId,
        state,
        sourceRole: role === 'ACTIVE' || role === 'STANDBY' ? role : null,
        line: line === '' ? null : { deviceId: lineDevice === '' ? null : lineDevice, stateKey, tone },
      };
    };
    return [...cams.map(parse('camera')), ...mics.map(parse('mic'))];
  }, [cams, mics]);
}
