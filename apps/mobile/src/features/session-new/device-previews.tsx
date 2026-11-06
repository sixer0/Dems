/**
 * Step 2 previews (04 §4.4 "CameraFeed and C-2 above the list (compact) or beside it (tablet),
 * with the hint 'Speak to test (simulated)'") and the tablet-landscape live device column (the
 * brief's "form + live device check column"). Audit M3-04 R4 (row 183; D5 pairing, D163): one
 * preview per camera-microphone pair, all four, over the shared `CAPTURE_PAIRS` - camera tile
 * "Camera N (Mic N)" (`devices.pairs.cameraOfMic`), meter "Mic N (Camera N)"
 * (`devices.pairs.micOfCamera`, Pair 1 also "Transcribed", as the web row 158 meters). It
 * replaced a hard-coded two-entry list (D60 era) that hid pairs 3 and 4.
 *
 * Feeds are the step-72 live loops through CameraFeed (muted, looped, procedural fallback, D50).
 * Meters take the runtime's UI-thread shared values (04 §5.4): no React render per audio frame.
 * Canvases pause while the screen is unfocused or the app is in the background (04 §7.8).
 *
 * Phones play ONE camera live at a time (04 §7.8 compact budget; on dems_phone two concurrent
 * H.264 decodes to texture views stalled the UI thread for 13 s, S78-6): the other cameras show
 * their bundled poster, and tapping one makes it the live one. Tablets (`live="both"`) play every
 * pair. The demo loops play only for a simulated Core (debug and jest; a release build is
 * LIVE-only, D163 RT-1); a Core in real capture draws the "No preview" tile, which decodes
 * nothing. Under the D43 test switch (`?motion=off`) all show posters, so uiautomator can idle
 * (step 77's precedent).
 */
import { PressableFeedback, Typography } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';
import { settle, useCoreActions } from '@dems/shared/live';
import { CAPTURE_PAIRS, isLevelNotMeasured, meterInputOfChannel, useSim, type CapturePair, type SimState } from '@dems/shared/sim';
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { spacing } from '@dems/shared/tokens';
import { DbfsMeter } from '@/components/composed/dbfs-meter';
import { SectionCard } from '@/components/kit';
import { DEMO_MEDIA_LIVE, demoVideoAssetOf } from '@/components/media';
// Fix wave H (G70-03, G75-13; D196): `CameraPreview` = this feed for a simulated Core, the "No preview" tile for a Core in real capture.
import { CameraPreview } from '@/features/devices/camera-preview';
import { triggerHaptic, useMotionPolicy, useMotionState } from '@/motion';
import { reportRuntimeIssue, useAudioAccessibilityValue, useAudioSharedValues, useCoreErrorPresenter, useCoreLink, useCoreLinkNotice } from '@/runtime';
// Row 182 (M3-04 R5, C10-C12; ruling D193): the live checks of the column are `LiveReadinessChecks` ("Not checked" on own capture).
import { LiveReadinessChecks } from './live-readiness';

/**
 * Row 183 (M3-04 R4): the signal of a pair's camera and microphone, found BY ID - the camera by its
 * video track, the microphone by its audio track - never by the position in `s.cameras` / `s.mics`
 * (a Live Core's lists need not hold four entries in pair order). An entry the state does not hold
 * is not flagged (as the positional read did past the end of the list): the tile's own source state
 * speaks for a Core in real capture.
 */
const cameraNoSignalOf = (s: SimState, track: VideoTrackId): boolean => {
  const camera = s.cameras.find((entry) => entry.id === track);
  return camera !== undefined && !(camera.online && camera.lens !== 'FAULT');
};
const micNoSignalOf = (s: SimState, channel: AudioTrackId): boolean => s.mics.find((entry) => entry.id === channel)?.state === 'NO_SIGNAL';

/** The tile id of a pair: `CAM-<n>` (testIDs `session-new-preview-CAM-<n>`; `previewTrackOf` reads the digit). */
const previewCameraIdOf = (pair: CapturePair): string => `CAM-${pair.pair}`;

export interface DevicePreviewsProps {
  /** `row`: the four pair tiles two by two (phone, tablet portrait). `column`: stacked (device column). */
  layout: 'row' | 'column';
  /** `one`: one live feed at a time, the others posters (phones). `both`: every pair live (tablets). */
  live: 'one' | 'both';
  paused: boolean;
  testID?: string;
}

