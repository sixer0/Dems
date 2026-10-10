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
 *
 * **Live mode** (backend task, plan row W69; 04_client_integration_spec §8.2 A6, §8.4 D-1, §14
 * point 7; 01_specs MS-5; AC-C-61). The verdict of record is the Core server's: one call of the
 * `verify` action (operation 41 `verifyEvidence`) through `useCoreActions()` and `settle`, and the
 * chip, the per-check list and the custody entry show its `EvidenceVerifyResult`. No demo control is
 * ever called (no mirror of a tamper, D-1), and nothing is computed into the verdict here.
 * - Waiting (LB-2): the existing Spinner on the first check while the request is out; the answer's
 *   checks are then revealed one per `VERIFY_STEP_MS` with the hash scramble (M-C-21), so the old
 *   pacing is the minimum display time and nothing flashes.
 * - The check over the bundled demo files runs beside it for display only, when the row carries a
 *   package (the detail page gives it one only when the Core's media reference is `DEMO_PACKAGE`,
 *   MS-2) and the caller asks for it (`bundled`). It is labelled "Bundled demo package", writes
 *   nothing, and when its result differs from the Core's the page says so; the Core's verdict
 *   stays the record.
 * - A refusal or an outage goes to the refusal presenter first (rule 2 of the page rows); what it
 *   leaves to the page keeps the existing error state and toast.
 *
 * **Verify v2** (blueprint row 87; evidence package spec §D, §F.3; UX spec flow 5, P-16). An answer
 * with a `files` member is a schema-v2 result (`verify-v2.ts`, the one reader of this app): per
 * camera file the stored bytes, the plaintext and the fragment chain; the transcript hash; the
 * manifest; the signature; and, where the answer carries them, the per-check report, the failed
 * fragment and the transcript state. Rules of the v2 run:
 * - the verdict is the Core's `ok` (`verdictOfAnswer`), never a conjunction made here;
 * - NOTHING is paced: while the request is out the view says it is waiting, and the whole result is
 *   shown in the commit that receives the answer. No client timer reveals, counts or completes
 *   anything, so no progress is drawn that the Core did not report;
 * - a v2 ITEM (`item.files`) never shows the six v1 rows, not even while it waits (`awaitsV2`).
 * A v1 answer (the 14 demo packages, Simulated mode) keeps the paced list above, unchanged.
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
import { CoreMode, settle, useCoreActions, useCoreMode } from '@dems/shared/live'
import { useSimInstance, type EvidenceVerifyResult } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useMotionPolicy } from '@/motion'
import { useEvidenceAssets } from './demo-assets'
import { isCoreSealedItem, isRealItem } from './item-facts'
import { logEvidence, logEvidenceError, newCorrelationId } from './log'
import type { EvidenceRow } from './model'
import { failedTracksOf, recordPackageVerification, simTamperedTrack, withSimulatedTamper } from './sim-adapter'
import { readVerifyV2, v2FailedNames, verdictOfAnswer, type VerifyV2Answer } from './verify-v2'

/** M-C-21 pacing: one result revealed per `fast` (160 ms), time-scaled. */
export const VERIFY_STEP_MS = tokens.duration.fast

export type CheckPhase = 'pending' | 'running' | 'pass' | 'fail'
/** `core`: the Core server's verdict of record (Live mode). */
export type CheckSource = 'computed' | 'precomputed' | 'simulated' | 'core'

export interface VerifyCheckView {
  id: DemoCheckId
  phase: CheckPhase
  expected: string | null
  actual: string | null
  source: CheckSource | null
  detail?: string
}

export type VerifyPhase = 'idle' | 'running' | 'done' | 'error'

/** Live mode: the check over the bundled demo package, shown beside the Core's verdict (§14 point 7). */
export interface BundledCheck {
  phase: 'running' | 'done' | 'error'
  verdict: 'PASS' | 'FAIL' | null
  /** The report label ("DEMO - recomputed", …) once done. */
  label: string | null
}

