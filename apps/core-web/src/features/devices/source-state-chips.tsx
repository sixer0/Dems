import { Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { SourceLineState, SourceReach } from './source-state'

const REACH_COLOR: Record<SourceReach, 'success' | 'danger' | 'default'> = {
  ONLINE: 'success',
  REACHABLE: 'success',
  OFFLINE: 'danger',
  NOT_REACHABLE: 'danger',
  NOT_CHECKED: 'default',
}

/**
 * The state chips of a source line (fix wave I, G70b-06; the rule is `sourceLineState`). The words:
 * "Online" / "Offline" for a simulated Core (as before), "Reachable" / "Not reachable" / "Not
 * checked" for a Core in real capture; the stream chip only when the rule states one.
 */
export function SourceStateChips({ state }: { state: SourceLineState }) {
  const { t } = useTranslation()
  const reach =
    state.reach === 'ONLINE'
      ? t('devices.selector.online')
      : state.reach === 'OFFLINE'
        ? t('devices.selector.offline')
        : state.reach === 'REACHABLE'
          ? t('common.developmentRoster.reachable')
          : state.reach === 'NOT_REACHABLE'
            ? t('common.developmentRoster.notReachable')
            : t('web.source.notChecked')
  return (
    <span className="dev-sel-chips" data-testid="source-state-chips" data-reach={state.reach} data-stream={state.stream ?? undefined}>
      <Chip size="sm" variant="soft" color={REACH_COLOR[state.reach]} data-chip="reach">
        <Chip.Label>{reach}</Chip.Label>
      </Chip>
      {state.stream !== null ? (
        <Chip size="sm" variant="soft" color={state.stream === 'LIVE' ? 'success' : 'danger'} data-chip="stream">
          <Chip.Label>{t(`devices.selector.stream.${state.stream}`)}</Chip.Label>
        </Chip>
      ) : null}
    </span>
  )
}
