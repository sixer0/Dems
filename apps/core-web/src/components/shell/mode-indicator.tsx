import { Button, Chip, Tooltip } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode, useLiveLink } from '@dems/shared/live'
import { isLinkUp, modeIndicatorState, type ModeIndicatorState } from './mode-indicator-state'
import { useModeSwitch } from './mode-switch'

const CHIP_COLOR = {
  SIMULATED: 'warning',
  LIVE: 'success',
  OFFLINE: 'danger',
  RECONNECTING: 'danger',
} as const satisfies Record<ModeIndicatorState, 'warning' | 'success' | 'danger'>

/**
 * Mode indicator of the top bar (backend task 04_client_integration_spec §3.2, MD-4; AC-C-24;
 * plan row W54): a kit `Chip` inside a `Tooltip`, between the device block and the bell, at every
 * shell width. A screen that shows simulator data says SIMULATED; a screen that says LIVE shows
 * the Core server's data.
 *
 * Where the build offers the choice (`coreMode.selectable`, dev builds) the chip is also the
 * shell's mode switch: a kit `Button` that opens the confirmation of §3.3 for the other mode.
 * Without the choice (a production build, the packaged build, a router built by a test without
 * `coreMode`) it is a plain tooltip trigger and switches nothing.
 */
export function ModeIndicator() {
  const { t } = useTranslation()
  const mode = useCoreMode()
  const link = useLiveLink()
  const { selectable, request, dialog } = useModeSwitch()
  const state = modeIndicatorState(mode, link)
  const other = mode === CoreMode.LIVE ? CoreMode.SIMULATED : CoreMode.LIVE
  const text =
    state === 'OFFLINE'
      ? t('common.coreMode.chipOffline')
      : state === 'RECONNECTING'
        ? t('common.coreMode.chipReconnecting')
        : t(`common.coreMode.chip.${state}`)
  // The colour follows the link, not only the label (decision D144(2), finding CPW1-6): a state the
  // console itself calls "up" — RESYNCING, an open socket awaiting a newer snapshot — is a recovery,
  // not an outage, and reads `warning`, the tone of the notice's own "the link is up" sentence. A
  // socket that is being opened (CONNECTING) keeps `danger`: during an outage the chip and the sticky
  // notice then say the same thing, with no amber/red alternation.
  const tone = state === 'RECONNECTING' && isLinkUp(link) ? 'warning' : CHIP_COLOR[state]
  // The same element in both forms: its name, its state and its test ID.
  const shared = {
    className: 'dems-mode-indicator',
    'aria-label': `${t('common.coreMode.label')}: ${text}`,
    'data-state': state,
    'data-testid': 'shell-mode',
  }
  const chip = (
    <Chip size="sm" variant="soft" color={tone} className="dems-mode-chip">
      <Chip.Label>{text}</Chip.Label>
    </Chip>
  )
  return (
    <>
      <Tooltip delay={300}>
        {selectable ? (
          <Button variant="ghost" {...shared} onPress={() => request(other)}>
            {chip}
          </Button>
        ) : (
          <Tooltip.Trigger {...shared}>{chip}</Tooltip.Trigger>
        )}
        <Tooltip.Content placement="bottom" offset={8}>
          {selectable ? `${t(`shell.mode.tooltip.${state}`)} ${t(`shell.mode.switchHint.${other}`)}` : t(`shell.mode.tooltip.${state}`)}
        </Tooltip.Content>
      </Tooltip>
      {dialog}
    </>
  )
}
