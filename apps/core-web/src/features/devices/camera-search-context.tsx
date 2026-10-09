import { useId, type ReactNode } from 'react'
import { Button, Spinner } from '@heroui/react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { CAMERA_SEARCH_ANCHOR, CameraSearchContext, startRefusal, useCameraSearch, useCameraSearchController, useGateReason } from './camera-search'
import { MicRescanContext, rescanRefusal, useMicRescan, useMicRescanController } from './capture-inputs'

/**
 * One camera search per page (ux §8c.1: "both are the same control (G13) and the same operation"):
 * the header action, the search panel, the empty state of the selector and every notification press
 * the control this provider holds. Mounting it starts nothing — it reads operation 94 once, which
 * never probes. It also holds the page's one microphone re-read control (G17, operation 97).
 */
export function CameraSearchProvider({ children }: { children: ReactNode }) {
  const controller = useCameraSearch()
  const micRescan = useMicRescan()
  return (
    <CameraSearchContext value={controller}>
      <MicRescanContext value={micRescan}>{children}</MicRescanContext>
    </CameraSearchContext>
  )
}

export interface SearchCamerasButtonProps {
  /** Where the control stands; part of its test id (`search-cameras-<place>`). */
  place: string
  /** A notification always says "Search again"; the panel and the header say "Search for cameras" until a search ran. */
  again?: boolean
  variant?: 'primary' | 'outline'
  /** Scroll the search panel into view when the search was accepted (a control that stands elsewhere on the page). */
  reveal?: boolean
}

/**
 * G13, "Search for cameras" / "Search again": one press is one operation 93. Disabled with its
 * reason — never hidden — while the role is being checked, for a role without `CAPTURE_CONFIG`,
 * while the Core does not search (a recording before the lift) and until the instant the Core named
 * after too many searches. Pending while the request is out and while the search runs: a second
 * press changes nothing (ux §8c.4).
 */
export function SearchCamerasButton({ place, again, variant = 'outline', reveal = false }: SearchCamerasButtonProps) {
  const { t } = useTranslation()
  const search = useCameraSearchController()
  const reasonOf = useGateReason()
  const presentCoreError = useCoreErrorPresenter()
  const reasonId = useId()
  const reason = reasonOf(search.block)
  const running = search.starting || search.panel === 'SEARCHING'
  const ranBefore = search.panel !== 'IDLE' && search.panel !== 'CHECKING' && search.panel !== 'LOADING' && search.panel !== 'FORBIDDEN'
  const label = t(again === true || (again === undefined && ranBefore) ? 'common.captureSearch.again' : 'common.captureSearch.action')

  const onPress = () => {
    void search.start().then((answer) => {
      if (answer === null) return
      if (answer.ok) {
        if (reveal) document.getElementById(CAMERA_SEARCH_ANCHOR)?.scrollIntoView?.({ block: 'start' })
        return
      }
      // What the panel does not word itself goes to the shared presenter (an outage, a time-out, a 403).
      const refusal = startRefusal(answer)
      if ((refusal === 'OTHER' || refusal === 'ROLE') && answer.failure !== null) presentCoreError(answer.failure)
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1" data-testid={`search-cameras-${place}`} data-block={search.block?.kind}>
      <Button
        size="sm"
        variant={variant}
        isDisabled={search.block !== null || running}
        isPending={running}
        onPress={onPress}
        aria-describedby={reason === null ? undefined : reasonId}
        data-testid={`search-cameras-button-${place}`}
      >
        {running ? <Spinner size="sm" color="current" aria-hidden="true" /> : <Search aria-hidden="true" size={14} />}
        {label}
      </Button>
      {reason === null ? null : (
        <span id={reasonId} className="text-caption text-foreground-2" data-testid={`search-cameras-reason-${place}`}>
          {reason}
        </span>
      )}
    </span>
  )
}

export interface SearchMicrophonesButtonProps {
  /** Where the control stands; part of its test id (`search-mics-<place>`). */
  place: string
}

/**
 * G17, "Search again" for microphones (ux §8g.1): ONE operation 97 per press, which re-reads the
 * microphones connected to the Core. The visible label is "Search again" (one action name on every
 * notification, R-10 AC-4); the accessible name says what is searched. Pending while the request is
 * out — no progress bar, no polling. Disabled with its reason, never hidden.
 */
export function SearchMicrophonesButton({ place }: SearchMicrophonesButtonProps) {
  const { t } = useTranslation()
  const rescan = useMicRescanController()
  const reasonOf = useGateReason()
  const presentCoreError = useCoreErrorPresenter()
  const reasonId = useId()
  const reason = reasonOf(rescan.block)

  const onPress = () => {
    void rescan.run().then((answer) => {
      if (answer === null || answer.ok) return
      const refusal = rescanRefusal(answer)
      if ((refusal === 'OTHER' || refusal === 'ROLE') && answer.failure !== null) presentCoreError(answer.failure)
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1" data-testid={`search-mics-${place}`} data-block={rescan.block?.kind}>
      <Button
        size="sm"
        variant="outline"
        isDisabled={rescan.block !== null || rescan.busy}
        isPending={rescan.busy}
        onPress={onPress}
        aria-label={t('common.captureInputs.againLabel')}
        aria-describedby={reason === null ? undefined : reasonId}
        data-testid={`search-mics-button-${place}`}
      >
        {rescan.busy ? <Spinner size="sm" color="current" aria-hidden="true" /> : <Search aria-hidden="true" size={14} />}
        {t('common.captureSearch.again')}
      </Button>
      {reason === null ? null : (
        <span id={reasonId} className="text-caption text-foreground-2" data-testid={`search-mics-reason-${place}`}>
          {reason}
        </span>
      )}
    </span>
  )
}
