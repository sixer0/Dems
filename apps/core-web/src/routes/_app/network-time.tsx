import { createFileRoute } from '@tanstack/react-router'
import { NetworkTimePage } from '@/features/network-time'

/** `/network-time`: Network & Time (masterplan/01_specs.md §14.2, §14.5.6). */
export const Route = createFileRoute('/_app/network-time')({ component: NetworkTimePage })
