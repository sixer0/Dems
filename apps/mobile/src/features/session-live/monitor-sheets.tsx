/**
 * The monitor's sheets (04_mobile_specs §4.5 S1, S5; §4.19 "Sheets: Timeline, Audio Monitor, session
 * settings"). Kit `BottomSheet` (@gorhom underneath); Android uses the default dim overlay (VM-04).
 *
 * - Timeline (phone, from the History icon): the C-3 SessionTimeline of this session.
 * - Audio Monitor: two C-2 `large` meters with peak hold and the CLIP reset. MIC 1 and MIC 2 stay
 *   separate (SYS-003).
 * - Settings: "Pause monitoring" (UI only, D28/Q8), the camera choice and the meter size.
 *
 * Each sheet mounts only while open or closing (`useSheetPresence`, F-79-2), so no hidden sheet
 * keeps meters or lists alive.
 */
import { BottomSheet, Description, Label, Switch, Tabs } from 'heroui-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MIC_CHANNEL_NAME_KEY } from '@/features/dashboard/home-model'; // D61 (2026-11-04)
import { useOwnCapture } from './own-capture';
import { StyleSheet, Text, View } from 'react-native';
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';
import { SimContext, useSimInstance, type CameraStatus, type MicStatus } from '@dems/shared/sim';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { SessionTimeline, type TimelineItem } from '@/components/composed/session-timeline';
import type { MeterVariant } from '@/components/composed/dbfs-meter';
import { triggerHaptic, useMotionPolicy } from '@/motion';
import { MicMeter } from './mic-card';
import { cameraIndexOf } from './session-live.math';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';
import { useConfirmedOpen } from '@/lib/sheet-open';

interface SheetFrameProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  testID: string;
  children: ReactNode;
}

function SheetFrame({ isOpen, onClose, title, description, testID, children }: SheetFrameProps) {
  const { t } = useTranslation();
  // The kit portals sheet content to its host under HeroUINativeProvider, which sits above the
  // simulator's provider (04 §3.2 slots 7 and 9): re-provide the simulator for the meters inside.
  const sim = useSimInstance();
  const presence = useSheetPresence(isOpen);
  // Fix wave J round two (JM-02 is the app's, not only the Evidence sheets'): the open is confirmed, and asked again when the sheet library dropped it.
  const confirmed = useConfirmedOpen(presence.open, onClose, { testID: testID });
  if (!presence.mounted) return null;
  const body = <SimContext.Provider value={sim}>{children}</SimContext.Provider>;
  return (
    <BottomSheet isOpen={confirmed.kitOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content onAnimate={confirmed.onAnimate}>
          <SheetContentSignal onChange={presence.setContentMounted}>
            <View style={styles.header} testID={testID}>
              <View style={styles.headerText}>
                <BottomSheet.Title>{title}</BottomSheet.Title>
                {description ? <BottomSheet.Description>{description}</BottomSheet.Description> : null}
              </View>
              {/* Also closes directly, so a close within the opening frame is never lost. */}
              <BottomSheet.Close accessibilityLabel={t('features.session-live.sheets.close')} testID={`${testID}-close`} onPress={onClose} />
            </View>
            <View style={styles.body}>{body}</View>
          </SheetContentSignal>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/**
 * The sheet shows the newest events only: a scrolling body (percentage snap points, or a capped
 * dynamic size with BottomSheetScrollView) stayed parked off-screen on dems_phone, while
 * content-sized sheets open reliably (F-79-2). The full history lives in Sessions and Audit.
 */
export const TIMELINE_SHEET_ROWS = 8;

export interface TimelineSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: readonly TimelineItem[];
}

export function TimelineSheet({ isOpen, onClose, items }: TimelineSheetProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  return (
    <SheetFrame isOpen={isOpen} onClose={onClose} title={t('features.session-live.sheets.timelineTitle')} testID="monitor-timeline-sheet">
      <SessionTimeline
        items={items.slice(-TIMELINE_SHEET_ROWS)}
        order="newest-first"
        motion={policy}
        emptyLabel={t('features.session-live.sheets.timelineEmpty')}
        testID="monitor-timeline-sheet-list"
      />
    </SheetFrame>
  );
}

export interface AudioMonitorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mics: readonly MicStatus[];
  monitoringPaused: boolean;
  onClipReset: (channel: AudioTrackId, release: () => void) => void;
}

export function AudioMonitorSheet({ isOpen, onClose, mics, monitoringPaused, onClipReset }: AudioMonitorSheetProps) {
  const { t } = useTranslation();
  // JT-07: a Core in its own capture records one audio track from the active microphone (i18n note).
  const ownCapture = useOwnCapture();
  return (
    <SheetFrame
      isOpen={isOpen}
      onClose={onClose}
      title={t('features.session-live.sheets.audioTitle')}
      description={t(ownCapture ? 'features.session-live.sheets.audioDescriptionOwnCapture' : 'features.session-live.sheets.audioDescription')}
      testID="monitor-audio-sheet"
    >
      <View style={styles.meters}>
        {mics.map((mic) => (
          <View key={mic.id} style={styles.largeMeter}>
            <Text maxFontSizeMultiplier={1.2} style={styles.meterTitle}>
              {/* D61 (2026-11-04): any of the four channels; the names come from the shared catalog. */}
              {ownCapture ? t(MIC_CHANNEL_NAME_KEY[mic.channel]) : t(`common.tracks.${mic.id}`)}
            </Text>
            <MicMeter
              mic={mic}
              variant="large"
              paused={false}
              monitoringPaused={monitoringPaused}
              onClipReset={onClipReset}
              testID={`monitor-audio-sheet-meter-${mic.channel}`}
            />
          </View>
        ))}
      </View>
    </SheetFrame>
  );
}

export interface MonitorSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  monitoringPaused: boolean;
  onMonitoringPausedChange: (paused: boolean) => void;
  activeCameraId: VideoTrackId;
  cameras: readonly CameraStatus[];
  onSwitchCamera: (cameraId: VideoTrackId) => void;
  meterVariant: MeterVariant;
  onMeterVariantChange: (variant: MeterVariant) => void;
}

