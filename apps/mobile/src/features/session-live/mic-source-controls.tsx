/**
 * The mic switch under the MIC cards of the Session Live monitor (task 3 M5, blueprint row 73; ux
 * spec §3 flow 2, register MB-03; operation 81; specs R-3; OD-09, OD-11).
 *
 * | ux §3 | Here |
 * |---|---|
 * | §3.2 step 2, §3.4 G4 | "Switch to MIC n": ALWAYS drawn while a session records; outside "allowed" it is disabled and the line under it says why — "Checking your permissions…", the read-only sentence of a lost Core link, the role sentence, or the holder sentence. Never hidden for a role, never enabled on an unknown role (E-16, P-13) |
 * | §3.5 `409 INVALID_STATE` | without a recording the toggle is not drawn and its reason is (hidden-with-reason) |
 * | §3.2 step 2, §3.6 | a press opens the confirmation (`Dialog`); the confirm press plays one haptic |
 * | §3.2 step 3 | while the command is out the confirm is busy at once and shows the kit's `Spinner` late (LB-1); "Cancel" is disabled and the dialog cannot be dismissed: the answer decides |
 * | §3.2 step 4 | nothing is flipped here: the cards read the store |
 * | §3.2 steps 5-7, §3.5 | a refusal: the Live presenter's toast (denied, offline, limit), or one sentence that stays under the toggle until the next press (conflict, not recording, not the open session) |
 * | §3.2 step 8, G5 | `MIC_SILENT`: an `Alert` of status warning that names the silent input. "Switch to standby" is offered when that input is the active one, behind the same gate, and opens the SAME confirmation. Nothing is sent by the warning (OD-11) |
 *
 * `MicSourcePanel` is the presentation (plain props; the test beds and the gallery draw it without a
 * store); `MicSourceControls` connects it to `useMicSource` / `useMicSwitch`.
 *
 * Fabric (CF-M1, D208): only plain views, no Reanimated view and no `exiting` animation, inside one
 * container that is never flattened, so the warning's coming and going moves no sibling of the
 * monitor.
 *
 * NOT built here: ux §3.2 step 9 "Input interrupted — verifying" (no slice member carries the 2 s
 * debounce state); the development-source badge (PE-125-05; `sourceClass` is not in the shared
 * registry, row 139).
 */
