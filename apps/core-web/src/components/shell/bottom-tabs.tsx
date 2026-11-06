import { Button } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Ellipsis } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BOTTOM_TABS } from './nav-items'
import { useShellMotion } from './shell-motion-context'

export interface BottomTabsProps {
  moreOpen: boolean
  onMore: () => void
}

/**
 * Bottom tab bar below 768 px (01_specs §14.3; research/04 §2.5): Home, Sessions, Evidence,
 * Devices, and More (opens the navigation Drawer with every page). The real phone UI is the
 * native app (D17, D20); this keeps the console usable on a narrow window. It enters and exits
 * with the shell (the `bottomTabs` variants of the step-41 choreography).
 */
export function BottomTabs({ moreOpen, onMore }: BottomTabsProps) {
  const { t } = useTranslation()
  const { choreography } = useShellMotion()
  return (
    <motion.nav
      aria-label={t('shell.bottomTabs.label')}
      className="dems-bottom-tabs"
      data-testid="bottom-tabs"
      variants={choreography.bottomTabs}
    >
      <ul role="list">
        {BOTTOM_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <li key={tab.id}>
              <Link to={tab.to} className="dems-bottom-tab">
                <Icon aria-hidden="true" size={22} strokeWidth={1.75} />
                <span>{t(tab.labelKey)}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <Button
            variant="ghost"
            className="dems-bottom-tab h-auto w-full rounded-lg px-1 py-1.5"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls="dems-nav-drawer"
            onPress={onMore}
          >
            <Ellipsis aria-hidden="true" size={22} strokeWidth={1.75} />
            <span>{t('shell.bottomTabs.more')}</span>
          </Button>
        </li>
      </ul>
    </motion.nav>
  )
}
