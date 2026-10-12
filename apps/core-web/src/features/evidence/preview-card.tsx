import { Button, Card, Chip, Separator } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, FileVideo, MousePointerClick, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { formatUtcOffset } from '@dems/shared/realtime'
import { Permission, hasSealedValues, selectCan, useSim } from '@dems/shared/sim'
import { RoleReason } from '@/components/role-reason'
import { useMotionPolicy } from '@/motion'
import { EvidenceStatusChip, SubjectTypeChip } from './chips'
import { useEvidenceAssets } from './demo-assets'
import { isDemoItem } from './item-facts'
import { InterruptedMark, NotSealedMark } from './item-marks'
import {
  byteSize,
  EXPORTABLE_STATUSES,
  formatEvidenceDuration,
  formatWibClockSeconds,
  formatWibDateTime,
  shortHash,
  type EvidenceRow,
} from './model'

export interface EvidencePreviewProps {
  row: EvidenceRow | null
  onOpen: (row: EvidenceRow, origin: Element | null) => void
  onExport: (row: EvidenceRow) => void
}

/**
 * Sticky preview beside the table (research/04 §5.1 "Detail preview (sticky) 4"; mobile MB 6 header
 * block): VIDEO-01 poster from the package, ID and time range, the key-values, the package line
 * (DEMO manifest digest, or "simulated" when no package joins; in Live mode "the Core server's record",
 * plan row W0, item 9, decision D158), Open details and Export.
 * The content cross-fades between rows (`base`).
 */
export function EvidencePreview({ row, onOpen, onExport }: EvidencePreviewProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const live = useCoreMode() === CoreMode.LIVE
  const { urlFor } = useEvidenceAssets()
  // Fix wave J (JW-14 (c)): Export is disabled with its reason for a role that may not export.
  const roleMayExport = useSim((s) => selectCan(s, Permission.EVIDENCE_EXPORT))
  const sealed = row ? hasSealedValues(row.item) : false

  return (
    <Card className="evi-preview-card" data-testid="evidence-preview">
      <AnimatePresence mode="wait" initial={false}>
        {row ? (
          <motion.div
            key={row.id}
            className="evi-preview-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={m.transitions.crossFade}
            data-preview-id={row.id}
          >
            <div className="evi-preview-still">
              {urlFor(row.posterPath) ? (
                <img src={urlFor(row.posterPath) ?? undefined} alt={t('evidence.preview.posterAlt', { id: row.id })} decoding="async" />
              ) : (
                <span className="evi-preview-still-empty">
                  <FileVideo className="size-8" aria-hidden="true" />
                  {/* Wave H C2 (G94-14): "No DEMO media" is said of a demo item only; any other Live item has no preview picture. */}
                  <span>{t(live && !isDemoItem(row.item) ? 'evidence.itemFacts.web.noPreview' : 'evidence.media.noMedia')}</span>
                </span>
              )}
            </div>
            <div className="evi-still-meta">
              <EvidenceStatusChip status={row.item.status} item={row.item} />
              {row.pkg ? (
                <Chip size="sm" variant="secondary" className="evi-demo-chip">
                  <Chip.Label>{t('evidence.demo.chip')}</Chip.Label>
                </Chip>
              ) : null}
              <InterruptedMark item={row.item} testId="evidence-preview-interrupted" />
              <NotSealedMark item={row.item} testId="evidence-preview-not-sealed" />
            </div>

            <div className="evi-preview-heading" data-header-origin={row.id}>
              <span className="evi-id evi-id-lg">{row.id}</span>
              <span className="evi-caption">
                {`${t('evidence.detail.timeRange', {
                  start: formatWibDateTime(row.item.recordedAt),
                  end: formatWibClockSeconds(row.item.endedAt),
                })} UTC${formatUtcOffset()}`}
              </span>
            </div>

            <dl className="evi-kv">
              <div>
                <dt>{t('evidence.detail.fields.caseNumber')}</dt>
                <dd className="evi-mono">{row.item.caseNumber}</dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.subject')}</dt>
                <dd className="evi-kv-inline">
                  <span>{row.item.subjectName}</span>
                  <SubjectTypeChip type={row.item.subjectType} />
                </dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.investigator')}</dt>
                <dd>{row.investigatorName}</dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.duration')}</dt>
                <dd className="evi-mono">{formatEvidenceDuration(row.item.durationMs)}</dd>
              </div>
              <div>
                <dt>{t('evidence.detail.fields.fileSize')}</dt>
                <dd>{t(`common.units.${byteSize(row.item.sizeBytes).unit}`, { value: byteSize(row.item.sizeBytes).value })}</dd>
              </div>
              <div>
                <dt>{t('evidence.preview.lastVerification')}</dt>
                {/* Wave J (JW-01): a never-sealed item has no verification - not even "Not verified". */}
                <dd data-testid="evidence-preview-verification">{sealed ? t(`common.verificationStatus.${row.item.verification.status}`) : t('web.waveJ.evidence.notSealedChip')}</dd>
              </div>
            </dl>

            <Separator />
            <p className="evi-preview-package" data-package={row.pkg ? 'demo' : live ? 'core' : 'simulated'}>
              {row.pkg
                ? t('evidence.preview.packageLine', { digest: shortHash(row.pkg.signature.signedDigest) })
                : t(!live ? 'evidence.preview.noPackage' : isDemoItem(row.item) ? 'evidence.live.noPackage' : 'evidence.itemFacts.web.coreRecordLine')}
            </p>

            <div className="evi-preview-actions">
              <Button variant="primary" size="sm" onPress={() => onOpen(row, document.querySelector(`[data-preview-id="${CSS.escape(row.id)}"] [data-header-origin]`))} data-testid="evidence-preview-open">
                {t('evidence.preview.open')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" size="sm" isDisabled={!EXPORTABLE_STATUSES.includes(row.item.status) || !sealed || !roleMayExport} aria-describedby={roleMayExport ? undefined : 'evidence-preview-export-reason'} onPress={() => onExport(row)} data-testid="evidence-preview-export">
                <Share2 className="size-4" aria-hidden="true" />
                {t('evidence.detail.actions.export')}
              </Button>
            </div>
            {roleMayExport ? null : (
              <p className="evi-caption">
                {t('evidence.detail.actions.export')}: <RoleReason id="evidence-preview-export-reason" permission={Permission.EVIDENCE_EXPORT} />
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="evi-preview-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={m.transitions.crossFade}
          >
            <MousePointerClick className="size-8" aria-hidden="true" />
            <span>{t('evidence.preview.empty')}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
