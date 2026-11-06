/**
 * Situation C on the tablet and the phone (task 3, blueprint row 139, NEW SCOPE R-10;
 * `masterplan/08_client_ux_spec.md` §8e flow 11; decisions D72(k), D84, D91 ruling R-1 option A).
 *
 * | What | Component | Drawn from |
 * |---|---|---|
 * | One camera of two connected (WARNING): a banner naming the missing camera by label and id | `CaptureStartNotice` | the ACTIVE `SYSTEM` alert `reason: CAPTURE_DEVICE_UNREACHABLE`, `phase: SESSION_START` |
 * | No camera connected (CRITICAL): "No camera connected. Nothing was recorded." | `FailedStartNotice` | the session itself (`FAULT` + `captureDurable: false`) and the `CAPTURE_FAULT` alert's `params.reason` |
 * | A camera recording without the microphone of its pair (WARNING): N3, plus N4 for Pair 1 (audit row 187, M3-06 R2) | `PairedMicMissingNotices` (drawn by `CaptureStartNotice`, so the banner slot of the screen is unchanged) | the ACTIVE `SYSTEM` alert `reason: PAIRED_MIC_MISSING` (row 186 `pairedMicMissingNoticesOf`), one banner per camera, testID `session-live-pair-notice-<VIDEO-0N>` |
 *
 * One alert, drawn everywhere (§8e.1): each is a snapshot of the `alerts` slice. Nothing here raises,
 * counts, stores or hides anything, and nothing has a timer: a banner is gone at the first state
 * update after the Core resolved its alert. Names, never values: a device id and its label only.
 *
 * `FailedStartNotice` draws nothing unless the open session is a failed start, so the screen that
 * shows a faulted session mounts it unconditionally. What it must NOT be given beside it (ux §8e.2):
 * a recording timer, a recording indicator, meters, or wording that suggests evidence exists.
 */
import { Alert, Button } from 'heroui-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSim, type SimState } from '@dems/shared/sim';
import {
  camerasNotConnectedOf,
  type FailedStart,
  failedStartClosingOf,
  failedStartOf,
  failedStartWords,
  noticeTitle,
  type PairedMicMissingNotice,
  pairedMicMissingNoticesOf,
  pairedMicMissingText,
} from '@/features/capture-selector/capture-notices-model';

/** The degraded warning of a session start: the newest camera the Core named, and how many it named. */
export function useCamerasNotConnected() {
  const alerts = useSim((s) => s.alerts);
  return useMemo(() => camerasNotConnectedOf(alerts), [alerts]);
}

/** Flat: the failed start of the open session, or null. */
export const selectFailedStart = (s: SimState): FailedStart | null => failedStartOf(s.session, s.alerts);

/** The failed start of the open session, or null (ux §8e.2 situation C). */
export function useFailedStart(): FailedStart | null {
  return useSim(selectFailedStart);
}

/** Flat: the failed start the Core is closing (RECOVERY, nothing recorded), or null (review R74-12). */
export const selectFailedStartClosing = (s: SimState): FailedStart | null => failedStartClosingOf(s.session, s.alerts);

/** The failed start of the open session while the Core closes it, or null. */
export function useFailedStartClosing(): FailedStart | null {
  return useSim(selectFailedStartClosing);
}

/** "Camera 2 (CAM-02) is not connected" / "The session is recording with one camera fewer." (D60 wording). One banner per missing camera. */
function CamerasNotConnectedNotice() {
  const { t } = useTranslation();
  const missing = useCamerasNotConnected();
  if (missing.length === 0) return null;
  return (
    <View testID="monitor-camera-not-connected" accessibilityLiveRegion="polite">
      {missing.map((notice) => (
        <Alert key={notice.alertId} status="warning" testID={`monitor-camera-not-connected-${notice.deviceId}`}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{noticeTitle(t, notice)}</Alert.Title>
            <Alert.Description>
              {t('common.captureNotice.unreachable.sessionStart.body')}
              {notice.cause === 'NOT_CONNECTED' ? ` ${t('common.captureNotice.cause.NOT_CONNECTED')}` : ''}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ))}
    </View>
  );
}

/** The active PAIRED_MIC_MISSING notices, newest first (audit row 187 reads row 186's model). */
export function usePairedMicMissing(): PairedMicMissingNotice[] {
  const alerts = useSim((s) => s.alerts);
  return useMemo(() => pairedMicMissingNoticesOf(alerts), [alerts]);
}

/**
 * The testID of one pair notice (S62 M3-06): `session-live-pair-notice-VIDEO-0N`. A malformed alert
 * whose track word was dropped (row 186 R186-1) keeps its banner, named by its alert id instead, so the
 * safety message is never hidden for a missing optional word (R187-1).
 */
export const pairNoticeTestId = (notice: Pick<PairedMicMissingNotice, 'trackId' | 'alertId'>): string => `session-live-pair-notice-${notice.trackId ?? notice.alertId}`;

/**
 * Audit row 187 (M3-06 R2; S62 register N1-N4): a camera that records without the microphone of its
 * pair. One WARNING banner per camera, its words the shared sentence N3 with the app's device label, then
 * N4 for Pair 1 (`pairedMicMissingText`, row 186). No title (N3 is the whole message, R186-2) and no
 * action: the recording continues and nothing here can fix the pair. Gone at the first state update after
 * the Core resolves the alert (it does so when the capture ends).
 */
export function PairedMicMissingNotices() {
  const { t } = useTranslation();
  const notices = usePairedMicMissing();
  if (notices.length === 0) return null;
  return (
    <View accessibilityLiveRegion="polite">
      {notices.map((notice) => (
        <Alert key={notice.alertId} status="warning" testID={pairNoticeTestId(notice)}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{pairedMicMissingText(t, notice)}</Alert.Description>
          </Alert.Content>
        </Alert>
      ))}
    </View>
  );
}

/**
 * The notice band of Session Live (the banner slot of `session-live-screen.tsx`): the session-start
 * warning of a camera not connected (row 139), then the pair notices (row 187). Both read the `alerts`
 * slice only; each draws nothing when it has nothing to say.
 */
export function CaptureStartNotice() {
  return (
    <>
      <CamerasNotConnectedNotice />
      <PairedMicMissingNotices />
    </>
  );
}

export interface FailedStartNoticeProps {
  /** The pointer to "Search again": opens Devices. Absent: no pointer is drawn. */
  onOpenDevices?: (() => void) | undefined;
}

/** The fault presentation of a session that recorded nothing. Announced assertively (ux §8e.6). */
export function FailedStartNotice({ onOpenDevices }: FailedStartNoticeProps) {
  const { t } = useTranslation();
  const failed = useFailedStart();
  if (failed === null) return null;
  const words = failedStartWords(t, failed);
  return (
    <View testID="session-failed-start" accessibilityLiveRegion="assertive">
      <Alert status="danger" testID={`session-failed-start-${failed}`}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{words.title}</Alert.Title>
          <Alert.Description>{`${words.body} ${t('common.session.failedStart.next')}`}</Alert.Description>
        </Alert.Content>
        {onOpenDevices !== undefined ? (
          <Button size="sm" variant="secondary" onPress={onOpenDevices} testID="session-failed-start-devices">
            <Button.Label>{t('common.session.failedStart.openDevices')}</Button.Label>
          </Button>
        ) : null}
      </Alert>
    </View>
  );
}
