/**
 * The "Camera search" panel of the tablet and the phone (task 3, blueprint row 138; ux spec §8c flow
 * 9, §8d.10 flow 10 on these clients; register MB-08, MB-09). Mounted on the Devices screen — the
 * phone reaches the same screen through Settings → Device Settings — inside a `CameraSearchProvider`.
 *
 * | Spec | Here |
 * |---|---|
 * | S1 Checking | skeleton; the button is disabled with "Checking your permissions…" |
 * | S2 Idle | the one sentence and the enabled "Search for cameras" |
 * | S3 Searching | the button is pending; a bar from Core instants (React-drawn width, E-13), "Searching the network for cameras…", the FIXED "This takes up to N seconds." (no countdown), then "Finishing the search…" at 100 % |
 * | S4, S6 Results | the summary, "Searched N network(s).", the rows in the Core's order, the freshness line (two clock times), "Search again" |
 * | S5 Empty | the title, the body and "Search again" |
 * | S7 Truncated | a warning line above the list |
 * | S8 Error, S12 expired | an `Alert` / a line + "Search again" |
 * | S9, S10, S11 | "not available on this Core yet" + Retry (one call per press); the inline "another operator" note; the shared rate-limit sentence with the fixed seconds |
 * | S13, S14 | the button stays in place, disabled, with the role sentence / the recording sentence; no list is requested for S13 |
 * | §8c.3 | address in monospace as plain text; make and model; the name; every announced text is a text node on ONE line with the full text in the accessible label; one trust caption per list |
 * | §8d.10 | a NEW row draws **Connect DISABLED** with "Connect this camera from the web console." and the panel carries the one note. There is no connect flow here: no dialog, no field, no handler on the button (D80(3)) |
 * | E-15 | every row keeps the 1 dp border (`ROW_CARD_BORDER`) and the always-mounted `SelectionGlow` |
 *
 * D91: the "Development sources" group and the badge are drawn only when the badge may be drawn at all
 * (Live data, Core not SIMULATED). In Simulated mode the rows are one list in the Core's order.
 */
