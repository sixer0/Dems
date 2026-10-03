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
 */
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { PressableFeedback, Surface } from 'heroui-native';
import { Mic } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AudioTrackId } from '@dems/shared/domain';
import { fontFamily, palette, toneHex, typography, type StatusTone } from '@dems/shared/tokens';
import { DbfsMeter } from '@/components/composed/dbfs-meter';
import { StatusChip } from '@/components/kit';
import { CameraFeed } from '@/components/media/camera-feed';
import { DEMO_MEDIA_LIVE } from '@/components/media/demo-media';
import { useMotionPolicy, useMotionSettings, useMotionState } from '@/motion';
import { useAudioAccessibilityValue, useAudioSharedValues } from '@/runtime';
import { TRACK_NAME_KEY } from './home-model';
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

export function DeviceTiles() {
  const { t } = useTranslation();
  const tiles = useDeviceTiles();
  return (
    <View testID="home-devices" accessibilityLabel={t('dashboard.devices.title')} style={styles.grid}>
      {tiles.map((tile, index) => (
        <View key={tile.trackId} style={styles.cell}>
          <DeviceTile tile={tile} index={index} />
        </View>
      ))}
    </View>
  );
}

function DeviceTile({ tile, index }: { tile: DeviceTileInfo; index: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useMotionSettings();
  const name = t(TRACK_NAME_KEY[tile.trackId] ?? tile.trackId);
  const tone = STATE_TONE[tile.state] ?? 'default';

  return (
    <Animated.View entering={homeEnter(beatAt(HOME_BEATS.tiles, HOME_BEATS.tileStagger, index), settings)} style={styles.fill}>
      <PressableFeedback
        testID={`home-device-${tile.trackId}`}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${t(stateKeyFor(tile))}`}
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
            <StatusChip tone={tone} label={t(stateKeyFor(tile))} icon={null} size="sm" />
          </View>
          {tile.kind === 'camera' ? <FeedThumb tile={tile} name={name} /> : <MicMeter tile={tile} name={name} />}
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
    <CameraFeed
      testID={`home-device-${tile.trackId}-feed`}
      cameraId={`CAM-${cameraIndex}`}
      cameraLabel={`CAM ${cameraIndex}`}
      mode={testSwitch ? 'poster' : 'live'}
      {...(testSwitch ? { image: poster } : {})}
      motion={policy}
      paused={!focused}
      noSignal={tile.state === 'OFFLINE' || tile.state === 'FAULT'}
      labels={{ noSignal: t('common.status.noSignal') }}
      accessibilityLabel={t('features.dashboard.devices.feedLabel', { name })}
      style={styles.feed}
    />
  );
}

function MicMeter({ tile, name }: { tile: DeviceTileInfo; name: string }) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const focused = useIsFocused();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  const channel = tile.trackId as AudioTrackId;
  const values = useAudioSharedValues(channel);
  // 1 Hz readout (01S §14.6); frozen with the meter under the D43 test switch (uiautomator idle).
  const a11y = useAudioAccessibilityValue(channel, {
    noSignalText: t('common.status.noSignal'),
    ...(testSwitch ? { intervalMs: TEST_SWITCH_READOUT_MS } : {}),
  });
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
      <Text testID={`home-device-${tile.trackId}-dbfs`} maxFontSizeMultiplier={1.2} style={styles.dbfs}>
        {a11y.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
  fill: { flex: 1 },
  tile: { flex: 1, borderRadius: 12, padding: 10, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: {
    flex: 1,
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.foreground,
  },
  feed: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden' },
  meterBody: { flex: 1, justifyContent: 'center', gap: 8, minHeight: 64 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meter: { flex: 1, height: 12 },
  dbfs: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.gray,
    fontVariant: ['tabular-nums'],
  },
});
