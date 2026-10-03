import { createFileRoute } from '@tanstack/react-router'
import { StackCheckPage } from '@/features/stack-check'

/** `/stack-check`: the row-17 proof screen, moved from `/` by step 38 and kept as a stack diagnostic. */
export const Route = createFileRoute('/_app/stack-check')({ component: StackCheckPage })
