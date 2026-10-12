import { auditTypeWords, enumValueWords } from '@/lib/event-words'
import { useEffect, useState } from 'react'
import type { Key } from '@heroui/react'
import { AlertDialog, Button, Chip, Description, Label, ListBox, Select, Spinner, Switch, toast, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarClock, Eraser, FlaskConical, LifeBuoy, ListChecks, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCoreActions } from '@dems/shared/live'
import {
  FaultKind,
  formatWibTime,
  ScenarioName,
  selectClockSecond,
  selectOperator,
  useSim,
  useSimInstance,
  wibDateParts,
  type AuditRow,
  type AuditType,
  type SimState,
} from '@dems/shared/sim'
import { usePendingControl } from '@/lib/pending-control'
import { captureFailedStartOf, captureFailedStartText } from '@/lib/capture-notices'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { newestOwnRow, useSystemLiveMode } from './live'
import { logSystemError } from './log'
import {
  activeFaultKeys,
  DEMO_FAULTS,
  formatAsOf,
  isSpecActive,
  TIME_SOURCE_CHOICES,
  timeSourceChoice,
  type DemoFaultSpec,
  type TimeSourceChoice,
} from './model'
import { SystemPanel } from './panel'
import { readDemoControlsOpen, setPresentationModeEverywhere, usePreferenceWriteFailure, usePresentationModeSetting, writeDemoControlsOpen } from './sim-adapter'
import { useSimCommand } from './use-sim-command'

const SCENARIOS = Object.values(ScenarioName)
const DEMO_AUDIT_TYPES = new Set(['FAULT_RAISED', 'FAULT_CLEARED', 'AUDIT_CHAIN_DISCONTINUITY', 'SCENARIO_LOADED', 'RECOVERY_STARTED'])
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const selectActiveFaults = (s: SimState) => s.faults.active
const selectAuditRows = (s: SimState) => s.audit.rows
// `failedStart` (integration pass D7 follow-up, D158 item 3): FAULT of a session that recorded nothing
// (`captureDurable: false`) — a primitive; the control then says what is true, not "run recovery".
const selectDemoContext = (s: SimState) => ({
  scenario: s.meta.scenario,
  sessionState: s.session?.state ?? null,
  failedStart: captureFailedStartOf(s.session, s.alerts),
})
const selectOperatorId = (s: SimState) => selectOperator(s)?.id ?? null

/** The audit types a fault command writes (the simulator's fault rows; AUDIT_TAMPER raises a discontinuity row). */
const FAULT_ROW_TYPES: readonly AuditType[] = ['FAULT_RAISED', 'FAULT_CLEARED', 'AUDIT_CHAIN_DISCONTINUITY']

/** What a Live reset or scenario load waits for: the operator's confirmation (W43 §9: "the panel should ask first"). */
type PendingRebuild = { readonly name: ScenarioName; readonly reset: boolean }

function lastDemoRows(rows: readonly AuditRow[], count: number): AuditRow[] {
  const found: AuditRow[] = []
  for (let index = rows.length - 1; index >= 0 && found.length < count; index -= 1) {
    const row = rows[index] as AuditRow
    if (DEMO_AUDIT_TYPES.has(row.type)) found.push(row)
  }
  return found
}

/** D64: the `--as-of` date of the DEMO media and evidence packages, loaded only when the panel opens. */
function useDemoAsOf(): string | null {
  const [asOf, setAsOf] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    import('@dems/shared/demo-data')
      .then((module) => {
        if (alive) setAsOf(module.DEMO_EVIDENCE_INDEX.asOf)
      })
      .catch((error: unknown) => logSystemError('DemoPanel.asOf', error, {}, 'warn'))
    return () => {
      alive = false
    }
  }, [])
  return asOf
}

