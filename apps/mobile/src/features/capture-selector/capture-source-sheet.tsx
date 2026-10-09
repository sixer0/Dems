/**
 * The edit sheet of one selector field (task 3, blueprint row 68; ux spec §2.6 "Edit affordance":
 * a bottom sheet per field on the tablet, a full-height sheet per field on the phone).
 *
 * | Field | Options | Operation on Save |
 * |---|---|---|
 * | the camera of a video track | every REGISTERED camera (`cameraOptions`; a search candidate is never one, PE-125-04) | 79 `setCaptureCameraSource` |
 * | the primary microphone | the two inputs | 80 `setPrimaryMic` (the other becomes STANDBY in the same republish) |
 *
 * The sheet is portalled above the simulator's provider, so it reads no store: the options and the
 * current choice come in as props, and Save hands the command to the caller, which holds the port.
 * A choice is a draft until Save (G1 "open/save"); Save is disabled while the draft equals what the
 * Core holds, and marked busy from the press until the command settled (LB-1).
 *
 * E-15: every option row keeps a 1 dp border in both selection states (`ROW_CARD_BORDER`) and the
 * always-mounted, React-drawn `SelectionGlow`; choosing an option mounts nothing and changes colours
 * only. OD-12: an option is text and a status word, never a frame.
 */
