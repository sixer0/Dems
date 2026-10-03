import { memo, useMemo } from 'react'
import { Avatar, Chip, Table } from '@heroui/react'
import { Check, Minus, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { useSim } from '@dems/shared/sim'
import { useAuditLog } from './audit-context'
import { lastSignInByOperator, PERMISSION_ORDER, ROLE_ORDER, roleGrants } from './model'
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
 */
export const RbacPanel = memo(function RbacPanel({ className }: RbacPanelProps) {
  const { t } = useTranslation()
  const operators = useSim((s) => s.operators)
  const { rows } = useAuditLog()
  const currentId = useSignedInOperatorId()
  const lastSignIn = useMemo(() => lastSignInByOperator(rows), [rows])

  return (
    <Panel
      id="rbac"
      icon={UsersRound}
      title={t('securityAudit.rbac.title')}
      subtitle={t('securityAudit.rbac.subtitle')}
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
        <RoleMatrix />
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
