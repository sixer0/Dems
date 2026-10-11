import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Button, Card, Chip, Dropdown, Label, Skeleton, Spinner, Tabs, toast } from '@heroui/react'
import type { Key } from '@heroui/react'
import { animate, motion } from 'motion/react'
import { Archive, Copy, Download, FileVideo, MoreHorizontal, Play, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { formatUtcOffset } from '@dems/shared/realtime'
import { Permission, interruptedFactOf, selectCan, useSim, type EvidenceItem } from '@dems/shared/sim'
import { useRouteEnterDelay } from '@/components/shell/shell-motion-context'
import { deferEffectStart } from '@/lib/effect-start'
import { useMotionPolicy } from '@/motion'
import { EvidenceStatusChip, SubjectTypeChip } from './chips'
import { copyText } from './clipboard'
import { DETAIL_BEAT_MS, usePanelVariants } from './choreography'
import { useEvidenceAssets } from './demo-assets'
import { ItemDevelopmentBadge } from './development-source'
import { saveBytes } from './export-download'
import { ExportWizard } from './export-wizard'
import { FinishedExports } from './finished-exports'
import { SealedFormat } from './sealed-format'
import { IntegrityTab } from './integrity-tab'
import { isDemoItem, mediaKindOf, playableFilesOf } from './item-facts'
import { InterruptedMark, MediaNone } from './item-marks'
import { readItemV2 } from './item-v2'
import { logEvidenceError } from './log'
import { MediaTab } from './media-tab'
import { MetadataTab } from './metadata-tab'
import {
  ARCHIVABLE_STATUSES,
  buildEvidenceRow,
  byteSize,
  EXPORTABLE_STATUSES,
  formatEvidenceDuration,
  formatWibClockSeconds,
  formatWibDateTime,
} from './model'
import { consumeAutoVerify, takeHeaderOrigin, type HeaderOrigin } from './pending-actions'
import { SealedPlayer } from './sealed-player'
import { selectOperators } from './selectors'
import { TranscriptPane } from './transcript-pane'
import { useArchiveEvidence } from './use-archive'
import { rowForMedia, useEvidenceMedia, type EvidenceMediaState } from './use-evidence-media'
import { useEvidenceVerification } from './use-verification'

const detailRoute = getRouteApi('/_app/evidence/$evidenceId')

type TabKey = 'media' | 'metadata' | 'integrity'
const TABS: TabKey[] = ['media', 'metadata', 'integrity']

/**
 * Evidence detail body (`/evidence/$evidenceId`; 01_specs §14.5.3; research/04 §5.1; mobile MB 6;
 * 03_motion_spec M-PG-EVID), lazily loaded under the page shell in `index.tsx`. Header block
 * (VIDEO-01 still with the status chip, ID and time range, key-values; Play, Export and More), then
 * the Media, Metadata and Hash & Integrity tabs (URL `?tab=`). The header's ID block grows out of the
 * clicked row (the H-M1 stored-rect fallback of `layoutId="evidence-<id>-header"`); reduced motion
 * cross-fades it.
 *
 * Live mode (backend task, plan row W69): the Core server's media reference (operation 40, MS-2)
 * decides whether the bundled demo package belongs to the item; the body waits for it behind the
 * skeleton, so the media, the poster and the bundled check never appear and vanish again. Without
 * an answer the page shows no bundled media and says so on the header chip. Archive is settle site
 * B-1 (`use-archive.ts`).
 *
 * Schema v2 (blueprint row 92, M8-W3; UX spec flows 5 and 6): when the Core answers
 * `media.source: LIVE_STREAM`, the Media tab plays the SEALED camera files through the media
 * session of operation 88 (`sealed-player.tsx`) with the audio-source band, and Play opens it. An
 * item that carries a transcript shows the transcript pane (`transcript-pane.tsx`) on the same tab,
 * in both data modes. An item the Core recorded from development sources carries the badge in the
 * header (`development-source.tsx`). The v1 demo items keep everything they had.
 */
export function EvidenceDetailBody({ item }: { item: EvidenceItem }) {
  const search = detailRoute.useSearch()
  const navigateDetail = detailRoute.useNavigate()
  const media = useEvidenceMedia(item.id)
  if (media.status === 'loading') return <MediaReferenceSkeleton />
  return <EvidenceDetail item={item} media={media} tab={search.tab ?? 'media'} onTab={(tab) => void navigateDetail({ search: { tab }, replace: true })} />
}

/** The detail body's shape while the Core's media reference is on its way (Live mode only; M-C-24). */
function MediaReferenceSkeleton() {
  const m = useMotionPolicy()
  const animation = m.reduced ? 'none' : 'shimmer'
  return (
    <div className="evi-body evi-body-skeleton" data-testid="evidence-media-loading" aria-busy="true">
      <Skeleton animationType={animation} className="evi-skeleton-block evi-skeleton-header" />
      <Skeleton animationType={animation} className="evi-skeleton-block evi-skeleton-panel" />
    </div>
  )
}

interface EvidenceDetailProps {
  item: EvidenceItem
  media: EvidenceMediaState
  tab: TabKey
  onTab: (tab: TabKey) => void
}

function EvidenceDetail({ item, media, tab, onTab }: EvidenceDetailProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const live = useCoreMode() === CoreMode.LIVE
  const { archive, control: archiving } = useArchiveEvidence()
  const operators = useSim(selectOperators)
  const canArchive = useSim((s) => selectCan(s, Permission.EVIDENCE_REVIEW))
  const { urlFor, load } = useEvidenceAssets()
  const routeDelay = useRouteEnterDelay()
  const row = useMemo(() => rowForMedia(buildEvidenceRow(item, operators, { live }), media), [item, live, media, operators])
  const verification = useEvidenceVerification(row)
  const v2 = useMemo(() => readItemV2(item), [item])
  // Flow 5 step 1: the Core says the sealed files can be played through a signed media session.
  // Wave H C2 (G94-02): in Live mode the source of the player is decided ONLY by the item's media facts
  // (`mediaKindOf`): streamable -> the sealed player; demo AND a demo item -> bundled media under its
  // label; anything else, a member that is absent, or no answer -> no player and no picture.
  const facts = media.facts
  const mediaKind = live ? mediaKindOf(facts, item) : row.pkg ? 'DEMO' : 'NONE'
  const demoItem = !live || isDemoItem(item)
  const sealedPlayback = live && mediaKind === 'STREAM'
  // The Core's own word for this caller (G81-07): false asks nothing on a page view. null: not reported.
  const access = facts?.access ?? { play: null, transcript: null, export: null }
  const fileIds = useMemo(() => (sealedPlayback ? playableFilesOf(facts, item) : null), [facts, item, sealedPlayback])
  // No player, no picture and no demo words: a Live item that is not a demo item and is not streamable.
  const noMedia = live && mediaKind === 'NONE' && !demoItem && media.status !== 'unavailable'
  const hasTranscript = v2.isV2 || v2.transcript !== null || v2.transcriptSha256 !== null
  // The source classes of the last verify run on this page (never the current device list).
  const verifiedSources = verification.state.v2?.sources ?? null
  const [playToken, setPlayToken] = useState<number | null>(null)
  const onPlayHandled = useCallback(() => setPlayToken(null), [])
  const [wizard, setWizard] = useState({ key: 0, open: false })

  // List "Verify" hand-off: start once on arrival (StrictMode-safe: the ref survives the double render).
  const autoVerify = useRef<boolean | null>(null)
  if (autoVerify.current === null) autoVerify.current = consumeAutoVerify(item.id)
  const runRef = useRef(verification.run)
  useEffect(() => {
    runRef.current = verification.run
  })
  // The start waits one task, so React StrictMode's simulated unmount cancels the first start instead
  // of sending a second verification to the Core in Live mode (plan row W69; the shared helper, W0).
  useEffect(() => {
    if (!autoVerify.current) return undefined
    return deferEffectStart(() => void runRef.current())
  }, [])

  // Header flight from the clicked row (H-M1 stored-rect fallback of the R5 shared element). The
  // origin is read once per item and kept, so StrictMode's second effect run replays the same flight.
  const flightRef = useRef<HTMLDivElement>(null)
  const originRef = useRef<{ id: string; origin: HeaderOrigin | null } | null>(null)
  useLayoutEffect(() => {
    if (originRef.current?.id !== item.id) originRef.current = { id: item.id, origin: takeHeaderOrigin(item.id) }
    const origin = originRef.current.origin
    const element = flightRef.current
    if (!element) return undefined
    if (!origin || !m.flags.sharedLayout) {
      if (!m.reduced) return undefined
      const fade = animate(element, { opacity: [0, 1] }, { duration: m.seconds(160) })
      return () => fade.stop()
    }
    element.style.transform = ''
    const box = element.getBoundingClientRect()
    const dx = origin.rect.left - box.left
    const dy = origin.rect.top - box.top
    const scale = box.height > 0 ? Math.min(1.2, Math.max(0.6, origin.rect.height / box.height)) : 1
    element.style.transformOrigin = '0 0'
    // Hold the origin pose while the route enter delay runs, then fly home on the gentle spring.
    element.style.transform = `translateX(${dx}px) translateY(${dy}px) scale(${scale})`
    const flight = animate(element, { x: [dx, 0], y: [dy, 0], scale: [scale, 1] }, { ...m.transitions.layout, delay: m.seconds(routeDelay) })
    return () => {
      flight.stop()
      element.style.transform = ''
    }
    // Runs once per item; the origin is kept in `originRef`.
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const headerVariants = usePanelVariants(DETAIL_BEAT_MS.header)
  const tabsVariants = usePanelVariants(DETAIL_BEAT_MS.tabs)

  const exportable = EXPORTABLE_STATUSES.includes(item.status)
  const archivable = canArchive && ARCHIVABLE_STATUSES.includes(item.status) && !archiving.busy
  const size = byteSize(item.sizeBytes)
  const poster = urlFor(row.posterPath)

  const onPlay = () => {
    setPlayToken(Date.now())
    if (tab !== 'media') onTab('media')
  }

  const downloadManifest = useCallback(async () => {
    try {
      if (row.pkg) {
        const bytes = await load(row.pkg.files.manifest.path)
        saveBytes(bytes, `${row.id}-manifest.demo.json`, 'application/json')
      } else {
        const text = `${JSON.stringify({ simulated: true, evidenceId: row.id, manifestHash: item.manifestHash, tracks: item.tracks, signature: item.signature }, null, 2)}\n`
        saveBytes(text, `${row.id}-manifest.simulated.json`, 'application/json')
      }
      toast.success(t('evidence.detail.manifestDownloaded'))
    } catch (error) {
      logEvidenceError('detail.downloadManifest', error, { evidenceId: row.id })
      toast.danger(t('evidence.detail.manifestDownloadFailed'))
    }
  }, [item.manifestHash, item.signature, item.tracks, load, row.id, row.pkg, t])

  const onMore = (key: Key) => {
    if (key === 'copy') {
      void copyText(item.id, { ok: t('evidence.detail.idCopied'), failed: t('evidence.integrity.copyFailed') }, 'detail.copyId')
    } else if (key === 'manifest') {
      void downloadManifest()
    } else if (key === 'archive') {
      archive(item.id, 'detail')
    }
  }

  // §3.2: in Live mode an item without a bundled package shows the Core's record, never "simulated".
  const packageChip = row.pkg
    ? { kind: 'demo', label: t('evidence.demo.package') }
    : !live
      ? { kind: 'simulated', label: t('common.simulated.chip') }
      : media.status === 'unavailable'
        ? { kind: 'unavailable', label: t('evidence.live.mediaUnavailable') }
        : { kind: 'core', label: t('evidence.live.coreRecord') }

  return (
    <div className="evi-body" data-testid="evidence-detail-body">
      <motion.section variants={headerVariants} initial="hidden" animate="visible">
        <Card className="evi-detail-header" data-testid="evidence-detail-header">
          <div className="evi-detail-media">
            <div className="evi-detail-still">
              {poster ? (
                <img src={poster} alt={t('evidence.preview.posterAlt', { id: item.id })} decoding="async" />
              ) : (
                <span className="evi-preview-still-empty" data-testid="evidence-detail-still-empty">
                  <FileVideo className="size-8" aria-hidden="true" />
                  {/* FXR-W W92-11 (D217): a failed lookup says what the chip says, as the Media and Metadata tabs do (CF-W). */}
                  {/* Wave H C2 (G94-14 / G81-10): "No DEMO media" is said of a demo item only. */}
                  <span>
                    {live && media.status === 'unavailable'
                      ? t('evidence.live.mediaUnavailable')
                      : sealedPlayback
                        ? t('evidence.itemFacts.web.noPreview')
                        : noMedia
                          ? t('evidence.itemFacts.media.noneTitle')
                          : t('evidence.media.noMedia')}
                  </span>
                </span>
              )}
            </div>
            <div className="evi-still-meta">
              <EvidenceStatusChip status={item.status} size="md" />
              <Chip size="sm" variant="secondary" className="evi-demo-chip" data-testid="evidence-package-chip" data-package={packageChip.kind}>
                <Chip.Label>{packageChip.label}</Chip.Label>
              </Chip>
              <ItemDevelopmentBadge item={item} testId="evidence-detail-development" />
              <InterruptedMark item={item} testId="evidence-interrupted" />
            </div>
          </div>

          <div className="evi-detail-info">
            <div ref={flightRef} className="evi-detail-heading" data-flight={item.id}>
              <span className="evi-id evi-id-xl" data-testid="evidence-detail-id" aria-label={item.id}>
                {/* The sequence suffix is the join key (D61): shown brighter than the dated prefix. */}
                <span className="evi-id-prefix" aria-hidden="true">
                  {row.suffix ? item.id.slice(0, item.id.length - row.suffix.length) : item.id}
                </span>
                {row.suffix ? (
                  <span className="evi-id-suffix" aria-hidden="true">
                    {row.suffix}
                  </span>
                ) : null}
              </span>
              <span className="evi-caption">
                {/* AC-74: the zone label on every timestamp (F45-04). */}
                {`${t('evidence.detail.timeRange', { start: formatWibDateTime(item.recordedAt), end: formatWibClockSeconds(item.endedAt) })} UTC${formatUtcOffset()}`}
              </span>
            </div>
            <dl className="evi-kv evi-kv-grid">
              <div>
                <dt>{t('evidence.detail.fields.caseNumber')}</dt>
                <dd className="evi-mono">{item.caseNumber}</dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.subject')}</dt>
                <dd className="evi-kv-inline">
                  <span>{item.subjectName}</span>
                  <SubjectTypeChip type={item.subjectType} />
                </dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.investigator')}</dt>
                <dd>{row.investigatorName}</dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.location')}</dt>
                <dd>{item.room}</dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.duration')}</dt>
                <dd className="evi-mono">{formatEvidenceDuration(item.durationMs)}</dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.fileSize')}</dt>
                <dd>{t(`common.units.${size.unit}`, { value: size.value })}</dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.status')}</dt>
                <dd>
                  <EvidenceStatusChip status={item.status} />
                </dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.session')}</dt>
                <dd className="evi-mono">{item.sessionId}</dd>
              </div>
            </dl>
            {/* LB-1: the kit's Button drops `aria-busy` (F63-2), so the action row carries it while an archive is out. */}
            <div className="evi-detail-actions" aria-busy={archiving.busy || undefined}>
              <Button variant="primary" onPress={onPlay} isDisabled={(!row.pkg && !sealedPlayback) || (sealedPlayback && access.play === false)} data-testid="evidence-play">
                <Play className="size-4" aria-hidden="true" />
                {t('evidence.detail.actions.play')}
              </Button>
              <Button variant="outline" isDisabled={!exportable} onPress={() => setWizard((previous) => ({ key: previous.key + 1, open: true }))} data-testid="evidence-export">
                <Share2 className="size-4" aria-hidden="true" />
                {t('evidence.detail.actions.export')}
              </Button>
              <Dropdown>
                <Button
                  variant="ghost"
                  aria-label={t('evidence.detail.actions.more')}
                  data-testid="evidence-more"
                  isPending={archiving.pending}
                  data-pending={archiving.pending ? 'true' : undefined}
                >
                  {archiving.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <MoreHorizontal className="size-4" aria-hidden="true" />}
                  {t('evidence.detail.actions.more')}
                </Button>
                <Dropdown.Popover placement="bottom end" className="min-w-[220px]">
                  <Dropdown.Menu aria-label={t('evidence.detail.actions.more')} disabledKeys={archivable ? [] : ['archive']} onAction={onMore}>
                    <Dropdown.Item id="copy" textValue={t('evidence.detail.actions.copyId')}>
                      <Copy className="size-4" aria-hidden="true" />
                      <Label>{t('evidence.detail.actions.copyId')}</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="manifest" textValue={t('evidence.detail.actions.downloadManifest')}>
                      <Download className="size-4" aria-hidden="true" />
                      <Label>{t('evidence.detail.actions.downloadManifest')}</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="archive" textValue={t('evidence.detail.actions.archive')}>
                      <Archive className="size-4" aria-hidden="true" />
                      <Label>{t('evidence.detail.actions.archive')}</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          </div>
        </Card>
      </motion.section>

      {/* Wave H C2 (G94-05): the finished exports the Core reports for this item, each with its download. */}
      {live && facts !== null && (item.status === 'EXPORTED' || (facts.exports?.length ?? 0) > 0) ? <FinishedExports evidenceId={item.id} facts={facts} /> : null}

      {/* Fix wave L (G89c-04): the format the signed manifest states per track, and the Core's notice of a stream that differed. */}
      {live ? <SealedFormat facts={facts} /> : null}

      <motion.section variants={tabsVariants} initial="hidden" animate="visible">
        <Card className="evi-tabs-card">
          <Tabs selectedKey={tab} onSelectionChange={(key) => onTab(String(key) as TabKey)} className="evi-tabs">
            <Tabs.ListContainer>
              <Tabs.List aria-label={t('evidence.detail.tabsLabel')}>
                {TABS.map((key) => (
                  <Tabs.Tab key={key} id={key} data-testid={`evidence-tab-${key}`}>
                    {t(`evidence.detail.tabs.${key}`)}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {TABS.map((key) => (
              <Tabs.Panel key={key} id={key} className="evi-tab-panel">
                <motion.div
                  key={key}
                  initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={m.reduced ? m.transitions.crossFade : m.transitions.enter}
                >
                  {key === 'media' ? (
                    <div className="evi-body" data-testid="evidence-media-panel" data-playback={sealedPlayback ? 'sealed' : row.pkg ? 'bundled' : live ? 'none' : 'bundled'}>
                      {sealedPlayback ? (
                        <SealedPlayer evidenceId={item.id} durationMs={item.durationMs} item={v2} sources={verifiedSources} failedFragments={verification.state.v2?.failedFragments} playToken={playToken} onPlayHandled={onPlayHandled} fileIds={fileIds} mayPlay={access.play} interrupted={interruptedFactOf(item).interrupted === true} />
                      ) : noMedia ? (
                        <MediaNone facts={facts} />
                      ) : (
                        <MediaTab row={row} playToken={playToken} onPlayHandled={onPlayHandled} mediaUnavailable={media.status === 'unavailable'} />
                      )}
                      {hasTranscript ? <TranscriptPane evidenceId={item.id} item={v2} mayRead={access.transcript} /> : null}
                    </div>
                  ) : key === 'metadata' ? (
                    <MetadataTab row={row} mediaUnavailable={media.status === 'unavailable'} />
                  ) : (
                    <IntegrityTab row={row} verification={verification} />
                  )}
                </motion.div>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Card>
      </motion.section>

      <ExportWizard key={wizard.key} rows={[row]} destinationDefault={media.facts?.exportDestinationDefault ?? null} isOpen={wizard.open} onOpenChange={(open) => setWizard((previous) => ({ ...previous, open }))} />
    </div>
  )
}