export function MonitorSettingsSheet({
  isOpen,
  onClose,
  monitoringPaused,
  onMonitoringPausedChange,
  activeCameraId,
  cameras,
  onSwitchCamera,
  meterVariant,
  onMeterVariantChange,
}: MonitorSettingsSheetProps) {
  const { t } = useTranslation();
  return (
    <SheetFrame
      isOpen={isOpen}
      onClose={onClose}
      title={t('features.session-live.sheets.settingsTitle')}
      description={t('features.session-live.sheets.settingsDescription')}
      testID="monitor-settings-sheet"
    >
      <View style={styles.settings}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Label>{t('session.actions.pauseMonitoring.title')}</Label>
            <Description>{t('features.session-live.sheets.pauseDescription')}</Description>
          </View>
          <Switch
            testID="monitor-settings-pause"
            isSelected={monitoringPaused}
            onSelectedChange={(on) => {
              triggerHaptic('switchToggle');
              onMonitoringPausedChange(on);
            }}
            accessibilityLabel={t('session.actions.pauseMonitoring.title')}
          />
        </View>
        <View style={styles.settingBlock}>
          <Label>{t('features.session-live.sheets.camera')}</Label>
          <Tabs
            value={activeCameraId}
            onValueChange={(value) => {
              triggerHaptic('segmentSelect');
              onSwitchCamera(value as VideoTrackId);
            }}
            variant="primary"
          >
            <Tabs.List>
              <Tabs.Indicator />
              {cameras.map((camera) => (
                <Tabs.Trigger key={camera.id} value={camera.id} testID={`monitor-settings-camera-${cameraIndexOf(camera.id)}`}>
                  <Tabs.Label>{t('features.session-live.feed.cameraShort', { index: cameraIndexOf(camera.id) })}</Tabs.Label>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs>
        </View>
        <View style={styles.settingBlock}>
          <Label>{t('features.session-live.sheets.meterScale')}</Label>
          <Tabs
            value={meterVariant}
            onValueChange={(value) => {
              triggerHaptic('segmentSelect');
              onMeterVariantChange(value === 'compact' ? 'compact' : 'card');
            }}
            variant="primary"
          >
            <Tabs.List>
              <Tabs.Indicator />
              <Tabs.Trigger value="card" testID="monitor-settings-meter-card">
                <Tabs.Label>{t('features.session-live.sheets.meterScaleStandard')}</Tabs.Label>
              </Tabs.Trigger>
              <Tabs.Trigger value="compact" testID="monitor-settings-meter-compact">
                <Tabs.Label>{t('features.session-live.sheets.meterScaleCompact')}</Tabs.Label>
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>
      </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  headerText: { flex: 1, gap: 4 },
  body: { paddingBottom: 8 },
  meters: { gap: 16, paddingBottom: 24 },
  largeMeter: { gap: 8 },
  meterTitle: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
  },
  settings: { gap: 20, paddingBottom: 24 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingText: { flex: 1, gap: 2 },
  settingBlock: { gap: 8 },
});
