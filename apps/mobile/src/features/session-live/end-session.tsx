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
 *
 * Live mode (backend task, row W68; [CS:§8.6] S2-1, §8.1 LB-1, LB-6, LB-10; F59). The Dialog's
 * "End Session" sends `stopSession` to the Core server:
 *
 * | Phase | The Dialog |
 * |---|---|
 * | the press until the Core answered | the confirm ignores presses and is marked busy (`usePendingPress()` from `@/runtime`); after `LIVE_PENDING_REVEAL_MS` on the store's clock it shows the kit's Spinner and "Ending…". "Keep recording" is disabled, and the overlay and Back do not close it (decision D166): a stop that left the device cannot be taken back, and a closed Dialog would hide what the answer means |
 * | 202 | it closes; route-sync follows the Core's STOPPING to `/session/finalizing` |
 * | 422 `INVALID_REASON` | it stays open with the reason; the reason field says the reason is too short (the Core counts characters, the field counts the simulator's code units) |
 * | 403, an outage, a limit, 409 | it stays open with the reason, the confirm idle again; the toast says why (the refusal presenter in LIVE, the step-79 toasts otherwise) |
 *
 * In Simulated mode the stop settles before the press returns: no state is set, nothing waits, and
 * the Dialog looks and behaves exactly as before.
 */
import { Button, Description, Dialog, FieldError, Label, TextArea, TextField } from 'heroui-native';
import { Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type AccessibilityActionEvent, type GestureResponderEvent } from 'react-native';
import { putKeyboardAway } from '@/lib/keyboard';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { derived, fontFamily, motion as motionTokens, palette, spacing } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media/color';
import { triggerHaptic, useMotionPolicy } from '@/motion';
import { PendingSpinner, busyState, usePendingPress } from '@/runtime';
import { HOLD_HAPTIC_BEATS_MS, HOLD_TO_CONFIRM_MS, STOP_REASON_MAX, STOP_REASON_MIN, checkStopReason } from './session-live.math';
import type { MonitorHandlers } from './use-monitor';

/** How long the hold hint stays raised after a short tap (JT-09). */
export const HOLD_NUDGE_MS = 2500;

export interface EndSessionProps {
  disabled: boolean;
  /**
   * Row 139 (D84, D91; C3 §3.1): why the control is disabled, said under it in place of the hold hint and read
   * as its hint. Set while the cameras connect: the Core would refuse the stop (`CAPTURE_NOT_DURABLE`).
   */
  blockedReason?: string | undefined;
  /** Sends `stopRecording(reason)`; the handlers run once the command settled (S2-1). */
  onEnd: (reason: string, handlers: MonitorHandlers) => void;
}

/** The pinned End Session control plus its reason Dialog. */
export function EndSession({ disabled, blockedReason, onEnd }: EndSessionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const blocked = blockedReason !== undefined;
  return (
    <>
      <EndSessionButton disabled={disabled || blocked} blockedReason={blockedReason} dialogOpen={dialogOpen} onConfirmHold={() => setDialogOpen(true)} />
      <EndSessionDialog isOpen={dialogOpen && !blocked} onOpenChange={setDialogOpen} onEnd={onEnd} />
    </>
  );
}

interface EndSessionButtonProps {
  disabled: boolean;
  blockedReason?: string | undefined;
  dialogOpen: boolean;
  onConfirmHold: () => void;
}

function EndSessionButton({ disabled, blockedReason, dialogOpen, onConfirmHold }: EndSessionButtonProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const reduced = policy === 'reduced';
  const fill = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const [nudged, setNudged] = useState(false);
  const nudge = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (nudge.current !== null) clearTimeout(nudge.current);
    },
    [],
  );
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

  // Round two (seen on the tablet under host load: a 1.9 s hold opened nothing). The long-press is a JS timer that
  // starts when the press-in REACHES JS; when the JS thread lags by more than the 0.4 s a finger holds beyond the
  // 1.5 s, the release is handled first and the hold is lost. The touch's own timestamps say how long the finger
  // was down: a release after a full hold completes it.
  const pressedAt = useRef<number | null>(null);
  const onPressIn = (event: GestureResponderEvent) => {
    if (disabled || reduced) return;
    pressedAt.current = event.nativeEvent.timestamp;
    completed.current = false;
    setHolding(true);
    triggerHaptic('holdProgress');
    clearBeat();
    midBeat.current = setTimeout(() => triggerHaptic('holdProgress'), HOLD_HAPTIC_BEATS_MS[1]);
    cancelAnimation(fill);
    fill.set(0);
    fill.set(withTiming(1, { duration: HOLD_TO_CONFIRM_MS, easing: Easing.linear }));
  };

  const onPressOut = (event: GestureResponderEvent) => {
    if (reduced) return;
    setHolding(false);
    clearBeat();
    const heldMs = pressedAt.current === null ? 0 : event.nativeEvent.timestamp - pressedAt.current;
    pressedAt.current = null;
    if (!completed.current && !disabled && heldMs >= HOLD_TO_CONFIRM_MS) {
      triggerHaptic('endSessionHold');
      fill.set(1);
      open();
      return;
    }
    if (!completed.current) {
      cancelAnimation(fill);
      fill.set(withSpring(0, motionTokens.spring.snappy));
    }
  };

  const onLongPress = () => {
    if (disabled || reduced || completed.current) return;
    clearBeat();
    triggerHaptic('endSessionHold');
    fill.set(1);
    open();
  };

  const onPress = () => {
    if (disabled || completed.current) return;
    if (reduced) {
      triggerHaptic('endSessionHold');
      open();
      return;
    }
    // A short tap in full motion: explain the hold instead of ending anything. Round two (JT-09, JA2-N7): the
    // explanation is the line under the button, raised for a moment and announced - no toast any more (it lay
    // over the header, and a toast over a control swallows the next press).
    setNudged(true);
    if (nudge.current !== null) clearTimeout(nudge.current);
    nudge.current = setTimeout(() => setNudged(false), HOLD_NUDGE_MS);
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
        accessibilityHint={blockedReason ?? t('features.session-live.endSession.holdA11yHint')}
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
      {blockedReason !== undefined ? (
        <Text testID="monitor-end-session-blocked" maxFontSizeMultiplier={1.2} accessibilityLiveRegion="polite" style={styles.hint}>
          {blockedReason}
        </Text>
      ) : !reduced ? (
        <Text maxFontSizeMultiplier={1.2} style={[styles.hint, nudged ? styles.hintNudged : null]} testID={nudged ? 'monitor-end-session-hold-nudge' : 'monitor-end-session-hold-hint'} accessibilityLiveRegion={nudged ? 'assertive' : 'none'}>
          {t('session.actions.endSession.holdHint')}
        </Text>
      ) : null}
    </View>
  );
}

