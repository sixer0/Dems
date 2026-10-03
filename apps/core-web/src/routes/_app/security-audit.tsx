import { createFileRoute } from '@tanstack/react-router'
import { SecurityAuditPage } from '@/features/security-audit'

/** `/security-audit`: Security & Audit (masterplan/01_specs.md §14.2, §14.5.7). */
export const Route = createFileRoute('/_app/security-audit')({ component: SecurityAuditPage })
