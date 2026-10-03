import { useCallback, useMemo, useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Button, Card, toast } from '@heroui/react'
import { motion } from 'motion/react'
import { BadgeCheck, CircleDot, Hourglass, Layers, Share2, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  EvidenceStatus,
  Permission,
  selectCan,
  selectEvidence,
  selectEvidenceStats,
  SimPermissionError,
  SimTransitionError,
  useSim,
  useSimActions,
  useSimReady,
} from '@dems/shared/sim'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { browserMatchMedia, useMediaQuery } from '@/motion/use-media-query'
import { useMotionPolicy } from '@/motion'
import { LIST_BEAT_MS, usePanelVariants, useStaggerVariants } from './choreography'
import { EvidenceTable } from './evidence-table'
import { ExportWizard } from './export-wizard'
import { logEvidenceError } from './log'
import { buildEvidenceRows, STATUS_FILTERS, type EvidenceRow } from './model'
import { rememberHeaderOrigin, requestAutoVerify } from './pending-actions'
import { EvidencePreview } from './preview-card'
import { selectOperators } from './selectors'
import { subjectTypeFromSearch } from './sim-adapter'
import { EvidenceToolbar, type EvidenceFilters } from './toolbar'
import { useEvidenceTable } from './use-evidence-table'

const listRoute = getRouteApi('/_app/evidence/')

/** ≥ 1280 px the sticky preview is beside the table; below it a row action opens the detail page. */
const PREVIEW_QUERY = '(min-width: 1280px)'

type SearchPatch = Partial<Record<'q' | 'status' | 'caseType' | 'investigator' | 'from' | 'to', string | undefined>>

const STATUS_VALUES = new Set<string>(Object.values(EvidenceStatus))
function isEvidenceStatus(value: string | undefined): value is EvidenceStatus {
  return value !== undefined && STATUS_VALUES.has(value)
}

/**
 * Evidence list body (`/evidence`; 01_specs §14.5.3; research/04 §5.1; mobile MB 5; 03_motion_spec
 * M-PG-EVID), lazily loaded under the page shell in `index.tsx`: five KPI cards, the toolbar, the
 * TanStack table (10 per page, AC-64) and the sticky preview. Filters live in the URL search (step 38
 * route schema). Export opens the wizard for one row or the bulk selection.
 */
