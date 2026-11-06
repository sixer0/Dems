/**
 * The confirm of a microphone move on the selector (audit row 189, M3-07 R1/R2; register S5-S10; decisions
 * D126, D163, D175). Row 188 built the gate (`micMoveGate`, hook `moveAsk` / `confirmMove` / `cancelMove`);
 * this is its dialog, as the web's (row 156, `capture-selector-panel.tsx` `selector-mic-swap-dialog-<channel>`).
 *
 * | `ask.kind` | Title | Text | Confirm | Operation 78 body after the confirm |
 * |---|---|---|---|---|
 * | `SWAP` (the target pair holds a microphone) | S5 `devices.pairs.swapTitle` | S6 `devices.pairs.swapConfirm` | S7 `devices.pairs.swap` | S1 `{ mics: [to-line, from-line] }` |
 * | `MOVE` (the target pair holds none) | S8 `devices.pairs.moveTitle` | S9 `devices.pairs.moveConfirm` | S10 `devices.pairs.move` | S2 `{ unassign: [from], mics: [line] }` |
 *
 * Cancel (the button, the overlay, Android Back) sends nothing. The kit portals the dialog above the
 * simulator's provider, so it reads no store: the ask and the callbacks come in as props.
 */
import { Button, Dialog } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { useSheetBack } from '@/features/devices/use-sheet-presence';
import { PendingSpinner, busyState } from '@/runtime';
import type { MicMoveAsk } from './capture-selector-model';

export interface MicMoveDialogProps {
  /** The move to confirm (`selector.moveAsk`), or null when closed. */
  ask: MicMoveAsk | null;
  /** The confirmed command is out. */
  busy: boolean;
  /** It has been out long enough for the kit's spinner. */
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The S6 / S9 sentence of an ask (exported for the jest pins: the text equals the register verbatim). */
export function micMoveText(ask: MicMoveAsk, t: (key: string, options?: Record<string, unknown>) => string): string {
  return ask.kind === 'SWAP'
    ? t('devices.pairs.swapConfirm', { deviceId: ask.deviceId, to: ask.toPair, other: ask.other, from: ask.fromPair })
    : t('devices.pairs.moveConfirm', { deviceId: ask.deviceId, to: ask.toPair, from: ask.fromPair });
}

export function MicMoveDialog({ ask, busy, pending, onConfirm, onCancel }: MicMoveDialogProps) {
  const cancel = () => {
    if (busy) return;
    onCancel();
  };
  useSheetBack(ask !== null, cancel);
  // The kit animates a dialog in on a closed -> open change it sees (as `DeviceCommandDialog`): the Dialog stays mounted,
  // and the last ask stays drawn while it closes.
  const [shown, setShown] = useState<MicMoveAsk | null>(ask);
  if (ask !== null && ask !== shown) setShown(ask);
  return (
    <Dialog isOpen={ask !== null} onOpenChange={(open) => (open ? undefined : cancel())}>
      {shown === null ? null : <MicMoveContent ask={shown} busy={busy} pending={pending} onConfirm={onConfirm} onCancel={cancel} />}
    </Dialog>
  );
}

function MicMoveContent({ ask, busy, pending, onConfirm, onCancel: cancel }: Omit<MicMoveDialogProps, 'ask'> & { ask: MicMoveAsk }) {
  const { t } = useTranslation();
  // E2 (S62 M3-07): the dialog is named by the TARGET channel, as the web's.
  const channel = ask.to;
  const swap = ask.kind === 'SWAP';
  return (
    <Dialog.Portal>
      <Dialog.Overlay />
      <Dialog.Content testID={`selector-mic-swap-dialog-${channel}`} accessibilityViewIsModal style={styles.dialog}>
        <Dialog.Title>
          {t(swap ? 'devices.pairs.swapTitle' : 'devices.pairs.moveTitle', { from: ask.fromPair, to: ask.toPair })}
        </Dialog.Title>
        <Text maxFontSizeMultiplier={1.2} style={styles.text} testID={`selector-mic-swap-text-${channel}`}>
          {micMoveText(ask, t)}
        </Text>
        <View style={styles.actions}>
          <Button variant="outline" isDisabled={busy} onPress={cancel} testID={`selector-mic-swap-cancel-${channel}`}>
            <Button.Label>{t('common.actions.cancel')}</Button.Label>
          </Button>
          {/* D211 (row 226): a control that spreads the busy state carries its own label, as `DeviceCommandDialog`'s confirm (LB-1). */}
          <Button
            variant="primary"
            onPress={onConfirm}
            testID={`selector-mic-swap-confirm-${channel}`}
            accessibilityLabel={t(swap ? 'devices.pairs.swap' : 'devices.pairs.move')}
            {...busyState(busy)}
          >
            {pending ? <PendingSpinner color={palette.black} testID={`selector-mic-swap-spinner-${channel}`} /> : null}
            <Button.Label>{t(swap ? 'devices.pairs.swap' : 'devices.pairs.move')}</Button.Label>
          </Button>
        </View>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

const styles = StyleSheet.create({
  // Tablets: a readable column instead of a full-width dialog.
  dialog: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  text: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground, marginTop: spacing[1] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[3] },
});
