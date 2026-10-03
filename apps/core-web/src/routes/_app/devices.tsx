import { createFileRoute } from '@tanstack/react-router'
import { DevicesPage } from '@/features/devices'

/** `/devices`: Devices & Inputs (masterplan/01_specs.md §14.2, §14.5.4). */
export const Route = createFileRoute('/_app/devices')({ component: DevicesPage })
