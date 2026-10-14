/**
 * "View device" of a registered device beyond the built-in ids (task 3, R-11, blueprint row 140;
 * ux §8c.3 "View device", §8f.2 `DeviceDetail`): the body of the detail pane / screen, with what the
 * Core's device list says of it and nothing else. No preview, no health line, no log and no command
 * are invented for a device these screens have no simulator view of; no password is entered here
 * (camera passwords are a web-console matter) and no control opens a system setting (R-11 AC-9).
 *
 * For a development source it states the source's LIMIT: the Core Mac's microphone is NOT fit for
 * recording yet (D128), the Core Mac's camera is variable-rate (D136 (3)).
 */
import { Alert } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { KeyValueList, SectionCard, StatusChip, type KeyValueItem } from '@/components/kit';
import { localDeviceSentenceKey } from '@/features/capture-selector/capture-notices-model';
import { DevelopmentSourceBadge, useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { registeredStateTone } from './registered-device-rows';
import { rosterDeviceState, rosterLimitKey, rosterOnKey, rosterSourceKey, rosterSourceKind, sourceChecked, sourceStateLabelKey, type RegisteredDevice } from './registered-devices-model';

export function RegisteredDeviceDetail({ device, header }: { device: RegisteredDevice; header: ReactNode }) {
  const { t } = useTranslation();
  const { live } = useSourceBadgeMode();
  const state = rosterDeviceState(device);
  const local = device.adapter === 'LOCAL_DEVICE' && rosterSourceKind(device, live) !== null;
  const sentenceKey = local ? localDeviceSentenceKey(state, device.kind) : null;
  const onKey = rosterOnKey(device, live);
  const limitKey = rosterLimitKey(device, live);
  const facts: KeyValueItem[] = [
    { id: 'id', label: t('common.developmentRoster.field.id'), value: device.id, mono: true },
    { id: 'kind', label: t('common.developmentRoster.field.kind'), value: t(`common.developmentRoster.kind.${device.kind}`) },
    { id: 'source', label: t('common.developmentRoster.field.source'), value: t(rosterSourceKey(device.adapter)) },
    // What the device announced: shown as a value, never as the name. Closing pass L-Z (the ONE RULE, contract_wave_l.md section 5):
    // `model` of a GENERATED source (`adapter: FAKE`) is a value of the seed dataset or what a fake device announced - the
    // "Source: Generated test source" row above says what it is, and no model row is drawn.
    ...(device.adapter === 'FAKE' ? [] : [{ id: 'model', label: t('common.developmentRoster.field.model'), value: device.model ?? t('common.developmentRoster.modelUnknown') }]),
    // The Core's local device has no address; a network camera's is the host the Core sent.
    ...(local || device.host === null ? [] : [{ id: 'address', label: t('common.developmentRoster.field.address'), value: device.host, mono: true }]),
    { id: 'usedAs', label: t('common.developmentRoster.field.usedAs'), value: t(`common.developmentRoster.usedAs.${device.slot ?? 'NONE'}`) },
    // Row W6 (request lines 566, 569): a camera's null stream state is "Not read" (nobody reads its stream now) - never Live or Lost.
    ...(device.streamState === null && device.kind !== 'CAMERA'
      ? []
      : [{ id: 'stream', label: t('common.developmentRoster.field.stream'), value: device.streamState ?? t('features.capture-selector.selector.stream.NOT_READ') }]),
  ];
  return (
    <View style={styles.root} testID="registered-device-detail">
      {header}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <StatusChip tone={registeredStateTone(state, sourceChecked(device))} label={t(sourceStateLabelKey(state, local, sourceChecked(device)))} testID="registered-detail-state" />
          <Text maxFontSizeMultiplier={1.2} style={styles.deviceId}>
            {device.id}
          </Text>
        </View>
        <DevelopmentSourceBadge deviceId={device.id} testID="registered-detail-source" />
        {onKey === null ? null : (
          <Text maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite" style={styles.warning} testID="registered-detail-on">
            {t(onKey)}
          </Text>
        )}
        {sentenceKey === null ? null : (
          <Text maxFontSizeMultiplier={1.2} style={styles.body} testID="registered-detail-sentence">
            {t(`features.capture-selector.localDevice.${sentenceKey}`)}
          </Text>
        )}
        {device.rateAtLimit ? (
          <Alert status="warning" testID="registered-detail-rate">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('common.developmentRoster.rateAtLimit.title')}</Alert.Title>
              <Alert.Description>{t('common.developmentRoster.rateAtLimit.body')}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        <KeyValueList items={facts} testID="registered-detail-facts" />
        {limitKey === null ? null : <SectionCard title={t('common.developmentRoster.limits.title')} description={t(limitKey)} testID="registered-detail-limits" />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[3], paddingBottom: spacing[4], gap: spacing[3] },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  deviceId: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.gray },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  warning: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.warning },
});
