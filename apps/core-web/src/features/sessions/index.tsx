import { useMemo } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Alert, Card, Chip, SearchField, Table, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatUtcOffset } from '@dems/shared/realtime'
import { useSim, useSimReady, type SimState } from '@dems/shared/sim'
import { PageHeader } from '@/components/shell/page-header'
import { causeWords } from '@/features/evidence/cause-words'
import { formatEvidenceDuration, formatWibDateTime } from '@/features/evidence/model'
import { useSessionCauses } from './causes'
import { quarantinedSessionIds, sessionRows, type SessionFilter, type SessionRow } from './model'
import './sessions.css'

const route = getRouteApi('/_app/session/history')
const selectHistory = (s: SimState) => s.sessionHistory
const selectAlerts = (s: SimState) => s.alerts
const FILTERS: readonly SessionFilter[] = ['ALL', 'SEALED', 'INCOMPLETE']

const STATE_COLOR = { SEALED: 'success', QUARANTINED: 'danger', RECORDED_NOT_SEALED: 'warning', NEVER_RECORDED: 'default' } as const

/**
 * Sessions, `/session/history` (fix wave J, driver J-W; finding JW-22; `contract_wave_j.md` J-S 10):
 * every finished session of the Core with its state - sealed (with its item), or INCOMPLETE with the
 * cause and what became of its recording. A quarantined recording says where it is and what to do.
 * Reached from the Dashboard, the Session Monitor and the Evidence page; the filter and the search
 * live in the URL (`?state=`, `?q=`), as on the Evidence page.
 */