interface EndSessionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEnd: EndSessionProps['onEnd'];
}

/** The mandatory-reason Dialog (S21: at least 5 characters after trimming). */
function EndSessionDialog({ isOpen, onOpenChange, onEnd }: EndSessionDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  /** The trimmed reason the Core refused (422 `INVALID_REASON`); editing it clears the error. */
  const [refusedReason, setRefusedReason] = useState<string | null>(null);
  const press = usePendingPress();
  const keyboardHeight = useKeyboardState((s) => (s.isVisible ? s.height : 0));
  const check = checkStopReason(reason);
  const refusedByCore = refusedReason !== null && refusedReason === check.value;
  const showError = (touched && !check.valid) || refusedByCore;

  const close = () => {
    onOpenChange(false);
    setTouched(false);
    setRefusedReason(null);
  };
  // While the stop is out the Dialog stays: the answer decides (the table in this file's header).
  const dismiss = () => {
    if (!press.busy) close();
  };

  const confirm = () => {
    setTouched(true);
    if (!check.valid) return;
    // JT-23 / JM-04: the reason is given - the keyboard goes (on the phone it covered Finalizing for the whole seal).
    putKeyboardAway();
    const sent = check.value;
    press.run((release) =>
      onEnd(sent, {
        ok: () => {
          setReason('');
          close();
        },
        refused: (why) => {
          if (why === 'reason') setRefusedReason(sent);
        },
        done: release,
      }),
    );
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => (open ? onOpenChange(true) : dismiss())}>
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
                // Round two (JA2-36): the reason is taken as typed - the keyboard's autocorrect rewrote it ("abc" -> "ABC").
                autoCorrect={false}
                autoCapitalize="sentences"
                numberOfLines={3}
                style={styles.textArea}
              />
              {showError ? (
                <FieldError testID={refusedByCore ? 'monitor-end-reason-refused' : 'monitor-end-reason-error'}>
                  {t('session.actions.endSession.reasonTooShort', { min: STOP_REASON_MIN })}
                </FieldError>
              ) : (
                <Description testID="monitor-end-reason-count">
                  {/* JA2-36: the rule is said BEFORE the button stays grey - "at least 5 characters". */}
                  {check.valid
                    ? t('features.session-live.endSession.reasonCount', { count: check.length, max: STOP_REASON_MAX })
                    : `${t('features.session-live.endSession.reasonRule', { min: STOP_REASON_MIN })} ${t('features.session-live.endSession.reasonCount', { count: check.length, max: STOP_REASON_MAX })}`}
                </Description>
              )}
            </TextField>
          </View>
          <View style={styles.actions}>
            <Button testID="monitor-end-keep" variant="outline" isDisabled={press.busy} onPress={dismiss}>
              <Button.Label>{t('session.actions.endSession.keepRecording')}</Button.Label>
            </Button>
            <Button testID="monitor-end-confirm" variant="danger" isDisabled={!check.valid} onPress={confirm} accessibilityLabel={press.pending ? t('features.session-live.endSession.ending') : t('session.actions.endSession.confirm')} {...busyState(press.busy, !check.valid)}>
              {press.pending ? <PendingSpinner color={derived.dangerForeground} testID="monitor-end-confirm-spinner" /> : null}
              <Button.Label>
                {press.pending ? t('features.session-live.endSession.ending') : t('session.actions.endSession.confirm')}
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
  hintNudged: { fontFamily: fontFamily.native.bold, color: palette.gold },
  // Tablets: a readable column instead of a full-width sheet of text (the phone is narrower anyway).
  dialog: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  field: { marginTop: spacing[2] },
  textArea: { minHeight: 88 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[1], marginTop: spacing[3] },
});
