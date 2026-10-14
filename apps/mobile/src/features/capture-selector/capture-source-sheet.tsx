/**
 * The edit sheet of one selector field (task 3, blueprint row 68; ux spec §2.6 "Edit affordance":
 * a bottom sheet per field on the tablet, a full-height sheet per field on the phone).
 *
 * | Field | Options | Operation on Save |
 * |---|---|---|
 * | the camera of a video track | every REGISTERED camera (`cameraOptions`; a search candidate is never one, PE-125-04) | 79 `setCaptureCameraSource` |
 * | the microphone of the PRIMARY or of the STANDBY line (fix wave H, G70-02; ruling D196) | every REGISTERED microphone (`micOptions`) | `micLineCommand`: 80 `setPrimaryMic` when the two lines trade roles; 78 `updateCaptureConfig` (pair replacement, D133 (1)) for a microphone that is on no line. The primary microphone is refused on the standby line (`micOptionRefusal`): the option is disabled and says why |
 *
 * The sheet is portalled above the simulator's provider, so it reads no store: the options and the
 * current choice come in as props, and Save hands the command to the caller, which holds the port.
 * A choice is a draft until Save (G1 "open/save"); Save is disabled while the draft equals what the
 * Core holds, and marked busy from the press until the command settled (LB-1).
 *
 * E-15: every option row keeps a 1 dp border in both selection states (`ROW_CARD_BORDER`) and the
 * always-mounted, React-drawn `SelectionGlow`; choosing an option mounts nothing and changes colours
 * only. OD-12: an option is text and a status word, never a frame.
 *
 * Fix wave L:
 * - G70c-02: on a Core in REAL capture the status word of a camera option is what the Core REPORTED
 *   for that device (`reported`: "Reachable" / "Not reachable" / "Not checked" / "On"), handed in by
 *   the caller. "Live" / "Lost" stand only for a camera that feeds a track while a session RECORDS
 *   (`streamApplies`): a camera nobody opened is never "Live". The simulated Core keeps its words.
 * - G70c-03: THE WHOLE ROW is the target. The badge chip and the status chip are kit chips, which are
 *   pressables of their own: inside an option they take no touch (`pointerEvents="none"`), so a tap
 *   anywhere on the row selects it.
 */
import { BottomSheet, Button, ListGroup } from 'heroui-native';
import { Camera, Mic } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import type { MicRole, VideoTrackId } from '@dems/shared/domain';
import { fontFamily, palette, radius, spacing, typography, type StatusTone } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { REDUCED_FADE_MS, useMotionPolicy } from '@/motion';
import { PendingSpinner, busyState } from '@/runtime';
import { cameraAssignmentOf, profileWords, type CameraAssignment } from './camera-profile';
import { developmentSourceOf, type DevelopmentSourceKind } from './capture-notices-model';
import { cameraLineStatus, micLineCommand, micOptionRefusal, type CameraOption, type MicOption, type SelectorCommand } from './capture-selector-model';
import { MicrophoneLimitLine, SourceBadge } from './development-source-badge';
import { SheetContentSignal, useSheetBack, useSheetPresence } from '@/features/devices/use-sheet-presence';
import { useConfirmedOpen } from '@/lib/sheet-open';

/** Task 3 row 138 (flow 12; D131): handed in as a plain value — the sheet is portalled, so it reads no store itself. */
export interface SourceBadgeMode {
  readonly live: boolean;
}

/** What the Core reported for one registered camera, as the selector words it (`sourceStateWord`): an i18n key and a tone. */
export interface ReportedOptionState {
  readonly key: string;
  readonly tone: StatusTone;
}

export type SourceSheetRequest =
  | {
      readonly kind: 'camera';
      readonly trackId: VideoTrackId;
      /** The camera the track holds; null for a slot that is not assigned (task 4 row 32): no option is the current one. */
      readonly currentDeviceId: string | null;
      readonly options: readonly CameraOption[];
      readonly badgeMode?: SourceBadgeMode;
      /**
       * Wave L (G70c-02): present on a Core in REAL capture - the reported state of every registered camera,
       * by device id. Absent (simulated Core): the options keep the stream words.
       */
      readonly reported?: Readonly<Record<string, ReportedOptionState>>;
      /** Wave L (G70c-02): a session of the Core is RECORDING, so "Live" / "Lost" are true of the cameras ON a track. */
      readonly recording?: boolean;
    }
  | { readonly kind: 'mic'; readonly role: MicRole; readonly currentInputId: string | null; readonly options: readonly MicOption[]; readonly badgeMode?: SourceBadgeMode };

