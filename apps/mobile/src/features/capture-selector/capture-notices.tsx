/**
 * The no-device notifications on the tablet and the phone (task 3, blueprint row 138; ux spec §8e
 * flow 11 situations A and B, §8g.3 the start rule at pre-check; specs R-10 AC-1..AC-6; decisions
 * D80(2), D83, D114). Situation C (no camera at session start) is row 139's.
 *
 * | Rule (§8e.1) | Here |
 * |---|---|
 * | One alert, drawn everywhere | every notification is one ACTIVE alert of the replicated `alerts` slice; this file raises, counts and stores nothing |
 * | Told apart by reason | title and body come from `params.reason` (+ `phase`, `deviceKind`, `cause`), never from a fault kind |
 * | Names, never values | "Camera 2 (CAM-02)" and counts; the label is resolved here from the id; no address, user name or URL is read |
 * | Cleared by the Core only | a banner is gone at the first state update after the alert was resolved; no timer, no dismiss control |
 * | No countdown, no automatic retry | the only actions are "Search again" (G13 cameras, G17 microphones) |
 *
 * | Placement (§8e.2) | Component |
 * |---|---|
 * | Devices screen (tablet; phone through Settings → Device Settings) and Settings → Capture | `CaptureNoticesBanner` |
 * | Session New, the pre-check step | `PrecheckCaptureNotices` + `usePrecheckSentence` (the row and the blocked / warning text come from `params.rule`, D114) |
 * | Home header bell | `captureNoticeTitle` words the item of the alert centre |
 *
 * The operator without `CAPTURE_CONFIG` (§8e.3): sees every notification; "Search again" is drawn
 * DISABLED with the role sentence after "Checking your permissions…"; no list is requested.
 */
import { Alert, Button } from 'heroui-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Permission, useSim, type PrecheckItem } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { useOpenTabRoot } from '@/navigation/tab-root';
import { SearchButton } from './camera-search-panel';
import { captureNoticesOf, deviceLabel, isUnreachableItem, noticeTitle, precheckUnreachableOf, type CaptureNotice } from './capture-notices-model';
import { MicRescanControl } from './mic-rescan';
import { useCameraSearch, useCameraSearchController, type CameraSearch } from './use-camera-search';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const K = 'features.capture-selector.notice';

export function noticeBody(t: Translate, notice: CaptureNotice): string {
  if (notice.kind === 'discoveryEmpty') return t(`${K}.discoveryEmpty.body`);
  if (notice.phase === 'SESSION_START') return t(`${K}.unreachable.sessionStart.body`);
  const base =
    notice.deviceKind === 'MIC'
      ? t(`${K}.unreachable.precheck.microphone`)
      : notice.searchCount === null
        ? t(`${K}.unreachable.precheck.cameraNoCount`)
        : t(`${K}.unreachable.precheck.camera`, { count: notice.searchCount });
  // A named cause is added; the plain "did not answer" is what the sentence already says.
  return notice.cause === 'UNREACHABLE' ? base : `${base} ${t(`${K}.cause.${notice.cause}`)}`;
}

/** The notifications the `alerts` slice holds now (store-owned reference in, a stable list out). */
export function useCaptureNotices(): readonly CaptureNotice[] {
  const alerts = useSim((s) => s.alerts);
  return useMemo(() => captureNoticesOf(alerts), [alerts]);
}

export interface CaptureNoticesBannerProps {
  testID?: string;
}

/** Situations A and B as banners; nothing at all when no notice is active (0 stale banners, R-10 AC-5). */
export function CaptureNoticesBanner({ testID = 'capture-notices' }: CaptureNoticesBannerProps) {
  const { t } = useTranslation();
  const notices = useCaptureNotices();
  if (notices.length === 0) return null;
  return (
    <View style={styles.stack} testID={testID} accessibilityLabel={t(`${K}.listLabel`)}>
      {notices.map((notice) => (
        <Alert key={notice.alertId} status="warning" testID={`capture-notice-${notice.alertId}`} accessibilityLiveRegion="polite">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{noticeTitle(t, notice)}</Alert.Title>
            <Alert.Description testID={`capture-notice-body-${notice.alertId}`}>{noticeBody(t, notice)}</Alert.Description>
            <View style={styles.actions}>
              {notice.kind === 'unreachable' && notice.deviceKind === 'MIC' ? (
                <MicRescanControl compact testID={`capture-notice-rescan-${notice.alertId}`} />
              ) : (
                <CameraSearchAgain testID={`capture-notice-search-${notice.alertId}`} />
              )}
            </View>
          </Alert.Content>
        </Alert>
      ))}
    </View>
  );
}

/**
 * "Search again" for cameras on a notification (G13). On a screen with the search panel it IS the
 * panel's control (one search, one state). On a surface without the panel (Settings → Capture) it
 * opens the Devices screen, where the search is run; the role gate is the same in both.
 */
export function CameraSearchAgain({ testID, first = false }: { testID: string; /** The first search of an empty state: "Search for cameras". */ first?: boolean }) {
  const { t } = useTranslation();
  const search = useCameraSearch();
  const label = t(first ? 'features.capture-selector.search.action' : 'features.capture-selector.search.again');
  return search === null ? <OpenSearch testID={testID} label={label} /> : <GatedSearch search={search} testID={testID} label={label} />;
}

