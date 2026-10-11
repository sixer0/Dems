import { useNavigation, useRouter, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Button, Dialog } from 'heroui-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { palette, spacing } from '@dems/shared/tokens';
import { PendingSpinner, busyState } from '@/runtime';
import { reportNavigationIssue } from './log';

/**
 * Back-guard infrastructure (04_mobile_specs §3.6; 05 M-03 "usePreventRemove hook in
 * src/navigation/"). The session screens own their dialogs and decide when the guard is on; this
 * hook owns the mechanics:
 *
 * - `mode: 'confirm'` (the monitor during RECORDING; Start Session steps 2 and 3): hardware back,
 *   the back gesture and `router.back()` are held and `isPrompting` turns true, so the screen opens
 *   its Dialog. `stay()` drops the attempt; `leave()` performs the held action; `leaveTo(href)`
 *   goes somewhere else instead (the monitor's "Go to Home").
 * - `mode: 'block'` (FINALIZING): the attempt is dropped and `onBlocked` runs (the screen shows
 *   the "Finalizing — please wait" toast).
 *
 * Leaving never touches the session (04 §3.6: "Back never stops a recording"). Only the screen's
 * own End Session or cancel action changes the session state.
 */
export type BackGuardMode = 'confirm' | 'block';

export interface BackGuardOptions {
  /** Whether back is guarded now (for example `session.state === 'RECORDING'`). */
  enabled: boolean;
  mode?: BackGuardMode;
  /** `block` mode: called for every blocked attempt. */
  onBlocked?: () => void;
}

export interface BackGuard {
  /** A back attempt is being held and waits for `stay`, `leave` or `leaveTo`. */
  readonly isPrompting: boolean;
  stay(): void;
  leave(): void;
  leaveTo(href: Href): void;
}

type NavigationAction = Parameters<Parameters<typeof usePreventRemove>[1]>[0]['data']['action'];

type Exit = { readonly kind: 'action'; readonly action: NavigationAction } | { readonly kind: 'href'; readonly href: Href };

export function useBackGuard({ enabled, mode = 'confirm', onBlocked }: BackGuardOptions): BackGuard {
  const navigation = useNavigation();
  const router = useRouter();
  const [held, setHeld] = useState<NavigationAction | null>(null);
  const [exit, setExit] = useState<Exit | null>(null);

  // While leaving, the guard is off, so the held action (or the new route) passes through.
  usePreventRemove(enabled && exit === null, ({ data }) => {
    if (mode === 'block') {
      onBlocked?.();
      return;
    }
    setHeld(data.action);
  });

  // Runs after the commit that switched the guard off (usePreventRemove's own effect runs first).
  useEffect(() => {
    if (exit === null) return;
    try {
      if (exit.kind === 'action') navigation.dispatch(exit.action);
      else router.dismissTo(exit.href);
    } catch (error) {
      // The screen stays; the guard is already off, so the next Back leaves without a prompt.
      reportNavigationIssue('error', 'navigation.backGuard.leave', error, { kind: exit.kind });
    }
  }, [exit, navigation, router]);

  // The guard turning off (for example the recording ended) releases a held attempt. Adjusted
  // during render (React's "reset state when a prop changes"), not in an effect.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) setHeld(null);
  }

  const stay = useCallback(() => setHeld(null), []);
  const leave = useCallback(() => {
    if (held !== null) setExit({ kind: 'action', action: held });
    setHeld(null);
  }, [held]);
  const leaveTo = useCallback((href: Href) => {
    setHeld(null);
    setExit({ kind: 'href', href });
  }, []);

  return { isPrompting: held !== null && enabled, stay, leave, leaveTo };
}

export type BackGuardDialogVariant = 'monitor' | 'flow';