const NO_BADGE: SourceBadgeMode = { live: false };

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
  const close = () => {
    // The answer closes the sheet while the command is out.
    if (busy) return;
    onClose();
  };
  // Fix wave J (JA2-16): Android Back closes the picker and stays on the screen (not while a command is out).
  useSheetBack(request !== null, close);
  // Fix wave J round two (JM-02 is the app's, not only the Evidence sheets'): the open is confirmed, and asked again when the sheet library dropped it.
  const confirmed = useConfirmedOpen(presence.open, close, { testID: 'capture-source-sheet' });
  if (!presence.mounted || shown === null) return null;
  return (
    <BottomSheet isOpen={confirmed.kitOpen} onOpenChange={(open) => (open ? undefined : close())}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content onAnimate={confirmed.onAnimate}
          {...(fullHeight ? { snapPoints: ['92%'], enableDynamicSizing: false, enableOverDrag: false } : {})}
          overrideReduceMotion={ReduceMotion.Never}
          {...(reduced ? { animationConfigs: { duration: REDUCED_FADE_MS } } : {})}
        >
          <SheetContentSignal onChange={presence.setContentMounted}>
            <SheetBody key={shown.kind === 'camera' ? shown.trackId : shown.role} request={shown} busy={busy} pending={pending} onSave={onSave} onClose={close} />
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
  const track = request.kind === 'camera' ? t(`features.capture-selector.selector.track.${request.trackId}`) : '';
  // What Save would send; null when the draft is what the Core holds, or a choice the selector refuses.
  // Task 4 row W5 (review 060d Q-02; decision C36; `camera-profile.ts`): a PRODUCTION camera on a Core in real capture
  // is assigned with one of its STORED stream profiles - offered with what each is, chosen by the operator, sent with
  // the assignment. Any other camera (`PLAIN`) is assigned exactly as before. `reported` is present on a Core in real capture.
  const draftCamera = request.kind === 'camera' && draft !== null ? request.options.find((option) => option.deviceId === draft) : undefined;
  const heldProfile = request.kind === 'camera' && draftCamera !== undefined && draftCamera.assignedTo === request.trackId ? (draftCamera.lineProfile ?? null) : null;
  const assignment: CameraAssignment =
    request.kind === 'camera' && draftCamera !== undefined
      ? cameraAssignmentOf({ realCapture: request.reported !== undefined, adapter: draftCamera.adapter, profiles: draftCamera.profiles ?? [], heldProfile })
      : { kind: 'PLAIN' };
  // The operator's own choice of a profile, for the camera it was made for; another camera starts from its own preselection.
  const [profileDraft, setProfileDraft] = useState<{ readonly deviceId: string; readonly profile: string } | null>(null);
  const profile =
    assignment.kind !== 'CHOOSE'
      ? null
      : profileDraft !== null && profileDraft.deviceId === draft && assignment.profiles.includes(profileDraft.profile)
        ? profileDraft.profile
        : assignment.preselected;
  const cameraCommand = (trackId: VideoTrackId, deviceId: string): SelectorCommand | null => {
    if (assignment.kind === 'PLAIN') return deviceId === current ? null : { kind: 'camera', trackId, deviceId };
    // Nothing is sent for a production camera without a chosen profile: the Core would refuse it and never picks one.
    if (assignment.kind === 'NO_PROFILE' || profile === null) return null;
    // The camera the track holds with the profile it holds: no change. Another of its profiles is an edit.
    return deviceId === current && profile === heldProfile ? null : { kind: 'camera', trackId, deviceId, profile };
  };
  const command: SelectorCommand | null =
    draft === null
      ? null
      : request.kind === 'camera'
        ? cameraCommand(request.trackId, draft)
        : draft === current
          ? null
          : micLineCommand(request.role, draft, { mics: request.options.flatMap((option) => (option.role === null ? [] : [{ inputId: option.deviceId, role: option.role }])) });
  const unchanged = command === null;
  const sheetKey = request.kind === 'camera' ? 'camera' : request.role === 'PRIMARY' ? 'mic' : 'standbyMic';

  const save = () => {
    if (command === null || busy) return;
    onSave(command);
  };

  return (
    <View testID="capture-source-sheet" accessibilityViewIsModal>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <BottomSheet.Title>
            {t(`features.capture-selector.selector.sheet.${sheetKey}Title`, { track })}
          </BottomSheet.Title>
          <BottomSheet.Description>
            {t(`features.capture-selector.selector.sheet.${sheetKey}Body`)}
          </BottomSheet.Description>
        </View>
        <BottomSheet.Close accessibilityLabel={t('features.capture-selector.selector.sheet.close')} testID="capture-source-close" onPress={onClose} />
      </View>
      <ListGroup variant="transparent" accessibilityRole="radiogroup" accessibilityLabel={t(`features.capture-selector.selector.sheet.${sheetKey}Title`, { track })}>
        {request.kind === 'camera'
          ? request.options.map((option) => {
              const status = cameraLineStatus({ online: option.online, streamState: option.streamState ?? 'LIVE' });
              // Fix wave J (JA2-24): the camera that feeds the OTHER track says so before it is chosen.
              const otherTrack = option.assignedTo !== null && option.assignedTo !== request.trackId ? option.assignedTo : null;
              const word = cameraOptionWord({ reported: request.reported?.[option.deviceId] ?? null, realCapture: request.reported !== undefined, recording: request.recording === true, onTrack: option.assignedTo !== null });
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
                  chip={
                    word === 'STREAM' ? (
                      <StatusChip size="sm" tone={STREAM_TONE[status]} label={t(`features.capture-selector.selector.stream.${status}`)} icon={null} testID={`capture-source-state-${option.deviceId}`} />
                    ) : word === null ? null : (
                      <StatusChip size="sm" tone={word.tone} label={t(word.key)} icon={null} testID={`capture-source-state-${option.deviceId}`} />
                    )
                  }
                  source={developmentSourceOf({ sourceClass: option.sourceClass ?? undefined, adapter: option.adapter ?? undefined, deviceKind: 'CAMERA', ...(request.badgeMode ?? NO_BADGE) })}
                  warning={otherTrack === null ? null : t('features.capture-selector.selector.sheet.inUseByOtherTrack', { track: t(`features.capture-selector.selector.track.${otherTrack}`) })}
                  selected={draft === option.deviceId}
                  disabled={busy}
                  onPress={setDraft}
                />
              );
            })
          : request.options.map((option) => {
              const refusal = micOptionRefusal(request.role, option);
              return (
                <OptionRow
                  key={option.deviceId}
                  id={option.deviceId}
                  icon="mic"
                  title={option.deviceId}
                  detail={[option.model, option.online ? null : t('features.capture-selector.selector.stream.OFFLINE')].filter((part): part is string => part !== null && part !== '').join(' · ')}
                  source={developmentSourceOf({ sourceClass: option.sourceClass ?? undefined, adapter: option.adapter ?? undefined, deviceKind: 'MIC', ...(request.badgeMode ?? NO_BADGE) })}
                  chip={
                    <StatusChip
                      size="sm"
                      tone={option.role === 'PRIMARY' ? 'success' : 'default'}
                      label={option.role === null ? t('features.capture-selector.selector.sheet.notAssigned') : t(`features.capture-selector.selector.role.${option.role}`)}
                      icon={null}
                    />
                  }
                  refusal={refusal === null ? null : t(`features.capture-selector.selector.sheet.refusal.${refusal}`)}
                  selected={draft === option.deviceId}
                  disabled={busy || refusal !== null}
                  onPress={setDraft}
                />
              );
            })}
      </ListGroup>
      {/* Row W5 (Q-02): the stored stream profiles of the chosen production camera, each by what it is. ONE stored
          profile is preselected and still shown; for a camera the Core holds no profile for, the sentence says why. */}
      {assignment.kind === 'PLAIN' || draft === null ? null : (
        <View testID="capture-source-profiles" style={styles.profiles}>
          <Text maxFontSizeMultiplier={1.2} style={styles.title}>
            {t('features.capture-selector.selector.cameraProfile.title')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={assignment.kind === 'NO_PROFILE' ? styles.warning : styles.detail} testID="capture-source-profile-hint">
            {assignment.kind === 'NO_PROFILE'
              ? t('features.capture-selector.selector.cameraProfile.none')
              : assignment.profiles.length === 1
                ? t('features.capture-selector.selector.cameraProfile.one')
                : t('features.capture-selector.selector.cameraProfile.choose', { count: assignment.profiles.length })}
          </Text>
          {assignment.kind === 'CHOOSE' ? (
            <ListGroup variant="transparent" accessibilityRole="radiogroup" accessibilityLabel={t('features.capture-selector.selector.cameraProfile.title')}>
              {assignment.profiles.map((code) => (
                <OptionRow
                  key={code}
                  id={code}
                  testID={`capture-source-profile-${code}`}
                  icon="camera"
                  title={profileWords(t, code)}
                  detail=""
                  chip={null}
                  selected={profile === code}
                  disabled={busy}
                  onPress={(chosen) => setProfileDraft({ deviceId: draft, profile: chosen })}
                />
              ))}
            </ListGroup>
          ) : null}
        </View>
      )}
      <View style={styles.actions}>
        <Button variant="outline" isDisabled={busy} onPress={onClose} testID="capture-source-cancel">
          <Button.Label>{t('common.actions.cancel')}</Button.Label>
        </Button>
        <Button variant="primary" isDisabled={unchanged && !busy} onPress={save} testID="capture-source-save" accessibilityLabel={t('features.capture-selector.selector.sheet.save')} {...busyState(busy, unchanged)}>
          {pending ? <PendingSpinner color={palette.black} testID="capture-source-spinner" /> : null}
          <Button.Label>{t('features.capture-selector.selector.sheet.save')}</Button.Label>
        </Button>
      </View>
    </View>
  );
}

