import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Alert, Button, Chip, EmptyState, Skeleton, Table, ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { TabletSmartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PairedDevice } from '@dems/shared/api'
import { LiveLinkState, useLiveLink } from '@dems/shared/live'
import { DATE_PATTERNS, EMPTY_DATE_TEXT, formatDate, useRetryCooldown } from '@dems/shared/realtime'
import { useSim, type SimOperator } from '@dems/shared/sim'
import { HIGHLIGHT_FADE_MS, HIGHLIGHT_FROM_OPACITY } from '@/components/ui/animated-list'
import { retryCoreQuery } from '@/lib/core-queries'
import { deferEffectStart } from '@/lib/effect-start'
import { cn } from '@/lib/utils'
import { ROW_STAGGER_CAP, ROW_STAGGER_MS, HELD_BEAT_MS, useMotionPolicy } from '@/motion'
import { useRouteEnterDelay } from '@/components/shell'
import { CORE_QUERY_KEYS } from '@/runtime'
import { PANEL_BEAT_MS } from './choreography'
import type { PairingReads } from './live-data'
import { DEVICE_FILTERS, DeviceFilter, filterDevices, LAST_SEEN_REFRESH_MS, lastSeenParts, orderDevices } from './model'
import { Panel } from './panel'
import { RevokeDialog } from './revoke-dialog'

const STATE_COLOR = { PAIRED: 'success', REVOKED: 'danger', UNPAIRED: 'default' } as const
const SKELETON_ROWS = 3

/**
 * "Devices", the device list (backend task 04_client_integration_spec §10.3 "The device list";
 * AC-C-97, AC-C-98, AC-C-99; plan row W81).
 *
 * The registry is operation 19's answer under `CORE_QUERY_KEYS.pairedDevices` (the entry the
 * Devices drawer shares). The bridge refetches it on `admin.changed` DEVICES and on a resync.
 * **RESIDUAL-W70-1 (W83 ledger #45), closed by E-fix FX-C** (decision D156 (2); ruling R4 of D201,
 * gated in D202): the Core server now publishes one debounced `admin.changed` DEVICES (1 s after the
 * last change, at most 5 s after the first) when a paired device's socket is admitted or departs and
 * when a device signs in or out, so the bridge refetch above keeps the `online` column current. The
 * refetch on a change of the replicated tablet link, added while that message was missing, stays as
 * a second path (one extra read per link change). The drawer has the same second path; this panel
 * starts its invalidation through `deferEffectStart` (one request under StrictMode), while the drawer
 * invalidates directly and is the StrictMode guard's one allowed exception
 * (`test/live-strict-mode-starts.test.tsx`).
 *
 * A new row enters with the gold highlight (M-C-07); PAIRED → REVOKED plays one halo; "Last seen"
 * refreshes every 30 s on the Live clock without animation. With the link down the last data
 * stays and "Revoke…" is disabled (the shell shows the notice).
 */
export function DevicesPanel({ reads }: { reads: PairingReads }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  const [filter, setFilter] = useState<DeviceFilter>(DeviceFilter.ALL)
  const [revoking, setRevoking] = useState<PairedDevice | null>(null)
  const query = reads.devices
  const devices = query.data?.devices

  // RESIDUAL-W70-1 (closed, D202): the tablet link changes when a paired device comes or goes; this read
  // came before the Core's debounced `admin.changed` DEVICES and stays as a second path.
  const tabletChangedAt = useSim((s) => s.tabletLink.changedAt)
  const seenTabletChange = useRef(tabletChangedAt)
  useEffect(() => {
    if (seenTabletChange.current === tabletChangedAt) return undefined
    seenTabletChange.current = tabletChangedAt
    return deferEffectStart(() => {
      void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.pairedDevices })
    })
  }, [queryClient, tabletChangedAt])

  const { added, revoked } = useRowChanges(devices)
  // W92-4: Retry through the key, so the read's gate (signed in, PAIRING_MANAGE, link up) holds for a press.
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(() => {
    retryCoreQuery(queryClient, CORE_QUERY_KEYS.pairedDevices)
  })

  const rows = useMemo(() => orderDevices(filterDevices(devices ?? [], filter)), [devices, filter])

  const filterControl = (
    <ToggleButtonGroup
      aria-label={t('pairedDevices.devices.filter.label')}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set<Key>([filter])}
      onSelectionChange={(keys) => {
        const next = Array.from(keys)[0]
        if (typeof next === 'string' && (DEVICE_FILTERS as readonly string[]).includes(next)) setFilter(next as DeviceFilter)
      }}
      size="sm"
      data-testid="pd-filter"
    >
      {DEVICE_FILTERS.map((entry) => (
        <ToggleButton key={entry} id={entry} data-testid={`pd-filter-${entry}`}>
          {t(`pairedDevices.devices.filter.${entry}`)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )

  let body
  if (devices === undefined && query.isError) {
    body = (
      <Alert status="danger" data-testid="pd-error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t('pairedDevices.devices.error')}</Alert.Title>
        </Alert.Content>
        <Button size="sm" variant="outline" onPress={retry} isDisabled={!canRetry || !linkUp} data-testid="pd-retry">
          {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
        </Button>
      </Alert>
    )
  } else if (devices === undefined) {
    body = (
      <div className="pd-loading" data-testid="pd-loading" aria-busy="true" aria-label={t('pairedDevices.devices.loading')}>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="pd-skeleton-row" />
        ))}
      </div>
    )
  } else if (devices.length === 0) {
    body = (
      <EmptyState className="pd-empty" data-testid="pd-empty">
        <TabletSmartphone className="pd-empty-icon" aria-hidden="true" strokeWidth={1.5} />
        <p className="pd-empty-title">{t('pairedDevices.devices.empty')}</p>
        <p className="pd-empty-body">{t('pairedDevices.devices.emptyHint')}</p>
      </EmptyState>
    )
  } else {
    body = <DevicesTable rows={rows} added={added} revoked={revoked} linkUp={linkUp} onRevoke={setRevoking} />
  }

  return (
    <Panel id="devices" icon={TabletSmartphone} title={t('pairedDevices.devices.title')} action={devices !== undefined && devices.length > 0 ? filterControl : undefined}>
      {body}
      <RevokeDialog device={revoking} onClose={() => setRevoking(null)} />
    </Panel>
  )
}

