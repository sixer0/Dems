import { memo, useRef } from 'react'
import { Button, Separator, Tooltip } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { LayoutGroup, motion } from 'motion/react'
import { MonitorSmartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime'
import {
  DEVICE_IDENTITY,
  selectClockSecond,
  SOFTWARE_VERSION,
  useSim,
  type SimState,
} from '@dems/shared/sim'
import { SlidingNumber } from '@/components/ui/sliding-number'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { BrandEmblem } from './brand-emblem'
import { NotificationsBell } from './notifications-bell'
import { SecurePill } from './secure-pill'
import { BRAND_EMBLEM_LAYOUT_ID } from './shared-layout-ids'
import { useShellMotion } from './shell-motion-context'
import { UserMenu } from './user-menu'
import type { SidebarMode } from './use-shell-layout'

export interface TopBarProps {
  mode: SidebarMode
  drawerOpen: boolean
  onToggleDrawer: () => void
}

/**
 * Top bar (01_specs §14.4 "Top bar"; research/04 §2.1, §2.5), left to right: logo lockup, date,
 * clock, Device ID, bell, user, SECURE pill, with vertical separators. Narrow widths drop items
 * per 04 §2.5 (CSS in `shell.css`); below 1024 px a hamburger opens the Drawer.
 *
 * Motion (03_motion_spec §4; step 41):
 * - The bar's background layer and its content drop in with the shell entrance (`topBar`
 *   variants, inherited from the AppShell root), while the emblem slot stays outside them so the
 *   M-APP-01 flight is never faded.
 * - The emblem slot is `layoutId="brand-emblem"` (R5); M-APP-03 draws its strokes.
 * - M-SH-04 clock and M-SH-08 hamburger morph below; M-SH-05 and M-SH-06 live in their components.
 */
export function TopBar({ mode, drawerOpen, onToggleDrawer }: TopBarProps) {
  const { t } = useTranslation()
  const { choreography } = useShellMotion()
  const showHamburger = mode === 'drawer'
  return (
    <header className="dems-topbar" data-testid="top-bar">
      <motion.span className="dems-topbar-bg" variants={choreography.topBar} aria-hidden="true" />
      {showHamburger ? (
        <motion.span className="dems-topbar-start" variants={choreography.topBar}>
          <Button
            isIconOnly
            variant="ghost"
            className="dems-icon-button dems-hamburger"
            aria-label={drawerOpen ? t('shell.topBar.closeNavigation') : t('shell.topBar.openNavigation')}
            aria-expanded={drawerOpen}
            aria-controls="dems-nav-drawer"
            onPress={onToggleDrawer}
          >
            <HamburgerIcon open={drawerOpen} />
          </Button>
        </motion.span>
      ) : null}
      <BrandLockup />
      <div className="dems-topbar-spacer" />
      <motion.div className="dems-topbar-cluster" variants={choreography.topBar}>
        <SimDate />
        <Separator orientation="vertical" className="dems-topbar-sep dems-hide-below-lg" />
        <SimClock />
        <Separator orientation="vertical" className="dems-topbar-sep dems-hide-below-md" />
        <DeviceBlock />
        <Separator orientation="vertical" className="dems-topbar-sep dems-hide-below-md" />
        <NotificationsBell />
        <Separator orientation="vertical" className="dems-topbar-sep dems-hide-below-sm" />
        <UserMenu />
        <Separator orientation="vertical" className="dems-topbar-sep dems-hide-below-sm" />
        <SecurePill />
      </motion.div>
    </header>
  )
}

/**
 * Emblem + wordmark + tagline; a link to the Dashboard and the M-APP-01 landing slot.
 * Memoised: the emblem is a shared-layout node, and re-rendering it with the shell would make the
 * layout group re-measure on every shell render.
 */
const BrandLockup = memo(function BrandLockup() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const { choreography } = useShellMotion()
  return (
    <Link to="/dashboard" className="dems-lockup" aria-label={t('shell.topBar.homeLink')}>
      <motion.span
        className="dems-lockup-emblem"
        data-shell-slot="brand-emblem"
        // §8: under reduced motion there is no flight; the emblem cross-fades in with the shell.
        layoutId={m.flags.sharedLayout ? BRAND_EMBLEM_LAYOUT_ID : undefined}
        transition={m.transitions.layout}
      >
        <BrandEmblem size={48} draw={choreography.emblemDraw} />
      </motion.span>
      <span className="dems-lockup-text" aria-hidden="true">
        <motion.span className="dems-wordmark" data-shell-slot="wordmark" variants={choreography.wordmark}>
          {t('common.brand.wordmark')}
        </motion.span>
        <motion.span className="dems-tagline" variants={choreography.topBar}>
          {t('common.brand.tagline')}
        </motion.span>
      </span>
    </Link>
  )
})