export interface VerifyState {
  phase: VerifyPhase
  /** `core`: Live mode, the Core server's verdict. */
  mode: 'package' | 'simulated' | 'core'
  checks: VerifyCheckView[]
  verdict: 'PASS' | 'FAIL' | null
  /** The report label ("DEMO - recomputed", "… (some checks precomputed)") or null (simulated, core). */
  label: string | null
  report: DemoVerificationReport | null
  /** Increments per run (animations key on it). */
  runId: number
  /** Live mode only: the bundled package's check (display only); `null` when none runs. */
  bundled: BundledCheck | null
  /** Live mode only: the bundled package's result differs from the Core's verdict. */
  differs: boolean
  /** The schema-v2 result of this run (row 87); null (or absent) for a v1 answer and before an answer. */
  v2?: VerifyV2Answer | null | undefined
  /** The item is schema v2: the view waits for (and then draws) a v2 result, never the v1 rows. Absent = false. */
  awaitsV2?: boolean | undefined
}

/**
 * Whether the item is a schema-v2 item: it carries sealed FILES (the legacy v1 items carry none), or
 * its own members say it was sealed on this Core (wave H C2, G89-04: a REAL item whose replicated
 * copy names no `files[]` is still a v2 package - `isCoreSealedItem` holds the rule and its evidence).
 */
export function isV2Item(row: EvidenceRow | null): boolean {
  if (row === null) return false
  return (Array.isArray(row.item.files) && row.item.files.length > 0) || isCoreSealedItem(row.item) || isRealItem(row.item)
}

const SIM_CHECK_ORDER: DemoCheckId[] = ['track:VIDEO-01', 'track:VIDEO-02', 'track:AUDIO-01', 'track:AUDIO-02', 'manifest', 'signature']

/** The checks shown: the package's in Simulated mode, the Core's six (four tracks, manifest, signature) in Live mode. */
function orderFor(row: EvidenceRow | null, live: boolean): DemoCheckId[] {
  return !live && row?.pkg ? checkOrder(row.pkg) : SIM_CHECK_ORDER
}

function pendingChecks(row: EvidenceRow | null, live: boolean): VerifyCheckView[] {
  // A v2 item has no v1 rows: its result is the Core's v2 answer, drawn when it arrives.
  if (live && isV2Item(row)) return []
  return orderFor(row, live).map((id) => ({ id, phase: 'pending', expected: null, actual: null, source: null }))
}