export interface BackGuardDialogProps {
  guard: BackGuard;
  /**
   * `monitor`: "Recording continues on the Core. Leave the monitor?" with Stay on monitor
   * (primary) and Go to Home (outline) → `leaveTo('/home')`.
   * `flow`: "Cancel this session?" with Keep session (primary) and Cancel session (danger) →
   * `onConfirm` (the screen calls the simulator's `cancel()` and then `guard.leave()`).
   */
  variant: BackGuardDialogVariant;
  /** `flow` variant: what "Cancel session" does before leaving. */
  onConfirm?: () => void;
  /**
   * The leave action's command is out, from the PRESS until it settled (Live mode, LB-1; row M1, W67
   * F-6 and DN-4): the leave button carries `accessibilityState.busy` and a further press is ignored
   * (the answer decides). The dialog holds meanwhile (row M1 follow-up F5; S3-1 "keeps its busy state
   * until the settle", B-6 "leaving happens in `ok`", LB-6 "a dialog stays open"): the stay button is
   * disabled and ignored, and the dialog cannot be dismissed. Pass `usePendingPress().busy` of
   * `@/runtime`. Default false: as before.
   */
  busy?: boolean;
  /**
   * The command has been out for `LIVE_PENDING_REVEAL_MS`: the kit's `Spinner` shows inside the leave
   * button, before its label (LB-1: spinner late). Pass `usePendingPress().pending`. When omitted it
   * follows `busy` (the first form of this prop, row M1), so such a caller keeps its behaviour.
   */
  pending?: boolean;
  /**
   * `flow` variant, fix wave M (G70d-03): a third choice, "Go to Home, keep the session open". The session
   * stays open on the Core (nothing is sent) and Home offers "Continue setup". With it the dialog also says
   * what each choice does. Omitted: the dialog is as before.
   */
  onGoHome?: () => void;
}

/** The §3.6 back-guard Dialog (HeroUI Native `Dialog`), with the copy of `mobile.backGuard.*`. */
export function BackGuardDialog({ guard, variant, onConfirm, busy = false, pending = busy, onGoHome }: BackGuardDialogProps) {
  const { t } = useTranslation();
  const monitor = variant === 'monitor';
  return (
    <Dialog isOpen={guard.isPrompting} onOpenChange={(open) => (open || busy ? undefined : guard.stay())}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="back-guard-dialog">
          <Dialog.Title>{t(monitor ? 'mobile.backGuard.leaveMonitor' : 'mobile.backGuard.cancelSession')}</Dialog.Title>
          {!monitor && onGoHome ? <Dialog.Description testID="back-guard-choices">{t('mobile.backGuard.flowChoices')}</Dialog.Description> : null}
          <View style={styles.actions}>
            <Button testID="back-guard-stay" variant="primary" onPress={guard.stay} {...(busy ? { isDisabled: true } : {})}>
              <Button.Label>{t(monitor ? 'mobile.backGuard.stayOnMonitor' : 'mobile.backGuard.keepSession')}</Button.Label>
            </Button>
            {!monitor && onGoHome ? (
              <Button testID="back-guard-home" variant="outline" onPress={() => (busy ? undefined : onGoHome())} {...(busy ? { isDisabled: true } : {})}>
                <Button.Label>{t('mobile.backGuard.goHomeKeepSession')}</Button.Label>
              </Button>
            ) : null}
            <Button
              testID="back-guard-leave"
              variant={monitor ? 'outline' : 'danger'}
              onPress={() => {
                if (busy) return;
                if (monitor) guard.leaveTo('/home');
                else if (onConfirm) onConfirm();
                else guard.leave();
              }}
              accessibilityLabel={t(monitor ? 'mobile.backGuard.goHome' : 'mobile.backGuard.confirmCancel')}
              {...busyState(busy)}
            >
              {pending ? <PendingSpinner color={palette.foreground} testID="back-guard-leave-spinner" /> : null}
              <Button.Label>{t(monitor ? 'mobile.backGuard.goHome' : 'mobile.backGuard.confirmCancel')}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing[1], marginTop: spacing[3] } });
