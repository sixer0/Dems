import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Chip, Spinner, Tag, TagGroup, toast } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Link2, Link2Off, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { useSim, useSimInstance, type ChainVerifyResult } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { useRouteEnterDelay } from '@/components/shell'
import { TextScramble } from '@/components/ui/text-scramble'
import { GlowLayer, useMotionPolicy } from '@/motion'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { cn } from '@/lib/utils'
import { useWebLive } from '@/runtime'
import { useAuditLog } from './audit-context'
import { CoreChainLines, type CoreChainCheck } from './chain-core-lines'
import { CHAIN_LINK_STAGGER_MS, CONTENT_BEAT_MS, PANEL_BEAT_MS } from './choreography'
import { logSecurityAudit } from './log'
import { shortHash, STRIP_SIZE, stripBlocks, type ChainReport } from './model'
import { Panel } from './panel'
import { CATEGORY_TONE, toneClass } from './tones'

/** M-C-21: Verify shows a Spinner before the hashes resolve. */
const VERIFY_SPINNER_MS = 480
/** M-C-21: the head hash scrambles for 800 ms over `0-9a-f`. */
const SCRAMBLE_SECONDS = 0.8
/** Blocks mounted within this window after the panel mounts take the enter stagger. */
const ENTER_WINDOW_MS = 1500

export interface ChainPanelProps {
  chain: ChainReport
  /** "Show in log": scroll the audit table to this entry. */
  onShowEntry: (seq: number) => void
  className?: string
}

/**
 * Hash-chain strip (01_specs §14.5.7: Card, TagGroup/Tag, Alert; EVT-30; SYS-012; M-C-21).
 *
 * - The last 12 audit entries as linked blocks (entry number and short hash). Selecting a block
 *   inspects it; "Show in log" scrolls the audit table to it.
 * - Links light up in sequence on enter (opacity 0.3 → 1, 80 ms apart). The chain head breathes
 *   (`glowBreath`, the page's one ambient loop, §9.4).
 * - A break (AUDIT_TAMPER, EVT-30; AC-55) turns the broken block red with a slow red breath held
 *   until the alert is acknowledged (P7, R8), and slides in the discontinuity Alert.
 * - "Verify chain" runs the simulator's `verifyAuditChain()`: Spinner, then the head hash
 *   scrambles to the recomputed value and a PASS/FAIL chip pops (bouncy, one glow; no shake).
 *
 * Live mode (plan row W75; 04_client_integration_spec §8.2 A9, §8.3 B-5, §8.4 C-6; AC-C-109):
 * - A9: the request leaves when the Spinner's time is over, as the simulator's check did (so
 *   Simulated mode is identical; decision D154 DN-4, D165), through `settle`; the Spinner stays until
 *   the Core answered (LB-2). The chip is the check over the Core's audit VIEW; under it the panel
 *   adds the stored-chain line and, when the Core discarded chains, "Earlier chains: n" with the
 *   read-only list (`./chain-core-lines`). A refusal or an outage goes to the presenter first.
 * - C-6: the time stamp is the Live clock (`clock.now` of the source), as in Simulated mode.
 * - B-5: Acknowledge runs `acknowledgeAlert` through the one pending control (busy at once, spinner
 *   late); the button leaves when the Core's delta marks the alert acknowledged.
 */
