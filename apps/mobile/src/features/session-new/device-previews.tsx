/**
 * Step 2 previews (04 §4.4 "CameraFeed ×2 and C-2 ×2 above the list (compact) or beside it
 * (tablet), with the hint 'Speak to test (simulated)'") and the tablet-landscape live device
 * column (the brief's "form + live device check column"; 04 §2.4 expanded: "(step 2) both camera
 * previews and both meters side by side").
 *
 * Feeds are the step-72 live loops through CameraFeed (muted, looped, procedural fallback, D50).
 * Meters take the runtime's UI-thread shared values (04 §5.4): no React render per audio frame.
 * Canvases pause while the screen is unfocused or the app is in the background (04 §7.8).
 *
 * Phones play ONE camera live at a time (04 §7.8 compact budget "≤ 3 animated canvases: feed + 2
 * meters"; on dems_phone two concurrent H.264 decodes to texture views stalled the UI thread for
 * 13 s, S78-6): the other camera shows its bundled poster, and tapping it makes it the live one.
 * Tablets play both (budget ≤ 5). Under the D43 test switch (`?motion=off`) both show posters, so
 * uiautomator can idle (step 77's precedent).
 */
import { ListGroup, PressableFeedback, Separator, Typography } from 'heroui-native';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { AudioTrackId } from '@dems/shared/domain';
import { settle, useCoreActions } from '@dems/shared/live';
import { useSim, type SimState } from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { DbfsMeter } from '@/components/composed/dbfs-meter';
import { SectionCard, StatusChip } from '@/components/kit';
import { CameraFeed, DEMO_MEDIA_LIVE } from '@/components/media';
import { triggerHaptic, useMotionPolicy, useMotionState } from '@/motion';
import { reportRuntimeIssue, useAudioAccessibilityValue, useAudioSharedValues, useCoreErrorPresenter, useCoreLink } from '@/runtime';
import { CHECK_ORDER, decodeEvaluation, precheckTone, valueKey } from './session-new-model';
import { CheckIcon } from './check-icon';
import { useLiveEvaluations, useMicSignals } from './use-session-new';

const selectCameraSignals = (s: SimState): string[] => s.cameras.map((camera) => (camera.online && camera.lens !== 'FAULT' ? 'OK' : 'NO_SIGNAL'));

const CAMERAS = [
  { cameraId: 'CAM-1', track: 'VIDEO-01', labelKey: 'common.devices.camera1', channel: 'AUDIO-01', micKey: 'common.devices.mic1' },
  { cameraId: 'CAM-2', track: 'VIDEO-02', labelKey: 'common.devices.camera2', channel: 'AUDIO-02', micKey: 'common.devices.mic2' },
] as const satisfies readonly { cameraId: string; track: 'VIDEO-01' | 'VIDEO-02'; labelKey: string; channel: AudioTrackId; micKey: string }[];

export interface DevicePreviewsProps {
  /** `row`: the two tiles side by side (phone, tablet portrait). `column`: stacked (device column). */
  layout: 'row' | 'column';
  /** `one`: one live feed at a time, the other a poster (phones). `both`: two live feeds (tablets). */
  live: 'one' | 'both';
  paused: boolean;
  testID?: string;
}

export function DevicePreviews({ layout, live, paused, testID = 'session-new-previews' }: DevicePreviewsProps) {
  const { t } = useTranslation();
  const cameraSignals = useSim(selectCameraSignals);
  const micSignals = useMicSignals();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  const [liveIndex, setLiveIndex] = useState(0);
  // Live mode says where the levels come from instead of "(simulated)" (row M1, W67 F-2; §3.2).
  const liveSource = useCoreLink().source === 'LIVE';
  return (
    <View testID={testID} style={styles.previews}>
      <View style={layout === 'row' ? styles.row : styles.column}>
        {CAMERAS.map((camera, index) => (
          <View key={camera.cameraId} style={layout === 'row' ? styles.tileRow : styles.tileColumn}>
            <PreviewTile
              cameraId={camera.cameraId}
              poster={testSwitch || (live === 'one' && index !== liveIndex) ? DEMO_MEDIA_LIVE.poster[camera.track] : null}
              onMakeLive={
                live === 'one' && !testSwitch && index !== liveIndex
                  ? () => {
                      triggerHaptic('segmentSelect');
                      setLiveIndex(index);
                    }
                  : undefined
              }
              cameraLabel={t(camera.labelKey)}
              channel={camera.channel}
              micLabel={t(camera.micKey)}
              cameraNoSignal={cameraSignals[index] === 'NO_SIGNAL'}
              micNoSignal={micSignals[index] === 'NO_SIGNAL'}
              paused={paused}
            />
          </View>
        ))}
      </View>
      <Typography type="body-xs" color="muted" testID={`${testID}-hint`}>
        {t(liveSource ? 'features.session-new.live.speakToTest' : 'sessionNew.devices.speakToTest')}
      </Typography>
    </View>
  );
}

