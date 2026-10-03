import { useState } from 'react'
import { Alert, Button, Description, Drawer, Label, ListBox, Select, Switch, toast } from '@heroui/react'
import { Layers, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Permission,
  RetentionPolicyId,
  selectCan,
  selectStoragePolicy,
  useSim,
  useSimActions,
  type SimState,
  type StoragePolicy,
} from '@dems/shared/sim'
import { logStorageError } from './log'
import { THRESHOLDS } from './model'

const POLICY_IDS = Object.values(RetentionPolicyId)

/** The simulator's rule for `setStoragePolicy` (step 54, F-49-1): SUPERVISOR or TECHNICIAN. */
const selectCanManage = (s: SimState): boolean => selectCan(s, Permission.EVIDENCE_REVIEW) || selectCan(s, Permission.MAINTENANCE)

export interface ManageStorageDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "Manage Storage" (01_specs §14.5.5: `Button` → `Drawer` with a `Select` retention policy, a
 * `Switch` auto-archive and a `Button`; research/04 §5.3 "cleanup (sealed evidence is protected)").
 * The draft is local until "Apply policy", which calls `actions.setStoragePolicy` (audited in the
 * simulator as STORAGE_POLICY_CHANGED). Only a SUPERVISOR or TECHNICIAN may apply it (the simulator
 * enforces it since step 54, F-49-1); others see the button disabled with the required roles. A
 * failure shows a friendly toast and a structured log.
 * The kit Drawer keeps its default transition (M-C-15, D6).
 */
export function ManageStorageDrawer({ isOpen, onOpenChange }: ManageStorageDrawerProps) {
  const { t } = useTranslation()
  const policy = useSim(selectStoragePolicy)
  const actions = useSimActions()
  const canManage = useSim(selectCanManage)
  const [draft, setDraft] = useState<Pick<StoragePolicy, 'retentionPolicy' | 'autoArchive'>>(policy)
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (wasOpen !== isOpen) {
    // Each opening starts from the live policy (derived during render, no effect).
    setWasOpen(isOpen)
    if (isOpen) setDraft({ retentionPolicy: policy.retentionPolicy, autoArchive: policy.autoArchive })
  }
  const changed = draft.retentionPolicy !== policy.retentionPolicy || draft.autoArchive !== policy.autoArchive

  const apply = () => {
    try {
      actions.setStoragePolicy({ retentionPolicy: draft.retentionPolicy, autoArchive: draft.autoArchive })
      toast.success(t('storage.manage.applied'))
      onOpenChange(false)
    } catch (error) {
      logStorageError('ManageStorageDrawer.apply', error, { retentionPolicy: draft.retentionPolicy })
      toast.danger(t('storage.manage.failed'))
    }
  }

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
          <Drawer.Footer className="stor-drawer-footer">
            <Button variant="ghost" onPress={() => onOpenChange(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" isDisabled={!changed || !canManage} onPress={apply} data-testid="storage-policy-apply">
              {changed ? t('storage.manage.apply') : t('storage.manage.unchanged')}
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}