/**
 * Demo Control Panel (01_specs §14.5.8, C17, AC-65): clearly labelled DEMO, behind the "Demo
 * controls" Switch (collapsed on entry, M-PG-SYS). Scenario loader (`loadScenario`), one toggle per
 * sim fault kind (`inject` / `clearFault`; MIC 2 clip also resets its latch), the GNSS → NTP → RTC
 * time-source control, reset (the sim's `resetDemo`), recover, presentation mode, and the D64 as-of dates.
 * Every action writes an audit row in the sim; the newest rows are listed here. RBAC follows the
 * sim: a `SimPermissionError` becomes a "Requires the … role" toast (the sim enforces the role table since step 54; the Demo Control Panel actions stay open to every role).
 *
 * Plan row W76 (Live mode; backend task 04_client_integration_spec §8.3 B-10, §8.4 C-7, D-4):
 * - The panel is rendered only for a session with `DEMO_CONTROL` on a Core server with the demo
 *   flag (the page decides, `useDemoPanelVisible`); a 403 `DEMO_DISABLED` is worded by the presenter.
 * - Every command goes through the page's wrapper on ONE pending control for the panel: while a demo
 *   command is out, the panel's other demo commands send nothing (LB-1), the panel body is marked
 *   `aria-busy`, and only the pressed button shows the late spinner (`control.key`).
 * - D-4: several requests of one press (clear a fault and reset its latch; clear all) are sent one
 *   after the other through nested `settle` calls. A reset and a scenario load settle when the
 *   snapshot of the new epoch is applied (CL-18); in Live mode both are confirmed first, because they
 *   rebuild the Core's data for every console.
 * - C-7: the toast's audit note reads the newest row OF THIS COMMAND (its types, its fault kind,
 *   written after the press, by this operator or by no actor) — in Live mode the newest row of the
 *   ring may be the engine's or another console's. Simulated mode keeps the newest row, as before.
 */
export function DemoPanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const [open, setOpen] = useState(readDemoControlsOpen)

  const toggle = (on: boolean) => {
    setOpen(on)
    writeDemoControlsOpen(on)
  }

  return (
    <SystemPanel
      id="demo"
      icon={FlaskConical}
      title={t('system.demo.title')}
      className="sys-demo"
      action={
        <>
          <Chip size="sm" variant="soft" color="warning" className="sys-demo-badge" data-testid="system-demo-badge">
            <Chip.Label>{t('system.demo.badge')}</Chip.Label>
          </Chip>
          <Switch isSelected={open} onChange={toggle} className="sys-demo-switch" data-testid="system-demo-toggle">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>{t('system.demo.toggle')}</Label>
            </Switch.Content>
          </Switch>
        </>
      }
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="body"
            initial={{ opacity: 0, y: m.reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={m.transitions.crossFade}
          >
            <DemoBody />
          </motion.div>
        ) : (
          <motion.p key="hidden" className="sys-muted sys-small" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={m.transitions.crossFade}>
            {t('system.demo.hidden')}
          </motion.p>
        )}
      </AnimatePresence>
    </SystemPanel>
  )
}

