/**
 * The rows of the registered devices beyond the built-in ids (task 3, R-11, blueprint row 140;
 * ruling D137 (2); ux §8f.2 "Devices rows", §8f.3), inside the Camera Devices and the Audio Inputs
 * sections of Devices & Inputs (MB-08, MB-09). Built from the Core's device list (`useRegisteredDevices`).
 *
 * A row: an icon tile, the name ("Core Mac's camera", "MIC 3", "Camera CAM-04"), what the device is
 * used as and its id, the ONE "Development source" badge, the fixed 'is on' line (only when the Core
 * says so), the NAMED rate warning of a microphone (`MIC_RATE_AT_LIMIT`, D128), the state chip and
 * the chevron to its details ("View device"). The row keeps its name and its badge in every state;
 * nothing here offers another source in its place (D80(11)). Renders nothing when the Core lists none.
 */
import { ListGroup, Separator } from 'heroui-native';
import { Camera, ChevronRight, Mic, Radio, TriangleAlert } from 'lucide-react-native';
import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media';
import { LOCAL_STATE_TONE } from '@/features/capture-selector/capture-notices-model';
import { DevelopmentSourceBadge, useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import {
  parseRosterLine,
  rosterDeviceName,
  rosterDeviceState,
  rosterLine,
  rosterOnKey,
  rosterSourceKind,
  sourceChecked,
  sourceStateLabelKey,
  type RegisteredDevice,
  type RosterKind,
} from './registered-devices-model';

/** The roster, re-rendering only when a fact of it changes (one flat string from the store). */
export function useRegisteredDevices(): readonly RegisteredDevice[] {
  const line = useSim(rosterLine);
  return useMemo(() => parseRosterLine(line), [line]);
}

export function useRegisteredDevice(deviceId: string | null): RegisteredDevice | null {
  const devices = useRegisteredDevices();
  return deviceId === null ? null : (devices.find((device) => device.id === deviceId) ?? null);
}

export interface RegisteredDeviceRowsProps {
  kind: RosterKind;
  selectedId: string | null;
  /** "View device": the screen opens the details of that registered device. */
  onPress: (deviceId: string) => void;
}

export function RegisteredDeviceRows({ kind, selectedId, onPress }: RegisteredDeviceRowsProps) {
  const devices = useRegisteredDevices().filter((device) => device.kind === kind);
  if (devices.length === 0) return null;
  return (
    <>
      {devices.map((device) => (
        <Fragment key={device.id}>
          <Separator />
          <RegisteredDeviceRow device={device} selected={device.id === selectedId} onPress={onPress} />
        </Fragment>
      ))}
    </>
  );
}

function RegisteredDeviceRow({ device, selected, onPress }: { device: RegisteredDevice; selected: boolean; onPress: (deviceId: string) => void }) {
  const { t } = useTranslation();
  const { live } = useSourceBadgeMode();
  const name = rosterDeviceName(t, device, live);
  const state = rosterDeviceState(device);
  const local = device.adapter === 'LOCAL_DEVICE' && rosterSourceKind(device, live) !== null;
  // Wave L ruling (G70c-02): READY without a checked fact of the Core is "Not checked".
  const stateText = t(sourceStateLabelKey(state, local, sourceChecked(device)));
  const usedAs = t(`common.developmentRoster.usedAs.${device.slot ?? 'NONE'}`);
  const onKey = rosterOnKey(device, live);
  const Icon = device.kind === 'CAMERA' ? Camera : Mic;
  return (
    <View style={styles.wrap} testID={`registered-device-wrap-${device.id}`}>
      <ListGroup.Item
        testID={`registered-device-row-${device.id}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={t('features.devices.list.rowLabel', { name, detail: `${usedAs}, ${device.id}`, status: stateText })}
        accessibilityHint={t('features.devices.list.rowHint')}
        onPress={() => onPress(device.id)}
        style={[styles.item, selected ? styles.itemSelected : null]}
      >
        <ListGroup.ItemPrefix>
          <View style={styles.iconTile}>
            <Icon size={24} color={palette.gold} />
          </View>
        </ListGroup.ItemPrefix>
        <ListGroup.ItemContent style={styles.content}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.title} testID={`registered-device-name-${device.id}`}>
            {name}
          </Text>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.detail} testID={`registered-device-used-${device.id}`}>
            {`${usedAs} · ${device.id}`}
          </Text>
          {/* Decided by the Core: no node when it sent no development class, and none in Simulated mode. */}
          <DevelopmentSourceBadge deviceId={device.id} testID={`registered-device-source-${device.id}`} />
          {onKey === null ? null : (
            <View style={styles.line} accessibilityRole="text" accessibilityLiveRegion="polite" testID={`registered-device-on-${device.id}`}>
              <Radio size={14} color={palette.warning} />
              <Text maxFontSizeMultiplier={1.2} style={styles.warningText}>
                {t(onKey)}
              </Text>
            </View>
          )}
          {device.rateAtLimit ? (
            <View style={styles.line} accessibilityRole="alert" testID={`registered-device-rate-${device.id}`}>
              <TriangleAlert size={14} color={palette.warning} />
              <Text maxFontSizeMultiplier={1.2} style={styles.warningText}>
                {t('common.developmentRoster.rateAtLimit.title')}
              </Text>
            </View>
          ) : null}
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix style={styles.suffix}>
          <StatusChip size="sm" tone={LOCAL_STATE_TONE[state]} label={stateText} testID={`registered-device-state-${device.id}`} />
          <ChevronRight size={20} color={palette.gold} />
        </ListGroup.ItemSuffix>
      </ListGroup.Item>
      {/* Always mounted, as the built-in rows (W93-4): a selection change mounts nothing. */}
      <SelectionGlow selected={selected} radius={radius.px.lg} testID={`registered-device-glow-${device.id}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  item: { borderRadius: radius.px.lg, paddingVertical: spacing[1], paddingHorizontal: spacing[0], gap: spacing[2], ...ROW_CARD_BORDER },
  itemSelected: { borderColor: palette.gold, backgroundColor: withAlpha(palette.gold, 0.06) },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size + 1, lineHeight: typography.body.lineHeight, color: palette.foreground },
  detail: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] },
  warningText: { flexShrink: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.warning },
  suffix: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], maxWidth: '55%' },
  iconTile: { width: 48, height: 40, borderRadius: radius.px.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: derived.surfaceSecondary },
});