export const ChainPanel = memo(function ChainPanel({ chain, onShowEntry, className }: ChainPanelProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const actions = useCoreActions()
  const sim = useSimInstance()
  const live = useWebLive()
  const presentCoreError = useCoreErrorPresenter()
  // The busy mark goes on the pressed button through `ref` (08a §15); destructured, as Session New does.
  const { run: runAcknowledge, pending: acknowledgePending, ref: acknowledgeRef } = usePendingControl()
  const routeDelay = useRouteEnterDelay()
  const audit = useAuditLog()
  const tamperAlertId = useSim((s) => s.alerts.find((alert) => alert.active && alert.kind === 'AUDIT_TAMPER')?.id ?? null)
  const tamperAcknowledged = useSim(
    (s) => s.alerts.find((alert) => alert.active && alert.kind === 'AUDIT_TAMPER')?.acknowledged ?? false,
  )
  const blocks = useMemo(() => stripBlocks(audit.rows, chain, STRIP_SIZE), [audit.rows, chain])
  const headSeq = audit.rows[audit.rows.length - 1]?.seq ?? null

  const [pickedSeq, setPickedSeq] = useState<number | null>(null)
  const selectedSeq =
    pickedSeq !== null && blocks.some((block) => block.row.seq === pickedSeq) ? pickedSeq : (chain.breakSeq ?? headSeq)
  const selected = blocks.find((block) => block.row.seq === selectedSeq) ?? blocks[blocks.length - 1] ?? null

  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState<(ChainVerifyResult & { at: number; core: CoreChainCheck | null }) | null>(null)
  const [verifyCount, setVerifyCount] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  // Keep the newest block (the head) in view when the strip scrolls sideways (narrow widths).
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const strip = stripRef.current
    if (strip && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = strip.scrollWidth
  }, [headSeq])

  // Blocks present during the first 1.5 s take the enter stagger; later blocks (live) light at once.
  const [inEnterWindow, setInEnterWindow] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setInEnterWindow(false), ENTER_WINDOW_MS * m.timeScale)
    return () => clearTimeout(id)
  }, [m.timeScale])
  const enterStart = routeDelay + PANEL_BEAT_MS.chain + CONTENT_BEAT_MS

  const verify = () => {
    if (verifying) return
    setVerifying(true)
    timer.current = setTimeout(() => {
      timer.current = null
      settle(() => actions.verifyAuditChain(), {
        ok: (result) => {
          // Live: the Core's `stored` and `lineage` of this same answer, kept on the Live handle (§2.5).
          const status = live?.auditChain ?? null
          const core: CoreChainCheck | null =
            live === null || status === null ? null : { stored: status.stored, lineage: status.lineage, lineageTotal: status.lineageTotal }
          setVerified({ ...result, at: sim.store.getState().clock.now, core })
          setVerifyCount((count) => count + 1)
        },
        fail: (error) => {
          if (presentCoreError(error) !== null) return
          logSecurityAudit('error', 'ChainPanel.verify', error, { rows: audit.rows.length })
          toast.danger(t(live === null ? 'common.errors.generic' : 'securityAudit.live.chain.verifyFailed'))
        },
        done: () => setVerifying(false),
      })
    }, m.reduced ? 0 : m.seconds(VERIFY_SPINNER_MS) * 1000)
  }

  const acknowledge = () => {
    if (!tamperAlertId) return
    const alertId = tamperAlertId
    runAcknowledge((release) =>
      settle(() => actions.acknowledgeAlert(alertId), {
        ok: () => {
          toast.info(t('securityAudit.chain.acknowledged'))
        },
        fail: (error) => {
          if (presentCoreError(error) !== null) return
          logSecurityAudit('error', 'ChainPanel.acknowledge', error, { alertId })
          toast.danger(t('common.errors.generic'))
        },
        done: release,
      }),
    )
  }

  const statusChip = chain.ok ? (
    <Chip size="sm" variant="soft" {...toneChipProps('success')}>
      <Link2 className="size-3.5" aria-hidden="true" />
      {t('securityAudit.chain.checked', { count: chain.checked })}
    </Chip>
  ) : (
    <Chip size="sm" variant="soft" {...toneChipProps('danger')}>
      <Link2Off className="size-3.5" aria-hidden="true" />
      {t('securityAudit.chain.brokenAt', { seq: chain.breakSeq ?? 0 })}
    </Chip>
  )

  const verifiedOk = verified?.ok ?? null

  return (
    <Panel
      id="chain"
      icon={Link2}
      title={t('securityAudit.chain.title')}
      subtitle={t('securityAudit.chain.blocks', { count: STRIP_SIZE })}
      className={className}
      action={
        <div
          className="sa-chain-status"
          data-testid="chain-status"
          data-chain-status={chain.ok ? 'PASS' : 'FAIL'}
          data-break-index={chain.breakIndex ?? ''}
          data-break-seq={chain.breakSeq ?? ''}
          aria-live="polite"
        >
          {statusChip}
          <Button size="sm" variant="outline" onPress={verify} isDisabled={verifying} data-testid="verify-chain">
            {verifying ? <Spinner size="sm" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
            {verifying ? t('securityAudit.chain.verifying') : t('securityAudit.chain.verify')}
          </Button>
        </div>
      }
    >
      <AnimatePresence initial={false}>
        {!chain.ok ? (
          <motion.div
            key="discontinuity"
            initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: m.transitions.exit }}
            transition={{ duration: m.seconds(240), ease: [0.2, 0, 0, 1] }}
          >
            <Alert status="danger" data-testid="chain-discontinuity">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('securityAudit.chain.discontinuityTitle')}</Alert.Title>
                <Alert.Description>
                  {t('securityAudit.chain.discontinuityBody', { index: chain.breakSeq ?? 0 })}{' '}
                  {chain.reason ? `(${t(`securityAudit.chain.reason.${chain.reason}`)}, ${chain.breakId ?? ''})` : null}
                </Alert.Description>
              </Alert.Content>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onPress={() => chain.breakSeq !== null && onShowEntry(chain.breakSeq)}>
                  {t('securityAudit.chain.jump')}
                </Button>
                {tamperAlertId && !tamperAcknowledged ? (
                  <Button
                    ref={acknowledgeRef}
                    size="sm"
                    variant="danger-soft"
                    onPress={acknowledge}
                    isPending={acknowledgePending}
                    data-pending={acknowledgePending ? 'true' : undefined}
                    data-testid="chain-acknowledge"
                  >
                    {acknowledgePending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
                    {t('securityAudit.chain.acknowledge')}
                  </Button>
                ) : null}
              </div>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="sa-strip" ref={stripRef}>
        <TagGroup
          aria-label={t('securityAudit.chain.stripLabel')}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={selected ? [String(selected.row.seq)] : []}
          onSelectionChange={(keys) => {
            const [first] = keys === 'all' ? [] : [...keys]
            if (first !== undefined) setPickedSeq(Number(first))
          }}
        >
          <TagGroup.List className="sa-strip-list" data-testid="chain-strip">
            {blocks.map((block, position) => {
              const isHead = block.row.seq === headSeq
              const broken = block.status === 'BROKEN'
              const linkBroken = broken || blocks[position - 1]?.status === 'BROKEN'
              const delayMs = inEnterWindow ? enterStart + position * CHAIN_LINK_STAGGER_MS : 0
              return (
                <Tag
                  key={block.row.seq}
                  id={String(block.row.seq)}
                  textValue={t('securityAudit.chain.block', { index: block.row.seq, hash: shortHash(block.row.hash, 6) })}
                  className={cn('sa-block', toneClass(CATEGORY_TONE[block.row.category]))}
                  data-chain={block.status}
                  data-link={linkBroken ? 'broken' : 'ok'}
                  data-seq={block.row.seq}
                  data-gap-before={block.gapBefore || undefined}
                >
                  {isHead && chain.ok ? (
                    <GlowLayer level={1} breathe loopLabel="chain-head" loopGroup="chain-head" />
                  ) : null}
                  {broken ? (
                    <GlowLayer level={2} tone="danger" breathe={!tamperAcknowledged} loopLabel="chain-break" loopGroup="chain-break" />
                  ) : null}
                  <motion.span
                    className="relative flex w-full flex-col items-start gap-0.5"
                    initial={m.reduced ? false : { opacity: 0.3 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: m.seconds(240), delay: m.seconds(delayMs) }}
                  >
                    <span className="sa-block-seq">
                      #{block.row.seq}
                      {isHead ? <span className="sa-block-tag"> {t('securityAudit.chain.head')}</span> : null}
                      {block.row.seq === 1 && audit.dropped === 0 ? (
                        <span className="sa-block-tag"> {t('securityAudit.chain.genesis')}</span>
                      ) : null}
                    </span>
                    <span className="sa-block-hash">{shortHash(block.row.hash, 6)}</span>
                    <span className="sa-block-cat" aria-hidden="true" />
                  </motion.span>
                </Tag>
              )
            })}
          </TagGroup.List>
        </TagGroup>
      </div>

      {selected ? (
        <div className="sa-block-inspect" data-testid="chain-inspect">
          <span>
            <strong>{t('securityAudit.chain.entry', { seq: selected.row.seq })}</strong>{' '}
            <span className="sa-mono">{selected.row.id}</span> • {t(`common.auditType.${selected.row.type}`)} •{' '}
            <span className="sa-mono">{formatDate(selected.row.at, DATE_PATTERNS.dateTime)}</span>
          </span>
          <span>
            {t('securityAudit.chain.prevHash')} <span className="sa-mono">{shortHash(selected.row.prevHash, 12)}…</span>
          </span>
          <span className={selected.status === 'BROKEN' ? 'sa-tone-danger' : undefined}>
            {t('securityAudit.chain.hash')}{' '}
            <span className="sa-mono" style={selected.status === 'BROKEN' ? { color: 'var(--sa-tone-text)' } : undefined}>
              {shortHash(selected.row.hash, 12)}…
            </span>
          </span>
          <Button size="sm" variant="ghost" onPress={() => onShowEntry(selected.row.seq)}>
            {t('securityAudit.chain.jump')}
          </Button>
        </div>
      ) : null}

      <div className="sa-table-footer">
        <span className="sa-head-hash">
          {t('securityAudit.chain.headHash')}{' '}
          <TextScramble
            as="span"
            className="sa-mono sa-soft"
            characterSet="0123456789abcdef"
            duration={SCRAMBLE_SECONDS}
            trigger={verifyCount > 0}
            key={verifyCount}
          >
            {shortHash(chain.head, 16)}
          </TextScramble>
        </span>
        {verified ? (
          <span className="flex items-center gap-2" data-testid="chain-verified" data-verified={verifiedOk ? 'PASS' : 'FAIL'}>
            <motion.span
              key={verifyCount}
              className="relative inline-flex"
              initial={m.reduced ? false : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={m.transitions.completion}
            >
              <Chip size="sm" variant="soft" {...toneChipProps(verifiedOk ? 'success' : 'danger')}>
                {verifiedOk ? t('securityAudit.chain.pass') : t('securityAudit.chain.fail')}
              </Chip>
            </motion.span>
            <span>
              {t('securityAudit.chain.verifiedAt', {
                count: verified.checked,
                time: formatDate(verified.at, DATE_PATTERNS.time),
              })}
            </span>
          </span>
        ) : null}
      </div>
      {verified?.core ? <CoreChainLines check={verified.core} /> : null}
    </Panel>
  )
})
