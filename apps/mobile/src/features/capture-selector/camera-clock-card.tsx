/**
 * Camera clock rows on Network & Time (task 3, blueprint row 68; register MB-10;
 * `masterplan/03_api_contract.md` §3 op 57: `getTimeStatus` adds `cameraOffsets`, the camera clock
 * minus the Core clock as adapter telemetry reported it).
 *
 * WHAT IS REAL AND WHAT IS A SEAM (said plainly):
 *
 * | Part | State |
 * |---|---|
 * | One row per configured camera | REAL: the cameras of the replicated `captureConfig` slice (`cameraClockRows`), so the rows follow the device selector at once |
 * | The offset value | SEAM: `useCameraOffsets()` returns no record today, so every row reads "Not reported yet" — never `0 ms`, which would claim a measurement |
 *
 * Why a seam and not a read of operation 57: the offsets are a member of op 57's answer only; no
 * replicated slice carries them, and no adapter reports one yet (the member is optional in the
 * contract, "absent until then"). This screen is held to the replica — `live-network-time.test.tsx`
 * pins "no read of operations 56 and 57, no request beyond the runtime's own" — so a request of its
 * own here would break an existing rule. The decision is the controller's (see
 * `implementation/28_m4_mobile_selector.md`): either the offsets join the replicated `time` slice
 * (then `useCameraOffsets` becomes one `useSim` line), or that pin is lifted for one read of op 57.
 *
 * No client clock: the card computes no time of its own.
 */
import { ListGroup, Separator } from 'heroui-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim } from '@dems/shared/sim';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { cameraClockRows, signedOffset, type CameraOffsetRecord } from '@/features/network-time/network-time-model';

const NO_OFFSETS: readonly CameraOffsetRecord[] = [];

/**
 * SEAM (to wire when the offsets have a replicated source, see the header): the camera clock offset
 * records the Core holds. Today: none.
 */
export function useCameraOffsets(): readonly CameraOffsetRecord[] {
  return NO_OFFSETS;
}

export function CameraClockCard() {
  const { t } = useTranslation();
  // A flat string (F74-13): `CAM-01|CAM-02`.
  const configured = useSim((s) => s.captureConfig.cameras.map((line) => line.deviceId).join('|'));
  const offsets = useCameraOffsets();
  const rows = cameraClockRows(configured === '' ? [] : configured.split('|'), offsets);

  return (
    <SectionCard
      testID="network-time-camera-clocks"
      title={t('features.capture-selector.cameraClocks.title')}
      description={t('features.capture-selector.cameraClocks.subtitle')}
    >
      {rows.length === 0 ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID="network-time-camera-clocks-none">
          {t('features.capture-selector.cameraClocks.none')}
        </Text>
      ) : (
        <ListGroup variant="transparent" className="rounded-xl">
          {rows.map((row, index) => {
            const value =
              row.offsetMs === null
                ? t('features.capture-selector.cameraClocks.notReported')
                : t('features.capture-selector.cameraClocks.offset', { value: signedOffset(row.offsetMs) });
            return (
              <Fragment key={row.deviceId}>
                {index > 0 ? <Separator /> : null}
                <ListGroup.Item
                  testID={`network-time-camera-clock-${row.deviceId}`}
                  accessible
                  accessibilityLabel={t('features.capture-selector.cameraClocks.rowLabel', { device: row.deviceId, value })}
                  className="gap-3 py-2"
                >
                  <View style={styles.fixedContent}>
                    <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.label}>
                      {row.deviceId}
                    </Text>
                  </View>
                  <ListGroup.ItemSuffix style={styles.suffix}>
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[styles.value, row.offsetMs === null ? styles.valueMuted : null]}
                      testID={`network-time-camera-clock-${row.deviceId}-value`}
                    >
                      {value}
                    </Text>
                  </ListGroup.ItemSuffix>
                </ListGroup.Item>
              </Fragment>
            );
          })}
        </ListGroup>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  // A plain View, as in `features/network-time/time-sync-card.tsx`: the kit's item content would collapse a non-growing label.
  fixedContent: { flexShrink: 0 },
  label: { fontFamily: fontFamily.native.mono, fontSize: 13, lineHeight: typography.body.lineHeight, color: palette.gray },
  suffix: { flex: 1, alignItems: 'flex-end' },
  value: { fontFamily: fontFamily.native.monoMedium, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground, textAlign: 'right' },
  valueMuted: { fontFamily: fontFamily.native.normal, color: palette.gray },
  muted: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.gray },
});
