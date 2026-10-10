/**
 * The device selector card (task 3, blueprint row 68, M4-W4; ux spec §2 flow 1; specs R-1; register
 * MB-08, MB-09). One component, mounted on the Devices screen (tablet and phone; the phone reaches it
 * through Settings → Device Settings as well) and in Settings → Capture.
 *
 * | Spec | Here |
 * |---|---|
 * | §2.2 step 1, §2.5 "Loading" | until the runtime has hydrated: the skeleton, and the gate line reads "Checking your permissions…" (a gated read, E-16) |
 * | §2.2 step 2 | two camera rows (`VIDEO-01`, `VIDEO-02` → the device behind each, any registered `CAM-NN`) and two microphone rows (PRIMARY first) |
 * | §2.2 step 3, §2.4 G1-G3 | every "Change" control is ALWAYS drawn; outside `allowed` it is disabled and the gate line says why: checking, waiting for the link, "Requires the Supervisor or Technician role", or the OD-10 sentence. Never hidden, never enabled on an unknown role (P-13) |
 * | §2.2 steps 4, 5 | a bottom sheet per field (`CaptureSourceSheet`); nothing is written locally, the row reads "Saving…" until `captureConfig` republishes |
 * | §2.2 step 6, §2.5 | a refusal is drawn in place as an `Alert` (locked, not permitted, unknown device, not accepted, development-only source, capture not ready with a rate-limited Retry, no answer); no toast, no raw error |
 * | §2.5 "Empty device list" | "No capture devices configured"; the "Search for cameras" action is row 138's (slot below) |
 * | E-15 | each row keeps a 1 dp border in both states (`ROW_CARD_BORDER`) with the always-mounted, React-drawn `SelectionGlow`; the row whose sheet is open is the selected one |
 * | OD-12 | status is text and a chip (`Live`, `Lost`, `Offline`); no frame is decoded or shown |
 *
 * Task 3 row 138 mounts here (each in its own file of this folder):
 * - flow 9 (G13): the "Search for cameras" action of the empty state (`CameraSearchAgain`); the search panel itself is on the Devices screen;
 * - flow 11: the no-device notifications, on a surface that has no panel of its own (Settings → Capture) — on the Devices screen the banner sits above this card;
 * - flow 12: the "Development source" badge on every camera and microphone line (`SourceBadge`, decided by `developmentSourceOf` from the device's own `sourceClass`; nothing is drawn when the Core sent none);
 * - flow 13 (G17): "Search again" for microphones under the microphone rows (`MicRescanControl`).
 */
