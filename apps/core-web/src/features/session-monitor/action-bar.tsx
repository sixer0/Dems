import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  AlertDialog,
  Button,
  buttonVariants,
  Chip,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  Popover,
  Spinner,
  TextArea,
  TextField,
  toast,
  ToggleButton,
  Toolbar,
} from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { Bookmark, Camera, FolderOpen, MapPin, NotebookPen, Pause, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SessionState } from '@dems/shared/domain'
import { useCoreActions } from '@dems/shared/live'
import { formatClock } from '@dems/shared/realtime'
import {
  selectRole,
  SimErrorCode,
  SimTransitionError,
  STOP_REASON_MIN_LENGTH,
  useSim,
  useSimInstance,
} from '@dems/shared/sim'
import type { CameraFeedHandle } from '@/components/media'
import { CoreErrorNoticeKind, useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, usePanelVariants, useStaggerVariants } from './choreography'
import { useFlight } from './flight-context'
import { logSessionMonitorError } from './log'
import { selectConnectingCameras, type SessionPhase } from './model'

/** Simulator input limits kept stable for steps 54/91 (D61): marker label 80, note 2000. */
export const MARKER_MAX = 80
export const NOTE_MAX = 2000
/** M-C-19: hold End Session for 1.5 s (functional, so not slowed by proof mode). */
export const END_HOLD_MS = 1500
const HINT_MS = 2400

export interface ActionBarProps {
  phase: SessionPhase
  canStart: boolean
  canNote: boolean
  paused: boolean
  onPausedChange: (paused: boolean) => void
  feedRef: RefObject<CameraFeedHandle | null>
  feedStageRef: RefObject<HTMLDivElement | null>
  timelineRef: RefObject<HTMLDivElement | null>
  onSnapshot: () => void
}

/**
 * P: the action bar (01_specs §14.5.2 P; research/04 §3.2 P; M-C-17..M-C-20; D28/Q8; D38).
 * Six buttons with an icon, a title and a subtitle, in a kit Toolbar:
 * 1. **Pause Monitoring** (kit ToggleButton): UI-only; the feed and meters dim, REC keeps pulsing.
 * 2. **Add Marker**: a kit Popover with an optional label; the chip flies into the timeline.
 * 3. **Session Note**: a kit Drawer with a TextArea (1–2000 characters).
 * 4. **Snapshot**: `CameraFeed.snapshot()`, one shutter flash, the thumbnail flies to the queue.
 * 5. **Open Evidence Queue**: `/evidence?status=RECORDED` (04 §9 #33), with the snapshot badge.
 * 6. **End Session** (danger-soft): hold 1.5 s (keyboard: Enter), then an AlertDialog with a
 *    mandatory reason (S21, ≥ 5 characters) → `stopRecording(reason)`.
 * Buttons stagger 40 ms on enter (M-PG-SM t = 320). Session actions throw `SimTransitionError`
 * outside RECORDING; the UI shows a toast and logs a structured record.
 *
 * Both data modes (plan row W65; [CS] §8.3 B-2, §8.4 C-1, C-2; LB-1 to LB-7): the four session
 * commands run through `useCoreActions()` and `settle` (`usePendingControl`), and every error goes to
 * the refusal presenter before the bar's own message. A simulator answers at once, so the bar
 * behaves as before in Simulated mode; a Live result answers when the Core server did:
 * - Marker: the popover closes and a chip appears at the button at the press (LB-4); the flight
 *   to the timeline and the toast run on the settle, where the marker count is read (C-1); on a
 *   refusal the chip leaves and the toast explains.
 * - Note: Save is busy (LB-1); the drawer closes on the settle; on a refusal it stays open with
 *   the text.
 * - Snapshot: the shutter flash plays at the press (LB-4); the thumbnail flight and the toast run
 *   on the settle, where the camera and the time are read (C-2).
 * - End Session: the dialog's confirm is busy and the dialog closes on the settle. A 422 (the Core
 *   counts the reason's characters itself, F59) shows the reason field's error and the dialog stays
 *   open; a 409 because the session already ended (another operator stopped it, Q16) closes it with
 *   an info toast, and the finalization overlay follows the state; an outage or a limit keeps the
 *   dialog open with the reason (LB-6, LB-10).
 */
