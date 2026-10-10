import type { ReactNode } from 'react'
import { Accordion, Avatar, Button, Checkbox, Description, Label, ListBox, Radio, RadioGroup, Select, Switch } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import {
  Bell,
  CircleUserRound,
  Clock,
  Database,
  HardDrive,
  Info,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCoreActions } from '@dems/shared/live'
import { selectOperator, useSim, type SimActions, type SimState } from '@dems/shared/sim'
import { usePendingControl } from '@/lib/pending-control'
import { CAMERA_SEARCH_ANCHOR } from '@/features/devices/camera-search'
import { CAPTURE_SELECTOR_ANCHOR } from '@/features/devices/capture-selector'
import { useOwnCaptureCore } from '@/lib/own-capture'
import { useMotionPolicy } from '@/motion'
import { useSystemLiveMode } from './live'
import { SystemPanel } from './panel'
import { SttSettingsItem } from './stt-config-section'
import { setPresentationModeEverywhere, useConsolePrefs, usePreferenceWriteFailure, usePresentationModeSetting } from './sim-adapter'
import { useSimCommand } from './use-sim-command'

const selectAccount = (s: SimState) => ({ operator: selectOperator(s), method: s.auth.method })
const selectDeviceSettings = (s: SimState) => ({
  activeCameraId: s.activeCameraId,
  cameras: s.cameras,
  retentionDays: s.storagePolicy.retentionDays,
  autoArchive: s.storagePolicy.autoArchive,
  timeSource: s.time.source,
  product: s.device.productName,
  version: s.device.softwareVersion,
  deviceId: s.device.id,
})

function ItemTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="sys-acc-title">
      <Icon className="sys-acc-icon" aria-hidden="true" strokeWidth={1.75} />
      <span>{children}</span>
    </span>
  )
}

function Item({ id, icon, title, children }: { id: string; icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <Accordion.Item id={id} className="sys-acc-item" data-testid={`system-settings-${id}`}>
      <Accordion.Heading>
        <Accordion.Trigger className="sys-acc-trigger">
          <ItemTitle icon={icon}>{title}</ItemTitle>
          <Accordion.Indicator className="sys-acc-indicator" />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="sys-acc-body">{children}</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

function ToggleRow({ label, hint, isSelected, onChange, testId }: { label: string; hint: string; isSelected: boolean; onChange: (on: boolean) => void; testId: string }) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} className="sys-setting" data-testid={testId}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>{label}</Label>
      </Switch.Content>
      <Description>{hint}</Description>
    </Switch>
  )
}