import { Alert, Button, Dialog } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { MIC_SILENCE_DBFS, MIC_SILENCE_DURATION_MS } from '@dems/shared/api';
import { fontFamily, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { triggerHaptic } from '@/motion';
import { PendingSpinner, busyState } from '@/runtime';
import { useMicInputName } from '@/features/capture-selector/development-source-badge';
import { type MicSwitchBlock, type SwitchRefusal } from './mic-source-model';
import { useMicSource, useMicSwitch } from './use-mic-source';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The one sentence that says why the toggle is not offered; null when it is. */
export function micSwitchBlockText(block: MicSwitchBlock | null, t: Translate): string | null {
  if (block === null) return null;
  switch (block.kind) {
    case 'CHECKING':
      return t('mobile.rbac.checking');
    case 'WAITING':
      return t('features.session-live.banner.readOnly');
    case 'NOT_RECORDING':
      return t('session.audioSource.block.NOT_RECORDING');
    case 'ROLE': {
      const [first, second] = block.roles;
      // Row 68's sentence for a permission two roles hold; the shared single-role sentence otherwise.
      if (first !== undefined && second !== undefined) {
        return t('features.capture-selector.selector.gate.denied', { first: t(`common.roles.${first}`), second: t(`common.roles.${second}`) });
      }
      return t('common.rbac.requiresRole', { role: first === undefined ? '' : t(`common.roles.${first}`) });
    }
    case 'HOLDER':
      return t('session.audioSource.block.HOLDER');
  }
}

export interface MicSourcePanelProps {
  recording: boolean;
  /** Task 4 row 170: `null` = absent (no line holds the role and the session states none). */
  activeInputId: string | null;
  standbyInputId: string | null;
  block: MicSwitchBlock | null;
  silentInputId: string | null;
  /** JA2-06: the input of an active `MIC_NO_SIGNAL` fault; drawn when no silence warning is. */
  noSignalInputId?: string | null;
  confirmOpen: boolean;
  busy: boolean;
  pending: boolean;
  refusal: Exclude<SwitchRefusal, 'OTHER'> | null;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** The toggle, its reason, the silence warning and the confirmation; presentation only. */
export function MicSourcePanel({
  recording,
  activeInputId,
  standbyInputId,
  block,
  silentInputId,
  noSignalInputId = null,
  confirmOpen,
  busy,
  pending,
  refusal,
  onAsk,
  onCancel,
  onConfirm,
}: MicSourcePanelProps) {
  const { t } = useTranslation();
  const reason = micSwitchBlockText(block, t);
  const offered = block === null;
  // Integration pass D2: named from the id the Core sent ("MIC 1", "Microphone 3", "Core Mac's microphone").
  const micName = useMicInputName();
  // Task 4 row 170 (site M4): a switch needs BOTH members of the pair. With one absent the toggle is not drawn
  // (there is no input to name on it) and one sentence says why; the two warnings keep naming their input.
  const pairComplete = activeInputId !== null && standbyInputId !== null;
  const standbyName = standbyInputId === null ? '' : micName(standbyInputId);
  const activeName = activeInputId === null ? '' : micName(activeInputId);
  const switchLabel = t('session.audioSource.switchTo', { mic: standbyName });

  return (
    <View testID="monitor-mic-source" collapsable={false} style={styles.root}>
      {silentInputId !== null ? (
        <Alert status="warning" testID="monitor-mic-silent" accessibilityLiveRegion="polite">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('session.audioSource.silent.title', { mic: micName(silentInputId) })}</Alert.Title>
            <Alert.Description>
              {t('session.audioSource.silent.body', { dbfs: MIC_SILENCE_DBFS, seconds: MIC_SILENCE_DURATION_MS / 1000 })}
            </Alert.Description>
            {/* G5: offered only when the silent input is the one inside AUDIO-01; it opens the confirmation, it sends nothing. */}
            {silentInputId === activeInputId && pairComplete ? (
              <View style={styles.alertActions}>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={!offered || busy}
                  onPress={onAsk}
                  testID="monitor-mic-silent-switch"
                  {...(reason === null ? {} : { accessibilityHint: reason })}
                >
                  <Button.Label>{t('session.audioSource.silent.action')}</Button.Label>
                </Button>
              </View>
            ) : null}
          </Alert.Content>
        </Alert>
      ) : null}

      {/* Round two (JA2-06): a microphone the Core reports WITHOUT A SIGNAL is said here, by name - on the monitor it
          showed only in its small meter. When it is the active input the same confirmed switch is offered (nothing
          is sent by the warning, OD-11). */}
      {silentInputId === null && noSignalInputId !== null ? (
        <Alert status={noSignalInputId === activeInputId ? 'danger' : 'warning'} testID="monitor-mic-no-signal" accessibilityLiveRegion="polite">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('features.session-live.micNoSignal.title', { mic: micName(noSignalInputId) })}</Alert.Title>
            <Alert.Description>{t(noSignalInputId === activeInputId ? 'features.session-live.micNoSignal.activeBody' : 'features.session-live.micNoSignal.standbyBody')}</Alert.Description>
            {noSignalInputId === activeInputId && pairComplete ? (
              <View style={styles.alertActions}>
                <Button variant="outline" size="sm" isDisabled={!offered || busy} onPress={onAsk} testID="monitor-mic-no-signal-switch" {...(reason === null ? {} : { accessibilityHint: reason })}>
                  <Button.Label>{switchLabel}</Button.Label>
                </Button>
              </View>
            ) : null}
          </Alert.Content>
        </Alert>
      ) : null}

      {/* G4. ux §3.5: without a recording the toggle is not drawn; its reason (below) is. */}
      {recording && block?.kind !== 'NOT_RECORDING' && !pairComplete ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.reason} testID="monitor-mic-switch-no-pair" accessibilityLiveRegion="polite">
          {t('features.session-live.micPairIncomplete')}
        </Text>
      ) : null}
      {recording && block?.kind !== 'NOT_RECORDING' && pairComplete ? (
        <Button
          variant="outline"
          size="sm"
          isDisabled={!offered}
          onPress={onAsk}
          testID="monitor-mic-switch"
          accessibilityLabel={switchLabel}
          {...(reason === null ? {} : { accessibilityHint: reason })}
          {...busyState(busy, !offered)}
        >
          {pending ? <PendingSpinner color={palette.gold} testID="monitor-mic-switch-spinner" /> : null}
          <Button.Label>{switchLabel}</Button.Label>
        </Button>
      ) : null}
      {reason !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.reason} testID="monitor-mic-switch-reason" accessibilityLiveRegion="polite">
          {reason}
        </Text>
      ) : null}
      {refusal !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.refusal} testID="monitor-mic-switch-refusal" accessibilityLiveRegion="polite">
          {t(`session.audioSource.refusal.${refusal}`)}
        </Text>
      ) : null}

      <Dialog isOpen={confirmOpen} onOpenChange={(open) => (open || busy ? undefined : onCancel())}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content testID="monitor-mic-switch-dialog">
            <Dialog.Title>{t('session.audioSource.confirm.title', { mic: standbyName })}</Dialog.Title>
            <Dialog.Description>{t('session.audioSource.confirm.body', { from: activeName })}</Dialog.Description>
            <View style={styles.dialogActions}>
              <Button testID="monitor-mic-switch-cancel" variant="outline" onPress={onCancel} {...(busy ? { isDisabled: true } : {})}>
                <Button.Label>{t('common.actions.cancel')}</Button.Label>
              </Button>
              <Button testID="monitor-mic-switch-confirm" variant="primary" onPress={onConfirm} accessibilityLabel={t('session.audioSource.confirm.action')} {...busyState(busy)}>
                {pending ? <PendingSpinner color={palette.black} testID="monitor-mic-switch-confirm-spinner" /> : null}
                <Button.Label>{t('session.audioSource.confirm.action')}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}

