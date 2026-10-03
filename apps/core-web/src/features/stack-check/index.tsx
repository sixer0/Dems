/**
 * `/stack-check` (masterplan/01_specs.md §14.2): the row-17 proof screen (HeroUI, Magic UI
 * BorderBeam, Motion Primitives SlidingNumber, a Motion enter and the live mock-core heartbeat),
 * moved from `/` into the shell by step 38 and kept as a stack diagnostic. `?motion=slow` still
 * slows its enter transition (01_specs §4.5).
 */
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shell/page-header'
import { HomePage } from '@/features/home/home-page'
import { useMotionMode } from '@/features/home/use-motion-mode'

export function StackCheckPage() {
  const { t } = useTranslation()
  const motionMode = useMotionMode()
  return (
    <div className="dems-page" data-testid="page-stack-check">
      <PageHeader icon={Activity} title={t('shell.nav.stackCheck')} />
      <HomePage motionMode={motionMode} />
    </div>
  )
}
