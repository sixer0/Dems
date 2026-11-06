/**
 * The device selector card (task 3, blueprint row 68, M4-W4; ux spec §2 flow 1; specs R-1; register
 * MB-08, MB-09). One component, mounted on the Devices screen (tablet and phone; the phone reaches it
 * through Settings → Device Settings as well) and in Settings → Capture.
 *
 * | Spec | Here |
 * |---|---|
 * | §2.2 step 1, §2.5 "Loading" | until the runtime has hydrated: the skeleton, and the gate line reads "Checking your permissions…" (a gated read, E-16) |
 * | §2.2 step 2 | four camera rows (D60, 2026-11-04: `VIDEO-01`..`VIDEO-04` → the device behind each, any registered `CAM-NN`) and four microphone rows (D61, 2026-11-04: `MIC-01`..`MIC-04` → the device behind each channel, channel 1 first). Task 4 row 32 (decision C18 (3)): one row per SLOT - a slot the selector holds no line for is drawn "Not assigned" with an "Assign" control that opens the same sheet |
 * | §2.2 step 3, §2.4 G1-G3 | every "Change" control is ALWAYS drawn; outside `allowed` it is disabled and the gate line says why: checking, waiting for the link, "Requires the Supervisor or Technician role", or the OD-10 sentence. Never hidden, never enabled on an unknown role (P-13) |
 * | §2.2 steps 4, 5 | a bottom sheet per field (`CaptureSourceSheet`); nothing is written locally, the row reads "Saving…" until `captureConfig` republishes |
 * | §2.2 step 6, §2.5 | a refusal is drawn in place as an `Alert` (locked, not permitted, unknown device, not accepted, development-only source, capture not ready with a rate-limited Retry, no answer); no toast, no raw error |
 * | §2.5 "Empty device list" | "No capture devices configured"; the "Search for cameras" action is row 138's (slot below) |
 * | E-15 | each row keeps a 1 dp border in both states (`ROW_CARD_BORDER`) with the always-mounted, React-drawn `SelectionGlow`; the row whose sheet is open is the selected one |
 * | OD-12 | status is text and a chip (`Live`, `Lost`, `Offline`); no frame is decoded or shown |
 * | M3-07 R4 (audit row 189; T5-T7, T9) | the slots are grouped as the four pairs `selector-pair-N` "Camera N <-> Mic N"; a microphone row's chip reads "Mic N (Camera N)"; "Transcribed" on Pair 1 only; an incomplete pair says T7 |
 * | M3-07 R1/R2 (audit rows 188/189; S1-S10; D126, D175) | a microphone from another channel is never sent from the sheet: `askMove`, then `MicMoveDialog` (swap S5-S7, move S8-S10); Confirm sends operation 78 once (`confirmMove`), Cancel sends nothing |
 *
 * Task 3 row 138 mounts here (each in its own file of this folder):
 * - flow 9 (G13): the "Search for cameras" action of the empty state (`CameraSearchAgain`); the search panel itself is on the Devices screen;
 * - flow 11: the no-device notifications, on a surface that has no panel of its own (Settings → Capture) — on the Devices screen the banner sits above this card;
 * - flow 12: the "Development source" badge on every camera and microphone line (`SourceBadge`, decided by `developmentSourceOf` from the device's own `sourceClass`; nothing is drawn when the Core sent none);
 * - flow 13 (G17): "Search again" for microphones under the microphone rows (`MicRescanControl`).
 */
