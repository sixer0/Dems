import { useEffect, useRef } from 'react'
import { Button, Chip, ProgressBar, Spinner, toast, Tooltip } from '@heroui/react'
import { ArrowRight, CloudDownload, HardDrive, LifeBuoy, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCoreActions } from '@dems/shared/live'
import { Permission, selectCan, useSim, type AuditRow, type SimState } from '@dems/shared/sim'
import { Stepper, type StepperStep } from '@/components/composed/stepper'
import { usePendingControl } from '@/lib/pending-control'
import { cn } from '@/lib/utils'
import { useSystemLiveMode } from './live'
import { NVME_PARTITIONS, requiredRoleFor, updateView } from './model'
import { SystemPanel } from './panel'
import { useSimCommand } from './use-sim-command'

const selectUpdateSlice = (s: SimState) => s.update
const selectCanMaintain = (s: SimState) => selectCan(s, Permission.MAINTENANCE)

const previousCache = new WeakMap<readonly AuditRow[], string | null>()
/** The version the last update started from (the rollback target shown on the inactive slot). */
const selectPreviousVersion = (s: SimState): string | null => {
  const rows = s.audit.rows
  const cached = previousCache.get(rows)
  if (cached !== undefined) return cached
  let found: string | null = null
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index] as AuditRow
    if (row.type === 'UPDATE_STARTED' && typeof row.details.from === 'string') {
      found = row.details.from
      break
    }
  }
  previousCache.set(rows, found)
  return found
}

/**
 * Software update (01_specs §14.5.8; design book §20.2 secure update, §20.3 A/B partitions): the
 * installed and available versions, the six-step pipeline (Stepper `pipeline`, M-C-09: connector
 * fill, Spinner → check), the A/B slots with the last-known-good rollback target, rollback and
 * recovery notes, and the NVMe partition map. Install is RBAC-gated on MAINTENANCE (S20) and refused
 * by the Core during a session (friendly toast).
 *
 * Plan row W76 (Live mode, B-10): Install goes through the command wrapper with its own pending
 * state (LB-1); the "installing" toast follows the Core's answer; 409 `SESSION_ACTIVE` keeps the
 * friendly warning. In Live mode the words carry no "(simulated)" (§3.2).
 */
