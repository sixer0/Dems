import { useEffect, useRef, useState, type Key } from 'react'
import { Alert, Avatar, Button, Chip, Dropdown, EmptyState, Label, Skeleton, Table } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { EllipsisVertical, Trash, UserCheck, UserCog, UserPlus, UserRoundPen, UserX, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AdminUser, RoleMatrix } from '@dems/shared/api'
import type { OperatorRole } from '@dems/shared/sim'
import { DATE_PATTERNS, formatDate, useRetryCooldown } from '@dems/shared/realtime'
import { HIGHLIGHT_FADE_MS } from '@/components/ui/animated-list'
import { useMotionPolicy } from '@/motion'
import { changedRowIds, isLastAdministrator, roleTone } from './model'
import { Panel } from './panel'

export type UserAction = 'role' | 'disable' | 'enable' | 'edit' | 'delete'

export interface UsersPanelProps {
  /** The rows of the last answer; `null` before the first answer. */
  readonly users: readonly AdminUser[] | null
  readonly matrix: RoleMatrix | null
  /** The first read failed and there is nothing to show (not a 403: that is the page's Forbidden state). */
  readonly failed: boolean
  readonly selfId: string | null
  readonly linkUp: boolean
  readonly onRetry: () => void
  readonly onAction: (action: UserAction, user: AdminUser) => void
  /**
   * RB-9 as amended 02-11-2026: the row's "Edit profile…" and "Delete user…" and the panel's
   * "Add user" belong to the vendor `root` account alone. Cosmetic — the server refuses the same
   * three for any other caller with 403 `NOT_PERMITTED`.
   */
  readonly manageAccounts: boolean
  readonly onCreate: () => void
}

const SKELETON_ROWS = 3

/**
 * Panel "Operators", the hero of the page (backend task 04_client_integration_spec §10.2; the
 * states of §10.1; AC-C-86, AC-C-89, AC-C-90, AC-C-91; plan row W77). One row per operator of
 * `listUsers`: the avatar with initials, the display name, the username in mono and "You" on the
 * caller's own row; the role chip in the tone of the Login list; the status chip with its dot; the
 * active sessions; the last sign-in; the date of the last role change; and the row's menu.
 *
 * - **Offline** (§10.1): the last answer stays; every row menu is disabled while the link is down.
 * - **Live update** (§10.2): a row that is new or whose shown cells changed between two answers gets
 *   the gold highlight of M-C-07 for `HIGHLIGHT_FADE_MS`; the role chip cross-fades (M-C-10); the
 *   status chip plays one halo when it turns Disabled (an escalation) and changes colour only when it
 *   turns Enabled.
 * - RESIDUAL-W77-1 (W83 ledger #55): a sign-in or a sign-out elsewhere publishes no `admin.changed`, so the active
 *   sessions and the last sign-in are as of the last read (see the page's docblock).
 */