function initialState(row: EvidenceRow | null, live: boolean): VerifyState {
  return {
    phase: 'idle',
    mode: live ? 'core' : row?.pkg ? 'package' : 'simulated',
    checks: pendingChecks(row, live),
    verdict: null,
    label: null,
    report: null,
    runId: 0,
    bundled: null,
    differs: false,
    v2: null,
    awaitsV2: live && isV2Item(row),
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

/** A verify result as check rows: the simulator's (`simulated`) or the Core server's (`core`). */
export function resultChecks(result: EvidenceVerifyResult, source: 'simulated' | 'core'): VerifyCheckView[] {
  const byTrack = new Map(result.tracks.map((track) => [`track:${track.trackId}`, track]))
  return SIM_CHECK_ORDER.map((id) => {
    const track = byTrack.get(id)
    if (track) {
      return { id, phase: track.ok ? 'pass' : 'fail', expected: track.expected, actual: track.actual, source }
    }
    const ok = id === 'manifest' ? result.manifestOk : result.signatureOk
    return { id, phase: ok ? 'pass' : 'fail', expected: 'VALID', actual: ok ? 'VALID' : 'INVALID', source }
  })
}

/** The simulator's result as check rows (items without a package). */
export function simulatedChecks(result: EvidenceVerifyResult): VerifyCheckView[] {
  return resultChecks(result, 'simulated')
}

/**
 * Whether the bundled package's report differs from the Core's verdict: another verdict, or other
 * failed tracks (§14 point 7). The checks only the package has (certificate, audit extract, export
 * package) are not compared: the Core's verdict has no such check.
 */
export function bundledDiffers(report: Pick<DemoVerificationReport, 'failed' | 'result'>, result: EvidenceVerifyResult): boolean {
  if (report.result !== (result.ok ? 'PASS' : 'FAIL')) return true
  const bundledFailed = new Set(failedTracksOf(report))
  const coreFailed = result.tracks.filter((track) => !track.ok).map((track) => track.trackId)
  return bundledFailed.size !== coreFailed.length || coreFailed.some((trackId) => !bundledFailed.has(trackId))
}

/** What `verify` answered, or what it threw or rejected with. */
type VerifyAnswer = { ok: true; result: EvidenceVerifyResult } | { ok: false; error: unknown }

/** What the bundled package's check gave (Live mode). */
type BundledOutcome = { ok: true; report: DemoVerificationReport } | { ok: false; error: unknown }

/** The bundled line of the state for an outcome, compared with the Core's result. */
function bundledView(outcome: BundledOutcome, core: EvidenceVerifyResult, v2: VerifyV2Answer | null = null): Pick<VerifyState, 'bundled' | 'differs'> {
  if (!outcome.ok) return { bundled: { phase: 'error', verdict: null, label: null }, differs: false }
  return {
    bundled: { phase: 'done', verdict: outcome.report.result, label: outcome.report.label },
    // A v2 answer has no v1 tracks to compare: only the two verdicts are.
    differs: v2 !== null ? outcome.report.result !== v2.verdict : bundledDiffers(outcome.report, core),
  }
}

export interface EvidenceVerification {
  state: VerifyState
  /** Starts a run (ignored while one is running). Resolves when the run is revealed. */
  run: () => Promise<VerifyState | null>
}

export interface EvidenceVerificationOptions {
  /** Simulated mode: record the package verification in the simulator. Default true. */
  record?: boolean
  toasts?: boolean
  /** Live mode: also run the bundled-package check for display, when the row carries a package. Default true. */
  bundled?: boolean
}

export function useEvidenceVerification(row: EvidenceRow | null, options: EvidenceVerificationOptions = {}): EvidenceVerification {
  const { record = true, toasts = true, bundled = true } = options
  const { t } = useTranslation()
  const sim = useSimInstance()
  const actions = useCoreActions()
  const live = useCoreMode() === CoreMode.LIVE
  const presentCoreError = useCoreErrorPresenter()
  const assets = useEvidenceAssets()
  const m = useMotionPolicy()
  const [state, setState] = useState<VerifyState>(() => initialState(row, live))
  const rowRef = useRef(row)
  const running = useRef(false)
  const generation = useRef(0)
  const runCounter = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // A different item (or its package join, or the data mode, changing) resets the view.
  const identity = `${live ? 'core' : 'sim'}|${row?.id ?? ''}|${row?.pkg?.evidenceSuffix ?? ''}`
  const [trackedIdentity, setTrackedIdentity] = useState(identity)
  if (trackedIdentity !== identity) {
    setTrackedIdentity(identity)
    setState(initialState(row, live))
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
    const order = orderFor(target, live)
    const alive = () => generation.current === myGeneration

    runCounter.current += 1
    const runId = runCounter.current
    // Live mode: the bundled package's check starts beside the Core's call (display only).
    // Wave H C2 (G89-09): never beside a v2 item - its package is the Core's, and the bundled one is another package.
    const bundledPkg = live && bundled && !isV2Item(target) ? target.pkg : null
    setState({
      ...initialState(target, live),
      phase: 'running',
      runId,
      checks:
        live && isV2Item(target)
          ? []
          : order.map((id, index) => ({ id, phase: index === 0 ? 'running' : 'pending', expected: null, actual: null, source: null })),
      bundled: bundledPkg ? { phase: 'running', verdict: null, label: null } : null,
    })

    /** One call of `verify` through `settle`: the simulator answers before it returns, a Live source after the Core did. */
    const askVerify = () =>
      new Promise<VerifyAnswer>((resolve) => {
        settle(() => actions.verify(target.id), {
          ok: (result) => resolve({ ok: true, result }),
          fail: (error) => resolve({ ok: false, error }),
        })
      })
    /** Rule 2: the presenter words a refusal or an outage first; anything it leaves goes to the existing error branch. */
    const refused = (error: unknown): VerifyState => {
      if (presentCoreError(error) === null) throw error
      const failedState: VerifyState = { ...initialState(target, live), phase: 'error', runId }
      setState(failedState)
      return failedState
    }

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
      if (live) {
        // What the bundled check found, and the Core's result once known: the two may settle in either order.
        const box: { outcome: BundledOutcome | null; core: EvidenceVerifyResult | null; v2: VerifyV2Answer | null } = { outcome: null, core: null, v2: null }
        const bundledRun = bundledPkg
          ? verifyDemoPackage(bundledPkg, assets.load, {
              trust: demoVerificationTrust(),
              ...(assets.subtle !== undefined ? { subtle: assets.subtle } : {}),
            }).then(
              (report): BundledOutcome => ({ ok: true, report }),
              (error: unknown): BundledOutcome => ({ ok: false, error }),
            )
          : null
        void bundledRun?.then((outcome) => {
          box.outcome = outcome
          if (!outcome.ok) logEvidence('warn', 'verify.bundled', outcome.error, { evidenceId: target.id, suffix: target.suffix, correlationId })
          const core = box.core
          // Before the Core's verdict is shown, the final state reads `box.outcome` itself.
          if (!alive() || core === null) return
          setState((previous) => (previous.runId === runId ? { ...previous, ...bundledView(outcome, core, box.v2) } : previous))
        })
        const answer = await askVerify()
        if (!alive()) return null
        if (!answer.ok) return refused(answer.error)
        // Row 87: a v2 answer is shown whole, in this commit; nothing of it is paced or counted here.
        const v2 = readVerifyV2(answer.result)
        if (v2 !== null && v2.malformed.length > 0) {
          logEvidence('warn', 'verify.v2.malformed', new Error('The verify answer carries members this client cannot read.'), {
            evidenceId: target.id,
            members: v2.malformed.join(','),
            correlationId,
          })
        }
        const views = v2 !== null ? [] : resultChecks(answer.result, 'core')
        for (const view of views) reveal(view)
        await draining
        if (!alive()) return null
        const coreResult = answer.result
        box.core = coreResult
        box.v2 = v2
        final = {
          phase: 'done',
          mode: 'core',
          checks: views,
          verdict: verdictOfAnswer(coreResult, v2),
          v2,
          awaitsV2: v2 !== null,
          label: null,
          report: null,
          runId,
          ...(bundledRun === null
            ? { bundled: null, differs: false }
            : box.outcome === null
              ? { bundled: { phase: 'running', verdict: null, label: null }, differs: false }
              : bundledView(box.outcome, coreResult, v2)),
        }
      } else if (target.pkg) {
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
          bundled: null,
          differs: false,
          v2: null,
          awaitsV2: false,
        }
        if (record) {
          recordPackageVerification(actions, sim.store.getState(), target.id, report, (error) =>
            logEvidence('warn', 'verify.record', error, { evidenceId: target.id, correlationId }),
          )
        }
      } else {
        const answer = await askVerify()
        if (!alive()) return null
        if (!answer.ok) return refused(answer.error)
        const result = answer.result
        const views = simulatedChecks(result)
        for (const view of views) reveal(view)
        await draining
        if (!alive()) return null
        final = {
          phase: 'done',
          mode: 'simulated',
          checks: views,
          verdict: verdictOfAnswer(result, null),
          label: null,
          report: null,
          runId,
          bundled: null,
          differs: false,
          v2: null,
          awaitsV2: false,
        }
      }
      setState(final)
      if (toasts) {
        const failed =
          final.v2 != null ? v2FailedNames(final.v2, t) : final.checks.filter((check) => check.phase === 'fail').map((check) => check.id.replace('track:', ''))
        if (final.verdict === 'PASS') toast.success(t('evidence.verify.toastPass', { id: target.id }))
        else toast.danger(t('evidence.verify.toastFail', { id: target.id, checks: failed.join(', ') }))
      }
      return final
    } catch (error) {
      if (!alive()) return null
      logEvidenceError('verify.run', error, { evidenceId: target.id, suffix: target.suffix, correlationId })
      const failedState: VerifyState = { ...initialState(target, live), phase: 'error', runId }
      setState(failedState)
      if (toasts) toast.danger(t('evidence.verify.errorToast'))
      return failedState
    } finally {
      if (alive()) running.current = false
    }
  }, [actions, assets, bundled, live, pace, presentCoreError, record, sim, t, toasts])

  return { state, run }
}