import { BottomSheet, Button, ListGroup } from 'heroui-native';
import { Camera, Mic } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import type { VideoTrackId } from '@dems/shared/domain';
import { fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { REDUCED_FADE_MS, useMotionPolicy } from '@/motion';
import { PendingSpinner, busyState } from '@/runtime';
import { developmentSourceOf, type DevelopmentSourceKind } from './capture-notices-model';
import { cameraLineStatus, type CameraOption, type MicSelectorRow, type SelectorCommand } from './capture-selector-model';
import { SourceBadge } from './development-source-badge';
import { SheetContentSignal, useSheetPresence } from '@/features/devices/use-sheet-presence';

/** Task 3 row 138 (flow 12; D91): handed in as plain values — the sheet is portalled, so it reads no store itself. */
export interface SourceBadgeMode {
  readonly live: boolean;
  readonly demoControls: boolean;
}

export type SourceSheetRequest =
  | { readonly kind: 'camera'; readonly trackId: VideoTrackId; readonly currentDeviceId: string; readonly options: readonly CameraOption[]; readonly badgeMode?: SourceBadgeMode }
  | { readonly kind: 'primaryMic'; readonly currentInputId: string | null; readonly inputs: readonly MicSelectorRow[]; readonly badgeMode?: SourceBadgeMode };

const NO_BADGE: SourceBadgeMode = { live: false, demoControls: false };

export interface CaptureSourceSheetProps {
  /** The field to edit, or null when closed. */
  request: SourceSheetRequest | null;
  /** Phone: a full-height sheet (§2.6). */
  fullHeight: boolean;
  /** The command is out. */
  busy: boolean;
  /** It has been out long enough for the kit's spinner. */
  pending: boolean;
  onSave: (command: SelectorCommand) => void;
  onClose: () => void;
}

const STREAM_TONE = { LIVE: 'success', LOST: 'danger', OFFLINE: 'warning' } as const;

export function CaptureSourceSheet({ request, fullHeight, busy, pending, onSave, onClose }: CaptureSourceSheetProps) {
  const reduced = useMotionPolicy() === 'reduced';
  const presence = useSheetPresence(request !== null);
  // The last request stays drawn while the sheet closes.
  const [shown, setShown] = useState<SourceSheetRequest | null>(request);
  if (request !== null && request !== shown) setShown(request);
  if (!presence.mounted || shown === null) return null;
  const close = () => {
    // The answer closes the sheet while the command is out.
    if (busy) return;
    onClose();
  };
  return (
    <BottomSheet isOpen={presence.open} onOpenChange={(open) => (open ? undefined : close())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          {...(fullHeight ? { snapPoints: ['92%'], enableDynamicSizing: false, enableOverDrag: false } : {})}
          overrideReduceMotion={ReduceMotion.Never}
          {...(reduced ? { animationConfigs: { duration: REDUCED_FADE_MS } } : {})}
        >
          <SheetContentSignal onChange={presence.setContentMounted}>
            <SheetBody key={shown.kind === 'camera' ? shown.trackId : 'MIC'} request={shown} busy={busy} pending={pending} onSave={onSave} onClose={close} />
          </SheetContentSignal>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

interface SheetBodyProps {
  request: SourceSheetRequest;
  busy: boolean;
  pending: boolean;
  onSave: (command: SelectorCommand) => void;
  onClose: () => void;
}

function SheetBody({ request, busy, pending, onSave, onClose }: SheetBodyProps) {
  const { t } = useTranslation();
  const current = request.kind === 'camera' ? request.currentDeviceId : request.currentInputId;
  const [draft, setDraft] = useState<string | null>(current);
  const unchanged = draft === null || draft === current;
  const track = request.kind === 'camera' ? t(`features.capture-selector.selector.track.${request.trackId}`) : '';

  const save = () => {
    if (unchanged || busy || draft === null) return;
    if (request.kind === 'camera') onSave({ kind: 'camera', trackId: request.trackId, deviceId: draft });
    else onSave({ kind: 'primaryMic', inputId: draft });
  };

  return (
    <View testID="capture-source-sheet">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <BottomSheet.Title>
            {request.kind === 'camera' ? t('features.capture-selector.selector.sheet.cameraTitle', { track }) : t('features.capture-selector.selector.sheet.micTitle')}
          </BottomSheet.Title>
          <BottomSheet.Description>
            {request.kind === 'camera' ? t('features.capture-selector.selector.sheet.cameraBody') : t('features.capture-selector.selector.sheet.micBody')}
          </BottomSheet.Description>
        </View>
        <BottomSheet.Close accessibilityLabel={t('features.capture-selector.selector.sheet.close')} testID="capture-source-close" onPress={onClose} />
      </View>
      <ListGroup variant="transparent" accessibilityRole="radiogroup">
        {request.kind === 'camera'
          ? request.options.map((option) => {
              const status = cameraLineStatus({ online: option.online, streamState: option.streamState ?? 'LIVE' });
              return (
                <OptionRow
                  key={option.deviceId}
                  id={option.deviceId}
                  icon="camera"
                  title={option.deviceId}
                  detail={[
                    option.model,
                    option.assignedTo === null ? null : t('features.capture-selector.selector.sheet.feeds', { track: t(`features.capture-selector.selector.track.${option.assignedTo}`) }),
                  ]
                    .filter((part): part is string => part !== null && part !== '')
                    .join(' · ')}
                  chip={<StatusChip size="sm" tone={STREAM_TONE[status]} label={t(`features.capture-selector.selector.stream.${status}`)} icon={null} />}
                  source={developmentSourceOf({ sourceClass: option.sourceClass ?? undefined, adapter: option.adapter ?? undefined, deviceKind: 'CAMERA', ...(request.badgeMode ?? NO_BADGE) })}
                  selected={draft === option.deviceId}
                  disabled={busy}
                  onPress={setDraft}
                />
              );
            })
          : request.inputs.map((input) => (
              <OptionRow
                key={input.inputId}
                id={input.inputId}
                icon="mic"
                title={input.inputId}
                detail={[input.model, input.transport].filter((part): part is string => part !== null && part !== '').join(' · ')}
                source={developmentSourceOf({ sourceClass: input.sourceClass ?? undefined, adapter: input.adapter ?? undefined, deviceKind: 'MIC', ...(request.badgeMode ?? NO_BADGE) })}
                chip={
                  <StatusChip
                    size="sm"
                    tone={input.role === 'PRIMARY' ? 'success' : 'default'}
                    label={t(`features.capture-selector.selector.role.${input.role}`)}
                    icon={null}
                  />
                }
                selected={draft === input.inputId}
                disabled={busy}
                onPress={setDraft}
              />
            ))}
      </ListGroup>
      <View style={styles.actions}>
        <Button variant="outline" isDisabled={busy} onPress={onClose} testID="capture-source-cancel">
          <Button.Label>{t('common.actions.cancel')}</Button.Label>
        </Button>
        <Button variant="primary" isDisabled={unchanged && !busy} onPress={save} testID="capture-source-save" {...busyState(busy, unchanged)}>
          {pending ? <PendingSpinner color={palette.black} testID="capture-source-spinner" /> : null}
          <Button.Label>{t('features.capture-selector.selector.sheet.save')}</Button.Label>
        </Button>
      </View>
    </View>
  );
}

interface OptionRowProps {
  id: string;
  icon: 'camera' | 'mic';
  title: string;
  detail: string;
  chip: React.ReactNode;
  /** The "Development source" badge of the option, or null / left out for none. */
  source?: DevelopmentSourceKind | null;
  selected: boolean;
  disabled: boolean;
  onPress: (id: string) => void;
}

function OptionRow({ id, icon, title, detail, chip, source = null, selected, disabled, onPress }: OptionRowProps) {
  const Icon = icon === 'camera' ? Camera : Mic;
  return (
    <View style={styles.wrap}>
      <ListGroup.Item
        testID={`capture-source-option-${id}`}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={detail === '' ? title : `${title}, ${detail}`}
        disabled={disabled}
        onPress={() => onPress(id)}
        style={[styles.item, selected ? styles.itemSelected : null]}
      >
        <ListGroup.ItemPrefix>
          <Icon size={20} color={selected ? palette.gold : palette.gray} />
        </ListGroup.ItemPrefix>
        <ListGroup.ItemContent style={styles.content}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {detail === '' ? null : (
            <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.detail}>
              {detail}
            </Text>
          )}
          {/* Flow 12: the one badge, on each option; nothing when the Core sent no development class. */}
          {source === null ? null : <SourceBadge kind={source} testID={`capture-source-badge-${id}`} />}
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix>{chip}</ListGroup.ItemSuffix>
      </ListGroup.Item>
      {/* E-15 (W93-4): always mounted, last; React sets its opacity. */}
      <SelectionGlow selected={selected} radius={radius.px.lg} testID={`capture-source-glow-${id}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[2] },
  headerText: { flex: 1, gap: spacing[0] },
  wrap: { position: 'relative', marginBottom: spacing[1] },
  item: { borderRadius: radius.px.lg, paddingVertical: spacing[1], paddingHorizontal: spacing[1], gap: spacing[2], ...ROW_CARD_BORDER },
  itemSelected: { borderColor: palette.gold, backgroundColor: withAlpha(palette.gold, 0.06) },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamily.native.monoMedium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  detail: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[1], marginTop: spacing[2], marginBottom: spacing[2] },
});
