/**
 * The reach gate of the tablet's live camera preview (task 2026-11-05 row 194, M3-09 R2; register P17;
 * decisions D19, D24, D97, D98; contract row 125). The tablet twin of the web console's row 130 / 130b gate
 * (`apps/core-web/src/features/devices/camera-live-preview.ts:211-285` and `reach-gated-preview.tsx`).
 *
 * The Core states the outcome of its last reading of a device beside the registry flag `online`
 * (`reach` + `checkedAt` of `captureDevices.devices[]`, register P9/P10). This module is the ONE place the
 * app decides from it whether a camera tile may ask for operation 112 `createCameraPreviewSession` (P1):
 *
 * | Phase (`CameraReachPhase`) | When | Op 112 | Drawn by `ReachGatedCameraPreview` |
 * |---|---|---|---|
 * | `NOT_APPLICABLE` | Simulated client mode, or the track's camera is no PRODUCTION camera (the Core has no preview of anything else: it would answer `409 PREVIEW_NOT_AVAILABLE`), or the selector names no known device | never | the caller's `fallback` |
 * | `OFFLINE` | the track's selector line reads `online: false` | never | the caller's `fallback` (no "Try again": the same gap as the web, row 130 §4) |
 * | `HELD` | the Core states `reach: NOT_REACHABLE` and no retry stands | never | the caller's `fallback` plus `DevicePreviewTryAgain` (P14, P16, P15) |
 * | `OPEN` | `REACHABLE`, never stated (absent / null), or the operator's "Try again" stands | the opened preview may ask | `renderLive()` |
 *
 * "Try again" (`requestCameraPreviewRetry`) asks ONCE: the gate opens for that device until the Core states a
 * reading NEWER than the one the press saw (`checkedAt` other than it). A newer NOT_REACHABLE closes it again
 * (the live child unmounts, so it closes its stream); a newer REACHABLE keeps it open by itself.
 *
 * The gate never calls operation 112 itself: the preview the caller renders in `renderLive()` asks for it
 * (row 195), so op 112 is reachable ONLY in the `OPEN` phase. The recording is not touched (M3-09 R6).
 * Nothing here handles the preview URL (a bearer value, M3-09 R5).
 */
import { Button } from 'heroui-native';
import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CaptureDeviceReach, CaptureSourceClass } from '@dems/shared/api';
import { formatClock } from '@dems/shared/realtime';
import { useSim, type SimState } from '@dems/shared/sim';
import type { VideoTrackId } from '@dems/shared/domain';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { cameraLinesInForce } from '@/features/capture-selector/selector-in-force';

/** What the gate reads of a capture device (a subset of `captureDevices.devices[]`). */
export interface CameraReachDevice {
  readonly id: string;
  readonly kind?: string;
  readonly sourceClass?: string | null;
  readonly reach?: CaptureDeviceReach | null;
  readonly checkedAt?: number | null;
}

export const CameraReachPhase = {
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  OFFLINE: 'OFFLINE',
  HELD: 'HELD',
  OPEN: 'OPEN',
} as const;
export type CameraReachPhase = (typeof CameraReachPhase)[keyof typeof CameraReachPhase];

/** The web's `isLivePreviewDevice`: a PRODUCTION camera, the only kind the Core previews. */
export function isReachGatedCamera(device: Pick<CameraReachDevice, 'kind' | 'sourceClass'> | undefined): boolean {
  return device !== undefined && device.sourceClass === CaptureSourceClass.PRODUCTION && (device.kind === undefined || device.kind === 'CAMERA');
}

/** The web's `autoPreviewBlocked`: the Core's last reading found the device unreachable. */
export function cameraHeldByReach(device: Pick<CameraReachDevice, 'reach'> | undefined): boolean {
  return device?.reach === CaptureDeviceReach.NOT_REACHABLE;
}

export interface CameraReachFacts {
  /** Live client mode (a Core server's data). */
  readonly live: boolean;
  /** The track's camera, or undefined when the selector names none or the registry does not hold it. */
  readonly device: CameraReachDevice | undefined;
  /** The track's selector line reads online (the registry flag; never a reachability reading). */
  readonly online: boolean;
  /** The operator's "Try again" stands for this device (`useCameraPreviewRetryStanding`). */
  readonly retryStanding: boolean;
}

