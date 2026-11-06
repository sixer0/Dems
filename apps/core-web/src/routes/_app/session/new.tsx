import { createFileRoute, redirect } from '@tanstack/react-router'
import { noteDeniedPage } from '@/lib/denied-page'
import { z } from 'zod'
import { Permission, selectCan } from '@dems/shared/sim'
import { SessionNewPage } from '@/features/session-new'

/**
 * `/session/new`: Start New Session (masterplan/01_specs.md §14.2, §14.5.11), `?step=1|2|3`
 * (default 1). RBAC: without `SESSION_START` (the TECHNICIAN role) the route sends the operator
 * to the Dashboard, where the shell says which page was refused and which role opens it (fix wave J, JW-14).
 */
export const Route = createFileRoute('/_app/session/new')({
  validateSearch: z.object({
    step: z.union([z.literal(1), z.literal(2), z.literal(3)]).catch(1).default(1),
  }),
  beforeLoad: ({ context }) => {
    if (!selectCan(context.sim.store.getState(), Permission.SESSION_START)) {
      // Fix wave J (JW-14 (d)): the leave is no longer silent - the shell says which page was refused and which role opens it.
      noteDeniedPage('/session/new', Permission.SESSION_START)
      throw redirect({ to: '/dashboard', replace: true })
    }
  },
  component: SessionNewPage,
})
