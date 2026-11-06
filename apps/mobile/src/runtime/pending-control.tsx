/**
 * The look of a pending control (backend task 04_client_integration_spec §8.1 LB-1; AC-C-57, AC-C-58):
 * the visual half of `usePendingPress` (`use-pending-press.ts`). Row M1's follow-up (decision D164)
 * moved the two copies here — Start Session's (`features/session-new/session-new-screen.tsx`, row W67)
 * and Devices' (`features/devices/busy-state.ts` and its inline spinners, row W78) — so every mobile
 * page row takes them from `@/runtime` with the hook.
 *
 * | Piece | When | What it adds |
 * |---|---|---|
 * | `busyState(press.busy, disabled?)` | from the press until the command settled | `accessibilityState: { busy: true, disabled }` ("the control is marked busy"); while idle `{ busy: false }` STATED (below) |
 * | `<PendingSpinner />` | while `press.pending` (the reveal delay passed on the store's clock) | the kit's own `Spinner` (`size="sm"`) inside the control, in place of its icon, so nothing moves |
 *
 * ```tsx
 * const press = usePendingPress();
 * <Button onPress={onPress} {...busyState(press.busy)}>
 *   {press.pending ? <PendingSpinner color={palette.gold} testID="…-spinner" /> : <Icon />}
 *   <Button.Label>…</Button.Label>
 * </Button>
 * ```
 *
 * Why here and not in `components/kit`: the kit is the fixed recipe set of 04_mobile_specs §4.0
 * ("tokens and className on HeroUI Native parts, not new primitives", D6; unchanged since the demo
 * task, its test one of the 72 baseline files), while this pair is the presentation of a runtime
 * rule (LB-1) that is only ever used together with `usePendingPress`. Pure presentation: no state, no
 * clock, no timer.
 */
import { Spinner } from 'heroui-native';

/**
 * The accessibility state of a control that can send a command: `busy: true` while the command is
 * out, `busy: false` once it is not.
 *
 * WHY THE IDLE STATE IS STATED (wave H closing pass Z2; gate 70 finding G70-04, seen again at gates 75
 * and 81; the app-wide cause named by drivers B and D). This function used to return `{}` while idle.
 * React Native on Android recomputes a view's content description - where ", busy" is appended to
 * the label - only when the NEW state holds the key `busy` (`BaseViewManager.setViewState`), so a
 * control that went from `{ busy: true }` back to no state kept announcing "busy" after its action
 * had ended. With `busy: false` the description is rewritten. A control that takes this state must
 * also carry an `accessibilityLabel` (or readable text children): Android skips the rewrite for a
 * view without a description.
 *
 * `disabled`: stated when the caller gives it. Not given while idle: the key is left out, so the
 * kit's own `disabled` (from `isDisabled`, merged by the pressable) is not overwritten by a guess.
 */
export function busyState(busy: boolean, disabled?: boolean): { accessibilityState: { busy: boolean; disabled?: boolean } } {
  if (busy) return { accessibilityState: { busy: true, disabled: disabled ?? false } };
  return { accessibilityState: disabled === undefined ? { busy: false } : { busy: false, disabled } };
}

export interface PendingSpinnerProps {
  /** The colour on the control's surface (for example `palette.black` on a gold button); the kit's default when omitted. */
  color?: string;
  testID?: string;
}

/** The kit's `Spinner` inside a control whose command has been out for `LIVE_PENDING_REVEAL_MS` or longer. */
export function PendingSpinner({ color, testID }: PendingSpinnerProps) {
  return <Spinner size="sm" {...(color === undefined ? {} : { color })} {...(testID === undefined ? {} : { testID })} />;
}
