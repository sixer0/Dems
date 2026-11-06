import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SessionsPage } from '@/features/sessions'
import { searchText } from '../../-search'

/**
 * `/session/history`: Sessions (fix wave J, finding JW-22): every finished session of the Core with its
 * state, INCOMPLETE and quarantined ones included. Every role may open it (operation 38 is AUTHENTICATED).
 */
export const Route = createFileRoute('/_app/session/history')({
  validateSearch: z.object({
    q: searchText(),
    state: z.enum(['SEALED', 'INCOMPLETE']).optional().catch(undefined),
  }),
  component: SessionsPage,
})