export function UsersPanel({ users, matrix, failed, selfId, linkUp, onRetry, onAction, manageAccounts, onCreate }: UsersPanelProps) {
  const { t } = useTranslation()
  const highlighted = useRowHighlights(users)
  return (
    <Panel
      id="users"
      icon={UsersRound}
      title={t('usersRoles.users.title')}
      subtitle={t('usersRoles.users.subtitle')}
      hero
      action={
        manageAccounts ? (
          <Button size="sm" variant="primary" isDisabled={!linkUp} onPress={onCreate} data-testid="ur-create-user">
            <UserPlus aria-hidden="true" size={16} />
            {t('usersRoles.actions.createUser')}
          </Button>
        ) : undefined
      }
    >
      {users === null ? (
        failed ? (
          <ReadError testId="ur" message={t('usersRoles.states.error')} linkUp={linkUp} onRetry={onRetry} />
        ) : (
          <div className="ur-skeleton" data-testid="ur-loading" aria-busy="true">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div key={index} className="ur-skeleton-row">
                <Skeleton className="ur-skeleton-avatar" />
                <Skeleton className="ur-skeleton-line" />
                <Skeleton className="ur-skeleton-chip" />
              </div>
            ))}
          </div>
        )
      ) : users.length === 0 ? (
        <EmptyState className="ur-empty" data-testid="ur-empty">
          <UsersRound className="size-8 text-foreground-2" aria-hidden="true" />
          <p className="ur-empty-title">{t('usersRoles.states.empty')}</p>
          <p className="ur-muted">{t('usersRoles.states.emptyBody')}</p>
        </EmptyState>
      ) : (
        <Table variant="secondary" className="ur-table">
          <Table.ScrollContainer>
            <Table.Content aria-label={t('usersRoles.users.tableLabel')} data-testid="ur-users-table">
              <Table.Header>
                <Table.Column isRowHeader>{t('usersRoles.users.columns.operator')}</Table.Column>
                <Table.Column>{t('usersRoles.users.columns.role')}</Table.Column>
                <Table.Column>{t('usersRoles.users.columns.status')}</Table.Column>
                <Table.Column className="ur-col-number">{t('usersRoles.users.columns.activeSessions')}</Table.Column>
                <Table.Column>{t('usersRoles.users.columns.lastSignIn')}</Table.Column>
                <Table.Column>{t('usersRoles.users.columns.roleChanged')}</Table.Column>
                <Table.Column className="ur-col-actions">
                  <span className="sr-only">{t('usersRoles.users.columns.actions')}</span>
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {users.map((user) => (
                  <Table.Row
                    key={user.id}
                    id={user.id}
                    textValue={`${user.displayName} ${user.username}`}
                    className="ur-row"
                    data-testid={`ur-user-${user.id}`}
                    data-highlight={highlighted.has(user.id) ? 'true' : undefined}
                    data-enabled={user.enabled ? 'true' : 'false'}
                  >
                    <Table.Cell>
                      <span className="ur-operator">
                        <Avatar size="sm">
                          <Avatar.Fallback>{user.initials}</Avatar.Fallback>
                        </Avatar>
                        <span className="ur-operator-text">
                          <span className="ur-operator-name">
                            {user.displayName}
                            {user.id === selfId ? (
                              <Chip size="sm" variant="soft" color="accent" className="ur-self" data-testid="ur-self">
                                {t('usersRoles.users.you')}
                              </Chip>
                            ) : null}
                          </span>
                          <span className="ur-mono ur-muted">{user.username}</span>
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <RoleChip role={user.role} label={t(`common.roles.${user.role}`)} testId={`ur-role-${user.id}`} />
                    </Table.Cell>
                    <Table.Cell>
                      <StatusChip enabled={user.enabled} label={user.enabled ? t('usersRoles.users.enabled') : t('usersRoles.users.disabled')} testId={`ur-status-${user.id}`} />
                    </Table.Cell>
                    <Table.Cell className="ur-col-number">
                      <span className="ur-mono" data-testid={`ur-sessions-${user.id}`}>
                        {user.activeSessions}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className={user.lastSignInAt === null ? 'ur-muted' : 'ur-mono'} data-testid={`ur-last-sign-in-${user.id}`}>
                        {user.lastSignInAt === null ? t('usersRoles.users.neverSignedIn') : formatDate(user.lastSignInAt, DATE_PATTERNS.dateTimeMinutes)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className={user.roleChangedAt === null ? 'ur-muted' : 'ur-mono'}>
                        {user.roleChangedAt === null ? t('usersRoles.users.roleNeverChanged') : formatDate(user.roleChangedAt, DATE_PATTERNS.dateTimeMinutes)}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="ur-col-actions">
                      <RowMenu user={user} lastAdministrator={isLastAdministrator(user, users, matrix)} linkUp={linkUp} manageAccounts={manageAccounts} onAction={onAction} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </Panel>
  )
}

/**
 * The row menu: "Change role…", then "Disable user…" or "Enable user" (§10.2 Actions column), and —
 * for the vendor `root` account only (RB-9 as amended) — "Edit profile…" and "Delete user…".
 * [SP:RB-8] keeps both the disable and the delete of the last enabled administrator out of reach.
 */
function RowMenu({
  user,
  lastAdministrator,
  linkUp,
  manageAccounts,
  onAction,
}: {
  user: AdminUser
  lastAdministrator: boolean
  linkUp: boolean
  manageAccounts: boolean
  onAction: UsersPanelProps['onAction']
}) {
  const { t } = useTranslation()
  const onMenu = (key: Key) => {
    if (key === 'role' || key === 'disable' || key === 'enable' || key === 'edit' || key === 'delete') onAction(key, user)
  }
  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label={t('usersRoles.actions.menu', { name: user.displayName })}
        isDisabled={!linkUp}
        data-testid={`ur-actions-${user.id}`}
      >
        <EllipsisVertical aria-hidden="true" size={16} />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[220px]">
        <Dropdown.Menu aria-label={t('usersRoles.actions.menuLabel')} disabledKeys={lastAdministrator ? ['disable', 'delete'] : []} onAction={onMenu}>
          <Dropdown.Item id="role" textValue={t('usersRoles.actions.changeRole')} data-testid={`ur-change-role-${user.id}`}>
            <UserCog aria-hidden="true" size={16} />
            <Label>{t('usersRoles.actions.changeRole')}</Label>
          </Dropdown.Item>
          {user.enabled ? (
            <Dropdown.Item id="disable" textValue={t('usersRoles.actions.disable')} data-testid={`ur-disable-${user.id}`}>
              <UserX aria-hidden="true" size={16} />
              <div className="flex flex-col">
                <Label>{t('usersRoles.actions.disable')}</Label>
                {lastAdministrator ? <span className="ur-menu-hint">{t('usersRoles.lastAdmin')}</span> : null}
              </div>
            </Dropdown.Item>
          ) : (
            <Dropdown.Item id="enable" textValue={t('usersRoles.actions.enable')} data-testid={`ur-enable-${user.id}`}>
              <UserCheck aria-hidden="true" size={16} />
              <Label>{t('usersRoles.actions.enable')}</Label>
            </Dropdown.Item>
          )}
          {manageAccounts ? (
            <>
              <Dropdown.Item id="edit" textValue={t('usersRoles.actions.edit')} data-testid={`ur-edit-user-${user.id}`}>
                <UserRoundPen aria-hidden="true" size={16} />
                <Label>{t('usersRoles.actions.edit')}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="delete" textValue={t('usersRoles.actions.delete')} data-testid={`ur-delete-user-${user.id}`}>
                <Trash aria-hidden="true" size={16} />
                <div className="flex flex-col">
                  <Label>{t('usersRoles.actions.delete')}</Label>
                  {lastAdministrator ? <span className="ur-menu-hint">{t('usersRoles.lastAdmin')}</span> : null}
                </div>
              </Dropdown.Item>
            </>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

/** The role chip (M-C-10): the label cross-fades over 120 ms when the role changes. */
function RoleChip({ role, label, testId }: { role: OperatorRole; label: string; testId: string }) {
  const m = useMotionPolicy()
  return (
    <Chip size="sm" variant="soft" color={roleTone(role)} data-testid={testId} data-role={role}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={role} className="inline-flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: m.seconds(120) }}>
          <Chip.Label>{label}</Chip.Label>
        </motion.span>
      </AnimatePresence>
    </Chip>
  )
}

/**
 * The status chip with its dot (§10.2): Enabled `success`, Disabled `default`. Turning Disabled is
 * an escalation and plays one halo (`variants.halo`, M-C-10, R8); turning Enabled changes the colour
 * only. Reduced motion: no halo.
 */
function StatusChip({ enabled, label, testId }: { enabled: boolean; label: string; testId: string }) {
  const m = useMotionPolicy()
  // Escalations counted while rendering (the pattern of `features/devices/status-chip.tsx`).
  const [seen, setSeen] = useState({ enabled, pulses: 0 })
  let pulses = seen.pulses
  if (seen.enabled !== enabled) {
    pulses = !enabled ? seen.pulses + 1 : seen.pulses
    setSeen({ enabled, pulses })
  }
  return (
    <span className="ur-status-wrap" data-testid={testId} data-enabled={enabled ? 'true' : 'false'}>
      <Chip size="sm" variant="soft" color={enabled ? 'success' : 'default'} className="ur-status-chip">
        <span className="ur-status-dot" aria-hidden="true" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={label} className="inline-flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: m.seconds(120) }}>
            <Chip.Label>{label}</Chip.Label>
          </motion.span>
        </AnimatePresence>
      </Chip>
      {pulses > 0 && m.flags.flashes ? <motion.span key={pulses} aria-hidden="true" className="ur-status-halo" variants={m.variants.halo} initial="hidden" animate="visible" /> : null}
    </span>
  )
}

/** The Error state of §10.1: a kit `Alert` `danger` with a Retry on the existing cooldown. */
export function ReadError({ testId, message, linkUp, onRetry }: { testId: string; message: string; linkUp: boolean; onRetry: () => void }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <Alert status="danger" data-testid={`${testId}-error`} className="ur-read-error">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
      <Button size="sm" variant="outline" isDisabled={!canRetry || !linkUp} onPress={retry} data-testid={`${testId}-retry`}>
        {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
      </Button>
    </Alert>
  )
}

/**
 * The rows to highlight (M-C-07): new rows and rows whose shown cells changed between two answers,
 * for `HIGHLIGHT_FADE_MS`. The first answer highlights nothing; reduced motion highlights nothing.
 * The effect starts no Core call (W0 §15's static guard reads it).
 */
function useRowHighlights(users: readonly AdminUser[] | null): ReadonlySet<string> {
  const m = useMotionPolicy()
  const reduced = m.reduced
  const fadeMs = m.seconds(HIGHLIGHT_FADE_MS) * 1000
  const previous = useRef<readonly AdminUser[] | null>(null)
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    const before = previous.current
    previous.current = users
    if (before === null || users === null || reduced) return
    const changed = changedRowIds(before, users)
    if (changed.length > 0) setHighlighted(new Set(changed))
  }, [users, reduced])
  // The fade ends on its own timer, so a re-run of the effect above can never leave a row lit.
  useEffect(() => {
    if (highlighted.size === 0) return undefined
    const timer = setTimeout(() => setHighlighted(new Set()), fadeMs)
    return () => clearTimeout(timer)
  }, [highlighted, fadeMs])
  return highlighted
}
