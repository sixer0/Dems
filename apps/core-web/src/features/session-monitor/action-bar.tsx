import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  AlertDialog,
  Button,
  buttonVariants,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  Popover,
  TextArea,
  TextField,
  toast,
  ToggleButton,
  Toolbar,
} from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { Camera, FolderOpen, MapPin, NotebookPen, Pause, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatClock } from '@dems/shared/realtime'
import {
  SimTransitionError,
  STOP_REASON_MIN_LENGTH,
  useSim,
  useSimActions,
  useSimInstance,
} from '@dems/shared/sim'
import type { CameraFeedHandle } from '@/components/media'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, usePanelVariants, useStaggerVariants } from './choreography'
import { useFlight } from './flight-context'
import { logSessionMonitorError } from './log'
import type { SessionPhase } from './model'

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
 */
export function ActionBar(props: ActionBarProps) {
  const { t } = useTranslation()
  const variants = usePanelVariants(PANEL_BEAT_MS.P)
  const container = useStaggerVariants(PANEL_BEAT_MS.P - 120, 40, 6)
  const recording = props.phase === 'RECORDING'
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
          <EndSessionAction recording={recording} permitted={props.canStart} />
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

function ActionSlot({ children }: { children: ReactNode }) {
  const m = useMotionPolicy()
  return (
    <motion.div className="sm-action-slot" variants={m.variants.row}>
      {children}
    </motion.div>
  )
}

/** The id of the hidden "Available during a recording session" text that disabled actions reference. */
const UNAVAILABLE_ID = 'sm-actions-unavailable'
/** Review 40 M5/R4: session control is gated on SESSION_START until step 54 enforces it in the simulator. */
const NOT_PERMITTED_ID = 'sm-actions-not-permitted'

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

function failToast(message: string, source: string, error: unknown, context: Record<string, unknown> = {}) {
  logSessionMonitorError(source, error, context)
  toast.danger(message)
}

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
  const actions = useSimActions()
  const sim = useSimInstance()
  const fly = useFlight()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)

  const submit = () => {
    const text = label.trim().slice(0, MARKER_MAX)
    try {
      actions.addMarker(text || undefined)
    } catch (error) {
      failToast(t('session.actions.failed'), 'ActionBar.addMarker', error, { length: text.length })
      setOpen(false)
      return
    }
    const at = sim.store.getState().clock.now
    const count = sim.store.getState().session?.markerCount ?? 0
    const chip = text || `Marker ${count}`
    setOpen(false)
    setLabel('')
    const from = buttonRef.current?.getBoundingClientRect()
    const to = timelineRef.current?.getBoundingClientRect()
    if (from && to) {
      fly({ kind: 'marker', from, to: new DOMRect(to.left, to.bottom - 48, to.width, 40), label: chip })
    }
    toast.success(t('session.actions.addMarker.added', { time: formatClock(at) }))
  }

  return (
    <ActionSlot>
      <Unavailable enabled={enabled}>
        <Popover isOpen={open} onOpenChange={setOpen}>
          <Button ref={buttonRef} variant="outline" className="sm-action" isDisabled={!enabled} data-testid="sm-action-marker" aria-describedby={enabled ? undefined : UNAVAILABLE_ID}>
            <ActionLabel
              icon={<MapPin className="size-5" />}
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
function NoteAction({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()
  const actions = useSimActions()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = text.trim()
  const error = !trimmed ? t('session.actions.sessionNote.empty') : trimmed.length > NOTE_MAX ? t('session.actions.sessionNote.tooLong', { max: NOTE_MAX }) : null

  const save = () => {
    setTouched(true)
    if (error) return
    try {
      actions.addNote(trimmed)
    } catch (caught) {
      failToast(t('session.actions.failed'), 'ActionBar.addNote', caught, { length: trimmed.length })
      return
    }
    setOpen(false)
    setText('')
    setTouched(false)
    toast.success(t('session.actions.sessionNote.saved'))
  }

  return (
    <ActionSlot>
      <Unavailable enabled={enabled}>
        <Button variant="outline" className="sm-action" isDisabled={!enabled} onPress={() => setOpen(true)} data-testid="sm-action-note" aria-describedby={enabled ? undefined : UNAVAILABLE_ID}>
          <ActionLabel
            icon={<NotebookPen className="size-5" />}
            title={t('session.actions.sessionNote.title')}
            subtitle={t('session.actions.sessionNote.subtitle')}
          />
        </Button>
      </Unavailable>
      <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-label={t('session.actions.sessionNote.drawerTitle')} className="sm-note-drawer" data-testid="sm-note-drawer">
            <Drawer.Header>
              <Drawer.Heading>{t('session.actions.sessionNote.drawerTitle')}</Drawer.Heading>
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
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onPress={() => setOpen(false)}>
                    {t('common.actions.cancel')}
                  </Button>
                  <Button type="submit" variant="primary" data-testid="sm-note-submit">
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
  const actions = useSimActions()
  const sim = useSimInstance()
  const fly = useFlight()

  const capture = () => {
    const image = feedRef.current?.snapshot() ?? null
    try {
      actions.snapshot()
    } catch (error) {
      logSessionMonitorError('ActionBar.snapshot', error)
      toast.danger(t('session.actions.snapshot.failed'))
      return
    }
    onSnapshot()
    const state = sim.store.getState()
    const camera = state.cameras.find((c) => c.id === state.activeCameraId)?.name ?? state.activeCameraId
    const from = feedStageRef.current?.getBoundingClientRect()
    const to = document.querySelector('[data-testid="sm-action-queue"]')?.getBoundingClientRect()
    if (from && to) fly({ kind: 'snapshot', from, to, image })
    toast.success(t('session.actions.snapshot.captured'), {
      description: t('session.actions.snapshot.capturedDetail', { camera, time: formatClock(state.clock.now) }),
    })
  }

  return (
    <ActionSlot>
      <Unavailable enabled={enabled}>
        <Button variant="outline" className="sm-action" isDisabled={!enabled} onPress={capture} data-testid="sm-action-snapshot" aria-describedby={enabled ? undefined : UNAVAILABLE_ID}>
          <ActionLabel
            icon={<Camera className="size-5" />}
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
function EndSessionAction({ recording, permitted }: { recording: boolean; permitted: boolean }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const enabled = recording && permitted
  const reason = !recording ? undefined : t('session.actions.endSession.notPermitted')
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
          aria-describedby={hint ? 'sm-end-hint' : enabled ? undefined : recording ? NOT_PERMITTED_ID : UNAVAILABLE_ID}
          data-permitted={permitted ? 'true' : 'false'}
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
      <EndSessionDialog isOpen={dialogOpen} onOpenChange={setDialogOpen} />
    </ActionSlot>
  )
}

function EndSessionDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const actions = useSimActions()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = reason.trim()
  const tooShort = trimmed.length < STOP_REASON_MIN_LENGTH
  const error = tooShort ? t('session.actions.endSession.reasonTooShort', { min: STOP_REASON_MIN_LENGTH }) : null

  const close = () => {
    onOpenChange(false)
    setReason('')
    setTouched(false)
  }

  const confirm = () => {
    setTouched(true)
    if (tooShort) return
    try {
      actions.stopRecording(trimmed)
    } catch (caught) {
      logSessionMonitorError('ActionBar.endSession', caught, {
        reasonLength: trimmed.length,
        transition: caught instanceof SimTransitionError ? caught.event : null,
      })
      toast.danger(t('session.actions.endSession.failed'))
      close()
      return
    }
    close()
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
                isInvalid={touched && tooShort}
                name="reason"
                autoFocus
              >
                <Label>{t('session.actions.endSession.reasonLabel')}</Label>
                <TextArea rows={3} placeholder={t('session.actions.endSession.reasonPlaceholder')} data-testid="sm-end-reason" />
                <FieldError>{touched ? error : null}</FieldError>
              </TextField>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="ghost" onPress={close} data-testid="sm-end-cancel">
                {t('session.actions.endSession.keepRecording')}
              </Button>
              <Button type="submit" variant="danger" data-testid="sm-end-confirm">
                {t('session.actions.endSession.confirm')}
              </Button>
            </AlertDialog.Footer>
          </Form>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
