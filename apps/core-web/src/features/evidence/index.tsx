/**
 * Evidence feature (step 47; masterplan/01_specs.md §14.5.3; research/04 §5.1; 03_motion_spec
 * M-PG-EVID; D28, D50, D67; review 40 rules R1–R10). The route files import `EvidenceListPage`
 * (`/evidence`, root test ID `page-evidence`) and `EvidenceDetailPage` (`/evidence/$evidenceId`, root
 * test ID `page-evidence-detail`), per the step-38 stub contract (implementation/19_app_shell.md §2).
 *
 * The page shells here are light (page header, banner, not-found state: simulator and kit only) and
 * render at once; the bodies are `React.lazy` chunks, so `@dems/shared/demo-data` (≈ 270 KB raw), the
 * DEMO asset URL map, TanStack Table and the verify helpers load in their own lazy chunk behind a
 * Skeleton (review 40 m12; M-C-24), never in the entry chunk.
 */
import './evidence.css'
import { lazy, Suspense } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Button, Card, EmptyState, Skeleton } from '@heroui/react'
import { ArrowLeft, FileSearch, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { selectEvidenceStats, useSim } from '@dems/shared/sim'
import { PageHeader } from '@/components/shell/page-header'
import { useMotionPolicy } from '@/motion'

const EvidenceListBody = lazy(() => import('./list-page').then((module) => ({ default: module.EvidenceListBody })))
const EvidenceDetailBody = lazy(() => import('./detail-page').then((module) => ({ default: module.EvidenceDetailBody })))

const detailRoute = getRouteApi('/_app/evidence/$evidenceId')

/** M-C-24: skeleton blocks shaped like the page while its body chunk loads (static under reduced motion). */
function BodySkeleton({ variant }: { variant: 'list' | 'detail' }) {
  const m = useMotionPolicy()
  const animation = m.reduced ? 'none' : 'shimmer'
  return (
    <div className="evi-body evi-body-skeleton" data-testid="evidence-body-skeleton" aria-busy="true">
      {variant === 'list' ? (
        <div className="evi-kpis">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} animationType={animation} className="evi-skeleton-block evi-skeleton-kpi" />
          ))}
        </div>
      ) : (
        <Skeleton animationType={animation} className="evi-skeleton-block evi-skeleton-header" />
      )}
      <Skeleton animationType={animation} className="evi-skeleton-block evi-skeleton-panel" />
    </div>
  )
}

export function EvidenceListPage() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const stats = useSim(selectEvidenceStats)
  const banner = (
    <Card variant="secondary" className="evi-banner" data-testid="evidence-banner">
      <span className="evi-banner-dot" aria-hidden="true" />
      <span className="evi-banner-text">{t('evidence.banner', { sealed: stats.sealedToday, pending: stats.pending })}</span>
    </Card>
  )
  return (
    <div className="dems-page evi-page" data-testid="page-evidence" data-motion={m.policy}>
      <PageHeader icon={FileText} title={t('evidence.title')} subtitle={t('evidence.subtitle')} status={banner} />
      <Suspense fallback={<BodySkeleton variant="list" />}>
        <EvidenceListBody />
      </Suspense>
    </div>
  )
}

export function EvidenceDetailPage() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const navigate = useNavigate()
  const { evidenceId } = detailRoute.useParams()
  const item = useSim((s) => s.evidence.find((entry) => entry.id === evidenceId) ?? null)
  return (
    <div className="dems-page evi-page evi-detail" data-testid="page-evidence-detail" data-found={item ? 'true' : 'false'} data-motion={m.policy}>
      <PageHeader
        icon={FileText}
        title={t('evidence.detail.title')}
        subtitle={evidenceId}
        status={
          <Button variant="ghost" size="sm" onPress={() => void navigate({ to: '/evidence' })} data-testid="evidence-back">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('evidence.detail.back')}
          </Button>
        }
      />
      {item ? (
        <Suspense fallback={<BodySkeleton variant="detail" />}>
          <EvidenceDetailBody item={item} />
        </Suspense>
      ) : (
        <Card className="evi-not-found">
          <EmptyState className="evi-empty">
            <FileSearch className="size-8 text-foreground-2" aria-hidden="true" />
            <p className="evi-empty-title">{t('evidence.detail.notFound', { id: evidenceId })}</p>
            <Link to="/evidence" className="evi-back-link">
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('evidence.detail.back')}
            </Link>
          </EmptyState>
        </Card>
      )}
    </div>
  )
}