/**
 * M-SH-08: the hamburger morphs to × (the outer lines rotate ±45° onto the centre line while the
 * middle one fades, `base`). Reduced motion swaps the glyph without rotating.
 */
function HamburgerIcon({ open }: { open: boolean }) {
  const m = useMotionPolicy()
  const transition = m.reduced ? { duration: 0 } : m.transitions.crossFade
  return (
    <span className="dems-burger" data-open={open ? 'true' : 'false'} aria-hidden="true">
      <motion.span className="dems-burger-line" initial={false} animate={open ? { y: 6, rotate: 45 } : { y: 0, rotate: 0 }} transition={transition} />
      <motion.span className="dems-burger-line" initial={false} animate={{ opacity: open ? 0 : 1 }} transition={transition} />
      <motion.span className="dems-burger-line" initial={false} animate={open ? { y: -6, rotate: -45 } : { y: 0, rotate: 0 }} transition={transition} />
    </span>
  )
}

const selectSecond = (s: SimState) => selectClockSecond(s)

/** Sim-clock date, `ddd, D MMM YYYY` in UTC+07:00 (D28/Q2). */
function SimDate() {
  const second = useSim(selectSecond)
  const at = second * 1_000
  return (
    <time className="dems-topbar-date dems-hide-below-lg" dateTime={new Date(at).toISOString()}>
      {formatDate(at, DATE_PATTERNS.weekdayDate)}
    </time>
  )
}

/**
 * Sim-clock time `HH:mm:ss`, mono, gold, tabular (04 §9 #24), with M-SH-04:
 * - only the digits that change slide (MP **SlidingNumber**, one per group);
 * - the colons breathe 1 ↔ 0.55 over `colonBreath` (1 s, sine), never a hard blink (P8). The
 *   breath is a shell ambient loop (shared `shell` slot, §9.4) and pauses off-screen or hidden;
 * - reduced motion (§8 "Number tickers: jump to final"): plain digits and steady colons.
 *
 * The readable value is one `<time>` element (screen readers, tests); the animated face is
 * `aria-hidden`, because SlidingNumber renders ten glyphs per digit.
 */
function SimClock() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const second = useSim(selectSecond)
  const faceRef = useRef<HTMLDivElement>(null)
  const colon = useAmbientLoop('clock-colon', { ref: faceRef, priority: 'shell', group: 'shell' })
  const at = second * 1_000
  const text = formatDate(at, DATE_PATTERNS.time)
  const [hh = '00', mm = '00', ss = '00'] = text.split(':')
  const slide = m.flags.animateNumbers

  return (
    <div className="dems-topbar-clock">
      <time
        className="sr-only"
        dateTime={new Date(at).toISOString()}
        aria-label={t('shell.topBar.clock', { offset: formatUtcOffset() })}
        data-testid="top-bar-clock"
      >
        {text}
      </time>
      <div ref={faceRef} className="dems-clock-face" aria-hidden="true" data-sliding={slide ? 'true' : 'false'} {...colon.attrs}>
        <LayoutGroup id="clock" inherit={false}>
          <ClockGroup slot="clock-hours" digits={hh} slide={slide} />
          <span className="dems-clock-colon" data-shell-slot="clock-colon">:</span>
          <ClockGroup slot="clock-minutes" digits={mm} slide={slide} />
          <span className="dems-clock-colon" data-shell-slot="clock-colon">:</span>
          <ClockGroup slot="clock-seconds" digits={ss} slide={slide} />
        </LayoutGroup>
      </div>
    </div>
  )
}

function ClockGroup({ slot, digits, slide }: { slot: string; digits: string; slide: boolean }) {
  return (
    <div className="dems-clock-group" data-shell-slot={slot}>
      {slide ? <SlidingNumber value={Number(digits)} padStart /> : digits}
    </div>
  )
}

const selectDevice = (s: SimState) => s.device.id
const selectRoom = (s: SimState) => s.device.name

/** Device ID block with the full identity in a `Tooltip` (serial, firmware, build). */
function DeviceBlock() {
  const { t } = useTranslation()
  const deviceId = useSim(selectDevice)
  const room = useSim(selectRoom)
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger className="dems-device-block dems-hide-below-md" aria-label={`${t('shell.topBar.deviceId')} ${deviceId}, ${room}`}>
        <MonitorSmartphone className="dems-device-icon" aria-hidden="true" size={24} strokeWidth={1.5} />
        <span className="dems-device-text">
          <span className="dems-device-caption">{t('shell.topBar.deviceId')}</span>
          <span className="dems-device-id">{deviceId}</span>
          <span className="dems-device-room">{room}</span>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content placement="bottom" offset={8}>
        {t('shell.topBar.deviceTooltip', {
          serial: DEVICE_IDENTITY.serialNumber,
          firmware: `v${SOFTWARE_VERSION}`,
          build: DEVICE_IDENTITY.bspVersion,
        })}
      </Tooltip.Content>
    </Tooltip>
  )
}
