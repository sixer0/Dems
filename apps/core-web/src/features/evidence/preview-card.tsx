import { Button, Card, Chip, Separator } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, FileVideo, MousePointerClick, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatUtcOffset } from '@dems/shared/realtime'
import { useMotionPolicy } from '@/motion'
import { EvidenceStatusChip, SubjectTypeChip } from './chips'
import { useEvidenceAssets } from './demo-assets'
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
 * (DEMO manifest digest, or "simulated" when no package joins), Open details and Export.
 * The content cross-fades between rows (`base`).
 */
export function EvidencePreview({ row, onOpen, onExport }: EvidencePreviewProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const { urlFor } = useEvidenceAssets()

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
                  <span>{t('evidence.media.noMedia')}</span>
                </span>
              )}
            </div>
            <div className="evi-still-meta">
              <EvidenceStatusChip status={row.item.status} />
              {row.pkg ? (
                <Chip size="sm" variant="secondary" className="evi-demo-chip">
                  <Chip.Label>{t('evidence.demo.chip')}</Chip.Label>
                </Chip>
              ) : null}
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
                <dd>{t(`common.verificationStatus.${row.item.verification.status}`)}</dd>
              </div>
            </dl>

            <Separator />
            <p className="evi-preview-package" data-package={row.pkg ? 'demo' : 'simulated'}>
              {row.pkg
                ? t('evidence.preview.packageLine', { digest: shortHash(row.pkg.signature.signedDigest) })
                : t('evidence.preview.noPackage')}
            </p>

            <div className="evi-preview-actions">
              <Button variant="primary" size="sm" onPress={() => onOpen(row, document.querySelector(`[data-preview-id="${CSS.escape(row.id)}"] [data-header-origin]`))} data-testid="evidence-preview-open">
                {t('evidence.preview.open')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" size="sm" isDisabled={!EXPORTABLE_STATUSES.includes(row.item.status)} onPress={() => onExport(row)}>
                <Share2 className="size-4" aria-hidden="true" />
                {t('evidence.detail.actions.export')}
              </Button>
            </div>
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
