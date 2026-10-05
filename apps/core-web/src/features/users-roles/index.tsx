/**
 * Users & Roles page, `/admin/users` (backend task 04_client_integration_spec §10.1 PG-1, PG-2,
 * PG-3; §10.2). STUB of plan row W54: the page contract only. The export name `UsersRolesPage`
 * (imported by `routes/_app/admin/users.tsx`) and the root `data-testid="page-users-roles"` are
 * kept by the page row (W77), which replaces the Live body with the two panels of §10.2.
 *
 * | Mode | What the stub shows |
 * |------|---------------------|
 * | Simulated (a direct URL: the sidebar hides the entry) | The header and the "Live mode only" state, `ur-live-only` |
 * | Live, with `USER_ADMIN` (the route guard sends everybody else to the Dashboard) | The header and an empty body, `ur-stub` |
 */
import { Card, EmptyState } from '@heroui/react'
import { UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { LiveOnlyState } from '@/components/shell/live-only-state'
import { PageHeader } from '@/components/shell/page-header'

export function UsersRolesPage() {
  const { t } = useTranslation()
  const live = useCoreMode() === CoreMode.LIVE
  return (
    <div className="dems-page" data-testid="page-users-roles">
      <PageHeader icon={UsersRound} title={t('usersRoles.title')} subtitle={t('usersRoles.subtitle')} />
      {live ? (
        <Card className="dems-live-only-card rounded-xl">
          <EmptyState className="dems-live-only" data-testid="ur-stub">
            {t('common.states.empty')}
          </EmptyState>
        </Card>
      ) : (
        <LiveOnlyState icon={UsersRound} body={t('usersRoles.states.liveOnly')} testId="ur-live-only" />
      )}
    </div>
  )
}
