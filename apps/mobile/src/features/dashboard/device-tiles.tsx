/**
 * Tablet (expanded) device tiles 2x2 (04_mobile_specs §4.3 "Tablet additions"; §2.4 Home expanded
 * zone 2; web Dashboard E parity): Camera 1 and Camera 2 with a live `CameraFeed` thumbnail (the
 * bundled live loops, D50; at most 2 live canvases), MIC 1 and MIC 2 with a C-2 `compact` meter fed
 * by the transient 20 Hz shared values (§5.4: zero React renders per frame) and a 1 Hz dBFS line.
 * Tap → the device (`/devices/<id>`; master-detail hands it to the Devices pane on tablets).
 *
 * The feeds and meters pause off-focus (§7.8). Under the D43 test switch (`?motion=off`) the feeds
 * show their still poster, the meters stop and their dBFS line holds, so uiautomator can reach idle
 * (MA-12 on this screen);
 * OS reduce-motion keeps them live, like the monitor (S72-2).
 *
 * Task 3 M5 (row 73; ux §3.6 MB-01; B15, E-14). The level line of a MIC tile:
 * - says "No signal" only when the Core says the microphone has no signal (the word of the tile's chip);
 *   a flat frame alone — no meter frame yet, as on an idle Core — reads "— dBFS" (`micReadoutKind`);
 * - under the test switch it still holds its number, but it is read again in the render in which the
 *   input's no-signal flag flips, so a tile mounted before the recording no longer keeps "No signal"
 *   for the whole recording (D249 O-3). The flag is a boolean selector: one render per flip, none per frame;
 *
 * Audit row 209 (M3-17; register A3; D134, D138 R157-1): a MIC tile names its pair - "Mic N (Camera N)"
 * (`home-mic-tile-pair-AUDIO-0N`) - and Pair 1 alone adds the chip "Transcribed"
 * (`home-mic-tile-transcribed-AUDIO-01`), in every state, as the web Dashboard (row W3T). The former
 * "Active" / "Standby" role chip is gone: op 81 is retired (D134).
 */
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { PressableFeedback, Surface } from 'heroui-native';
import { Mic } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AudioTrackId } from '@dems/shared/domain';
import { isLevelNotMeasured, meterInputOfChannel, useSim, useSimInstance } from '@dems/shared/sim';
import { fontFamily, palette, toneHex, typography, type StatusTone } from '@dems/shared/tokens';
import { DbfsMeter } from '@/components/composed/dbfs-meter';
import { StatusChip } from '@/components/kit';
import { MicInputSourceBadge, TrackSourceBadge } from '@/features/capture-selector/development-source-badge';
// Fix wave H (G70-03, G75-13; D196): `CameraPreview` = this feed for a simulated Core, the "No preview" tile for a Core in real capture.
import { CameraPreview } from '@/features/devices/camera-preview';
import { useConnectingCameras } from '@/features/session-live/rec-indicator';
import { DEMO_MEDIA_LIVE } from '@/components/media/demo-media';
import { useMotionPolicy, useMotionSettings, useMotionState } from '@/motion';
import { AUDIO_FLOOR_DBFS, audioAccessibilityValue, useAudioAccessibilityValue, useAudioSharedValues, type AudioAccessibilityValue } from '@/runtime';
import { MIC_NO_LEVEL_TEXT, TRACK_NAME_KEY, micReadoutKind } from './home-model';
import { HOME_BEATS, beatAt, homeEnter } from './home-motion';
import { useDeviceTiles, type DeviceTileInfo } from './use-home-data';

/** Under the D43 test switch the dBFS line refreshes once an hour, i.e. it holds still for the test. */
const TEST_SWITCH_READOUT_MS = 3_600_000;

const STATE_TONE: Record<string, StatusTone> = {
  READY: 'success',
  FAULT: 'danger',
  OFFLINE: 'danger',
  NO_SIGNAL: 'warning',
  CLIP: 'warning',
};

/** `common.enums.*` key of a tile's state word. */
function stateKeyFor(tile: DeviceTileInfo): string {
  if (tile.state === 'OFFLINE') return 'common.status.offline';
  return tile.kind === 'camera' ? `common.enums.lensState.${tile.state}` : `common.enums.micState.${tile.state}`;
}

