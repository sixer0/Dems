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
 * Every function that calls a hook is named `use*` (D66: the device build runs the React Compiler).
 */
import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';
import {
  SimTransitionError,
  selectCameras,
  selectMics,
  selectTimeline,
  useSim,
  useSimActions,
  type CameraStatus,
  type MicStatus,
  type TimelineEvent,
} from '@dems/shared/sim';
import { reportRuntimeIssue, useConnectionBanner, useCoreLink } from '@/runtime';
import { elapsedSecondsAt, statusStrip, type StripChip } from './session-live.math';

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
    timelineLength: s.session?.timeline.length ?? 0,
  }));
}

/** Whole seconds since the recording started, on the simulator clock; re-renders at 1 Hz. */
export function useMonitorElapsedSeconds(): number {
  return useSim((s) => elapsedSecondsAt(s.session?.startedAt ?? null, s.clock.now));
}

export interface MonitorCameras {
  readonly activeCameraId: VideoTrackId;
  readonly cameras: readonly CameraStatus[];
}

export function useMonitorCameras(): MonitorCameras {
  const activeCameraId = useSim((s) => s.activeCameraId);
  const cameras = useSim(selectCameras);
  return { activeCameraId, cameras };
}

export function useMonitorMics(): readonly MicStatus[] {
  return useSim(selectMics);
}

export function useMonitorTimeline(): readonly TimelineEvent[] {
  return useSim(selectTimeline);
}

/** S2b: VIDEO 1, VIDEO 2, STORAGE, TIME. */
export function useMonitorStrip(): StripChip[] {
  const cameras = useSim(selectCameras);
  const storage = useSim((s) => s.storage.state);
  const timeSource = useSim((s) => s.time.source);
  const timeLocked = useSim((s) => s.time.locked);
  return statusStrip({
    cameras: cameras.map((camera, i) => ({
      index: (i === 0 ? 1 : 2) as 1 | 2,
      online: camera.online,
      recState: camera.recState,
    })),
    storage,
    timeSource,
    timeLocked,
  });
}

/**
 * S7: session actions become read-only while the Core link is OFFLINE (the connection banner shows
 * why). Display-only controls (Audio Monitor, Settings, camera choice) stay available.
 */
export function useMonitorReadOnly(): boolean {
  const banner = useConnectionBanner();
  const link = useCoreLink();
  return banner.kind === 'offline' || link.state === 'OFFLINE';
}

export interface MonitorActions {
  /** M-C-18: `snapshot()`. Returns false (after a toast) when refused. */
  snapshot(): boolean;
  /** M-C-17: `addMarker(label)`; `undefined` numbers it ("Marker n"). */
  addMarker(label: string | undefined): boolean;
  /** S6: `stopRecording(reason)`; route-sync then opens `/session/finalizing`. */
  endSession(reason: string): boolean;
  /** S8: the CLIP latch chip. */
  resetClip(channel: AudioTrackId): boolean;
  /** S3: Cam 1 | Cam 2 (display choice; the recording keeps both tracks). */
  setActiveCamera(cameraId: VideoTrackId): boolean;
}

type ActionName = 'snapshot' | 'addMarker' | 'endSession' | 'resetClip' | 'setActiveCamera';

/** Session actions with the D61 error contract: SimTransitionError → toast; anything else → toast + error log. */
export function useMonitorActions(): MonitorActions {
  const actions = useSimActions();
  const { toast } = useToast();
  const { t } = useTranslation();
  const readOnly = useMonitorReadOnly();

  const run = useCallback(
    (name: ActionName, work: () => void, context: Readonly<Record<string, string | number | boolean>> = {}, guarded = true): boolean => {
      if (guarded && readOnly) {
        toast.show({ variant: 'warning', label: t('features.session-live.errors.readOnly') });
        reportRuntimeIssue('info', `sessionLive.${name}`, 'Refused while the Core link is offline', context);
        return false;
      }
      try {
        work();
        return true;
      } catch (error) {
        if (error instanceof SimTransitionError) {
          toast.show({ variant: 'warning', label: t('features.session-live.errors.notRecording') });
          reportRuntimeIssue('warn', `sessionLive.${name}`, error, context);
        } else {
          toast.show({ variant: 'danger', label: t('features.session-live.errors.actionFailed') });
          reportRuntimeIssue('error', `sessionLive.${name}`, error, context);
        }
        return false;
      }
    },
    [readOnly, toast, t],
  );

  return {
    snapshot: () => run('snapshot', () => actions.snapshot()),
    addMarker: (label) => run('addMarker', () => actions.addMarker(label), { labelled: label !== undefined }),
    endSession: (reason) => run('endSession', () => actions.stopRecording(reason), { reasonLength: reason.length }),
    resetClip: (channel) => run('resetClip', () => actions.resetClip(channel), { channel }, false),
    setActiveCamera: (cameraId) => run('setActiveCamera', () => actions.setActiveCamera(cameraId), { cameraId }, false),
  };
}
