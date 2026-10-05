import { memo, useMemo } from 'react'
import { Avatar, Button, Chip, Spinner, Table } from '@heroui/react'
import { Check, Minus, UsersRound } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { RoleMatrix as CoreRoleMatrixBody } from '@dems/shared/api'
import { useLiveSelector } from '@dems/shared/live'
import { DATE_PATTERNS, formatDate, useRetryCooldown } from '@dems/shared/realtime'
import { useSim, type OperatorRole, type Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { CORE_QUERY_KEYS, useWebLive, type WebLive } from '@/runtime'
import { useAuditLog } from './audit-context'
import { logSecurityAudit } from './log'
import { coreGrantSet, lastSignInByOperator, PERMISSION_ORDER, ROLE_ORDER, roleGrants } from './model'
import { Panel } from './panel'
import { useSignedInOperatorId } from './use-security-data'

export interface RbacPanelProps {
  className?: string
}

/**
 * Access control (S20; research/04 §5.5 RBAC; 01_specs §14.7 "Roles", demo assumption 01 G1;
 * D28 2–3 synthetic operators). The three demo operators with role and last sign-in (from the
 * audit ring), the signed-in one marked, and the role × permission matrix the simulator enforces
 * (`ROLE_PERMISSIONS`).
 *
 * Live mode (plan row W75; 04_client_integration_spec §6.1, finding FC-3; TS-8): the matrix is the
 * Core's, operation 10 `getRoleMatrix`, read once into the query cache under
 * `CORE_QUERY_KEYS.roleMatrix` (the bridge refetches it after a resynchronisation and drops it at a
 * session end): the twelve permissions in the Core's order. Simulated mode keeps its nine-row list
 * (`PERMISSION_ORDER`), so the folder's row-count assertion holds.
 */
export const RbacPanel = memo(function RbacPanel({ className }: RbacPanelProps) {
  const { t } = useTranslation()
  const live = useWebLive()
  const operators = useSim((s) => s.operators)
  const { rows } = useAuditLog()
  const currentId = useSignedInOperatorId()
  const lastSignIn = useMemo(() => lastSignInByOperator(rows), [rows])

  return (
    <Panel
      id="rbac"
      icon={UsersRound}
      title={t('securityAudit.rbac.title')}
      subtitle={live === null ? t('securityAudit.rbac.subtitle') : t('securityAudit.live.rbac.subtitle')}
      className={className}
    >
      <div className="sa-rbac">
        <div className="sa-operators">
          {operators.map((operator) => {
            const at = lastSignIn.get(operator.id)
            const current = operator.id === currentId
            return (
              <div key={operator.id} className="sa-operator" data-current={current || undefined} data-operator={operator.id}>
                <Avatar size="sm">
                  <Avatar.Fallback>{operator.initials}</Avatar.Fallback>
                </Avatar>
                <div className="sa-operator-main">
                  <span className="sa-operator-name">{operator.displayName}</span>
                  <span className="sa-operator-sub">
                    <span className="sa-mono">{operator.id}</span> •{' '}
                    {at !== undefined
                      ? t('securityAudit.rbac.lastSignIn', { time: formatDate(at, DATE_PATTERNS.dateTimeMinutes) })
                      : t('securityAudit.rbac.never')}
                  </span>
                </div>
                {current ? (
                  <Chip size="sm" variant="soft" color="accent">
                    {t('securityAudit.rbac.you')}
                  </Chip>
                ) : null}
                <Chip size="sm" variant="soft" color={operator.role === 'SUPERVISOR' ? 'warning' : 'default'}>
                  {t(`common.roles.${operator.role}`)}
                </Chip>
              </div>
            )
          })}
        </div>
        {live === null ? <RoleMatrix /> : <CoreRoleMatrix live={live} />}
      </div>
    </Panel>
  )
})

/** The role × permission matrix: static (ROLE_PERMISSIONS), so it never re-renders with the audit ring. */
const RoleMatrix = memo(function RoleMatrix() {
  const { t } = useTranslation()
  return (
    <Table variant="secondary" className="sa-matrix">
      <Table.ScrollContainer>
        <Table.Content aria-label={t('securityAudit.rbac.matrixLabel')} data-testid="rbac-matrix">
          <Table.Header>
            <Table.Column isRowHeader>{t('securityAudit.rbac.permission')}</Table.Column>
            {ROLE_ORDER.map((role) => (
              <Table.Column key={role}>{t(`common.roles.${role}`)}</Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {PERMISSION_ORDER.map((permission) => (
              <Table.Row key={permission} id={permission}>
                <Table.Cell>{t(`securityAudit.rbac.permissions.${permission}`)}</Table.Cell>
                {ROLE_ORDER.map((role) => {
                  const granted = roleGrants(role, permission)
                  return (
                    <Table.Cell key={role}>
                      <span
                        className="sa-grant"
                        data-granted={granted}
                        role="img"
                        aria-label={granted ? t('securityAudit.rbac.granted') : t('securityAudit.rbac.notGranted')}
                      >
                        {granted ? <Check className="size-3.5" aria-hidden="true" /> : <Minus className="size-3.5" aria-hidden="true" />}
                      </span>
                    </Table.Cell>
                  )
                })}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
})

/** A failed answer of operation 10, carried through the query's error (its status and code, never its text). */
class RoleMatrixReadError extends Error {
  override readonly name = 'RoleMatrixReadError'
  readonly status: number | null
  readonly code: string
  constructor(failure: { readonly status: number | null; readonly error: { readonly code: string } }) {
    super('The role matrix of the Core could not be read.')
    this.status = failure.status
    this.code = failure.error.code
  }
}

/**
 * Live mode: the matrix the Core server enforces (operation 10). While it is on its way a status
 * line; without an answer the presenter's toast (an outage, a refusal it words) or one record, an
 * inline message and a rate-limited Retry (3 s, 6 s, 12 s; at most three).
 */
function CoreRoleMatrix({ live }: { live: WebLive }) {
  const { t } = useTranslation()
  const presentCoreError = useCoreErrorPresenter()
  // Read only while signed in: when the session ends the bridge removes the entry in the same turn,
  // and a page that is still on screen until the shell leaves must not ask again (a read the Core
  // can only answer 401; seen on lane 3, then red-tested).
  const signedIn = useLiveSelector((source: WebLive | null) => source?.session != null)
  const query = useQuery({
    queryKey: CORE_QUERY_KEYS.roleMatrix,
    enabled: signedIn,
    queryFn: async (): Promise<CoreRoleMatrixBody> => {
      const answer = await live.client.call('getRoleMatrix')
      if (answer.ok) return answer.data
      const error = new RoleMatrixReadError(answer)
      if (presentCoreError(answer) === null) logSecurityAudit('warn', 'RbacPanel.roleMatrix', error, { status: answer.status })
      throw error
    },
  })
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(() => {
    void query.refetch()
  })
  const matrix = query.data
  const grants = useMemo(() => (matrix ? coreGrantSet(matrix.grants) : null), [matrix])

  if (matrix === undefined || grants === null) {
    if (query.status === 'error') {
      return (
        <div role="alert" className="sa-matrix-state" data-testid="rbac-matrix-failed">
          <p>{t('securityAudit.live.rbac.failed')}</p>
          <Button size="sm" variant="outline" isDisabled={!canRetry || query.isFetching} onPress={retry} data-testid="rbac-matrix-retry">
            {exhausted
              ? t('securityAudit.live.rbac.exhausted')
              : cooldown > 0
                ? t('common.actions.retryIn', { seconds: cooldown })
                : t('common.actions.retry')}
          </Button>
        </div>
      )
    }
    return (
      <div role="status" className="sa-matrix-state" data-testid="rbac-matrix-loading">
        <Spinner size="sm" aria-hidden="true" />
        <span>{t('securityAudit.live.rbac.loading')}</span>
      </div>
    )
  }

  return (
    <Table variant="secondary" className="sa-matrix">
      <Table.ScrollContainer>
        <Table.Content aria-label={t('securityAudit.rbac.matrixLabel')} data-testid="rbac-matrix" data-matrix-source="core">
          <Table.Header>
            <Table.Column isRowHeader>{t('securityAudit.rbac.permission')}</Table.Column>
            {matrix.roles.map((role) => (
              <Table.Column key={role}>{t(`common.roles.${role}`)}</Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {matrix.permissions.map((permission: Permission) => (
              <Table.Row key={permission} id={permission}>
                <Table.Cell>{t(`securityAudit.rbac.permissions.${permission}`)}</Table.Cell>
                {matrix.roles.map((role: OperatorRole) => {
                  const granted = grants.has(`${role}:${permission}`)
                  return (
                    <Table.Cell key={role}>
                      <span
                        className="sa-grant"
                        data-granted={granted}
                        role="img"
                        aria-label={granted ? t('securityAudit.rbac.granted') : t('securityAudit.rbac.notGranted')}
                      >
                        {granted ? <Check className="size-3.5" aria-hidden="true" /> : <Minus className="size-3.5" aria-hidden="true" />}
                      </span>
                    </Table.Cell>
                  )
                })}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}