export function SessionsPage() {
  const { t } = useTranslation()
  const ready = useSimReady()
  const history = useSim(selectHistory)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const filter: SessionFilter = search.state ?? 'ALL'
  // Fix wave J round three (J2-S 4): why a seal was given up, from operation 38's member by name, else from the session's alert.
  const alerts = useSim(selectAlerts)
  const wanted = useMemo(() => quarantinedSessionIds(history), [history])
  const causes = useSessionCauses(wanted)
  const rows = useMemo(() => sessionRows(history, filter, search.q, { alerts, causes }), [history, filter, search.q, alerts, causes])
  const incomplete = useMemo(() => history.filter((entry) => entry.outcome === 'INCOMPLETE').length, [history])
  const quarantined = wanted.length

  return (
    <div className="dems-page ses-page" data-testid="page-sessions">
      <PageHeader
        icon={History}
        title={t('web.waveJ.sessions.title')}
        subtitle={t('web.waveJ.sessions.subtitle')}
        status={
          <Chip size="sm" variant="soft" color={incomplete > 0 ? 'warning' : 'default'} data-testid="sessions-summary">
            <Chip.Label>{t('web.waveJ.sessions.summary', { total: history.length, incomplete })}</Chip.Label>
          </Chip>
        }
      />
      {quarantined > 0 ? (
        <Alert status="warning" data-testid="sessions-quarantine-note">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('web.waveJ.sessions.quarantineTitle', { count: quarantined })}</Alert.Title>
            <Alert.Description>{t('web.waveJ.sessions.quarantineBody')}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <Card className="ses-card">
        <div className="ses-toolbar">
          <SearchField
            aria-label={t('web.waveJ.sessions.search')}
            value={search.q ?? ''}
            onChange={(value) => void navigate({ search: (previous) => ({ ...previous, q: value === '' ? undefined : value }), replace: true })}
            className="ses-search"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={t('web.waveJ.sessions.search')} data-testid="sessions-search" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ToggleButtonGroup
            aria-label={t('web.waveJ.sessions.filterLabel')}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([filter])}
            onSelectionChange={(keys) => {
              const next = [...keys][0]
              if (next === 'ALL' || next === 'SEALED' || next === 'INCOMPLETE') void navigate({ search: (previous) => ({ ...previous, state: next === 'ALL' ? undefined : next }), replace: true })
            }}
            size="sm"
          >
            {FILTERS.map((key) => (
              <ToggleButton key={key} id={key} data-testid={`sessions-filter-${key}`}>
                {t(`web.waveJ.sessions.filter.${key}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        {rows.length === 0 ? (
          <p className="ses-empty" role="status" data-testid="sessions-empty">
            {!ready ? t('common.status.loading', { defaultValue: '…' }) : history.length === 0 ? t('web.waveJ.sessions.none') : t('web.waveJ.sessions.noMatch')}
          </p>
        ) : (
          <Table variant="secondary" className="ses-table">
            <Table.ScrollContainer>
              <Table.Content aria-label={t('web.waveJ.sessions.title')}>
                <Table.Header>
                  <Table.Column id="session" isRowHeader>
                    {t('web.waveJ.sessions.columns.session')}
                  </Table.Column>
                  <Table.Column id="case">{t('web.waveJ.sessions.columns.case')}</Table.Column>
                  <Table.Column id="time">
                    {t('web.waveJ.sessions.columns.time')} <span className="ses-zone">{`UTC${formatUtcOffset()}`}</span>
                  </Table.Column>
                  <Table.Column id="state">{t('web.waveJ.sessions.columns.state')}</Table.Column>
                </Table.Header>
                <Table.Body>
                  {rows.map((row) => (
                    <Table.Row key={row.entry.id} id={row.entry.id} data-testid={`session-row-${row.entry.id}`} data-state={row.state.kind}>
                      <Table.Cell>
                        <span className="ses-stack">
                          <span className="ses-mono">{row.entry.id}</span>
                          <span className="ses-caption">{row.entry.room}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="ses-stack">
                          <span className="ses-mono">{row.entry.caseNumber}</span>
                          <span className="ses-caption">{row.entry.subjectName}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="ses-stack">
                          <span className="ses-mono">{formatWibDateTime(row.entry.startedAt ?? row.entry.createdAt)}</span>
                          <span className="ses-caption">{row.entry.startedAt === null ? t('web.waveJ.sessions.notStarted') : formatEvidenceDuration(row.entry.durationMs)}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <SessionState row={row} />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card>
    </div>
  )
}

/** The state of one session: the chip, the cause by its name, what became of the recording, and the item link. */
function SessionState({ row }: { row: SessionRow }) {
  const { t } = useTranslation()
  const { state } = row
  return (
    <span className="ses-stack ses-state" data-testid="session-state" data-kind={state.kind}>
      <Chip size="sm" variant="soft" color={STATE_COLOR[state.kind]}>
        <Chip.Label>{t(`web.waveJ.sessions.state.${state.kind}`)}</Chip.Label>
      </Chip>
      {state.kind === 'SEALED' ? null : (
        <span className="ses-caption" data-testid="session-state-detail">
          {state.cause !== null ? `${t('evidence.itemFacts.interrupted.cause', { cause: causeWords(t, state.cause) })}. ` : null}
          {t(`web.waveJ.sessions.detail.${state.kind}`)}
        </span>
      )}
      {/* Fix wave J round three (J2-S 4): the cause the Core recorded for giving the seal up, as its code - never a guessed sentence. */}
      {state.kind === 'QUARANTINED' ? (
        <span className="ses-caption" data-testid="session-unsealable-cause" data-cause={row.unsealableCause ?? ''}>
          {row.unsealableCause !== null ? t('web.waveJ3.sessions.unsealableCause', { cause: row.unsealableCause }) : t('web.waveJ3.sessions.unsealableCauseUnknown')}
        </span>
      ) : null}
      {state.evidenceId !== null ? (
        <Link to="/evidence/$evidenceId" params={{ evidenceId: state.evidenceId }} className="dems-popover-link ses-link" data-testid="session-evidence-link">
          {state.evidenceId}
        </Link>
      ) : null}
    </span>
  )
}