export function ActionBar(props: ActionBarProps) {
  const { t } = useTranslation()
  const variants = usePanelVariants(PANEL_BEAT_MS.P)
  const container = useStaggerVariants(PANEL_BEAT_MS.P - 120, 40, 6)
  const recording = props.phase === 'RECORDING'
  // Row 139 (D84, D91; C3 §3.1): before the first durable fragment there is nothing to stop and seal.
  const connecting = useSim(selectConnectingCameras)
  return (
    <motion.section
      className="sm-area-actions sm-actions-wrap"
      data-testid="panel-P"
      data-panel="P"
      aria-label={t('session.actions.label')}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {!recording ? (
        <span id={UNAVAILABLE_ID} className="sr-only">
          {t('session.actions.unavailable')}
        </span>
      ) : null}
      {!props.canStart ? (
        <span id={NOT_PERMITTED_ID} className="sr-only">
          {t('session.actions.endSession.notPermitted')}
        </span>
      ) : null}
      {connecting ? (
        <span id={CONNECTING_ID} className="sr-only">
          {t('common.session.stopWhileConnecting')}
        </span>
      ) : null}
      <Toolbar aria-label={t('session.actions.label')} className="sm-actions">
        <motion.div className="contents" variants={container}>
          <PauseAction recording={recording} paused={props.paused} onChange={props.onPausedChange} />
          <MarkerAction enabled={recording && props.canNote} timelineRef={props.timelineRef} />
          <NoteAction enabled={recording && props.canNote} />
          <SnapshotAction
            enabled={recording && props.canNote}
            feedRef={props.feedRef}
            feedStageRef={props.feedStageRef}
            onSnapshot={props.onSnapshot}
          />
          <QueueAction />
          <EndSessionAction recording={recording} permitted={props.canStart} connecting={connecting} />
        </motion.div>
      </Toolbar>
    </motion.section>
  )
}

// ── Shared pieces ────────────────────────────────────────────────────────────────────────
function ActionLabel({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <>
      <span className="sm-action-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sm-action-text">
        <span className="sm-action-title">{title}</span>
        <span className="sm-action-subtitle">{subtitle}</span>
      </span>
    </>
  )
}

function ActionSlot({ children, busy = false, className }: { children: ReactNode; busy?: boolean; className?: string }) {
  const m = useMotionPolicy()
  return (
    // LB-1: the slot is `aria-busy` while the command of its control is out (the kit's Button does
    // not pass `aria-busy` through to the DOM, so the plain wrapper carries it).
    <motion.div className={cn('sm-action-slot', className)} variants={m.variants.row} aria-busy={busy || undefined}>
      {children}
    </motion.div>
  )
}

/** LB-1: once the reveal time is over, the kit's Spinner replaces the action's icon, so nothing moves. */
function PendingIcon({ pending, children }: { pending: boolean; children: ReactNode }) {
  return pending ? <Spinner size="sm" color="current" /> : <>{children}</>
}

/** The id of the hidden "Available during a recording session" text that disabled actions reference. */
const UNAVAILABLE_ID = 'sm-actions-unavailable'
/** Review 40 M5/R4: session control is gated on SESSION_START until step 54 enforces it in the simulator. */
const NOT_PERMITTED_ID = 'sm-actions-not-permitted'
/** Row 139: the id of the hidden text that says why End Session waits for the first durable fragment. */
const CONNECTING_ID = 'sm-actions-connecting'

/**
 * Says why a session action is disabled: a pointer hint (`title`) on the wrapper, and
 * `aria-describedby` on the button pointing at the bar's hidden explanation.
 */
function Unavailable({ enabled, reason, children }: { enabled: boolean; reason?: string; children: ReactNode }) {
  const { t } = useTranslation()
  if (enabled) return <>{children}</>
  return (
    <span className="sm-action-unavailable" title={reason ?? t('session.actions.unavailable')}>
      {children}
    </span>
  )
}