function GatedSearch({ search, testID, label }: { search: CameraSearch; testID: string; label: string }) {
  return (
    <View style={styles.stackTight}>
      <SearchButton search={search} size="sm" label={label} testID={testID} />
      {search.gateHint !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-gate`}>
          {search.gateHint}
        </Text>
      ) : null}
    </View>
  );
}

function OpenSearch({ testID, label }: { testID: string; label: string }) {
  const { t } = useTranslation();
  const role = useRoleGate(Permission.CAPTURE_CONFIG);
  const openTabRoot = useOpenTabRoot();
  const hint = !role.known
    ? (role.hint ?? t('mobile.rbac.checking'))
    : role.allowed
      ? null
      : t('features.capture-selector.search.denied', { first: t('common.roles.SUPERVISOR'), second: t('common.roles.TECHNICIAN') });
  return (
    <View style={styles.stackTight}>
      <Button
        variant="outline"
        size="sm"
        isDisabled={hint !== null}
        onPress={() => openTabRoot('/devices')}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={hint ?? t('features.capture-selector.search.openSearchHint')}
      >
        <Button.Label>{label}</Button.Label>
      </Button>
      {hint !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-gate`}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// ── Session New: the pre-check (§8g.3; D114) ─────────────────────────────────────────────

/**
 * The sentence of an unreachable pre-check item, from `params.rule`; null for every other item.
 * An unreachable item whose rule this client does not know reads the plain "Not reachable".
 */
export function precheckSentence(t: Translate, item: Pick<PrecheckItem, 'value' | 'params'> | null): string | null {
  if (!isUnreachableItem(item)) return null;
  const found = precheckUnreachableOf(item);
  if (found === null) return t(`${K}.unreachableValue`);
  const device = deviceLabel(t, found.deviceId);
  if (found.rule === 'activeMicrophone') {
    return found.otherDeviceId === null
      ? t(`${K}.start.activeMicrophoneFallback`, { device })
      : t(`${K}.start.activeMicrophone`, { device, other: deviceLabel(t, found.otherDeviceId) });
  }
  return t(`${K}.start.${found.rule}`, { device });
}

export function usePrecheckSentence(item: Pick<PrecheckItem, 'value' | 'params'> | null): string | null {
  const { t } = useTranslation();
  return precheckSentence(t, item);
}

export interface PrecheckCaptureNoticesProps {
  items: readonly PrecheckItem[];
  testID?: string;
}

/**
 * Under the blocked / warning text of the pre-check: one line per unreachable device (its sentence
 * and, for a camera, the count of the ONE search that pre-check ran — read from the device's active
 * alert, D80(2)), then "Search again" per kind. No control switches the microphone here (D83): the
 * active-microphone sentence tells the operator to cancel and change it on Devices.
 */
export function PrecheckCaptureNotices({ items, testID = 'precheck-capture-notices' }: PrecheckCaptureNoticesProps) {
  const { t } = useTranslation();
  const notices = useCaptureNotices();
  const rows = items
    .filter((item) => isUnreachableItem(item))
    .map((item) => ({ item, found: precheckUnreachableOf(item), sentence: precheckSentence(t, item) }));
  if (rows.length === 0) return null;
  const anyCamera = rows.some((row) => row.found?.deviceKind === 'CAMERA');
  const anyMic = rows.some((row) => row.found?.deviceKind === 'MIC');
  return (
    <View style={styles.stack} testID={testID} accessibilityLiveRegion="polite">
      {rows.map(({ item, found, sentence }) => {
        const notice = found === null ? undefined : notices.find((candidate) => candidate.kind === 'unreachable' && candidate.deviceId === found.deviceId);
        const count = notice !== undefined && notice.kind === 'unreachable' && found?.deviceKind === 'CAMERA' ? notice.searchCount : null;
        return (
          <View key={item.id} style={styles.stackTight} testID={`${testID}-${item.id}`}>
            <Text maxFontSizeMultiplier={1.2} style={styles.line} testID={`${testID}-sentence-${item.id}`}>
              {sentence}
            </Text>
            {count !== null ? (
              <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-count-${item.id}`}>
                {t(`${K}.searchCount`, { count })}
              </Text>
            ) : null}
          </View>
        );
      })}
      {anyCamera ? <PrecheckCameraSearch testID={`${testID}-search`} /> : null}
      {anyMic ? <MicRescanControl testID={`${testID}-rescan`} /> : null}
    </View>
  );
}

/** G13 inside Session New: the same operation and the same gate; the LIST is drawn on Devices only. */
function PrecheckCameraSearch({ testID }: { testID: string }) {
  const { t } = useTranslation();
  const search = useCameraSearchController();
  const found = search.state === 'results' || search.state === 'empty' ? (search.view?.search ?? null) : null;
  return (
    <View style={styles.stackTight}>
      <SearchButton search={search} size="sm" label={t('features.capture-selector.search.again')} testID={testID} />
      {search.gateHint !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-gate`}>
          {search.gateHint}
        </Text>
      ) : null}
      {search.limitedSeconds !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-limited`}>
          {search.limitedSeconds > 0 ? t('common.coreErrors.limited', { seconds: search.limitedSeconds }) : t('common.coreErrors.limitedNoTime')}
        </Text>
      ) : null}
      {search.note === 'busy' ? <Text maxFontSizeMultiplier={1.2} style={styles.muted}>{t('features.capture-selector.search.busy')}</Text> : null}
      {search.note === 'unavailable' ? <Text maxFontSizeMultiplier={1.2} style={styles.muted}>{t('features.capture-selector.search.unavailable')}</Text> : null}
      {search.state === 'failed' ? <Text maxFontSizeMultiplier={1.2} style={styles.muted}>{t('features.capture-selector.search.failed')}</Text> : null}
      {found !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.muted} testID={`${testID}-summary`}>
          {t('features.capture-selector.search.summary', { count: found.responderCount, newCount: found.newCount, registeredCount: found.registeredCount })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing[2] },
  stackTight: { gap: spacing[1] },
  actions: { marginTop: spacing[1] },
  line: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  muted: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
});
