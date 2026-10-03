import { useRef, useState } from 'react'
import { Button, Chip, Focusable, Separator, Tooltip } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { LayoutGroup, motion, useAnimate } from 'motion/react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion as tokens } from '@dems/shared/tokens'
import { SOFTWARE_VERSION } from '@dems/shared/sim'
import topoUrl from '@/assets/brand/topo.svg'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { cn } from '@/lib/utils'
import { tween, useAmbientLoop, useMotionPolicy } from '@/motion'
import { DEVELOPER_NAV_ITEMS, MAIN_NAV_ITEMS, type NavItem } from './nav-items'
import { useShellMotion } from './shell-motion-context'
import type { SidebarMode } from './use-shell-layout'

/** M-SH-03: expanding labels slide in 20 ms apart (spec literal, D49). */
const LABEL_STAGGER_MS = 20

export interface SidebarNavProps {
  /** `full` shows labels; `rail` shows icons with tooltips; `drawer` is the full list in the Drawer. */
  mode: Extract<SidebarMode, 'full' | 'rail' | 'drawer'>
  /** Called after a link is chosen (the Drawer closes itself with it). */
  onNavigate?: () => void
  /**
   * Increments each time the sidebar expands from the rail (M-SH-03). A new value remounts the
   * labels so they fade and slide in; `0` renders them at rest.
   */
  expandCount?: number
}

/**
 * Sidebar item list (01_specs §14.4 "Sidebar"; research/04 §2.2; D28/Q12, D49).
 *
 * - Items are TanStack Router `Link`s (active: `aria-current="page"` and `data-status="active"`).
 * - Active treatment (D49): an inset card, fill `surface-tertiary` #251C14, 1 px gold border,
 *   `glow-2`, gold icon and label.
 * - In rail mode the label is visually hidden (the link keeps it as its accessible name) and a
 *   kit `Tooltip` shows it on hover and focus.
 *
 * Motion (03_motion_spec §4 M-SH; step 41):
 * - **M-SH-01** hover: MP **AnimatedBackground** (`enableHover`, `indicator` spring) behind the
 *   items, a one-shot light sweep across the hovered item (CSS, `sheen` 700 ms, `luxe`) and the
 *   icon brightening (`fast`).
 * - **M-SH-02** active indicator: the inset card is `layoutId="nav-active"` and travels to the new
 *   item (spring `indicator`); a pre-rendered e3 glow layer fades in and out during the travel.
 *   Reduced motion: no travel, the card cross-fades in at the destination.
 * - **M-APP-01** hand-off: items inherit `navItem` variants and stagger 30 ms after the sidebar.
 */
export function SidebarNav({ mode, onNavigate, expandCount = 0 }: SidebarNavProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const { choreography } = useShellMotion()
  // The Drawer opens long after the shell arrived, so its items do not take the entrance stagger.
  const itemVariants = mode === 'drawer' ? undefined : choreography.navItem
  return (
    <motion.div className="dems-nav-list" data-nav-mode={mode} layout={m.flags.sharedLayout ? 'position' : false} transition={m.transitions.layout}>
      <ul className="dems-nav-group" role="list">
        <AnimatedBackground enableHover className="dems-nav-hover">
          {MAIN_NAV_ITEMS.map((item, index) => (
            <motion.li key={item.id} data-id={item.id} variants={itemVariants}>
              <NavLink item={item} mode={mode} onNavigate={onNavigate} expandCount={expandCount} index={index} />
            </motion.li>
          ))}
        </AnimatedBackground>
      </ul>
      <Separator className="dems-nav-separator" />
      <p className="dems-nav-group-label" aria-hidden={mode === 'rail'}>
        {t('shell.nav.developerGroup')}
      </p>
      <ul className="dems-nav-group" role="list" aria-label={t('shell.nav.developerGroup')}>
        <AnimatedBackground enableHover className="dems-nav-hover">
          {DEVELOPER_NAV_ITEMS.map((item, index) => (
            <motion.li key={item.id} data-id={item.id} variants={itemVariants}>
              <NavLink
                item={item}
                mode={mode}
                onNavigate={onNavigate}
                devChip
                expandCount={expandCount}
                index={MAIN_NAV_ITEMS.length + index}
              />
            </motion.li>
          ))}
        </AnimatedBackground>
      </ul>
    </motion.div>
  )
}

