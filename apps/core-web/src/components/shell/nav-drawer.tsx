import { Drawer } from '@heroui/react'
import { LayoutGroup } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { BrandEmblem } from './brand-emblem'
import { SidebarFooter, SidebarNav } from './sidebar'

export interface NavDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Navigation Drawer below 1024 px (01_specs §14.3; research/04 §2.5): kit `Drawer` from the
 * start edge with the full item list. Controlled by the shell (hamburger, or "More" in the
 * bottom tab bar); choosing an item closes it. Transition is the kit default (M-SH-08, D6); the
 * hamburger's morph to × lives in the top bar. The list has its own LayoutGroup, so its active card
 * never flies to or from the sidebar's.
 */
export function NavDrawer({ isOpen, onOpenChange }: NavDrawerProps) {
  const { t } = useTranslation()
  const close = () => onOpenChange(false)
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="left">
        <Drawer.Dialog id="dems-nav-drawer" aria-label={t('shell.nav.label')} className="dems-drawer-dialog w-[300px] max-w-[86vw] p-5">
          <Drawer.Header className="dems-drawer-header">
            <BrandEmblem size={36} />
            <Drawer.Heading className="dems-drawer-heading">{t('common.brand.wordmark')}</Drawer.Heading>
            <Drawer.CloseTrigger aria-label={t('shell.topBar.closeNavigation')} />
          </Drawer.Header>
          <Drawer.Body className="dems-drawer-body">
            <LayoutGroup id="drawer" inherit={false}>
              <nav aria-label={t('shell.nav.label')} className="dems-drawer-nav">
                <SidebarNav mode="drawer" onNavigate={close} />
              </nav>
              <SidebarFooter />
            </LayoutGroup>
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}
