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
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSim, type SimState } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { CameraFeed, type CameraFeedProps } from '@/components/media';
import { captureNoticesOf, developmentSourceOf } from '@/features/capture-selector/capture-notices-model';
import { useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { rosterDeviceName, rosterDeviceState, sourceChecked, sourceOnKeyOf, sourceStateLabelKey } from './registered-devices-model';

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

export type PreviewTrackId = 'VIDEO-01' | 'VIDEO-02';

/** `CAM-2`, `VIDEO-02`, `CAM-02` → the second video track; anything else the first (the rule of `cameraFraming`). */
export function previewTrackOf(cameraId: string): PreviewTrackId {
  return /2\s*$/.test(cameraId) ? 'VIDEO-02' : 'VIDEO-01';
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
}

export function noPreviewFactsOf(state: PreviewState, trackId: PreviewTrackId): NoPreviewFacts {
  const selector = selectorInForce(state);
  const deviceId = selector.cameras.find((line) => line.trackId === trackId)?.deviceId ?? null;
  const device = deviceId === null ? undefined : state.captureDevices.devices.find((candidate) => candidate.id === deviceId);
  if (device === undefined) return { deviceId: null, sourceClass: null, adapter: null, online: false, sourceOpen: false, checked: false, cause: null };
  const notice = captureNoticesOf(state.alerts).find((entry) => entry.kind === 'unreachable' && entry.deviceId === device.id);
  return {
    deviceId: device.id,
    sourceClass: device.sourceClass ?? null,
    adapter: device.adapter ?? null,
    online: device.online,
    sourceOpen: device.sourceOpen === true,
    // The tile is of a camera ON a line: while a session records, the recording's telemetry is the checked fact.
    checked: sourceChecked({ checkedAt: (device as { readonly checkedAt?: unknown }).checkedAt, sourceOpen: device.sourceOpen, recording: state.session?.state === 'RECORDING' }),
    cause: notice !== undefined && notice.kind === 'unreachable' ? notice.cause : null,
  };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The device's name and state as the tile words them (the roster's own rules). */
export function noPreviewWords(t: Translate, facts: NoPreviewFacts, live: boolean): { device: string | null; state: string } {
  if (facts.deviceId === null) return { device: null, state: t('features.capture-selector.preview.stateUnknown') };
  const source = developmentSourceOf({ sourceClass: facts.sourceClass ?? undefined, adapter: facts.adapter ?? undefined, deviceKind: 'CAMERA', live });
  const device = rosterDeviceName(t, { id: facts.deviceId, kind: 'CAMERA', sourceClass: facts.sourceClass, adapter: facts.adapter }, live);
  const onKey = sourceOnKeyOf({ sourceClass: facts.sourceClass, adapter: facts.adapter, deviceKind: 'CAMERA', sourceOpen: facts.sourceOpen }, live);
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
  const words = connecting && facts.deviceId !== null && facts.cause === null && !facts.sourceOpen ? { device: stated.device, state: t('common.session.connectingCameras') } : stated;
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
}

/**
 * `CameraFeed` with the rule in front of it: the demo picture for a simulated Core, the "No preview"
 * tile for a Core in real capture. The props, the `testID` and the `style` are the feed's.
 */
export function CameraPreview({ trackId, name, compact = false, ...feed }: CameraPreviewProps) {
  const real = useRealCaptureView();
  if (!real) return <CameraFeed {...feed} />;
  return (
    <NoPreviewTile
      trackId={trackId ?? previewTrackOf(feed.cameraId)}
      style={[styles.feedShape, feed.style]}
      compact={compact}
      {...(name === undefined ? {} : { name })}
      {...(feed.testID === undefined ? {} : { testID: feed.testID })}
    />
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
  none: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground, textAlign: 'center' },
  name: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray, textAlign: 'center' },
  state: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray, textAlign: 'center' },
  thumbWrap: { width: 68, height: 48 },
  thumb: { width: 68, height: 48, borderRadius: radius.px.lg, backgroundColor: derived.surfaceSecondary },
  thumbDim: { opacity: 0.4 },
  thumbFill: { width: '100%', height: '100%' },
  thumbNone: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.px.lg, borderWidth: 1, borderColor: derived.surfaceTertiary, backgroundColor: derived.surfaceSecondary },
});
