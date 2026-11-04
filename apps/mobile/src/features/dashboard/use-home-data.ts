/**
 * Simulator reads for Home (04_mobile_specs §5.1, §5.6; D19). The engine publishes a new state on
 * every 50 ms tick, and `useSim` re-renders only when the selected value changes (shallow), so every
 * selector here returns primitives, or arrays of primitives or of state objects that the engine
 * keeps by reference. The view-model maths live in `home-model.ts`.
 *
 * Every function that calls a hook is named `use…` (D66: the device build runs the React Compiler).
 */
import { audioPairInForce, cameraLinesInForce, micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { useMemo } from 'react';
import {
  CORE_NOT_RUNNING_LABEL,
  isCoreNotRunningKind,
  isHostClockTime,
  isPlatformNotReported,
  isOwnCaptureCoreState,
  sealBlockedNoticeOf,
  sealAttentionOf,
  systemTruthFactsOf,
  SYSTEM_FACT_SEAL_RETRYING,
  openUnsealableNoticesOf,
  meterInputOfChannel,
  selectDeviceStats,
  selectElapsedMs,
  selectPendingSummaryId,
  selectRecentSessions,
  selectSealedToday,
  selectStorage,
  startOfWibDay,
  systemStatus,
  useSim,
  type SimAlert,
  type SimState,
  type SystemFlag,
} from '@dems/shared/sim';
import { useCoreLinkNotice, useRecordingTickerSeconds } from '@/runtime';
import { selectConnectingCameras } from '@/features/session-live/mic-source-model';
import { useRealCaptureView } from '@/features/devices/camera-preview';
import { useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { cameraLineReportOf, micLineDeviceIdOf, micLineReportOf, sourceStateWord, type SourceStateKind } from '@/features/capture-selector/source-state';
import type { SessionState } from '@dems/shared/domain';
import {
  cameraTileFor,
  chipRowFor,
  homeStatusOf,
  offlineTile,
  micTileFor,
  micTileSourceRole,
  realCaptureCameraTileFor,
  realCaptureMicTileFor,
  primaryActionFor,
  recentRowsFor,
  storageTileFor,
  type ChipSpec,
  type HomeCoreFact,
  type HomeFacts,
  type HomeStatus,
  type HomeUnreachableSource,
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

/**
 * The facts beside `systemStatus()` that Home is a function of (fix wave J, JA2-04 / JT-01), as ONE flat
 * string: nothing re-renders per frame (F74-13). Each is the reading the rest of the app already uses -
 * `sealAttentionOf`, `openUnsealableNoticesOf`, the reported state of the selector's lines, the alerts.
 */
function factsLine(s: SimState, realCapture: boolean, live: boolean): string {
  // A session slice without its `finalization` member (an older snapshot) states no seal: read defensively.
  const attention = (s.session as { readonly finalization?: unknown } | null)?.finalization === undefined ? null : sealAttentionOf(s);
  const seal = attention === null ? null : { kind: attention.kind, sessionId: attention.sessionId, sentence: attention.kind === 'BLOCKED' ? attention.message : attention.sentence };
  const notices = openUnsealableNoticesOf(s);
  const recording = s.session?.state === 'RECORDING';
  const unreachable: HomeUnreachableSource[] = [];
  if (realCapture) {
    for (const line of cameraLinesInForce(s)) {
      const report = cameraLineReportOf(s, line.trackId);
      if (sourceStateWord(report, live, recording).kind === 'NOT_REACHABLE') unreachable.push({ kind: 'camera', trackId: line.trackId, deviceId: report.deviceId });
    }
    for (const mic of s.mics) {
      const report = micLineReportOf(s, mic.id);
      if (sourceStateWord(report, live, recording).kind === 'NOT_REACHABLE') unreachable.push({ kind: 'microphone', trackId: mic.id, deviceId: report.deviceId });
    }
  }
  // J-S 13: what the Core states beyond the flags, by the SHARED reader the web's ring and pill use. Home words
  // three of them itself - the seal, an unsealable notice, a source a line above already names - so they are
  // not said twice.
  const statedDevices = new Set(unreachable.map((source) => source.deviceId));
  const OWN = new Set(['SEAL_BLOCKED', 'UNSEALABLE', SYSTEM_FACT_SEAL_RETRYING]);
  const coreFacts: HomeCoreFact[] = systemTruthFactsOf({ alerts: s.alerts, session: null })
    .filter((fact) => !OWN.has(fact.id) && !(fact.target !== null && statedDevices.has(fact.target)))
    .map((fact) => ({ id: fact.id, severity: fact.severity, message: fact.message, blocksRecording: fact.blocksRecording }));
  return JSON.stringify({
    seal,
    openNotices: notices.length,
    unreachable,
    coreFacts,
    connecting: selectConnectingCameras(s),
    sessionState: s.session?.state ?? null,
    platformNotReported: isPlatformNotReported(s.security),
    // J-S 7: a Core in its own capture states a host clock or `platformNotReported`; a simulated Core states neither.
    simulatedCore: live && !realCapture && !isOwnCaptureCoreState(s),
  });
}

/**
 * H2: THE status of Home - `homeStatusOf` of the Core's facts (fix wave J; truth rule 3c). The card, the
 * header chip, the ring, the tiles and the primary action all read this one value.
 */
export function useHomeStatus(): HomeStatus {
  const key = useSim(statusKey);
  const realCapture = useRealCaptureView();
  const { live } = useSourceBadgeMode();
  const facts = useSim((s) => factsLine(s, realCapture, live));
  // The runtime's one link rule (rows M0-M2): offline at the first OFFLINE or STALE, a few seconds after the socket drops.
  const { offline } = useCoreLinkNotice();
  return useMemo(() => {
    const [state, ...flags] = key;
    const rest = JSON.parse(facts) as Omit<HomeFacts, 'system' | 'linkOffline'>;
    return homeStatusOf({
      ...rest,
      linkOffline: offline,
      system: {
        state: state as HomeStatus['kind'],
        flags: flags.map((entry) => {
          const [severity, id, message] = entry.split(FLAG_SEPARATOR);
          return { severity: severity as SystemFlag['severity'], id: id ?? '', message: message ?? '' };
        }),
      },
    });
    // `key` is shallow-stable (useSim + useShallow), so its identity is the memo key.
  }, [key, facts, offline]);
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
    const lines = micLinesInForce(s);
    return s.mics.map((m) => {
      // Task 4 row 171 (site M5): the input of the channel by the lookup of row 164; `null` (no complete pair): the
      // channel names no line, so it is not the primary one and its source reads as unknown (`micLineReportOf`).
      const inputId = meterInputOfChannel(lines, m.id);
      // D61 (2026-11-04): the transcribed channel is MIC-01 (the former PRIMARY role).
      const primary = inputId !== null && lines.find((line) => line.inputId === inputId)?.channel === 'MIC-01';
      return `${sourceStateWord(micLineReportOf(s, m.id), live, s.session?.state === 'RECORDING').kind}|${primary ? 'P' : ''}`;
    });
  });
  // Fix wave L (G70c-02): the Camera tile of a Core in real capture - the cameras ON the lines in force, as reported.
  const cameraLines = useSim((s) => (realCapture ? cameraLinesInForce(s).map((line) => sourceStateWord(cameraLineReportOf(s, line.trackId), live, s.session?.state === 'RECORDING').kind) : ([] as string[])));
  const recording = useSim((s) => s.session?.state === 'RECORDING');
  const { offline } = useCoreLinkNotice();
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
    const camera = realCapture ? realCaptureCameraTileFor(cameraLines.map((state) => ({ state: state as SourceStateKind })), recording) : cameraTileFor(cams);
    const tiles = [camera, microphone, storageTileFor(storage)];
    // Fix wave J (JA2-04): without the Core link the counts are the last known ones - not drawn as present facts.
    return offline ? tiles.map(offlineTile) : tiles;
  }, [cams, micStates, storage, realCapture, micLines, cameraLines, recording, offline]);
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

