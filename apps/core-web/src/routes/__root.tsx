import { Button, Card, Surface, ToastProvider } from '@heroui/react'
import { createRootRoute, Outlet, type ErrorComponentProps } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { useRetryCooldown } from '@dems/shared/realtime'

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

/** Full-viewport shell (masterplan/01_specs.md §4.1). HeroUI v3 needs no provider besides toasts. */
function RootLayout() {
  return (
    <MotionConfig reducedMotion="user">
      <Surface variant="transparent" className="min-h-dvh bg-background text-foreground">
        <Outlet />
        <ToastProvider />
      </Surface>
    </MotionConfig>
  )
}

/** Router-level error boundary: friendly message, rate-limited retry, reload as last resort. */
function RootError({ error, reset }: ErrorComponentProps) {
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(reset)
  if (import.meta.env.DEV) {
    // No client-log endpoint exists in the mock-core scaffold (D3/D4); dev console only.
    console.error('[core-web] route error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
  return (
    <Surface variant="transparent" className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-xl">
        <Card.Header>
          <Card.Title>Something went wrong</Card.Title>
          <Card.Description>
            This screen could not be displayed. Try again, or reload the console.
          </Card.Description>
        </Card.Header>
        <Card.Footer className="gap-3">
          <Button variant="primary" isDisabled={!canRetry} onPress={retry}>
            {exhausted ? 'Retry limit reached' : cooldown > 0 ? `Retry in ${cooldown}s` : 'Try again'}
          </Button>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Reload
          </Button>
        </Card.Footer>
      </Card>
    </Surface>
  )
}

function NotFound() {
  return (
    <Surface variant="transparent" className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-xl">
        <Card.Header>
          <Card.Title>Page not found</Card.Title>
          <Card.Description>This console route does not exist.</Card.Description>
        </Card.Header>
      </Card>
    </Surface>
  )
}
