import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { EvidenceStatus } from '@dems/shared/sim'
import { EvidenceListPage } from '@/features/evidence'
import { searchDate, searchPage, searchText } from '../../-search'

/** `/evidence`: Evidence list (masterplan/01_specs.md §14.2, §14.5.3); filters live in the URL. */
export const Route = createFileRoute('/_app/evidence/')({
  validateSearch: z.object({
    q: searchText(),
    status: z.enum(EvidenceStatus).optional().catch(undefined),
    caseType: searchText(64),
    investigator: searchText(64),
    from: searchDate,
    to: searchDate,
    page: searchPage,
  }),
  component: EvidenceListPage,
})
