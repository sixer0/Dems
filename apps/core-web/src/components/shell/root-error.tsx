/**
 * The router's error boundary (the root route's `errorComponent`): a friendly message, a
 * rate-limited retry, and a reload as the last resort. Moved out of `routes/__root.tsx` by FXR-W so
 * it can be tested on its own.
 *
 * FXR-W, finding W92-5 (decision D242; the pattern D182 removed from W84's page): the record of the
 * error goes to the page's own log (`webErrorSink`: in memory, printed to the console in a dev build,
 * never sent anywhere) with a fixed sentence and the error's class, never its message or stack (a
 * Live error's text can quote input). It is written once per error from an effect, not from the
 * render body, which ran on every render and twice under StrictMode.
 */
import { useEffect, useRef } from 'react'
import { Button, Card, Surface } from '@heroui/react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { webErrorSink } from '@/runtime/error-sink'

const ROUTE_ERROR_SENTENCE = 'A route failed to load or render; the console shows its error panel with a retry.'

export function RootError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(reset)
  // One record per error object: the ref outlives StrictMode's second effect run and every re-render.
  const recorded = useRef<unknown>(undefined)
  useEffect(() => {
    if (recorded.current === error) return
    recorded.current = error
    webErrorSink.report({
      level: 'error',
      source: 'routes/__root.RootError',
      message: ROUTE_ERROR_SENTENCE,
      at: Date.now(),
      context: { errorName: error instanceof Error ? error.name : typeof error },
    })
  }, [error])
  return (
    <Surface variant="transparent" className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-xl">
        <Card.Header>
          <Card.Title>{t('common.errors.panelTitle')}</Card.Title>
          <Card.Description>{t('common.errors.generic')}</Card.Description>
        </Card.Header>
        <Card.Footer className="gap-3">
          <Button variant="primary" isDisabled={!canRetry} onPress={retry}>
            {exhausted
              ? t('common.errors.maxRetries')
              : cooldown > 0
                ? t('common.actions.retryIn', { seconds: cooldown })
                : t('common.actions.retry')}
          </Button>
          <Button variant="outline" onPress={() => window.location.reload()}>
            {t('common.actions.refresh')}
          </Button>
        </Card.Footer>
      </Card>
    </Surface>
  )
}