/**
 * The status word of a camera option (wave L, G70c-02). `'STREAM'`: the stream words apply (a
 * simulated Core; or a camera ON a track while a session records). Otherwise the Core's reported
 * state of the device, or `null` when the Core in real capture reported nothing for it (no chip:
 * nothing is said rather than a constant).
 */
export function cameraOptionWord(input: { readonly reported: ReportedOptionState | null; readonly realCapture: boolean; readonly recording: boolean; readonly onTrack: boolean }): 'STREAM' | ReportedOptionState | null {
  if (!input.realCapture) return 'STREAM';
  if (input.recording && input.onTrack) return 'STREAM';
  return input.reported;
}

interface OptionRowProps {
  id: string;
  icon: 'camera' | 'mic';
  title: string;
  detail: string;
  chip: React.ReactNode;
  /** The "Development source" badge of the option, or null / left out for none. */
  source?: DevelopmentSourceKind | null;
  /** Why this option cannot be chosen, as a sentence (the row is disabled with it); null / left out when it can. */
  refusal?: string | null;
  /** What the operator must know BEFORE choosing this option (it stays choosable); null / left out for none. */
  warning?: string | null;
  selected: boolean;
  disabled: boolean;
  onPress: (id: string) => void;
  /** Row W5: the test id of a row that is no source (a stream profile); default `capture-source-option-<id>`. */
  testID?: string;
}

