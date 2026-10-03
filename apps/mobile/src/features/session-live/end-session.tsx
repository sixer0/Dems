/**
 * S6 End Session (04_mobile_specs §4.5 S6, §3.6; 03_motion_spec M-C-19; S21; D38 Q-M5).
 *
 * The label is "End Session" (one verb pair everywhere, D38; MB 4 reads "Stop Session"): a kit
 * `Button variant="danger" size="lg"`, full width, `Square` icon, white 19 dp Inter Bold label
 * (AA-large on red, 01S §2.7).
 *
 * Hold to confirm (M-C-19): while pressed a fill runs `scaleX 0 → 1` over 1,500 ms (linear); an early
 * release springs it back (`snappy`). Haptics: light at 0 % and 50 %, heavy at 100 % (§7.6). Then
 * the reason `Dialog` opens: a `TextArea` whose trimmed text must reach 5 characters (S21), and a
 * danger "End Session" that calls `stopRecording(reason)`. Route-sync (step 73) then opens
 * `/session/finalizing`.
 *
 * Reduced motion: no fill; the Dialog opens on press. Screen readers: the `activate` action (a
 * TalkBack double-tap) opens the Dialog directly, no hold needed.
 */
import { Button, Description, Dialog, FieldError, Label, TextArea, TextField, useToast } from 'heroui-native';
import { Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { derived, fontFamily, motion as motionTokens, palette, spacing } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media/color';
import { triggerHaptic, useMotionPolicy } from '@/motion';
import { HOLD_HAPTIC_BEATS_MS, HOLD_TO_CONFIRM_MS, STOP_REASON_MAX, STOP_REASON_MIN, checkStopReason } from './session-live.math';

export interface EndSessionProps {
  disabled: boolean;
  /** Calls `stopRecording(reason)`; returns whether the simulator accepted it. */
  onEnd: (reason: string) => boolean;
}

/** The pinned End Session control plus its reason Dialog. */
export function EndSession({ disabled, onEnd }: EndSessionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <EndSessionButton disabled={disabled} dialogOpen={dialogOpen} onConfirmHold={() => setDialogOpen(true)} />
      <EndSessionDialog isOpen={dialogOpen} onOpenChange={setDialogOpen} onEnd={onEnd} />
    </>
  );
}

interface EndSessionButtonProps {
  disabled: boolean;
  dialogOpen: boolean;
  onConfirmHold: () => void;
}

function EndSessionButton({ disabled, dialogOpen, onConfirmHold }: EndSessionButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const policy = useMotionPolicy();
  const reduced = policy === 'reduced';
  const fill = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const midBeat = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useRef(false);

  const clearBeat = () => {
    if (midBeat.current !== null) {
      clearTimeout(midBeat.current);
      midBeat.current = null;
    }
  };
  useEffect(() => clearBeat, []);

  // The fill stays full while the Dialog is open and empties when it closes.
  useEffect(() => {
    if (!dialogOpen && completed.current) {
      completed.current = false;
      fill.set(reduced ? 0 : withSpring(0, motionTokens.spring.snappy));
    }
  }, [dialogOpen, reduced, fill]);

  const open = () => {
    completed.current = true;
    onConfirmHold();
  };

  const onPressIn = () => {
    if (disabled || reduced) return;
    completed.current = false;
    setHolding(true);
    triggerHaptic('holdProgress');
    clearBeat();
    midBeat.current = setTimeout(() => triggerHaptic('holdProgress'), HOLD_HAPTIC_BEATS_MS[1]);
    cancelAnimation(fill);
    fill.set(0);
    fill.set(withTiming(1, { duration: HOLD_TO_CONFIRM_MS, easing: Easing.linear }));
  };

  const onPressOut = () => {
    if (reduced) return;
    setHolding(false);
    clearBeat();
    if (!completed.current) {
      cancelAnimation(fill);
      fill.set(withSpring(0, motionTokens.spring.snappy));
    }
  };

  const onLongPress = () => {
    if (disabled || reduced) return;
    clearBeat();
    triggerHaptic('endSessionHold');
    fill.set(1);
    open();
  };

  const onPress = () => {
    if (disabled) return;
    if (reduced) {
      triggerHaptic('endSessionHold');
      open();
      return;
    }
    // A short tap in full motion: explain the hold instead of ending anything.
    toast.show({ variant: 'default', label: t('session.actions.endSession.holdHint') });
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'activate' && !disabled) open();
  };

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));

  return (
    <View style={styles.buttonWrap}>
      <Button
        testID="monitor-end-session"
        variant="danger"
        size="lg"
        isDisabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onLongPress={onLongPress}
        delayLongPress={HOLD_TO_CONFIRM_MS}
        onPress={onPress}
        accessibilityLabel={t('session.actions.endSession.title')}
        accessibilityHint={t('features.session-live.endSession.holdA11yHint')}
        accessibilityActions={[{ name: 'activate', label: t('session.actions.endSession.title') }]}
        onAccessibilityAction={onAccessibilityAction}
        style={styles.button}
        background={<Animated.View pointerEvents="none" testID="monitor-end-session-fill" style={[styles.fill, fillStyle]} />}
      >
        <Square size={18} color={derived.dangerForeground} fill={derived.dangerForeground} />
        <Text maxFontSizeMultiplier={1.2} style={styles.label}>
          {holding ? t('features.session-live.endSession.holding') : t('session.actions.endSession.title')}
        </Text>
      </Button>
      {!reduced ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.hint}>
          {t('session.actions.endSession.holdHint')}
        </Text>
      ) : null}
    </View>
  );
}

