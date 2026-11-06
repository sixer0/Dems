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
import { derived, fontFamily, palette, radius, spacing, typography, type StatusTone } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media';
import { LOCAL_STATE_TONE } from '@/features/capture-selector/capture-notices-model';
import { DevelopmentSourceBadge, useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import {
  drawnByOwnTile,
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
import { isDeviceId, rosterTrackStatusOf, STATUS_LABEL_KEY, STATUS_TONE, type DeviceId } from './devices-model';

/** The roster, re-rendering only when a fact of it changes (one flat string from the store). */
export function useRegisteredDevices(): readonly RegisteredDevice[] {
  const line = useSim(rosterLine);
  return useMemo(() => parseRosterLine(line), [line]);
}

export function useRegisteredDevice(deviceId: string | null): RegisteredDevice | null {
  const devices = useRegisteredDevices();
  return deviceId === null ? null : (devices.find((device) => device.id === deviceId) ?? null);
}

/**
 * Audit row 222 (D173; M3-08 domino of row 190): THE SELECTION KEY OF A REGISTERED ROW - what its press puts in
 * `/devices/<key>` and `?selected=<key>`, and what its highlight compares with. A real Core mints its registry ids
 * from the built-in pattern (the bench's CAM-03 on VIDEO-01), so such a device shares its id with a fixed row of
 * the screen (fixed row CAM-03 = the VIDEO-03 line). The plain id stays the fixed row's (its route and its
 * highlight, as before); a registered device whose id is a fixed row's id is keyed `registered.<id>`. Every other
 * registered id (CAM-05, MIC-06) is its own key, as since row 140. The prefix passes `recordIdSchema`.
 */
export const REGISTERED_KEY_PREFIX = 'registered.';

export function registeredSelectionKey(deviceId: string): string {
  return isDeviceId(deviceId) ? `${REGISTERED_KEY_PREFIX}${deviceId}` : deviceId;
}

/** What `/devices/<key>` opens: the fixed row's detail (`builtInId`), a registered device's, or neither (not found). */
export interface DeviceDetailTarget {
  readonly builtInId: DeviceId | null;
  readonly registered: RegisteredDevice | null;
}

/**
 * Audit row 222 (D173): resolve a detail key. A plain fixed-row id opens that fixed row (CAM-01 on its own line,
 * and fixed row CAM-03 = VIDEO-03 even while the Core's CAM-03 stands on VIDEO-01). A `registered.<id>` key opens
 * the Core's device of that id from the roster - unless that device is now back on its OWN line
 * (`drawnByOwnTile`, row 190), where the fixed row draws it, so the fixed row's detail opens. Anything else is the
 * registered roster by its id, else not found.
 */
export function useDeviceDetailTarget(key: string): DeviceDetailTarget {
  const marked = key.startsWith(REGISTERED_KEY_PREFIX);
  const id = marked ? key.slice(REGISTERED_KEY_PREFIX.length) : key;
  const onOwnTile = useSim((s) => {
    const device = s.captureDevices.devices.find((entry) => entry.id === id);
    return device !== undefined && drawnByOwnTile(s.captureConfig, device);
  });
  const builtIn = isDeviceId(id) && (!marked || onOwnTile);
  const registered = useRegisteredDevice(builtIn ? null : id);
  return { builtInId: builtIn && isDeviceId(id) ? id : null, registered };
}

export interface RegisteredDeviceRowsProps {
  kind: RosterKind;
  /** The screen's selection key (`?selected=`); a row is highlighted when it equals the row's `registeredSelectionKey`. */
  selectedId: string | null;
  /** "View device": the screen opens the details of that registered device, by its selection key (row 222). */
  onPress: (selectionKey: string) => void;
}

export function RegisteredDeviceRows({ kind, selectedId, onPress }: RegisteredDeviceRowsProps) {
  const devices = useRegisteredDevices().filter((device) => device.kind === kind);
  if (devices.length === 0) return null;
  return (
    <>
      {devices.map((device) => (
        <Fragment key={device.id}>
          <Separator />
          <RegisteredDeviceRow device={device} selected={registeredSelectionKey(device.id) === selectedId} onPress={onPress} />
        </Fragment>
      ))}
    </>
  );
}

/** The chip tone of a registered device: READY without a checked fact of the Core ("Not checked") is neutral, never green. */
export function registeredStateTone(state: ReturnType<typeof rosterDeviceState>, checked: boolean): (typeof LOCAL_STATE_TONE)[keyof typeof LOCAL_STATE_TONE] | 'default' {
  return state === 'READY' && !checked ? 'default' : LOCAL_STATE_TONE[state];
}

/**
 * THE WORD AND TONE OF A REGISTERED DEVICE'S STATE CHIP (the row and its detail say the same). Audit row 191, B16
 * (D114; the web's `rosterCardStatus` of W2c2): a device ON a line speaks for its TRACK too. When the registry
 * reads it READY but its track is not ready (`rosterTrackStatusOf`: FAULT, OFFLINE, NO SIGNAL, CLIP - row 129's
 * rule over the one source reader), the chip says the track's status, as the fixed row of that track does.
 * Otherwise the registry rule stands: a negative registry fact ("Not reachable") is never replaced, and a ready
 * one reads "Not checked" / "Reachable" by the Core's checked fact (wave L, G70c-02).
 */
export function useRegisteredStateWord(device: RegisteredDevice, local: boolean): { readonly key: string; readonly tone: StatusTone } {
  const track = useSim((s) => rosterTrackStatusOf(s, device.slot));
  const state = rosterDeviceState(device);
  if (state === 'READY' && track !== null) return { key: STATUS_LABEL_KEY[track], tone: STATUS_TONE[track] };
  const checked = sourceChecked(device);
  return { key: sourceStateLabelKey(state, local, checked), tone: registeredStateTone(state, checked) };
}

function RegisteredDeviceRow({ device, selected, onPress }: { device: RegisteredDevice; selected: boolean; onPress: (deviceId: string) => void }) {
  const { t } = useTranslation();
  const { live } = useSourceBadgeMode();
  const name = rosterDeviceName(t, device, live);
  const local = device.adapter === 'LOCAL_DEVICE' && rosterSourceKind(device, live) !== null;
  // Wave L ruling (G70c-02): READY without a checked fact of the Core is "Not checked". Row 191 (B16): on a line, the track's fault too.
  const word = useRegisteredStateWord(device, local);
  const stateText = t(word.key);
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
        onPress={() => onPress(registeredSelectionKey(device.id))}
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
          {/* Fix wave J (JT-12): two lines - "Not assigned · CAM-04" lost the id, the one part that names the device. */}
          <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.detail} testID={`registered-device-used-${device.id}`}>
            {`${usedAs} · ${device.id}`}
          </Text>
          {/* Decided by the Core: no node when it sent no development class, and none in Simulated mode. */}
          {/* Fix wave J (JT-14): the badge takes no touch inside the row - a tap anywhere opens the detail. */}
          <View pointerEvents="none" testID={`registered-device-source-wrap-${device.id}`}>
            <DevelopmentSourceBadge deviceId={device.id} testID={`registered-device-source-${device.id}`} />
          </View>
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
        <ListGroup.ItemSuffix style={styles.suffix} pointerEvents="none">
          {/* Fix wave J (JT-14): ONE colour rule for "Not checked" - neutral, as the detail and the assigned cameras draw it. */}
          <StatusChip size="sm" tone={word.tone} label={stateText} testID={`registered-device-state-${device.id}`} />
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