export interface DeviceTilesProps {
  /**
   * Fix wave J (JA2-04; truth rule 3c): `HomeStatus.live`. False while the Core link is down: a tile then
   * draws no feed, no meter and no state word of the Core - "Not known" - instead of the last known ones.
   */
  live?: boolean;
}

export function DeviceTiles({ live = true }: DeviceTilesProps) {
  const { t } = useTranslation();
  const tiles = useDeviceTiles();
  return (
    <View testID="home-devices" accessibilityLabel={t('dashboard.devices.title')} style={styles.grid}>
      {tiles.map((tile, index) => (
        <View key={tile.trackId} style={styles.cell}>
          <DeviceTile tile={tile} index={index} live={live} />
        </View>
      ))}
    </View>
  );
}

function DeviceTile({ tile, index, live }: { tile: DeviceTileInfo; index: number; live: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useMotionSettings();
  const name = t(TRACK_NAME_KEY[tile.trackId] ?? tile.trackId);
  // Fix wave I (the Home microphone item of re-gate 75; contract note A2 §4): on a Core in REAL capture a MIC
  // tile states what the Core reported for the microphone ON its line - "Reachable", "Not reachable",
  // "Not checked", "On" - and its badge is that microphone's. The simulated track word stays elsewhere.
  // Fix wave L (G70c-02): a CAMERA tile too, while nothing records (`useDeviceTiles` gives it a line only then).
  const line = tile.line;
  const tone = !live ? 'default' : line !== null ? ((line.tone as StatusTone) ?? 'default') : (STATE_TONE[tile.state] ?? 'default');
  const stateWord = !live ? t('features.dashboard.tiles.state.unknown') : line !== null ? t(line.stateKey) : t(stateKeyFor(tile));
  // Fix wave K (G75c-07; ux 8e.2, D84): RECORDING before the first durable fragment - no meter and no level is drawn
  // on a microphone tile: real capture sends no level yet, and a bar would read as a recording. (No role word either:
  // since row 209 no tile draws one; the pair words are a fixed label, not a level.)
  const connecting = useConnectingCameras();

  return (
    <Animated.View entering={homeEnter(beatAt(HOME_BEATS.tiles, HOME_BEATS.tileStagger, index), settings)} style={styles.fill}>
      <PressableFeedback
        testID={`home-device-${tile.trackId}`}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${stateWord}`}
        accessibilityHint={t('features.dashboard.devices.openDevice', { name })}
        onPress={() => router.push(`/devices/${tile.deviceId}` as Href)}
        style={styles.fill}
      >
        <Surface variant="secondary" style={styles.tile}>
          <View style={styles.head}>
            <View style={[styles.dot, { backgroundColor: toneHex[tone] }]} />
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.name}>
              {name}
            </Text>
            <StatusChip tone={tone} label={stateWord} icon={null} size="sm" testID={`home-device-${tile.trackId}-state-chip`} />
          </View>
          {/* Pass D2 (ux §8f.2; row 138's request): the one badge; no node unless the Core sent the development class. */}
          {tile.kind === 'camera' ? (
            <TrackSourceBadge trackId={tile.trackId} testID={`home-device-${tile.trackId}-source`} />
          ) : (
            <MicInputSourceBadge inputId={tile.line?.deviceId ?? tile.deviceId} testID={`home-device-${tile.trackId}-source`} />
          )}
          {tile.pair !== null ? <MicPairWords tile={tile} pair={tile.pair} /> : null}
          {!live ? <TileUnknown tile={tile} name={name} /> : tile.kind === 'camera' ? <FeedThumb tile={tile} name={name} /> : connecting ? <MicConnecting tile={tile} name={name} /> : <MicMeter tile={tile} name={name} />}
        </Surface>
      </PressableFeedback>
    </Animated.View>
  );
}

function FeedThumb({ tile, name }: { tile: DeviceTileInfo; name: string }) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const focused = useIsFocused();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  const cameraIndex = tile.trackId === 'VIDEO-02' ? 2 : 1;
  const poster = DEMO_MEDIA_LIVE.poster[cameraIndex === 2 ? 'VIDEO-02' : 'VIDEO-01'];
  return (
    <CameraPreview
      livePreview
      name={name}
      testID={`home-device-${tile.trackId}-feed`}
      cameraId={`CAM-${cameraIndex}`}
      cameraLabel={`CAM ${cameraIndex}`}
      mode={testSwitch ? 'poster' : 'live'}
      {...(testSwitch ? { image: poster } : {})}
      motion={policy}
      paused={!focused}
      // Round two (JT-12): in this small 16:9 box the "No preview" tile draws three short lines - the icon and the
      // tile's own name (already in its head) were clipped; the device behind the track stays.
      compact
      noSignal={tile.state === 'OFFLINE' || tile.state === 'FAULT'}
      labels={{ noSignal: t('common.status.noSignal') }}
      accessibilityLabel={t('features.dashboard.devices.feedLabel', { name })}
      style={styles.feed}
    />
  );
}

/**
 * The level line of a MIC tile and the meter's accessible value (B15; the rule is `micReadoutKind`).
 * The number is the runtime's 1 Hz readout (01S §14.6), frozen with the meter under the D43 test
 * switch (uiautomator idle) — and read again when the input's no-signal flag flips, in both modes.
 */
function useMicReadout(channel: AudioTrackId, state: string, frozen: boolean): AudioAccessibilityValue & { readonly notMeasured: boolean } {
  const { t } = useTranslation();
  const sim = useSimInstance();
  // Ruling D137, kept by C21 (7): the input is the microphone line at the channel's position of a COMPLETE pair (a
  // primitive selector). Task 4 row 171 (site M5): `null` when the channel has no input - the lookup of row 164,
  // never `MIC-01` / `MIC-02`. No frame is then read: the tile draws its empty state ("— dBFS", "Not measured").
  const input = useSim((s) => meterInputOfChannel(micLinesInForce(s), channel));
  // Change-only: a boolean selector re-renders the tile when the flag flips, never per frame.
  const frameFlat = useSim((s) => (input === null ? true : (s.audio.inputs[input]?.noSignal ?? true)));
  // J-S 6: the Core's own statement that it measures no level now (no capture is open). Change-only.
  const notMeasured = useSim((s) => input === null || isLevelNotMeasured(s.audio.inputs[input]));
  const ticking = useAudioAccessibilityValue(channel, frozen ? { intervalMs: TEST_SWITCH_READOUT_MS } : {});
  // Render-time "adjust state when an input changed" (no effect, no timer): the level at the flip.
  // The flip that makes the held number stale: the no-signal flag, or (J-S 6) the Core starting / ending to measure.
  const flip = `${frameFlat}|${notMeasured}`;
  const [held, setHeld] = useState({ flip, now: ticking.now });
  if (held.flip !== flip) {
    const frame = input === null ? undefined : sim.store.getState().audio.inputs[input];
    setHeld({ flip, now: audioAccessibilityValue(frame?.dbfs ?? AUDIO_FLOOR_DBFS).now });
  }
  const now = frozen ? held.now : ticking.now;
  // A channel without an input has no level and no fault of an input: the empty state, whatever the channel record says.
  const kind = input === null ? 'NO_LEVEL' : micReadoutKind({ frameFlat, state, notMeasured });
  const text = kind === 'LEVEL' ? `${now} dBFS` : kind === 'NO_SIGNAL' ? t('common.status.noSignal') : MIC_NO_LEVEL_TEXT;
  return { min: ticking.min, max: ticking.max, now, text, notMeasured: notMeasured && kind === 'NO_LEVEL' };
}

/** A tile while the Core link is down: the "no value" mark in the place of the feed or the meter. */
function TileUnknown({ tile, name }: { tile: DeviceTileInfo; name: string }) {
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={t('features.dashboard.tiles.a11y.unknown', { name })} style={styles.meterBody} testID={`home-device-${tile.trackId}-unknown`}>
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.dbfs}>
        {t('features.dashboard.tiles.noValue')}
      </Text>
    </View>
  );
}

/** The microphone tile while the cameras connect: the word "Connecting" in the meter's place (the Session Live card's rule). */
function MicConnecting({ tile, name }: { tile: DeviceTileInfo; name: string }) {
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityLabel={`${t('features.dashboard.devices.meterLabel', { name })}: ${t('common.session.connectingCameras')}`}
      style={styles.meterBody}
      testID={`home-device-${tile.trackId}-connecting`}
    >
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.dbfs}>
        {t('common.session.trackConnecting')}
      </Text>
    </View>
  );
}

function MicMeter({ tile, name }: { tile: DeviceTileInfo; name: string }) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const focused = useIsFocused();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  const channel = tile.trackId as AudioTrackId;
  const values = useAudioSharedValues(channel);
  const a11y = useMicReadout(channel, tile.state, testSwitch);
  if (a11y.notMeasured) {
    // No bars and no number: the meter would draw the floor value as if it were a level (J-S 6 client rule).
    const label = t('features.dashboard.devices.meterLabel', { name });
    return (
      <View style={styles.meterBody}>
        <View
          style={styles.meterRow}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${label}: ${t('common.truth.levelNotMeasured')}`}
          testID={`home-device-${tile.trackId}-not-measured`}
        >
          <Mic size={22} color={palette.gray} />
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.dbfs}>
            {t('common.truth.levelNotMeasured')}
          </Text>
        </View>
        <View style={styles.readoutRow}>
          <Text testID={`home-device-${tile.trackId}-dbfs`} maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.dbfs}>
            {a11y.text}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.meterBody}>
      <View style={styles.meterRow}>
        <Mic size={22} color={palette.gold} />
        <DbfsMeter
          testID={`home-device-${tile.trackId}-meter`}
          level={values.level}
          peak={values.peak}
          clip={values.clip}
          variant="compact"
          motion={policy}
          paused={!focused || testSwitch}
          signal={tile.state === 'NO_SIGNAL' ? 'no-signal' : 'ok'}
          accessibilityLabel={t('features.dashboard.devices.meterLabel', { name })}
          accessibilityValue={a11y}
          style={styles.meter}
        />
      </View>
      <View style={styles.readoutRow}>
        <Text testID={`home-device-${tile.trackId}-dbfs`} maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.dbfs}>
          {a11y.text}
        </Text>
      </View>
    </View>
  );
}