import { cameraLinesInForce } from '@/features/capture-selector/selector-in-force';
import { Alert, Button, ListGroup, Separator, SkeletonGroup } from 'heroui-native';
import { Camera, Mic } from 'lucide-react-native';
import { Fragment, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CAPTURE_PAIRS, capturePairOfMicChannel, PRIMARY_MIC_CHANNEL, useSim } from '@dems/shared/sim'; // audit row 189 (M3-07 R4): the four pairs
import { fontFamily, palette, radius, spacing, typography, type StatusTone } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { SectionCard, StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { useLayoutClass } from '@/layout';
import { PendingSpinner, usePendingPress } from '@/runtime';
import { CameraSearchAgain, CaptureNoticesBanner } from './capture-notices';
import { developmentSourceOf } from './capture-notices-model';
import { cameraLineStatus, isEmptySlotRow, type AnswerClass, type SelectorCommand, type SelectorGateState } from './capture-selector-model';
import { CaptureSourceSheet, type SourceSheetRequest } from './capture-source-sheet';
import { SourceBadge } from './development-source-badge';
import { MicMoveDialog } from './mic-move-dialog';
import { MicRescanControl } from './mic-rescan';
import { cameraLineReportOf, cameraStreamWordApplies, deviceReportOf, realCaptureSources, sourceStateWord } from './source-state';
import { useCameraSearch } from './use-camera-search';
import { useCaptureSelector, type CaptureSelector as CaptureSelectorData, type SelectorNotice } from './use-capture-selector';


export interface CaptureSelectorProps {
  /** testID of the card (`capture-selector` on Devices, `settings-capture-selector` in Settings). */
  testID?: string;
}

const STREAM_TONE = { LIVE: 'success', LOST: 'danger', OFFLINE: 'warning', NOT_READ: 'default' } as const;
const MIC_ROW_KEY = 'MIC';
/** The i18n key of the Change control of a microphone line (fix wave H, G70-02: each line has its own sheet). */
// D61 (2026-11-04): every microphone row uses the one channel-labelled key.
const MIC_CHANGE_LABEL = 'changeMicLabel' as const;

export function CaptureSelector({ testID = 'capture-selector' }: CaptureSelectorProps) {
  const { t } = useTranslation();
  const selector = useCaptureSelector();
  // Null on a surface that mounts no search panel (Settings → Capture): the notifications are then drawn here.
  const screenSearch = useCameraSearch();
  const { isMultiPane } = useLayoutClass();
  const press = usePendingPress();
  const [request, setRequest] = useState<SourceSheetRequest | null>(null);
  const editable = selector.gate === 'allowed' && !selector.busy;
  const openKey = request === null ? null : request.kind === 'camera' ? request.trackId : null;
  const openChannel = request !== null && request.kind === 'mic' ? request.channel : null; // D61

  const save = (command: SelectorCommand) => {
    // Audit row 189 (M3-07 R1/R2; D175, row 188's hand-off R188-1): a microphone that comes from another channel is
    // NEVER sent from the sheet. The sheet closes and the move waits in the confirm (`askMove`); operation 78 goes out
    // only from `confirmMove` (S1 for a swap, S2 for a move), and Cancel sends nothing.
    if (command.kind === 'micMove') {
      selector.askMove(command);
      setRequest(null);
      return;
    }
    press.run((release) => {
      void selector.send(command).then(() => {
        release();
        // Every answer closes the sheet: a 200 leaves the row pending, a refusal is drawn on the card.
        setRequest(null);
      });
    });
  };
  // Audit row 189: the one place a microphone move is sent - once, through row 188's gate.
  const confirmMove = () => {
    press.run((release) => {
      void selector.confirmMove().then(() => release());
    });
  };

  const gateLine = gateText(selector.gate, selector.checkingHint, t);
  // Fix wave I (re-gate 70, G70b-06; contract note A2 §4, RULED): on a Core in REAL capture a camera line says
  // "Live" / "Lost" only while a session of the Core is RECORDING - the recording's telemetry is the one thing
  // that makes it true. Outside a recording the chip states what the Core reported for the device:
  // "Reachable" / "Not reachable" / "Not checked" (flat strings, so nothing re-renders per frame).
  const live = selector.badgeMode.live;
  const reported = useSim((s) =>
    cameraStreamWordApplies({ realCapture: realCaptureSources(s.captureDevices.devices, live), recording: s.session?.state === 'RECORDING' })
      ? ([] as string[])
      : cameraLinesInForce(s).map((line) => {
          const word = sourceStateWord(cameraLineReportOf(s, line.trackId), live);
          return `${line.trackId}|${word.key}|${word.tone}`;
        }),
  );
  // Fix wave L (G70c-02): the same rule for every OPTION of the camera sheet - on a Core in real capture an
  // option says what the Core reported for that camera; "Live" only for a camera on a track while recording.
  const optionIds = selector.options.map((option) => option.deviceId).join('|');
  const optionWords = useSim((s) =>
    !realCaptureSources(s.captureDevices.devices, live)
      ? null
      : optionIds
          .split('|')
          .filter((deviceId) => deviceId !== '')
          .map((deviceId) => {
            const word = sourceStateWord(deviceReportOf(s, deviceId, 'CAMERA'), live);
            return `${deviceId}~${word.key}~${word.tone}`;
          })
          .join('|'),
  );
  const recordingNow = useSim((s) => s.session?.state === 'RECORDING');
  const reportedOptions = (): Readonly<Record<string, { key: string; tone: StatusTone }>> | undefined => {
    if (optionWords === null) return undefined;
    const record: Record<string, { key: string; tone: StatusTone }> = {};
    for (const entry of optionWords.split('|')) {
      const [deviceId = '', key = '', tone = 'default'] = entry.split('~');
      if (deviceId !== '') record[deviceId] = { key, tone: tone as StatusTone };
    }
    return record;
  };
  const reportedOf = (trackId: string): { key: string; tone: StatusTone } | null => {
    const [, key, tone] = reported.find((entry) => entry.startsWith(`${trackId}|`))?.split('|') ?? [];
    return key === undefined || tone === undefined ? null : { key, tone: tone as StatusTone };
  };

  // Audit row 189 (M3-07 R4): the camera row of a pair (the body the camera list drew before the pair groups).
  const cameraRow = (row: CaptureSelectorData['cameras'][number]): ReactNode => {
    const track = t(`features.capture-selector.selector.track.${row.trackId}`);
    // Task 4 row 32 (decision C18 (3)): a track the selector holds no line for is still a row - it says
    // "Not assigned" and its control offers to assign a camera (the camera command of an assigned row).
    if (isEmptySlotRow(row)) {
      return (
        <Fragment key={row.trackId}>
          <SelectorRow
            rowKey={row.trackId}
            icon="camera"
            title={track}
            detail={t('common.captureSlot.notAssigned')}
            chip={null}
            stateLabel=""
            empty
            selected={openKey === row.trackId}
            pending={selector.pendingKey === row.trackId}
            editable={editable}
            gateHint={gateLine}
            editLabel={t('common.captureSlot.assignLabel', { slot: t(`common.captureSlot.${row.trackId}`) })}
            onEdit={() => {
              const reported = reportedOptions();
              setRequest({ kind: 'camera', trackId: row.trackId, currentDeviceId: null, options: selector.options, badgeMode: selector.badgeMode, recording: recordingNow, ...(reported === undefined ? {} : { reported }) });
            }}
          />
        </Fragment>
      );
    }
    const status = cameraLineStatus(row);
    const word = reportedOf(row.trackId);
    const streamLabel = word !== null ? t(word.key) : t(`features.capture-selector.selector.stream.${status}`);
    return (
      <Fragment key={row.trackId}>
        <SelectorRow
          rowKey={row.trackId}
          icon="camera"
          title={track}
          detail={[row.deviceId, row.model].filter((part): part is string => part !== null && part !== '').join(' · ')}
          chip={
            <StatusChip
              size="sm"
              tone={word !== null ? word.tone : STREAM_TONE[status]}
              label={streamLabel}
              icon={null}
              testID={`capture-selector-stream-${row.trackId}`}
            />
          }
          stateLabel={streamLabel}
          selected={openKey === row.trackId}
          pending={selector.pendingKey === row.trackId}
          editable={editable}
          gateHint={gateLine}
          editLabel={t('features.capture-selector.selector.changeCameraLabel', { track })}
          onEdit={() => {
            const reported = reportedOptions();
            setRequest({ kind: 'camera', trackId: row.trackId, currentDeviceId: row.deviceId, options: selector.options, badgeMode: selector.badgeMode, recording: recordingNow, ...(reported === undefined ? {} : { reported }) });
          }}
        />
        {/* Row 138 (flow 12): the one badge of this line; nothing when the Core sent no development class. */}
        <LineBadge sourceClass={row.sourceClass} adapter={row.adapter} deviceKind="CAMERA" mode={selector.badgeMode} testID={`capture-selector-source-${row.trackId}`} />
      </Fragment>
    );
  };

  // Audit row 189 (M3-07 R4): the microphone row of a pair - its chip names the slot T9 "Mic N (Camera N)" (U-13; A3).
  const micRow = (row: CaptureSelectorData['mics'][number]): ReactNode => {
    // Task 4 row 32 (decision C18 (3); D61 of 2026-11-04): a CHANNEL no line holds is still a row, keyed by
    // its channel (there is no input to key it by): the slot's name, "Not assigned", the channel chip, and the offer to assign.
    const inputId = row.inputId;
    const rowKey = inputId ?? row.channel;
    // Audit row 189 (M3-07 R4; register T9, A3; D163): "Mic N (Camera N)" for all four channels - not the channel words
    // ("Channel 1 (transcribed)" / "Channel 2"); "Transcribed" is said ONCE, on the head of Pair 1.
    const roleLabel = t('devices.pairs.micOfCamera', { n: capturePairOfMicChannel(row.channel).pair });
    return (
      <Fragment key={rowKey}>
        <SelectorRow
          rowKey={rowKey}
          icon="mic"
          title={inputId ?? t(`common.captureSlot.${row.channel}`)}
          detail={
            inputId === null
              ? t('common.captureSlot.notAssigned')
              : [row.model, row.transport, row.online ? null : t('features.capture-selector.selector.stream.OFFLINE')].filter((part): part is string => part !== null && part !== '').join(' · ')
          }
          chip={<StatusChip size="sm" tone={inputId !== null && row.channel === 'MIC-01' ? 'success' : 'default'} label={roleLabel} icon={null} testID={`capture-selector-channel-${rowKey}`} />}
          stateLabel={roleLabel}
          empty={inputId === null}
          selected={openChannel === row.channel}
          pending={selector.pendingKey === MIC_ROW_KEY}
          editable={editable}
          gateHint={gateLine}
          editLabel={
            inputId === null
              ? t('common.captureSlot.assignLabel', { slot: t(`common.captureSlot.${row.channel}`) })
              : t(`features.capture-selector.selector.${MIC_CHANGE_LABEL}`, { n: Number(row.channel.slice(-2)) }) // D61: one key, the channel number
          }
          // Fix wave H (G70-02): the line's own sheet, with every registered microphone.
          onEdit={() => setRequest({ kind: 'mic', channel: row.channel, currentInputId: inputId, options: selector.micOptions, badgeMode: selector.badgeMode })}
        />
        {inputId === null ? null : (
          <LineBadge sourceClass={row.sourceClass} adapter={row.adapter} deviceKind="MIC" mode={selector.badgeMode} testID={`capture-selector-source-${inputId}`} />
        )}
      </Fragment>
    );
  };

  return (
    <SectionCard
      testID={testID}
      title={t('features.capture-selector.selector.title')}
      description={t('features.capture-selector.selector.subtitle')}
      accessibilityLabel={t('features.capture-selector.selector.label')}
    >
      {!selector.ready ? (
        <>
          <SkeletonGroup isLoading style={styles.skeletons} testID="capture-selector-loading">
            {[0, 1].map((i) => (
              <SkeletonGroup.Item key={i} className="h-14 w-full rounded-xl" />
            ))}
          </SkeletonGroup>
          <GateLine text={t('mobile.rbac.checking')} />
        </>
      ) : (
        <>
          {selector.gate === 'locked' ? (
            <Alert status="warning" testID="capture-selector-locked">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('features.capture-selector.selector.lockedTitle')}</Alert.Title>
                <Alert.Description>{t('features.capture-selector.selector.gate.locked')}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          {selector.gate === 'waiting' ? (
            <Alert status="warning" testID="capture-selector-waiting">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('features.capture-selector.selector.waitingTitle')}</Alert.Title>
                <Alert.Description>{t('features.capture-selector.selector.gate.waiting')}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          {selector.notice !== null ? <NoticeAlert notice={selector.notice} selector={selector} /> : null}

          {/* Row 138 (flow 11): the no-device notifications, where the screen has no banner of its own. */}
          {screenSearch === null ? <CaptureNoticesBanner testID="capture-selector-notices" /> : null}

          {selector.empty ? (
            <View testID="capture-selector-empty" style={styles.empty}>
              <Text maxFontSizeMultiplier={1.2} style={styles.emptyText}>
                {t('features.capture-selector.selector.empty')}
              </Text>
              {/* Row 138 (flow 9, G13): the first search of the empty state. */}
              <CameraSearchAgain first testID="capture-selector-empty-search" />
            </View>
          ) : (
            <ListGroup variant="transparent" testID="capture-selector-rows">
              {/* Audit row 189 (M3-07 R4; register T5-T7, T9; web row 156 `selectorPairRows`): the eight slots are drawn as the
                  four pairs "Camera N <-> Mic N" (D5: Pair N = VIDEO-0N + MIC-0N), in pair order; Pair 1 alone says "Transcribed". */}
              {CAPTURE_PAIRS.map((pair, index) => {
                const camera = selector.cameras.find((row) => row.trackId === pair.videoTrackId);
                const mic = selector.mics.find((row) => row.channel === pair.micChannel);
                const incomplete = camera === undefined || isEmptySlotRow(camera) || mic === undefined || mic.inputId === null;
                return (
                  <View key={pair.pair} testID={`selector-pair-${pair.pair}`} style={styles.pair}>
                    {index > 0 ? <Separator /> : null}
                    <View style={styles.pairHead}>
                      <Text maxFontSizeMultiplier={1.2} style={styles.pairLabel} testID={`selector-pair-label-${pair.pair}`} accessibilityRole="header">
                        {t('devices.pairs.rowLabel', { n: pair.pair })}
                      </Text>
                      {pair.micChannel === PRIMARY_MIC_CHANNEL ? (
                        <StatusChip size="sm" tone="success" label={t('devices.pairs.transcribed')} icon={null} testID={`selector-pair-transcribed-${pair.pair}`} />
                      ) : null}
                    </View>
                    {incomplete ? (
                      <Text maxFontSizeMultiplier={1.2} style={styles.pairWarning} testID={`selector-pair-incomplete-${pair.pair}`} accessibilityLiveRegion="polite">
                        {t('devices.pairs.incomplete', { n: pair.pair })}
                      </Text>
                    ) : null}
                    {camera === undefined ? null : cameraRow(camera)}
                    <Separator />
                    {mic === undefined ? null : micRow(mic)}
                  </View>
                );
              })}
              {/* Row 138 (flow 13, G17): "Search again" for microphones, under the microphone rows (always FOUR since D61, 2026-11-04). */}
              <Separator />
              {/* Fix wave H (G70-06): the card's gate line already says why; the same sentence is not drawn a second time here. */}
              <MicRescanControl testID="capture-selector-mic-rescan" gateShownAs={gateLine} />
            </ListGroup>
          )}
          {gateLine !== null ? <GateLine text={gateLine} /> : null}
          <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="capture-selector-no-preview">
            {t('features.capture-selector.selector.noPreview')}
          </Text>
        </>
      )}
      <CaptureSourceSheet request={request} fullHeight={!isMultiPane} busy={press.busy} pending={press.pending} onSave={save} onClose={() => setRequest(null)} />
      {/* Audit row 189 (M3-07 R1/R2; S5-S10): the confirm of a microphone swap or move. */}
      <MicMoveDialog ask={selector.moveAsk} busy={press.busy} pending={press.pending} onConfirm={confirmMove} onCancel={selector.cancelMove} />
    </SectionCard>
  );
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface LineBadgeProps {
  sourceClass: string | null;
  adapter: string | null;
  deviceKind: 'CAMERA' | 'MIC';
  mode: { readonly live: boolean };
  testID: string;
}

/** The badge of a selector line (flow 12): drawn only from what the Core sent; otherwise no node at all. */
function LineBadge({ sourceClass, adapter, deviceKind, mode, testID }: LineBadgeProps) {
  const kind = developmentSourceOf({ sourceClass: sourceClass ?? undefined, adapter: adapter ?? undefined, deviceKind, ...mode });
  return kind === null ? null : <SourceBadge kind={kind} testID={testID} />;
}

/** The one sentence under the rows that says why the edit controls are disabled; null when they are not. */
function gateText(gate: SelectorGateState, checkingHint: string | null, t: Translate): string | null {
  switch (gate) {
    case 'checking':
      return checkingHint ?? t('mobile.rbac.checking');
    case 'waiting':
      return t('features.capture-selector.selector.gate.waiting');
    case 'denied':
      return t('features.capture-selector.selector.gate.denied', { first: t('common.roles.SUPERVISOR'), second: t('common.roles.TECHNICIAN') });
    case 'locked':
      return t('features.capture-selector.selector.gate.locked');
    case 'allowed':
      return null;
  }
}

function GateLine({ text }: { text: string }) {
  return (
    <Text maxFontSizeMultiplier={1.2} style={styles.gate} testID="capture-selector-gate" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

const NOTICE_STATUS: Readonly<Record<Exclude<AnswerClass, 'ok'>, 'warning' | 'danger'>> = {
  locked: 'warning',
  denied: 'danger',
  signedOut: 'warning',
  notFound: 'danger',
  developmentOnly: 'danger',
  invalid: 'danger',
  notReady: 'warning',
  offline: 'danger',
  failed: 'danger',
};

/** The words of `details.reason` the Core answers for a production camera's profile (`CaptureProfileRefusal` of the Core's capture-config routes). */
// Row W6 (request line 565; row V7c, C130): `CAMERA_PROFILE_WITHOUT_STREAM` - a listed profile with no stored stream row.
const PROFILE_REFUSAL_REASONS: readonly string[] = ['CAMERA_PROFILE_NOT_STATED', 'CAMERA_PROFILE_NOT_OF_DEVICE', 'CAMERA_PROFILE_WITHOUT_STREAM'];

function NoticeAlert({ notice, selector }: { notice: SelectorNotice; selector: CaptureSelectorData }) {
  const { t } = useTranslation();
  // Fix wave J (JA2-24): a refused choice says why - the cause the client knows, else the Core's reason, else the plain sentence.
  const cause = notice.cause ?? null;
  const body =
    cause !== null && cause.kind === 'cameraOnOtherTrack'
      ? t('features.capture-selector.selector.notice.cameraOnOtherTrack', { device: cause.deviceId, track: t(`features.capture-selector.selector.track.${cause.trackId}`) })
      : cause !== null && cause.kind === 'core' && PROFILE_REFUSAL_REASONS.includes(cause.reason)
        ? // Task 4 row W5 (review 060d Q-02; request line of integration I-7): the two profile refusals of the Core read
          // THE SHARED SENTENCE of their word (`common.captureSlotRefusal`), as the web console reads it - not the word in lower case.
          t(`common.captureSlotRefusal.${cause.reason}`, { source: t('common.captureSlotSource.CAMERA') })
        : cause !== null && cause.kind === 'core'
        ? t('features.capture-selector.selector.notice.coreReason', { reason: cause.reason.toLowerCase().replace(/_/g, ' ') })
        : notice.result === 'denied'
      ? t('features.capture-selector.selector.gate.denied', { first: t('common.roles.SUPERVISOR'), second: t('common.roles.TECHNICIAN') })
      : notice.result === 'locked'
        ? t('features.capture-selector.selector.gate.locked')
        : t(`features.capture-selector.selector.notice.${notice.result}`);
  const { retry } = selector;
  return (
    <Alert status={NOTICE_STATUS[notice.result]} testID={`capture-selector-notice-${notice.result}`}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t(`features.capture-selector.selector.noticeTitle.${notice.result}`)}</Alert.Title>
        <Alert.Description testID="capture-selector-notice-body">{body}</Alert.Description>
        <View style={styles.noticeActions}>
          {notice.result === 'notReady' ? (
            <Button variant="outline" size="sm" isDisabled={!retry.canRetry} onPress={retry.run} testID="capture-selector-retry">
              <Button.Label>
                {retry.exhausted
                  ? t('common.errors.maxRetries')
                  : retry.cooldownS > 0
                    ? t('common.actions.retryIn', { seconds: retry.cooldownS })
                    : t('common.actions.retry')}
              </Button.Label>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onPress={selector.dismissNotice} testID="capture-selector-notice-dismiss">
            <Button.Label>{t('features.capture-selector.selector.dismiss')}</Button.Label>
          </Button>
        </View>
      </Alert.Content>
    </Alert>
  );
}

interface SelectorRowProps {
  rowKey: string;
  icon: 'camera' | 'mic';
  title: string;
  detail: string;
  chip: ReactNode;
  /** The word of the chip (the stream state of a camera, the role of a microphone): the last part of the row's accessibility label. */
  stateLabel: string;
  selected: boolean;
  pending: boolean;
  editable: boolean;
  /** Why the control is disabled (its accessibility hint); null when it is not. */
  gateHint: string | null;
  editLabel: string;
  /** Task 4 row 32: the slot is not assigned - the control reads "Assign" instead of "Change". Same gate, same sheet. */
  empty?: boolean;
  onEdit: () => void;
}

function SelectorRow({ rowKey, icon, title, detail, chip, stateLabel, selected, pending, editable, gateHint, editLabel, empty = false, onEdit }: SelectorRowProps) {
  const { t } = useTranslation();
  const Icon = icon === 'camera' ? Camera : Mic;
  const shownDetail = pending ? t('features.capture-selector.selector.pending') : detail;
  // Fix wave I (re-gate 70, G70b-03): the row states `busy`, so it must carry its OWN label. Android writes a
  // view's content description from the label + the state words and skips the write when both are empty
  // (`BaseViewManager.updateViewContentDescription`): without a label the row read "busy" during a save and
  // was never rewritten afterwards. The label is what the row shows: name, detail (or "Saving…"), state.
  const rowLabel = [title, shownDetail, stateLabel].filter((part) => part !== '').join(', ');
  return (
    <View style={styles.wrap} testID={`capture-selector-row-wrap-${rowKey}`}>
      {/* Fix wave J (JT-13): the row reported clickable and did nothing. It now does what its "Change" control does
          while that is allowed; otherwise it is disabled and says why (never a dead button). */}
      <ListGroup.Item
        testID={`capture-selector-row-${rowKey}`}
        accessibilityLabel={rowLabel}
        accessibilityState={{ selected, busy: pending, disabled: !editable || pending }}
        {...(gateHint === null ? { accessibilityHint: editLabel } : { accessibilityHint: gateHint })}
        disabled={!editable || pending}
        onPress={onEdit}
        style={[styles.item, selected ? styles.itemSelected : null]}
      >
        <ListGroup.ItemPrefix>
          <View style={styles.iconTile}>
            <Icon size={20} color={palette.gold} />
          </View>
        </ListGroup.ItemPrefix>
        <ListGroup.ItemContent style={styles.content}>
          {/* Fix wave J (JT-12): two lines - "Video trac…" hid which track the row is. */}
          <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.title} testID={`capture-selector-title-${rowKey}`}>
            {title}
          </Text>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={3} style={styles.detail} testID={`capture-selector-detail-${rowKey}`}>
            {shownDetail}
          </Text>
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix style={styles.suffix}>
          {/* The chip is a kit pressable: inside the row it takes no touch (the row and "Change" are the targets). */}
          <View pointerEvents="none">{chip}</View>
          <Button
            variant="outline"
            size="sm"
            isDisabled={!editable || pending}
            onPress={onEdit}
            testID={`capture-selector-edit-${rowKey}`}
            accessibilityLabel={editLabel}
            {...(gateHint === null ? {} : { accessibilityHint: gateHint })}
          >
            {pending ? <PendingSpinner color={palette.gold} testID={`capture-selector-spinner-${rowKey}`} /> : null}
            <Button.Label>{empty ? t('common.captureSlot.assign') : t('features.capture-selector.selector.change')}</Button.Label>
          </Button>
        </ListGroup.ItemSuffix>
      </ListGroup.Item>
      {/* E-15 (W93-4): always mounted, last; React sets its opacity. */}
      <SelectionGlow selected={selected} radius={radius.px.lg} testID={`capture-selector-glow-${rowKey}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletons: { gap: spacing[2] },
  wrap: { position: 'relative' },
  item: { borderRadius: radius.px.lg, paddingVertical: spacing[1], paddingHorizontal: spacing[0], gap: spacing[2], ...ROW_CARD_BORDER },
  itemSelected: { borderColor: palette.gold, backgroundColor: withAlpha(palette.gold, 0.06) },
  iconTile: { width: 40, height: 40, borderRadius: radius.px.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(palette.gold, 0.08) },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size + 1, lineHeight: typography.body.lineHeight, color: palette.foreground },
  detail: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
  suffix: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  gate: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
  note: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  empty: { gap: spacing[2], paddingVertical: spacing[2] },
  emptyText: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  noticeActions: { flexDirection: 'row', gap: spacing[1], marginTop: spacing[1] },
  // Audit row 189 (M3-07 R4): the pair groups.
  pair: { gap: spacing[1] },
  pairHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1], paddingTop: spacing[1] },
  pairLabel: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  pairWarning: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.warning },
});