import { Alert, Button, ListGroup, Separator, SkeletonGroup } from 'heroui-native';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { formatClock } from '@dems/shared/realtime';
import { fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { SectionCard, StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { PendingSpinner, busyState } from '@/runtime';
import { SEARCH_MAX_CANDIDATES, searchWindowSeconds, type CandidateRow } from './camera-search-model';
import { candidateSourceOf, deviceNameKey } from './capture-notices-model';
import { SourceBadge } from './development-source-badge';
import { useCameraSearch, type CameraSearch } from './use-camera-search';

export interface CameraSearchPanelProps {
  testID?: string;
  /**
   * Opens the detail of a registered device ("View device"), or null when this screen has no detail
   * for that id (a camera added later has none on these clients yet): the action is then not drawn.
   */
  viewDevice?: (deviceId: string) => (() => void) | null;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const K = 'features.capture-selector.search';

export function CameraSearchPanel({ testID = 'camera-search', viewDevice }: CameraSearchPanelProps) {
  const { t } = useTranslation();
  const search = useCameraSearch();
  if (search === null) return null;
  const { state, view } = search;
  const found = view?.search ?? null;
  const badges = candidateSourceOf({ development: true, live: search.live }) !== null;
  // Simulated mode (no group, D91): every row in the Core's order.
  const network = badges ? search.groups.network : search.rows;
  const development = badges ? search.groups.development : [];
  const hasNew = [...network, ...development].some((row) => row.mark === 'new');
  const everSearched = state !== 'idle' && state !== 'checking' && state !== 'loading' && state !== 'denied';

  return (
    <SectionCard testID={testID} title={t(`${K}.title`)} accessibilityLabel={t(`${K}.label`)}>
      {state === 'checking' || state === 'loading' ? (
        <SkeletonGroup isLoading style={styles.skeletons} testID={`${testID}-loading`}>
          <SkeletonGroup.Item className="h-12 w-full rounded-xl" />
        </SkeletonGroup>
      ) : null}

      {state === 'idle' ? <Line testID={`${testID}-intro`}>{t(`${K}.intro`)}</Line> : null}

      {state === 'searching' && found !== null ? (
        <View style={styles.block} testID={`${testID}-searching`} accessibilityLiveRegion="polite">
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t(`${K}.a11y.progress`)}
            accessibilityValue={{ min: 0, max: 100, now: search.progress }}
            testID={`${testID}-progress`}
          >
            <View style={[styles.fill, { width: `${search.progress}%` }]} testID={`${testID}-progress-fill`} />
          </View>
          <Line testID={`${testID}-status`}>{search.progress >= 100 ? t(`${K}.finishing`) : t(`${K}.searching`)}</Line>
          <Muted testID={`${testID}-hint`}>{t(`${K}.searchingHint`, { seconds: searchWindowSeconds(found) })}</Muted>
        </View>
      ) : null}

      {state === 'empty' ? (
        <View style={styles.block} testID={`${testID}-empty`} accessibilityLiveRegion="polite">
          <Text maxFontSizeMultiplier={1.2} style={styles.emptyTitle}>
            {t(`${K}.emptyTitle`)}
          </Text>
          <Line>{t(`${K}.emptyBody`)}</Line>
        </View>
      ) : null}

      {state === 'failed' ? (
        <Alert status="danger" testID={`${testID}-failed`}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t(`${K}.failed`)}</Alert.Description>
            {search.note === 'offline' ? <Alert.Description testID={`${testID}-offline`}>{t('common.coreErrors.offline')}</Alert.Description> : null}
            {search.note === 'signedOut' ? <Alert.Description>{t(`${K}.signedOut`)}</Alert.Description> : null}
          </Alert.Content>
        </Alert>
      ) : null}

      {state === 'expired' ? <Line testID={`${testID}-expired`}>{t(`${K}.expired`)}</Line> : null}

      {state === 'results' && found !== null ? (
        <View style={styles.block} testID={`${testID}-results`}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.summary}
            testID={`${testID}-summary`}
            accessibilityLiveRegion="polite"
            accessibilityLabel={t(`${K}.a11y.done`, { count: found.responderCount, newCount: found.newCount })}
          >
            {t(`${K}.summary`, { count: found.responderCount, newCount: found.newCount, registeredCount: found.registeredCount })}
          </Text>
          <Muted testID={`${testID}-networks`}>{t(`${K}.networksSearched`, { count: found.interfaceCount })}</Muted>
          {view?.truncated === true ? (
            <Alert status="warning" testID={`${testID}-truncated`}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{t(`${K}.truncated`, { max: SEARCH_MAX_CANDIDATES })}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          <Muted testID={`${testID}-trust`}>{t(`${K}.trustNote`)}</Muted>
          <CandidateList rows={network} testID={`${testID}-list`} viewDevice={viewDevice} t={t} />
          {development.length > 0 ? (
            <View style={styles.block} testID={`${testID}-development`}>
              <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.groupTitle}>
                {t(`${K}.developmentGroup`)}
              </Text>
              <CandidateList rows={development} testID={`${testID}-development-list`} viewDevice={viewDevice} badge t={t} />
            </View>
          ) : null}
          {hasNew ? <Muted testID={`${testID}-web-only-note`}>{t('features.capture-selector.connect.webOnlyNote')}</Muted> : null}
          <Muted testID={`${testID}-freshness`}>
            {t(`${K}.freshness`, { searchedAt: formatClock(found.completesAt), keptUntil: formatClock(found.expiresAt) })}
          </Muted>
          <Muted testID={`${testID}-owner`}>{t(`${K}.ownerNote`)}</Muted>
        </View>
      ) : null}

      {search.note === 'busy' ? <Line testID={`${testID}-busy`}>{t(`${K}.busy`)}</Line> : null}
      {search.note === 'unavailable' ? (
        <Alert status="warning" testID={`${testID}-unavailable`}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t(`${K}.unavailable`)}</Alert.Description>
            <View style={styles.actions}>
              <Button variant="outline" size="sm" isDisabled={!search.canSearch} onPress={search.start} testID={`${testID}-retry`}>
                <Button.Label>{t('common.actions.retry')}</Button.Label>
              </Button>
            </View>
          </Alert.Content>
        </Alert>
      ) : null}
      {search.limitedSeconds !== null ? (
        <Line testID={`${testID}-limited`}>
          {search.limitedSeconds > 0 ? t('common.coreErrors.limited', { seconds: search.limitedSeconds }) : t('common.coreErrors.limitedNoTime')}
        </Line>
      ) : null}

      <SearchButton search={search} label={everSearched ? t(`${K}.again`) : t(`${K}.action`)} testID={`${testID}-action`} />
      {search.gateHint !== null ? (
        <Muted testID={`${testID}-gate`} live>
          {search.gateHint}
        </Muted>
      ) : null}
    </SectionCard>
  );
}

