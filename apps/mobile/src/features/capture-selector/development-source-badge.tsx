/**
 * The "Development source" badge of the tablet and the phone (task 3, blueprint row 138; ux spec §8f
 * flow 12; specs R-11 AC-2, AC-5, AC-6; decisions D83, D91).
 *
 * ONE component for every surface (§8f.1): the kit `StatusChip`, tone `warning`, an icon AND the
 * text — never colour alone — with the kind beside it ("Core Mac's camera", "Core Mac's microphone",
 * "Test source"; the tablet is not the Mac, OP-125-7). It is never collapsible and never behind a
 * tooltip; when space is short the device name is shortened, the badge stays.
 *
 * Decided by the Core (`developmentSourceOf`): the badge is drawn only from a `sourceClass` the Core
 * sent on the device (`captureDevices` slice, operation 77), only in Live mode and only while the
 * Core's demo flag is off. A device that carries no `sourceClass` draws NOTHING — no placeholder,
 * no wrapper. The client has no development switch, no filter and no local rule.
 */
import { FlaskConical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { useMobileLive } from '@/runtime';
import { developmentSourceOf, type DevelopmentSourceKind } from './capture-notices-model';

/** Whether this client may draw the badge at all: Live data, and a Core that does not run SIMULATED (D91). */
export function useSourceBadgeMode(): { readonly live: boolean; readonly demoControls: boolean } {
  const live = useMobileLive();
  return { live: live !== null, demoControls: live?.session?.demoControls === true };
}

/** The badge kind of a registered capture device, or null (unknown device, no `sourceClass`, Simulated mode). */
export function useDevelopmentSource(deviceId: string | null): DevelopmentSourceKind | null {
  const mode = useSourceBadgeMode();
  // A flat string, so the selector result compares by value (F74-13).
  const facts = useSim((s) => {
    const device = deviceId === null ? undefined : s.captureDevices.devices.find((candidate) => candidate.id === deviceId);
    return device === undefined ? '' : `${device.sourceClass ?? ''}|${device.adapter ?? ''}|${device.kind}`;
  });
  if (facts === '') return null;
  const [sourceClass = '', adapter = '', deviceKind = ''] = facts.split('|');
  return developmentSourceOf({ sourceClass: sourceClass === '' ? undefined : sourceClass, adapter: adapter === '' ? undefined : adapter, deviceKind, ...mode });
}

export interface SourceBadgeProps {
  kind: DevelopmentSourceKind;
  testID?: string;
}

/** The presentational badge: chip (icon + "Development source") and the kind text. */
export function SourceBadge({ kind, testID = 'development-source' }: SourceBadgeProps) {
  const { t } = useTranslation();
  const badge = t('features.capture-selector.source.badge');
  const kindText = t(`features.capture-selector.source.kind.${kind}`);
  return (
    <View style={styles.row} testID={testID} accessible accessibilityLabel={t('features.capture-selector.source.label', { badge, kind: kindText })}>
      <StatusChip size="sm" tone="warning" label={badge} icon={FlaskConical} testID={`${testID}-chip`} />
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.kind} testID={`${testID}-kind`}>
        {kindText}
      </Text>
    </View>
  );
}

export interface DevelopmentSourceBadgeProps {
  /** The registered capture device (`CAM-01`, `MIC-02`, `CAM-03`, …); null draws nothing. */
  deviceId: string | null;
  testID?: string;
}

/** The badge of a registered capture device; renders nothing when the Core sent no development class. */
export function DevelopmentSourceBadge({ deviceId, testID }: DevelopmentSourceBadgeProps) {
  const kind = useDevelopmentSource(deviceId);
  if (kind === null) return null;
  return <SourceBadge kind={kind} testID={testID ?? `development-source-${deviceId ?? 'none'}`} />;
}

/**
 * The capture device a pre-check row is about (ux §8f.2 "Pre-check"): the camera behind the row's
 * video track, or the microphone that holds the row's role or input — read from the open session's
 * own selector snapshot when it holds one, else from the Core's current selector. Null for any other
 * check (Core, storage, time, security).
 */
export function precheckDeviceOf(
  checkId: string,
  selector: { readonly cameras: readonly { trackId: string; deviceId: string }[]; readonly mics: readonly { inputId: string; role: string; deviceId: string }[] },
): string | null {
  switch (checkId) {
    case 'LENS_1':
      return selector.cameras.find((line) => line.trackId === 'VIDEO-01')?.deviceId ?? null;
    case 'LENS_2':
      return selector.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId ?? null;
    case 'MIC_PRIMARY':
      return selector.mics.find((line) => line.role === 'PRIMARY')?.deviceId ?? null;
    case 'MIC_STANDBY':
      return selector.mics.find((line) => line.role === 'STANDBY')?.deviceId ?? null;
    case 'MIC_1':
      return selector.mics.find((line) => line.inputId === 'MIC-01')?.deviceId ?? null;
    case 'MIC_2':
      return selector.mics.find((line) => line.inputId === 'MIC-02')?.deviceId ?? null;
    default:
      return null;
  }
}

/** The badge of a pre-check row (Session New, MB-02); nothing for a check that is about no capture device. */
export function PrecheckSourceBadge({ checkId }: { checkId: string }) {
  const deviceId = useSim((s) => precheckDeviceOf(checkId, s.session?.captureConfig ?? s.captureConfig));
  return <DevelopmentSourceBadge deviceId={deviceId} testID={`session-new-check-${checkId}-source`} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  kind: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
});