/**
 * Rows that are new since the previous answer (the gold highlight, M-C-07) and rows that changed
 * from PAIRED to REVOKED (one halo, M-C-10). The first answer highlights nothing.
 */
function useRowChanges(devices: readonly PairedDevice[] | undefined): { added: ReadonlySet<string>; revoked: ReadonlyMap<string, number> } {
  const previous = useRef<ReadonlyMap<string, PairedDevice['state']> | null>(null)
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set())
  const [revoked, setRevoked] = useState<ReadonlyMap<string, number>>(() => new Map())
  useEffect(() => {
    if (devices === undefined) return undefined
    const states = new Map(devices.map((device) => [device.id, device.state] as const))
    const before = previous.current
    previous.current = states
    if (before === null) return undefined
    const fresh = devices.filter((device) => !before.has(device.id)).map((device) => device.id)
    const ended = devices.filter((device) => before.get(device.id) === 'PAIRED' && device.state === 'REVOKED').map((device) => device.id)
    if (ended.length > 0) {
      setRevoked((current) => {
        const next = new Map(current)
        for (const id of ended) next.set(id, (next.get(id) ?? 0) + 1)
        return next
      })
    }
    if (fresh.length === 0) return undefined
    setAdded(new Set(fresh))
    const timer = setTimeout(() => setAdded(new Set()), HIGHLIGHT_FADE_MS)
    return () => clearTimeout(timer)
  }, [devices])
  return { added, revoked }
}

interface DevicesTableProps {
  rows: readonly PairedDevice[]
  added: ReadonlySet<string>
  revoked: ReadonlyMap<string, number>
  linkUp: boolean
  onRevoke: (device: PairedDevice) => void
}

