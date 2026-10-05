/**
 * Users & Roles, `/admin/users` (backend task 04_client_integration_spec §10.1, §10.2; AC-C-86 to
 * AC-C-91; plan row W77, which replaces the Live body of W54's stub). The route file
 * (`routes/_app/admin/users.tsx`, W54's) holds the guard: in Live mode an operator without
 * `USER_ADMIN` never gets here (PG-3), and the shell leaves the page when a `session.updated` takes
 * the permission away (§6.3, RC-1; `ROUTE_PERMISSIONS` names this route).
 *
 * | Mode | What the page shows |
 * |------|---------------------|
 * | Simulated (a direct URL: the sidebar hides the entry) | The header and the shared "Live mode only" state `ur-live-only` (W54's `LiveOnlyState`), centred in this page's own grid (F76-12) |
 * | Live, the users read answered 403 | The header and the page-level Forbidden state `ur-forbidden` with a link to the Dashboard |
 * | Live | The header with the summary chip `ur-summary`; the hero panel "Operators" (`panel-users`) and the panel "Roles and permissions" (`panel-matrix`), each with its Loading, Empty / Error states; the three dialogs |
 *
 * Data (PG-6, PG-6a; rule 3): operations 11 and 10 in TanStack Query under `CORE_QUERY_KEYS`; W50's
 * bridge refetches the list on `admin.changed` USERS and REMOVES both entries on a sign-out, on any
 * session end and on the loss of `USER_ADMIN`, so nothing of this page can be rendered for the next
 * operator. Commands (operations 12, 14, 13) go through `useWebLive()?.client.call(…)` on the
 * dialog's `usePendingControl()` (W0 §15), every failure through the presenter first (rule 2).
 *
 * **CONTRACT-GAP-W77-1.** §10.2 "Live update" expects "a sign-in elsewhere (active sessions, last
 * sign-in)" to appear without a reload. The Core publishes no `admin.changed` for a sign-in, a
 * sign-out or an expiry (`apps/core-server/src/modules/identity/sign-in.ts:241`,
 * `apps/core-server/src/modules/identity/sessions.ts:191`, `:310` publish `session.ended` only;
 * decision D78 DN-16), so those two columns are as of the last read: a role change, an enable or a
 * disable by anyone, this page's own command, a socket resync or a return to the browser tab
 * (TanStack Query's focus refetch) reads them again. Nothing is invented on the client.
 *
 * **Test ID** `users-roles-page`: the wrapper of the two panels, the Live body of the page. W54's test
 * (`src/test/live-shell-admin.test.tsx`) finds it inside the page root `page-users-roles` in Live mode;
 * it replaced W54's stub ID `ur-stub` in the closing web round (row W1, decision D179 DC-1).
 */
import { useState } from 'react'
import { Card, Chip, EmptyState } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { ShieldX, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AdminUser } from '@dems/shared/api'
import { CoreMode, LiveLinkState, useCoreMode, useLiveLink, useLiveSelector } from '@dems/shared/live'
import { LiveOnlyState } from '@/components/shell/live-only-state'
import { PageHeader } from '@/components/shell/page-header'
import { AnimatedNumber } from '@/components/ui/animated-number'
import type { WebLive } from '@/runtime'
import { matrixOf, summaryOf, usersOf } from './model'
import { MatrixPanel } from './matrix-panel'
import { isForbiddenRead, useRoleMatrixQuery, useUsersQuery } from './queries'
import { RoleDialog } from './role-dialog'
import { DisableDialog, EnableDialog } from './status-dialogs'
import { UsersPanel, type UserAction } from './users-panel'
import './users-roles.css'

export function UsersRolesPage() {
  const { t } = useTranslation()
  const live = useCoreMode() === CoreMode.LIVE
  return (
    <div className="dems-page ur-page" data-testid="page-users-roles">
      {live ? (
        <UsersRolesLive />
      ) : (
        <>
          <PageHeader icon={UsersRound} title={t('usersRoles.title')} subtitle={t('usersRoles.subtitle')} />
          <div className="ur-state-wrap">
            <LiveOnlyState icon={UsersRound} body={t('usersRoles.states.liveOnly')} testId="ur-live-only" />
          </div>
        </>
      )}
    </div>
  )
}

