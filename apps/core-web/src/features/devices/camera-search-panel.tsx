import { useEffect, useId, useState } from 'react'
import { Alert, Button, Chip, EmptyState, ProgressBar, Skeleton, Table } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { Cable, Radar, ScanSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CAPTURE_DISCOVERY_MAX_CANDIDATES, type CaptureCandidate } from '@dems/shared/api'
import { formatClock, useRetryCooldown } from '@dems/shared/realtime'
import { useSim } from '@dems/shared/sim'
import { OUTCOME_TONE } from './camera-connect'
import { CameraConnectDialog, type ConnectDialogExit } from './camera-connect-dialog'
import {
  CAMERA_SEARCH_ANCHOR,
  candidateGroups,
  candidateKind,
  candidateName,
  captureDiscoveryQueryKey,
  makeModelOf,
  searchProgress,
  useCameraSearchController,
  useGateReason,
  type CameraSearchController,
  type ConnectBlock,
  type DiscoverySearch,
  type DiscoveryState,
} from './camera-search'
import { SearchCamerasButton } from './camera-search-context'
import { CAPTURE_SELECTOR_ANCHOR } from './capture-selector'
import { useDeviceLabels } from './labels'
import { COUNTED_DEVICES, type CountedDeviceId } from './model'
import { DevicesPanel } from './panel'
import { DevelopmentSourceBadge } from './source-badge'

const isCountedDevice = (deviceId: string): deviceId is CountedDeviceId => (COUNTED_DEVICES as readonly string[]).includes(deviceId)

/** "CAM-01 · Camera 1" for a device the page names; the id alone for an added one (`CAM-03`). */
function useRegisteredLabel(): (deviceId: string) => string {
  const labels = useDeviceLabels()
  return (deviceId) => (isCountedDevice(deviceId) ? `${deviceId} · ${labels.name(deviceId)}` : deviceId)
}

/** The Core clock in quarter seconds: the bar moves with Core time and re-renders four times a second at most. */
const selectQuarterSeconds = (state: { clock: { now: number } }): number => Math.floor(state.clock.now / 250) * 250

/**
 * S3: a bounded search. The bar's value is `(Core now − startedAt) / windowMs`, clamped and never
 * lowered; the two sentences hold fixed numbers (no countdown). At 100 % the text says the search is
 * finishing — the bar never decides the end, operation 94 does.
 */
function Searching({ search }: { search: DiscoverySearch }) {
  const { t } = useTranslation()
  const coreNow = useSim(selectQuarterSeconds)
  // The highest value drawn for THIS search: the bar is never lowered (a Core clock correction cannot pull it back).
  const [held, setHeld] = useState({ searchId: search.searchId, value: 0 })
  const value = searchProgress(search, coreNow, held.searchId === search.searchId ? held.value : 0)
  if (held.searchId !== search.searchId || held.value !== value) setHeld({ searchId: search.searchId, value })
  return (
    <div className="dev-search-progress" data-testid="camera-search-searching" data-progress={Math.round(value)}>
      <ProgressBar aria-label={t('common.captureSearch.a11y.progress')} value={value} size="sm">
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <p className="dev-sel-reason" role="status" aria-live="polite" data-testid="camera-search-status">
        {value >= 100 ? t('common.captureSearch.finishing') : t('common.captureSearch.searching')}
      </p>
      {value >= 100 ? null : <p className="dev-sel-reason">{t('common.captureSearch.searchingHint', { seconds: Math.ceil(search.windowMs / 1000) })}</p>}
    </div>
  )
}

/** Untrusted device text (ux §8c.3): a text node, one line with an ellipsis, isolated, the whole text in the accessible name. */
function DeviceText({ text, className }: { text: string; className?: string }) {
  return (
    <bdi className={className ?? 'dev-search-device-text'} title={text} aria-label={text}>
      {text}
    </bdi>
  )
}

interface RowShared {
  connectBlock: ConnectBlock | null
  registeredLabel: (deviceId: string) => string
  onConnect: (candidate: CaptureCandidate) => void
  onViewDevice: (deviceId: string) => void
  opening: string | null
}

