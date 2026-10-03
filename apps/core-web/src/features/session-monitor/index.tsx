/**
 * Session Monitor `/session` (step 44; masterplan/01_specs.md §14.5.2; research/04 §3.2;
 * 03_motion_spec M-PG-SM; mockup ui_design/DEMS-SessionMonitor.png).
 *
 * Keeps the step-38 stub contract (implementation/19_app_shell.md §2): the route imports
 * `SessionMonitorPage`, and the root carries `data-testid="page-session-monitor"` (AC-48).
 *
 * Layout (grid 6|3|3, 6×2, 5|4|3): K header + status banner; L live feed | M details | N integrity
 * over O audio; P action bar; Q timeline | R inputs over S storage | T live audit. At ≥ 1280 × 760
 * the page fits the content area without scrolling (lists scroll inside their panels); narrower
 * tiers stack (8 columns at 1024–1279, one column below).
 *
 * States: RECORDING (panels K–T live), NO SESSION (idle invitation with a GlowRing `mini` and the
 * Start New Session CTA; step 46 builds the flow), SETUP, FINALIZING → SEALED (the finalization
 * overlay), SEALED (summary), FAULT → RECOVERY → INCOMPLETE (the recovery overlay).
 *
 * Motion: panels enter on their M-PG-SM beats (K 0 … T 580, R1/R3); the hero is the REC indicator,
 * timer and the feed's breathing frame glow; at most four ambient loops (REC pulse, feed frame
 * glow, the procedural camera push-in only when the video falls back, banner dot) plus the shell;
 * reduced motion follows §8 (static loops, opacity-only enters, no flights, meters kept).
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { toast } from '@heroui/react'
import { createPortal } from 'react-dom'
import { Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, useSimActions } from '@dems/shared/sim'
import { PageHeader, useRouteEnterDelay } from '@/components/shell'
import type { CameraFeedHandle } from '@/components/media'
import { TextShimmer } from '@/components/ui/text-shimmer'
import { useMotionPolicy } from '@/motion'
import { ActionBar } from './action-bar'
import { AudioPanel } from './audio-panel'
import { AuditPanel } from './audit-panel'
import { DetailsPanel } from './details-panel'
import { FinalizationModal, type OverlayMode } from './finalization-modal'
import { FlightLayer } from './flight-layer'
import { InputsPanel } from './inputs-panel'
import { IntegrityPanel } from './integrity-panel'
import { LiveFeedPanel } from './live-feed-panel'
import { logSessionMonitorError } from './log'
import { selectPageModel } from './model'
import { PanelErrorBoundary } from './panel'
import { StatusBanner } from './status-banner'
import { StoragePanel } from './storage-panel'
import { TimelinePanel } from './timeline-panel'
import './session-monitor.css'

/** M-PG-SM t = 0: the title's TextEffect runs first, then TextShimmer sweeps once for 2 s (P8). */
const TITLE_SHIMMER_DELAY_MS = 700
const TITLE_SHIMMER_S = 2

interface Overlay {
  mode: OverlayMode
  sessionId: string
  dismissed: boolean
}