function DemoBody() {
  const { t } = useTranslation()
  const sim = useSimInstance()
  const actions = useCoreActions()
  const live = useSystemLiveMode()
  const run = useSimCommand()
  // ONE pending control for the panel's demo commands (LB-1): `key` names the pressed control.
  const demo = usePendingControl()
  const onPresentationFail = usePreferenceWriteFailure('DemoPanel.presentationMode')
  const presentation = usePresentationModeSetting()
  const active = useSim(selectActiveFaults)
  const rows = useSim(selectAuditRows)
  const context = useSim(selectDemoContext)
  const failedStartText = context.failedStart === null ? null : captureFailedStartText(t, context.failedStart)
  const operatorId = useSim(selectOperatorId)
  const nowSecond = useSim(selectClockSecond)
  const asOf = useDemoAsOf()
  const [scenario, setScenario] = useState<ScenarioName>(context.scenario)
  const [rebuild, setRebuild] = useState<PendingRebuild | null>(null)

  const keys = activeFaultKeys(active)
  const timeSource = timeSourceChoice(active)
  const demoRows = lastDemoRows(rows, 5)
  const now = wibDateParts(nowSecond * 1000)
  /** The pressed control shows the kit's pending state once the reveal time has passed (LB-1). */
  const pendingOn = (key: string) => demo.pending && demo.key === key

  /** The ring's `total` at the press: C-7 looks only at rows written after it. */
  const auditTotal = () => sim.store.getState().audit.total

  /**
   * The audit row of the command just confirmed, as "type · book event kind" for its toast (C-7).
   * Simulated: the newest row, as before. Live: the newest row of the command's types (and fault
   * kind) written after the press by this operator or by no actor; none → no note.
   */
  const auditNote = (afterSeq: number, kind: string) => {
    const ring = sim.store.getState().audit.rows
    const row = live ? newestOwnRow(ring, { types: FAULT_ROW_TYPES, afterSeq, operatorId, kind }) : ring.at(-1)
    if (!row) return undefined
    const eventKind = typeof row.details.eventKind === 'string' ? row.details.eventKind : null
    return t('system.demo.auditWritten', {
      type: auditTypeWords(t, row.type),
      kind: eventKind ? enumValueWords(t, 'auditEventKind', eventKind) : row.id,
    })
  }

  const setFault = (spec: DemoFaultSpec, on: boolean) => {
    const fault = t(`system.demo.faults.${spec.kind}`)
    const before = auditTotal()
    // D-4: clearing MIC 2 clip is two requests, the latch reset only after the clear was answered.
    const steps: (() => unknown)[] = on
      ? [() => actions.inject(spec.kind, spec.target)]
      : [() => actions.clearFault(spec.kind, spec.target), ...(spec.kind === FaultKind.MIC_CLIP ? [() => actions.resetClip(spec.target?.channel ?? 'AUDIO-02')] : [])]
    run(
      steps,
      { source: on ? 'DemoPanel.inject' : 'DemoPanel.clearFault', context: { kind: spec.kind }, key: `fault:${spec.kind}` },
      () => {
        if (on) {
          const notify = spec.critical ? toast.danger : toast.warning
          notify(t('system.demo.injected', { fault }), { description: auditNote(before, spec.kind) })
        } else {
          toast.success(t('system.demo.cleared', { fault }), { description: auditNote(before, spec.kind) })
        }
      },
      demo,
    )
  }

  const setTimeSource = (choice: TimeSourceChoice) => {
    if (choice === timeSource) return
    const before = auditTotal()
    run(
      () => (choice === 'GNSS' ? actions.clearFault(FaultKind.GNSS_LOSS) : actions.inject(FaultKind.GNSS_LOSS, { fallback: choice })),
      { source: 'DemoPanel.timeSource', context: { choice }, key: 'time' },
      () => {
        const message = t('system.demo.fallback', { source: t(`system.demo.timeSource.${choice}`) })
        if (choice === 'GNSS') toast.success(message, { description: auditNote(before, FaultKind.GNSS_LOSS) })
        else toast.warning(message, { description: auditNote(before, FaultKind.GNSS_LOSS) })
      },
      demo,
    )
  }

  /** Sends the reset or the scenario load; in Live mode it settles on the snapshot of the new epoch (CL-18). */
  const sendScenario = (name: ScenarioName, reset: boolean) => {
    run(
      // Step 54 (W52-8): a reset is the Core's own resetDemo (audited as a reset).
      () => (reset ? actions.resetDemo() : actions.loadScenario(name)),
      { source: reset ? 'DemoPanel.reset' : 'DemoPanel.loadScenario', context: { scenario: name }, key: reset ? 'reset' : 'load' },
      () => {
        setScenario(name)
        toast.success(reset ? t('system.demo.resetDone') : t('system.demo.scenarioLoaded', { scenario: t(`system.demo.scenarios.${name}`) }))
      },
      demo,
    )
  }

  const loadScenario = (name: ScenarioName, reset = false) => {
    if (demo.busy) return
    // Live: the rebuild replaces the Core's data for every console; the operator confirms it first.
    if (live) setRebuild({ name, reset })
    else sendScenario(name, reset)
  }

  const confirmRebuild = () => {
    if (!rebuild) return
    setRebuild(null)
    sendScenario(rebuild.name, rebuild.reset)
  }

  const clearAll = () => {
    // D-4: one request after the other, each sent when the one before was answered.
    const steps: (() => unknown)[] = [
      ...[...new Set(active.map((fault) => fault.kind))].map((kind) => () => actions.clearFault(kind)),
      () => actions.resetClip('AUDIO-01'),
      () => actions.resetClip('AUDIO-02'),
    ]
    run(steps, { source: 'DemoPanel.clearAll', context: { count: active.length }, key: 'clear' }, () => toast.success(t('system.demo.clearedAll')), demo)
  }

  const recover = () => {
    run(() => actions.recover(), { source: 'DemoPanel.recover', key: 'recover' }, () => toast.info(t('system.demo.recovered')), demo)
  }

  return (
    <div className="sys-demo-body" data-testid="system-demo-body" aria-busy={demo.busy || undefined}>
      <p className="sys-demo-note">{t('system.demo.note')}</p>
      <div className="sys-demo-grid">
        <section className="sys-demo-col" aria-label={t('system.demo.scenarioTitle')}>
          <h3 className="sys-subtitle">{t('system.demo.scenarioTitle')}</h3>
          <div className="sys-demo-scenario">
            <Select
              value={scenario}
              onChange={(key: Key | null) => {
                if (typeof key === 'string' && (SCENARIOS as string[]).includes(key)) setScenario(key as ScenarioName)
              }}
              className="sys-demo-select"
              data-testid="system-demo-scenario"
            >
              <Label>{t('system.demo.scenario')}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {SCENARIOS.map((name) => (
                    <ListBox.Item key={name} id={name} textValue={t(`system.demo.scenarios.${name}`)}>
                      {t(`system.demo.scenarios.${name}`)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button size="sm" variant="primary" isPending={pendingOn('load')} onPress={() => loadScenario(scenario)} data-testid="system-demo-load">
              {pendingOn('load') ? <Spinner size="sm" color="current" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              {t('system.demo.loadScenario')}
            </Button>
          </div>
          <p className="sys-muted sys-small">{t('system.demo.scenarioCurrent', { scenario: t(`system.demo.scenarios.${context.scenario}`) })}</p>

          <div className="sys-demo-actions">
            <Button size="sm" variant="outline" isPending={pendingOn('reset')} onPress={() => loadScenario(ScenarioName.IDLE, true)} data-testid="system-demo-reset">
              {pendingOn('reset') ? <Spinner size="sm" color="current" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
              {t('system.demo.reset')}
            </Button>
            <Button size="sm" variant="ghost" isDisabled={active.length === 0} isPending={pendingOn('clear')} onPress={clearAll} data-testid="system-demo-clear-all">
              {pendingOn('clear') ? <Spinner size="sm" color="current" aria-hidden="true" /> : <Eraser className="size-4" aria-hidden="true" />}
              {t('system.demo.clearAll')}
            </Button>
          </div>
          <p className="sys-muted sys-small">{t('system.demo.resetHint')}</p>

          {context.sessionState === 'FAULT' ? (
            <div className="sys-demo-recover" data-testid="system-demo-recover" data-failed-start={context.failedStart ?? undefined}>
              <p className="sys-small" data-testid="system-demo-recover-hint">
                {failedStartText === null ? t('system.demo.recoverHint') : `${failedStartText.title}. ${failedStartText.body}`}
              </p>
              <Button size="sm" variant="danger-soft" isPending={pendingOn('recover')} onPress={recover}>
                {pendingOn('recover') ? <Spinner size="sm" color="current" aria-hidden="true" /> : <LifeBuoy className="size-4" aria-hidden="true" />}
                {failedStartText === null ? t('system.demo.recover') : t('common.session.failedStart.close')}
              </Button>
            </div>
          ) : null}

          <Switch
            isSelected={presentation}
            onChange={(on) => setPresentationModeEverywhere(actions, on, live, onPresentationFail)}
            className="sys-setting"
            data-testid="system-demo-presentation"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>{t('system.demo.presentationMode')}</Label>
            </Switch.Content>
            <Description>{t('system.settings.presentationModeHint')}</Description>
          </Switch>

          <div className="sys-demo-asof" data-testid="system-demo-asof">
            <span className="sys-label">
              <CalendarClock className="size-3.5" aria-hidden="true" /> {t('system.demo.asOfTitle')}
            </span>
            <span className="sys-small">{asOf ? t('system.demo.asOf', { asOf: formatAsOf(asOf) }) : t('common.states.loading')}</span>
            <span className="sys-small">
              {t(live ? 'system.live.demo.coreClock' : 'system.demo.simClock', {
                date: `${now.day} ${MONTHS[now.month - 1] ?? ''} ${now.year}`,
                time: formatWibTime(nowSecond * 1000),
              })}
            </span>
            <span className="sys-muted sys-small">{t('system.demo.datesNote')}</span>
          </div>
        </section>

        <section className="sys-demo-col sys-demo-col--wide" aria-label={t('system.demo.faultsTitle')}>
          <div className="sys-demo-faults-head">
            <h3 className="sys-subtitle">{t('system.demo.faultsTitle')}</h3>
            <span className="sys-muted sys-small" data-testid="system-demo-active-count">
              {t('system.demo.activeCount', { count: active.length })}
            </span>
          </div>
          <p className="sys-muted sys-small">{t('system.demo.faultsHint')}</p>
          <div className="sys-demo-faults">
            {DEMO_FAULTS.map((spec) => {
              const on = isSpecActive(keys, spec)
              const label = t(`system.demo.faults.${spec.kind}`)
              return (
                <ToggleButton
                  key={spec.kind}
                  isSelected={on}
                  onChange={(selected) => setFault(spec, selected)}
                  className={cn('sys-fault', spec.critical && 'sys-fault--critical')}
                  data-active={on ? 'true' : 'false'}
                  data-pending={pendingOn(`fault:${spec.kind}`) ? 'true' : undefined}
                  data-testid={`system-demo-fault-${spec.kind}`}
                  aria-label={`${label} (${spec.evt})`}
                >
                  <span className="sys-fault-top">
                    <span className="sys-fault-dot" aria-hidden="true" />
                    <span className="sys-fault-label">{label}</span>
                    <span className="sys-fault-evt">{spec.evt}</span>
                  </span>
                  <span className="sys-fault-hint">{t(`system.demo.faultHints.${spec.kind}`)}</span>
                </ToggleButton>
              )
            })}
          </div>

          <div className="sys-demo-time">
            <span className="sys-label">{t('system.demo.timeSourceTitle')}</span>
            <ToggleButtonGroup
              aria-label={t('system.demo.timeSourceTitle')}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set<Key>([timeSource])}
              onSelectionChange={(selection) => {
                const next = [...selection][0]
                if (typeof next === 'string' && (TIME_SOURCE_CHOICES as readonly string[]).includes(next)) setTimeSource(next as TimeSourceChoice)
              }}
              className="sys-demo-time-group"
              data-testid="system-demo-time-source"
            >
              {TIME_SOURCE_CHOICES.map((choice) => (
                <ToggleButton key={choice} id={choice} className="sys-time-choice" data-choice={choice} data-testid={`system-demo-time-${choice}`}>
                  {t(`system.demo.timeSource.${choice}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>

          <div className="sys-demo-audit" data-testid="system-demo-audit">
            <span className="sys-label">
              <ListChecks className="size-3.5" aria-hidden="true" /> {t('system.demo.auditTitle')}
            </span>
            {demoRows.length === 0 ? (
              <p className="sys-muted sys-small">{t('system.demo.auditEmpty')}</p>
            ) : (
              <ol className="sys-demo-audit-list">
                {demoRows.map((row) => {
                  const kind = typeof row.details.eventKind === 'string' ? row.details.eventKind : null
                  return (
                    <li key={row.id} className="sys-demo-audit-row" data-type={row.type}>
                      <span className="sys-mono sys-muted">{formatWibTime(row.at)}</span>
                      <span className="sys-strong">{auditTypeWords(t, row.type)}</span>
                      {kind ? (
                        <span className="sys-demo-kind">{enumValueWords(t, 'auditEventKind', kind)}</span>
                      ) : null}
                      <span className="sys-mono sys-muted sys-demo-hash" title={row.hash}>
                        {row.id} · {row.hash.slice(0, 10)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </section>
      </div>
      {live ? (
        <RebuildConfirm
          pending={rebuild}
          sessionOpen={context.sessionState !== null}
          onCancel={() => setRebuild(null)}
          onConfirm={confirmRebuild}
        />
      ) : null}
    </div>
  )
}

/**
 * Live mode only: the confirmation of a reset or a scenario load (D-4). The Core rebuilds its data
 * from the seed for every connected console; the discarded audit chain stays traceable as an
 * earlier chain (row count and head hash, operation 60's lineage). Implementation/43 §9: "A reset
 * while a recording runs is not refused. The panel should ask the operator first."
 */
function RebuildConfirm({
  pending,
  sessionOpen,
  onCancel,
  onConfirm,
}: {
  pending: PendingRebuild | null
  sessionOpen: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const title = pending?.reset
    ? t('system.live.demo.confirmResetTitle')
    : t('system.live.demo.confirmScenarioTitle', { scenario: pending ? t(`system.demo.scenarios.${pending.name}`) : '' })
  return (
    <AlertDialog.Backdrop isOpen={pending !== null} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog aria-label={title} data-testid="system-demo-confirm">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="sys-small">{t('system.live.demo.confirmBody')}</p>
            {sessionOpen ? <p className="sys-small sys-strong">{t('system.live.demo.confirmSession')}</p> : null}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="ghost" onPress={onCancel} data-testid="system-demo-confirm-keep">
              {t('system.live.demo.keep')}
            </Button>
            <Button variant="danger" onPress={onConfirm} data-testid="system-demo-confirm-go">
              {pending?.reset ? t('system.live.demo.confirmReset') : t('system.live.demo.confirmLoad')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