/** How many alerts the bell lists at most (it scrolls); the newest are kept. */
export const BELL_LIMIT = 20;

/**
 * Bell (fix wave J, JA2-25): every alert that still asks for something, newest first, at most `limit` -
 * the ACTIVE ones, and the ones the Core resolved that nobody acknowledged (they used to leave the device
 * while the Core kept them unacknowledged). `count` is the unacknowledged ones of that list - the badge.
 */
export function useAlertSummary(limit = BELL_LIMIT): { count: number; alerts: SimAlert[]; total: number } {
  const open = useSim((s) => s.alerts.filter((alert) => alert.active || !alert.acknowledged));
  return useMemo(() => {
    const newestFirst = [...open].reverse();
    return { count: open.filter((alert) => !alert.acknowledged).length, alerts: newestFirst.slice(0, limit), total: open.length };
  }, [open, limit]);
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
   * Fix wave L (G70c-02): CAMERA tiles too, while nothing records.
   */
  line: { readonly deviceId: string | null; readonly stateKey: string; readonly tone: string } | null;
}

/** Tablet: the four device tiles (2 cameras, 2 mics), in dataset order. */
export function useDeviceTiles(): DeviceTileInfo[] {
  const realCapture = useRealCaptureView();
  const { live } = useSourceBadgeMode();
  // Fix wave L (G70c-02): a CAMERA tile on a Core in real capture, while nothing records, states what the Core
  // reported for the camera ON its line ("Reachable" / "Not reachable" / "Not checked") - not the track's
  // model word "READY". While a session records the track's own word stands (the capture drives it).
  const cams = useSim((s) => {
    const reported = realCapture && s.session?.state !== 'RECORDING';
    return s.cameras.map((c) => {
      const word = reported ? sourceStateWord(cameraLineReportOf(s, c.id), live) : null;
      const line = word === null ? '' : `${cameraLinesInForce(s).find((entry) => entry.trackId === c.id)?.deviceId ?? ''}~${word.key}~${word.tone}`;
      return `${c.id}|${c.deviceId}|${c.online ? c.lens : 'OFFLINE'}||${line}`;
    });
  });
  // The pair is the one IN FORCE (`audioPairInForce`: the open session's, else the selector's), with the meters' member behind it; primitives only, so
  // the 20 Hz `audio` slice never re-renders the tiles.
  const mics = useSim((s) => {
    const recording = s.session?.state === 'RECORDING';
    // Task 4 row 171 (seam reader 9 of 9 of row 28): the meters' member is read as the slice states it once the seam
    // `AudioSliceInState` is out - `null` when no input is active; compiles with the seam in and out.
    const meters: string | null = s.audio.activeInputId;
    const activeInputId = audioPairInForce(s).activeInputId ?? meters;
    // D61 (2026-11-04): the STANDBY word belongs to the transcription pair alone - channels 3 / 4 record without a pair word.
    const standbyInputId = audioPairInForce(s).standbyInputId;
    const lines = micLinesInForce(s);
    return s.mics.map((m) => {
      // A channel without an input (`null`), or no active input: no role for the tile.
      const role = micTileSourceRole({ recording, inputId: meterInputOfChannel(lines, m.id), activeInputId, standbyInputId });
      const word = realCapture ? sourceStateWord(micLineReportOf(s, m.id), live, recording) : null;
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