function DevicesTable({ rows, added, revoked, linkUp, onRevoke }: DevicesTableProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  const operators = useSim((s) => s.operators)
  const nameOf = useMemo(() => {
    const byId = new Map<string, SimOperator>(operators.map((operator) => [operator.id, operator]))
    return (id: string | null): string => (id === null ? EMPTY_DATE_TEXT : (byId.get(id)?.displayName ?? id))
  }, [operators])
  // "Last seen" every 30 s, on the Live clock, without animation.
  const lastSeenNow = useSim((s) => Math.floor(s.clock.now / LAST_SEEN_REFRESH_MS)) * LAST_SEEN_REFRESH_MS

  if (rows.length === 0) {
    return (
      <EmptyState className="pd-empty" data-testid="pd-empty-filtered">
        <p className="pd-empty-body">{t('pairedDevices.devices.emptyFiltered')}</p>
      </EmptyState>
    )
  }

  const lastSeenText = (device: PairedDevice): string => {
    const parts = lastSeenParts(device.lastSeenAt, lastSeenNow)
    return parts.unit === 'justNow' ? t('pairedDevices.devices.lastSeen.justNow') : t(`pairedDevices.devices.lastSeen.${parts.unit}`, { count: parts.count })
  }

  return (
    <Table variant="secondary" className="pd-table">
      <Table.ScrollContainer>
        <Table.Content aria-label={t('pairedDevices.devices.tableLabel')} data-testid="pd-devices-table">
          <Table.Header>
            <Table.Column isRowHeader>{t('pairedDevices.devices.columns.device')}</Table.Column>
            <Table.Column>{t('pairedDevices.devices.columns.platform')}</Table.Column>
            <Table.Column>{t('pairedDevices.devices.columns.state')}</Table.Column>
            <Table.Column>{t('pairedDevices.devices.columns.operator')}</Table.Column>
            <Table.Column>{t('pairedDevices.devices.columns.paired')}</Table.Column>
            <Table.Column>{t('pairedDevices.devices.columns.lastSeen')}</Table.Column>
            <Table.Column>{t('pairedDevices.devices.columns.ended')}</Table.Column>
            <Table.Column>{t('pairedDevices.devices.columns.action')}</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((device, index) => {
              const highlighted = added.has(device.id) && m.flags.flashes
              const style = {
                '--pd-row-delay': `${m.seconds(routeDelay + PANEL_BEAT_MS.devices + HELD_BEAT_MS + ROW_STAGGER_MS * Math.min(index, ROW_STAGGER_CAP - 1))}s`,
                '--pd-highlight-ms': `${HIGHLIGHT_FADE_MS}ms`,
                '--pd-highlight-from': String(HIGHLIGHT_FROM_OPACITY),
              } as CSSProperties
              const halos = revoked.get(device.id) ?? 0
              return (
                <Table.Row
                  key={device.id}
                  id={device.id}
                  className={cn('pd-row', m.flags.stagger && 'pd-row-enter', highlighted && 'pd-row-new')}
                  style={style}
                  data-testid={`pd-device-${device.id}`}
                  data-state={device.state}
                  data-highlight={highlighted ? 'true' : undefined}
                >
                  <Table.Cell>
                    <span className="pd-device-id">{device.id}</span>
                    <span className="pd-device-name">{device.name}</span>
                  </Table.Cell>
                  <Table.Cell>{t('pairedDevices.devices.platformVersion', { platform: device.platform, version: device.appVersion })}</Table.Cell>
                  <Table.Cell>
                    <span className="pd-state">
                      <span className="pd-chip-wrap">
                        <Chip size="sm" variant="soft" color={STATE_COLOR[device.state]} data-testid={`pd-state-${device.id}`}>
                          <Chip.Label>{t(`pairedDevices.devices.state.${device.state}`)}</Chip.Label>
                        </Chip>
                        {halos > 0 && m.flags.flashes ? (
                          <motion.span key={halos} aria-hidden="true" className="pd-halo pd-halo-danger" variants={m.variants.halo} initial="hidden" animate="visible" />
                        ) : null}
                      </span>
                      <span
                        className={cn('pd-online-dot', device.online && device.state === 'PAIRED' ? 'pd-online-on' : 'pd-online-off')}
                        data-testid={`pd-online-${device.id}`}
                        data-online={device.online ? 'true' : 'false'}
                        role="img"
                        aria-label={device.online ? t('pairedDevices.devices.online') : t('pairedDevices.devices.offline')}
                      />
                      {/* Fix wave J round three (N-15): the online state was a small dot with no word. The dot keeps its name for assistive technology; the word is for the eye. */}
                      <span className="pd-online-word" aria-hidden="true" data-testid={`pd-online-word-${device.id}`}>
                        {device.online ? t('pairedDevices.devices.online') : t('pairedDevices.devices.offline')}
                      </span>
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span data-testid={`pd-operator-${device.id}`}>{nameOf(device.signedInOperatorId)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="pd-mono">{formatDate(device.pairedAt, DATE_PATTERNS.dateTimeMinutes)}</span>
                    <span className="pd-soft">{t('pairedDevices.devices.codeIssuedBy', { name: nameOf(device.codeIssuedBy) })}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span data-testid={`pd-last-seen-${device.id}`}>{lastSeenText(device)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <EndedCell device={device} nameOf={nameOf} />
                  </Table.Cell>
                  <Table.Cell>
                    {device.state === 'PAIRED' ? (
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => onRevoke(device)}
                        isDisabled={!linkUp}
                        aria-label={t('pairedDevices.devices.revokeLabel', { deviceId: device.id })}
                        data-testid={`pd-revoke-${device.id}`}
                      >
                        {t('pairedDevices.devices.revoke')}
                      </Button>
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}

function EndedCell({ device, nameOf }: { device: PairedDevice; nameOf: (id: string | null) => string }) {
  const { t } = useTranslation()
  if (device.state === 'REVOKED') {
    return (
      <span className="pd-ended-cell">
        <span className="pd-mono">{formatDate(device.revokedAt, DATE_PATTERNS.dateTimeMinutes)}</span>
        <span className="pd-soft">{t('pairedDevices.devices.revokedBy', { name: nameOf(device.revokedBy) })}</span>
        {device.revokeReason !== null ? <span className="pd-soft pd-reason">{device.revokeReason}</span> : null}
      </span>
    )
  }
  if (device.state === 'UNPAIRED') {
    return (
      <span className="pd-ended-cell">
        <span className="pd-mono">{formatDate(device.unpairedAt, DATE_PATTERNS.dateTimeMinutes)}</span>
        <span className="pd-soft">{t('pairedDevices.devices.unpairedOnDevice')}</span>
      </span>
    )
  }
  return <span className="pd-soft">{EMPTY_DATE_TEXT}</span>
}