/** The session states in which a stop has already happened (409 of a second stop, Q16). */
const ENDED_STATES: ReadonlySet<string> = new Set([SessionState.STOPPING, SessionState.FINALIZING, SessionState.SEALED])

// ── 1. Pause Monitoring (UI-only) ────────────────────────────────────────────────────────
function PauseAction({ recording, paused, onChange }: { recording: boolean; paused: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const on = paused && recording
  const key = on ? 'resumeMonitoring' : 'pauseMonitoring'
  return (
    <ActionSlot>
      <Unavailable enabled={recording}>
        <ToggleButton
          isSelected={on}
          onChange={onChange}
          isDisabled={!recording}
          className="sm-action sm-action-pause"
          data-testid="sm-action-pause"
          aria-describedby={recording ? undefined : UNAVAILABLE_ID}
          data-paused={on ? 'true' : 'false'}
        >
          <ActionLabel
            icon={
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={on ? 'play' : 'pause'}
                  className="inline-flex"
                  initial={m.reduced ? { opacity: 0 } : { opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={m.reduced ? { opacity: 0 } : { opacity: 0, rotate: 90 }}
                  transition={{ duration: m.seconds(160) }}
                >
                  {on ? <Play className="size-5" /> : <Pause className="size-5" />}
                </motion.span>
              </AnimatePresence>
            }
            title={t(`session.actions.${key}.title`)}
            subtitle={t(`session.actions.${key}.subtitle`)}
          />
        </ToggleButton>
      </Unavailable>
    </ActionSlot>
  )
}

// ── 2. Add Marker ────────────────────────────────────────────────────────────────────────
function MarkerAction({ enabled, timelineRef }: { enabled: boolean; timelineRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const sim = useSimInstance()
  const fly = useFlight()
  const press = usePendingControl()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  /** LB-4: the chip shown at the button while a Live marker is out; `null` otherwise. */
  const [pendingChip, setPendingChip] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const submit = () => {
    const text = label.trim().slice(0, MARKER_MAX)
    const sent = press.settle(() => actions.addMarker(text || undefined), {
      onWait: () => setPendingChip(text || `Marker ${(sim.store.getState().session?.markerCount ?? 0) + 1}`),
      ok: () => {
        // C-1: read in `ok`, where the store already holds the new marker (CL-16).
        const at = sim.store.getState().clock.now
        const count = sim.store.getState().session?.markerCount ?? 0
        const chip = text || `Marker ${count}`
        setLabel('')
        const from = buttonRef.current?.getBoundingClientRect()
        const to = timelineRef.current?.getBoundingClientRect()
        if (from && to) {
          fly({ kind: 'marker', from, to: new DOMRect(to.left, to.bottom - 48, to.width, 40), label: chip })
        }
        toast.success(t('session.actions.addMarker.added', { time: formatClock(at) }))
      },
      fail: (error) => {
        logSessionMonitorError('ActionBar.addMarker', error, { length: text.length })
        if (presentCoreError(error) !== null) return
        toast.danger(t('session.actions.failed'))
      },
      done: () => setPendingChip(null),
    })
    // The popover closes at the press, also when the marker is refused (the label is kept then).
    if (sent) setOpen(false)
  }

  return (
    <ActionSlot busy={press.busy} className="sm-action-slot-anchored">
      <AnimatePresence>
        {pendingChip !== null ? (
          <span key="pending" className="sm-marker-pending" aria-hidden="true">
            <motion.span
              className="sm-marker-pending-chip"
              data-testid="sm-marker-pending"
              initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={m.reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
              transition={m.transitions.feedback}
            >
              <Chip color="accent" variant="soft" size="sm" className="gap-1.5 border border-accent/50">
                <Bookmark className="size-3.5" aria-hidden="true" />
                <Chip.Label className="truncate">{pendingChip}</Chip.Label>
              </Chip>
            </motion.span>
          </span>
        ) : null}
      </AnimatePresence>
      <Unavailable enabled={enabled}>
        <Popover isOpen={open} onOpenChange={setOpen}>
          <Button
            ref={buttonRef}
            variant="outline"
            className="sm-action"
            isDisabled={!enabled}
            isPending={press.pending}
            data-busy={press.busy || undefined}
            data-testid="sm-action-marker"
            aria-describedby={enabled ? undefined : UNAVAILABLE_ID}
          >
            <ActionLabel
              icon={<PendingIcon pending={press.pending}><MapPin className="size-5" /></PendingIcon>}
              title={t('session.actions.addMarker.title')}
              subtitle={t('session.actions.addMarker.subtitle')}
            />
          </Button>
          <Popover.Content placement="top" offset={10} className="w-[320px] max-w-[calc(100vw-24px)]">
            <Popover.Dialog aria-label={t('session.actions.addMarker.title')}>
              <Popover.Heading className="sm-popover-heading">{t('session.actions.addMarker.title')}</Popover.Heading>
              <Form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
              >
                <TextField value={label} onChange={setLabel} maxLength={MARKER_MAX} autoFocus name="marker">
                  <Label>{t('session.actions.addMarker.field')}</Label>
                  <Input placeholder={t('session.actions.addMarker.placeholder')} data-testid="sm-marker-input" />
                  <Description>{t('session.actions.addMarker.optional')}</Description>
                </TextField>
                <Button type="submit" variant="primary" size="sm" data-testid="sm-marker-submit">
                  {t('session.actions.addMarker.submit')}
                </Button>
              </Form>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </Unavailable>
    </ActionSlot>
  )
}

// ── 3. Session Note ──────────────────────────────────────────────────────────────────────
/**
 * Session Note: the drawer's title and the action's subtitle name the signed-in operator's role, as the
 * timeline labels the note it adds by its author's role (E-fix FX-C, E2E-T-5: "Supervisor note",
 * "Investigator note"). A supervisor's drawer said "Investigator note" (row FX-W2). Without a role
 * the words are neutral ("Session note").
 */
function NoteAction({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()
  const role = useSim(selectRole)
  const drawerTitle = role ? t(`session.actions.sessionNote.drawerTitleBy.${role}`) : t('session.actions.sessionNote.drawerTitle')
  const subtitle = role ? t(`session.actions.sessionNote.subtitleBy.${role}`) : t('session.actions.sessionNote.subtitle')
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const press = usePendingControl()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = text.trim()
  const error = !trimmed ? t('session.actions.sessionNote.empty') : trimmed.length > NOTE_MAX ? t('session.actions.sessionNote.tooLong', { max: NOTE_MAX }) : null

  const save = () => {
    setTouched(true)
    if (error) return
    // LB-1: Save is busy until the settle; the drawer closes in `ok` and stays open with the text on a refusal.
    press.settle(() => actions.addNote(trimmed), {
      ok: () => {
        setOpen(false)
        setText('')
        setTouched(false)
        toast.success(t('session.actions.sessionNote.saved'))
      },
      fail: (caught) => {
        logSessionMonitorError('ActionBar.addNote', caught, { length: trimmed.length })
        if (presentCoreError(caught) !== null) return
        toast.danger(t('session.actions.failed'))
      },
    })
  }

  return (
    <ActionSlot>
      <Unavailable enabled={enabled}>
        <Button variant="outline" className="sm-action" isDisabled={!enabled} onPress={() => setOpen(true)} data-testid="sm-action-note" aria-describedby={enabled ? undefined : UNAVAILABLE_ID}>
          <ActionLabel
            icon={<NotebookPen className="size-5" />}
            title={t('session.actions.sessionNote.title')}
            subtitle={subtitle}
          />
        </Button>
      </Unavailable>
      <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-label={drawerTitle} className="sm-note-drawer" data-testid="sm-note-drawer" data-role={role ?? undefined}>
            <Drawer.Header>
              <Drawer.Heading>{drawerTitle}</Drawer.Heading>
              <Drawer.CloseTrigger aria-label={t('common.actions.close')} />
            </Drawer.Header>
            <Drawer.Body>
              <Form
                className="flex h-full flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  save()
                }}
              >
                <TextField
                  value={text}
                  onChange={setText}
                  isInvalid={touched && error !== null}
                  maxLength={NOTE_MAX}
                  name="note"
                  autoFocus
                >
                  <Label>{t('session.actions.sessionNote.field')}</Label>
                  <TextArea rows={8} placeholder={t('session.actions.sessionNote.placeholder')} data-testid="sm-note-input" />
                  <Description>{t('session.actions.sessionNote.counter', { count: trimmed.length, max: NOTE_MAX })}</Description>
                  <FieldError>{touched ? error : null}</FieldError>
                </TextField>
                <div className="flex justify-end gap-2" aria-busy={press.busy || undefined}>
                  <Button variant="ghost" onPress={() => setOpen(false)}>
                    {t('common.actions.cancel')}
                  </Button>
                  <Button type="submit" variant="primary" isPending={press.pending} data-busy={press.busy || undefined} data-testid="sm-note-submit">
                    {press.pending ? <Spinner size="sm" color="current" /> : null}
                    {t('session.actions.sessionNote.submit')}
                  </Button>
                </div>
              </Form>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </ActionSlot>
  )
}

// ── 4. Snapshot ──────────────────────────────────────────────────────────────────────────
function SnapshotAction({
  enabled,
  feedRef,
  feedStageRef,
  onSnapshot,
}: {
  enabled: boolean
  feedRef: RefObject<CameraFeedHandle | null>
  feedStageRef: RefObject<HTMLDivElement | null>
  onSnapshot: () => void
}) {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const sim = useSimInstance()
  const fly = useFlight()
  const press = usePendingControl()

  const capture = () => {
    const image = feedRef.current?.snapshot() ?? null
    let flashed = false
    press.settle(() => actions.snapshot(), {
      // LB-4: with a Live result the shutter flashes at the press; a simulator answers at once and
      // flashes in `ok`, as before (and not at all on a refusal).
      onWait: () => {
        flashed = true
        onSnapshot()
      },
      ok: () => {
        if (!flashed) onSnapshot()
        // C-2: read in `ok`, where the store already holds the snapshot (CL-16).
        const state = sim.store.getState()
        const camera = state.cameras.find((c) => c.id === state.activeCameraId)?.name ?? state.activeCameraId
        const from = feedStageRef.current?.getBoundingClientRect()
        const to = document.querySelector('[data-testid="sm-action-queue"]')?.getBoundingClientRect()
        if (from && to) fly({ kind: 'snapshot', from, to, image })
        toast.success(t('session.actions.snapshot.captured'), {
          description: t('session.actions.snapshot.capturedDetail', { camera, time: formatClock(state.clock.now) }),
        })
      },
      fail: (error) => {
        logSessionMonitorError('ActionBar.snapshot', error)
        if (presentCoreError(error) !== null) return
        toast.danger(t('session.actions.snapshot.failed'))
      },
    })
  }

  return (
    <ActionSlot busy={press.busy}>
      <Unavailable enabled={enabled}>
        <Button
          variant="outline"
          className="sm-action"
          isDisabled={!enabled}
          isPending={press.pending}
          data-busy={press.busy || undefined}
          onPress={capture}
          data-testid="sm-action-snapshot"
          aria-describedby={enabled ? undefined : UNAVAILABLE_ID}
        >
          <ActionLabel
            icon={<PendingIcon pending={press.pending}><Camera className="size-5" /></PendingIcon>}
            title={t('session.actions.snapshot.title')}
            subtitle={t('session.actions.snapshot.subtitle')}
          />
        </Button>
      </Unavailable>
    </ActionSlot>
  )
}

// ── 5. Open Evidence Queue ───────────────────────────────────────────────────────────────
function QueueAction() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const count = useSim((s) => s.session?.snapshotCount ?? 0)
  return (
    <ActionSlot>
      <Link
        to="/evidence"
        search={{ status: 'RECORDED' }}
        className={cn(buttonVariants({ variant: 'outline' }), 'sm-action')}
        data-testid="sm-action-queue"
        aria-label={
          count > 0
            ? `${t('session.actions.evidenceQueue.title')}. ${t('session.actions.evidenceQueue.snapshots', { count })}`
            : undefined
        }
      >
        <ActionLabel
          icon={<FolderOpen className="size-5" />}
          title={t('session.actions.evidenceQueue.title')}
          subtitle={t('session.actions.evidenceQueue.subtitle')}
        />
        <AnimatePresence>
          {count > 0 ? (
            <motion.span
              key={count}
              className="sm-queue-badge"
              data-testid="sm-queue-badge"
              aria-hidden="true"
              initial={m.flags.flashes ? { scale: 0.6, opacity: 0 } : { opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={m.transitions.completion}
            >
              {count}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </Link>
    </ActionSlot>
  )
}

// ── 6. End Session: hold to confirm, then the mandatory reason ───────────────────────────
function EndSessionAction({ recording, permitted, connecting }: { recording: boolean; permitted: boolean; connecting: boolean }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  // Row 139: while the cameras connect the stop is disabled WITH its reason (the Core would answer
  // 409 `CAPTURE_NOT_DURABLE`). The role comes first: an operator who may not stop is told that.
  const waiting = recording && permitted && connecting
  const enabled = recording && permitted && !connecting
  const reason = !recording ? undefined : waiting ? t('common.session.stopWhileConnecting') : t('session.actions.endSession.notPermitted')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const [fillScope, animate] = useAnimate<HTMLSpanElement>()
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const direct = m.reduced

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
      if (hintTimer.current) clearTimeout(hintTimer.current)
    },
    [],
  )

  const resetFill = (spring: boolean) => {
    if (!fillScope.current) return
    void animate(fillScope.current, { scaleX: 0 }, spring ? m.transitions.feedback : { duration: 0 })
  }

  const openDialog = () => {
    setHint(false)
    setDialogOpen(true)
  }

  return (
    <ActionSlot>
      <Unavailable enabled={enabled} reason={reason}>
        <Button
          variant="danger-soft"
          className="sm-action sm-action-end"
          isDisabled={!enabled}
          data-testid="sm-action-end"
          aria-describedby={hint ? 'sm-end-hint' : enabled ? undefined : waiting ? CONNECTING_ID : recording ? NOT_PERMITTED_ID : UNAVAILABLE_ID}
          data-permitted={permitted ? 'true' : 'false'}
          data-connecting={waiting ? 'true' : undefined}
          data-hint={hint ? 'true' : undefined}
          onPressStart={(event) => {
            if (direct || event.pointerType === 'keyboard' || event.pointerType === 'virtual') return
            setHint(false)
            if (fillScope.current) void animate(fillScope.current, { scaleX: 1 }, { duration: END_HOLD_MS / 1000, ease: 'linear' })
            holdTimer.current = setTimeout(() => {
              holdTimer.current = null
              resetFill(false)
              openDialog()
            }, END_HOLD_MS)
          }}
          onPressEnd={() => {
            if (!holdTimer.current) return
            clearTimeout(holdTimer.current)
            holdTimer.current = null
            resetFill(true)
            setHint(true)
            if (hintTimer.current) clearTimeout(hintTimer.current)
            hintTimer.current = setTimeout(() => setHint(false), HINT_MS)
          }}
          onPress={(event) => {
            if (direct || event.pointerType === 'keyboard' || event.pointerType === 'virtual') openDialog()
          }}
        >
          <span ref={fillScope} className="sm-hold-fill" aria-hidden="true" data-testid="sm-hold-fill" />
          <ActionLabel
            icon={<Square className="size-5 fill-current" />}
            title={t('session.actions.endSession.title')}
            subtitle={hint ? t('session.actions.endSession.holdHint') : t('session.actions.endSession.subtitle')}
          />
          {hint ? (
            <span id="sm-end-hint" className="sr-only" role="status">
              {t('session.actions.endSession.holdHint')}
            </span>
          ) : null}
        </Button>
      </Unavailable>
      <EndSessionDialog isOpen={dialogOpen && !waiting} onOpenChange={setDialogOpen} />
    </ActionSlot>
  )
}

function EndSessionDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const sim = useSimInstance()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const press = usePendingControl()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  /** The reason text the Core refused with 422 (F59: the Core counts characters itself); the error shows while it is unchanged. */
  const [refused, setRefused] = useState<string | null>(null)
  const trimmed = reason.trim()
  const tooShort = trimmed.length < STOP_REASON_MIN_LENGTH
  const refusedNow = refused !== null && refused === trimmed
  const error = tooShort || refusedNow ? t('session.actions.endSession.reasonTooShort', { min: STOP_REASON_MIN_LENGTH }) : null

  const close = () => {
    onOpenChange(false)
    setReason('')
    setTouched(false)
    setRefused(null)
  }

  const confirm = () => {
    setTouched(true)
    if (tooShort) return
    const sent = trimmed
    // LB-1: the confirm is busy until the settle; the dialog closes in `ok`.
    press.settle(() => actions.stopRecording(sent), {
      ok: close,
      fail: (caught) => {
        const transition = caught instanceof SimTransitionError ? caught : null
        logSessionMonitorError('ActionBar.endSession', caught, {
          reasonLength: sent.length,
          transition: transition ? transition.event : null,
        })
        const notice = presentCoreError(caught)
        if (notice !== null) {
          // An outage, a time-out or a limit keeps the dialog open with the reason (LB-6, LB-7, LB-10);
          // a refusal of the role, or a session that is over, closes it.
          if (notice.kind === CoreErrorNoticeKind.PERMISSION || notice.kind === CoreErrorNoticeKind.SIGNED_OUT || notice.kind === CoreErrorNoticeKind.STOPPED) close()
          return
        }
        if (transition?.code === SimErrorCode.REASON_TOO_SHORT) {
          // 422 INVALID_REASON: the reason field's error; the dialog stays open with the text.
          setRefused(sent)
          return
        }
        if (transition !== null && selectConnectingCameras(sim.store.getState())) {
          // Row 139: the Core refused the stop (409 `INVALID_STATE`, `details.reason: CAPTURE_NOT_DURABLE`) while
          // the session still says `captureDurable: false` - a stop sent in the instant before the control was
          // disabled. The Live source carries no `details` to a page, so the session itself says which refusal it is.
          toast.info(t('common.session.stopWhileConnecting'))
          close()
          return
        }
        if (transition !== null && transition.from !== null && ENDED_STATES.has(transition.from)) {
          // 409: another operator already stopped the session (Q16); the overlay follows the state.
          toast.info(t('session.actions.endSession.alreadyEnded'))
          close()
          return
        }
        toast.danger(t('session.actions.endSession.failed'))
        close()
      },
    })
  }

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? onOpenChange(true) : close())}>
      <AlertDialog.Container size="md">
        <AlertDialog.Dialog aria-label={t('session.actions.endSession.dialogTitle')} data-testid="sm-end-dialog">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{t('session.actions.endSession.dialogTitle')}</AlertDialog.Heading>
          </AlertDialog.Header>
          <Form
            onSubmit={(event) => {
              event.preventDefault()
              confirm()
            }}
          >
            <AlertDialog.Body className="flex flex-col gap-4">
              <p className="text-body text-foreground-2">{t('session.actions.endSession.dialogBody')}</p>
              <TextField
                value={reason}
                onChange={setReason}
                isRequired
                isInvalid={(touched && tooShort) || refusedNow}
                name="reason"
                autoFocus
              >
                <Label>{t('session.actions.endSession.reasonLabel')}</Label>
                <TextArea rows={3} placeholder={t('session.actions.endSession.reasonPlaceholder')} data-testid="sm-end-reason" />
                <FieldError>{touched || refusedNow ? error : null}</FieldError>
              </TextField>
            </AlertDialog.Body>
            <AlertDialog.Footer aria-busy={press.busy || undefined}>
              <Button variant="ghost" onPress={close} data-testid="sm-end-cancel">
                {t('session.actions.endSession.keepRecording')}
              </Button>
              <Button type="submit" variant="danger" isPending={press.pending} data-busy={press.busy || undefined} data-testid="sm-end-confirm">
                {press.pending ? <Spinner size="sm" color="current" /> : null}
                {t('session.actions.endSession.confirm')}
              </Button>
            </AlertDialog.Footer>
          </Form>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