export function DevicePreviews({ layout, live, paused, testID = 'session-new-previews' }: DevicePreviewsProps) {
  const { t } = useTranslation();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  const [liveIndex, setLiveIndex] = useState(0);
  // Live mode says where the levels come from instead of "(simulated)" (row M1, W67 F-2; §3.2); the words are
  // shared with the web console (`sessionNew.live.*`, closing copy round, D164 DN-5).
  const liveSource = useCoreLink().source === 'LIVE';
  return (
    <View testID={testID} style={styles.previews}>
      <View style={layout === 'row' ? styles.row : styles.column}>
        {CAPTURE_PAIRS.map((pair, index) => (
          <View key={pair.videoTrackId} style={layout === 'row' ? styles.tileRow : styles.tileColumn}>
            <PreviewTile
              cameraId={previewCameraIdOf(pair)}
              track={pair.videoTrackId}
              poster={testSwitch || (live === 'one' && index !== liveIndex) ? demoVideoAssetOf(DEMO_MEDIA_LIVE, 'poster', pair.videoTrackId) : null}
              onMakeLive={
                live === 'one' && !testSwitch && index !== liveIndex
                  ? () => {
                      triggerHaptic('segmentSelect');
                      setLiveIndex(index);
                    }
                  : undefined
              }
              cameraLabel={t('devices.pairs.cameraOfMic', { n: pair.pair })}
              channel={pair.audioTrackId}
              micLabel={
                pair.pair === 1
                  ? `${t('devices.pairs.micOfCamera', { n: pair.pair })} · ${t('devices.pairs.transcribed')}`
                  : t('devices.pairs.micOfCamera', { n: pair.pair })
              }
              paused={paused}
            />
          </View>
        ))}
      </View>
      <Typography type="body-xs" color="muted" testID={`${testID}-hint`}>
        {t(liveSource ? 'sessionNew.live.speakToTest' : 'sessionNew.devices.speakToTest')}
      </Typography>
    </View>
  );
}

interface PreviewTileProps {
  cameraId: string;
  /** The pair's video track (`VIDEO-0N`): its camera's signal is read by this id. */
  track: VideoTrackId;
  /** A still instead of the live loop (`poster` mode); null = live. */
  poster: number | null;
  /** Poster tiles on phones: tap to make this camera the live one. */
  onMakeLive?: () => void;
  cameraLabel: string;
  channel: AudioTrackId;
  micLabel: string;
  paused: boolean;
}

