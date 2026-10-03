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
import type { SessionState } from '@dems/shared/domain';
import {
  cameraTileFor,
  chipRowFor,
  homeStatusFor,
  micTileFor,
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
  return [status.state, ...status.flags.map((f) => [f.severity, f.id, f.message].join(FLAG_SEPARATOR))];
}

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

/** Whole seconds of the current recording (clock-derived, S4), 1 Hz. */
export function useElapsedSeconds(): number {
  return useSim((s) => Math.floor(selectElapsedMs(s) / 1000));
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
  return useMemo(
    () => [
      cameraTileFor(cams),
      micTileFor(
        micStates.map((entry) => ({
          state: entry.replace('+clip', '') as 'READY' | 'NO_SIGNAL' | 'CLIP',
          clipLatched: entry.endsWith('+clip'),
        })),
      ),
      storageTileFor(storage),
    ],
    [cams, micStates, storage],
  );
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
      timeSource: s.time.source as string,
      timeLocked: s.time.locked,
      linkUp: s.network.linkUp,
      usedPercent: storage.usedPercent,
      storageState: storage.state,
    };
  });
  return useMemo(
    () =>
      chipRowFor({
        posture: input.posture,
        timeSource: input.timeSource,
        timeLocked: input.timeLocked,
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
}

/** Tablet: the four device tiles (2 cameras, 2 mics), in dataset order. */
export function useDeviceTiles(): DeviceTileInfo[] {
  const cams = useSim((s) => s.cameras.map((c) => `${c.id}|${c.deviceId}|${c.online ? c.lens : 'OFFLINE'}`));
  const mics = useSim((s) => s.mics.map((m) => `${m.id}|${m.deviceId}|${m.clipLatched ? 'CLIP' : m.state}`));
  return useMemo(() => {
    const parse = (kind: DeviceTileInfo['kind']) => (entry: string) => {
      const [trackId = '', deviceId = '', state = ''] = entry.split('|');
      return { kind, trackId, deviceId, state };
    };
    return [...cams.map(parse('camera')), ...mics.map(parse('mic'))];
  }, [cams, mics]);
}
