/**
 * The camera picture of a tile, or the neutral "No preview" tile (fix wave H; gate 70 finding G70-03,
 * gate 75 finding G75-13; ruling D196: a real-capture Core shows no stock picture as a preview).
 *
 * The bundled demo media (`@/components/media/demo-media`: the room loops and stills, captioned
 * `CAM-01 | VIDEO-01 | LIVE | DEMO` in the picture itself) are the picture of the SIMULATED Core. On a
 * Core in REAL capture they showed where a camera picture would be - also for the track that names
 * the Core Mac's camera while that camera is off - and an operator could read them as the camera.
 * This build has no live preview of a real camera (OD-12), so there a tile says exactly that.
 *
 * | The client shows | Drawn |
 * |---|---|
 * | the in-app simulator (Simulated client mode), or a Core in SIMULATED capture (Live mode, no device carries a `sourceClass`: D91 R-2) | the demo picture, unchanged (`CameraFeed`, the thumbnails) |
 * | a Core in REAL capture (Live mode and the Core sent a `sourceClass` on a capture device - REAL_PRODUCTION and REAL_DEVELOPMENT alike) | `NoPreviewTile`: "No preview", the device's name and its TRUE state; its accessibility label says the build has no live preview |
 * | a Core whose device list is not there yet (Live mode, the list is empty) | `NoPreviewTile` as well: a demo picture is never shown for a Core the client knows nothing of |
 * | a Core in REAL capture, `livePreview` set (row 195, M3-09; mounted by row 196), the track's camera a PRODUCTION camera the reach gate lets open | `LiveCameraPreview`: op 112, then the camera's MJPEG stream with the operator's bearer; `NoPreviewTile` until the first frame and after any refusal |
 *
 * ONE rule (`realCaptureView`) and ONE tile for every surface: the Devices rows and detail, the Home
 * tiles, the Session New previews and the Session Live feed take `CameraPreview` in place of
 * `CameraFeed` (the same props) or `PreviewThumb` in place of a thumbnail.
 *
 * The state is the Core's own fact of the device behind the track (the open session's selector
 * snapshot, else the current selector): "On" only from `sourceOpen: true` on the Core's local camera
 * (`sourceOnKeyOf`; the badge beside the tile carries the full fixed sentence "Core Mac's camera is
 * on", which is therefore not written a second time), else the roster's words (`rosterDeviceState`: Ready / Reachable / Not reachable
 * / a named cause). Nothing here says LIVE, DEMO or simulated.
 */
