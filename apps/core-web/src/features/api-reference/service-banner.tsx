import { Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { HeartbeatState } from '@dems/shared/domain'
import { useHeartbeat } from '@dems/shared/realtime'
import type { StatusTone } from '@dems/shared/tokens'
import { useHealth } from '@/lib/health-query'
import { coreHttpOrigin } from '@/lib/core-endpoint'
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

export interface ServiceBannerProps {
  /** Live mode (plan row W84, AR-6): the Core server's words; otherwise mock-core's, as before. */
  live?: boolean
}

/**
 * The page-header service banner (01_specs §14.9, fed by `useHeartbeat`): the app-wide link, plus
 * the service version from the shared health query (`['health']`, invalidated by the heartbeat
 * resync). Simulated mode: mock-core; offline means only LIVE try-it is unavailable, SIMULATED
 * try-it still answers. Live mode (backend task 04_client_integration_spec §11 AR-6): the heartbeat
 * is the view of the Live source's one socket (the root route provides it), and the health answer
 * names `dems-core-server`, its version and its readiness.
 *
 * The health query is `useHealth()` of `lib/health-query.ts` (finding CPW1-9, moved there by FXR-W
 * W92-9: one home for the key and its `queryFn`; the Login page's Live reader adds its own observer
 * options by design).
 */
export function ServiceBanner({ live = false }: ServiceBannerProps) {
  const { t } = useTranslation()
  const heartbeat = useHeartbeat()
  const state = STATE_OF[heartbeat.state]
  const health = useHealth()
  const version = health.data?.version
  const address = new URL(coreHttpOrigin()).host
  let title: string
  if (live) {
    const ready = health.data?.ready
    const readiness = t(ready === undefined || (ready.database && ready.engine) ? 'apiReference.banner.live.ready' : 'apiReference.banner.live.starting')
    title =
      state === 'ONLINE'
        ? version && health.data
          ? t('apiReference.banner.live.ONLINE', { service: health.data.service, version, readiness })
          : t('apiReference.banner.live.ONLINE_NO_VERSION')
        : t(`apiReference.banner.live.${state}`)
  } else {
    title =
      state === 'ONLINE'
        ? version
          ? t('apiReference.banner.ONLINE', { version })
          : t('apiReference.banner.ONLINE_NO_VERSION')
        : t(`apiReference.banner.${state}`)
  }
  return (
    <Card variant="secondary" className="api-banner" data-tone={TONE[state]} data-state={state} role="status" data-testid="api-service-banner">
      <GlowLayer level={1} tone={GLOW[state]} />
      <span className="api-banner-dot" aria-hidden="true" />
      <div className="api-banner-text">
        <p className="api-banner-title">{title}</p>
        <p className="api-banner-detail">{live ? t('apiReference.banner.live.detail', { address }) : t('apiReference.banner.detail', { address })}</p>
      </div>
    </Card>
  )
}