interface EndSessionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEnd: (reason: string) => boolean;
}

/** The mandatory-reason Dialog (S21: at least 5 characters after trimming). */
function EndSessionDialog({ isOpen, onOpenChange, onEnd }: EndSessionDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [ending, setEnding] = useState(false);
  const keyboardHeight = useKeyboardState((s) => (s.isVisible ? s.height : 0));
  const check = checkStopReason(reason);
  const showError = touched && !check.valid;

  const close = () => {
    onOpenChange(false);
    setTouched(false);
    setEnding(false);
  };

  const confirm = () => {
    setTouched(true);
    if (!check.valid || ending) return;
    setEnding(true);
    if (onEnd(check.value)) {
      setReason('');
      close();
    } else {
      setEnding(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => (open ? onOpenChange(true) : close())}>
      <Dialog.Portal style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}>
        <Dialog.Overlay />
        <Dialog.Content testID="monitor-end-dialog" style={styles.dialog}>
          <Dialog.Title>{t('session.actions.endSession.dialogTitle')}</Dialog.Title>
          <Dialog.Description>{t('session.actions.endSession.dialogBody')}</Dialog.Description>
          <View style={styles.field}>
            <TextField isRequired isInvalid={showError}>
              <Label>{t('session.actions.endSession.reasonLabel')}</Label>
              <TextArea
                testID="monitor-end-reason"
                value={reason}
                onChangeText={setReason}
                onBlur={() => setTouched(true)}
                placeholder={t('session.actions.endSession.reasonPlaceholder')}
                maxLength={STOP_REASON_MAX}
                numberOfLines={3}
                style={styles.textArea}
              />
              {showError ? (
                <FieldError testID="monitor-end-reason-error">
                  {t('session.actions.endSession.reasonTooShort', { min: STOP_REASON_MIN })}
                </FieldError>
              ) : (
                <Description testID="monitor-end-reason-count">
                  {t('features.session-live.endSession.reasonCount', { count: check.length, max: STOP_REASON_MAX })}
                </Description>
              )}
            </TextField>
          </View>
          <View style={styles.actions}>
            <Button testID="monitor-end-keep" variant="outline" onPress={close}>
              <Button.Label>{t('session.actions.endSession.keepRecording')}</Button.Label>
            </Button>
            <Button testID="monitor-end-confirm" variant="danger" isDisabled={!check.valid || ending} onPress={confirm}>
              <Button.Label>
                {ending ? t('features.session-live.endSession.ending') : t('session.actions.endSession.confirm')}
              </Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  buttonWrap: { gap: 4 },
  button: { width: '100%', minHeight: 56, borderRadius: 14, overflow: 'hidden', gap: 10 },
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(palette.foreground, 0.22),
    transformOrigin: 'left',
  },
  label: { fontFamily: fontFamily.native.bold, fontSize: 19, lineHeight: 24, color: derived.dangerForeground },
  hint: { fontFamily: fontFamily.native.normal, fontSize: 12, lineHeight: 16, color: palette.gray, textAlign: 'center' },
  // Tablets: a readable column instead of a full-width sheet of text (the phone is narrower anyway).
  dialog: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  field: { marginTop: spacing[2] },
  textArea: { minHeight: 88 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[1], marginTop: spacing[3] },
});