import { selectorInForce } from '@/features/capture-selector/selector-in-force';
import { Image } from 'expo-image';
import { ImageOff, Mic } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSim, type SimState } from '@dems/shared/sim';
import { SessionState, type VideoTrackId } from '@dems/shared/domain';
import { useLiveSelector } from '@dems/shared/live';
import { newCorrelationId, reportRuntimeIssue, type MobileLiveSim } from '@/runtime';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { CameraFeed, type CameraFeedProps } from '@/components/media';
import { captureNoticesOf, developmentSourceOf } from '@/features/capture-selector/capture-notices-model';
import { useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { rosterDeviceName, rosterDeviceState, sourceChecked, sourceOnKeyOf, sourceStateLabelKey } from './registered-devices-model';
import { cameraCaptureFaultOf, TRACK_FAULT_KEY, type TrackFault } from './stream-facts';
import { mayRequestCameraPreview, ReachGatedCameraPreview, useCameraReachGate } from './camera-reach-gate';
import { openCameraPreviewSession, previewTransportReady, streamCameraPreview, useCameraStreamClaim, type CameraPreviewRefusal } from './camera-live-stream';

type PreviewDevices = readonly { readonly sourceClass?: string | null | undefined }[];

/**
 * Whether the picture area must NOT show the bundled demo media: the data is a Core server's (Live
 * mode) and that Core is in real capture (it sent a `sourceClass`), or its device list is not there.
 */
export function realCaptureView(devices: PreviewDevices, live: boolean): boolean {
  if (!live) return false;
  return devices.length === 0 || devices.some((device) => device.sourceClass !== undefined && device.sourceClass !== null);
}

/** The rule as a hook; a boolean selector, so nothing re-renders per frame (F74-13). */
export function useRealCaptureView(): boolean {
  const { live } = useSourceBadgeMode();
  return useSim((s) => realCaptureView(s.captureDevices.devices, live));
}

// D60 (2026-11-04): four simultaneous video tracks — the preview speaks the shared track id.
export type PreviewTrackId = VideoTrackId;

/** `CAM-2`, `VIDEO-02`, `CAM-03` → that video track (D60: one of four); anything else the first (the rule of `cameraFraming`). */
export function previewTrackOf(cameraId: string): PreviewTrackId {
  const digit = /([1-4])\s*$/.exec(cameraId)?.[1];
  return digit === undefined ? 'VIDEO-01' : (`VIDEO-0${digit}` as PreviewTrackId);
}

type PreviewState = Pick<SimState, 'captureDevices' | 'captureConfig' | 'alerts' | 'session'>;

/** What the tile says of the camera behind a track: its device, how the Core names it and its true state. */
export interface NoPreviewFacts {
  /** The registered camera behind the track, or null when the selector names none (or the list does not hold it). */
  readonly deviceId: string | null;
  readonly sourceClass: string | null;
  readonly adapter: string | null;
  readonly online: boolean;
  readonly sourceOpen: boolean;
  /** Wave L ruling (G70c-02): the Core holds a checked fact of the camera (`checkedAt` stated, or a session records on its line). */
  readonly checked: boolean;
  /** The named cause of the device's active "not reachable" notice, or null. */
  readonly cause: string | null;
  /**
   * Task 4 row W5 (review 060d Q-01): the ACTIVE capture fault the Core raised about this camera
   * (`cameraCaptureFaultOf`: it stopped delivering inside the session), or null. While it is active the tile
   * says the fault, not the roster's "Reachable"; it goes when the Core resolves it.
   */
  readonly fault: TrackFault | null;
}

export function noPreviewFactsOf(state: PreviewState, trackId: PreviewTrackId): NoPreviewFacts {
  const selector = selectorInForce(state);
  const deviceId = selector.cameras.find((line) => line.trackId === trackId)?.deviceId ?? null;
  const device = deviceId === null ? undefined : state.captureDevices.devices.find((candidate) => candidate.id === deviceId);
  if (device === undefined) return { deviceId: null, sourceClass: null, adapter: null, online: false, sourceOpen: false, checked: false, cause: null, fault: null };
  const notice = captureNoticesOf(state.alerts).find((entry) => entry.kind === 'unreachable' && entry.deviceId === device.id);
  return {
    deviceId: device.id,
    sourceClass: device.sourceClass ?? null,
    adapter: device.adapter ?? null,
    online: device.online,
    sourceOpen: device.sourceOpen === true,
    // The tile is of a camera ON a line: while a session records, the recording's telemetry is the checked fact.
    checked: sourceChecked({ checkedAt: device.checkedAt, sourceOpen: device.sourceOpen, recording: state.session?.state === 'RECORDING' }),
    cause: notice !== undefined && notice.kind === 'unreachable' ? notice.cause : null,
    fault: cameraCaptureFaultOf(state.alerts, device.id),
  };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The device's name and state as the tile words them (the roster's own rules). */
export function noPreviewWords(t: Translate, facts: NoPreviewFacts, live: boolean): { device: string | null; state: string } {
  if (facts.deviceId === null) return { device: null, state: t('features.capture-selector.preview.stateUnknown') };
  const source = developmentSourceOf({ sourceClass: facts.sourceClass ?? undefined, adapter: facts.adapter ?? undefined, deviceKind: 'CAMERA', live });
  const device = rosterDeviceName(t, { id: facts.deviceId, kind: 'CAMERA', sourceClass: facts.sourceClass, adapter: facts.adapter }, live);
  const onKey = sourceOnKeyOf({ sourceClass: facts.sourceClass, adapter: facts.adapter, deviceKind: 'CAMERA', sourceOpen: facts.sourceOpen }, live);
  // Row W5 (Q-01): a camera in an active capture fault says the fault - never "On", "Reachable" or "Ready" beside it.
  if (facts.fault !== null) return { device, state: t(TRACK_FAULT_KEY[facts.fault]) };
  const state = onKey !== null ? t('features.capture-selector.preview.on') : t(sourceStateLabelKey(rosterDeviceState(facts), source === 'localCamera', facts.checked));
  return { device, state };
}

export interface NoPreviewTileProps {
  /** The video track whose camera the tile stands for. */
  trackId: PreviewTrackId;
  /** The surface's own name of the tile ("Camera 1"); the device behind it is named under it. */
  name?: string;
  /** A small box (Home's device tile): "No preview", the device on one line and the state - no icon, no repeated tile name. The accessible name stays whole. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** "No preview", the device's name and its true state. One accessible element; no picture. */
export function NoPreviewTile({ trackId, name, compact = false, style, testID = `no-preview-${trackId}` }: NoPreviewTileProps) {
  const { t } = useTranslation();
  const { live } = useSourceBadgeMode();
  // One flat string, so the result compares by value (F74-13).
  const line = useSim((s) => JSON.stringify(noPreviewFactsOf(s, trackId)));
  const facts = JSON.parse(line) as NoPreviewFacts;
  const stated = noPreviewWords(t, facts, live);
  // Fix wave K (G75c-07): while the session connects its cameras (RECORDING, no durable fragment yet) the tile of
  // a camera with no named cause says "Connecting cameras…" - not the roster's "Not reachable", which nothing
  // has established yet. A named cause (an active notice) and "On" keep their own words.
  const connecting = useSim((s) => s.session?.state === 'RECORDING' && (s.session as { captureDurable?: unknown }).captureDurable === false);
  const words = connecting && facts.deviceId !== null && facts.cause === null && facts.fault === null && !facts.sourceOpen ? { device: stated.device, state: t('common.session.connectingCameras') } : stated;
  const names = [name, words.device].filter((part): part is string => part !== undefined && part !== null && part !== '');
  const title = names.join(' · ');
  return (
    <View
      testID={testID}
      style={[styles.tile, compact ? styles.tileCompact : null, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('features.capture-selector.preview.label', { name: title === '' ? t('features.capture-selector.preview.camera') : title, state: words.state })}
    >
      {/* A crossed-out PICTURE, not a crossed-out camera: the tile says nothing of the camera being off. */}
      {compact ? null : <ImageOff size={22} color={palette.gray} />}
      <Text maxFontSizeMultiplier={1.2} style={styles.none} testID={`${testID}-none`}>
        {t('features.capture-selector.preview.none')}
      </Text>
      {compact && words.device !== null && words.device !== '' ? (
        // Compact (Home's tile): the DEVICE behind the track on one line - the tile's head already says "Camera 1".
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.name} testID={`${testID}-name`}>
          {words.device}
        </Text>
      ) : null}
      {title === '' || compact ? null : (
        <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.name} testID={`${testID}-name`}>
          {title}
        </Text>
      )}
      <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.state} testID={`${testID}-state`}>
        {words.state}
      </Text>
    </View>
  );
}

