/**
 * Primary navigation (masterplan/01_specs.md §14.4 "Sidebar"; research/04 §2.2; D28/Q12).
 * Eight product pages, then the DEVELOPER group with API Reference. Login is outside the shell
 * and `/stack-check` is a diagnostic reachable by URL only (§14.2), so neither is listed.
 *
 * Backend task (04_client_integration_spec §10.1 PG-4; plan row W54): the ADMINISTRATION group
 * with the two portal pages stands between the product pages and DEVELOPER. Its items carry
 * `liveOnly` and a `permission`: an item is rendered only in Live mode and only while the Core
 * server's permission list of the signed-in operator holds that permission (`useVisibleNavItems`
 * in `sidebar.tsx`). The nine earlier items carry neither and stay visible to every role.
 */
import {
  Braces,
  Camera,
  Database,
  FileText,
  House,
  Monitor,
  Network,
  Router,
  Settings,
  ShieldCheck,
  TabletSmartphone,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { Permission } from '@dems/shared/sim'

export type NavPath =
  | '/dashboard'
  | '/session'
  | '/evidence'
  | '/devices'
  | '/storage'
  | '/network-time'
  | '/security-audit'
  | '/system'
  | '/admin/users'
  | '/admin/devices'
  | '/admin/commissioning'
  | '/developer/api'

export type NavLabelKey =
  | 'shell.nav.dashboard'
  | 'shell.nav.session'
  | 'shell.nav.evidence'
  | 'shell.nav.devices'
  | 'shell.nav.storage'
  | 'shell.nav.networkTime'
  | 'shell.nav.securityAudit'
  | 'shell.nav.system'
  | 'shell.nav.usersRoles'
  | 'shell.nav.pairedDevices'
  // Task 4 row 112: a sentence of this console's own tree (`i18n-web.ts`), the shared tree being another writer's.
  | 'web.commissioning.nav'
  | 'shell.nav.apiReference'

export interface NavItem {
  id: string
  to: NavPath
  icon: LucideIcon
  labelKey: NavLabelKey
  group: 'main' | 'admin' | 'developer'
  /** Rendered only while the Core server's permission list of the operator holds it (a hint: the server decides every call). */
  permission?: Permission
  /** Rendered only in Live mode. */
  liveOnly?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', to: '/dashboard', icon: House, labelKey: 'shell.nav.dashboard', group: 'main' },
  { id: 'session', to: '/session', icon: Monitor, labelKey: 'shell.nav.session', group: 'main' },
  { id: 'evidence', to: '/evidence', icon: FileText, labelKey: 'shell.nav.evidence', group: 'main' },
  { id: 'devices', to: '/devices', icon: Camera, labelKey: 'shell.nav.devices', group: 'main' },
  { id: 'storage', to: '/storage', icon: Database, labelKey: 'shell.nav.storage', group: 'main' },
  { id: 'network-time', to: '/network-time', icon: Network, labelKey: 'shell.nav.networkTime', group: 'main' },
  { id: 'security-audit', to: '/security-audit', icon: ShieldCheck, labelKey: 'shell.nav.securityAudit', group: 'main' },
  { id: 'system', to: '/system', icon: Settings, labelKey: 'shell.nav.system', group: 'main' },
  { id: 'users-roles', to: '/admin/users', icon: UsersRound, labelKey: 'shell.nav.usersRoles', group: 'admin', permission: Permission.USER_ADMIN, liveOnly: true },
  { id: 'paired-devices', to: '/admin/devices', icon: TabletSmartphone, labelKey: 'shell.nav.pairedDevices', group: 'admin', permission: Permission.PAIRING_MANAGE, liveOnly: true },
  // Task 4 row 112 (decision U10): the commissioning screen, for the one role that holds `CAPTURE_COMMISSION` (TECHNICIAN).
  { id: 'commissioning', to: '/admin/commissioning', icon: Router, labelKey: 'web.commissioning.nav', group: 'admin', permission: Permission.CAPTURE_COMMISSION, liveOnly: true },
  { id: 'api-reference', to: '/developer/api', icon: Braces, labelKey: 'shell.nav.apiReference', group: 'developer' },
]

export const MAIN_NAV_ITEMS = NAV_ITEMS.filter((item) => item.group === 'main')
export const ADMIN_NAV_ITEMS = NAV_ITEMS.filter((item) => item.group === 'admin')
export const DEVELOPER_NAV_ITEMS = NAV_ITEMS.filter((item) => item.group === 'developer')

export type BottomTabLabelKey =
  | 'shell.bottomTabs.home'
  | 'shell.bottomTabs.sessions'
  | 'shell.bottomTabs.evidence'
  | 'shell.bottomTabs.devices'

/** Bottom tab bar below 768 px (research/04 §2.5): four destinations plus "More" (the Drawer). */
export const BOTTOM_TABS: ReadonlyArray<{ id: string; to: NavPath; icon: LucideIcon; labelKey: BottomTabLabelKey }> = [
  { id: 'home', to: '/dashboard', icon: House, labelKey: 'shell.bottomTabs.home' },
  { id: 'sessions', to: '/session', icon: Monitor, labelKey: 'shell.bottomTabs.sessions' },
  { id: 'evidence', to: '/evidence', icon: FileText, labelKey: 'shell.bottomTabs.evidence' },
  { id: 'devices', to: '/devices', icon: Camera, labelKey: 'shell.bottomTabs.devices' },
]