interface PreviewTileProps {
  cameraId: string;
  /** A still instead of the live loop (`poster` mode); null = live. */
  poster: number | null;
  /** Poster tiles on phones: tap to make this camera the live one. */
  onMakeLive?: () => void;
  cameraLabel: string;
  channel: AudioTrackId;
  micLabel: string;
  cameraNoSignal: boolean;
  micNoSignal: boolean;
  paused: boolean;
}

function PreviewTile({ cameraId, poster, onMakeLive, cameraLabel, channel, micLabel, cameraNoSignal, micNoSignal, paused }: PreviewTileProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const actions = useCoreActions();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const values = useAudioSharedValues(channel);
  const noSignalText = t('session.feed.noSignal');
  const a11y = useAudioAccessibilityValue(channel, { noSignalText });
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
    <CameraFeed
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
        <Typography type="body-xs" weight="medium" color="muted" style={styles.meterLabel}>
          {micLabel}
        </Typography>
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
      </View>
    </View>
  );
}

export interface LiveDeviceColumnProps {
  /** Step 2 shows the gate itself in the content column, so the column shows only the previews. */
  showChecks: boolean;
  paused: boolean;
}

/**
 * Tablet landscape: previews, meters and the eight §5.3 checks evaluated against the live device
 * state (the same rules the gate applies; the gate itself runs on step 2).
 */
export function LiveDeviceColumn({ showChecks, paused }: LiveDeviceColumnProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.columnStack}>
      <SectionCard title={t('features.session-new.devices.previewTitle')} testID="session-new-device-previews">
        <DevicePreviews layout="column" live="both" paused={paused} testID="session-new-column-previews" />
      </SectionCard>
      {showChecks ? (
        <SectionCard
          title={t('features.session-new.devices.liveTitle')}
          description={t('features.session-new.devices.liveHint')}
          testID="session-new-live-checks"
        >
          <LiveChecks />
        </SectionCard>
      ) : null}
    </View>
  );
}

function LiveChecks() {
  const { t } = useTranslation();
  const evaluations = useLiveEvaluations();
  return (
    <ListGroup variant="transparent">
      {CHECK_ORDER.map((id, index) => {
        const { status, value } = decodeEvaluation(evaluations[index] ?? 'PASS|');
        return (
          <Fragment key={id}>
            {index > 0 ? <Separator /> : null}
            <ListGroup.Item testID={`session-new-live-${id}`} className="py-2">
              <ListGroup.ItemPrefix>
                <CheckIcon id={id} tone={precheckTone(status)} size={16} />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{t(`sessionNew.devices.checks.${id}`)}</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix>
                <StatusChip
                  size="sm"
                  tone={precheckTone(status)}
                  label={t(valueKey(id, value), { defaultValue: value })}
                  icon={null}
                />
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
          </Fragment>
        );
      })}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  previews: { gap: spacing[1] },
  row: { flexDirection: 'row', gap: spacing[2] },
  column: { gap: spacing[3] },
  tileRow: { flex: 1, minWidth: 0 },
  tileColumn: { alignSelf: 'stretch' },
  tile: { gap: spacing[1] },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  meterLabel: { width: 44 },
  meter: { flex: 1 },
  columnStack: { gap: spacing[3] },
});
