import { useCallback, useState } from 'react'
import { Alert, Button, Description, Drawer, Label, ListBox, Select, Spinner, Switch, toast } from '@heroui/react'
import { Layers, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, settle, useCoreActions, useCoreMode } from '@dems/shared/live'
import {
  Permission,
  RetentionPolicyId,
  selectCan,
  selectStoragePolicy,
  useSim,
  type SimState,
  type StoragePolicy,
} from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { logStorageError } from './log'
import { THRESHOLDS } from './model'

const POLICY_IDS = Object.values(RetentionPolicyId)

/** The simulator's rule for `setStoragePolicy` (step 54, F-49-1): SUPERVISOR or TECHNICIAN. */
const selectCanManage = (s: SimState): boolean => selectCan(s, Permission.EVIDENCE_REVIEW) || selectCan(s, Permission.MAINTENANCE)

/**
 * The success words by data mode. Simulated mode keeps its words, which say "simulated"; in Live
 * mode the Core server applied the change, so the words say nothing of a simulation
 * (04_client_integration_spec §3.2).
 */
const APPLIED_WORDS = {
  [CoreMode.SIMULATED]: 'storage.manage.applied',
  [CoreMode.LIVE]: 'storage.manage.live.applied',
} as const

export interface ManageStorageDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

interface ApplyPolicyControl {
  /** True from the press until the command settled (LB-1: further presses are ignored meanwhile). */
  readonly busy: boolean
  /** True once the command has been out for `LIVE_PENDING_REVEAL_MS`: Apply shows its spinner. */
  readonly showPending: boolean
  readonly apply: (policy: Pick<StoragePolicy, 'retentionPolicy' | 'autoArchive'>) => void
}

/**
 * Settle site B-9 (backend task 04_client_integration_spec §8.3 B-9, §8.1 LB-1 to LB-7, LB-10; plan
 * row W71): `setStoragePolicy` (operation 55) through `useCoreActions()` and `settle`, so it reads
 * the same in both modes.
 *
 * - Success: the toast shows and the drawer closes in `ok`, after the Core server answered (the
 *   Live source settles in the turn of CL-16, so the page already shows the Core's policy).
 * - Refusal: every failure goes to the refusal presenter first (a 403 is the denied toast; an
 *   outage, a time-out and a 429 have the presenter's own words). What it leaves to the page — the
 *   Core's 422, rebuilt as `SimTransitionError` with `POLICY_RANGE`, or a refusal of the simulator —
 *   keeps the existing friendly toast `storage.manage.failed` and one record in the page's own log.
 *   On every refusal the drawer stays open with the draft the operator chose.
 * - Busy: a ref answers a second press at once and the drawer footer carries `aria-busy` (the kit's
 *   `Button` does not pass it on, finding F63-2); after `LIVE_PENDING_REVEAL_MS` Apply shows the
 *   kit's pending state with its `Spinner`. In Simulated mode the command settles before the press
 *   returns, so the look never changes and the outcome is the predecessor's.
 */
function useApplyPolicy(onApplied: () => void): ApplyPolicyControl {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const applied = APPLIED_WORDS[useCoreMode()]
  // LB-1: the shared pending control (`@/lib/pending-control`, plan row W0) ignores the next press at
  // once and reveals the spinner late; a command that settles in the press changes nothing.
  const { busy, pending: showPending, run } = usePendingControl()

  const apply = useCallback(
    (policy: Pick<StoragePolicy, 'retentionPolicy' | 'autoArchive'>) => {
      run((release) => {
        settle(() => actions.setStoragePolicy({ retentionPolicy: policy.retentionPolicy, autoArchive: policy.autoArchive }), {
          ok: () => {
            toast.success(t(applied))
            onApplied()
          },
          fail: (error) => {
            if (presentCoreError(error) !== null) return
            logStorageError('ManageStorageDrawer.apply', error, { retentionPolicy: policy.retentionPolicy })
            toast.danger(t('storage.manage.failed'))
          },
          done: release,
        })
      })
    },
    [actions, applied, onApplied, presentCoreError, run, t],
  )
  return { busy, showPending, apply }
}

