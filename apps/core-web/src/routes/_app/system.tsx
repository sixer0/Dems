import { createFileRoute } from '@tanstack/react-router'
import { SystemPage } from '@/features/system'

/** `/system`: System & Maintenance, host of the Demo Control Panel (masterplan/01_specs.md §14.2, §14.5.8). */
export const Route = createFileRoute('/_app/system')({ component: SystemPage })
