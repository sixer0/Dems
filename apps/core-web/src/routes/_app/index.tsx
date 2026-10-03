import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/` → `/dashboard` (masterplan/01_specs.md §14.2); the `_app` guard runs first. */
export const Route = createFileRoute('/_app/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard', replace: true })
  },
})