/** The mic switch of the monitor, connected to the store and to operation 81. Mount it once. */
export function MicSourceControls() {
  const view = useMicSource();
  const control = useMicSwitch(view);

  // One Warning haptic when a silence warning appears (never tied to the 20 Hz data).
  const wasSilent = useRef(view.silentInputId !== null || view.noSignalInputId !== null);
  useEffect(() => {
    const silent = view.silentInputId !== null || view.noSignalInputId !== null;
    if (silent && !wasSilent.current) triggerHaptic('gateWarn');
    wasSilent.current = silent;
  }, [view.silentInputId, view.noSignalInputId]);

  return (
    <MicSourcePanel
      recording={view.recording}
      activeInputId={view.activeInputId}
      standbyInputId={view.standbyInputId}
      block={view.block}
      silentInputId={view.silentInputId}
      noSignalInputId={view.noSignalInputId}
      confirmOpen={control.confirmOpen}
      busy={control.busy}
      pending={control.pending}
      refusal={control.refusal}
      onAsk={control.ask}
      onCancel={control.cancel}
      onConfirm={control.confirm}
    />
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1] },
  alertActions: { flexDirection: 'row', marginTop: spacing[1] },
  dialogActions: { gap: spacing[1], marginTop: spacing[3] },
  reason: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size + 1,
    lineHeight: typography.caption.lineHeight + 2,
    color: palette.gray,
  },
  refusal: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size + 1,
    lineHeight: typography.caption.lineHeight + 2,
    color: statusText.warning,
  },
});