function CandidateStatus({ candidate, registeredLabel }: { candidate: CaptureCandidate; registeredLabel: (deviceId: string) => string }) {
  const { t } = useTranslation()
  const kind = candidateKind(candidate)
  return (
    <div className="dev-search-status" data-kind={kind}>
      {kind === 'REGISTERED' ? (
        <>
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>{t('common.captureSearch.status.REGISTERED')}</Chip.Label>
          </Chip>
          {candidate.deviceId === null ? null : <span className="dev-tile-sub">{registeredLabel(candidate.deviceId)}</span>}
          {candidate.addressChanged ? <span className="dev-sel-reason">{t('common.captureSearch.addressChanged')}</span> : null}
        </>
      ) : kind === 'NEW' ? (
        <Chip size="sm" variant="soft" color="accent">
          <Chip.Label>{t('common.captureSearch.status.NEW')}</Chip.Label>
        </Chip>
      ) : (
        <>
          <Chip size="sm" variant="soft" color="warning">
            <Chip.Label>{t('common.captureSearch.notTestable')}</Chip.Label>
          </Chip>
          <span className="dev-sel-reason">{t(kind === 'CONFLICT' ? 'common.captureSearch.conflict' : 'common.captureSearch.notTestableBody')}</span>
        </>
      )}
      {candidate.lastTest === null ? null : (
        // The outcome word and the Core's time of the last test of this row. A fact; never a value that was typed.
        <Chip size="sm" variant="soft" color={OUTCOME_TONE[candidate.lastTest.outcome]} data-testid={`camera-search-last-test-${candidate.candidateId}`} data-outcome={candidate.lastTest.outcome}>
          <Chip.Label>{t('devices.search.lastTest', { // R69-13: a camera whose sign-in method is not answered was sent no password - never "Password refused".
            outcome: candidate.lastTest.reason === 'SCHEME_NOT_ALLOWED' ? t('common.captureConnectTarget.schemeNotAllowedShort') : t(`common.captureConnect.outcomeShort.${candidate.lastTest.outcome}`),
            time: formatClock(candidate.lastTest.testedAt) })}</Chip.Label>
        </Chip>
      )}
    </div>
  )
}

function CandidateAction({ candidate, connectBlock, onConnect, onViewDevice, opening }: RowShared & { candidate: CaptureCandidate }) {
  const { t } = useTranslation()
  const reasonOf = useGateReason()
  const reasonId = useId()
  const kind = candidateKind(candidate)
  if (kind === 'REGISTERED') {
    return candidate.deviceId === null ? null : (
      <Button size="sm" variant="ghost" onPress={() => onViewDevice(candidate.deviceId!)} data-testid={`camera-search-view-${candidate.candidateId}`}>
        {t('common.captureSearch.viewDevice')}
      </Button>
    )
  }
  // A device that cannot be connected is listed and has no Connect at all (D80(11), D86 SEC35-28).
  if (kind !== 'NEW') return null
  const reason = reasonOf(connectBlock)
  return (
    <span className="dev-search-control" data-block={connectBlock?.kind}>
      <Button
        size="sm"
        variant="primary"
        isDisabled={connectBlock !== null || opening !== null}
        isPending={opening === candidate.candidateId}
        onPress={() => onConnect(candidate)}
        aria-describedby={reason === null ? undefined : reasonId}
        data-testid={`camera-search-connect-${candidate.candidateId}`}
      >
        <Cable aria-hidden="true" size={14} />
        {t('common.captureConnect.action')}
      </Button>
      {reason === null ? null : (
        <span id={reasonId} className="dev-sel-reason" data-testid={`camera-search-connect-reason-${candidate.candidateId}`}>
          {reason}
        </span>
      )}
    </span>
  )
}