/** Scrolls an in-page panel into view and moves focus to it (Settings → maintenance / identity). */
function jumpTo(id: string, reduced: boolean) {
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

/**
 * Settings (01_specs §14.5.8 "MB 10 rows"; research/04 §5.6; ui_design MB 10): Account; App
 * Preferences with the **Reduce motion** switch (motion `setReducedOverride`, D59) and the
 * **Presentation mode** switch (the sim's settings slice, kept in step with `lib/presentation-mode.ts`,
 * D74 M8); Notifications; Security & Privacy; Device Settings (the live camera is real sim state,
 * `setActiveCamera`); Storage Management; Network & Time; System Maintenance; About DEMS. The time
 * format and notification preferences live in the sim's settings slice (step 54), mirrored to
 * this browser's storage.
 *
 * Plan row W76 (Live mode): the live camera goes through the command wrapper (B-10) with its own
 * pending state; the preferences and presentation mode are the Core server's `settings` slice
 * (operation 68), written fire-and-forget with a refusal worded by the presenter (§8.4 F).
 */
export function SettingsPanel({ maintenanceAnchor, aboutAnchor }: { maintenanceAnchor: string; aboutAnchor: string }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const actions = useCoreActions()
  const live = useSystemLiveMode()
  const run = useSimCommand()
  const camera = usePendingControl()
  const onPresentationFail = usePreferenceWriteFailure('Settings.presentationMode')
  const presentation = usePresentationModeSetting()
  const account = useSim(selectAccount)
  const device = useSim(selectDeviceSettings)
  const hostClock = useOwnCaptureCore()
  // The simulator's settings slice (step 54, W52-2), mirrored to localStorage.
  const [prefs, updatePrefs] = useConsolePrefs()

  return (
    <SystemPanel id="settings" icon={Settings2} title={t('system.settings.title')} bodyClassName="sys-settings-body">
      <Accordion className="sys-accordion" defaultExpandedKeys={['app']} allowsMultipleExpanded>
        <Item id="account" icon={CircleUserRound} title={t('system.settings.account')}>
          <div className="sys-account">
            <Avatar size="sm" className="sys-avatar">
              <Avatar.Fallback>{account.operator?.initials ?? '—'}</Avatar.Fallback>
            </Avatar>
            <div className="sys-account-text">
              <span className="sys-strong">{account.operator?.displayName ?? '—'}</span>
              <span className="sys-muted sys-small">
                {t('system.settings.role')}: {account.operator ? t(`common.roles.${account.operator.role}`) : '—'} · {t('system.settings.method')}:{' '}
                {account.method ? t(`common.authMethod.${account.method}`) : '—'}
              </span>
            </div>
          </div>
        </Item>

        <Item id="app" icon={SlidersHorizontal} title={t('system.settings.appPreferences')}>
          <ToggleRow
            label={t('system.settings.reduceMotion')}
            hint={m.sources.osReduced ? t('system.settings.reduceMotionOs') : t('system.settings.reduceMotionHint')}
            isSelected={m.sources.override}
            onChange={(on) => m.setReducedOverride(on)}
            testId="system-reduce-motion"
          />
          <ToggleRow
            label={t('system.settings.presentationMode')}
            hint={t('system.settings.presentationModeHint')}
            isSelected={presentation}
            onChange={(on) => setPresentationModeEverywhere(actions, on, live, onPresentationFail)}
            testId="system-presentation-mode"
          />
          <RadioGroup
            value={prefs.timeFormat}
            onChange={(value) => updatePrefs({ timeFormat: value === '12' ? '12' : '24' })}
            orientation="horizontal"
            className="sys-setting"
          >
            <Label>{t('system.settings.timeFormat')}</Label>
            <Radio value="24">
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Label>{t('system.settings.timeFormat24')}</Label>
              </Radio.Content>
            </Radio>
            <Radio value="12">
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Label>{t('system.settings.timeFormat12')}</Label>
              </Radio.Content>
            </Radio>
            <Description>{t('system.settings.localNote')}</Description>
          </RadioGroup>
        </Item>

        <Item id="notifications" icon={Bell} title={t('system.settings.notifications')}>
          <Checkbox isSelected={prefs.notifyWarnings} onChange={(on) => updatePrefs({ notifyWarnings: on })} className="sys-setting">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>{t('system.settings.notifyWarnings')}</Label>
            </Checkbox.Content>
          </Checkbox>
          <Checkbox isSelected={prefs.notifySound} onChange={(on) => updatePrefs({ notifySound: on })} className="sys-setting">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>{t('system.settings.notifySound')}</Label>
            </Checkbox.Content>
          </Checkbox>
          <p className="sys-muted sys-small">
            {t('system.settings.notifyCriticalAlways')} {t('system.settings.localNote')}
          </p>
        </Item>

        <Item id="security" icon={ShieldCheck} title={t('system.settings.securityPrivacy')}>
          <div className="sys-setting-line">
            <span className="sys-label">{t('system.settings.autoLock')}</span>
            <span>{t('system.settings.autoLockValue')}</span>
          </div>
          <Link to="/security-audit" className="sys-link">
            {t('system.settings.openSecurity')}
          </Link>
        </Item>

        <Item id="device" icon={HardDrive} title={t('system.settings.deviceSettings')}>
          <Select
            value={device.activeCameraId}
            onChange={(key) => {
              const chosen = device.cameras.find((item) => item.id === key)
              if (chosen) {
                run(
                  () => actions.setActiveCamera(chosen.id as Parameters<SimActions['setActiveCamera']>[0]),
                  { source: 'Settings.activeCamera', context: { cameraId: chosen.id } },
                  undefined,
                  camera,
                )
              }
            }}
            isDisabled={camera.pending}
            className="sys-setting"
            data-testid="system-active-camera"
          >
            <Label>{t('system.settings.activeCamera')}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {device.cameras.map((camera) => (
                  <ListBox.Item key={camera.id} id={camera.id} textValue={camera.name}>
                    {camera.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Link to="/devices" className="sys-link">
            {t('system.settings.openDevices')}
          </Link>
          {/* Task 3 row 67 (WB-07; ux §2.6): the entry to the capture device selector of Devices & Inputs. */}
          <Link to="/devices" hash={CAPTURE_SELECTOR_ANCHOR} className="sys-link" data-testid="system-capture-selector-entry">
            {t('devices.selector.openFromSystem')}
          </Link>
          {/* Pass D2 (WB-07; ux §8c.1; row 137's request): the entry to the camera search of Devices & Inputs. The link starts nothing. */}
          <Link to="/devices" hash={CAMERA_SEARCH_ANCHOR} className="sys-link" data-testid="system-camera-search-entry">
            {t('devices.search.openFromSystem')}
          </Link>
        </Item>

        {/* MOUNT POINT of row 117 (STT settings; ux §8a "next to the capture devices entry"): its one item, built in `stt-config-section.tsx`. */}
        <SttSettingsItem />

        <Item id="storage" icon={Database} title={t('system.settings.storageManagement')}>
          <p>
            {t('system.settings.retention', {
              days: device.retentionDays,
              autoArchive: device.autoArchive ? t('system.settings.on') : t('system.settings.off'),
            })}
          </p>
          <Link to="/storage" className="sys-link">
            {t('system.settings.openStorage')}
          </Link>
        </Item>

        <Item id="network" icon={Clock} title={t('system.settings.networkTime')}>
          {/* Fix wave K (C-2 / G75c-04): "Time source: RTC" is the zeroed slice of a Core whose time is its host system clock. */}
          <p data-testid="system-settings-time-source">{t('system.settings.timeSource', { source: hostClock ? t('web.ownCore.time.value') : t(`common.enums.timeSource.${device.timeSource}`) })}</p>
          <Link to="/network-time" className="sys-link">
            {t('system.settings.openNetwork')}
          </Link>
        </Item>

        <Item id="maintenance" icon={Wrench} title={t('system.settings.systemMaintenance')}>
          <p>{t('system.settings.maintenanceBody')}</p>
          <Button size="sm" variant="ghost" className="sys-link-button" onPress={() => jumpTo(maintenanceAnchor, m.reduced)}>
            {t('system.settings.goToMaintenance')}
          </Button>
        </Item>

        <Item id="about" icon={Info} title={t('system.settings.aboutDems')}>
          <p className="sys-mono">{t('system.settings.aboutBody', { product: device.product, version: device.version, deviceId: device.deviceId })}</p>
          <Button size="sm" variant="ghost" className="sys-link-button" onPress={() => jumpTo(aboutAnchor, m.reduced)}>
            {t('system.settings.goToAbout')}
          </Button>
        </Item>
      </Accordion>
    </SystemPanel>
  )
}
