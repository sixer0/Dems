import { createFileRoute } from '@tanstack/react-router'
import { StackCheckPage } from '@/features/stack-check'

/**
 * `/stack-check`: the row-17 proof screen, moved from `/` by step 38 and kept as a stack diagnostic
 * (01_specs §14.2: reachable by URL only, for every signed-in operator). Fix wave J (JW-20): the page
 * says in its header that it is a developer diagnostic of the console build.
 */
export const Route = createFileRoute('/_app/stack-check')({ component: StackCheckPage })
