import { useCallback } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { SimPermissionError, SimTransitionError, useSimActions, type Permission } from '@dems/shared/sim'
import { logSystemError } from './log'
import { requiredRoleFor } from './model'

export interface CommandOptions {
  /** Structured-log source, e.g. `DemoPanel.inject`. */
  source: string
  /** Friendly text when the sim refuses the transition (an active session, a running update). */
  transitionMessage?: string
  /** IDs and enums only (no personal data). */
  context?: Record<string, unknown>
}

/**
 * Runs one simulator command with the frontend error rules (layers 1–2): a refusal never reaches
 * the user as raw English sim text. `SimPermissionError` → "Requires the … role" toast (S20);
 * `SimTransitionError` → the caller's friendly warning; anything else → a generic danger toast plus
 * a structured dev-console record. Returns the command's result, or `undefined` when it threw.
 */
export function useSimCommand() {
  const { t } = useTranslation()
  return useCallback(
    <T,>(command: () => T, options: CommandOptions): T | undefined => {
      try {
        return command()
      } catch (error) {
        if (error instanceof SimPermissionError) {
          const role = requiredRoleFor(error.permission as Permission)
          toast.danger(t('common.rbac.deniedTitle'), {
            description: t('common.rbac.requiresRole', { role: role ? t(`common.roles.${role}`) : '' }),
          })
          logSystemError(options.source, error, { ...options.context, permission: error.permission }, 'warn')
        } else if (error instanceof SimTransitionError) {
          toast.warning(options.transitionMessage ?? t('system.errors.generic'))
          logSystemError(options.source, error, { ...options.context, from: error.from, event: error.event }, 'warn')
        } else {
          toast.danger(t('system.errors.generic'))
          logSystemError(options.source, error, options.context)
        }
        return undefined
      }
    },
    [t],
  )
}

/** Starts a diagnostics run (or rejoins the one in progress). Returns false when the sim refused. */
export function useStartDiagnostics(): () => boolean {
  const actions = useSimActions()
  const run = useSimCommand()
  const { t } = useTranslation()
  return useCallback(() => {
    const id = run(() => actions.runDiagnostics(), { source: 'Diagnostics.start', transitionMessage: t('system.diagnostics.failedToStart') })
    return id !== undefined
  }, [actions, run, t])
}