function OptionRow({ id, icon, title, detail, chip, source = null, refusal = null, warning = null, selected, disabled, onPress, testID }: OptionRowProps) {
  const Icon = icon === 'camera' ? Camera : Mic;
  const hint = refusal ?? warning;
  return (
    <View style={styles.wrap}>
      <ListGroup.Item
        testID={testID ?? `capture-source-option-${id}`}
        accessibilityRole="radio"
        // Fix wave J (JA2-16 / N-10): a radio row exposes its CHECKED state (not only `selected`).
        accessibilityState={{ selected, checked: selected, disabled }}
        accessibilityLabel={detail === '' ? title : `${title}, ${detail}`}
        {...(hint === null ? {} : { accessibilityHint: hint })}
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
          {/* Flow 12: the one badge, on each option; nothing when the Core sent no development class.
              G70c-03: the badge's chip is a pressable of the kit - inside the row it takes no touch. */}
          {source === null ? null : (
            <View pointerEvents="none" testID={`capture-source-badge-wrap-${id}`}>
              <SourceBadge kind={source} testID={`capture-source-badge-${id}`} />
            </View>
          )}
          {/* Fix F-M4 (R69-07): the short limit of the Core Mac's microphone, where it is chosen; real capture only (`source` is null in Simulated mode). */}
          {source === 'localMicrophone' ? <MicrophoneLimitLine testID={`capture-source-limit-${id}`} /> : null}
          {/* Fix wave H (G70-02): the reason a disabled option cannot be chosen, in visible text. */}
          {refusal === null ? null : (
            <Text maxFontSizeMultiplier={1.2} style={styles.detail} testID={`capture-source-refusal-${id}`}>
              {refusal}
            </Text>
          )}
          {warning === null ? null : (
            <Text maxFontSizeMultiplier={1.2} style={styles.warning} testID={`capture-source-warning-${id}`}>
              {warning}
            </Text>
          )}
        </ListGroup.ItemContent>
        {/* G70c-03: the status chip takes no touch either - the row is the one target. */}
        <ListGroup.ItemSuffix pointerEvents="none">{chip}</ListGroup.ItemSuffix>
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
  profiles: { marginTop: spacing[1], gap: spacing[1] },
  item: { borderRadius: radius.px.lg, paddingVertical: spacing[1], paddingHorizontal: spacing[1], gap: spacing[2], ...ROW_CARD_BORDER },
  itemSelected: { borderColor: palette.gold, backgroundColor: withAlpha(palette.gold, 0.06) },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamily.native.monoMedium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  detail: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
  warning: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.warning },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[1], marginTop: spacing[2], marginBottom: spacing[2] },
});
