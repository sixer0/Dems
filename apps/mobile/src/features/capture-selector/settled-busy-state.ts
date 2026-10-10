/**
 * The accessibility state of a control that STAYS on screen after its command ended (fix wave H, gate
 * 70 finding G70-04). Unlike the runtime's `busyState` it always names `busy`: React Native on
 * Android recomputes a view's content description - where ", busy" is appended to the label - only
 * when the new state holds that key (`BaseViewManager.setViewState`, RN 0.86), so a control that
 * went back to "nothing" kept reading "..., busy" after the answer was drawn. Give such a control an
 * `accessibilityLabel` too: without one the description is never rewritten.
 */
export function settledBusyState(busy: boolean, disabled = false): { accessibilityState: { busy: boolean; disabled: boolean } } {
  return { accessibilityState: { busy, disabled } };
}
