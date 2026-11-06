import { LiveLinkState, useLiveLink } from '@dems/shared/live'
import { useCoreSignedIn } from '@/lib/core-queries'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { LcdIntegrationStatus } from '@dems/shared/api'
import { CORE_QUERY_ROOT, useWebLive } from '@/runtime'

/** Reads through the existing authenticated Core client. No browser -> USB-backend requests. */
export function LcdConnection() {
  const live = useWebLive()
  const signedIn = useCoreSignedIn()
  const link = useLiveLink()
  const query = useQuery({
    queryKey: [CORE_QUERY_ROOT, 'lcd-connection'],
    enabled: live !== null && signedIn && link === LiveLinkState.ONLINE,
    refetchInterval: 2_000,
    retry: false,
    queryFn: async () => {
      if (!live) return null
      const answer = await live.client.call('getDeviceHealth')
      if (!answer.ok) throw new Error('LCD_CONFIGURATION_UNAVAILABLE')
      return answer.data.lcd ?? null
    },
  })
  return <LcdConnectionView simulated={live === null} loading={query.isPending} failed={query.isError || (live !== null && (!signedIn || link !== LiveLinkState.ONLINE))} status={query.data ?? null} />
}

export function LcdConnectionView({ simulated, loading, failed, status }: {
  simulated: boolean
  loading: boolean
  failed: boolean
  status: LcdIntegrationStatus | null
}) {
  const { t } = useTranslation()
  let body
  if (simulated) body = <p>{t('web.lcd.simulated')}</p>
  else if (failed) body = <p role="alert">{t('web.lcd.readError')}</p>
  else if (loading) body = <p role="status">{t('web.lcd.loading')}</p>
  else if (!status) body = <><p>{t('web.lcd.disabled')}</p><p>{t('web.lcd.configure')}</p></>
  else body = <>
    <p>{t('web.lcd.preview')}</p>
    <dl className="dev-lcd-connection-facts">
      <dt>{t('web.lcd.backend')}</dt><dd>{status.backendUrl} · {t(status.reachable ? 'web.lcd.reachable' : 'web.lcd.unreachable')}</dd>
      <dt>{t('web.lcd.panel')}</dt><dd>{t(status.panelConnected === null ? 'web.lcd.unknown' : status.panelConnected ? 'web.lcd.connected' : 'web.lcd.disconnected')}</dd>
      <dt>{t('web.lcd.health')}</dt><dd>{status.health === null ? t('web.lcd.unknown') : t(`web.lcd.status.${status.health}`)}</dd>
      <dt>{t('web.lcd.lastSync')}</dt><dd>{status.lastSyncAt === null ? t('web.lcd.awaiting') : new Date(status.lastSyncAt).toLocaleTimeString()}</dd>
    </dl>
    {status.error === null ? null : <p role="alert">{t(`web.lcd.syncError.${status.error}`)}</p>}
    {status.channels.length === 0 ? null : <>
      <h4>{t('web.lcd.channels')}</h4>
      <ul>{status.channels.map((channel) => <li key={channel.channel}>
        CH{channel.channel} → {channel.track ?? t('web.lcd.unused')} · {t(channel.recording ? 'web.lcd.recording' : 'web.lcd.stopped')}
      </li>)}</ul>
    </>}
    <p>{t('web.lcd.startup')}</p>
  </>
  return <section className="dev-lcd-connection" aria-label={t('web.lcd.title')} data-testid="lcd-connection">
    <h3>{t('web.lcd.title')}</h3>{body}
  </section>
}
