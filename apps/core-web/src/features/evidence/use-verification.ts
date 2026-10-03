/**
 * Real integrity re-verification (D50, D67 (b)(c); 01_specs §14.5.3 "Verify"; 03_motion_spec M-C-21;
 * review 40 R2/M3).
 *
 * - **Package-backed items**: `verifyDemoPackage(pkg, load, { trust: demoVerificationTrust(), onCheck })`
 *   recomputes every track SHA-256 and the manifest digest with `@noble/hashes`, re-walks the audit
 *   chain, re-hashes the export zip (EV 0004), and checks the Ed25519 signature, certificate and export
 *   signature with WebCrypto where the browser supports it; otherwise those checks come from step 93's
 *   precomputation and carry `source: 'precomputed'` (shown "DEMO - precomputed", P13). The verdict
 *   shown is ALWAYS the package verdict (never the simulator's synthetic one, R2/M3).
 * - **Items without a package** (created live, or rejected by the M4 join guard): the simulator's
 *   `verify(id)`, shown labelled SIMULATED.
 * - **Choreography (M-C-21).** Checks resolve one by one: pending → running (Spinner) → PASS / FAIL.
 *   The computation is real and fast; results are revealed at most one per `VERIFY_STEP_MS` so the
 *   sequence reads (time-scaled; immediate under reduced motion).
 * - **Audit.** When the run ends, `recordPackageVerification` writes the custody entry and audit row
 *   through the sim (the step-54 alignment and `recordPackageVerification` keep them consistent).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import {
  checkOrder,
  demoVerificationTrust,
  verifyDemoPackage,
  type DemoCheckId,
  type DemoCheckResult,
  type DemoVerificationReport,
} from '@dems/shared/demo-data'
import { useSimInstance, type EvidenceVerifyResult } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { useMotionPolicy } from '@/motion'
import { useEvidenceAssets } from './demo-assets'
import { logEvidence, logEvidenceError, newCorrelationId } from './log'
import type { EvidenceRow } from './model'
import { recordPackageVerification, simTamperedTrack, withSimulatedTamper } from './sim-adapter'

/** M-C-21 pacing: one result revealed per `fast` (160 ms), time-scaled. */
export const VERIFY_STEP_MS = tokens.duration.fast

export type CheckPhase = 'pending' | 'running' | 'pass' | 'fail'
export type CheckSource = 'computed' | 'precomputed' | 'simulated'

export interface VerifyCheckView {
  id: DemoCheckId
  phase: CheckPhase
  expected: string | null
  actual: string | null
  source: CheckSource | null
  detail?: string
}

export type VerifyPhase = 'idle' | 'running' | 'done' | 'error'

export interface VerifyState {
  phase: VerifyPhase
  mode: 'package' | 'simulated'
  checks: VerifyCheckView[]
  verdict: 'PASS' | 'FAIL' | null
  /** The report label ("DEMO - recomputed", "… (some checks precomputed)") or null (simulated). */
  label: string | null
  report: DemoVerificationReport | null
  /** Increments per run (animations key on it). */
  runId: number
}

const SIM_CHECK_ORDER: DemoCheckId[] = ['track:VIDEO-01', 'track:VIDEO-02', 'track:AUDIO-01', 'track:AUDIO-02', 'manifest', 'signature']

function orderFor(row: EvidenceRow | null): DemoCheckId[] {
  return row?.pkg ? checkOrder(row.pkg) : SIM_CHECK_ORDER
}

function pendingChecks(row: EvidenceRow | null): VerifyCheckView[] {
  return orderFor(row).map((id) => ({ id, phase: 'pending', expected: null, actual: null, source: null }))
}

function initialState(row: EvidenceRow | null): VerifyState {
  return {
    phase: 'idle',
    mode: row?.pkg ? 'package' : 'simulated',
    checks: pendingChecks(row),
    verdict: null,
    label: null,
    report: null,
    runId: 0,
  }
}

function viewOf(result: DemoCheckResult): VerifyCheckView {
  return {
    id: result.id,
    phase: result.ok ? 'pass' : 'fail',
    expected: result.expected,
    actual: result.actual,
    source: result.source,
    ...(result.detail ? { detail: result.detail } : {}),
  }
}

/** The simulator's result as check rows (items without a package). */
export function simulatedChecks(result: EvidenceVerifyResult): VerifyCheckView[] {
  const byTrack = new Map(result.tracks.map((track) => [`track:${track.trackId}`, track]))
  return SIM_CHECK_ORDER.map((id) => {
    const track = byTrack.get(id)
    if (track) {
      return { id, phase: track.ok ? 'pass' : 'fail', expected: track.expected, actual: track.actual, source: 'simulated' }
    }
    const ok = id === 'manifest' ? result.manifestOk : result.signatureOk
    return { id, phase: ok ? 'pass' : 'fail', expected: 'VALID', actual: ok ? 'VALID' : 'INVALID', source: 'simulated' }
  })
}

