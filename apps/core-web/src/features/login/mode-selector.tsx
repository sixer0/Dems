/**
 * The mode selector of the Login page (backend task 04_client_integration_spec §3.2 "Web Login:
 * selector"; MD-4; plan row W55): the kit `ToggleButtonGroup` "Simulated | Live". The selected
 * segment is the mode of this page load; it changes only by the reload that follows a confirmed
 * change (`useModeSwitch` of `@/components/shell`, the one copy since decision D144(1)). Renders
 * nothing unless the build offers the choice.
 */
import { ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { CORE_MODES, parseCoreMode } from '@dems/shared/live'
import type { ModeSwitch } from '@/components/shell/mode-switch'

export interface ModeSelectorProps {
  modeSwitch: ModeSwitch
  /** A sign-in is out, or the page is handing off: the mode is not changed under it. */
  disabled: boolean
}

/** "Data mode: Simulated | Live" (dev builds). Pressing the other segment asks first (§3.3 step 1). */
export function ModeSelector({ modeSwitch, disabled }: ModeSelectorProps) {
  const { t } = useTranslation()
  const { selectable, mode, switching, request } = modeSwitch
  if (!selectable || mode === null) return null

  const onSelect = (keys: Set<Key>) => {
    const [first] = [...keys]
    const next = parseCoreMode(first)
    if (next !== null) request(next)
  }

  return (
    <div className="dems-login-mode" data-testid="login-mode-selector" data-mode={mode}>
      <span id="login-mode-label" className="dems-login-mode-label">
        {t('common.coreMode.label')}
      </span>
      <ToggleButtonGroup
        aria-labelledby="login-mode-label"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set<Key>([mode])}
        onSelectionChange={onSelect}
        isDisabled={disabled || switching}
        size="sm"
      >
        {CORE_MODES.map((option) => (
          <ToggleButton key={option} id={option} data-testid={`login-mode-${option}`}>
            {t(`common.coreMode.name.${option}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  )
}