import { Alert, Button, ListGroup, Separator, SkeletonGroup } from 'heroui-native';
import { Camera, Mic } from 'lucide-react-native';
import { Fragment, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim } from '@dems/shared/sim';
import { fontFamily, palette, radius, spacing, typography, type StatusTone } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { SectionCard, StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { useLayoutClass } from '@/layout';
import { PendingSpinner, usePendingPress } from '@/runtime';
import { CameraSearchAgain, CaptureNoticesBanner } from './capture-notices';
import { developmentSourceOf } from './capture-notices-model';
import { cameraLineStatus, type AnswerClass, type SelectorCommand, type SelectorGateState } from './capture-selector-model';
import { CaptureSourceSheet, type SourceSheetRequest } from './capture-source-sheet';
import { SourceBadge } from './development-source-badge';
import { MicRescanControl } from './mic-rescan';
import { cameraLineReportOf, cameraStreamWordApplies, realCaptureSources, sourceStateWord } from './source-state';
import { useCameraSearch } from './use-camera-search';
import { useCaptureSelector, type CaptureSelector as CaptureSelectorData, type SelectorNotice } from './use-capture-selector';


export interface CaptureSelectorProps {
  /** testID of the card (`capture-selector` on Devices, `settings-capture-selector` in Settings). */
  testID?: string;
}

const STREAM_TONE = { LIVE: 'success', LOST: 'danger', OFFLINE: 'warning' } as const;
const MIC_ROW_KEY = 'MIC';
/** The i18n key of the Change control of a microphone line (fix wave H, G70-02: each line has its own sheet). */
const MIC_CHANGE_LABEL = { PRIMARY: 'changeMicLabel', STANDBY: 'changeStandbyMicLabel' } as const;

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
  const openRole = request !== null && request.kind === 'mic' ? request.role : null;

  const save = (command: SelectorCommand) => {
    press.run((release) => {
      void selector.send(command).then(() => {
        release();
        // Every answer closes the sheet: a 200 leaves the row pending, a refusal is drawn on the card.
        setRequest(null);
      });
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
      : (s.session?.captureConfig ?? s.captureConfig).cameras.map((line) => {
          const word = sourceStateWord(cameraLineReportOf(s, line.trackId), live);
          return `${line.trackId}|${word.key}|${word.tone}`;
        }),
  );
  const reportedOf = (trackId: string): { key: string; tone: StatusTone } | null => {
    const [, key, tone] = reported.find((entry) => entry.startsWith(`${trackId}|`))?.split('|') ?? [];
    return key === undefined || tone === undefined ? null : { key, tone: tone as StatusTone };
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
              {selector.cameras.map((row, index) => {
                const status = cameraLineStatus(row);
                const track = t(`features.capture-selector.selector.track.${row.trackId}`);
                const word = reportedOf(row.trackId);
                const streamLabel = word !== null ? t(word.key) : t(`features.capture-selector.selector.stream.${status}`);
                return (
                  <Fragment key={row.trackId}>
                    {index > 0 ? <Separator /> : null}
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
                      onEdit={() => setRequest({ kind: 'camera', trackId: row.trackId, currentDeviceId: row.deviceId, options: selector.options, badgeMode: selector.badgeMode })}
                    />
                    {/* Row 138 (flow 12): the one badge of this line; nothing when the Core sent no development class. */}
                    <LineBadge sourceClass={row.sourceClass} adapter={row.adapter} deviceKind="CAMERA" mode={selector.badgeMode} testID={`capture-selector-source-${row.trackId}`} />
                  </Fragment>
                );
              })}
              {selector.mics.map((row, index) => (
                <Fragment key={row.inputId}>
                  {index > 0 || selector.cameras.length > 0 ? <Separator /> : null}
                  <SelectorRow
                    rowKey={row.inputId}
                    icon="mic"
                    title={row.inputId}
                    detail={[row.model, row.transport, row.online ? null : t('features.capture-selector.selector.stream.OFFLINE')]
                      .filter((part): part is string => part !== null && part !== '')
                      .join(' · ')}
                    chip={
                      <StatusChip
                        size="sm"
                        tone={row.role === 'PRIMARY' ? 'success' : 'default'}
                        label={t(`features.capture-selector.selector.role.${row.role}`)}
                        icon={null}
                        testID={`capture-selector-role-${row.inputId}`}
                      />
                    }
                    stateLabel={t(`features.capture-selector.selector.role.${row.role}`)}
                    selected={openRole === row.role}
                    pending={selector.pendingKey === MIC_ROW_KEY}
                    editable={editable}
                    gateHint={gateLine}
                    editLabel={t(`features.capture-selector.selector.${MIC_CHANGE_LABEL[row.role]}`)}
                    // Fix wave H (G70-02): the line's own sheet, with every registered microphone.
                    onEdit={() => setRequest({ kind: 'mic', role: row.role, currentInputId: row.inputId, options: selector.micOptions, badgeMode: selector.badgeMode })}
                  />
                  <LineBadge sourceClass={row.sourceClass} adapter={row.adapter} deviceKind="MIC" mode={selector.badgeMode} testID={`capture-selector-source-${row.inputId}`} />
                </Fragment>
              ))}
              {/* Row 138 (flow 13, G17): "Search again" for microphones, under the microphone rows. */}
              {selector.mics.length > 0 ? (
                <>
                  <Separator />
                  {/* Fix wave H (G70-06): the card's gate line already says why; the same sentence is not drawn a second time here. */}
                  <MicRescanControl testID="capture-selector-mic-rescan" gateShownAs={gateLine} />
                </>
              ) : null}
            </ListGroup>
          )}
          {gateLine !== null ? <GateLine text={gateLine} /> : null}
          <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="capture-selector-no-preview">
            {t('features.capture-selector.selector.noPreview')}
          </Text>
        </>
      )}
      <CaptureSourceSheet request={request} fullHeight={!isMultiPane} busy={press.busy} pending={press.pending} onSave={save} onClose={() => setRequest(null)} />
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

function NoticeAlert({ notice, selector }: { notice: SelectorNotice; selector: CaptureSelectorData }) {
  const { t } = useTranslation();
  const body =
    notice.result === 'denied'
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
        <Alert.Description>{body}</Alert.Description>
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
  onEdit: () => void;
}

function SelectorRow({ rowKey, icon, title, detail, chip, stateLabel, selected, pending, editable, gateHint, editLabel, onEdit }: SelectorRowProps) {
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
      <ListGroup.Item
        testID={`capture-selector-row-${rowKey}`}
        accessibilityLabel={rowLabel}
        accessibilityState={{ selected, busy: pending }}
        style={[styles.item, selected ? styles.itemSelected : null]}
      >
        <ListGroup.ItemPrefix>
          <View style={styles.iconTile}>
            <Icon size={20} color={palette.gold} />
          </View>
        </ListGroup.ItemPrefix>
        <ListGroup.ItemContent style={styles.content}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.detail} testID={`capture-selector-detail-${rowKey}`}>
            {shownDetail}
          </Text>
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix style={styles.suffix}>
          {chip}
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
            <Button.Label>{t('features.capture-selector.selector.change')}</Button.Label>
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
});