export interface EvidenceVerification {
  state: VerifyState
  /** Starts a run (ignored while one is running). Resolves when the run is revealed. */
  run: () => Promise<VerifyState | null>
}

export function useEvidenceVerification(row: EvidenceRow | null, options: { record?: boolean; toasts?: boolean } = {}): EvidenceVerification {
  const { record = true, toasts = true } = options
  const { t } = useTranslation()
  const sim = useSimInstance()
  const assets = useEvidenceAssets()
  const m = useMotionPolicy()
  const [state, setState] = useState<VerifyState>(() => initialState(row))
  const rowRef = useRef(row)
  const running = useRef(false)
  const generation = useRef(0)
  const runCounter = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // A different item (or its package join changing) resets the view.
  const identity = `${row?.id ?? ''}|${row?.pkg?.evidenceSuffix ?? ''}`
  const [trackedIdentity, setTrackedIdentity] = useState(identity)
  if (trackedIdentity !== identity) {
    setTrackedIdentity(identity)
    setState(initialState(row))
  }
  useEffect(() => {
    rowRef.current = row
  }, [row])

  useEffect(
    () => () => {
      // Unmount (or StrictMode's simulated unmount): drop the running run's results and free the slot.
      generation.current += 1
      running.current = false
      for (const timer of timers.current) clearTimeout(timer)
      timers.current = []
    },
    [],
  )

  const pace = m.reduced ? 0 : VERIFY_STEP_MS * m.timeScale

  const run = useCallback(async (): Promise<VerifyState | null> => {
    const target = rowRef.current
    if (!target || running.current) return null
    running.current = true
    const myGeneration = ++generation.current
    const correlationId = newCorrelationId('verify')
    const order = orderFor(target)
    const alive = () => generation.current === myGeneration

    runCounter.current += 1
    const runId = runCounter.current
    setState({
      ...initialState(target),
      phase: 'running',
      runId,
      checks: order.map((id, index) => ({ id, phase: index === 0 ? 'running' : 'pending', expected: null, actual: null, source: null })),
    })

    // Reveal queue (M-C-21 pacing).
    const queue: VerifyCheckView[] = []
    let revealed = 0
    let draining: Promise<void> = Promise.resolve()
    const reveal = (view: VerifyCheckView) => {
      queue.push(view)
      draining = draining.then(
        () =>
          new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              if (alive()) {
                const index = revealed
                revealed += 1
                setState((previous) => ({
                  ...previous,
                  checks: previous.checks.map((check, position) => {
                    if (position === index) return view
                    if (position === index + 1 && check.phase === 'pending') return { ...check, phase: 'running' }
                    return check
                  }),
                }))
              }
              resolve()
            }, pace)
            timers.current.push(timer)
          }),
      )
    }

    try {
      let final: VerifyState
      if (target.pkg) {
        const pkg = target.pkg
        const load = withSimulatedTamper(assets.load, pkg, simTamperedTrack(target.item))
        const report = await verifyDemoPackage(pkg, load, {
          trust: demoVerificationTrust(),
          ...(assets.subtle !== undefined ? { subtle: assets.subtle } : {}),
          onCheck: (check) => reveal(viewOf(check)),
        })
        await draining
        if (!alive()) return null
        final = {
          phase: 'done',
          mode: 'package',
          checks: report.checks.map(viewOf),
          verdict: report.result,
          label: report.label,
          report,
          runId,
        }
        if (record) {
          try {
            recordPackageVerification(sim, target.id, report)
          } catch (error) {
            logEvidence('warn', 'verify.record', error, { evidenceId: target.id, correlationId })
          }
        }
      } else {
        const result = sim.actions.verify(target.id)
        const views = simulatedChecks(result)
        for (const view of views) reveal(view)
        await draining
        if (!alive()) return null
        final = {
          phase: 'done',
          mode: 'simulated',
          checks: views,
          verdict: result.ok ? 'PASS' : 'FAIL',
          label: null,
          report: null,
          runId,
        }
      }
      setState(final)
      if (toasts) {
        const failed = final.checks.filter((check) => check.phase === 'fail').map((check) => check.id.replace('track:', ''))
        if (final.verdict === 'PASS') toast.success(t('evidence.verify.toastPass', { id: target.id }))
        else toast.danger(t('evidence.verify.toastFail', { id: target.id, checks: failed.join(', ') }))
      }
      return final
    } catch (error) {
      if (!alive()) return null
      logEvidenceError('verify.run', error, { evidenceId: target.id, suffix: target.suffix, correlationId })
      const failedState: VerifyState = { ...initialState(target), phase: 'error', runId }
      setState(failedState)
      if (toasts) toast.danger(t('evidence.verify.errorToast'))
      return failedState
    } finally {
      if (alive()) running.current = false
    }
  }, [assets, pace, record, sim, t, toasts])

  return { state, run }
}