interface DialogState {
  readonly kind: UserAction | null
  readonly target: AdminUser | null
  readonly open: boolean
  /** Counts the openings: each opening gets a fresh dialog (its own pending control, choice and reason). */
  readonly seq: number
}

const CLOSED: DialogState = { kind: null, target: null, open: false, seq: 0 }

function UsersRolesLive() {
  const { t } = useTranslation()
  const usersQuery = useUsersQuery()
  const matrixQuery = useRoleMatrixQuery()
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  const selfId = useLiveSelector((live: WebLive | null) => live?.session?.operator.id ?? null)
  const [dialog, setDialog] = useState<DialogState>(CLOSED)

  const users = usersQuery.data === undefined ? null : usersOf(usersQuery.data)
  const matrix = matrixQuery.data === undefined ? null : matrixOf(matrixQuery.data)
  const header = (
    <PageHeader icon={UsersRound} title={t('usersRoles.title')} subtitle={t('usersRoles.subtitle')} status={users === null ? undefined : <SummaryChip users={users} />} />
  )

  if (usersQuery.isError && isForbiddenRead(usersQuery.error)) {
    return (
      <>
        {header}
        <div className="ur-state-wrap">
          <Card className="ur-state-card rounded-xl">
            <EmptyState className="ur-state" data-testid="ur-forbidden">
              <ShieldX className="ur-state-icon" aria-hidden="true" strokeWidth={1.5} />
              <p className="ur-state-title">{t('usersRoles.states.forbidden')}</p>
              <Link to="/dashboard" className="ur-state-link" data-testid="ur-forbidden-link">
                {t('usersRoles.states.forbiddenLink')}
              </Link>
            </EmptyState>
          </Card>
        </div>
      </>
    )
  }

  const open = (kind: UserAction, target: AdminUser) => setDialog((current) => ({ kind, target, open: true, seq: current.seq + 1 }))
  const close = () => setDialog((current) => ({ ...current, open: false }))
  const targetOf = (kind: UserAction) => (dialog.kind === kind ? dialog.target : null)

  return (
    <>
      {header}
      <div className="ur-grid" data-testid="users-roles-page">
        <UsersPanel
          users={users}
          matrix={matrix}
          failed={usersQuery.isError}
          selfId={selfId}
          linkUp={linkUp}
          onRetry={() => void usersQuery.refetch()}
          onAction={open}
        />
        <MatrixPanel matrix={matrix} failed={matrixQuery.isError} linkUp={linkUp} onRetry={() => void matrixQuery.refetch()} />
      </div>
      <RoleDialog
        key={`role-${dialog.seq}`}
        isOpen={dialog.open && dialog.kind === 'role'}
        target={targetOf('role')}
        users={users ?? []}
        matrix={matrix}
        selfId={selfId}
        linkUp={linkUp}
        onClose={close}
      />
      <DisableDialog key={`disable-${dialog.seq}`} isOpen={dialog.open && dialog.kind === 'disable'} target={targetOf('disable')} selfId={selfId} linkUp={linkUp} onClose={close} />
      <EnableDialog key={`enable-${dialog.seq}`} isOpen={dialog.open && dialog.kind === 'enable'} target={targetOf('enable')} linkUp={linkUp} onClose={close} />
    </>
  )
}

/** "n users · m enabled" (§10.2 Header), the numbers as counters (`AnimatedNumber`). */
function SummaryChip({ users }: { users: readonly AdminUser[] }) {
  const { t } = useTranslation()
  const summary = summaryOf(users)
  return (
    <Chip size="sm" variant="soft" color="default" className="ur-summary" data-testid="ur-summary">
      <span className="sr-only">{t('usersRoles.summary.label', { users: summary.users, enabled: summary.enabled })}</span>
      <span aria-hidden="true" className="ur-summary-text">
        <AnimatedNumber value={summary.users} className="ur-mono" /> {t('usersRoles.summary.users', { count: summary.users })}
        <span className="ur-summary-sep">·</span>
        <AnimatedNumber value={summary.enabled} className="ur-mono" /> {t('usersRoles.summary.enabled')}
      </span>
    </Chip>
  )
}
