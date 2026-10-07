/**
 * One Devices & Inputs row (04_mobile_specs §4.12 V2–V4; MB 7). A kit `ListGroup.Item`:
 * prefix (camera poster, mic poster with a mic badge, or an icon tile), title and description,
 * and the suffix (status chip or dot + gold chevron). On tablets a mic row also carries a C-2
 * `compact` meter inline (V3), and the selected row is outlined in gold with glow e2. Post-review fix FXR-M
 * (W93-4, the CF2-B RF-T-1 cause): the 1 dp border is there in every state (transparent / gold) and the glow
 * is the always-mounted `SelectionGlow`, so a selection change mounts nothing and changes colours only.
 *
 * The Recording Indicator's lamp breathes while recording (V4; `glowBreath`, registered as an
 * ambient loop so it pauses off-focus and stops under reduced motion, where it stays steadily lit).
 */
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { ListGroup } from 'heroui-native';
import { ChevronRight, EthernetPort, Mic, Siren, Tablet, type LucideIcon } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { derived, fontFamily, palette, radius, spacing, toneHex, typography } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { withAlpha } from '@/components/media';
import { DEMO_MEDIA_LIVE } from '@/components/media/demo-media';
import { useLayoutClass } from '@/layout';
import { animateBreath, animateFade, useAmbientLoop, useMotionSettings, useMotionState } from '@/motion';
import { DeviceMicMeter } from './device-mic-meter';
import { DeviceStatusChip, DeviceStatusDot } from './device-status-chip';
import { DEVICE_CAMERA, DEVICE_KIND, DEVICE_NAME_KEY, STATUS_LABEL_KEY, STATUS_TONE, type DeviceId, type DeviceStatus } from './devices-model';
import { useBookPoe, useCamera, useIsRecording, useMic } from './use-devices-data';

export interface DeviceRowProps {
  deviceId: DeviceId;
  status: DeviceStatus;
  selected: boolean;
  onPress: (deviceId: DeviceId) => void;
}

export function DeviceRow(props: DeviceRowProps) {
  switch (DEVICE_KIND[props.deviceId]) {
    case 'camera':
      return <CameraRow {...props} />;
    case 'microphone':
      return <MicRow {...props} />;
    case 'poe':
      return <PoeRow {...props} />;
    case 'relay':
      return <RelayRow {...props} />;
    case 'tablet':
      return <TabletRow {...props} />;
  }
}

function CameraRow({ deviceId, status, selected, onPress }: DeviceRowProps) {
  const { t } = useTranslation();
  const camera = useCamera(deviceId);
  const name = t(DEVICE_NAME_KEY[deviceId]);
  const poster = DEMO_MEDIA_LIVE.poster[DEVICE_CAMERA[deviceId] ?? 'VIDEO-01'];
  return (
    <RowFrame
      deviceId={deviceId}
      selected={selected}
      onPress={onPress}
      name={name}
      detail={camera?.room ?? ''}
      statusText={t(STATUS_LABEL_KEY[status])}
      prefix={<Thumb source={poster} label={t('features.devices.list.thumbnail', { name })} dim={status === 'FAULT'} />}
      suffix={<DeviceStatusChip status={status} testID={`device-status-${deviceId}`} />}
    />
  );
}

function MicRow({ deviceId, status, selected, onPress }: DeviceRowProps) {
  const { t } = useTranslation();
  const mic = useMic(deviceId);
  const { isMultiPane } = useLayoutClass();
  const focused = useIsFocused();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  const name = t(DEVICE_NAME_KEY[deviceId]);
  // The mockup's mic thumbnails are room photos: MIC 1 sits on the interviewer's side (lens 1),
  // MIC 2 on the subject's side (lens 2). A mic badge marks them as inputs, not cameras.
  const poster = DEMO_MEDIA_LIVE.poster[deviceId === 'MIC-02' ? 'VIDEO-02' : 'VIDEO-01'];
  return (
    <RowFrame
      deviceId={deviceId}
      selected={selected}
      onPress={onPress}
      name={name}
      detail={t('devices.drawer.value.channel', { channel: mic?.channel ?? 1 })}
      statusText={t(STATUS_LABEL_KEY[status])}
      prefix={
        <Thumb source={poster} label={t('features.devices.list.thumbnail', { name })} dim={status === 'NO_SIGNAL'}>
          <View style={styles.micBadge} accessibilityLabel={t('features.devices.list.micBadge')}>
            <Mic size={12} color={palette.black} />
          </View>
        </Thumb>
      }
      extra={
        isMultiPane && mic ? (
          <DeviceMicMeter
            mic={mic}
            variant="compact"
            paused={!focused || testSwitch}
            holdReadout={testSwitch}
            style={styles.inlineMeter}
            testID={`device-row-meter-${deviceId}`}
          />
        ) : null
      }
      suffix={<DeviceStatusChip status={status} testID={`device-status-${deviceId}`} />}
    />
  );
}

function PoeRow({ deviceId, status, selected, onPress }: DeviceRowProps) {
  const { t } = useTranslation();
  const poe = useBookPoe();
  // SIM-GAP-M84-1 / D79: the design book's 2 ports (PoE CAM 1 active, CAM 2/AUX spare).
  const summary = t('devices.other.poeSummary', { active: poe.active, spare: poe.spare });
  return (
    <RowFrame
      deviceId={deviceId}
      selected={selected}
      onPress={onPress}
      name={t(DEVICE_NAME_KEY[deviceId])}
      statusText={status === 'ACTIVE' ? summary : t(STATUS_LABEL_KEY[status])}
      prefix={<IconTile icon={EthernetPort} color={palette.gold} />}
      suffix={
        status === 'ACTIVE' ? (
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.muted} testID={`device-status-${deviceId}`}>
            {summary}
          </Text>
        ) : (
          <DeviceStatusDot status={status} testID={`device-status-${deviceId}`} />
        )
      }
    />
  );
}