export interface SearchButtonProps {
  search: CameraSearch;
  label: string;
  testID: string;
  size?: 'sm' | 'md';
}

/**
 * G13, one control wherever it is drawn: always in place; outside `allowed` it is disabled and the
 * reason is its accessibility hint (and visible text beside it, drawn by the caller).
 */
export function SearchButton({ search, label, testID, size = 'md' }: SearchButtonProps) {
  const pending = search.starting || search.state === 'searching';
  return (
    <Button
      variant="outline"
      size={size}
      isDisabled={!search.canSearch}
      onPress={search.start}
      testID={testID}
      accessibilityLabel={label}
      {...(search.gateHint === null ? {} : { accessibilityHint: search.gateHint })}
      {...busyState(pending, !search.canSearch)}
    >
      {pending ? <PendingSpinner color={palette.gold} testID={`${testID}-spinner`} /> : null}
      <Button.Label>{label}</Button.Label>
    </Button>
  );
}

interface CandidateListProps {
  rows: readonly CandidateRow[];
  testID: string;
  viewDevice: CameraSearchPanelProps['viewDevice'];
  /** Draw the badge on each row (the development group in real capture). */
  badge?: boolean;
  t: Translate;
}

function CandidateList({ rows, testID, viewDevice, badge = false, t }: CandidateListProps) {
  if (rows.length === 0) return null;
  return (
    <ListGroup variant="transparent" testID={testID}>
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          {index > 0 ? <Separator /> : null}
          <CandidateItem row={row} badge={badge} viewDevice={viewDevice} t={t} />
        </Fragment>
      ))}
    </ListGroup>
  );
}

