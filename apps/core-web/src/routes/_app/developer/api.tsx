import { createFileRoute } from '@tanstack/react-router'
import { ApiReferencePage } from '@/features/api-reference'

/**
 * `/developer/api`: API Reference (masterplan/01_specs.md §14.2, §14.9). The page chunk is lazy
 * (autoCodeSplitting), so Scalar loads only here (AC-73).
 */
export const Route = createFileRoute('/_app/developer/api')({ component: ApiReferencePage })
