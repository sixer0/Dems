import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { EvidenceDetailPage } from '@/features/evidence'

/** `/evidence/$evidenceId`: Evidence detail (masterplan/01_specs.md §14.2, §14.5.3). */
export const Route = createFileRoute('/_app/evidence/$evidenceId')({
  validateSearch: z.object({
    tab: z.enum(['media', 'metadata', 'integrity']).optional().catch(undefined),
  }),
  component: EvidenceDetailPage,
})
