import { Button, Card, Chip, Label, Switch, Tooltip } from '@heroui/react'
import { motion } from 'motion/react'
import { Copy, Download, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { API_BADGES, OPENAPI_DOCUMENT_VERSION } from '@dems/shared/api'
import { toneChipProps, type StatusTone } from '@dems/shared/tokens'
import { coreHttpOrigin } from '@/lib/core-endpoint'
import { copyToClipboard, downloadText } from './actions'
import { useStripVariants } from './choreography'

interface ServerStripCommon {
  operationCount: number
  /** Builds the openapi.json text of what the renderer shows (on demand, at click time). */
  getDocumentJson: () => string
  /** `info.version` of the document shown. Default: the Simulated document's version. */
  specVersion?: string
}

/** Simulated mode (the default): both switches. */
interface ServerStripSimulated extends ServerStripCommon {
  mode?: 'simulated'
  includeSimulated: boolean
  onIncludeSimulatedChange: (on: boolean) => void
  /** AR-2, Simulated mode: "Show Core-server endpoints", off by default. */
  includeCoreServer?: boolean
  onIncludeCoreServerChange?: (on: boolean) => void
}

/** Plan row W84: Live mode hides both switches and shows the Live legend, so it takes no switch props (FXR-W W92-21). */
interface ServerStripLive extends ServerStripCommon {
  mode: 'live'
}

/** The props follow the mode (W92-21: Live mode used to pass a dummy `includeSimulated` and a no-op handler). */
export type ServerStripProps = ServerStripSimulated | ServerStripLive

type LegendKey = 'LIVE' | 'SIMULATED' | 'RBAC_AUDIT' | 'CORE_SERVER'
type LegendTooltip = 'live' | 'simulated' | 'rbac' | 'coreServer' | 'liveCore'
const LEGEND_TONE: Record<LegendKey, StatusTone> = {
  LIVE: API_BADGES.LIVE.tone,
  SIMULATED: API_BADGES.SIMULATED.tone,
  RBAC_AUDIT: API_BADGES.RBAC_AUDIT.tone,
  CORE_SERVER: 'default',
}

/** The legend of a view: Simulated as before (plus CORE SERVER while that switch is on); Live: LIVE and RBAC + AUDIT. */
function legendOf(mode: 'simulated' | 'live', includeCoreServer: boolean): readonly { key: LegendKey; tooltip: LegendTooltip }[] {
  if (mode === 'live') return [{ key: 'LIVE', tooltip: 'liveCore' }, { key: 'RBAC_AUDIT', tooltip: 'rbac' }]
  const legend: { key: LegendKey; tooltip: LegendTooltip }[] = [
    { key: 'LIVE', tooltip: 'live' },
    { key: 'SIMULATED', tooltip: 'simulated' },
    { key: 'RBAC_AUDIT', tooltip: 'rbac' },
  ]
  if (includeCoreServer) legend.push({ key: 'CORE_SERVER', tooltip: 'coreServer' })
  return legend
}

/**
 * The server strip (01_specs §14.9): base-URL chip (mono), spec version, Download and Copy
 * buttons, the LIVE / SIMULATED / RBAC + AUDIT legend, and the "Show simulated endpoints" switch.
 * The chips stagger in on the strip beat (M-PG-API). Plan row W84 (backend task
 * 04_client_integration_spec §11): in Simulated mode a second switch "Show Core-server endpoints"
 * (AR-2); in Live mode no switch, the base URL is the page's own origin and the spec version the
 * Core server's document (AR-3). Download and Copy give the current view's document and base URL
 * (AR-8).
 */
export function ServerStrip(props: ServerStripProps) {
  const { operationCount, getDocumentJson, specVersion = OPENAPI_DOCUMENT_VERSION } = props
  const simulated = props.mode === 'live' ? null : props
  const mode = simulated === null ? 'live' : 'simulated'
  const includeCoreServer = simulated?.includeCoreServer ?? false
  const { t } = useTranslation()
  const { container, item } = useStripVariants()
  const baseUrl = coreHttpOrigin()
  const legend = legendOf(mode, includeCoreServer)
  return (
    <Card variant="secondary" className="api-strip" data-testid="api-server-strip">
      <motion.div className="api-strip-row" variants={container} initial="hidden" animate="visible">
        <motion.div variants={item} className="api-strip-group">
          <Server className="api-strip-icon" aria-hidden="true" strokeWidth={1.75} />
          <span className="api-strip-label">{t('apiReference.server.baseUrl')}</span>
          <Chip variant="soft" color="default" className="api-mono-chip" data-testid="api-base-url">
            <Chip.Label>{baseUrl}</Chip.Label>
          </Chip>
        </motion.div>
        <motion.div variants={item} className="api-strip-group">
          <span className="api-strip-label">{t('apiReference.server.specVersion')}</span>
          <Chip variant="soft" color="accent" className="api-mono-chip" data-testid="api-spec-version">
            <Chip.Label>{`v${specVersion}`}</Chip.Label>
          </Chip>
          <span className="api-note" data-testid="api-operation-count">
            {t('apiReference.server.operations', { count: operationCount })}
          </span>
        </motion.div>
        <motion.div variants={item} className="api-strip-group api-strip-legend" role="list" aria-label={t('apiReference.server.legend')}>
          {legend.map(({ key, tooltip }) => (
            <Tooltip key={key} delay={300}>
              <Tooltip.Trigger
                className="api-legend-trigger"
                role="listitem"
                aria-label={`${t(`apiReference.badges.${key}`)}: ${t(`apiReference.tooltips.${tooltip}`)}`}
              >
                <Chip {...toneChipProps(LEGEND_TONE[key])} variant="soft" data-testid={`api-legend-${key}`}>
                  <Chip.Label>{t(`apiReference.badges.${key}`)}</Chip.Label>
                </Chip>
              </Tooltip.Trigger>
              <Tooltip.Content placement="bottom">{t(`apiReference.tooltips.${tooltip}`)}</Tooltip.Content>
            </Tooltip>
          ))}
        </motion.div>
        <motion.div variants={item} className="api-strip-group api-strip-actions">
          {simulated !== null ? (
            <>
              <Switch isSelected={simulated.includeSimulated} onChange={simulated.onIncludeSimulatedChange} data-testid="api-show-simulated">
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Label>{t('apiReference.server.showSimulated')}</Label>
                </Switch.Content>
              </Switch>
              <Switch isSelected={includeCoreServer} onChange={(on) => simulated.onIncludeCoreServerChange?.(on)} data-testid="api-show-core-server">
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Label>{t('apiReference.server.showCoreServer')}</Label>
                </Switch.Content>
              </Switch>
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            data-testid="api-copy-base-url"
            onPress={() =>
              void copyToClipboard(
                baseUrl,
                { ok: t('apiReference.server.copied'), failed: t('apiReference.server.copyFailed') },
                'ServerStrip.copyBaseUrl',
              )
            }
          >
            <Copy className="size-4" aria-hidden="true" />
            {t('apiReference.server.copyBaseUrl')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            data-testid="api-download"
            onPress={() =>
              downloadText(
                getDocumentJson(),
                'openapi.json',
                { ok: t('apiReference.server.downloaded'), failed: t('apiReference.server.downloadFailed') },
                'ServerStrip.download',
              )
            }
          >
            <Download className="size-4" aria-hidden="true" />
            {t('apiReference.server.download')}
          </Button>
        </motion.div>
      </motion.div>
    </Card>
  )
}