function CandidateTable({ label, testId, candidates, development, ...shared }: RowShared & { label: string; testId: string; candidates: readonly CaptureCandidate[]; development: boolean }) {
  const { t } = useTranslation()
  return (
    <Table variant="secondary" className="dev-search-table">
      <Table.ScrollContainer>
        <Table.Content aria-label={label} data-testid={testId}>
          <Table.Header>
            <Table.Column isRowHeader>{t('common.captureSearch.columns.address')}</Table.Column>
            <Table.Column>{t('common.captureSearch.columns.makeModel')}</Table.Column>
            <Table.Column>{t('common.captureSearch.columns.name')}</Table.Column>
            <Table.Column>{t('common.captureSearch.columns.status')}</Table.Column>
            <Table.Column>
              <span className="sr-only">{t('devices.search.actions')}</span>
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {/* The order of operation 94, as it is: the list is never re-sorted, filtered or merged (ux §8c.3). */}
            {candidates.map((candidate) => {
              const makeModel = makeModelOf(candidate)
              return (
                <Table.Row
                  key={candidate.candidateId}
                  id={candidate.candidateId}
                  textValue={`${candidate.host} ${candidateName(candidate)}`}
                  data-testid={`camera-search-row-${candidate.candidateId}`}
                  data-status={candidate.status}
                  data-kind={candidateKind(candidate)}
                  data-source-class={candidate.sourceClass}
                >
                  {/* The address the answer came from: plain text, never a link and never a URL. */}
                  <Table.Cell>
                    <span className="font-mono" data-testid={`camera-search-host-${candidate.candidateId}`}>
                      {candidate.host}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {makeModel === null ? <span className="dev-sel-reason">{t('common.captureSearch.makeModelUnknown')}</span> : <DeviceText text={makeModel} />}
                    {development ? <DevelopmentSourceBadge adapter={candidate.adapter} kind="CAMERA" testId={`camera-search-badge-${candidate.candidateId}`} /> : null}
                  </Table.Cell>
                  <Table.Cell>{candidate.name === null ? null : <DeviceText text={candidate.name} />}</Table.Cell>
                  <Table.Cell>
                    <CandidateStatus candidate={candidate} registeredLabel={shared.registeredLabel} />
                  </Table.Cell>
                  <Table.Cell>
                    <CandidateAction candidate={candidate} {...shared} />
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}

function Results({ state, search, shared }: { state: DiscoveryState; search: DiscoverySearch; shared: RowShared }) {
  const { t } = useTranslation()
  const groups = candidateGroups(state.candidates)
  return (
    <div className="dev-search-results" data-testid="camera-search-results" data-search={search.searchId}>
      <p className="dev-tile-name" data-testid="camera-search-summary">
        {t('common.captureSearch.summary', { count: search.responderCount, newCount: search.newCount, registeredCount: search.registeredCount })}
      </p>
      <p className="dev-sel-reason" data-testid="camera-search-networks">
        {t('common.captureSearch.networksSearched', { count: search.interfaceCount })}
      </p>
      {state.truncated ? (
        <Alert status="warning" data-testid="camera-search-truncated">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('common.captureSearch.truncated', { max: CAPTURE_DISCOVERY_MAX_CANDIDATES })}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {groups.network.length > 0 ? (
        <CandidateTable label={t('devices.search.tableLabel')} testId="camera-search-table" candidates={groups.network} development={false} {...shared} />
      ) : null}
      {/* Development sources are their own group, drawn only when the Core listed one; the console has no switch or filter (ux §8c.3). */}
      {groups.development.length > 0 ? (
        <section aria-label={t('common.captureSearch.developmentGroup')} data-testid="camera-search-development">
          <h3 className="dev-sel-group">{t('common.captureSearch.developmentGroup')}</h3>
          <CandidateTable label={t('common.captureSearch.developmentGroup')} testId="camera-search-development-table" candidates={groups.development} development {...shared} />
        </section>
      ) : null}
      <p className="dev-sel-reason" data-testid="camera-search-trust">
        {t('common.captureSearch.trustNote')}
      </p>
      <p className="dev-sel-reason" data-testid="camera-search-freshness">
        {/* Two clock times from Core instants; nothing counts down and no client clock removes the list (ux §8c.4). */}
        {t('common.captureSearch.freshness', { searchedAt: formatClock(search.completesAt), keptUntil: formatClock(search.expiresAt) })} {t('common.captureSearch.ownerNote')}
      </p>
    </div>
  )
}

function ReadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <Alert status="danger" data-testid="camera-search-read-failed">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('devices.search.readFailed')}</Alert.Title>
      </Alert.Content>
      <Button size="sm" variant="outline" onPress={retry} isDisabled={!canRetry} data-testid="camera-search-read-retry">
        {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
      </Button>
    </Alert>
  )
}

function SearchBody({ search, shared }: { search: CameraSearchController; shared: RowShared }) {
  const { t } = useTranslation()
  const { panel, read } = search
  switch (panel) {
    case 'CHECKING':
    case 'LOADING':
      // S1: a skeleton, and the gated control says it is being checked.
      return (
        <div className="dev-sel-pending" data-testid="camera-search-pending" data-read={panel} aria-busy="true">
          <Skeleton className="dev-sel-skeleton" />
        </div>
      )
    case 'FORBIDDEN':
      // S13: no list is requested or drawn. The control beside the title carries the role sentence.
      return (
        <p className="dev-sel-reason" data-testid="camera-search-forbidden">
          {t('common.captureSearch.intro')}
        </p>
      )
    case 'READ_FAILED':
      return <ReadFailed onRetry={search.retryRead} />
    case 'IDLE':
      return (
        <p className="dev-sel-reason" data-testid="camera-search-idle">
          {t('common.captureSearch.intro')}
        </p>
      )
    case 'EXPIRED':
      // S12: the Core no longer keeps the result (expiry, sign-out, restart, a newer search of the owner).
      return (
        <p className="dev-sel-reason" role="status" data-testid="camera-search-expired">
          {t('common.captureSearch.expired')}
        </p>
      )
    case 'FAILED':
      // S8: "the search could not run" — its own state, never an empty list. The failure code is not shown as text.
      return (
        <Alert status="danger" data-testid="camera-search-failed">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('common.captureSearch.failed')}</Alert.Title>
          </Alert.Content>
          <SearchCamerasButton place="failed" again />
        </Alert>
      )
    case 'SEARCHING':
    case 'RESULTS':
    case 'EMPTY':
      break
  }
  if (read.kind !== 'READY' || read.state.search === null) return null
  if (panel === 'SEARCHING') return <Searching search={read.state.search} />
  if (panel === 'EMPTY') {
    // S5. The alert of this situation is raised by the Core, not by this screen (flow 11, situation A).
    return (
      <EmptyState className="dev-sel-empty" data-testid="camera-search-empty">
        <ScanSearch className="size-8 text-foreground-2" aria-hidden="true" />
        <p className="dev-tile-name">{t('common.captureSearch.emptyTitle')}</p>
        <p className="dev-sel-reason">{t('common.captureSearch.emptyBody')}</p>
        <SearchCamerasButton place="empty" again />
      </EmptyState>
    )
  }
  return <Results state={read.state} search={read.state.search} shared={shared} />
}

/** The inline notices of a refused search: explained states in the panel, never a toast (ux §8c.2 S8 to S10). */
function SearchNotices({ search }: { search: CameraSearchController }) {
  const { t } = useTranslation()
  if (search.notice === 'UNAVAILABLE') {
    // S9: Retry repeats the call once per press; nothing retries by itself.
    return (
      <Alert status="warning" data-testid="camera-search-unavailable">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('common.captureSearch.unavailable')}</Alert.Title>
        </Alert.Content>
      </Alert>
    )
  }
  if (search.notice === 'BUSY') {
    // S10: the button stays enabled; nothing is polled for the other operator's search.
    return (
      <p className="dev-sel-reason" role="status" data-testid="camera-search-busy">
        {t('common.captureSearch.busy')}
      </p>
    )
  }
  if (search.notice === 'FAILED') {
    return (
      <Alert status="danger" data-testid="camera-search-request-failed">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('common.captureSearch.failed')}</Alert.Title>
        </Alert.Content>
      </Alert>
    )
  }
  return null
}

/** ux §14.3: the end of a search is announced once, politely, with the two counts. */
function useSearchAnnouncement(search: CameraSearchController): string {
  const { t } = useTranslation()
  const [announcement, setAnnouncement] = useState('')
  const [wasSearching, setWasSearching] = useState(search.panel === 'SEARCHING')
  const searching = search.panel === 'SEARCHING'
  if (searching !== wasSearching) {
    setWasSearching(searching)
    const done = !searching && search.read.kind === 'READY' ? search.read.state.search : null
    setAnnouncement(done === null ? '' : t('common.captureSearch.a11y.done', { count: done.responderCount, newCount: done.newCount }))
  }
  return announcement
}

export interface CameraSearchPanelProps {
  /** "View device" of a registered row: the page opens what it has for that device. */
  onViewDevice: (deviceId: string) => void
}

/**
 * The panel "Camera search" of Devices & Inputs (ux §8c flow 9, §8d flow 10; WB-05): the search
 * action with its bounded progress, the list of what answered (new, already registered, cannot be
 * connected; development sources as their own group), and Connect, which opens the connect dialog.
 *
 * Only the operator session that searched sees the list; the panel says so. Every state is an
 * answer of operation 93 or 94 — the console infers none, sorts nothing and removes nothing by its
 * own clock.
 */
export function CameraSearchPanel({ onViewDevice }: CameraSearchPanelProps) {
  const { t } = useTranslation()
  const search = useCameraSearchController()
  const queryClient = useQueryClient()
  const registeredLabel = useRegisteredLabel()
  const announcement = useSearchAnnouncement(search)
  /** The row whose Connect was pressed, as it was when the dialog opened. */
  const [dialog, setDialog] = useState<CaptureCandidate | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  // The System entry and the notifications link here (`/devices#camera-search`); the page is a lazy chunk.
  useEffect(() => {
    if (window.location.hash !== `#${CAMERA_SEARCH_ANCHOR}`) return
    document.getElementById(CAMERA_SEARCH_ANCHOR)?.scrollIntoView?.({ block: 'start' })
  }, [])

  const onConnect = (candidate: CaptureCandidate) => {
    if (opening !== null || search.connectBlock !== null) return
    setOpening(candidate.candidateId)
    // ux §8d.2: operation 94 is read again before the dialog opens. A result that is no longer kept
    // shows as S12 in the panel, and no dialog opens over a row the Core no longer holds.
    void search
      .refresh()
      .then(() => {
        const fresh = queryClient.getQueryData<DiscoveryState>(captureDiscoveryQueryKey(search.gate.owner))
        const found = fresh?.candidates.find((entry) => entry.candidateId === candidate.candidateId)
        if (found !== undefined && candidateKind(found) === 'NEW') setDialog(found)
      })
      .finally(() => setOpening(null))
  }

  const onExit = (exit: ConnectDialogExit) => {
    setDialog(null)
    if (exit.kind === 'ASSIGN') document.getElementById(CAPTURE_SELECTOR_ANCHOR)?.scrollIntoView?.({ block: 'start' })
    if (exit.kind === 'SEARCH_AGAIN') void search.start()
    if (exit.kind === 'VIEW_DEVICE') onViewDevice(exit.deviceId)
  }

  const shared: RowShared = { connectBlock: search.connectBlock, registeredLabel, onConnect, onViewDevice, opening }

  return (
    <>
      <DevicesPanel
        id="search"
        anchorId={CAMERA_SEARCH_ANCHOR}
        icon={Radar}
        title={t('devices.search.title')}
        subtitle={t('devices.search.subtitle')}
        action={<SearchCamerasButton place="panel" variant="primary" />}
      >
        <div className="dev-search" data-testid="camera-search" data-state={search.panel}>
          <SearchNotices search={search} />
          <SearchBody search={search} shared={shared} />
          <span className="sr-only" role="status" aria-live="polite" data-testid="camera-search-announcement">
            {announcement}
          </span>
        </div>
      </DevicesPanel>
      <CameraConnectDialog
        candidate={dialog}
        locked={search.connectBlock?.kind === 'LOCKED'}
        deviceLabel={registeredLabel}
        onAnswered={() => void search.refresh()}
        onExit={onExit}
      />
    </>
  )
}