interface NavLinkProps {
  item: NavItem
  mode: SidebarNavProps['mode']
  onNavigate: (() => void) | undefined
  devChip?: boolean
  expandCount: number
  /** Reading-order position, for the M-SH-03 label stagger. */
  index: number
}

function NavLink({ item, mode, onNavigate, devChip = false, expandCount, index }: NavLinkProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const label = t(item.labelKey)
  const Icon = item.icon
  const labelEnter =
    expandCount > 0 && mode === 'full'
      ? {
          initial: m.reduced ? { opacity: 0 } : { opacity: 0, x: -tokens.distance.exitDrop },
          animate: { opacity: 1, x: 0 },
          transition: m.reduced
            ? m.transitions.crossFade
            : { ...tween('fast', 'standard', m.timeScale), delay: m.seconds(index * LABEL_STAGGER_MS) },
        }
      : {}
  const link = (
    <Link
      to={item.to}
      className="dems-nav-item"
      data-nav-id={item.id}
      data-group={item.group}
      {...(onNavigate ? { onClick: onNavigate } : {})}
    >
      {({ isActive }) => (
        <>
          {isActive ? <NavActiveIndicator /> : null}
          <span className="dems-nav-sheen" aria-hidden="true" />
          <Icon className="dems-nav-icon" aria-hidden="true" strokeWidth={1.75} />
          <motion.span key={`label-${expandCount}`} className="dems-nav-label" {...labelEnter}>
            {label}
          </motion.span>
          {devChip ? (
            <Chip size="sm" variant="soft" color="default" className="dems-nav-chip px-1.5" aria-hidden="true">
              <Chip.Label>{t('shell.nav.devChip')}</Chip.Label>
            </Chip>
          ) : null}
        </>
      )}
    </Link>
  )
  if (mode !== 'rail') return link
  return (
    <Tooltip delay={250} closeDelay={0}>
      <Focusable>{link}</Focusable>
      <Tooltip.Content placement="right" offset={10}>
        {label}
      </Tooltip.Content>
    </Tooltip>
  )
}

/** R5 shared-element ID of the sidebar's active card (scoped by each nav's own LayoutGroup). */
const NAV_ACTIVE_LAYOUT_ID = 'nav-active'

/**
 * M-SH-02: the active card. It is one shared-layout element that Motion moves from the previous
 * item to the new one (the old copy unmounts in the same commit and hands over its measured box).
 * The e3 "glow trail" layer only changes opacity (§2.2, §9.2).
 */
