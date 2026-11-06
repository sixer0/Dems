import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '@/features/dashboard'

/** `/dashboard` (masterplan/01_specs.md §14.2, §14.5.1). */
export const Route = createFileRoute('/_app/dashboard')({ component: DashboardPage })
