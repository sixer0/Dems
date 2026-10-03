import { Button, Chip, Label, ScrollShadow, Switch } from '@heroui/react'
import { getRouteApi } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Copy, Radio, Wifi, WifiOff, Loader } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { HEARTBEAT_INTERVAL_MS } from '@dems/shared/api'
import { formatClock, formatDuration, formatUtcOffset } from '@dems/shared/realtime'
import { motion as motionTokens, toneChipProps, toneHex, type StatusTone } from '@dems/shared/tokens'
import { AnimatedListItem } from '@/components/ui/animated-list'
import { SlidingNumber } from '@/components/ui/sliding-number'
import { allowedPageOrigins, coreWsUrl } from '@/lib/core-endpoint'
import { useMotionPolicy } from '@/motion'
import { copyToClipboard } from './actions'
import { ApiPanel } from './panel'
import { REALTIME_MESSAGE_LIMIT, useRealtimeFeed, type RealtimeChipState } from './use-realtime-feed'

const routeApi = getRouteApi('/_app/developer/api')

const CHIP_TONE: Record<RealtimeChipState, StatusTone> = { ONLINE: 'success', CONNECTING: 'warning', OFFLINE: 'danger' }
const CHIP_ICON = { ONLINE: Wifi, CONNECTING: Loader, OFFLINE: WifiOff } as const

/**
 * The Realtime WS panel (01_specs §14.9; 3 columns, full width below 1440): the WS `/ws` heartbeat
 * that OpenAPI cannot describe, live from mock-core. Chip ONLINE / CONNECTING / OFFLINE (M-C-06
 * morph), the WS URL with a copy button, `seq` (MP SlidingNumber), server time, uptime, clients,
 * the last 5 raw messages (MU AnimatedList, M-C-07) and a Connect switch. The connection dot pulses
 * once per heartbeat (M-C-06; the page's only ambient motion, and data). Reduced motion: no pulse.
 */
export function RealtimePanel() {
  const { t } = useTranslation()
  const { socketFactory } = routeApi.useRouteContext()
  const feed = useRealtimeFeed(socketFactory)
  const m = useMotionPolicy()
  const tone = CHIP_TONE[feed.chip]
  const ChipIcon = CHIP_ICON[feed.chip]
  const { snapshot, last } = feed
  const wsUrl = coreWsUrl()
  const address = new URL(wsUrl).host

  const note = !feed.connected
    ? feed.originAllowed
      ? t('apiReference.realtime.paused')
      : t('apiReference.realtime.originBlocked', { origin: allowedPageOrigins()[0], current: feed.origin })
    : feed.chip === 'OFFLINE'
      ? t('apiReference.realtime.reconnecting', { address })
      : feed.chip === 'CONNECTING' && snapshot.seq === null
        ? t('apiReference.realtime.waiting')
        : null

  return (
    <ApiPanel
      id="realtime"
      icon={Radio}
      title={`${t('apiReference.realtime.title')} • ${t('apiReference.realtime.endpoint')}`}
      className="api-realtime-panel"
      action={
        <Chip {...toneChipProps(tone)} variant="soft" data-testid="api-realtime-chip" data-state={feed.chip}>
          <ChipIcon aria-hidden="true" size={14} className={feed.chip === 'CONNECTING' && !m.reduced ? 'api-spin' : undefined} />
          <Chip.Label>{t(`apiReference.realtime.state.${feed.chip}`)}</Chip.Label>
        </Chip>
      }
    >
      <div className="api-rt-url">
        <span className="api-strip-label">{t('apiReference.realtime.url')}</span>
        <code className="api-rt-url-text" data-testid="api-realtime-url">
          {wsUrl}
        </code>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={t('apiReference.realtime.copyUrl')}
          onPress={() =>
            void copyToClipboard(
              wsUrl,
              { ok: t('apiReference.realtime.copied'), failed: t('apiReference.realtime.copyFailed') },
              'RealtimePanel.copyUrl',
            )
          }
        >
          <Copy className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="api-rt-hero">
        <span className="api-rt-dot" aria-hidden="true">
          {feed.chip === 'ONLINE' && !m.reduced && snapshot.seq !== null ? (
            <motion.span
              key={snapshot.seq}
              className="api-rt-dot-halo"
              style={{ backgroundColor: toneHex[tone] }}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: m.seconds(motionTokens.ambient.heartbeatPulse), ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null}
          <span className="api-rt-dot-core" style={{ backgroundColor: toneHex[tone] }} />
        </span>
        <div className="api-rt-seq" data-testid="api-realtime-seq" aria-label={`${t('apiReference.realtime.fields.seq')} ${snapshot.seq ?? 0}`}>
          <span className="api-strip-label">{t('apiReference.realtime.fields.seq')}</span>
          <span className="api-rt-seq-value">
            <SlidingNumber value={snapshot.seq ?? 0} />
          </span>
        </div>
      </div>

      <dl className="api-kv">
        <div>
          <dt>{t('apiReference.realtime.fields.serverTime')}</dt>
          <dd className="api-mono" data-testid="api-realtime-server-time">
            {snapshot.serverTime ? `${formatClock(snapshot.serverTime)} UTC${formatUtcOffset()}` : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('apiReference.realtime.fields.uptime')}</dt>
          <dd className="api-mono">{last ? formatDuration(last.uptimeMs) : '—'}</dd>
        </div>
        <div>
          <dt>{t('apiReference.realtime.fields.clients')}</dt>
          <dd className="api-mono" data-testid="api-realtime-clients">
            {snapshot.clients ?? '—'}
          </dd>
        </div>
        <div>
          <dt>{t('apiReference.realtime.fields.interval')}</dt>
          <dd className="api-mono">{`${(last?.intervalMs ?? HEARTBEAT_INTERVAL_MS) / 1000} s`}</dd>
        </div>
        <div>
          <dt>{t('apiReference.realtime.fields.sessionState')}</dt>
          <dd className="api-mono">{last?.sessionState ?? t('apiReference.realtime.none')}</dd>
        </div>
      </dl>

      <div className="api-rt-connect">
        <Switch isSelected={feed.connected} onChange={feed.setConnected} data-testid="api-realtime-connect">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Label>{t('apiReference.realtime.connect')}</Label>
          </Switch.Content>
        </Switch>
      </div>

      {note ? (
        <p className="api-note" role="status" data-testid="api-realtime-note">
          {note}
        </p>
      ) : null}

      <div className="api-rt-messages">
        <span className="api-strip-label">{t('apiReference.realtime.lastMessages', { count: REALTIME_MESSAGE_LIMIT })}</span>
        <ScrollShadow className="api-rt-scroll" hideScrollBar data-testid="api-realtime-messages">
          {feed.messages.length === 0 ? (
            <p className="api-note">{t('apiReference.realtime.none')}</p>
          ) : (
            <div className="api-rt-list" role="list">
              <AnimatePresence initial={false}>
                {feed.messages.map((message, index) => (
                  <AnimatedListItem key={message.id} highlight={index === 0}>
                    <pre className="api-rt-json" role="listitem">
                      {message.json}
                    </pre>
                  </AnimatedListItem>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollShadow>
      </div>
    </ApiPanel>
  )
}
