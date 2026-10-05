import { Button, Card, EmptyState } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode } from '@dems/shared/live'
import { useModeSwitch } from './mode-switch'

export interface LiveOnlyStateProps {
  /** The page's icon (the one of its sidebar entry). */
  icon: LucideIcon
  /** One sentence: what Simulated mode does not have (the page's own `states.liveOnly`). */
  body: string
  /** `<prefix>-live-only`; the switch button gets `<testId>-switch`. */
  testId: string
}

/**
 * The "Live mode only" state of a page that has no simulator equivalent (backend task
 * 04_client_integration_spec §10.1, the states table; PG-3; plan row W54): a page-level kit
 * `EmptyState` with the page icon, "This page needs the Core server", the page's sentence and,
 * where the build offers the choice, the button "Switch to Live mode" with the confirmation of
 * §3.3. Reached only by a direct URL in Simulated mode: the sidebar hides the entries there.
 */
export function LiveOnlyState({ icon: Icon, body, testId }: LiveOnlyStateProps) {
  const { t } = useTranslation()
  const { selectable, request, dialog } = useModeSwitch()
  return (
    <Card className="dems-live-only-card rounded-xl">
      <EmptyState className="dems-live-only" data-testid={testId}>
        <Icon className="dems-live-only-icon" aria-hidden="true" strokeWidth={1.5} />
        <p className="dems-live-only-title">{t('shell.liveOnly.title')}</p>
        <p className="dems-live-only-body">{body}</p>
        {selectable ? (
          <Button variant="primary" onPress={() => request(CoreMode.LIVE)} data-testid={`${testId}-switch`}>
            {t('common.coreMode.switchConfirm.LIVE')}
          </Button>
        ) : null}
      </EmptyState>
      {dialog}
    </Card>
  )
}