function PreviewTile({ cameraId, track, poster, onMakeLive, cameraLabel, channel, micLabel, paused }: PreviewTileProps) {
  const { t } = useTranslation();
  const cameraNoSignal = useSim((s) => cameraNoSignalOf(s, track));
  const micNoSignal = useSim((s) => micNoSignalOf(s, channel));
  const policy = useMotionPolicy();
  const actions = useCoreActions();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const values = useAudioSharedValues(channel);
  const noSignalText = t('session.feed.noSignal');
  const a11y = useAudioAccessibilityValue(channel, { noSignalText });
  // Task 4 row 169 (site M3; decision C18 (2)): the input of a meter channel is found by the lookup of row 164 - `null`
  // when the selector holds no complete microphone pair. No level is then read (never the level of `MIC-01` /
  // `MIC-02`, which the selector does not hold): the tile draws its "Not measured" words, no bars and no number.
  const notMeasured = useSim((s) => {
    const input = meterInputOfChannel(micLinesInForce(s), channel);
    return input === null || isLevelNotMeasured(s.audio.inputs[input]);
  });
  // Fire and forget (operation 52 in Live mode): nothing waits for the answer, as before. A
  // rejection is logged; in Live mode the presenter also words it (a denial, an outage, a limit).
  const resetClip = () => {
    settle(() => actions.resetClip(channel), {
      fail: (error) => {
        reportRuntimeIssue('warn', 'features.sessionNew.resetClip', error, { channel });
        if (live) presentCoreError(error);
      },
    });
  };
  const feed = (
    <CameraPreview
      livePreview
      name={cameraLabel}
      testID={`session-new-feed-${cameraId}`}
      cameraId={cameraId}
      mode={poster === null ? 'live' : 'poster'}
      {...(poster === null ? {} : { image: poster })}
      motion={policy}
      paused={paused}
      noSignal={cameraNoSignal}
      cameraLabel={cameraLabel.toUpperCase()}
      grainFps={12.5}
      labels={{ noSignal: noSignalText }}
      accessibilityLabel={cameraLabel}
    />
  );
  return (
    <View style={styles.tile} testID={`session-new-preview-${cameraId}`}>
      {onMakeLive ? (
        <PressableFeedback
          testID={`session-new-make-live-${cameraId}`}
          onPress={onMakeLive}
          accessibilityRole="button"
          accessibilityLabel={t('features.session-new.devices.makeLive', { camera: cameraLabel })}
        >
          {feed}
        </PressableFeedback>
      ) : (
        feed
      )}
      <View style={styles.meterRow}>
        <Typography type="body-xs" weight="medium" color="muted" testID={`session-new-meter-${channel}-label`}>
          {micLabel}
        </Typography>
        {/* Round two (JW-08 mobile half; contract J-S 6; seen on the tablet: "MIC 1, -60 dBFS" beside "Not checked" at
            rest): a frame the Core marks `notMeasured` is no level - the words, no bars and no number. */}
        {notMeasured ? (
          <Typography type="body-xs" color="muted" accessibilityLabel={`${micLabel}: ${t('common.truth.levelNotMeasured')}`} testID={`session-new-meter-${channel}-not-measured`}>
            {t('common.truth.levelNotMeasured')}
          </Typography>
        ) : (
        <View style={styles.meter}>
          <DbfsMeter
            level={values.level}
            peak={values.peak}
            clip={values.clip}
            variant="compact"
            motion={policy}
            paused={paused}
            signal={micNoSignal ? 'no-signal' : 'ok'}
            onClipReset={resetClip}
            labels={{ unit: 'dBFS', clip: t('common.enums.micState.CLIP'), noSignal: noSignalText, clipResetHint: t('session.audio.clipReset') }}
            accessibilityLabel={micLabel}
            accessibilityValue={a11y}
            testID={`session-new-meter-${channel}`}
          />
        </View>
        )}
      </View>
    </View>
  );
}

export interface LiveDeviceColumnProps {
  /** Step 2 shows the gate itself in the content column, so the column shows only the previews. */
  showChecks: boolean;
  /** Round two (JT-22): the devices check of this session has run (step 3) - the card no longer promises it. */
  afterChecks?: boolean;
  paused: boolean;
}

/**
 * Tablet landscape: previews, meters and the pre-check items (`CHECK_ORDER` = `PRECHECK_ORDER`, twelve since D5) evaluated against the live device
 * state (the same rules the gate applies; the gate itself runs on step 2).
 */
export function LiveDeviceColumn({ showChecks, afterChecks = false, paused }: LiveDeviceColumnProps) {
  const { t } = useTranslation();
  // Fix wave L (G70c-06): ONE statement of the link per screen. While the Core link is down this card
  // holds the Core's LAST report, which nothing confirms any more: it says so instead of "ONLINE / READY".
  const { offline: linkDown } = useCoreLinkNotice();
  return (
    <View style={styles.columnStack}>
      <SectionCard title={t('features.session-new.devices.previewTitle')} testID="session-new-device-previews">
        <DevicePreviews layout="column" live="both" paused={paused} testID="session-new-column-previews" />
      </SectionCard>
      {showChecks ? (
        <SectionCard
          title={t('features.session-new.devices.liveTitle')}
          description={t(linkDown ? 'features.session-new.devices.liveHintLinkDown' : afterChecks ? 'features.session-new.devices.liveHintAfter' : 'features.session-new.devices.liveHint')}
          testID="session-new-live-checks"
        >
          <LiveReadinessChecks linkDown={linkDown} />
        </SectionCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  previews: { gap: spacing[1] },
  // Row 183: four pairs - two per line (each tile at least ~45% of the line, so it wraps to 2 x 2).
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  column: { gap: spacing[3] },
  tileRow: { flexGrow: 1, flexBasis: '45%', minWidth: 0 },
  tileColumn: { alignSelf: 'stretch' },
  tile: { gap: spacing[1] },
  // Row 183: the pair label ("Mic N (Camera N)") is longer than "MIC 1", so it sits on its own line above the meter.
  meterRow: { gap: spacing[1] },
  meter: { alignSelf: 'stretch' },
  columnStack: { gap: spacing[3] },
});
