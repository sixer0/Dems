import { createFileRoute, redirect } from '@tanstack/react-router'
import { selectIsSignedIn } from '@dems/shared/sim'
import { AppLayout } from '@/components/shell/app-layout'

/**
 * Pathless shell layout (masterplan/01_specs.md §14.2): every page below renders inside AppShell.
 * Guard (AC-49): a signed-out visit is sent to `/login?redirect=<the requested href>`.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!selectIsSignedIn(context.sim.store.getState())) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AppLayout,
})