/** The phase of the gate; pure (rule P17). */
export function cameraReachPhaseOf({ live, device, online, retryStanding }: CameraReachFacts): CameraReachPhase {
  if (!live || device === undefined || !isReachGatedCamera(device)) return CameraReachPhase.NOT_APPLICABLE;
  if (!online) return CameraReachPhase.OFFLINE;
  if (cameraHeldByReach(device) && !retryStanding) return CameraReachPhase.HELD;
  return CameraReachPhase.OPEN;
}

/** Whether a caller may send operation 112 in this phase: only `OPEN`. */
export function mayRequestCameraPreview(phase: CameraReachPhase): boolean {
  return phase === CameraReachPhase.OPEN;
}

// ── The standing "Try again" (module state, like the web's row 130 store) ────────────────────────────

/** Device id -> the `checkedAt` the operator's press saw (null: none stated). */
const cameraPreviewRetries = new Map<string, number | null>();
const cameraPreviewRetryListeners = new Set<() => void>();
const tellCameraPreviewRetryListeners = () => {
  for (const listener of [...cameraPreviewRetryListeners]) listener();
};

/** The operator asks once more for the preview of `deviceId`, whose last reading `checkedAt` dates. */
export function requestCameraPreviewRetry(deviceId: string, checkedAt: number | null | undefined): void {
  cameraPreviewRetries.set(deviceId, checkedAt ?? null);
  tellCameraPreviewRetryListeners();
}

function endCameraPreviewRetry(deviceId: string): void {
  if (cameraPreviewRetries.delete(deviceId)) tellCameraPreviewRetryListeners();
}

/** Every standing retry ends (test isolation; also for a sign-out, should a caller need it). */
export function resetCameraPreviewRetries(): void {
  if (cameraPreviewRetries.size === 0) return;
  cameraPreviewRetries.clear();
  tellCameraPreviewRetryListeners();
}

function subscribeCameraPreviewRetries(listener: () => void): () => void {
  cameraPreviewRetryListeners.add(listener);
  return () => {
    cameraPreviewRetryListeners.delete(listener);
  };
}

function standingCameraRetryOf(deviceId: string): number | null | undefined {
  return cameraPreviewRetries.has(deviceId) ? (cameraPreviewRetries.get(deviceId) ?? null) : undefined;
}

/**
 * Whether the operator's "Try again" still stands for `deviceId`: pressed, and the Core has stated no reading
 * newer than the one the press saw. A newer reading ends it.
 */
export function useCameraPreviewRetryStanding(deviceId: string, checkedAt: number | null | undefined): boolean {
  const seen = useSyncExternalStore(subscribeCameraPreviewRetries, () => standingCameraRetryOf(deviceId), () => undefined);
  const now = checkedAt ?? null;
  const standing = seen !== undefined && seen === now;
  useEffect(() => {
    if (seen !== undefined && seen !== now) endCameraPreviewRetry(deviceId);
  }, [deviceId, seen, now]);
  return standing;
}

// ── The hook and the components ────────────────────────────────────────────────────────────────

type ReachState = Pick<SimState, 'captureDevices' | 'captureConfig' | 'session'>;

/** The track's camera and line, as one flat string so the selector compares by value (F74-13). */
function trackReachLine(state: ReachState, trackId: VideoTrackId): string {
  const line = cameraLinesInForce(state).find((entry) => entry.trackId === trackId);
  const device = line === undefined ? undefined : state.captureDevices.devices.find((entry) => entry.id === line.deviceId);
  if (line === undefined || device === undefined) return '';
  const facts: CameraReachDevice & { readonly online: boolean } = {
    id: device.id,
    kind: device.kind,
    sourceClass: device.sourceClass ?? null,
    reach: device.reach ?? null,
    checkedAt: device.checkedAt ?? null,
    online: line.online,
  };
  return JSON.stringify(facts);
}

