import { createFileRoute } from '@tanstack/react-router'
import { StoragePage } from '@/features/storage'

/** `/storage`: Storage (masterplan/01_specs.md §14.2, §14.5.5). */
export const Route = createFileRoute('/_app/storage')({ component: StoragePage })
