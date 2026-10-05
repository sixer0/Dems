/**
 * Settings → App Preferences → "Core link source": a change across the LIVE boundary (backend task
 * W82; 04_client_integration_spec §3.3, §9.5; AC-C-31; finding CPM1-2 of gateway_check/09).
 *
 * | Step | What happens |
 * |---|---|
 * | 1 Confirm | Only when the change crosses the LIVE boundary: a HeroUI Native `Dialog` with the shared sentence of the web console (`common.coreMode.switch*`). SIMULATED ↔ HEARTBEAT stays instant, as before |
 * | 2 Sign out | The Core action `signOut('USER')` of the CURRENT data source, through `settle`: the simulator signs out at once; the Core server is asked (operation 5) and the switch waits for its answer, so the Core session is closed on the server, not dropped here (CPM1-2). The confirm button is busy from the press, shows the kit's spinner late, and the dialog holds until the answer (LB-1, S3-1) |
 * | 3 Store | `setCoreLinkSource(next)` (the runtime's merge write), in `done`: it runs whatever the sign-out's outcome, because a Live sign-out always ends the session here (decision D80) |
 * | 4 Rebuild | The runtime unmounts the current data source and mounts the other one (`SimRuntimeProvider`); the root navigator falls back to `/`, and the boot router picks `/pair` or `/login` (§9.4). Nothing here navigates |
 *
 * Why the Core action and not the contract's `auth.signOut`: the contract returns nothing, so the
 * switch could not wait for the Core's answer. The auth layer's sign-out calls the very same
 * action (`auth/live-auth-provider.tsx` `signOut`, `auth/auth-provider.tsx` `signOut`); what it
 * adds is an in-memory notice for the Login screen, which the rebuild of step 4 drops anyway.
 *
 * Not here (W100, with the web's): when the link is down the Live sign-out ends the session here
 * only and the Core is owed it; the mobile app keeps no owed sign-out across the switch, so that
 * Core session stays open until its idle expiry (CPM1-2 residual, D124 ruling 3).
 */
import { settle, useCoreActions } from '@dems/shared/live';
import { Button, Dialog } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { palette, spacing } from '@dems/shared/tokens';
import {
  PendingSpinner,
  busyState,
  reportRuntimeIssue,
  setCoreLinkSource,
  useCoreErrorPresenter,
  useCoreLink,
  useCoreLinkSourceSetting,
  usePendingPress,
  type CoreLinkSource,
} from '@/runtime';
import { crossesLiveBoundary, dataModeOf } from './settings-model';

export interface CoreLinkSwitch {
  /** The stored source: the selected segment. */
  readonly source: CoreLinkSource;
  /** The source the open dialog would switch to; `null` while no dialog is open. */
  readonly target: CoreLinkSource | null;
  /** From the confirm press until the sign-out settled. */
  readonly busy: boolean;
  /** Busy for `LIVE_PENDING_REVEAL_MS` or longer: the spinner shows in the confirm button. */
  readonly pending: boolean;
  /** A segment was chosen: instant inside one data mode, else the dialog opens. */
  request(next: CoreLinkSource): void;
  confirm(): void;
  /** Closes the dialog (the dialog offers it only while no sign-out is out). */
  cancel(): void;
}

export function useCoreLinkSwitch(): CoreLinkSwitch {
  const core = useCoreLinkSourceSetting();
  const actions = useCoreActions();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const press = usePendingPress();
  const [target, setTarget] = useState<CoreLinkSource | null>(null);
  const { source } = core;

  const request = (next: CoreLinkSource): void => {
    if (!crossesLiveBoundary(source, next)) {
      core.setSource(next);
      return;
    }
    setTarget(next);
  };

  const confirm = (): void => {
    if (target === null) return;
    const next = target;
    const context = { from: source, to: next };
    press.run((release) => {
      settle(() => actions.signOut('USER'), {
        fail: (error) => {
          // A Live sign-out ends the session here in every case (D80); a rejection is rare (a stopped
          // source). It is shown and logged, and the switch still happens: nobody stays signed in.
          if (live && presentCoreError(error)) {
            reportRuntimeIssue('warn', 'settings.coreLink.signOut', error, context);
            return;
          }
          reportRuntimeIssue('error', 'settings.coreLink.signOut', error, context);
        },
        done: () => {
          release();
          setTarget(null);
          reportRuntimeIssue('info', 'settings.coreLink.switch', 'The Core link source changed across the LIVE boundary after a sign-out', context);
          setCoreLinkSource(next);
        },
      });
    });
  };

  // Not reachable while the sign-out is out: the dialog ignores a dismissal and disables Cancel then.
  const cancel = (): void => setTarget(null);

  return { source, target, busy: press.busy, pending: press.pending, request, confirm, cancel };
}

export interface CoreModeDialogProps {
  /** The source the dialog switches to; `null`: closed. */
  target: CoreLinkSource | null;
  busy: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The confirmation of §3.3 step 1. The kit portals dialog content above the runtime, so it gets
 * plain values and callbacks only (step 79 finding). While the sign-out is out the dialog holds:
 * Cancel is disabled and a dismissal is ignored (S3-1, LB-6).
 */
export function CoreModeDialog({ target, busy, pending, onConfirm, onCancel }: CoreModeDialogProps) {
  const { t } = useTranslation();
  const mode = dataModeOf(target ?? 'SIMULATED');
  return (
    <Dialog isOpen={target !== null} onOpenChange={(open) => (open || busy ? undefined : onCancel())}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="settings-core-mode-dialog" style={styles.dialog}>
          <Dialog.Title>{t(`common.coreMode.switchTitle.${mode}`)}</Dialog.Title>
          <Dialog.Description>{t('common.coreMode.switchBody')}</Dialog.Description>
          <View style={styles.buttons}>
            <Button variant="outline" onPress={onCancel} testID="settings-core-mode-cancel" {...(busy ? { isDisabled: true } : {})}>
              <Button.Label>{t('common.actions.cancel')}</Button.Label>
            </Button>
            {/* A second press while busy sends nothing: the pending press ignores it (`usePendingPress`). */}
            <Button variant="primary" onPress={onConfirm} testID="settings-core-mode-confirm" {...busyState(busy)}>
              {pending ? <PendingSpinner color={palette.black} testID="settings-core-mode-confirm-spinner" /> : null}
              <Button.Label>{t(`common.coreMode.switchConfirm.${mode}`)}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  // Tablets: a readable column instead of a full-width dialog (the Pair screen's dialog does the same).
  dialog: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[3] },
});