export function SessionMonitorPage() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const actions = useSimActions()
  const page = useSim(selectPageModel)
  const rootRef = useRef<HTMLDivElement>(null)
  const feedRef = useRef<CameraFeedHandle>(null)
  const feedStageRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [shutterKey, setShutterKey] = useState(0)

  // The overlay follows the session it saw finalize or recover on this page, and stays open on
  // SEALED (or INCOMPLETE) until the operator closes it. A reload into SEALED shows no overlay.
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  if (page.sessionId && page.phase === 'FINALIZING' && (overlay?.sessionId !== page.sessionId || overlay.mode !== 'finalization')) {
    setOverlay({ mode: 'finalization', sessionId: page.sessionId, dismissed: false })
  }
  if (page.sessionId && page.phase === 'RECOVERY' && (overlay?.sessionId !== page.sessionId || overlay.mode !== 'recovery')) {
    setOverlay({ mode: 'recovery', sessionId: page.sessionId, dismissed: false })
  }

  // Pause Monitoring is UI-only (D28/Q8) and ends with the recording.
  const pausedNow = paused && page.phase === 'RECORDING'

  const recover = () => {
    try {
      actions.recover()
    } catch (error) {
      logSessionMonitorError('recover', error, { sessionId: page.sessionId })
      toast.danger(t('session.recovery.failed'))
    }
  }

  return (
    <FlightLayer>
      <div
        ref={rootRef}
        className="dems-page sm-page"
        data-testid="page-session-monitor"
        data-phase={page.phase}
        data-session-state={page.state ?? 'IDLE'}
        data-motion={m.policy}
      >
        <div className="sm-header-wrap" data-testid="panel-K" data-panel="K">
          <PageHeader
            icon={Monitor}
            title={t('session.title')}
            subtitle={t('session.subtitle')}
            status={<StatusBanner canStart={page.canStart} onRecover={recover} />}
            className="sm-header"
          />
        </div>
        <TitleShimmer rootRef={rootRef} title={t('session.title')} />

        <div className="sm-grid" data-testid="sm-grid">
          <PanelErrorBoundary panel="L" areaClassName="sm-area-feed">
            <LiveFeedPanel
              phase={page.phase}
              evidenceId={page.evidenceId}
              canStart={page.canStart}
              paused={pausedNow}
              shutterKey={shutterKey}
              feedRef={feedRef}
              stageRef={feedStageRef}
              onRecover={recover}
            />
          </PanelErrorBoundary>
          <PanelErrorBoundary panel="M" areaClassName="sm-area-details">
            <DetailsPanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary panel="N" areaClassName="sm-area-integrity">
            <IntegrityPanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary panel="O" areaClassName="sm-area-audio">
            <AudioPanel paused={pausedNow} />
          </PanelErrorBoundary>
          <PanelErrorBoundary panel="P" areaClassName="sm-area-actions">
            <ActionBar
              phase={page.phase}
              canStart={page.canStart}
              canNote={page.canNote}
              paused={pausedNow}
              onPausedChange={setPaused}
              feedRef={feedRef}
              feedStageRef={feedStageRef}
              timelineRef={timelineRef}
              onSnapshot={() => setShutterKey((key) => key + 1)}
            />
          </PanelErrorBoundary>
          <PanelErrorBoundary panel="Q" areaClassName="sm-area-timeline">
            <TimelinePanel listRef={timelineRef} />
          </PanelErrorBoundary>
          <PanelErrorBoundary panel="R" areaClassName="sm-area-inputs">
            <InputsPanel paused={pausedNow} />
          </PanelErrorBoundary>
          <PanelErrorBoundary panel="S" areaClassName="sm-area-storage">
            <StoragePanel />
          </PanelErrorBoundary>
          <PanelErrorBoundary panel="T" areaClassName="sm-area-audit">
            <AuditPanel />
          </PanelErrorBoundary>
        </div>

        {overlay ? (
          <FinalizationModal
            mode={overlay.mode}
            isOpen={!overlay.dismissed}
            sessionId={overlay.sessionId}
            onClose={() => setOverlay({ ...overlay, dismissed: true })}
          />
        ) : null}
      </div>
    </FlightLayer>
  )
}

/**
 * K: MP TextShimmer sweeps the page title once (M-PG-SM t = 0, "then stops"; P8). PageHeader owns
 * the title (TextEffect words), so the shimmer is an aria-hidden copy portalled into the same
 * `<h1>` and laid exactly over it; its base colour is transparent, so only the gold band shows
 * through the glyphs. Removed after the sweep; absent under reduced motion.
 */
function TitleShimmer({ rootRef, title }: { rootRef: RefObject<HTMLDivElement | null>; title: string }) {
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [phase, setPhase] = useState<'wait' | 'run' | 'done'>('wait')

  useEffect(() => {
    setHost(rootRef.current?.querySelector<HTMLElement>('[data-shell-slot="page-title"]') ?? null)
  }, [rootRef])

  useEffect(() => {
    if (m.reduced || phase === 'done') return undefined
    const delay = phase === 'wait' ? (routeDelay + TITLE_SHIMMER_DELAY_MS) * m.timeScale : (TITLE_SHIMMER_S * 1000 + 200) * m.timeScale
    const id = setTimeout(() => setPhase(phase === 'wait' ? 'run' : 'done'), delay)
    return () => clearTimeout(id)
  }, [phase, m.reduced, m.timeScale, routeDelay])

  if (!host || phase !== 'run' || m.reduced) return null
  return createPortal(
    <span className="sm-title-shimmer" aria-hidden="true" data-testid="sm-title-shimmer">
      <TextShimmer as="span" repeat={0} duration={TITLE_SHIMMER_S} spread={3}>
        {title}
      </TextShimmer>
    </span>,
    host,
  )
}