export interface CameraReachGate {
  readonly phase: CameraReachPhase;
  /** The track's camera id, or null. */
  readonly deviceId: string | null;
  /** The Core's last reading of it (epoch ms), or null. */
  readonly checkedAt: number | null;
  /** True only in `OPEN`: the caller may send operation 112. */
  readonly mayRequest: boolean;
  /** The operator's "Try again" (no-op unless `HELD`). */
  readonly tryAgain: () => void;
}

/** The gate of a video track's camera, read from the store (the selector in force, the registry). */
export function useCameraReachGate(trackId: VideoTrackId): CameraReachGate {
  const { live } = useSourceBadgeMode();
  const flat = useSim((state) => trackReachLine(state, trackId));
  const facts = flat === '' ? undefined : (JSON.parse(flat) as CameraReachDevice & { readonly online: boolean });
  const deviceId = facts?.id ?? null;
  const checkedAt = facts?.checkedAt ?? null;
  const retryStanding = useCameraPreviewRetryStanding(deviceId ?? '', checkedAt);
  const phase = cameraReachPhaseOf({ live, device: facts, online: facts?.online === true, retryStanding });
  return {
    phase,
    deviceId,
    checkedAt,
    mayRequest: mayRequestCameraPreview(phase),
    tryAgain: () => {
      if (phase === CameraReachPhase.HELD && deviceId !== null) requestCameraPreviewRetry(deviceId, checkedAt);
    },
  };
}

export interface DevicePreviewTryAgainProps {
  readonly trackId: VideoTrackId;
  /** The tile's camera id for the test id (`device-preview-try-again-<cameraId>`); default: the track id. */
  readonly cameraId?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** P14 (+ P16 when a reading is dated) and the P15 button. Drawn only in the `HELD` phase. */
export function DevicePreviewTryAgain({ trackId, cameraId = trackId, style }: DevicePreviewTryAgainProps) {
  const gate = useCameraReachGate(trackId);
  if (gate.phase !== CameraReachPhase.HELD) return null;
  return <TryAgainBody gate={gate} cameraId={cameraId} style={style} />;
}

function TryAgainBody({ gate, cameraId, style }: { readonly gate: CameraReachGate; readonly cameraId: string; readonly style: StyleProp<ViewStyle> | undefined }) {
  const { t } = useTranslation();
  const testID = `device-preview-try-again-${cameraId}`;
  return (
    <View testID={testID} style={[styles.row, style]}>
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="text" style={styles.text} testID={`${testID}-text`}>
        {t('devices.preview.notReachable')}
        {gate.checkedAt === null ? null : ` ${t('devices.preview.checkedAt', { time: formatClock(gate.checkedAt) })}`}
      </Text>
      <Button variant="outline" size="sm" onPress={gate.tryAgain} testID={`${testID}-press`}>
        <Button.Label>{t('devices.preview.tryAgain')}</Button.Label>
      </Button>
    </View>
  );
}

export interface ReachGatedCameraPreviewProps {
  readonly trackId: VideoTrackId;
  /** The tile's camera id, for the "Try again" test id; default: the track id. */
  readonly cameraId?: string;
  /** The live preview (the ONLY place operation 112 may be sent); mounted in the `OPEN` phase only. */
  readonly renderLive: () => ReactNode;
  /** What stands otherwise: the caller's existing tile (`CameraPreview` / `NoPreviewTile`). */
  readonly fallback: ReactNode;
  readonly tryAgainStyle?: StyleProp<ViewStyle>;
}

/**
 * The web's `ReachGatedCameraPreview` (row 130b) for the tablet: `renderLive()` in `OPEN`, otherwise the
 * caller's `fallback`, with "Try again" under it in `HELD`.
 */
export function ReachGatedCameraPreview({ trackId, cameraId = trackId, renderLive, fallback, tryAgainStyle }: ReachGatedCameraPreviewProps) {
  const gate = useCameraReachGate(trackId);
  if (gate.phase === CameraReachPhase.OPEN) return <>{renderLive()}</>;
  return (
    <>
      {fallback}
      {gate.phase === CameraReachPhase.HELD ? <TryAgainBody gate={gate} cameraId={cameraId} style={tryAgainStyle} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[1], paddingTop: spacing[1] },
  text: { flexShrink: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
});