function RelayRow({ deviceId, status, selected, onPress }: DeviceRowProps) {
  const { t } = useTranslation();
  const recording = useIsRecording();
  return (
    <RowFrame
      deviceId={deviceId}
      selected={selected}
      onPress={onPress}
      name={t(DEVICE_NAME_KEY[deviceId])}
      statusText={recording ? t('devices.other.recordingLamp') : t(STATUS_LABEL_KEY[status])}
      prefix={<RecLamp lit={recording} />}
      suffix={<DeviceStatusDot status={status} testID={`device-status-${deviceId}`} />}
    />
  );
}

function TabletRow({ deviceId, status, selected, onPress }: DeviceRowProps) {
  const { t } = useTranslation();
  return (
    <RowFrame
      deviceId={deviceId}
      selected={selected}
      onPress={onPress}
      name={t(DEVICE_NAME_KEY[deviceId])}
      statusText={t(STATUS_LABEL_KEY[status])}
      prefix={<IconTile icon={Tablet} color={toneHex[STATUS_TONE[status]]} />}
      suffix={<DeviceStatusDot status={status} testID={`device-status-${deviceId}`} />}
    />
  );
}

interface RowFrameProps {
  deviceId: DeviceId;
  selected: boolean;
  onPress: (deviceId: DeviceId) => void;
  name: string;
  detail?: string;
  statusText: string;
  prefix: ReactNode;
  suffix: ReactNode;
  extra?: ReactNode;
}

function RowFrame({ deviceId, selected, onPress, name, detail, statusText, prefix, suffix, extra }: RowFrameProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap} testID={`device-row-wrap-${deviceId}`}>
      <ListGroup.Item
        testID={`device-row-${deviceId}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={t('features.devices.list.rowLabel', { name, detail: detail ?? '', status: statusText })}
        accessibilityHint={t('features.devices.list.rowHint')}
        onPress={() => onPress(deviceId)}
        style={[styles.item, selected ? styles.itemSelected : null]}
      >
        <ListGroup.ItemPrefix>{prefix}</ListGroup.ItemPrefix>
        <ListGroup.ItemContent style={styles.content}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.title}>
            {name}
          </Text>
          {detail ? (
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.detail}>
              {detail}
            </Text>
          ) : null}
          {extra}
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix style={styles.suffix}>
          {suffix}
          <ChevronRight size={20} color={palette.gold} />
        </ListGroup.ItemSuffix>
      </ListGroup.Item>
      {/* W93-4: always mounted, last; React sets its opacity. */}
      <SelectionGlow selected={selected} radius={radius.px.lg} testID={`device-row-glow-${deviceId}`} />
    </View>
  );
}

function Thumb({ source, label, dim, children }: { source: number; label: string; dim: boolean; children?: ReactNode }) {
  return (
    <View style={styles.thumbWrap}>
      <Image source={source} style={[styles.thumb, dim ? styles.thumbDim : null]} contentFit="cover" transition={0} accessibilityLabel={label} />
      {children}
    </View>
  );
}

function IconTile({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <View style={styles.iconTile}>
      <Icon size={24} color={color} />
    </View>
  );
}

/** V4: the room lamp. Lit while recording; the halo breathes (`glowBreath`, ≤ 0.42 Hz). */
function RecLamp({ lit }: { lit: boolean }) {
  const m = useMotionSettings();
  const focused = useIsFocused();
  const running = useAmbientLoop('devices-rec-lamp', { active: lit, paused: !focused });
  const halo = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    if (!lit) halo.set(animateFade(0, m, 'fast'));
    else if (running) halo.set(animateBreath(0.35, 1, 'glowBreath', m, 1));
    else halo.set(1);
  }, [lit, running, m, halo]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.get() }));
  return (
    <View style={styles.iconTile} testID="device-rec-lamp" accessibilityState={{ checked: lit }}>
      <Animated.View pointerEvents="none" style={[styles.lampHalo, haloStyle]} testID={lit ? 'device-rec-lamp-lit' : undefined} />
      <Siren size={24} color={palette.danger} fill={lit ? withAlpha(palette.danger, 0.35) : 'none'} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  // W93-4 (FXR-M; the RF-T-1 cause): a 1 dp border in every state; the selection changes colours only.
  item: { borderRadius: radius.px.lg, paddingVertical: spacing[1], paddingHorizontal: spacing[0], gap: spacing[2], ...ROW_CARD_BORDER },
  itemSelected: { borderColor: palette.gold, backgroundColor: withAlpha(palette.gold, 0.06) },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size + 1, lineHeight: typography.body.lineHeight, color: palette.foreground },
  detail: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
  muted: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: derived.foreground2 },
  suffix: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], maxWidth: '55%' },
  thumbWrap: { width: 68, height: 48 },
  thumb: { width: 68, height: 48, borderRadius: radius.px.lg, backgroundColor: derived.surfaceSecondary },
  thumbDim: { opacity: 0.4 },
  micBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.gold,
  },
  iconTile: {
    width: 48,
    height: 40,
    borderRadius: radius.px.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: derived.surfaceSecondary,
  },
  lampHalo: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(palette.danger, 0.28) },
  inlineMeter: { marginTop: spacing[0], height: 18 },
});
