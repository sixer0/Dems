/**
 * Session Monitor data and actions (04_mobile_specs §4.5, §5.6; D61 session-action contract).
 *
 * Selectors return primitives or the store's own slice references, so `useSim`'s shallow compare
 * keeps these hooks quiet while the simulator ticks audio at 20 Hz: the timer hook re-renders its
 * caller once per second, the rest only when their slice changes (04 §7.8 "timers and clocks 1 Hz",
 * "0 React renders per audio frame").
 *
 * Actions go through `useMonitorActions()`: every refusal or failure shows a toast and is written to
 * the persistent runtime log (`dems.mobile.log.v1`, step 73), never swallowed. The stop reason is
 * free text typed by the investigator, so only its length is logged.
 *
 * **Live mode** (backend task, plan row W68; 04_client_integration_spec §8.6 S2-1, §8.7 S4-2). The
 * same hooks read the replica of the Core server (the Live source is the store), and the actions go
 * through `useCoreActions()` + `settle`, so ONE wrapper serves both modes:
 *
 * | Mode | When the handlers run | A refusal |
 * |---|---|---|
 * | SIMULATED, HEARTBEAT | before the call returns (`settle`, CL-25): exactly the step-79 order | the step-79 toasts |
 * | LIVE | when the Core answered and the store holds the effect (CL-16) | the refusal presenter first (denied with the role, offline, limit; mobile rule 2), then the step-79 branch; a stop reason the Core refuses (422 `INVALID_REASON`, F59) is the reason field's error, without a toast |
 *
 * The read-only refusal while the Core link is down stays first ([CS:S2-1]). Whether the screen is
 * read-only is the runtime's one rule, `useCoreLinkReadOnly()` (row M2; shared with Recovery): in LIVE
 * the notice of rows M0 and M1 (read-only from the first OFFLINE or STALE until the first ONLINE, a
 * reconnect attempt keeps it, a cold start flashes nothing); SIMULATED and HEARTBEAT keep step 79's.
 *
 * The meters need no code here: `useAudioSharedValues` (runtime) copies each frame of the store's
 * `audio` slice into Reanimated shared values, and in LIVE the Live source writes that slice from the
 * socket's `meters` frames (CL-11b, §2.3; [CS:S4-9] "no change"). Nothing on this screen polls.
 *
 * Every function that calls a hook is named `use*` (D66: the device build runs the React Compiler).
 */
import { useToast } from 'heroui-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';
import { settle, useCoreActions } from '@dems/shared/live';
import {
  isHostClockTime,
  SimErrorCode,
  SimTransitionError,
  selectCameras,
  selectMics,
  selectTimeline,
  useSim,
  type CameraStatus,
  type MicStatus,
  type SimState,
  type TimelineEvent,
} from '@dems/shared/sim';
import {
  ELAPSED_TICK_MS,
  createElapsedTicker,
  reportRuntimeIssue,
  useCoreErrorPresenter,
  useCoreLink,
  useCoreLinkReadOnly,
  useRecordingElapsedSeconds,
  useRecordingLocalOrigin,
  type ElapsedTicker,
} from '@/runtime';
import { camerasNotConnectedOf } from '@/features/capture-selector/capture-notices-model';
import { selectConnectingCameras } from './mic-source-model';
import { useOwnCapture, ownCaptureOf } from './own-capture';
import { statusStrip, timelineOfCaptureFacts, type StripChip } from './session-live.math';

/** The recording session's identity and counters (primitives only). */
export interface MonitorSession {
  readonly id: string | null;
  readonly state: string | null;
  readonly startedAt: number | null;
  readonly caseNumber: string | null;
  readonly room: string | null;
  readonly markerCount: number;
  readonly snapshotCount: number;
  readonly timelineLength: number;
}

export function useMonitorSession(): MonitorSession {
  return useSim((s) => ({
    id: s.session?.id ?? null,
    state: s.session?.state ?? null,
    startedAt: s.session?.startedAt ?? null,
    caseNumber: s.session?.input.caseNumber ?? null,
    room: s.session?.input.room ?? null,
    markerCount: s.session?.markerCount ?? 0,
    snapshotCount: s.session?.snapshotCount ?? 0,
    // Closing pass J (note 134, open item): the History badge counts the rows the timeline DRAWS - the START row
    // held back while the cameras connect (G75b-08) is not an unseen item, nor is a row the surface never shows.
    timelineLength: s.session ? timelineOfCaptureFacts(s.session.timeline, ownCaptureOf(s.session), selectConnectingCameras(s)).length : 0,
  }));
}

