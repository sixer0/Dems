import { useCallback, useState, type ReactNode } from 'react'
import { AlertDialog, Button, toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { CoreMode } from '@dems/shared/live'
import { useCoreModeControl } from '@/runtime'
import { reportShellError } from './shell-report'

export interface ModeSwitch {
  /** Whether this build offers the choice (MD-4). False: `request` does nothing and no control should be rendered. */
  selectable: boolean
  /** The mode of this page load, or `null` when the router carries no mode (a test without `coreMode`). */
  mode: CoreMode | null
  /** The change was confirmed: the session is being ended and the page is about to load again. */
  switching: boolean
  /** Step 1 of the mode change: opens the confirmation dialog for `next`. */
  request: (next: CoreMode) => void
  /** The dialog. Render it once, anywhere in the component that called the hook. */
  dialog: ReactNode
}

/**
 * THE confirmed mode change of the console (backend task 04_client_integration_spec §3.3, §3.5;
 * MD-4; plan rows W54 and W55; decision D144(1), finding CPW1-1). Step 1 is here: a kit
 * `AlertDialog` (the pattern of `features/session-new/cancel-dialog.tsx`) with the sentence of the
 * specification. Steps 2 to 4 are the runtime's `switchTo`: sign out of the current mode, store
 * the choice, load the page again at `/login`. So a mode change always passes a login screen, and
 * nothing is switched without the operator's confirmation.
 *
 * This is the ONE copy: the Login page's own `useLoginModeSwitch` was deleted by D144(1), and what
 * was truer there moved here — the `switching` state of the returned object and the record
 * discipline of a failure (one fixed sentence plus the class of the error, never its text: CPW1-8).
 *
 * Used by the mode indicator, by the link notice ("Switch to Simulated mode"), by the pages that
 * exist in Live mode only ("Switch to Live mode") and by the Login page's selector. Without a
 * selectable mode (a production build, the packaged build, a router built by a test without
 * `coreMode`) `dialog` is `null`.
 *
 * @param source names the caller in the page's own log, so a failure keeps saying who hit it. The
 * Login page passes `'login.modeSwitch'`; every shell surface keeps `'shell.modeSwitch'`.
 */
export function useModeSwitch(source: string = 'shell.modeSwitch'): ModeSwitch {
  const { t } = useTranslation()
  const control = useCoreModeControl()
  const selectable = control?.selectable === true
  const [target, setTarget] = useState<CoreMode | null>(null)
  const [switching, setSwitching] = useState(false)

  const request = useCallback(
    (next: CoreMode) => {
      if (selectable && control?.mode !== next) setTarget(next)
    },
    [selectable, control],
  )

  const confirm = () => {
    if (control === null || target === null || switching) return
    const failed = () => {
      setSwitching(false)
      setTarget(null)
      toast.danger(t('common.coreMode.switchFailed'))
    }
    setSwitching(true)
    void control.switchTo(target).then(
      (switched) => {
        // True: the page is being loaded again at `/login`; the dialog stays as it is until then.
        if (!switched) failed()
      },
      (error: unknown) => {
        // The runtime's switch resolves in every path it knows; this is for the one it does not.
        // The cause goes by its class, code and status only (CPW1-8): the text of an unknown error
        // is not trusted to be free of input.
        reportShellError(source, error, 'The data mode could not be changed.', { from: control.mode, to: target })
        failed()
      },
    )
  }

  const dialog =
    selectable && target !== null ? (
      <AlertDialog.Backdrop isOpen onOpenChange={(open) => (open || switching ? undefined : setTarget(null))}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog aria-label={t(`common.coreMode.switchTitle.${target}`)} data-testid="mode-switch-dialog">
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>{t(`common.coreMode.switchTitle.${target}`)}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{t('common.coreMode.switchBody')}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="ghost" isDisabled={switching} onPress={() => setTarget(null)} data-testid="mode-switch-cancel">
                {t('common.actions.cancel')}
              </Button>
              <Button variant="primary" isPending={switching} onPress={confirm} data-testid="mode-switch-confirm">
                {t(`common.coreMode.switchConfirm.${target}`)}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    ) : null

  return { selectable, mode: control?.mode ?? null, switching, request, dialog }
}
