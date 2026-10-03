import { useEffect, useRef, useState } from 'react'
import { Button, Chip, Spinner, toast } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, CircleDashed, CircleX, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatUtcOffset } from '@dems/shared/realtime'
import { useSim, useSimActions, type ChainVerifyResult } from '@dems/shared/sim'
import { TextScramble } from '@/components/ui/text-scramble'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, useStaggerVariants } from './choreography'
import { logSessionMonitorError } from './log'
import { selectIntegrity, shortHash, type CheckStatus } from './model'
import { Panel } from './panel'

/** M-C-21: the Spinner holds this long before the recomputed value resolves (literal). */
const VERIFY_SPIN_MS = 700
/** M-PG-SM data moment: the verification sweep band travels down the rows in 800 ms. */
const SWEEP_MS = 800
const SCRAMBLE_CHARS = '0123456789abcdef'

const STATUS_ICON = {
  pass: CircleCheck,
  warn: TriangleAlert,
  fail: CircleX,
  idle: CircleDashed,
} as const

type VerifyState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; result: ChainVerifyResult; runs: number }

/**
 * N: EVIDENCE INTEGRITY (01_specs §14.5.2 N; research/04 §3.2 N; M-C-21; M-PG-SM t = 200).
 * Four read-only checks (Encryption AES-256, Hash chain SHA-256, Secure timestamp, Storage write
 * verified), each pass / warn / fail / standby from the simulator's security, audit chain, time
 * and storage slices. The checks draw one by one 80 ms apart. Every new audit row sends a 1 px
 * gold band down the rows (synced to T's insertion). "Re-verify" recomputes the audit hash chain:
 * Spinner, then the chain head resolves with TextScramble and a PASS chip pops (`bouncy`), or a
 * red FAIL chip with one glow pulse (no shake, P7).
 */
export function IntegrityPanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const actions = useSimActions()
  const integrity = useSim(selectIntegrity)
  const container = useStaggerVariants(PANEL_BEAT_MS.N, 80)
  const [verify, setVerify] = useState<VerifyState>({ phase: 'idle' })
  const runs = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  // One sweep per new audit row (R9 coalescing: rows closer than the sweep restart it).
  const [sweep, setSweep] = useState({ total: integrity.auditTotal, key: 0 })
  if (sweep.total !== integrity.auditTotal) {
    setSweep({ total: integrity.auditTotal, key: integrity.auditTotal > sweep.total ? sweep.key + 1 : sweep.key })
  }

  const reverify = () => {
    if (verify.phase === 'running') return
    setVerify({ phase: 'running' })
    timer.current = setTimeout(() => {
      try {
        const result = actions.verifyAuditChain()
        runs.current += 1
        setVerify({ phase: 'done', result, runs: runs.current })
      } catch (error) {
        logSessionMonitorError('IntegrityPanel.reverify', error)
        setVerify({ phase: 'idle' })
        toast.danger(t('session.integrity.verifyFailed'))
      }
    }, m.reduced ? 0 : VERIFY_SPIN_MS)
  }

  const offset = formatUtcOffset()
  const checks: { id: string; status: CheckStatus; label: string; value: string }[] = [
    {
      id: 'encryption',
      status: integrity.encryption,
      label: t('session.integrity.encryption.label'),
      value: t('session.integrity.encryption.value'),
    },
    {
      id: 'hashChain',
      status: integrity.hashChain,
      label: t('session.integrity.hashChain.label'),
      value: integrity.hashChain === 'fail' ? t('session.integrity.hashChainBroken') : t('session.integrity.hashChain.value'),
    },
    {
      id: 'timestamp',
      status: integrity.timestamp,
      label: t('session.integrity.timestamp.label'),
      value: t('session.integrity.timestamp.value', { source: integrity.timeSource, offset }),
    },
    {
      id: 'storageWrite',
      status: integrity.storageWrite,
      label: t('session.integrity.storageWrite.label'),
      value: integrity.storageWrite === 'idle' ? t('session.integrity.storageWrite.idle') : t('session.integrity.storageWrite.value'),
    },
  ]

  const head = shortHash(integrity.chainHead, 12)
  const result = verify.phase === 'done' ? verify.result : null

  return (
    <Panel id="N" icon={ShieldCheck} title={t('session.integrity.title')} className="sm-area-integrity" bodyClassName="sm-integrity-body">
      <div className="sm-integrity-rows">
        <motion.ul className="sm-checks" variants={container} data-testid="sm-integrity-checks">
          {checks.map((check) => {
            const Icon = STATUS_ICON[check.status]
            return (
              <motion.li key={check.id} className="sm-check" data-check={check.id} data-status={check.status} variants={m.variants.row}>
                <Icon className="sm-check-icon" aria-hidden="true" strokeWidth={2} />
                <span className="sm-check-label">{check.label}</span>
                <span className="sm-check-value" title={check.value}>
                  {check.value}
                </span>
                <span className="sr-only">{t(`session.integrity.checkStatus.${check.status}`)}</span>
              </motion.li>
            )
          })}
        </motion.ul>
        {sweep.key > 0 && m.flags.flashes ? (
          <motion.span
            key={sweep.key}
            className="sm-sweep"
            aria-hidden="true"
            data-testid="sm-integrity-sweep"
            initial={{ y: '-10%', opacity: 0 }}
            animate={{ y: '1000%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: m.seconds(SWEEP_MS), ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null}
      </div>

      <div className="sm-chain-row">
        <span className="sm-chain-label">{t('session.integrity.chainHead')}</span>
        <TextScramble
          as="span"
          className="sm-chain-hash"
          characterSet={SCRAMBLE_CHARS}
          duration={0.8}
          trigger={verify.phase === 'done'}
          key={verify.phase === 'done' ? `run-${verify.runs}` : 'head'}
        >
          {head}
        </TextScramble>
        <AnimatePresence mode="popLayout" initial={false}>
          {verify.phase === 'running' ? (
            <motion.span key="spin" className="sm-chain-status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Spinner size="sm" color="current" aria-label={t('session.integrity.verifying')} />
            </motion.span>
          ) : result ? (
            <motion.span
              key={`result-${verify.phase === 'done' ? verify.runs : 0}`}
              className="sm-chain-status"
              initial={m.flags.flashes ? { scale: 0.6, opacity: 0 } : { opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={m.transitions.completion}
              data-testid="sm-chain-result"
              data-result={result.ok ? 'PASS' : 'FAIL'}
            >
              <Chip color={result.ok ? 'success' : 'danger'} variant="soft" size="sm" className={cn('font-mono font-semibold', !result.ok && 'border border-danger')}>
                <Chip.Label>
                  {result.ok
                    ? t('session.integrity.verifiedRows', { count: result.checked })
                    : t('session.integrity.brokenAt', { index: result.index })}
                </Chip.Label>
              </Chip>
            </motion.span>
          ) : null}
        </AnimatePresence>
        <Button
          size="sm"
          variant="ghost"
          className="sm-chain-button"
          onPress={reverify}
          isDisabled={verify.phase === 'running'}
          data-testid="sm-reverify"
        >
          {verify.phase === 'running' ? t('session.integrity.verifying') : t('session.integrity.reverify')}
        </Button>
      </div>
    </Panel>
  )
}
