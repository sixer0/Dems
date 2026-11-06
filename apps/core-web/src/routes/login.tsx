import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { selectIsSignedIn } from '@dems/shared/sim'
import { LoginPage } from '@/features/login'
import { searchRedirect } from './-search'

/** `/login` (masterplan/01_specs.md §14.2, §14.8): outside the shell; a signed-in visit goes to the Dashboard. */
export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: searchRedirect }),
  beforeLoad: ({ context }) => {
    if (selectIsSignedIn(context.sim.store.getState())) {
      throw redirect({ to: '/dashboard', replace: true })
    }
  },
  component: LoginPage,
})