export interface CameraPreviewProps extends CameraFeedProps {
  /** The video track of the tile; default: read from `cameraId` (`previewTrackOf`). */
  trackId?: PreviewTrackId;
  /** The surface's own name of the tile ("Camera 1"), for the "No preview" tile. */
  name?: string;
  /** See `NoPreviewTileProps.compact`. */
  compact?: boolean;
  /**
   * Row 195 (M3-09 R1): on a Core in real capture, show the camera's LIVE picture where the reach gate of row 194
   * lets it open (`ReachGatedCameraPreview`), with the "No preview" tile standing until the first frame, after a
   * refusal, and in every other gate phase ("Try again" beneath it in `HELD`). Default false: the tile only, as
   * before. Row 196 turns it on at the four mounts.
   */
  livePreview?: boolean;
}

/**
 * `CameraFeed` with the rule in front of it: the demo picture for a simulated Core, the "No preview"
 * tile for a Core in real capture (or, with `livePreview`, the gated live picture). The props, the `testID`
 * and the `style` are the feed's.
 */
export function CameraPreview({ trackId, name, compact = false, livePreview = false, ...feed }: CameraPreviewProps) {
  const real = useRealCaptureView();
  if (!real) return <CameraFeed {...feed} />;
  const track = trackId ?? previewTrackOf(feed.cameraId);
  const tile = (
    <NoPreviewTile
      trackId={track}
      style={[styles.feedShape, feed.style]}
      compact={compact}
      {...(name === undefined ? {} : { name })}
      {...(feed.testID === undefined ? {} : { testID: feed.testID })}
    />
  );
  if (!livePreview) return tile;
  return (
    <ReachGatedCameraPreview
      trackId={track}
      cameraId={feed.cameraId}
      fallback={tile}
      renderLive={() => (
        <LiveCameraPreview
          trackId={track}
          fallback={tile}
          style={[styles.feedShape, feed.style]}
          {...(name === undefined ? {} : { name })}
          {...(feed.testID === undefined ? {} : { testID: `${feed.testID}-live` })}
        />
      )}
    />
  );
}

