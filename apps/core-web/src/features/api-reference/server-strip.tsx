import { Button, Card, Chip, Label, Switch, Tooltip } from '@heroui/react'
import { motion } from 'motion/react'
import { Copy, Download, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { API_BADGES, OPENAPI_DOCUMENT_VERSION, type ApiBadgeKey } from '@dems/shared/api'
import { toneChipProps } from '@dems/shared/tokens'
import { coreHttpOrigin } from '@/lib/core-endpoint'
import { copyToClipboard, downloadText } from './actions'
import { useStripVariants } from './choreography'

export interface ServerStripProps {
  includeSimulated: boolean
  onIncludeSimulatedChange: (on: boolean) => void
  operationCount: number
  /** Builds the openapi.json text of what the renderer shows (on demand, at click time). */
  getDocumentJson: () => string
}

const LEGEND: readonly ApiBadgeKey[] = ['LIVE', 'SIMULATED', 'RBAC_AUDIT']
const LEGEND_TOOLTIP = { LIVE: 'live', SIMULATED: 'simulated', RBAC_AUDIT: 'rbac' } as const

/**
 * The server strip (01_specs §14.9): base-URL chip (mono), spec version, Download and Copy
 * buttons, the LIVE / SIMULATED / RBAC + AUDIT legend, and the "Show simulated endpoints" switch.
 * The chips stagger in on the strip beat (M-PG-API).
 */
export function ServerStrip({ includeSimulated, onIncludeSimulatedChange, operationCount, getDocumentJson }: ServerStripProps) {
  const { t } = useTranslation()
  const { container, item } = useStripVariants()
  const baseUrl = coreHttpOrigin()
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
            <Chip.Label>{`v${OPENAPI_DOCUMENT_VERSION}`}</Chip.Label>
          </Chip>
          <span className="api-note" data-testid="api-operation-count">
            {t('apiReference.server.operations', { count: operationCount })}
          </span>
        </motion.div>
        <motion.div variants={item} className="api-strip-group api-strip-legend" role="list" aria-label={t('apiReference.server.legend')}>
          {LEGEND.map((key) => (
            <Tooltip key={key} delay={300}>
              <Tooltip.Trigger
                className="api-legend-trigger"
                role="listitem"
                aria-label={`${t(`apiReference.badges.${key}`)}: ${t(`apiReference.tooltips.${LEGEND_TOOLTIP[key]}`)}`}
              >
                <Chip {...toneChipProps(API_BADGES[key].tone)} variant="soft" data-testid={`api-legend-${key}`}>
                  <Chip.Label>{t(`apiReference.badges.${key}`)}</Chip.Label>
                </Chip>
              </Tooltip.Trigger>
              <Tooltip.Content placement="bottom">{t(`apiReference.tooltips.${LEGEND_TOOLTIP[key]}`)}</Tooltip.Content>
            </Tooltip>
          ))}
        </motion.div>
        <motion.div variants={item} className="api-strip-group api-strip-actions">
          <Switch isSelected={includeSimulated} onChange={onIncludeSimulatedChange} data-testid="api-show-simulated">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>{t('apiReference.server.showSimulated')}</Label>
            </Switch.Content>
          </Switch>
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
