/**
 * Evidence detail body (04_mobile_specs §4.11, MB 6), shared by the phone route
 * (`/evidence/[evidenceId]`, `variant="screen"`) and the tablet detail pane (`variant="pane"`).
 *
 * Regions in MB 6 order: D1 header · D2 hero (poster + gradient fade, status chip top right) ·
 * D3 ID (mono) and time range with the time-source badge · D4 key-values (icon, label, value) ·
 * D5 tabs Media / Metadata / Hash & Integrity (kit `Tabs`, animated indicator) · D6 actions Play,
 * Export, More (pinned under the content, so they stay reachable on the long tabs).
 *
 * A landscape phone lays it out as hero column 40% | tabs 60% (§2.4 "Evidence" row).
 *
 * **Live mode** (backend task W74; 04_client_integration_spec §14 point 7, §8.7 S3-1; 01_specs
 * MS-2; AC-C-61). The Core's actions come from `useCoreActions()` in both modes (archive: site
 * S3-1, settled by the dialog). In Live mode:
 * - Hash & Integrity is `LiveIntegrityTab`: the Core server's verdict of record (operation 41).
 * - Bundled media, the bundled manifest and the bundled package's check are shown only when the
 *   Core's media reference (operation 40) is `DEMO_PACKAGE`, joined by the suffix the Core named;
 *   while it is asked, and when it cannot be read, the Media tab says so.
 * - "Download manifest" says that it is not available: the Core serves no file (MS-1).
 * Simulated mode joins the bundled packages by the evidence number, as before.
 *
 * **Wave H C2** (gate findings G94-02 BLOCKER, G94-14 / G81-10, G94-05, G81-07, G75-03). In Live
 * mode what is shown as the item's media is decided ONLY by the item's media facts
 * (`item-facts.ts` `mediaKindOf`): streamable -> the sealed player; a bundled demo package the Core
 * named AND a demo item by the item's own members -> the bundled media with its demo label;
 * anything else, also no answer -> NO player and NO picture (the hero draws no poster and Play
 * opens nothing), the state sentence and the reason. `access.play` / `access.transcript` false: the
 * page view asks neither operation 88 nor 84 / 86 and says "not permitted". The header names an
 * interrupted recording, and the finished exports of the item are listed under the facts.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Button, ListGroup, Menu, Separator, Tabs, useToast } from 'heroui-native';
import {
  ArrowLeft,
  Briefcase,
  Clock,
  EllipsisVertical,
  HardDrive,
  MapPin,
  Play,
  Satellite,
  ShieldCheck,
  Upload,
  User,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';
import { DATE_PATTERNS, formatClock, formatDate, formatDuration } from '@dems/shared/realtime';
import { useCoreActions } from '@dems/shared/live';
import { useSimInstance } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media';
import { useLayoutClass } from '@/layout';
import { crossFadeIn, enterRise, triggerHaptic, useMotionSettings } from '@/motion';
import { reportRuntimeIssue, useCoreLink } from '@/runtime';
import { ArchiveDialog } from './archive-dialog';
import { ItemDevelopmentBadge } from './development-source';
import { consumeDetailIntent, useDetailIntent, type DetailTab } from './detail-intent';
import { EvidenceStatusChip, EvidenceSubjectChip } from './evidence-chips';
import { FinishedExports } from './finished-exports';
import { InterruptedLine } from './interrupted-line';
import { NO_DETAIL_FACTS, cameraFilesFor, isDemoItem, mediaKindOf, mediaReasonLine, readItemFacts, type MediaKind } from './item-facts';
import { clipMsFor, mediaForEvidence, posterOf } from './evidence-media';
import { fileSizeParts, integrityFor, isArchivable, isExportable, packageFor, packageTimeSource } from './evidence-model';
import { ExportSheet } from './export-sheet';
import { IntegrityTab } from './integrity-tab';
import { readItemV2 } from './item-v2';
import { LiveIntegrityTab } from './live-integrity-tab';
import { MediaTab } from './media-tab';
import { MenuItemText } from './menu-item-text';
import { MetadataTab } from './metadata-tab';
import { PlaySheet } from './play-sheet';
import { SealedPlayer } from './sealed-player';
import { TranscriptPane } from './transcript-pane';
import { useCanArchive, useEvidenceItem, useOperatorNames } from './use-evidence-data';
import { useEvidenceMediaRef } from './use-evidence-media-ref';
import type { VerifyV2Answer } from './verify-v2';

const TABS: readonly DetailTab[] = ['media', 'metadata', 'integrity'];
const TAB_LABEL_KEYS: Record<DetailTab, string> = {
  media: 'evidence.detail.tabs.media',
  metadata: 'evidence.detail.tabs.metadata',
  integrity: 'evidence.detail.tabs.integrity',
};

export interface EvidenceDetailProps {
  evidenceId: string;
  variant: 'screen' | 'pane';
}

interface PlayRequest {
  camera: VideoTrackId;
  mic: AudioTrackId;
}

export function EvidenceDetail({ evidenceId, variant }: EvidenceDetailProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const m = useMotionSettings();
  const sim = useSimInstance();
  const actions = useCoreActions();
  const live = useCoreLink().source === 'LIVE';
  const mediaRef = useEvidenceMediaRef(evidenceId);
  const { toast } = useToast();
  const { layoutClass } = useLayoutClass();
  const item = useEvidenceItem(evidenceId);
  const operatorNames = useOperatorNames();
  const canArchive = useCanArchive();
  const intent = useDetailIntent(evidenceId);

  const [tab, setTab] = useState<DetailTab>('media');
  const [handledIntent, setHandledIntent] = useState(0);
  const [verifySeq, setVerifySeq] = useState<number | null>(null);
  const [play, setPlay] = useState<PlayRequest | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  // Row 92 (M8-W3): playback of the sealed files, the transcript pane, and what the last verify run said.
  const [sealedPlay, setSealedPlay] = useState<number | null>(null);
  const [verified, setVerified] = useState<VerifyV2Answer | null>(null);
  const v2 = useMemo(() => readItemV2(item), [item]);
  const facts = useMemo(() => readItemFacts(item), [item]);
  // Wave H C2: what operation 40 states beside the item; nothing is reported before it answers.
  const detail = mediaRef.status === 'ready' ? mediaRef.detail : NO_DETAIL_FACTS;
  /** Live only: what may be shown as the item's media (G94-02). No answer is NONE: no picture, no player. */
  const mediaKind: MediaKind | null = !live ? null : mediaRef.status === 'ready' ? mediaKindOf(detail.media, facts) : 'NONE';
  /** `access.play: false`: this caller is refused - the page asks for no media session (G81-07). */
  const mayPlay = detail.access.play !== false;
  // Flow 5 step 1: the Core says the sealed files can be played through a signed media session.
  const sealedPlayback = live && mediaKind === 'SEALED' && mayPlay;
  const hasTranscript = v2.isV2 || v2.transcript !== null || v2.transcriptSha256 !== null;

  // A kebab "Verify" from the list: adjust state during render, clear the intent after commit.
  if (intent && intent.seq !== handledIntent) {
    setHandledIntent(intent.seq);
    setTab(intent.tab);
    if (intent.verify) setVerifySeq(intent.seq);
  }
  useEffect(() => {
    if (intent && intent.seq === handledIntent) consumeDetailIntent(intent);
  }, [intent, handledIntent]);

  // What the bundled lookups join by: the evidence number (Simulated), or the suffix the Core named
  // for a DEMO_PACKAGE item that IS a demo item by its own members (Live; null while asked, for
  // NONE, without an answer, and for every item this Core sealed - G94-02, G89-09).
  const liveSuffix = mediaKind === 'DEMO' ? (detail.media?.packageSuffix ?? null) : null;
  const bundleKey = live ? liveSuffix : evidenceId;
  const pkg = useMemo(() => (bundleKey === null ? null : packageFor(bundleKey)), [bundleKey]);
  const media = useMemo(() => (bundleKey === null ? null : mediaForEvidence(bundleKey)), [bundleKey]);
  const timeSource = useMemo(() => (bundleKey === null ? null : packageTimeSource(bundleKey)), [bundleKey]);
  // Simulated only: in Live mode the integrity shown is the Core's verdict (`LiveIntegrityTab`).
  const integrity = useMemo(() => (item && !live ? integrityFor(item, sim.clock.now()) : null), [item, live, sim]);

  const header =
    variant === 'screen' ? (
      <View style={[styles.header, layoutClass === 'compact-landscape' ? styles.headerCondensed : null]}>
        <Button
          isIconOnly
          variant="ghost"
          size="md"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/evidence'))}
          accessibilityLabel={t('features.evidence.header.back')}
          testID="evidence-detail-back"
        >
          <ArrowLeft size={22} color={palette.gold} />
        </Button>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.headerTitle}>
          {t('features.evidence.header.detailTitle')}
        </Text>
      </View>
    ) : (
      <View style={styles.paneHeader}>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.headerTitle}>
          {t('features.evidence.header.detailTitle')}
        </Text>
      </View>
    );

  if (!item || (!live && !integrity)) {
    return (
      <View style={styles.root} testID="evidence-detail-missing">
        {header}
        <View style={styles.missing}>
          <Text maxFontSizeMultiplier={1.2} style={styles.body}>
            {t('features.evidence.detail.notFound')}
          </Text>
          {variant === 'screen' ? (
            <Button variant="outline" onPress={() => router.replace('/evidence')}>
              <Button.Label>{t('features.evidence.detail.notFoundBack')}</Button.Label>
            </Button>
          ) : null}
        </View>
      </View>
    );
  }

  const size = fileSizeParts(item.sizeBytes);
  const noMediaReason = mediaReasonLine(detail.media?.source === 'NONE' ? detail.media.reason : null);
  const exportable = isExportable(item.status);
  const archivable = canArchive && isArchivable(item.status);
  const factRows: FactRow[] = [
    { id: 'caseNumber', icon: Briefcase, label: t('evidence.detail.fields.caseNumber'), value: item.caseNumber, mono: true },
    {
      id: 'subject',
      icon: User,
      label: t('evidence.detail.fields.subject'),
      value: (
        <View style={styles.subjectValue}>
          <Text maxFontSizeMultiplier={1.2} style={styles.factValue} numberOfLines={1}>
            {item.subjectName}
          </Text>
          <EvidenceSubjectChip subjectType={item.subjectType} />
        </View>
      ),
    },
    { id: 'investigator', icon: UserRound, label: t('evidence.detail.fields.investigator'), value: operatorNames[item.investigatorId] ?? item.investigatorId },
    { id: 'location', icon: MapPin, label: t('evidence.detail.fields.location'), value: item.room },
    { id: 'duration', icon: Clock, label: t('evidence.detail.fields.duration'), value: formatDuration(item.durationMs), mono: true },
    { id: 'fileSize', icon: HardDrive, label: t('evidence.detail.fields.fileSize'), value: t(`common.units.${size.unit}`, { value: size.value }) },
    { id: 'status', icon: ShieldCheck, label: t('evidence.detail.fields.status'), value: <EvidenceStatusChip status={item.status} /> },
  ];

  const hero = (
    <Animated.View entering={enterRise(0, m, { distance: 'riseLg' })} style={styles.heroBlock}>
      <View style={[styles.hero, variant === 'pane' ? styles.heroPane : null]} testID="evidence-detail-hero">
        {/* G94-02: in Live mode a picture is drawn only for bundled demo media of a demo item - never a fallback still. */}
        {!live || (mediaKind === 'DEMO' && media !== null) ? (
          <Image
            source={posterOf(media)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={0}
            accessibilityLabel={t('features.evidence.detail.sealedHero', { id: item.id })}
          />
        ) : null}
        <LinearGradient colors={[withAlpha(palette.black, 0), withAlpha(palette.black, 0.9)]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroChip}>
          <EvidenceStatusChip status={item.status} size="md" testID="evidence-detail-status" />
        </View>
        <View style={styles.heroBadge}>
          <ItemDevelopmentBadge item={item} testID="evidence-detail-development" />
        </View>
        <View style={styles.heroText}>
          <Text maxFontSizeMultiplier={1.2} selectable style={styles.heroId} testID="evidence-detail-id">
            {item.id}
          </Text>
          <View style={styles.timeRow}>
            {timeSource ? (
              <View style={styles.timeBadge} accessibilityLabel={t('features.evidence.detail.timeSource', { source: timeSource })}>
                <Satellite size={12} color={palette.gold} />
                <Text maxFontSizeMultiplier={1.2} style={styles.timeBadgeText}>
                  {timeSource}
                </Text>
              </View>
            ) : null}
            <Text maxFontSizeMultiplier={1.2} style={styles.timeText} testID="evidence-detail-time">
              {t('evidence.detail.timeRange', {
                start: formatDate(item.recordedAt, DATE_PATTERNS.dateTime),
                end: formatClock(item.endedAt),
              })}
            </Text>
          </View>
          <InterruptedLine facts={facts} withCause testID="evidence-detail-interrupted" />
        </View>
      </View>
      <Animated.View entering={enterRise(1, m)}>
        <FactList rows={factRows} />
      </Animated.View>
      {live && mediaRef.status === 'ready' ? <FinishedExports exports={detail.exports} exported={item.status === 'EXPORTED'} /> : null}
    </Animated.View>
  );

  const tabs = (
    <Animated.View entering={enterRise(2, m)} style={styles.tabsBlock}>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          triggerHaptic('tabSelect');
          setTab(value as DetailTab);
        }}
        variant="primary"
      >
        <Tabs.List>
          <Tabs.Indicator />
          {TABS.map((key) => (
            <Tabs.Trigger key={key} value={key} testID={`evidence-tab-${key}`}>
              <Tabs.Label>{t(TAB_LABEL_KEYS[key])}</Tabs.Label>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
      <Animated.View key={tab} entering={crossFadeIn(m)} style={styles.tabBody}>
        {tab === 'media' && live && mediaRef.status === 'loading' ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="evidence-media-checking">
            {t('features.evidence.media.checking')}
          </Text>
        ) : tab === 'media' && live && mediaRef.status === 'unavailable' ? (
          // No answer of operation 40: no media source is known, so nothing is shown (G94-02).
          <View style={styles.mediaPanel} testID="evidence-media-panel-none">
            <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="evidence-media-unavailable">
              {t('evidence.itemFacts.media.reason.NOT_REPORTED')}
            </Text>
          </View>
        ) : tab === 'media' ? (
          <View style={styles.mediaPanel} testID={`evidence-media-panel-${sealedPlayback ? 'sealed' : mediaKind === null || mediaKind === 'DEMO' ? 'bundled' : 'none'}`}>
            {sealedPlayback ? (
              <SealedPlayer
                evidenceId={item.id}
                durationMs={item.durationMs}
                item={v2}
                fileIds={cameraFilesFor(detail.media, facts)}
                sources={verified?.sources ?? null}
                failedFragments={verified?.failedFragments}
                playToken={sealedPlay}
              />
            ) : mediaKind === 'SEALED' ? (
              // Streamable, and this caller is refused: no player and no request (G81-07).
              <View style={styles.noMedia} testID="evidence-media-may-not-play">
                <Text maxFontSizeMultiplier={1.2} style={styles.noMediaTitle}>
                  {t('evidence.itemFacts.media.mayNotPlay')}
                </Text>
              </View>
            ) : mediaKind === 'NONE' ? (
              // G94-02 / G94-14: neither streamable nor bundled demo media of a demo item - the state and its reason.
              <View style={styles.noMedia} testID="evidence-media-none" accessibilityLabel={t('evidence.itemFacts.media.noneTitle')}>
                <Text maxFontSizeMultiplier={1.2} style={styles.noMediaTitle}>
                  {t('evidence.itemFacts.media.none')}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={styles.note} testID="evidence-media-none-reason">
                  {t(noMediaReason.key, noMediaReason.options)}
                </Text>
              </View>
            ) : (
              <MediaTab
                media={media}
                durationMs={item.durationMs}
                clipMs={clipMsFor(pkg)}
                demoLabel={live}
                onOpenCamera={(camera) => setPlay({ camera, mic: 'AUDIO-01' })}
                onOpenMic={(mic) => setPlay({ camera: 'VIDEO-01', mic })}
              />
            )}
            {hasTranscript ? <TranscriptPane evidenceId={item.id} item={v2} operatorNames={operatorNames} access={detail.access.transcript} /> : null}
          </View>
        ) : tab === 'metadata' ? (
          // E2E-T-6 (E-fix FX-M2): an item without a package shows its record (the Core's in Live mode).
          <MetadataTab
            evidenceId={item.id}
            pkg={pkg}
            item={item}
            live={live}
            mediaStatus={mediaRef.status === 'loading' || mediaRef.status === 'unavailable' ? mediaRef.status : 'ready'}
            demoItem={isDemoItem(facts)}
          />
        ) : live || !integrity ? (
          <LiveIntegrityTab
            key={`integrity-${verifySeq ?? 0}`}
            item={item}
            operatorNames={operatorNames}
            autoVerify={verifySeq !== null}
            bundled={pkg}
            onV2Answer={setVerified}
          />
        ) : (
          <IntegrityTab
            key={`integrity-${verifySeq ?? 0}`}
            item={item}
            integrity={integrity}
            operatorNames={operatorNames}
            autoVerify={verifySeq !== null}
          />
        )}
      </Animated.View>
    </Animated.View>
  );

  /** Live: Play has something to open - the sealed player, or bundled demo media of a demo item. Simulated: as before. */
  const playable = !live || sealedPlayback || (mediaKind === 'DEMO' && media !== null);
  const actionBar = (
    <View style={styles.actions} testID="evidence-detail-actions">
      <Button
        variant="tertiary"
        style={styles.action}
        isDisabled={!playable}
        accessibilityHint={playable ? undefined : t(mediaKind === 'SEALED' ? 'evidence.itemFacts.media.mayNotPlay' : 'evidence.itemFacts.media.noneTitle')}
        onPress={() => {
          // G94-02: without media of this item nothing opens - never a placeholder player.
          if (!playable) return;
          triggerHaptic('primaryPress');
          if (sealedPlayback) {
            // The sealed files play on the Media tab, through the media session of operation 88.
            setTab('media');
            setSealedPlay((previous) => (previous ?? 0) + 1);
          } else setPlay({ camera: 'VIDEO-01', mic: 'AUDIO-01' });
        }}
        testID="evidence-action-play"
      >
        <Play size={18} color={playable ? palette.gold : palette.gray} fill={playable ? palette.gold : palette.gray} />
        <Button.Label>{t('evidence.detail.actions.play')}</Button.Label>
      </Button>
      <Button
        variant="outline"
        style={styles.action}
        isDisabled={!exportable}
        onPress={() => setExportOpen(true)}
        testID="evidence-action-export"
        accessibilityHint={exportable ? undefined : t('features.evidence.actions.exportDisabled')}
      >
        <Upload size={18} color={exportable ? palette.gold : palette.gray} />
        <Button.Label>{t('evidence.detail.actions.export')}</Button.Label>
      </Button>
      <Menu>
        <Menu.Trigger asChild>
          <Button variant="outline" style={styles.action} testID="evidence-action-more">
            <EllipsisVertical size={18} color={palette.gold} />
            <Button.Label>{t('evidence.detail.actions.more')}</Button.Label>
          </Button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Overlay />
          <Menu.Content presentation="popover" width={220} placement="top" align="end">
            <Menu.Item
              testID="evidence-more-archive"
              isDisabled={!archivable}
              variant="danger"
              onPress={() => setArchiveId(item.id)}
            >
              {/* CF-M2 (R-T-1): title and reason stacked, so a disabled item keeps its visible title. */}
              <MenuItemText
                title={t('features.evidence.actions.archive')}
                description={canArchive ? null : t('features.evidence.actions.archiveDisabled')}
                testID="evidence-more-archive-text"
              />
            </Menu.Item>
            <Menu.Item
              testID="evidence-more-manifest"
              onPress={() =>
                toast.show({ variant: 'default', label: t(live ? 'features.evidence.actions.manifestToastLive' : 'features.evidence.actions.manifestToast') })
              }
            >
              <Menu.ItemTitle>{t('features.evidence.actions.downloadManifest')}</Menu.ItemTitle>
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu>
    </View>
  );

  const landscape = variant === 'screen' && layoutClass === 'compact-landscape';

  return (
    <View style={styles.root} testID={`evidence-detail-${variant}`}>
      {header}
      {landscape ? (
        <View style={styles.split}>
          <ScrollView style={styles.splitHero} contentContainerStyle={styles.content}>
            {hero}
          </ScrollView>
          <ScrollView style={styles.splitTabs} contentContainerStyle={styles.content}>
            {tabs}
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="evidence-detail-scroll">
          {hero}
          {tabs}
        </ScrollView>
      )}
      {actionBar}
      <PlaySheet
        isOpen={play !== null && playable && !sealedPlayback}
        onClose={() => setPlay(null)}
        evidenceId={item.id}
        media={media}
        durationMs={item.durationMs}
        clipMs={clipMsFor(pkg)}
        recordedAt={item.recordedAt}
        initialCamera={play?.camera}
        initialMic={play?.mic}
        live={live}
      />
      <ExportSheet isOpen={exportOpen} onClose={() => setExportOpen(false)} evidenceId={item.id} />
      <ArchiveDialog
        evidenceId={archiveId}
        onOpenChange={(open) => (open ? undefined : setArchiveId(null))}
        archive={(id) => {
          try {
            return actions.archiveEvidence(id);
          } catch (error) {
            reportRuntimeIssue('warn', 'evidence.archive.detail', error, { evidenceId: id });
            throw error;
          }
        }}
      />
    </View>
  );
}

