import { Button, Input, Label, ListBox, SearchField, Select, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import type { Key } from '@heroui/react'
import { motion } from 'motion/react'
import { CalendarRange, FilterX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { EvidenceStatus, SimOperator, SubjectType } from '@dems/shared/sim'
import { useMotionPolicy } from '@/motion'
import { STATUS_FILTERS, SUBJECT_TYPES } from './model'

export interface EvidenceFilters {
  q?: string
  status?: EvidenceStatus
  subjectType: SubjectType | null
  investigator?: string
  from?: string
  to?: string
}

export interface EvidenceToolbarProps {
  filters: EvidenceFilters
  investigators: readonly Pick<SimOperator, 'id' | 'displayName'>[]
  /** Counts per status filter (for the toggle labels' accessible descriptions). */
  statusCounts: Record<EvidenceStatus | 'ALL', number>
  onChange: (patch: Partial<Record<'q' | 'status' | 'caseType' | 'investigator' | 'from' | 'to', string | undefined>>) => void
  onClear: () => void
}

const ALL = 'ALL'

/**
 * Toolbar (01_specs §14.5.3; research/04 §5.1; mobile MB 5): SearchField, the status
 * ToggleButtonGroup (All / Recorded / Sealed / Exported / Under Review / Archived) whose selection
 * glides with `layoutId="tab-active-status"` (M-PG-EVID), the subject-type Select (the route's
 * `caseType` value: `EvidenceItem.caseType`), the investigator Select, and a from/to date range.
 *
 * DR-47-1: the range uses two kit `Input type="date"` fields instead of `DateRangePicker`, whose value
 * type needs `@internationalized/date`, which is not a declared core-web dependency (P1, P12).
 * Every change writes the URL search (`replace`), so filters survive a reload and never replay the
 * page enter (search-only changes keep the route key).
 */
export function EvidenceToolbar({ filters, investigators, statusCounts, onChange, onClear }: EvidenceToolbarProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const selectedStatus = filters.status ?? ALL
  const active =
    Boolean(filters.q) || Boolean(filters.status) || filters.subjectType !== null || Boolean(filters.investigator) || Boolean(filters.from) || Boolean(filters.to)

  const onStatus = (keys: Set<Key>) => {
    const [first] = [...keys]
    if (first === undefined) return
    onChange({ status: first === ALL ? undefined : String(first) })
  }

  return (
    <div className="evi-toolbar" data-testid="evidence-toolbar">
      <SearchField
        aria-label={t('evidence.toolbar.searchLabel')}
        value={filters.q ?? ''}
        onChange={(value) => onChange({ q: value.trim() ? value : undefined })}
        className="evi-search"
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t('evidence.toolbar.search')} data-testid="evidence-search" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <ToggleButtonGroup
        aria-label={t('evidence.toolbar.status')}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set<Key>([selectedStatus])}
        onSelectionChange={onStatus}
        className="evi-status-group"
        data-testid="evidence-status-filter"
      >
        {STATUS_FILTERS.map((status) => {
          const selected = status === selectedStatus
          return (
            <ToggleButton key={status} id={status} className="evi-status-toggle" data-status={status} aria-label={`${status === ALL ? t('evidence.toolbar.all') : t(`common.evidenceStatus.${status}`)} (${statusCounts[status]})`}>
              {selected ? (
                <motion.span
                  layoutId={m.flags.sharedLayout ? 'tab-active-status' : undefined}
                  className="evi-status-indicator"
                  transition={m.transitions.indicator}
                  aria-hidden="true"
                />
              ) : null}
              <span className="evi-status-toggle-label">
                {status === ALL ? t('evidence.toolbar.all') : t(`common.evidenceStatus.${status}`)}
              </span>
              <span className="evi-status-toggle-count" aria-hidden="true">
                {statusCounts[status]}
              </span>
            </ToggleButton>
          )
        })}
      </ToggleButtonGroup>

      <div className="evi-toolbar-selects">
        <Select
          aria-label={t('evidence.toolbar.subjectType')}
          placeholder={t('evidence.toolbar.subjectTypePlaceholder')}
          value={filters.subjectType ?? ALL}
          onChange={(value) => onChange({ caseType: value === null || value === ALL ? undefined : String(value) })}
          className="evi-select"
          data-testid="evidence-subject-filter"
        >
          <Label className="sr-only">{t('evidence.toolbar.subjectType')}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL} textValue={t('evidence.toolbar.allSubjectTypes')}>
                {t('evidence.toolbar.allSubjectTypes')}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {SUBJECT_TYPES.map((type) => (
                <ListBox.Item key={type} id={type} textValue={t(`common.subjectType.${type}`)}>
                  {t(`common.subjectType.${type}`)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          aria-label={t('evidence.toolbar.investigator')}
          placeholder={t('evidence.toolbar.investigatorPlaceholder')}
          value={filters.investigator ?? ALL}
          onChange={(value) => onChange({ investigator: value === null || value === ALL ? undefined : String(value) })}
          className="evi-select"
          data-testid="evidence-investigator-filter"
        >
          <Label className="sr-only">{t('evidence.toolbar.investigator')}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL} textValue={t('evidence.toolbar.allInvestigators')}>
                {t('evidence.toolbar.allInvestigators')}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {investigators.map((operator) => (
                <ListBox.Item key={operator.id} id={operator.id} textValue={operator.displayName}>
                  {operator.displayName}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <fieldset className="evi-date-range" aria-label={t('evidence.toolbar.dateRange')}>
          <CalendarRange className="evi-date-icon" aria-hidden="true" />
          <Input
            type="date"
            aria-label={t('evidence.toolbar.dateFrom')}
            value={filters.from ?? ''}
            max={filters.to}
            onChange={(event) => onChange({ from: event.target.value || undefined })}
            className="evi-date-input"
            data-testid="evidence-date-from"
          />
          <span className="evi-date-sep" aria-hidden="true">
            –
          </span>
          <Input
            type="date"
            aria-label={t('evidence.toolbar.dateTo')}
            value={filters.to ?? ''}
            min={filters.from}
            onChange={(event) => onChange({ to: event.target.value || undefined })}
            className="evi-date-input"
            data-testid="evidence-date-to"
          />
        </fieldset>

        <Button variant="ghost" size="sm" isDisabled={!active} onPress={onClear} data-testid="evidence-clear-filters">
          <FilterX className="size-4" aria-hidden="true" />
          {t('common.actions.clearFilters')}
        </Button>
      </div>
    </div>
  )
}