/**
 * "Manage Storage" (01_specs §14.5.5: `Button` → `Drawer` with a `Select` retention policy, a
 * `Switch` auto-archive and a `Button`; research/04 §5.3 "cleanup (sealed evidence is protected)").
 * The draft is local until "Apply policy", which changes the policy through settle site B-9
 * (`useApplyPolicy`; audited as STORAGE_POLICY_CHANGED by the simulator or by the Core server). Only
 * a SUPERVISOR or TECHNICIAN may apply it (the simulator enforces it since step 54, F-49-1, and so
 * does the Core server, operation 55); others see the button disabled with the required roles. A
 * failure is worded by the refusal presenter or, for the page's own branch, by a friendly toast and
 * a structured record; the drawer then stays open with the draft.
 * The kit Drawer keeps its default transition (M-C-15, D6).
 */
export function ManageStorageDrawer({ isOpen, onOpenChange }: ManageStorageDrawerProps) {
  const { t } = useTranslation()
  const policy = useSim(selectStoragePolicy)
  const canManage = useSim(selectCanManage)
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const { busy, showPending, apply } = useApplyPolicy(close)
  const [draft, setDraft] = useState<Pick<StoragePolicy, 'retentionPolicy' | 'autoArchive'>>(policy)
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (wasOpen !== isOpen) {
    // Each opening starts from the live policy (derived during render, no effect).
    setWasOpen(isOpen)
    if (isOpen) setDraft({ retentionPolicy: policy.retentionPolicy, autoArchive: policy.autoArchive })
  }
  const changed = draft.retentionPolicy !== policy.retentionPolicy || draft.autoArchive !== policy.autoArchive

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className="stor-drawer w-[400px] max-w-[92vw]" data-testid="storage-manage-drawer">
          <Drawer.Header className="stor-drawer-header">
            <Layers className="stor-drawer-icon" aria-hidden="true" strokeWidth={1.75} />
            <Drawer.Heading className="stor-drawer-heading">{t('storage.manage.title')}</Drawer.Heading>
            <Drawer.CloseTrigger aria-label={t('common.actions.close')} />
          </Drawer.Header>
          <Drawer.Body className="stor-drawer-body">
            <p className="stor-drawer-description">{t('storage.manage.description')}</p>

            <Select
              value={draft.retentionPolicy}
              onChange={(key) => {
                if (typeof key === 'string' && (POLICY_IDS as string[]).includes(key)) {
                  setDraft((current) => ({ ...current, retentionPolicy: key as RetentionPolicyId }))
                }
              }}
              className="stor-drawer-field"
              data-testid="storage-policy-select"
            >
              <Label>{t('storage.manage.retentionPolicy')}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {POLICY_IDS.map((id) => (
                    <ListBox.Item key={id} id={id} textValue={t(`storage.manage.policies.${id}`)}>
                      {t(`storage.manage.policies.${id}`)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Switch
              isSelected={draft.autoArchive}
              onChange={(on) => setDraft((current) => ({ ...current, autoArchive: on }))}
              className="stor-drawer-field"
              data-testid="storage-auto-archive"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Label>{t('storage.manage.autoArchive')}</Label>
              </Switch.Content>
              <Description>{t('storage.manage.autoArchiveHint')}</Description>
            </Switch>

            <Alert status="accent" className="stor-drawer-alert">
              <Alert.Indicator>
                <Lock aria-hidden="true" strokeWidth={1.75} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Description>{t('storage.manage.sealedProtected')}</Alert.Description>
              </Alert.Content>
            </Alert>

            <section className="stor-drawer-thresholds" aria-label={t('storage.manage.thresholdsTitle')}>
              <h3>{t('storage.manage.thresholdsTitle')}</h3>
              <p className="stor-policy-warn">{t('storage.manage.thresholdLow', { percent: THRESHOLDS.low })}</p>
              <p className="stor-policy-danger">{t('storage.manage.thresholdFull', { percent: THRESHOLDS.full })}</p>
            </section>
          </Drawer.Body>
          {canManage ? null : (
            <p className="stor-drawer-description" data-testid="storage-policy-rbac">
              {t('common.rbac.requiresRole', { role: `${t('common.roles.SUPERVISOR')} / ${t('common.roles.TECHNICIAN')}` })}
            </p>
          )}
          {/* LB-1: the kit's Button does not pass `aria-busy` on (F63-2), so the footer that holds Apply carries it while a Live command is out. */}
          <Drawer.Footer className="stor-drawer-footer" aria-busy={busy || undefined} data-testid="storage-policy-footer">
            <Button variant="ghost" onPress={() => onOpenChange(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="primary"
              isDisabled={!changed || !canManage}
              isPending={showPending}
              data-pending={showPending ? 'true' : undefined}
              onPress={() => apply(draft)}
              data-testid="storage-policy-apply"
            >
              {showPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
              {changed ? t('storage.manage.apply') : t('storage.manage.unchanged')}
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}