export function EvidenceListBody() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const search = listRoute.useSearch()
  const navigateList = listRoute.useNavigate()
  const navigate = useNavigate()
  const actions = useSimActions()
  const ready = useSimReady()
  const items = useSim(selectEvidence)
  const operators = useSim(selectOperators)
  const stats = useSim(selectEvidenceStats)
  const canArchive = useSim((s) => selectCan(s, Permission.EVIDENCE_REVIEW))
  const wide = useMediaQuery(PREVIEW_QUERY, browserMatchMedia())

  const rows = useMemo(() => buildEvidenceRows(items, operators), [items, operators])
  const filters: EvidenceFilters = useMemo(
    () => ({
      q: search.q,
      status: search.status,
      subjectType: subjectTypeFromSearch(search.caseType),
      investigator: search.investigator,
      from: search.from,
      to: search.to,
    }),
    [search.q, search.status, search.caseType, search.investigator, search.from, search.to],
  )
  const model = useEvidenceTable(rows, filters, search.page)

  const [previewId, setPreviewId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [wizard, setWizard] = useState<{ key: number; ids: string[]; open: boolean }>({ key: 0, ids: [], open: false })

  const previewRow = rows.find((row) => row.id === previewId) ?? model.pageRows[0] ?? null
  const wizardRows = wizard.ids.map((id) => rows.find((row) => row.id === id)).filter((row): row is EvidenceRow => Boolean(row))

  const investigators = useMemo(() => {
    const ids = new Set(items.map((item) => item.investigatorId))
    return operators.filter((operator) => ids.has(operator.id))
  }, [items, operators])

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_FILTERS.map((status) => [status, 0])) as Record<EvidenceStatus | 'ALL', number>
    for (const item of items) counts[item.status] += 1
    counts.ALL = items.length
    return counts
  }, [items])

  const updateSearch = useCallback(
    (patch: SearchPatch) => {
      const { status, ...rest } = patch
      void navigateList({
        search: (previous) => ({
          ...previous,
          ...rest,
          ...('status' in patch ? { status: isEvidenceStatus(status) ? status : undefined } : {}),
          page: undefined,
        }),
        replace: true,
      })
    },
    [navigateList],
  )
  const clearFilters = useCallback(() => {
    void navigateList({ search: {}, replace: true })
  }, [navigateList])
  const goToPage = useCallback(
    (page: number) => {
      void navigateList({ search: (previous) => ({ ...previous, page: page > 1 ? page : undefined }), replace: true })
    },
    [navigateList],
  )

  const openDetail = useCallback(
    (row: EvidenceRow, origin: Element | null, tab?: 'integrity') => {
      rememberHeaderOrigin(row.id, origin)
      void navigate({ to: '/evidence/$evidenceId', params: { evidenceId: row.id }, search: tab ? { tab } : {} })
    },
    [navigate],
  )

  const openWizard = useCallback((ids: string[]) => {
    setWizard((previous) => ({ key: previous.key + 1, ids, open: true }))
  }, [])

  const archive = useCallback(
    (row: EvidenceRow) => {
      try {
        actions.archiveEvidence(row.id)
        toast.success(t('evidence.archive.success', { id: row.id }))
      } catch (error) {
        if (error instanceof SimPermissionError) toast.danger(t('evidence.archive.denied'))
        else if (error instanceof SimTransitionError) toast.warning(t('evidence.archive.notSealed'))
        else {
          logEvidenceError('list.archive', error, { evidenceId: row.id })
          toast.danger(t('evidence.archive.failed'))
        }
      }
    },
    [actions, t],
  )

  const kpiVariants = useStaggerVariants(LIST_BEAT_MS.kpis, 60)
  const toolbarVariants = usePanelVariants(LIST_BEAT_MS.toolbar)
  const tableVariants = usePanelVariants(LIST_BEAT_MS.table)
  const previewVariants = usePanelVariants(LIST_BEAT_MS.preview)

  const kpis: { id: string; label: string; value: number; icon: LucideIcon; tone: string }[] = [
    { id: 'total', label: t('evidence.kpi.total'), value: stats.total, icon: Layers, tone: 'accent' },
    { id: 'sealed', label: t('evidence.kpi.sealed'), value: stats.sealed, icon: BadgeCheck, tone: 'sealed' },
    { id: 'recorded', label: t('evidence.kpi.recorded'), value: stats.recorded, icon: CircleDot, tone: 'success' },
    { id: 'exported', label: t('evidence.kpi.exported'), value: stats.exported, icon: Share2, tone: 'info' },
    { id: 'pending', label: t('evidence.kpi.pending'), value: stats.pending, icon: Hourglass, tone: 'warning' },
  ]

  return (
    <div className="evi-body" data-testid="evidence-list-body">

      <motion.section className="evi-kpis" aria-label={t('evidence.kpi.label')} variants={kpiVariants} initial="hidden" animate="visible">
        {kpis.map((kpi) => (
          <motion.div key={kpi.id} variants={m.variants.panel} className="evi-kpi-cell">
            <Card variant="secondary" className="evi-kpi" data-kpi={kpi.id} data-tone={kpi.tone}>
              <span className="evi-kpi-icon" aria-hidden="true">
                <kpi.icon className="size-5" />
              </span>
              <span className="evi-kpi-text">
                <span className="evi-kpi-label">{kpi.label}</span>
                <AnimatedNumber value={kpi.value} from={0} className="evi-kpi-value" />
              </span>
            </Card>
          </motion.div>
        ))}
      </motion.section>

      <motion.div variants={toolbarVariants} initial="hidden" animate="visible">
        <EvidenceToolbar filters={filters} investigators={investigators} statusCounts={statusCounts} onChange={updateSearch} onClear={clearFilters} />
      </motion.div>

      {selectedIds.size > 0 ? (
        <div className="evi-bulk" role="status" data-testid="evidence-bulk">
          <span>{t('evidence.table.selected', { count: selectedIds.size })}</span>
          <Button size="sm" variant="primary" onPress={() => openWizard([...selectedIds])} data-testid="evidence-bulk-export">
            <Share2 className="size-4" aria-hidden="true" />
            {t('evidence.table.bulkExport', { count: selectedIds.size })}
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setSelectedIds(new Set())}>
            {t('evidence.table.clearSelection')}
          </Button>
        </div>
      ) : null}

      <div className="evi-list-grid">
        <motion.div className="evi-list-main" variants={tableVariants} initial="hidden" animate="visible">
          <Card className="evi-table-card">
            <EvidenceTable
              model={model}
              loading={!ready}
              previewId={wide ? (previewRow?.id ?? null) : null}
              selectedIds={selectedIds}
              canArchive={canArchive}
              onSelectionChange={setSelectedIds}
              onRowAction={(row) => (wide ? setPreviewId(row.id) : openDetail(row, null))}
              onView={(row, origin) => openDetail(row, origin)}
              onVerify={(row, origin) => {
                requestAutoVerify(row.id)
                openDetail(row, origin, 'integrity')
              }}
              onExport={(targets) => openWizard(targets.map((row) => row.id))}
              onArchive={archive}
              onPageChange={goToPage}
              onClearFilters={clearFilters}
            />
          </Card>
        </motion.div>
        {wide ? (
          <motion.aside className="evi-list-aside" variants={previewVariants} initial="hidden" animate="visible" aria-label={t('evidence.preview.title')}>
            <EvidencePreview row={previewRow} onOpen={(row, origin) => openDetail(row, origin)} onExport={(row) => openWizard([row.id])} />
          </motion.aside>
        ) : null}
      </div>

      {wizardRows.length > 0 ? (
        <ExportWizard
          key={wizard.key}
          rows={wizardRows}
          isOpen={wizard.open}
          onOpenChange={(open) => setWizard((previous) => ({ ...previous, open }))}
        />
      ) : null}
    </div>
  )
}
