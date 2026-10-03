import { useEffect, useState } from 'react'
import type { Key } from '@heroui/react'
import { Button, Chip, Description, Label, ListBox, Select, Switch, toast, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarClock, Eraser, FlaskConical, LifeBuoy, ListChecks, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  FaultKind,
  formatWibTime,
  ScenarioName,
  selectClockSecond,
  useSim,
  useSimActions,
  useSimInstance,
  wibDateParts,
  type AuditRow,
  type SimState,
} from '@dems/shared/sim'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
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
import { readDemoControlsOpen, setPresentationModeEverywhere, usePresentationModeSetting, writeDemoControlsOpen } from './sim-adapter'
import { useSimCommand } from './use-sim-command'

const SCENARIOS = Object.values(ScenarioName)
const DEMO_AUDIT_TYPES = new Set(['FAULT_RAISED', 'FAULT_CLEARED', 'AUDIT_CHAIN_DISCONTINUITY', 'SCENARIO_LOADED', 'RECOVERY_STARTED'])
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const selectActiveFaults = (s: SimState) => s.faults.active
const selectAuditRows = (s: SimState) => s.audit.rows
const selectDemoContext = (s: SimState) => ({ scenario: s.meta.scenario, sessionState: s.session?.state ?? null })

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
  const actions = useSimActions()
  const run = useSimCommand()
  const presentation = usePresentationModeSetting()
  const active = useSim(selectActiveFaults)
  const rows = useSim(selectAuditRows)
  const context = useSim(selectDemoContext)
  const nowSecond = useSim(selectClockSecond)
  const asOf = useDemoAsOf()
  const [scenario, setScenario] = useState<ScenarioName>(context.scenario)

  const keys = activeFaultKeys(active)
  const timeSource = timeSourceChoice(active)
  const demoRows = lastDemoRows(rows, 5)
  const now = wibDateParts(nowSecond * 1000)

  /** The newest audit row's type and book event kind, for the toast that confirms the write. */
  const auditNote = () => {
    const row = sim.store.getState().audit.rows.at(-1)
    if (!row) return undefined
    const kind = typeof row.details.eventKind === 'string' ? row.details.eventKind : null
    return t('system.demo.auditWritten', {
      type: t(`common.auditType.${row.type}`),
      kind: kind ? t(`common.enums.auditEventKind.${kind}` as 'common.enums.auditEventKind.AUDIO_CLIP', { defaultValue: kind }) : row.id,
    })
  }

  const setFault = (spec: DemoFaultSpec, on: boolean) => {
    const fault = t(`system.demo.faults.${spec.kind}`)
    const done = run(
      () => {
        if (on) {
          actions.inject(spec.kind, spec.target)
        } else {
          actions.clearFault(spec.kind, spec.target)
          if (spec.kind === FaultKind.MIC_CLIP) actions.resetClip(spec.target?.channel ?? 'AUDIO-02')
        }
        return true
      },
      { source: on ? 'DemoPanel.inject' : 'DemoPanel.clearFault', context: { kind: spec.kind } },
    )
    if (!done) return
    if (on) {
      const notify = spec.critical ? toast.danger : toast.warning
      notify(t('system.demo.injected', { fault }), { description: auditNote() })
    } else {
      toast.success(t('system.demo.cleared', { fault }), { description: auditNote() })
    }
  }

  const setTimeSource = (choice: TimeSourceChoice) => {
    if (choice === timeSource) return
    const done = run(
      () => {
        if (choice === 'GNSS') actions.clearFault(FaultKind.GNSS_LOSS)
        else actions.inject(FaultKind.GNSS_LOSS, { fallback: choice })
        return true
      },
      { source: 'DemoPanel.timeSource', context: { choice } },
    )
    if (!done) return
    const message = t('system.demo.fallback', { source: t(`system.demo.timeSource.${choice}`) })
    if (choice === 'GNSS') toast.success(message, { description: auditNote() })
    else toast.warning(message, { description: auditNote() })
  }

  const loadScenario = (name: ScenarioName, reset = false) => {
    const done = run(
      () => {
        // Step 54 (W52-8): a reset is the simulator's own resetDemo (audited as a reset).
        if (reset) actions.resetDemo()
        else actions.loadScenario(name)
        return true
      },
      { source: reset ? 'DemoPanel.reset' : 'DemoPanel.loadScenario', context: { scenario: name } },
    )
    if (!done) return
    setScenario(name)
    toast.success(reset ? t('system.demo.resetDone') : t('system.demo.scenarioLoaded', { scenario: t(`system.demo.scenarios.${name}`) }))
  }

  const clearAll = () => {
    const done = run(
      () => {
        for (const kind of new Set(active.map((fault) => fault.kind))) actions.clearFault(kind)
        actions.resetClip('AUDIO-01')
        actions.resetClip('AUDIO-02')
        return true
      },
      { source: 'DemoPanel.clearAll', context: { count: active.length } },
    )
    if (done) toast.success(t('system.demo.clearedAll'))
  }

  const recover = () => {
    const done = run(
      () => {
        actions.recover()
        return true
      },
      { source: 'DemoPanel.recover' },
    )
    if (done) toast.info(t('system.demo.recovered'))
  }

  return (
    <div className="sys-demo-body" data-testid="system-demo-body">
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
            <Button size="sm" variant="primary" onPress={() => loadScenario(scenario)} data-testid="system-demo-load">
              <Play className="size-4" aria-hidden="true" />
              {t('system.demo.loadScenario')}
            </Button>
          </div>
          <p className="sys-muted sys-small">{t('system.demo.scenarioCurrent', { scenario: t(`system.demo.scenarios.${context.scenario}`) })}</p>

          <div className="sys-demo-actions">
            <Button size="sm" variant="outline" onPress={() => loadScenario(ScenarioName.IDLE, true)} data-testid="system-demo-reset">
              <RotateCcw className="size-4" aria-hidden="true" />
              {t('system.demo.reset')}
            </Button>
            <Button size="sm" variant="ghost" isDisabled={active.length === 0} onPress={clearAll} data-testid="system-demo-clear-all">
              <Eraser className="size-4" aria-hidden="true" />
              {t('system.demo.clearAll')}
            </Button>
          </div>
          <p className="sys-muted sys-small">{t('system.demo.resetHint')}</p>

          {context.sessionState === 'FAULT' ? (
            <div className="sys-demo-recover" data-testid="system-demo-recover">
              <p className="sys-small">{t('system.demo.recoverHint')}</p>
              <Button size="sm" variant="danger-soft" onPress={recover}>
                <LifeBuoy className="size-4" aria-hidden="true" />
                {t('system.demo.recover')}
              </Button>
            </div>
          ) : null}

          <Switch isSelected={presentation} onChange={(on) => setPresentationModeEverywhere(sim, on)} className="sys-setting" data-testid="system-demo-presentation">
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
              {t('system.demo.simClock', {
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
                      <span className="sys-strong">{t(`common.auditType.${row.type}`)}</span>
                      {kind ? (
                        <span className="sys-demo-kind">{t(`common.enums.auditEventKind.${kind}` as 'common.enums.auditEventKind.AUDIO_CLIP', { defaultValue: kind })}</span>
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
    </div>
  )
}
