import { useRef } from 'react'
import { Button, Checkbox, Dropdown, EmptyState, Label, Pagination, Skeleton, Spinner, Table } from '@heroui/react'
import type { Key, Selection, SortDescriptor } from '@heroui/react'
import { Archive, Eye, FileVideo, FilterX, MoreVertical, Share2, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatUtcOffset } from '@dems/shared/realtime'
import { useRouteEnterDelay } from '@/components/shell/shell-motion-context'
import { EvidenceStatusChip, SubjectTypeChip } from './chips'
import { ROW_REVEAL_DELAY_MS } from './choreography'
import { useEvidenceAssets } from './demo-assets'
import { ItemDevelopmentBadge } from './development-source'
import { InterruptedMark } from './item-marks'
import {
  ARCHIVABLE_STATUSES,
  byteSize,
  EXPORTABLE_STATUSES,
  formatEvidenceDuration,
  formatWibClock,
  formatWibDate,
  type EvidenceRow,
} from './model'
import type { EvidenceSortColumn, EvidenceTableModel } from './use-evidence-table'
import { useRowMotion } from './use-row-motion'

export interface EvidenceTableProps {
  model: EvidenceTableModel
  loading: boolean
  previewId: string | null
  selectedIds: ReadonlySet<string>
  canArchive: boolean
  /** The item whose archive is out (Live mode, LB-1): its menu offers no second archive; the table is `aria-busy`. */
  busyId?: string | null
  /** The item whose archive has been out for `LIVE_PENDING_REVEAL_MS`: its menu trigger shows the kit's spinner. */
  pendingId?: string | null
  onSelectionChange: (ids: Set<string>) => void
  onRowAction: (row: EvidenceRow) => void
  onView: (row: EvidenceRow, origin: Element | null) => void
  onVerify: (row: EvidenceRow, origin: Element | null) => void
  onExport: (rows: EvidenceRow[]) => void
  onArchive: (row: EvidenceRow) => void
  onPageChange: (page: number) => void
  onClearFilters: () => void
}

const SORTABLE: EvidenceSortColumn[] = ['evidence', 'subject', 'case', 'duration', 'status']

/**
 * Evidence table (01_specs §14.5.3; research/04 §5.1; mobile MB 5): the kit `Table` (React Aria)
 * rendering the TanStack model, with bulk-selection checkboxes, sortable headers, a kebab
 * `Dropdown` per row (View, Verify, Export, Archive), `Pagination` at 10 per page (AC-64), a
 * `Skeleton` while the simulator hydrates and an `EmptyState` when the filters match nothing.
 * Cells are two-line (ID over recorded time, subject over its type chip, case over investigator,
 * duration over size) so the table fits the 8-of-12 column at 1440 px (DR-47-2).
 * Motion (M-C-11): `useRowMotion` reveals, FLIPs and cross-fades the rows.
 */
