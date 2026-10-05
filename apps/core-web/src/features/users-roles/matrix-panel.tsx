import { Chip, Skeleton, Table } from '@heroui/react'
import { Check, LockKeyhole, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RoleMatrix } from '@dems/shared/api'
import { holds } from './model'
import { Panel } from './panel'
import { ReadError } from './users-panel'

export interface MatrixPanelProps {
  /** The matrix of the last answer; `null` before the first answer. */
  readonly matrix: RoleMatrix | null
  readonly failed: boolean
  readonly linkUp: boolean
  readonly onRetry: () => void
}

/**
 * Panel "Roles and permissions" (backend task 04_client_integration_spec §10.2; AC-C-86; plan row
 * W77): the twelve permission rows by the three role columns of `getRoleMatrix` (operation 10), with
 * the `Check` and `Minus` icons of the existing matrix (`features/security-audit/rbac-panel.tsx`)
 * and a "Read-only" chip: the matrix cannot be edited (`editable: false`, [SP:RB-9]). Rows and
 * columns come in the server's own order. Its states carry the suffixes of §10.1 on `ur-matrix-`.
 */
export function MatrixPanel({ matrix, failed, linkUp, onRetry }: MatrixPanelProps) {
  const { t } = useTranslation()
  return (
    <Panel
      id="matrix"
      icon={LockKeyhole}
      title={t('usersRoles.matrix.title')}
      subtitle={t('usersRoles.matrix.subtitle')}
      action={
        <Chip size="sm" variant="soft" color="default" data-testid="ur-matrix-readonly">
          {t('usersRoles.matrix.readOnly')}
        </Chip>
      }
    >
      {matrix === null ? (
        failed ? (
          <ReadError testId="ur-matrix" message={t('usersRoles.states.matrixError')} linkUp={linkUp} onRetry={onRetry} />
        ) : (
          <div className="ur-skeleton" data-testid="ur-matrix-loading" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="ur-skeleton-row">
                <Skeleton className="ur-skeleton-line" />
              </div>
            ))}
          </div>
        )
      ) : (
        <Table variant="secondary" className="ur-matrix">
          <Table.ScrollContainer>
            <Table.Content aria-label={t('usersRoles.matrix.tableLabel')} data-testid="ur-matrix">
              <Table.Header>
                <Table.Column isRowHeader>{t('usersRoles.matrix.permission')}</Table.Column>
                {matrix.roles.map((role) => (
                  <Table.Column key={role}>{t(`common.roles.${role}`)}</Table.Column>
                ))}
              </Table.Header>
              <Table.Body>
                {matrix.permissions.map((permission) => (
                  <Table.Row key={permission} id={permission} data-permission={permission}>
                    <Table.Cell>{t(`securityAudit.rbac.permissions.${permission}`)}</Table.Cell>
                    {matrix.roles.map((role) => {
                      const granted = holds(matrix, role, permission)
                      return (
                        <Table.Cell key={role}>
                          <span
                            className="ur-grant"
                            data-granted={granted ? 'true' : 'false'}
                            data-testid={`ur-grant-${role}-${permission}`}
                            role="img"
                            aria-label={granted ? t('usersRoles.matrix.granted') : t('usersRoles.matrix.notGranted')}
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
      )}
    </Panel>
  )
}