/**
 * Whole seconds since the recording started; re-renders at 1 Hz. The runtime's one rule for the recording
 * time (`useRecordingElapsedSeconds`, `runtime/recording-elapsed.ts`): the store's clock, or in LIVE the Core
 * clock's ticker when it is ahead (CF2-A, RF-PH-1). Post-review fix FXR-M (W93-1) moved it out of this
 * feature so the bottom Recording bar, Home and the Sessions hub draw the same second as the monitor.
 */
export function useMonitorElapsedSeconds(): number {
  return useRecordingElapsedSeconds();
}

/**
 * Decision D247 item 5: the start of the running recording on this device's clock, for the timer's UI-thread
 * clock (`timer-readout.tsx`); `null` when there is none (stopped, or a simulator).
 */
export function useMonitorClockOrigin(drawnSeconds: number): number | null {
  return useRecordingLocalOrigin(drawnSeconds);
}

/** Re-exported for the monitor's tests; the ticker now lives in the runtime (`recording-elapsed.ts`). */
export { ELAPSED_TICK_MS, createElapsedTicker, type ElapsedTicker };

export interface MonitorCameras {
  readonly activeCameraId: VideoTrackId;
  readonly cameras: readonly CameraStatus[];
}

/**
 * Row 139 (ux §8e.2 "C, degraded"): the device ids of the cameras the Core says did not connect at
 * this session start, as one text (a primitive, so the selector is stable). Empty: none.
 */
const selectCamerasNotConnected = (s: SimState): string =>
  camerasNotConnectedOf(s.alerts)
    .map((notice) => notice.deviceId)
    .sort()
    .join(',');

/** The cameras with the ones a session start named as not connected shown offline: their tile reads NO SIGNAL. */
function useCamerasOfSession(): readonly CameraStatus[] {
  const cameras = useSim(selectCameras);
  const missing = useSim(selectCamerasNotConnected);
  return useMemo(() => {
    if (missing === '') return cameras;
    const ids = missing.split(',');
    return cameras.map((camera) => (ids.includes(camera.deviceId) && camera.online ? { ...camera, online: false } : camera));
  }, [cameras, missing]);
}

export function useMonitorCameras(): MonitorCameras {
  const activeCameraId = useSim((s) => s.activeCameraId);
  const cameras = useCamerasOfSession();
  return { activeCameraId, cameras };
}

export function useMonitorMics(): readonly MicStatus[] {
  return useSim(selectMics);
}

export function useMonitorTimeline(): readonly TimelineEvent[] {
  const timeline = useSim(selectTimeline);
  // Fix wave H driver A (G75-01): beside a recording of the Core's own capture no row the simulator's
  // generator invents is drawn ("Evidence Auto-Save", "Integrity check passed", "Device Health Normal").
  const ownCapture = useOwnCapture();
  // Fix wave I (G75b-08): "Recording Started" is drawn only once the Core says it records (the first durable fragment).
  const connecting = useSim(selectConnectingCameras);
  return useMemo(() => timelineOfCaptureFacts(timeline, ownCapture, connecting), [timeline, ownCapture, connecting]);
}

/** S2b: VIDEO 1, VIDEO 2, STORAGE, TIME. */
export function useMonitorStrip(): StripChip[] {
  const cameras = useCamerasOfSession();
  // Row 139 (D84): before the first durable fragment no camera row reads REC.
  const connecting = useSim(selectConnectingCameras);
  const missing = useSim(selectCamerasNotConnected);
  const storage = useSim((s) => s.storage.state);
  const timeSource = useSim((s) => s.time.source);
  const timeLocked = useSim((s) => s.time.locked);
  // Wave H closing pass Z2: the time source as the Core states it (the slice), the host clock included.
  const hostClock = useSim((s) => isHostClockTime(s.time));
  return statusStrip({
    cameras: cameras.map((camera, i) => ({
      index: (i === 0 ? 1 : 2) as 1 | 2,
      online: camera.online,
      recState: camera.recState,
      notConnected: missing !== '' && missing.split(',').includes(camera.deviceId),
    })),
    connecting,
    storage,
    timeSource,
    timeLocked,
    hostClock,
  });
}

/** Why a session command did not go through, for the control that sent it. */
export type MonitorRefusal =
  /** The Core refused the stop reason (422 `INVALID_REASON`; F59: the server is the judge). The reason field says so; no toast. */
  | 'reason'
  /** Refused or failed: a toast has already said why. */
  | 'refused';

/**
 * What the control that sent a session command does with its outcome (S2-1: "each consumer moves
 * what followed the `if` into `ok`"). Exactly one of `ok` and `refused` runs, once, then `done`.
 * In SIMULATED and HEARTBEAT mode they all run before the action call returns.
 */
