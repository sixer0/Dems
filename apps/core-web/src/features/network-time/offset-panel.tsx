import { lazy, Suspense } from 'react'
import { Skeleton } from '@heroui/react'
import { ChartSpline } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { formatOffset } from './model'
import { NetworkTimePanel } from './panel'

const chartsChunk = import('./charts')
const OffsetChart = lazy(() => chartsChunk.then((m) => ({ default: m.OffsetChart })))

/**
 * Time-offset history (01_specs §14.5.6 row 5: Recharts `LineChart` over `time.history`, one point
 * per 10 s, at most 120). The series changes colour with the source, so a GNSS loss shows on the
 * line as gold → amber (NTP ±12 ms), and an RTC holdover as a red drift. Until two samples exist
 * the panel says it is collecting (rare since step 54: the simulator back-fills the history since boot).
 */
export function OffsetPanel() {
  const { t } = useTranslation()
  const history = useSim((s) => s.time.history)
  const now = useSim((s) => ({ offsetMs: s.time.offsetMs, source: s.time.source }))
  const value = formatOffset(now.offsetMs)
  return (
    <NetworkTimePanel
      id="offset"
      icon={ChartSpline}
      title={t('networkTime.history.title')}
      action={
        <span className="nt-headline">
          <span className="nt-headline-strong" data-source={now.source}>
            {t('networkTime.history.now', { value })}
          </span>
          <span className="nt-headline-muted">{t('networkTime.history.band')}</span>
        </span>
      }
    >
      {history.length >= 2 ? (
        <Suspense fallback={<Skeleton className="nt-chart rounded-lg" />}>
          <OffsetChart
            history={history}
            label={t('networkTime.history.ariaLabel', { samples: history.length, value, source: now.source })}
          />
        </Suspense>
      ) : (
        <div className="nt-chart nt-chart-empty" data-testid="network-time-offset-empty">
          <p className="nt-collecting">{t('networkTime.history.empty')}</p>
        </div>
      )}
    </NetworkTimePanel>
  )
}
