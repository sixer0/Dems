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
 * sent on the device (`captureDevices` slice, operation 77) and only in Live mode. The session's demo
 * flag is NOT read (D131). A device that carries no `sourceClass` draws NOTHING — no placeholder, no
 * wrapper. The client has no development switch, no filter and no local rule.
 *
 * Fix F-M4 (reviews R69-02, R69-07; decision D178; ux spec §8f.3). The badges of the session
 * surfaces carry two more lines, under the badge and from the same Core facts:
 *
 * | Line | Drawn by | When |
 * |---|---|---|
 * | "Core Mac's camera is on" / "Core Mac's microphone is on" — fixed, never dismissable | `PrecheckSourceBadge` (Session New), `TrackSourceBadge` and `MicInputSourceBadge` (Session Live, Home) | the device's `sourceOpen === true` and it is the Core's local device, in Live mode (`sourceOnKeyOf`, the one rule the Devices roster uses too) |
 * | "Not fit for recording yet. ..." (`common.localSourceNotice.microphoneLimit`) | `PrecheckSourceBadge`; the option of the microphone sheet (`MicrophoneLimitLine`) | the device is the Core's local MICROPHONE, in Live mode |
 *
 * `DevelopmentSourceBadge` alone (the Devices rows and details) draws neither: those screens draw
 * their own "is on" line and the full limit text.
 */
