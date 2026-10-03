import { Card } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HEALTH_QUERY_KEY } from '@dems/shared/api'
import { HeartbeatState } from '@dems/shared/domain'
import { useHeartbeat } from '@dems/shared/realtime'
import type { StatusTone } from '@dems/shared/tokens'
import { coreHttpOrigin, fetchCoreHealth } from '@/lib/core-endpoint'
import { GlowLayer, type GlowTone } from '@/motion'

type BannerState = 'ONLINE' | 'CONNECTING' | 'OFFLINE'

const STATE_OF: Record<HeartbeatState, BannerState> = {
  [HeartbeatState.LIVE]: 'ONLINE',
  [HeartbeatState.CONNECTING]: 'CONNECTING',
  [HeartbeatState.STALE]: 'CONNECTING',
  [HeartbeatState.OFFLINE]: 'OFFLINE',
}
const TONE: Record<BannerState, StatusTone> = { ONLINE: 'success', CONNECTING: 'warning', OFFLINE: 'danger' }
const GLOW: Record<BannerState, GlowTone> = { ONLINE: 'brand', CONNECTING: 'warning', OFFLINE: 'danger' }

/**
 * The page-header service banner (01_specs §14.9, fed by `useHeartbeat`): the app-wide mock-core
 * link, plus the service version from the shared health query (`['health']`, invalidated by the
 * heartbeat resync). Offline means only LIVE try-it is unavailable; SIMULATED try-it still answers.
 */
export function ServiceBanner() {
  const { t } = useTranslation()
  const heartbeat = useHeartbeat()
  const state = STATE_OF[heartbeat.state]
  const health = useQuery({ queryKey: HEALTH_QUERY_KEY, queryFn: () => fetchCoreHealth(), refetchInterval: 10_000 })
  const version = health.data?.version
  const title =
    state === 'ONLINE'
      ? version
        ? t('apiReference.banner.ONLINE', { version })
        : t('apiReference.banner.ONLINE_NO_VERSION')
      : t(`apiReference.banner.${state}`)
  return (
    <Card variant="secondary" className="api-banner" data-tone={TONE[state]} data-state={state} role="status" data-testid="api-service-banner">
      <GlowLayer level={1} tone={GLOW[state]} />
      <span className="api-banner-dot" aria-hidden="true" />
      <div className="api-banner-text">
        <p className="api-banner-title">{title}</p>
        <p className="api-banner-detail">{t('apiReference.banner.detail', { address: new URL(coreHttpOrigin()).host })}</p>
      </div>
    </Card>
  )
}