// ── Row 195 (M3-09 R1, R3-R5): the live picture ──────────────────────────────────────────────────

/** While a session is being started the Core yields the camera to the recording (M3-09 R6): no preview is asked then. */
export function isSessionStarting(state: string | null | undefined): boolean {
  return state === SessionState.CREATE || state === SessionState.PRECHECK || state === SessionState.ARMED;
}

/**
 * The runtime report of a preview that ended without a picture. 409 and 429 are states the tile says, not faults:
 * no record. 401, 403, no operator session and every other failure: one `warn` record with the stage, the status
 * and the Core's code - never the URL, its path or the token (M3-09 R5).
 */
function reportPreviewEnd(stage: 'op112' | 'stream', refusal: CameraPreviewRefusal, status: number | null, code: string, deviceId: string, correlationId: string): void {
  if (refusal === 'NOT_AVAILABLE' || refusal === 'LIMIT') return;
  reportRuntimeIssue('warn', `devices.preview.${stage}`, `createCameraPreviewSession ${stage} -> ${code}`, { deviceId, stage, status, code, refusal }, correlationId);
}

const readLiveSource = (source: MobileLiveSim | null): MobileLiveSim | null => source;

export interface LiveCameraPreviewProps {
  /** The video track whose camera is shown (its device is the reach gate's). */
  readonly trackId: PreviewTrackId;
  /** What stands until the first frame, and after a refusal or the stream's end: the "No preview" tile. */
  readonly fallback: ReactNode;
  /** The surface's name of the camera, for the picture's accessible label. */
  readonly name?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * The live picture of a camera. Mount it ONLY inside `ReachGatedCameraPreview.renderLive` (as `CameraPreview`
 * with `livePreview` does); it checks `mayRequestCameraPreview` again itself right before operation 112.
 *
 * | Step | Rule |
 * |------|------|
 * | Ask | Op 112 once per mount, only while the gate is `OPEN`, no session is being started, an operator session is in memory and this tile holds the camera's one stream (P5) |
 * | Show | The stream with `Authorization: Bearer <session token>` (`streamCameraPreview`); the newest frame through `expo-image`; the fallback until the first frame |
 * | Refused | 409, 429, 401, 403 (op 112 or the stream), an unusable answer, a broken or ended stream: the fallback, and NO retry from here. The next ask is the gate's (a newer Core reading, "Try again") or a new mount |
 * | Close | `abort()` exactly once: on unmount (the gate unmounts this on a newer NOT_REACHABLE), when the operator's session ends, when a session start begins |
 */
export function LiveCameraPreview({ trackId, fallback, name, style, testID = `camera-live-${trackId}` }: LiveCameraPreviewProps) {
  const { t } = useTranslation();
  const gate = useCameraReachGate(trackId);
  // The light Live API's reader (rule 5 of devices-live-static: no `useMobileLive` in this folder): the Live
  // source itself, a stable reference; null in Simulated mode.
  const live = useLiveSelector(readLiveSource);
  const starting = useSim((s) => isSessionStarting(s.session?.state));
  const deviceId = gate.deviceId;
  const held = useCameraStreamClaim(deviceId, gate.mayRequest && !starting && live !== null && deviceId !== null);
  const [frame, setFrame] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const { phase } = gate;

  useEffect(() => {
    if (!held || ended || live === null || deviceId === null || !mayRequestCameraPreview(phase)) return undefined;
    const controller = new AbortController();
    let open = true;
    const close = () => {
      if (!open) return;
      open = false;
      controller.abort();
    };
    const finish = (stage: 'op112' | 'stream', refusal: CameraPreviewRefusal, status: number | null, code: string) => {
      open = false;
      reportPreviewEnd(stage, refusal, status, code, deviceId, correlationId);
      setFrame(null);
      setEnded(true);
    };
    const correlationId = newCorrelationId('preview');
    const stopOnSessionEnd = typeof live.onSessionEnd === 'function' ? live.onSessionEnd(() => {
      close();
      setFrame(null);
      setEnded(true);
    }) : () => undefined;
    void (async () => {
      if (!previewTransportReady(live)) {
        finish('op112', 'NO_TRANSPORT', null, 'NO_TRANSPORT');
        return;
      }
      let session: Awaited<ReturnType<typeof openCameraPreviewSession>>;
      try {
        session = await openCameraPreviewSession(live, deviceId);
      } catch (error) {
        session = { ok: false, refusal: 'FAILED', status: null, code: `OP112_${error instanceof Error ? error.name : 'ERROR'}` };
      }
      if (!open) return;
      if (!session.ok) {
        finish('op112', session.refusal, session.status, session.code);
        return;
      }
      const end = await streamCameraPreview({ live, path: session.path, signal: controller.signal, onFrame: (uri) => open && setFrame(uri) });
      if (end.kind === 'aborted' || !open) return;
      finish('stream', end.refusal, end.status, end.code);
    })();
    return () => {
      stopOnSessionEnd();
      close();
    };
  }, [held, ended, live, deviceId, phase]);

  if (frame === null) return <>{fallback}</>;
  return (
    <View style={[styles.live, style]} testID={testID}>
      <Image
        source={{ uri: frame }}
        style={styles.liveImage}
        contentFit="contain"
        transition={0}
        cachePolicy="none"
        accessibilityLabel={t('devices.cameras.feedAria', { name: name ?? deviceId ?? trackId })}
        testID={`${testID}-picture`}
      />
    </View>
  );
}

export interface PreviewThumbProps {
  /** The bundled still of the simulated Core. */
  source: number;
  /** The accessibility label of the still. */
  label: string;
  /** The device of the row ("Camera 1", "MIC 2"), for the label of the neutral thumb. */
  name: string;
  kind: 'camera' | 'microphone';
  dim: boolean;
  testID?: string;
  /** Wave H closing pass Z2: the thumb fills its parent (the Sessions hub row sizes the wrap itself) in place of the Devices row's fixed 68 x 48. */
  fill?: boolean;
  children?: ReactNode;
}

/** The thumbnail of a Devices row: the still for a simulated Core, a neutral icon tile for a Core in real capture. */
export function PreviewThumb({ source, label, name, kind, dim, testID, fill = false, children }: PreviewThumbProps) {
  const { t } = useTranslation();
  const real = useRealCaptureView();
  if (real) {
    const Icon = kind === 'camera' ? ImageOff : Mic;
    return (
      <View style={[styles.thumbWrap, styles.thumbNone, fill ? styles.thumbFill : null]} testID={testID} accessible accessibilityRole="text" accessibilityLabel={t('features.capture-selector.preview.thumbLabel', { name })}>
        <Icon size={20} color={palette.gray} />
      </View>
    );
  }
  return (
    <View style={[styles.thumbWrap, fill ? styles.thumbFill : null]}>
      <Image source={source} style={[styles.thumb, fill ? styles.thumbFill : null, dim ? styles.thumbDim : null]} contentFit="cover" transition={0} accessibilityLabel={label} {...(testID === undefined ? {} : { testID })} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[0],
    padding: spacing[2],
    borderRadius: radius.px.lg,
    borderWidth: 1,
    borderColor: derived.surfaceTertiary,
    backgroundColor: derived.surfaceSecondary,
  },
  tileCompact: { padding: spacing[1] },
  feedShape: { aspectRatio: 16 / 9, overflow: 'hidden' },
  live: { borderRadius: radius.px.lg, backgroundColor: derived.surfaceSecondary },
  liveImage: { width: '100%', height: '100%' },
  none: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground, textAlign: 'center' },
  name: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray, textAlign: 'center' },
  state: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray, textAlign: 'center' },
  thumbWrap: { width: 68, height: 48 },
  thumb: { width: 68, height: 48, borderRadius: radius.px.lg, backgroundColor: derived.surfaceSecondary },
  thumbDim: { opacity: 0.4 },
  thumbFill: { width: '100%', height: '100%' },
  thumbNone: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.px.lg, borderWidth: 1, borderColor: derived.surfaceTertiary, backgroundColor: derived.surfaceSecondary },
});
