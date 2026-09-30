import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/features/home/home-page'
import { useMotionMode } from '@/features/home/use-motion-mode'

export const Route = createFileRoute('/')({ component: IndexRoute })

function IndexRoute() {
  const motionMode = useMotionMode()
  return <HomePage motionMode={motionMode} />
}