interface FactRow {
  id: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  mono?: boolean;
}

/** D4: kit `ListGroup` rows with an icon prefix (the `KeyValueList` recipe has no icon slot). */
function FactList({ rows }: { rows: readonly FactRow[] }) {
  return (
    <ListGroup variant="default" className="rounded-xl" testID="evidence-detail-facts">
      {rows.map((row, index) => {
        const Icon = row.icon;
        const text = typeof row.value === 'string';
        return (
          <View key={row.id}>
            {index > 0 ? <Separator /> : null}
            <ListGroup.Item
              testID={`evidence-fact-${row.id}`}
              accessible={text}
              accessibilityLabel={text ? `${row.label}, ${String(row.value)}` : undefined}
              className="gap-3 py-2"
            >
              <ListGroup.ItemPrefix>
                <Icon size={16} color={palette.gray} />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <Text maxFontSizeMultiplier={1.2} style={styles.factLabel}>
                  {row.label}
                </Text>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix style={styles.factSuffix}>
                {text ? (
                  <Text maxFontSizeMultiplier={1.2} selectable={row.mono} numberOfLines={1} style={[styles.factValue, row.mono ? styles.mono : null]}>
                    {row.value}
                  </Text>
                ) : (
                  row.value
                )}
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
          </View>
        );
      })}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[1] },
  headerCondensed: { minHeight: 48 },
  paneHeader: { minHeight: 64, justifyContent: 'center', paddingHorizontal: spacing[3] },
  headerTitle: { fontFamily: fontFamily.native.semibold, fontSize: typography.h2.size, lineHeight: typography.h2.lineHeight, color: palette.foreground },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], gap: spacing[3] },
  split: { flex: 1, flexDirection: 'row' },
  splitHero: { flex: 2 },
  splitTabs: { flex: 3 },
  missing: { padding: spacing[3], gap: spacing[2] },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  note: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  heroBlock: { gap: spacing[2] },
  hero: {
    height: 196,
    borderRadius: radius.px.xl,
    overflow: 'hidden',
    backgroundColor: derived.surfaceSecondary,
    borderWidth: 1,
    borderColor: derived.border,
    justifyContent: 'flex-end',
  },
  heroPane: { height: 232 },
  // A dark backing keeps the soft (15% alpha) status chip legible over a bright poster.
  heroBadge: { position: 'absolute', top: spacing[2], left: spacing[2], borderRadius: radius.px.full, backgroundColor: withAlpha(palette.black, 0.7) },
  mediaPanel: { gap: spacing[3] },
  noMedia: { gap: spacing[1], padding: spacing[2], borderRadius: radius.px.lg, borderWidth: 1, borderColor: derived.border, backgroundColor: derived.surfaceSecondary },
  noMediaTitle: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  heroChip: { position: 'absolute', top: spacing[2], right: spacing[2], borderRadius: radius.px.full, backgroundColor: withAlpha(palette.black, 0.7) },
  heroText: { padding: spacing[2], gap: 4 },
  heroId: { fontFamily: fontFamily.native.monoMedium, fontSize: typography.h2.size, lineHeight: typography.h2.lineHeight, color: palette.foreground },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.px.full,
    borderWidth: 1,
    borderColor: withAlpha(palette.gold, 0.5),
    backgroundColor: withAlpha(palette.black, 0.4),
  },
  timeBadgeText: { fontFamily: fontFamily.native.medium, fontSize: 11, lineHeight: 14, color: palette.gold },
  timeText: { fontFamily: fontFamily.native.mono, fontSize: 13, lineHeight: 18, color: derived.foreground2, fontVariant: ['tabular-nums'] },
  factLabel: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.gray },
  factSuffix: { maxWidth: '62%', alignItems: 'flex-end' },
  factValue: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground, flexShrink: 1 },
  mono: { fontFamily: fontFamily.native.mono },
  subjectValue: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexShrink: 1 },
  tabsBlock: { gap: spacing[2] },
  tabBody: { minHeight: 120 },
  actions: {
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[1],
    paddingBottom: spacing[2],
    borderTopWidth: 1,
    borderTopColor: derived.separator,
    backgroundColor: palette.black,
  },
  action: { flex: 1 },
});