export function UpdatePanel({ anchorId }: { anchorId: string }) {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const live = useSystemLiveMode()
  const control = usePendingControl()
  const { pending: installPending, ref: installRef } = control
  const run = useSimCommand()
  const update = useSim(selectUpdateSlice)
  const canMaintain = useSim(selectCanMaintain)
  const previous = useSim(selectPreviousVersion)
  const view = updateView(update)

  // One completion toast per RUNNING → PASS edge.
  const lastState = useRef(update.state)
  useEffect(() => {
    if (lastState.current === 'RUNNING' && update.state === 'PASS') {
      toast.success(t('system.update.completedToast', { version: update.currentVersion, slot: update.activeSlot }))
    }
    lastState.current = update.state
  }, [update.state, update.currentVersion, update.activeSlot, t])

  const steps: StepperStep[] = update.steps.map((step) => ({
    id: step.id,
    label: t(`common.enums.updateStep.${step.id}`),
    status: step.status,
  }))

  const install = () => {
    const version = update.availableVersion
    run(
      () => actions.startSoftwareUpdate(),
      { source: 'UpdatePanel.install', transitionMessage: t('system.update.blockedBySession'), context: { version } },
      () => {
        if (version) toast.info(live ? t('system.live.startedToast', { version }) : t('system.update.startedToast', { version }), { description: t('system.update.startedBody') })
      },
      control,
    )
  }

  const role = requiredRoleFor(Permission.MAINTENANCE)
  const denied = t('common.rbac.requiresRole', { role: role ? t(`common.roles.${role}`) : '' })
  const installButton = (
    <Button
      ref={installRef}
      variant="primary"
      size="sm"
      isDisabled={!canMaintain || !view.canInstall}
      isPending={installPending}
      onPress={install}
      data-testid="system-update-install"
    >
      {installPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <CloudDownload className="size-4" aria-hidden="true" />}
      {update.state === 'RUNNING' ? t('system.update.installing') : live ? t('system.live.install') : t('system.update.install')}
    </Button>
  )

  const stateChip =
    update.state === 'RUNNING'
      ? { color: 'accent' as const, label: t('common.updateState.RUNNING') }
      : update.availableVersion
        ? { color: 'warning' as const, label: t('system.update.available') }
        : { color: 'success' as const, label: t('system.update.upToDate') }

  const inactive = update.activeSlot === 'A' ? 'B' : 'A'
  const slots = (['A', 'B'] as const).map((slot) => {
    const active = slot === update.activeSlot
    const target = !active && update.state === 'RUNNING'
    return {
      slot,
      active,
      target,
      version: active ? update.currentVersion : target ? update.availableVersion : previous,
      tag: active ? t('system.update.slotActive') : target ? t('system.update.slotTarget') : t('system.update.slotInactive'),
    }
  })

  return (
    <SystemPanel
      id="update"
      anchorId={anchorId}
      icon={CloudDownload}
      title={t('system.update.title')}
      action={
        <Chip size="sm" variant="soft" color={stateChip.color} className="sys-status-chip" data-testid="system-update-state">
          <Chip.Label>{stateChip.label}</Chip.Label>
        </Chip>
      }
      bodyClassName="sys-update-body"
    >
      <div className="sys-update-top">
        <div className="sys-version">
          <span className="sys-label">{t('system.update.installed')}</span>
          <span className="sys-version-value" data-testid="system-update-current">v{update.currentVersion}</span>
        </div>
        {update.availableVersion ? (
          <>
            <ArrowRight className="sys-version-arrow" aria-hidden="true" />
            <div className="sys-version">
              <span className="sys-label">{t('system.update.available')}</span>
              <span className="sys-version-value sys-version-value--new">v{update.availableVersion}</span>
            </div>
          </>
        ) : null}
        <div className="sys-update-cta">
          {canMaintain ? (
            installButton
          ) : (
            <Tooltip delay={200}>
              <Tooltip.Trigger className="rounded-lg" aria-label={`${live ? t('system.live.install') : t('system.update.install')}: ${denied}`} data-testid="system-update-locked">
                {installButton}
              </Tooltip.Trigger>
              <Tooltip.Content placement="top">{denied}</Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </div>

      <p className="sys-update-note">
        {update.state === 'RUNNING'
          ? t('system.update.progress', { done: view.done, total: view.total })
          : update.availableVersion
            ? t('system.update.availableBody', { version: update.availableVersion })
            : update.state === 'PASS'
              ? t('system.update.completedBody', { version: update.currentVersion, slot: update.activeSlot })
              : t('system.update.upToDateBody', { version: update.currentVersion, slot: update.activeSlot })}
      </p>

      <Stepper steps={steps} orientation="horizontal" variant="pipeline" ariaLabel={t('system.update.pipelineLabel')} className="sys-update-stepper" />
      <ProgressBar
        aria-label={t('system.update.progress', { done: view.done, total: view.total })}
        value={view.total === 0 ? 0 : (view.done / view.total) * 100}
        size="sm"
        className={cn('sys-update-progress', update.state !== 'RUNNING' && 'sys-update-progress--idle')}
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <div className="sys-update-grid">
        <div className="sys-slots" role="group" aria-label={t('system.update.slotsLabel')}>
          {slots.map((slot) => (
            <div
              key={slot.slot}
              className="sys-slot"
              data-active={slot.active ? 'true' : 'false'}
              data-target={slot.target ? 'true' : 'false'}
              data-testid={`system-slot-${slot.slot}`}
            >
              <HardDrive className="sys-slot-icon" aria-hidden="true" strokeWidth={1.6} />
              <div className="sys-slot-text">
                <span className="sys-slot-name">{t('system.update.slot', { slot: slot.slot })}</span>
                <span className="sys-mono sys-small">{slot.version ? `v${slot.version}` : t('system.update.slotEmpty')}</span>
              </div>
              <span className="sys-slot-tag">{slot.tag}</span>
              {!slot.active && !slot.target && slot.version ? <span className="sys-slot-lkg">{t('system.update.lastKnownGood')}</span> : null}
            </div>
          ))}
        </div>
        <ul className="sys-update-notes">
          <li>
            <RotateCcw aria-hidden="true" className="sys-note-icon" />
            <span>
              <b>{t('system.update.rollbackTitle')}</b> {t('system.update.rollbackBody')}
            </span>
          </li>
          <li>
            <LifeBuoy aria-hidden="true" className="sys-note-icon" />
            <span>
              <b>{t('system.update.recoveryTitle')}</b> {t('system.update.recoveryBody')}
            </span>
          </li>
        </ul>
      </div>

      <div className="sys-partitions" aria-label={t('system.update.partitionsTitle')} role="group">
        <span className="sys-label">{t('system.update.partitionsTitle')}</span>
        <div className="sys-partition-bar">
          {NVME_PARTITIONS.map((partition) => {
            const slot = partition.id === 'SLOT_A' ? 'A' : partition.id === 'SLOT_B' ? 'B' : null
            return (
              <span
                key={partition.id}
                className="sys-partition"
                style={{ flexGrow: partition.weight }}
                data-kind={slot ? (slot === update.activeSlot ? 'active' : slot === inactive && update.state === 'RUNNING' ? 'target' : 'slot') : partition.id.toLowerCase()}
                title={t(`system.update.partitions.${partition.id}`)}
              >
                <span className="sys-partition-label">{t(`system.update.partitions.${partition.id}`)}</span>
              </span>
            )
          })}
        </div>
      </div>
    </SystemPanel>
  )
}