function CandidateItem({ row, badge, viewDevice, t }: { row: CandidateRow; badge: boolean; viewDevice: CameraSearchPanelProps['viewDevice']; t: Translate }) {
  const makeModel = row.makeModel ?? t(`${K}.makeModelUnknown`);
  const nameKey = row.deviceId === null ? null : deviceNameKey(row.deviceId);
  const device = row.deviceId === null ? '' : nameKey === null ? row.deviceId : t('features.capture-selector.notice.device', { name: t(nameKey), id: row.deviceId });
  const statusText =
    row.mark === 'registered' ? t(`${K}.registeredAs`, { device }) : row.mark === 'new' ? t(`${K}.status.NEW`) : t(`${K}.notTestable`);
  const open = row.mark === 'registered' && row.deviceId !== null && viewDevice !== undefined ? viewDevice(row.deviceId) : null;
  return (
    <View style={styles.wrap} testID={`camera-candidate-wrap-${row.key}`}>
      <ListGroup.Item
        testID={`camera-candidate-${row.key}`}
        style={styles.item}
        accessibilityLabel={[t(`${K}.rowLabel`, { address: row.address, makeModel, status: statusText }), row.name].filter((part) => part !== null && part !== '').join(', ')}
      >
        <ListGroup.ItemContent style={styles.content}>
          {/* The address the answer came from: text, never a link (§8c.3). */}
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.address} testID={`camera-candidate-address-${row.key}`}>
            {row.address}
          </Text>
          {/* Untrusted device text: text nodes only, one line each; the full text is in the row's label. */}
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.detail} testID={`camera-candidate-model-${row.key}`}>
            {makeModel}
          </Text>
          {row.name !== null ? (
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.detail} testID={`camera-candidate-name-${row.key}`}>
              {row.name}
            </Text>
          ) : null}
          <View style={styles.chips}>
            {row.mark === 'registered' ? (
              <StatusChip size="sm" tone="default" label={t(`${K}.status.REGISTERED`)} icon={null} testID={`camera-candidate-status-${row.key}`} />
            ) : row.mark === 'new' ? (
              <StatusChip size="sm" tone="success" label={t(`${K}.status.NEW`)} icon={null} testID={`camera-candidate-status-${row.key}`} />
            ) : (
              <StatusChip size="sm" tone="warning" label={t(`${K}.notTestable`)} icon="TriangleAlert" testID={`camera-candidate-status-${row.key}`} />
            )}
            {row.mark === 'registered' && device !== '' ? (
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.detail} testID={`camera-candidate-device-${row.key}`}>
                {device}
              </Text>
            ) : null}
            {badge ? <SourceBadge kind="test" testID={`camera-candidate-source-${row.key}`} /> : null}
          </View>
          {row.mark === 'conflict' ? <Muted testID={`camera-candidate-reason-${row.key}`}>{t(`${K}.conflict`)}</Muted> : null}
          {row.mark === 'notTestable' ? <Muted testID={`camera-candidate-reason-${row.key}`}>{t(`${K}.notTestableBody`)}</Muted> : null}
          {row.addressChanged ? <Muted testID={`camera-candidate-address-changed-${row.key}`}>{t(`${K}.addressChanged`)}</Muted> : null}
          {row.mark === 'new' ? <Muted testID={`camera-candidate-web-only-${row.key}`}>{t('features.capture-selector.connect.webOnly')}</Muted> : null}
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix style={styles.suffix}>
          {row.mark === 'new' ? (
            // Flow 10 on these clients: the pointer only. Disabled, with no handler at all (D80(3)).
            <Button
              variant="outline"
              size="sm"
              isDisabled
              testID={`camera-candidate-connect-${row.key}`}
              accessibilityLabel={t('features.capture-selector.connect.actionLabel', { address: row.address })}
              accessibilityHint={t('features.capture-selector.connect.webOnly')}
            >
              <Button.Label>{t('features.capture-selector.connect.action')}</Button.Label>
            </Button>
          ) : null}
          {open !== null ? (
            <Button variant="ghost" size="sm" onPress={open} testID={`camera-candidate-view-${row.key}`}>
              <Button.Label>{t(`${K}.viewDevice`)}</Button.Label>
            </Button>
          ) : null}
        </ListGroup.ItemSuffix>
      </ListGroup.Item>
      {/* E-15 (W93-4): always mounted, last; a search row is never the selected one. */}
      <SelectionGlow selected={false} radius={radius.px.lg} testID={`camera-candidate-glow-${row.key}`} />
    </View>
  );
}

function Line({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text maxFontSizeMultiplier={1.2} style={styles.line} {...(testID === undefined ? {} : { testID })}>
      {children}
    </Text>
  );
}

function Muted({ children, testID, live = false }: { children: ReactNode; testID?: string; live?: boolean }) {
  return (
    <Text maxFontSizeMultiplier={1.2} style={styles.muted} {...(testID === undefined ? {} : { testID })} {...(live ? { accessibilityLiveRegion: 'polite' as const } : {})}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  skeletons: { gap: spacing[2] },
  block: { gap: spacing[1] },
  actions: { flexDirection: 'row', gap: spacing[1], marginTop: spacing[1] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: withAlpha(palette.gold, 0.16) },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.gold },
  wrap: { position: 'relative' },
  item: { borderRadius: radius.px.lg, paddingVertical: spacing[1], paddingHorizontal: spacing[0], gap: spacing[2], ...ROW_CARD_BORDER },
  content: { flex: 1, minWidth: 0, gap: 2 },
  suffix: { flexDirection: 'column', alignItems: 'flex-end', gap: spacing[1] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[1] },
  address: { fontFamily: fontFamily.native.mono, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  detail: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
  summary: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  groupTitle: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground, marginTop: spacing[1] },
  emptyTitle: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size + 1, lineHeight: typography.body.lineHeight, color: palette.foreground },
  line: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  muted: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size + 1, lineHeight: typography.caption.lineHeight + 2, color: palette.gray },
});
