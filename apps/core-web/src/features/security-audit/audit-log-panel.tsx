import { auditTypeWords } from '@/lib/event-words'
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Button,
  buttonVariants,
  Chip,
  Label,
  ListBox,
  SearchField,
  Select,
  Switch,
  Table,
  TableLayout,
  Tooltip,
  Virtualizer,
} from '@heroui/react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
} from '@tanstack/react-table'
import { motion, useAnimate } from 'motion/react'
import { ArrowLeft, ArrowRight, CircleCheck, CircleX, FileDown, Link2, ScrollText } from 'lucide-react'
import { useSidewaysMore } from '@/lib/sideways-scroll'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { AuditCategory, faultKindLabelKey, Permission, selectCan, Severity, useSim } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { useRouteEnterDelay } from '@/components/shell'
import { HIGHLIGHT_FADE_MS, HIGHLIGHT_FROM_OPACITY } from '@/components/ui/animated-list'
import { ROW_STAGGER_CAP, ROW_STAGGER_MS, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { useWebLive } from '@/runtime'
import { useAuditLog } from './audit-context'
import { CONTENT_BEAT_MS, PANEL_BEAT_MS } from './choreography'
import { ExportAuditDialog } from './export-audit-dialog'
import {
  ALL,
  EMPTY_FILTERS,
  isFiltered,
  matchesOperator,
  matchesQuery,
  namesTypedUsername,
  NO_OPERATOR,
  roleFor,
  shortHash,
  toRowViews,
  type AuditFilterState,
  type AuditRowView,
  type ChainReport,
} from './model'
import { Panel } from './panel'
import { CATEGORY_TONE, CHAIN_TONE, SEVERITY_TONE, toneClass } from './tones'

/** Row and heading heights of the virtualised table (TableLayout). */
export const ROW_HEIGHT = 40
export const HEADING_HEIGHT = 36
/** New rows count as fresh (entry animation, gold highlight) for the M-C-07 highlight fade. */
const FRESH_MS = HIGHLIGHT_FADE_MS
/** How long the "Show in log" entry stays highlighted. */
const FOCUS_HOLD_MS = 6000
/** M-C-11 first-load stagger window. */
const FIRST_LOAD_MS = 1200

type ColumnId = 'seq' | 'time' | 'event' | 'actor' | 'category' | 'severity' | 'chain'

interface ColumnSpec {
  id: ColumnId
  width: number | `${number}fr`
  minWidth?: number
  sortable: boolean
  rowHeader?: boolean
}

const COLUMNS: readonly ColumnSpec[] = [
  // Fix wave Q (box check at 1280 x 800): the fixed columns summed to 904 px + 240 px for the event = 1144 px in a
  // 1008 px card, so the last columns lay outside it (round three gave the table a cue instead). The six fixed columns
  // are as wide as their widest content needs (measured in the browser on lane 2); the event takes the rest.
  { id: 'seq', width: 76, sortable: true },
  { id: 'time', width: 156, sortable: true },
  { id: 'event', width: '1fr', minWidth: 232, sortable: true, rowHeader: true },
  { id: 'actor', width: 170, sortable: true },
  { id: 'category', width: 128, sortable: true },
  { id: 'severity', width: 104, sortable: true },
  { id: 'chain', width: 140, sortable: true },
]

const SEVERITY_RANK: Record<Severity, number> = { INFO: 0, SUCCESS: 1, WARNING: 2, CRITICAL: 3 }

export interface FocusRequest {
  seq: number
  nonce: number
}

export interface AuditLogPanelProps {
  chain: ChainReport
  focusRequest: FocusRequest | null
  className?: string
}

interface FilterSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ id: string; label: string }>
  testId: string
}

