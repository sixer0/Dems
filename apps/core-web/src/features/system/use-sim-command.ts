import { useCallback } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions, type SettleHandlers } from '@dems/shared/live'
import { SimTransitionError } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl, type PendingControl } from '@/lib/pending-control'
import { logSystemError } from './log'

export interface CommandOptions {
  /** Structured-log source, e.g. `DemoPanel.inject`. */
  source: string
  /** Friendly text when the Core refuses the transition (an active session, a running update). */
  transitionMessage?: string
  /** IDs and enums only (no personal data). */
  context?: Record<string, unknown>
  /** With a `control` shared by several buttons: names the pressed one (`control.key`), so only it shows the spinner. */
  key?: string
}

/** One command, or several that are sent one after the other (D-4): each step calls one action. */
export type Command<T> = (() => T | PromiseLike<T>) | readonly (() => unknown)[]

/**
 * The page's command wrapper (B-10 of backend task 04_client_integration_spec §8.3; plan row W76).
 * `run(command, options, onDone?, control?)`:
 *
 * - `command` calls the action; a list of steps is sent in order through nested `settle` calls, the
 *   next one inside the `ok` of the one before (D-4), and stops at the first failure.
 * - `onDone(result)` runs in `ok` (CL-25): before `run` returns in Simulated mode, when the Core
 *   answered (and the store holds the effect, CL-16) in Live mode. Callers that did
 *   `if (!done) return` put the rest of their work there.
 * - `control` (`usePendingControl()` of the pressed control) makes the press busy at once and its
 *   spinner late (LB-1); a second press while the command is out sends nothing (`run` returns false).
 * - A failure goes to the shared refusal presenter FIRST (§6.2: the denied toast naming the role, the
 *   outage and limit sentences, `DEMO_DISABLED`), then the page keeps its two branches:
 *   `SimTransitionError` → the caller's friendly warning; anything else → the generic danger toast.
 *   Both write one record to the page's own log.
 *
 * Returns whether the command was sent.
 */
export type CommandRunner = <T>(command: Command<T>, options: CommandOptions, onDone?: (result: T) => void, control?: PendingControl) => boolean

/** Runs `steps` one after the other: the next inside the `ok` of the one before (D-4). */
function settleInOrder(steps: readonly (() => unknown)[], handlers: SettleHandlers<true>): void {
  const next = (index: number): void => {
    if (index >= steps.length) {
      try {
        handlers.ok?.(true)
      } finally {
        handlers.done?.()
      }
      return
    }
    settle(steps[index] as () => unknown, {
      ok: () => next(index + 1),
      fail: (error) => {
        try {
          handlers.fail(error)
        } finally {
          handlers.done?.()
        }
      },
    })
  }
  next(0)
}

export function useSimCommand(): CommandRunner {
  const { t } = useTranslation()
  const presentCoreError = useCoreErrorPresenter()
  return useCallback(
    <T,>(command: Command<T>, options: CommandOptions, onDone?: (result: T) => void, control?: PendingControl): boolean => {
      const fail = (error: unknown): void => {
        // §6.2, rule 2 of the page rows: the presenter words a refusal, an outage or a limit the same on every page.
        if (presentCoreError(error) !== null) return
        if (error instanceof SimTransitionError) {
          toast.warning(options.transitionMessage ?? t('system.errors.generic'))
          logSystemError(options.source, error, { ...options.context, from: error.from, event: error.event }, 'warn')
          return
        }
        toast.danger(t('system.errors.generic'))
        logSystemError(options.source, error, options.context)
      }
      const start = (release?: () => void): void => {
        const done = release === undefined ? {} : { done: release }
        if (typeof command === 'function') {
          settle(command, { ok: (result) => onDone?.(result), fail, ...done })
        } else {
          settleInOrder(command as readonly (() => unknown)[], { ok: () => onDone?.(true as T), fail, ...done })
        }
      }
      if (control) return control.run((release) => start(release), options.key)
      start()
      return true
    },
    [t, presentCoreError],
  )
}

export interface DiagnosticsStarter extends Pick<PendingControl, 'busy' | 'pending' | 'ref'> {
  /**
   * Starts a diagnostics run (or rejoins the one in progress); `onStarted` runs when the Core
   * accepted it (A10: the modal opens in `ok`). Returns whether a request was sent. `busy`,
   * `pending` and `ref` are the pressed control's pending state (LB-1): `ref` goes on the kit
   * `Button` that starts the run.
   */
  readonly start: (onStarted?: () => void) => boolean
}

/** A10 (§8.2): `runDiagnostics` through the wrapper; the caller passes what happens on the 202. */
export function useStartDiagnostics(): DiagnosticsStarter {
  const actions = useCoreActions()
  const run = useSimCommand()
  const control = usePendingControl()
  const { t } = useTranslation()
  const start = useCallback(
    (onStarted?: () => void) =>
      run(() => actions.runDiagnostics(), { source: 'Diagnostics.start', transitionMessage: t('system.diagnostics.failedToStart') }, () => onStarted?.(), control),
    [actions, run, t, control],
  )
  const { busy, pending, ref } = control
  return { start, busy, pending, ref }
}