function NavActiveIndicator() {
  const m = useMotionPolicy()
  const [trailRef, animateTrail] = useAnimate<HTMLSpanElement>()
  const flies = m.flags.sharedLayout
  const onTravel = () => {
    if (!trailRef.current) return
    void animateTrail(trailRef.current, { opacity: [0, 1, 0] }, tween('slow', 'standard', m.timeScale))
  }
  return (
    <motion.span
      className="dems-nav-active"
      data-shell-slot="nav-active"
      data-layout-id={flies ? NAV_ACTIVE_LAYOUT_ID : undefined}
      aria-hidden="true"
      layoutId={flies ? NAV_ACTIVE_LAYOUT_ID : undefined}
      transition={flies ? m.transitions.indicator : m.transitions.crossFade}
      initial={flies ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      onLayoutAnimationStart={onTravel}
    >
      <span ref={trailRef} className="dems-nav-active-trail" />
    </motion.span>
  )
}

/**
 * M-SH-07: the topographic texture drifts `translateY 0 ↔ -12 px` while the layer opacity
 * shimmers 0.625 ↔ 1 (REC-35-1: the contours carry alpha ≤ 0.40, so the brightest line spans
 * 0.25 ↔ 0.40), over `topoDrift` 40 s, sine, alternating. CSS keyframes in `shell.css`; this
 * component only decides whether the loop may run: it is part of the one `shell` ambient slot
 * (§9.4) and pauses off-screen, in a hidden tab, or when a page already runs four loops.
 */
function TopoTexture() {
  const ref = useRef<HTMLDivElement>(null)
  const loop = useAmbientLoop('topo-drift', { ref, priority: 'shell', group: 'shell' })
  return (
    <div ref={ref} className="dems-topo" data-shell-slot="topo" aria-hidden="true" {...loop.attrs}>
      <img src={topoUrl} alt="" draggable={false} decoding="async" />
    </div>
  )
}

/** Topographic texture plus the brand footer (04 §2.2); hidden in rail mode. */
export function SidebarFooter() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const lines = t('common.brand.triplet').split(' / ')
  return (
    <motion.div className="dems-sidebar-foot" layout={m.flags.sharedLayout ? 'position' : false} transition={m.transitions.layout}>
      <TopoTexture />
      <footer className="dems-brand-footer">
        <p className="dems-brand-footer-product">{t('shell.footer.product')}</p>
        <p className="dems-brand-footer-version">{t('shell.footer.version', { version: SOFTWARE_VERSION })}</p>
        <p className="dems-brand-footer-triplet">
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <span className="dems-brand-footer-rule" aria-hidden="true" />
      </footer>
    </motion.div>
  )
}

export interface SidebarProps {
  mode: Extract<SidebarMode, 'full' | 'rail'>
  canToggleRail: boolean
  onToggleRail: () => void
}

/**
 * The fixed sidebar at ≥ 1024 px: `<nav aria-label="Primary">` sized by `shell.css` (AC-59).
 *
 * M-SH-03 (sidebar ↔ rail): the width switches in CSS, and Motion `layout` turns the change into a
 * FLIP transform of the panel (never a width transition, §9.2). The item list, the rail toggle and
 * the footer are `layout="position"` children, so Motion counter-scales them instead of squashing
 * their text; on expanding, the labels fade and slide in `x -8 → 0`, 20 ms apart. The panel has its
 * own LayoutGroup, so a page's own layout nodes never re-measure when it moves.
 */
export function Sidebar({ mode, canToggleRail, onToggleRail }: SidebarProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const { choreography } = useShellMotion()
  const [seenMode, setSeenMode] = useState(mode)
  const [expandCount, setExpandCount] = useState(0)
  if (seenMode !== mode) {
    setSeenMode(mode)
    if (mode === 'full') setExpandCount((count) => count + 1)
  }
  const ToggleIcon = mode === 'rail' ? PanelLeftOpen : PanelLeftClose
  const layout = m.flags.sharedLayout
  return (
    <LayoutGroup id="sidebar" inherit={false}>
      <motion.nav
        aria-label={t('shell.nav.label')}
        className="dems-sidebar"
        data-mode={mode}
        layout={layout}
        transition={m.transitions.layout}
        variants={choreography.sidebar}
      >
        <SidebarNav mode={mode} expandCount={expandCount} />
        <motion.div className={cn('dems-rail-toggle', !canToggleRail && 'hidden')} layout={layout ? 'position' : false} transition={m.transitions.layout}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t('shell.topBar.toggleRail')}
            aria-pressed={mode === 'rail'}
            onPress={onToggleRail}
            className="text-muted"
          >
            <ToggleIcon aria-hidden="true" size={18} />
          </Button>
        </motion.div>
        {mode === 'full' ? <SidebarFooter /> : null}
      </motion.nav>
    </LayoutGroup>
  )
}