function FilterSelect({ label, value, onChange, options, testId }: FilterSelectProps) {
  return (
    <Select
      className="sa-filter-select"
      value={value}
      onChange={(key) => onChange(key === null ? ALL : String(key))}
      data-testid={testId}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

/**
 * Reveal bookkeeping shared with the cells through a ref-stable context, so the table's React Aria
 * collection is rebuilt only when the rows themselves change (not on timers): `mountedAt` for the
 * first-load stagger (M-C-11) and `arrivals` (seq → arrival time) for live rows (M-C-07).
 */
interface RevealBook {
  mountedAt: number
  staggerStartMs: number
  arrivals: Map<number, number>
}

const RevealContext = createContext<RevealBook>({ mountedAt: 0, staggerStartMs: 0, arrivals: new Map() })

/** Cell content wrapper: the first-load stagger (M-C-11) or the live-row entry (M-C-07). */
function RowReveal({ rowId, seq, position, children }: { rowId: string; seq: number; position: number; children: ReactNode }) {
  const m = useMotionPolicy()
  const book = useContext(RevealContext)
  // Decided once per mount. The Virtualizer reuses row views for other items, so the caller keys
  // this component by row ID: a reused view remounts it and decides afresh (scrolling back to a
  // row after the highlight window never replays it).
  const [mode] = useState<{ fresh: boolean; staggerDelayMs: number | null }>(() => {
    const now = performance.now()
    const arrived = book.arrivals.get(seq)
    const fresh = arrived !== undefined && now - arrived < FRESH_MS * m.timeScale
    const firstLoad = now - book.mountedAt < FIRST_LOAD_MS * m.timeScale + book.staggerStartMs
    return {
      fresh,
      staggerDelayMs: !fresh && firstLoad && position < ROW_STAGGER_CAP ? book.staggerStartMs + position * ROW_STAGGER_MS : null,
    }
  })
  const { fresh, staggerDelayMs } = mode
  const initial = m.reduced
    ? false
    : fresh
      ? { opacity: 0, y: -12, scale: 0.98 }
      : staggerDelayMs !== null
        ? { opacity: 0, y: 6 }
        : false
  return (
    <>
      {fresh ? (
        <motion.span
          aria-hidden="true"
          className="sa-row-fresh"
          initial={{ opacity: HIGHLIGHT_FROM_OPACITY }}
          animate={{ opacity: 0 }}
          transition={{ duration: m.seconds(HIGHLIGHT_FADE_MS), ease: 'linear' }}
        />
      ) : null}
      <motion.span
        key={rowId}
        className="sa-row-reveal"
        initial={initial}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          fresh
            ? m.timeScale === 1
              ? { type: 'spring', stiffness: 350, damping: 40 }
              : m.transitions.enter
            : { ...m.transitions.row, delay: m.seconds(staggerDelayMs ?? 0) }
        }
      >
        {children}
      </motion.span>
    </>
  )
}

/**
 * Audit log (01_specs §14.5.7: Table, SearchField, Select, Switch; TanStack Table v8; research/04
 * §5.5; design book §21.3 AuditEvent; SYS-012).
 *
 * - TanStack Table v8 is the data model (sorting, column filters, global search); the kit
 *   `Table` renders it inside React Aria's `Virtualizer` + `TableLayout` (re-exported by
 *   `@heroui/react`), so only the visible rows are in the DOM even with the full 1,000-row ring.
 * - Filters: free-text search, type (category), severity and operator. "Live" streams new rows
 *   (M-C-07: enter from -12 px, gold highlight 0.18 → 0 over 1.5 s); switched off it holds new
 *   entries back and counts them.
 * - The chain-link column shows each row's hash-chain status; a broken row is tinted red.
 * - "Export audit" is RBAC-gated (S20): without AUDIT_EXPORT it is disabled with a Tooltip naming
 *   the role; with it, it opens the export dialog (reason required; the simulator enforces it).
 */
export const AuditLogPanel = memo(function AuditLogPanel({ chain, focusRequest, className }: AuditLogPanelProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  const audit = useAuditLog()
  const operators = useSim((s) => s.operators)
  const canExport = useSim((s) => selectCan(s, Permission.AUDIT_EXPORT))
  // Live mode (W75; CPS1-12 (a)): a failed sign-in names the operator whose username was typed.
  const isLive = useWebLive() !== null

  // ── Live stream ──────────────────────────────────────────────────────────────────────
  const headSeq = audit.rows[audit.rows.length - 1]?.seq ?? 0
  const [live, setLive] = useState(true)
  const [pausedAtSeq, setPausedAtSeq] = useState<number | null>(null)
  const visibleUpTo = live ? Number.POSITIVE_INFINITY : (pausedAtSeq ?? headSeq)
  const heldBack = live ? 0 : Math.max(0, headSeq - (pausedAtSeq ?? headSeq))
  const setLiveMode = useCallback(
    (on: boolean) => {
      setLive(on)
      setPausedAtSeq(on ? null : headSeq)
    },
    [headSeq],
  )

  // Arrival times of rows that appear while this panel is mounted (M-C-07 fresh highlight),
  // recorded during render so the new row's first paint already carries the entry animation.
  const [book] = useState<RevealBook>(() => ({
    mountedAt: performance.now(),
    staggerStartMs: routeDelay + PANEL_BEAT_MS.audit + CONTENT_BEAT_MS,
    arrivals: new Map(),
  }))
  const [seenHead, setSeenHead] = useState(headSeq)
  if (headSeq > seenHead) {
    const now = performance.now()
    for (const [seq, time] of book.arrivals) if (now - time > FRESH_MS * m.timeScale * 4) book.arrivals.delete(seq)
    for (const row of audit.rows) if (row.seq > seenHead) book.arrivals.set(row.seq, now)
    setSeenHead(headSeq)
  }

  // ── Data and filters ─────────────────────────────────────────────────────────────────
  // `audit` and `chain` arrive at transition priority from the page (audit-context.ts).
  const views = useMemo(() => {
    const all = toRowViews(audit.rows, chain, operators)
    return Number.isFinite(visibleUpTo) ? all.filter((row) => row.seq <= visibleUpTo) : all
  }, [audit.rows, chain, operators, visibleUpTo])

  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_FILTERS)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'seq', desc: true }])

  const labelOf = useCallback((row: AuditRowView) => auditTypeWords(t, row.type), [t])
  const actorOf = useCallback(
    (row: AuditRowView) =>
      row.actorKind === 'OPERATOR'
        ? isLive && namesTypedUsername(row)
          ? t('securityAudit.live.audit.typedActor', { name: row.actorName ?? '' })
          : (row.actorName ?? '')
        : row.actorKind === 'UNVERIFIED'
          ? t('securityAudit.audit.unverifiedUser')
          : t('securityAudit.audit.system'),
    [t, isLive],
  )

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const out: ColumnFiltersState = []
    if (filters.category !== ALL) out.push({ id: 'category', value: filters.category })
    if (filters.severity !== ALL) out.push({ id: 'severity', value: filters.severity })
    if (filters.operator !== ALL) out.push({ id: 'actor', value: filters.operator })
    return out
  }, [filters.category, filters.severity, filters.operator])

  const globalFilterFn = useCallback<FilterFn<AuditRowView>>(
    (row, _columnId, value) => matchesQuery(row.original, String(value ?? ''), labelOf(row.original), actorOf(row.original)),
    [labelOf, actorOf],
  )

  const columns = useMemo<ColumnDef<AuditRowView>[]>(
    () => [
      { id: 'seq', accessorFn: (row) => row.seq },
      { id: 'time', accessorFn: (row) => row.seq },
      { id: 'event', accessorFn: (row) => labelOf(row) },
      {
        id: 'actor',
        accessorFn: (row) => actorOf(row),
        filterFn: (row, _id, value) => matchesOperator(row.original, String(value)),
      },
      { id: 'category', accessorFn: (row) => row.category, filterFn: 'equalsString' },
      {
        id: 'severity',
        accessorFn: (row) => row.severity,
        filterFn: 'equalsString',
        sortingFn: (a, b) => SEVERITY_RANK[a.original.severity] - SEVERITY_RANK[b.original.severity],
      },
      { id: 'chain', accessorFn: (row) => row.chain },
    ],
    [labelOf, actorOf],
  )

  // TanStack Table returns fresh functions each render; core-web does not run the React Compiler,
  // and the table instance is only read inside this component (no memoised consumers).
  // oxlint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: views,
    columns,
    state: { sorting, columnFilters, globalFilter: filters.query },
    onSortingChange: setSorting,
    globalFilterFn,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const rowModel = table.getRowModel().rows
  // Identity-stable view objects for React Aria (its collection caches rendered rows by item).
  const rows = useMemo(() => rowModel.map((row) => row.original), [rowModel])

  // ── Focus requests from the chain strip ("Show in log") ─────────────────────────────
  const [focusedSeq, setFocusedSeq] = useState<number | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Fix wave J round three: the table may be wider than its card (1144 px in 1008 px at 1280) - it then SAYS that
  // columns lie to the side, and on which side (`lib/sideways-scroll.ts`).
  const sideways = useSidewaysMore(tableRef)
  const pendingFocus = useRef<number | null>(null)
  const [handledNonce, setHandledNonce] = useState<number | null>(null)
  if (focusRequest && focusRequest.nonce !== handledNonce) {
    setHandledNonce(focusRequest.nonce)
    setFocusedSeq(focusRequest.seq)
    pendingFocus.current = focusRequest.seq
    if (isFiltered(filters)) setFilters(EMPTY_FILTERS)
    if (!live && focusRequest.seq > (pausedAtSeq ?? headSeq)) {
      setLive(true)
      setPausedAtSeq(null)
    }
  }
  useEffect(() => {
    const seq = pendingFocus.current
    if (seq === null) return
    const position = rows.findIndex((row) => row.seq === seq)
    if (position < 0) return
    pendingFocus.current = null
    const scroller = tableRef.current
    if (scroller) {
      const top = Math.max(0, position * ROW_HEIGHT - (scroller.clientHeight - HEADING_HEIGHT) / 2 + ROW_HEIGHT / 2)
      scroller.scrollTo({ top, behavior: m.reduced ? 'auto' : 'smooth' })
    }
    panelRef.current?.scrollIntoView({ block: 'center', behavior: m.reduced ? 'auto' : 'smooth' })
  }, [rows, m.reduced, focusedSeq])

  // The "Show in log" highlight is transient: it clears after a few seconds (P3: no lasting marks).
  useEffect(() => {
    if (focusedSeq === null) return undefined
    const id = setTimeout(() => setFocusedSeq(null), FOCUS_HOLD_MS * m.timeScale)
    return () => clearTimeout(id)
  }, [focusedSeq, handledNonce, m.timeScale])

  // M-C-11: filter and sort changes cross-fade the rows (160 ms); reduced: none.
  const [fadeScope, animateFade] = useAnimate<HTMLDivElement>()
  const filterKey = `${filters.query}|${filters.category}|${filters.severity}|${filters.operator}|${sorting[0]?.id}|${String(sorting[0]?.desc)}`
  const lastFilterKey = useRef(filterKey)
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return
    lastFilterKey.current = filterKey
    if (m.reduced || !fadeScope.current) return
    void animateFade(fadeScope.current, { opacity: [0.35, 1] }, { duration: m.seconds(160) })
  }, [filterKey, m, animateFade, fadeScope])

  // ── Options ──────────────────────────────────────────────────────────────────────────
  const categoryOptions = useMemo(
    () => [
      { id: ALL, label: t('securityAudit.audit.allTypes') },
      ...Object.values(AuditCategory).map((category) => ({ id: category, label: t(`common.auditCategory.${category}`) })),
    ],
    [t],
  )
  const severityOptions = useMemo(
    () => [
      { id: ALL, label: t('securityAudit.audit.allSeverities') },
      ...Object.values(Severity).map((severity) => ({ id: severity, label: t(`common.severity.${severity}`) })),
    ],
    [t],
  )
  const operatorOptions = useMemo(
    () => [
      { id: ALL, label: t('securityAudit.audit.allOperators') },
      ...operators.map((operator) => ({ id: operator.id, label: operator.displayName })),
      { id: NO_OPERATOR, label: t('securityAudit.audit.system') },
    ],
    [t, operators],
  )

  // ── Rendering helpers ────────────────────────────────────────────────────────────────
  const positions = useMemo(() => new Map(rows.map((row, position) => [row.id, position])), [rows])

  const renderCell = (view: AuditRowView, column: ColumnId): ReactNode => {
    switch (column) {
      case 'seq':
        return <span className="sa-mono sa-soft">#{view.seq}</span>
      case 'time':
        return (
          <span className="sa-event">
            <span className="sa-mono sa-event-label">{formatDate(view.at, DATE_PATTERNS.time)}</span>
            <span className="sa-event-refs">{formatDate(view.at, DATE_PATTERNS.date)}</span>
          </span>
        )
      case 'event': {
        const sub =
          view.faultKind && (view.type === 'FAULT_RAISED' || view.type === 'FAULT_CLEARED' || view.type === 'AUDIT_CHAIN_DISCONTINUITY')
            ? t(faultKindLabelKey(view.faultKind, view))
            : view.method
              ? t('securityAudit.auth.via', { method: t(`common.authMethod.${view.method as 'PASSWORD'}`) })
              : view.refs.join(' • ')
        return (
          <span className="sa-event">
            <span className="sa-event-label">{labelOf(view)}</span>
            {/* Fix wave Q (box check): the row is 40 px high (a virtualised table) - a reference line that wrapped pushed the
                event's name out of its cell. One line, cut by an ellipsis, with the whole line as its title. */}
            <span className="sa-event-refs sa-event-refs-line" title={sub || view.id}>{sub || view.id}</span>
          </span>
        )
      }
      case 'actor':
        return <span className={cn('sa-event-label', view.actorKind !== 'OPERATOR' && 'sa-muted')}>{actorOf(view)}</span>
      case 'category':
        return (
          <Chip size="sm" variant="soft" {...toneChipProps(CATEGORY_TONE[view.category])}>
            {t(`common.auditCategory.${view.category}`)}
          </Chip>
        )
      case 'severity':
        return (
          <span className={cn('inline-flex items-center gap-2', toneClass(SEVERITY_TONE[view.severity]))}>
            <span className="sa-dot" aria-hidden="true" />
            <span className="sa-soft">{t(`common.severity.${view.severity}`)}</span>
          </span>
        )
      case 'chain': {
        const Icon = view.chain === 'BROKEN' ? CircleX : view.chain === 'ANCHOR' ? Link2 : CircleCheck
        return (
          <span
            className={cn('sa-chain-cell', toneClass(CHAIN_TONE[view.chain]))}
            title={t('securityAudit.audit.hashTitle', { hash: view.hash })}
            data-chain={view.chain}
          >
            <Icon className="sa-chain-icon" aria-hidden="true" />
            <span style={{ color: 'var(--sa-tone-text)' }}>
              {view.chain === 'BROKEN'
                ? t('securityAudit.audit.chainBroken')
                : view.chain === 'ANCHOR'
                  ? t('securityAudit.chain.anchor')
                  : t('securityAudit.audit.chainLinked')}
            </span>
            <span className="sa-mono sa-muted">{shortHash(view.hash, 6)}</span>
          </span>
        )
      }
    }
  }

  const sortColumn = sorting[0]
  const exportRole = roleFor(Permission.AUDIT_EXPORT)
  const exportRoleLabel = exportRole ? t(`common.roles.${exportRole}`) : ''
  const [exportOpen, setExportOpen] = useState(false)

  const exportButton = canExport ? (
    <Button size="sm" variant="primary" onPress={() => setExportOpen(true)} data-testid="export-audit">
      <FileDown className="size-4" aria-hidden="true" />
      {t('securityAudit.exportAudit.button')}
    </Button>
  ) : (
    <Tooltip delay={200}>
      <Tooltip.Trigger
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'sa-export-disabled cursor-not-allowed opacity-60')}
        aria-disabled="true"
        aria-label={`${t('securityAudit.exportAudit.button')}. ${t('securityAudit.audit.exportDisabledHint', { role: exportRoleLabel })}`}
        data-testid="export-audit"
        data-disabled="true"
      >
        <FileDown className="size-4" aria-hidden="true" />
        {t('securityAudit.exportAudit.button')}
      </Tooltip.Trigger>
      <Tooltip.Content placement="top" offset={8}>
        {t('securityAudit.audit.exportDisabledHint', { role: exportRoleLabel })}
      </Tooltip.Content>
    </Tooltip>
  )

  return (
    <Panel
      id="audit"
      icon={ScrollText}
      title={t('securityAudit.audit.title')}
      subtitle={t('securityAudit.audit.count', { shown: rows.length, total: audit.total })}
      className={className}
      action={
        <>
          <Switch isSelected={live} onChange={setLiveMode} size="sm" data-testid="audit-live">
            <Switch.Content className="sa-live">
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>{t('securityAudit.audit.live')}</Label>
            </Switch.Content>
          </Switch>
          {exportButton}
        </>
      }
    >
      <div className="sa-filters" role="group" aria-label={t('securityAudit.audit.filtersLabel')}>
        <SearchField
          className="sa-filter-search"
          value={filters.query}
          onChange={(query) => setFilters((current) => ({ ...current, query }))}
          aria-label={t('securityAudit.audit.search')}
          data-testid="audit-search"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t('securityAudit.audit.search')} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <FilterSelect
          label={t('securityAudit.audit.type')}
          value={filters.category}
          onChange={(value) => setFilters((current) => ({ ...current, category: value as AuditFilterState['category'] }))}
          options={categoryOptions}
          testId="audit-filter-type"
        />
        <FilterSelect
          label={t('securityAudit.audit.severity')}
          value={filters.severity}
          onChange={(value) => setFilters((current) => ({ ...current, severity: value as AuditFilterState['severity'] }))}
          options={severityOptions}
          testId="audit-filter-severity"
        />
        <FilterSelect
          label={t('securityAudit.audit.operator')}
          value={filters.operator}
          onChange={(value) => setFilters((current) => ({ ...current, operator: value }))}
          options={operatorOptions}
          testId="audit-filter-operator"
        />
        {isFiltered(filters) ? (
          <Button size="sm" variant="ghost" onPress={() => setFilters(EMPTY_FILTERS)}>
            {t('common.actions.clearFilters')}
          </Button>
        ) : null}
      </div>

      <RevealContext.Provider value={book}>
      <div ref={panelRef}>
      <div ref={fadeScope} className="sa-table-wrap" data-more-right={sideways === 'right' || sideways === 'both' ? 'true' : undefined} data-more-left={sideways === 'left' || sideways === 'both' ? 'true' : undefined}>
        <Table variant="secondary" className="sa-table">
          <Virtualizer layout={TableLayout} layoutOptions={{ rowHeight: ROW_HEIGHT, headingHeight: HEADING_HEIGHT }}>
            <Table.Content
              ref={tableRef}
              aria-label={t('securityAudit.audit.tableLabel')}
              data-testid="audit-table"
              sortDescriptor={
                sortColumn ? { column: sortColumn.id, direction: sortColumn.desc ? 'descending' : 'ascending' } : undefined
              }
              onSortChange={(descriptor) =>
                setSorting([{ id: String(descriptor.column), desc: descriptor.direction === 'descending' }])
              }
            >
              <Table.Header columns={COLUMNS}>
                {(column) => (
                  <Table.Column
                    id={column.id}
                    allowsSorting={column.sortable}
                    isRowHeader={column.rowHeader ?? false}
                    width={column.width}
                    minWidth={column.minWidth ?? null}
                  >
                    {t(`securityAudit.audit.columns.${column.id}`)}
                  </Table.Column>
                )}
              </Table.Header>
              <Table.Body
                items={rows}
                dependencies={[focusedSeq, t]}
                renderEmptyState={() => (
                  <div className="sa-empty" data-testid="audit-empty">
                    {t('securityAudit.audit.empty')}
                  </div>
                )}
              >
                {(row) => {
                  const position = positions.get(row.id) ?? 0
                  return (
                    <Table.Row
                      id={row.id}
                      columns={COLUMNS}
                      textValue={`#${row.seq} ${labelOf(row)}`}
                      data-chain={row.chain}
                      data-seq={row.seq}
                      data-focused-entry={focusedSeq === row.seq || undefined}
                    >
                      {(column) => (
                        <Table.Cell>
                          <RowReveal key={row.id} rowId={row.id} seq={row.seq} position={position}>
                            {renderCell(row, column.id)}
                          </RowReveal>
                        </Table.Cell>
                      )}
                    </Table.Row>
                  )
                }}
              </Table.Body>
            </Table.Content>
          </Virtualizer>
        </Table>
      </div>
      </div>
      </RevealContext.Provider>

      {sideways === 'none' ? null : (
        <p className="sa-sideways-cue" role="note" data-testid="audit-sideways-cue" data-more={sideways}>
          {sideways === 'left' ? <ArrowLeft className="sa-sideways-icon" aria-hidden="true" /> : null}
          <span>{t(`web.waveJ3.sideways.${sideways}`)}</span>
          {sideways === 'left' ? null : <ArrowRight className="sa-sideways-icon" aria-hidden="true" />}
        </p>
      )}

      <div className="sa-table-footer">
        <span>
          {live ? (
            <span className="inline-flex items-center gap-2 sa-tone-success">
              <span className="sa-dot" aria-hidden="true" />
              {t('securityAudit.audit.liveOn')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-3">
              <span>{t('securityAudit.audit.livePaused')}</span>
              {heldBack > 0 ? (
                <Chip size="sm" variant="soft" color="accent" data-testid="audit-held-back">
                  {t('securityAudit.audit.newEntries', { count: heldBack })}
                </Chip>
              ) : null}
              <Button size="sm" variant="ghost" onPress={() => setLiveMode(true)}>
                {t('securityAudit.audit.resume')}
              </Button>
            </span>
          )}
        </span>
        <span>
          {focusedSeq !== null ? t('securityAudit.audit.focused', { seq: focusedSeq }) : null}
          {audit.dropped > 0 ? ` ${t('securityAudit.audit.rotated', { count: audit.dropped })}` : null}
        </span>
      </div>

      <ExportAuditDialog isOpen={exportOpen} onOpenChange={setExportOpen} chain={chain} />
    </Panel>
  )
})