export interface MonitorHandlers {
  /** The command went through; the store already holds its effect (CL-16). */
  readonly ok?: () => void;
  /** It did not; any toast has been shown. */
  readonly refused?: (why: MonitorRefusal) => void;
  /** Once after either, in every path: release the control (`usePendingPress`). */
  readonly done?: () => void;
}

export interface MonitorActions {
  /** M-C-18: `snapshot()`. */
  snapshot(handlers?: MonitorHandlers): void;
  /** M-C-17: `addMarker(label)`; `undefined` numbers it ("Marker n"). */
  addMarker(label: string | undefined, handlers?: MonitorHandlers): void;
  /** S6: `stopRecording(reason)`; route-sync then opens `/session/finalizing`. */
  endSession(reason: string, handlers?: MonitorHandlers): void;
  /** S8: the CLIP latch chip (its result is ignored, as before). */
  resetClip(channel: AudioTrackId, handlers?: MonitorHandlers): void;
  /** S3: Cam 1 | Cam 2 (display choice; the recording keeps both tracks; its result is ignored, as before). */
  setActiveCamera(cameraId: VideoTrackId, handlers?: MonitorHandlers): void;
}

type ActionName = 'snapshot' | 'addMarker' | 'endSession' | 'resetClip' | 'setActiveCamera';
type LogContext = Readonly<Record<string, string | number | boolean>>;

/**
 * Session actions with the D61 error contract: SimTransitionError → toast; anything else → toast +
 * error log. S2-1 of the backend task: one `settle` per command, in both modes (the table in this
 * file's header).
 */
export function useMonitorActions(): MonitorActions {
  const actions = useCoreActions();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const { toast } = useToast();
  const { t } = useTranslation();
  // S7: session actions are read-only while the Core link is down (the runtime's one rule, row M2;
  // the banner says why). Display-only controls (CLIP reset, camera choice) are not guarded.
  const readOnly = useCoreLinkReadOnly();

  /** Shows and logs why a command failed; tells the control what it may do next. */
  const explain = useCallback(
    (name: ActionName, error: unknown, context: LogContext): MonitorRefusal => {
      // F59: the Core judges the reason (it counts characters; the dialog counts the simulator's code
      // units). Its 422 comes back as the simulator's REASON_TOO_SHORT (CL-20). The dialog's own
      // check is the simulator's rule, so a Simulated stop never gets here.
      if (live && error instanceof SimTransitionError && error.code === SimErrorCode.REASON_TOO_SHORT) {
        reportRuntimeIssue('warn', `sessionLive.${name}`, error, context);
        return 'reason';
      }
      // Live mode: a denial, an outage or a limit is the presenter's (one wording on every screen,
      // mobile rule 2); it is an expected state of the role or the link, so it is logged as a warning.
      if (live && presentCoreError(error)) {
        reportRuntimeIssue('warn', `sessionLive.${name}`, error, context);
        return 'refused';
      }
      if (error instanceof SimTransitionError) {
        toast.show({ variant: 'warning', label: t('features.session-live.errors.notRecording') });
        reportRuntimeIssue('warn', `sessionLive.${name}`, error, context);
      } else {
        toast.show({ variant: 'danger', label: t('features.session-live.errors.actionFailed') });
        reportRuntimeIssue('error', `sessionLive.${name}`, error, context);
      }
      return 'refused';
    },
    [live, presentCoreError, toast, t],
  );

  const run = useCallback(
    (name: ActionName, work: () => unknown, context: LogContext, guarded: boolean, handlers: MonitorHandlers = {}): void => {
      if (guarded && readOnly) {
        toast.show({ variant: 'warning', label: t('features.session-live.errors.readOnly') });
        reportRuntimeIssue('info', `sessionLive.${name}`, 'Refused while the Core link is offline', context);
        try {
          handlers.refused?.('refused');
        } finally {
          handlers.done?.();
        }
        return;
      }
      settle(work, {
        ok: () => handlers.ok?.(),
        fail: (error) => {
          const why = explain(name, error, context);
          handlers.refused?.(why);
        },
        done: () => handlers.done?.(),
      });
    },
    [readOnly, toast, t, explain],
  );

  return {
    snapshot: (handlers) => run('snapshot', () => actions.snapshot(), {}, true, handlers),
    addMarker: (label, handlers) => run('addMarker', () => actions.addMarker(label), { labelled: label !== undefined }, true, handlers),
    endSession: (reason, handlers) => run('endSession', () => actions.stopRecording(reason), { reasonLength: reason.length }, true, handlers),
    resetClip: (channel, handlers) => run('resetClip', () => actions.resetClip(channel), { channel }, false, handlers),
    setActiveCamera: (cameraId, handlers) => run('setActiveCamera', () => actions.setActiveCamera(cameraId), { cameraId }, false, handlers),
  };
}
