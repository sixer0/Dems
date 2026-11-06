/**
 * The evidence table model: TanStack Table v8 (01_specs §14.5.3, SD-31) with the sorting, filtering
 * and pagination row models. Filters come from the URL search (step 38's `validateSearch`), sorting is
 * local, and the page size is 10 (AC-64).
 *
 * - Global filter = the search box, matching the evidence ID, case number and subject (AC-64).
 * - Column filters: status, case type (`caseType`: the examination type), investigator, recorded date range.
 * - The page index is clamped to the last page, so a stale `?page=9` shows the last page.
 */
import { useMemo, useState } from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
} from '@tanstack/react-table'
import type { EvidenceStatus } from '@dems/shared/sim'
import { matchesSearch, withinDateRange, type EvidenceRow } from './model'
import type { EvidenceFilters } from './toolbar'

export const EVIDENCE_PAGE_SIZE = 10

export type EvidenceSortColumn = 'evidence' | 'subject' | 'case' | 'duration' | 'status'

const dateRangeFilter: FilterFn<EvidenceRow> = (row, _columnId, value: { from?: string; to?: string }) =>
  withinDateRange(row.original.recordedDay, value?.from, value?.to)

const equalsFilter: FilterFn<EvidenceRow> = (row, columnId, value: unknown) => row.getValue(columnId) === value

const STATUS_ORDER: Record<EvidenceStatus, number> = {
  RECORDED: 0,
  SEALED: 1,
  UNDER_REVIEW: 2,
  EXPORTED: 3,
  ARCHIVED: 4,
}

const COLUMNS: ColumnDef<EvidenceRow>[] = [
  { id: 'evidence', accessorFn: (row) => row.item.recordedAt, sortingFn: 'basic', enableGlobalFilter: true },
  { id: 'subject', accessorFn: (row) => row.item.subjectName, sortingFn: 'alphanumeric' },
  { id: 'case', accessorFn: (row) => row.item.caseNumber, sortingFn: 'alphanumeric' },
  { id: 'duration', accessorFn: (row) => row.item.durationMs, sortingFn: 'basic' },
  { id: 'status', accessorFn: (row) => STATUS_ORDER[row.item.status], sortingFn: 'basic', enableGlobalFilter: false },
  { id: 'statusValue', accessorFn: (row) => row.item.status, filterFn: equalsFilter, enableGlobalFilter: false, enableSorting: false },
  { id: 'subjectType', accessorFn: (row) => row.item.caseType ?? row.item.subjectType, filterFn: equalsFilter, enableGlobalFilter: false, enableSorting: false },
  { id: 'investigator', accessorFn: (row) => row.item.investigatorId, filterFn: equalsFilter, enableGlobalFilter: false, enableSorting: false },
  { id: 'recordedDay', accessorFn: (row) => row.recordedDay, filterFn: dateRangeFilter, enableGlobalFilter: false, enableSorting: false },
]

export interface EvidenceTableModel {
  pageRows: EvidenceRow[]
  /** Every row that passes the filters, in the current sort order (bulk "select all"). */
  filteredRows: EvidenceRow[]
  pageIndex: number
  pageCount: number
  total: number
  sorting: SortingState
  setSorting: (sorting: SortingState) => void
}

export function useEvidenceTable(rows: readonly EvidenceRow[], filters: EvidenceFilters, page: number | undefined): EvidenceTableModel {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'evidence', desc: true }])

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const out: ColumnFiltersState = []
    if (filters.status) out.push({ id: 'statusValue', value: filters.status })
    if (filters.subjectType) out.push({ id: 'subjectType', value: filters.subjectType })
    if (filters.investigator) out.push({ id: 'investigator', value: filters.investigator })
    if (filters.from || filters.to) out.push({ id: 'recordedDay', value: { from: filters.from, to: filters.to } })
    return out
  }, [filters.status, filters.subjectType, filters.investigator, filters.from, filters.to])

  const data = useMemo(() => [...rows], [rows])
  const requestedIndex = Math.max(0, (page ?? 1) - 1)

  // TanStack Table (SD-31) returns non-memoisable functions; core-web does not run the React Compiler.
  // eslint-disable-next-line react/incompatible-library
  const table = useReactTable<EvidenceRow>({
    data,
    columns: COLUMNS,
    getRowId: (row) => row.id,
    state: {
      sorting,
      columnFilters,
      globalFilter: filters.q ?? '',
      pagination: { pageIndex: requestedIndex, pageSize: EVIDENCE_PAGE_SIZE },
    },
    onSortingChange: (updater) => setSorting((previous) => (typeof updater === 'function' ? updater(previous) : updater)),
    globalFilterFn: (row, _columnId, value: string) => matchesSearch(row.original, value),
    getColumnCanGlobalFilter: (column) => column.id === 'evidence',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    manualPagination: false,
  })

  const filteredRows = table.getPrePaginationRowModel().rows.map((row) => row.original)
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / EVIDENCE_PAGE_SIZE))
  const pageIndex = Math.min(requestedIndex, pageCount - 1)
  // The pagination row model serves the page; a stale `?page=` beyond the last page is clamped.
  const pageRows =
    pageIndex === requestedIndex
      ? table.getRowModel().rows.map((row) => row.original)
      : filteredRows.slice(pageIndex * EVIDENCE_PAGE_SIZE, (pageIndex + 1) * EVIDENCE_PAGE_SIZE)

  return { pageRows, filteredRows, pageIndex, pageCount, total: filteredRows.length, sorting, setSorting }
}