/**
 * Audit row 209 (M3-17; register A3; D134, D138): the pair words of a MIC tile - "Mic N (Camera N)",
 * plus the chip "Transcribed" on Pair 1 alone (the web Dashboard's `device-tile-pair-*` and
 * `device-tile-transcribed-AUDIO-01`, row W3T). No role word is read.
 */
function MicPairWords({ tile, pair }: { tile: DeviceTileInfo; pair: NonNullable<DeviceTileInfo['pair']> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.pairRow}>
      <Text testID={`home-mic-tile-pair-${tile.trackId}`} maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.pairLabel}>
        {t('devices.pairs.micOfCamera', { n: pair.pair })}
      </Text>
      {pair.transcribed ? (
        <StatusChip testID={`home-mic-tile-transcribed-${tile.trackId}`} size="sm" tone="success" label={t('devices.pairs.transcribed')} icon={null} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
  fill: { flex: 1 },
  tile: { flex: 1, borderRadius: 12, padding: 10, gap: 8 },
  // Round two (JT-12): the head wraps - the state chip goes under the name when both do not fit, so the name is
  // never shrunk to half its size beside "Not checked".
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: {
    flexGrow: 1,
    flexShrink: 0,
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.foreground,
  },
  feed: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden' },
  meterBody: { flex: 1, justifyContent: 'center', gap: 8, minHeight: 64 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meter: { flex: 1, height: 12 },
  readoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // Row 209 (A3): the pair label and, on Pair 1, its "Transcribed" chip; wraps like the head on a narrow tile.
  pairRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 4 },
  pairLabel: {
    flexShrink: 1,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  dbfs: {
    flexShrink: 1,
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.gray,
    fontVariant: ['tabular-nums'],
  },
});
