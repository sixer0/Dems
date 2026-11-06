/**
 * The chain panel's two Live lines (plan row W75; backend task 04_client_integration_spec §8.2 A9,
 * §2.5 the `verifyAuditChain` binding; security design review SD-19; AC-C-109).
 *
 * Under the result of "Verify chain" the panel shows what the Core answered beside the check over
 * its audit view (operation 60, `AuditChainStatus`):
 *
 * - **The stored chain**: "Stored chain: verified, n rows", or the first bad sequence. The table,
 *   which no demo fault can reach: during an `AUDIT_TAMPER` fault the view is broken and the stored
 *   chain is intact, as 01_specs §12.3 defines.
 * - **Earlier chains** (only when the Core returned a lineage): "Earlier chains: n", where n is the
 *   number of chains a demo reset or a scenario load discarded in all, and a read-only list of the
 *   newest ones the Core returned (at most 20), one entry per chain: its epoch, row count and head
 *   hash shortened; the time of the reset, the operator (or the command line) and the scenario. It
 *   is the durable trace of every reset.
 *
 * Rendered in Live mode only: Simulated mode has no Core and its panel is as it was.
 */
import { memo, useState } from 'react'
import { Button, Popover } from '@heroui/react'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AuditChainStatus } from '@dems/shared/api'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { useSim } from '@dems/shared/sim'
import { shortHash } from './model'

/** What the Core answered beside the view check (the Live handle's `auditChain`, §2.5). */
export interface CoreChainCheck {
  readonly stored: AuditChainStatus['stored']
  readonly lineage: AuditChainStatus['lineage']
  readonly lineageTotal: number
}

export const CoreChainLines = memo(function CoreChainLines({ check }: { check: CoreChainCheck }) {
  const { t } = useTranslation()
  const { stored, lineage, lineageTotal } = check
  return (
    <div className="sa-chain-core" data-testid="chain-core">
      <span
        className={stored.ok ? 'sa-chain-core-line' : 'sa-chain-core-line sa-tone-danger'}
        data-testid="chain-stored"
        data-stored={stored.ok ? 'PASS' : 'FAIL'}
      >
        {stored.ok
          ? t('securityAudit.live.chain.stored', { count: stored.checked })
          : t('securityAudit.live.chain.storedBroken', { seq: stored.firstBadSeq ?? stored.checked + 1, checked: stored.checked })}
      </span>
      {lineage.length > 0 ? <EarlierChains lineage={lineage} total={Math.max(lineageTotal, lineage.length)} /> : null}
    </div>
  )
})

function EarlierChains({ lineage, total }: { lineage: AuditChainStatus['lineage']; total: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const operators = useSim((s) => s.operators)
  const nameOf = (actorId: string | null): string => {
    if (actorId === null) return t('securityAudit.live.chain.commandLine')
    return operators.find((operator) => operator.id === actorId)?.displayName ?? actorId
  }
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" className="sa-chain-earlier" data-testid="chain-earlier" data-count={total}>
        <History className="size-4" aria-hidden="true" />
        {t('securityAudit.live.chain.earlier', { count: total })}
      </Button>
      <Popover.Content placement="top" offset={8} className="w-[420px] max-w-[calc(100vw-24px)]">
        <Popover.Dialog aria-label={t('securityAudit.live.chain.earlierTitle')} data-testid="chain-earlier-list">
          <Popover.Heading className="sa-chain-earlier-heading">{t('securityAudit.live.chain.earlierTitle')}</Popover.Heading>
          <p className="sa-muted sa-chain-earlier-hint">{t('securityAudit.live.chain.earlierHint')}</p>
          <ol className="sa-chain-earlier-list" aria-label={t('securityAudit.live.chain.earlierListLabel')}>
            {lineage.map((entry) => (
              <li
                key={`${entry.epoch}-${entry.resetAt}-${entry.head}`}
                className="sa-chain-earlier-item"
                data-testid="chain-earlier-entry"
                data-epoch={entry.epoch}
              >
                <span className="sa-chain-earlier-main">
                  {t('securityAudit.live.chain.entry', { epoch: entry.epoch, rows: entry.rows, head: `${shortHash(entry.head, 12)}…` })}
                </span>
                <span className="sa-muted">
                  {t('securityAudit.live.chain.resetLine', {
                    reason: t(`securityAudit.live.chain.reason.${entry.reason}`),
                    time: formatDate(entry.resetAt, DATE_PATTERNS.dateTime),
                    operator: nameOf(entry.actorId),
                    scenario: t(`system.demo.scenarios.${entry.scenario}`),
                  })}
                </span>
              </li>
            ))}
          </ol>
          {total > lineage.length ? (
            <p className="sa-muted" data-testid="chain-earlier-shown">
              {t('securityAudit.live.chain.earlierShown', { shown: lineage.length, total })}
            </p>
          ) : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