import { cameraLinesInForce, micLinesInForce, selectorInForce } from '@/features/capture-selector/selector-in-force';
import { FlaskConical, Radio, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { useMobileLive } from '@/runtime';
import { sourceOnKeyOf } from '@/features/devices/registered-devices-model';
import { developmentSourceOf, type DevelopmentSourceKind } from './capture-notices-model';
import { micInputName } from './mic-input-name';

/** Whether this client shows a Core server's data (Live mode): the one fact the badge needs beside `sourceClass` (D131). */
export function useSourceBadgeMode(): { readonly live: boolean } {
  return { live: useMobileLive() !== null };
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

/**
 * The key of the "is on" line of a registered capture device, or null (fix F-M4, R69-02): the Core
 * sent `sourceOpen: true` on its own local device, in Live mode. One flat string is read, so the
 * result compares by value (F74-13).
 */
export function useSourceOnKey(deviceId: string | null): string | null {
  const { live } = useSourceBadgeMode();
  const facts = useSim((s) => {
    const device = deviceId === null ? undefined : s.captureDevices.devices.find((candidate) => candidate.id === deviceId);
    return device === undefined || device.sourceOpen !== true ? '' : `${device.sourceClass ?? ''}|${device.adapter ?? ''}|${device.kind}`;
  });
  if (facts === '') return null;
  const [sourceClass = '', adapter = '', deviceKind = ''] = facts.split('|');
  return sourceOnKeyOf({ sourceClass: sourceClass === '' ? undefined : sourceClass, adapter: adapter === '' ? undefined : adapter, deviceKind, sourceOpen: true }, live);
}

/**
 * Names a microphone input from the id the Core sent (integration pass D2, item 5): "MIC 1",
 * "Microphone 3", or "Core Mac's microphone" when the Core says the device behind the id is its
 * local microphone (`micInputName`). The device facts are read as one flat string, so the result
 * compares by value (F74-13) and a meter frame renders nothing.
 */
export function useMicInputName(): (inputId: string) => string {
  const { t } = useTranslation();
  const { live } = useSourceBadgeMode();
  const facts = useSim((s) =>
    s.captureDevices.devices
      .filter((device) => device.kind === 'MIC' && device.sourceClass !== undefined && device.sourceClass !== null)
      .map((device) => `${device.id}|${device.sourceClass ?? ''}|${device.adapter ?? ''}`)
      .join(','),
  );
  return (inputId) => {
    const entry = facts === '' ? undefined : facts.split(',').find((fact) => fact.startsWith(`${inputId}|`));
    const [, sourceClass = '', adapter = ''] = entry === undefined ? [] : entry.split('|');
    const source = entry === undefined ? null : developmentSourceOf({ sourceClass, adapter: adapter === '' ? undefined : adapter, deviceKind: 'MIC', live });
    return micInputName(t, inputId, source);
  };
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

/** The short limit of the Core Mac's microphone (fix F-M4, R69-07): where that microphone is chosen or checked. Plain text, no store read (a sheet may draw it). */
export function MicrophoneLimitLine({ testID }: { testID: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.line} accessibilityRole="text" testID={testID}>
      <TriangleAlert size={14} color={palette.warning} />
      <Text maxFontSizeMultiplier={1.2} style={styles.lineText}>
        {t('common.localSourceNotice.microphoneLimit')}
      </Text>
    </View>
  );
}

export interface DevelopmentSourceBadgeProps {
  /** The registered capture device (`CAM-01`, `MIC-02`, `CAM-03`, …); null draws nothing. */
  deviceId: string | null;
  testID?: string;
  /** Fix F-M4 (R69-02): also draw the fixed "is on" line under the badge (`<testID>-on`). The session surfaces set it; the Devices roster draws its own. */
  onLine?: boolean;
  /** Fix F-M4 (R69-07): also draw the short limit of the Core Mac's microphone (`<testID>-limit`). */
  limitLine?: boolean;
}

/** The badge of a registered capture device; renders nothing when the Core sent no development class. */
export function DevelopmentSourceBadge({ deviceId, testID, onLine = false, limitLine = false }: DevelopmentSourceBadgeProps) {
  const { t } = useTranslation();
  const kind = useDevelopmentSource(deviceId);
  const onKey = useSourceOnKey(onLine ? deviceId : null);
  if (kind === null) return null;
  const id = testID ?? `development-source-${deviceId ?? 'none'}`;
  const limit = limitLine && kind === 'localMicrophone';
  // No line to draw: the badge alone, with no wrapper (as before fix F-M4).
  if (onKey === null && !limit) return <SourceBadge kind={kind} testID={id} />;
  return (
    <View style={styles.stack}>
      <SourceBadge kind={kind} testID={id} />
      {onKey === null ? null : (
        <View style={styles.line} accessibilityRole="text" accessibilityLiveRegion="polite" testID={`${id}-on`}>
          <Radio size={14} color={palette.warning} />
          <Text maxFontSizeMultiplier={1.2} style={styles.lineText}>
            {t(onKey)}
          </Text>
        </View>
      )}
      {limit ? <MicrophoneLimitLine testID={`${id}-limit`} /> : null}
    </View>
  );
}

/**
 * The badge of the camera that feeds a video track now (Session Live camera tile, MB-03; Home tile,
 * MB-01 — ux §8f.2 "Session Monitor tiles"): the line of the open session's selector snapshot, else
 * of the Core's current selector. Nothing is drawn unless the Core sent the development class.
 */
export function TrackSourceBadge({ trackId, testID }: { trackId: string; testID?: string }) {
  const deviceId = useSim((s) => cameraLinesInForce(s).find((line) => line.trackId === trackId)?.deviceId ?? null);
  return <DevelopmentSourceBadge deviceId={deviceId} testID={testID ?? `development-source-${trackId}`} onLine />;
}

/**
 * The badge of the microphone behind an input id (Session Live mic card, Home mic tile): the device
 * of the selector line that holds the input, else the device of the same id (D106 (4): a microphone
 * line's device id IS its input id).
 */
export function MicInputSourceBadge({ inputId, testID }: { inputId: string; testID?: string }) {
  const deviceId = useSim((s) => micLinesInForce(s).find((line) => line.inputId === inputId)?.deviceId ?? inputId);
  return <DevelopmentSourceBadge deviceId={deviceId} testID={testID ?? `development-source-${inputId}`} onLine />;
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
  const deviceId = useSim((s) => precheckDeviceOf(checkId, selectorInForce(s)));
  return <DevelopmentSourceBadge deviceId={deviceId} testID={`session-new-check-${checkId}-source`} onLine limitLine />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  kind: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
  stack: { gap: spacing[0], alignItems: 'flex-start' },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] },
  lineText: { flexShrink: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.warning },
});
