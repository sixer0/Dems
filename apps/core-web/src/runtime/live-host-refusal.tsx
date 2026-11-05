import { useState } from 'react'
import { Button, Card, Surface } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { LiveHostRefusal } from './live-host'

export interface LiveHostRefusalScreenProps {
  readonly refusal: LiveHostRefusal
  /**
   * Stores SIMULATED for this origin and loads the page again. False: the choice could not be stored.
   * Absent when the page offers no choice (the production lock, audit row 106): no Simulated way out is shown.
   */
  readonly onUseSimulated?: () => boolean
}

/**
 * What a page shows when it was opened in Live mode at an address the Core server does not accept
 * (backend task 04_client_integration_spec §4.1 WT-2a; plan row W50): the cause, the address to
 * open instead, and the way back to Simulated mode. Neither data source exists while it is shown.
 *
 * An arrangement of the kit in the form of the router's own error card (`routes/__root.tsx`);
 * rendered by `main.tsx` in place of the router.
 */
export function LiveHostRefusalScreen({ refusal, onUseSimulated }: LiveHostRefusalScreenProps) {
  const { t } = useTranslation()
  const [notStored, setNotStored] = useState(false)
  return (
    <Surface
      variant="transparent"
      className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground"
      data-testid="live-host-refusal"
      data-cause={refusal.cause}
    >
      <Card className="w-full max-w-lg rounded-xl" role="alert">
        <Card.Header>
          <Card.Title>{t('common.liveHost.title')}</Card.Title>
          <Card.Description data-testid="live-host-refusal-cause">
            {t('common.liveHost.body', { current: refusal.current, expected: refusal.expected })}
          </Card.Description>
        </Card.Header>
        <Card.Content className="gap-2">
          <a
            href={refusal.href}
            className="text-link underline-offset-4 hover:underline"
            data-testid="live-host-refusal-open"
          >
            {t('common.liveHost.open', { address: refusal.href })}
          </a>
          {onUseSimulated ? <p className="text-sm text-muted">{t('common.liveHost.simulatedNote')}</p> : null}
          {notStored ? (
            <p className="text-sm text-danger" data-testid="live-host-refusal-not-stored">
              {t('common.coreMode.switchFailed')}
            </p>
          ) : null}
        </Card.Content>
        {onUseSimulated ? (
          <Card.Footer>
            <Button
              variant="outline"
              data-testid="live-host-refusal-simulated"
              onPress={() => {
                if (!onUseSimulated()) setNotStored(true)
              }}
            >
              {t('common.coreMode.useSimulated')}
            </Button>
          </Card.Footer>
        ) : null}
      </Card>
    </Surface>
  )
}