export function EvidenceTable(props: EvidenceTableProps) {
  const { model, loading, previewId, selectedIds, canArchive, busyId = null, pendingId = null, onSelectionChange, onRowAction, onView, onVerify, onExport, onArchive, onPageChange, onClearFilters } = props
  const { t } = useTranslation()
  const { urlFor } = useEvidenceAssets()
  const routeDelay = useRouteEnterDelay()
  const containerRef = useRef<HTMLDivElement>(null)
  useRowMotion(containerRef, { revealDelayMs: routeDelay + ROW_REVEAL_DELAY_MS })

  const sort = model.sorting[0]
  const sortDescriptor: SortDescriptor | undefined = sort
    ? { column: sort.id, direction: sort.desc ? 'descending' : 'ascending' }
    : undefined
  const onSortChange = (descriptor: SortDescriptor) => {
    model.setSorting([{ id: String(descriptor.column), desc: descriptor.direction === 'descending' }])
  }

  const selection: Selection = new Set<Key>([...selectedIds].filter((id) => model.pageRows.some((row) => row.id === id)))
  const onSelection = (keys: Selection) => {
    const pageIds = new Set(model.pageRows.map((row) => row.id))
    const kept = [...selectedIds].filter((id) => !pageIds.has(id))
    const chosen = keys === 'all' ? [...pageIds] : [...keys].map(String)
    onSelectionChange(new Set([...kept, ...chosen]))
  }

  const originOf = (row: EvidenceRow) => containerRef.current?.querySelector(`[data-header-origin="${CSS.escape(row.id)}"]`) ?? null

  const onMenuAction = (row: EvidenceRow, key: Key) => {
    if (key === 'view') onView(row, originOf(row))
    else if (key === 'verify') onVerify(row, originOf(row))
    else if (key === 'export') onExport([row])
    else if (key === 'archive') onArchive(row)
  }

  const page = model.pageIndex + 1
  const pages = model.pageCount
  const first = model.total === 0 ? 0 : model.pageIndex * 10 + 1
  const last = Math.min(model.total, (model.pageIndex + 1) * 10)

  return (
    // LB-1: the kit's Button and React Aria's rows drop `aria-busy` (F63-2), so the table's wrapper carries it.
    <div
      ref={containerRef}
      className="evi-table-wrap"
      data-testid="evidence-table"
      data-page={page}
      data-pages={pages}
      data-total={model.total}
      aria-busy={busyId !== null || undefined}
      data-busy-id={busyId ?? undefined}
    >
      <Table variant="primary" className="evi-table">
        <Table.ScrollContainer>
          <Table.Content
            aria-label={t('evidence.table.label')}
            selectionMode="multiple"
            selectionBehavior="toggle"
            selectedKeys={selection}
            onSelectionChange={onSelection}
            sortDescriptor={sortDescriptor}
            onSortChange={onSortChange}
            onRowAction={(key) => {
              const row = model.pageRows.find((entry) => entry.id === key)
              if (row) onRowAction(row)
            }}
          >
            <Table.Header>
              <Table.Column id="select" className="evi-col-select">
                <Checkbox slot="selection" aria-label={t('evidence.table.selectAll')}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              </Table.Column>
              <Table.Column id="preview" className="evi-col-thumb">
                <span className="sr-only">{t('evidence.table.columns.thumbnail')}</span>
              </Table.Column>
              {SORTABLE.map((column) => (
                <Table.Column key={column} id={column} allowsSorting isRowHeader={column === 'evidence'} className={`evi-col-${column}`}>
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection ?? undefined}>
                      {column === 'evidence' ? (
                        // AC-74 (step 45b, F45-04): the Recorded times below are UTC+07:00. Title
                        // and zone are one inline run, so the zone follows "Recorded" and wraps with it.
                        <span>
                          {t(`evidence.table.sortColumns.${column}`)}{' '}
                          <span className="evi-col-zone" data-testid="evidence-col-zone">{`UTC${formatUtcOffset()}`}</span>
                        </span>
                      ) : (
                        t(`evidence.table.sortColumns.${column}`)
                      )}
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
              ))}
              <Table.Column id="actions" className="evi-col-actions">
                <span className="sr-only">{t('evidence.table.columns.actions')}</span>
              </Table.Column>
            </Table.Header>
            <Table.Body
              renderEmptyState={() =>
                loading ? null : (
                  <EmptyState className="evi-empty" data-testid="evidence-empty">
                    <FilterX className="size-8 text-foreground-2" aria-hidden="true" />
                    <p className="evi-empty-title">{t('evidence.table.empty.title')}</p>
                    <p className="evi-empty-body">{t('evidence.table.empty.body')}</p>
                    <Button variant="outline" size="sm" onPress={onClearFilters}>
                      {t('common.actions.clearFilters')}
                    </Button>
                  </EmptyState>
                )
              }
            >
              {loading
                ? Array.from({ length: 6 }, (_, index) => (
                    <Table.Row key={`skeleton-${index}`} id={`skeleton-${index}`} className="evi-row evi-row-skeleton">
                      {Array.from({ length: 9 }, (_, cell) => (
                        <Table.Cell key={cell}>
                          <Skeleton className="evi-skeleton-line" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                : model.pageRows.map((row) => {
                    const exportable = EXPORTABLE_STATUSES.includes(row.item.status)
                    const archivable = canArchive && ARCHIVABLE_STATUSES.includes(row.item.status) && busyId === null
                    const rowPending = pendingId === row.id
                    const size = byteSize(row.item.sizeBytes)
                    const thumb = urlFor(row.thumbPath)
                    return (
                      <Table.Row
                        key={row.id}
                        id={row.id}
                        data-row-id={row.id}
                        data-previewed={previewId === row.id ? 'true' : undefined}
                        className="evi-row"
                        textValue={`${row.id} ${row.item.subjectName}`}
                      >
                        <Table.Cell className="evi-col-select">
                          <Checkbox slot="selection" aria-label={t('evidence.table.selectRow', { id: row.id })}>
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </Table.Cell>
                        <Table.Cell className="evi-col-thumb">
                          <span className="evi-thumb" data-has-media={thumb ? 'true' : 'false'}>
                            {thumb ? (
                              <img src={thumb} alt="" width={64} height={36} loading="lazy" decoding="async" />
                            ) : (
                              <FileVideo className="size-4" aria-hidden="true" />
                            )}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="evi-cell-stack" data-header-origin={row.id}>
                            <span className="evi-id">{row.id}</span>
                            <span className="evi-caption">
                              {formatWibDate(row.item.recordedAt)} · {formatWibClock(row.item.recordedAt)}
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="evi-cell-stack">
                            <span className="evi-strong">{row.item.subjectName}</span>
                            <SubjectTypeChip type={row.item.subjectType} />
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="evi-cell-stack">
                            <span className="evi-mono">{row.item.caseNumber}</span>
                            <span className="evi-caption">{row.investigatorName}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="evi-cell-stack">
                            <span className="evi-mono">{formatEvidenceDuration(row.item.durationMs)}</span>
                            <span className="evi-caption">{t(`common.units.${size.unit}`, { value: size.value })}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <EvidenceStatusChip status={row.item.status} />
                          {/* Row 92 (R-11): drawn only for an item the Core recorded from development sources, in Live mode. */}
                          <ItemDevelopmentBadge item={row.item} testId={`evidence-row-development-${row.id}`} />
                          {/* Wave H C2 (G75-03): drawn only for an item that says `interrupted: true`. */}
                          <InterruptedMark item={row.item} testId={`evidence-row-interrupted-${row.id}`} />
                        </Table.Cell>
                        <Table.Cell className="evi-col-actions">
                          <Dropdown>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label={t('evidence.table.rowActions.label', { id: row.id })}
                              data-testid={`evidence-row-menu-${row.id}`}
                              isPending={rowPending}
                              data-pending={rowPending ? 'true' : undefined}
                            >
                              {rowPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <MoreVertical className="size-4" aria-hidden="true" />}
                            </Button>
                            <Dropdown.Popover placement="bottom end" className="min-w-[200px]">
                              <Dropdown.Menu
                                aria-label={t('evidence.table.rowActions.label', { id: row.id })}
                                disabledKeys={[...(exportable ? [] : ['export']), ...(archivable ? [] : ['archive'])]}
                                onAction={(key) => onMenuAction(row, key)}
                              >
                                <Dropdown.Item id="view" textValue={t('evidence.table.rowActions.view')}>
                                  <Eye className="size-4" aria-hidden="true" />
                                  <Label>{t('evidence.table.rowActions.view')}</Label>
                                </Dropdown.Item>
                                <Dropdown.Item id="verify" textValue={t('evidence.table.rowActions.verify')}>
                                  <ShieldCheck className="size-4" aria-hidden="true" />
                                  <Label>{t('evidence.table.rowActions.verify')}</Label>
                                </Dropdown.Item>
                                <Dropdown.Item id="export" textValue={t('evidence.table.rowActions.export')}>
                                  <Share2 className="size-4" aria-hidden="true" />
                                  <Label>{t('evidence.table.rowActions.export')}</Label>
                                </Dropdown.Item>
                                <Dropdown.Item id="archive" textValue={t('evidence.table.rowActions.archive')}>
                                  <Archive className="size-4" aria-hidden="true" />
                                  <Label>{t('evidence.table.rowActions.archive')}</Label>
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer className="evi-table-footer">
          <Pagination size="sm" aria-label={t('evidence.table.paginationLabel')} data-testid="evidence-pagination">
            <Pagination.Summary>
              <span className="evi-caption" data-testid="evidence-page-summary">
                {t('evidence.table.range', { first, last, total: model.total })}
              </span>
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous isDisabled={page <= 1} onPress={() => onPageChange(page - 1)} aria-label={t('evidence.table.previousPage')}>
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
                <Pagination.Item key={number}>
                  <Pagination.Link
                    isActive={number === page}
                    aria-current={number === page ? 'page' : undefined}
                    aria-label={t('evidence.table.pageLabel', { page: number })}
                    onPress={() => onPageChange(number)}
                    data-testid={`evidence-page-${number}`}
                  >
                    {number}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next isDisabled={page >= pages} onPress={() => onPageChange(page + 1)} aria-label={t('evidence.table.nextPage')}>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      </Table>
    </div>
  )
}
