/**
 * The selection glow (e2) of a list row on tablets: Evidence rows, Sessions hub rows, Audit rows and
 * Devices rows (04 §4.10 "Tablet", §2.4). Post-review fix FXR-M (findings W93-2, W93-4, W93-24) moved it
 * from `features/evidence` to the composed kit, since four features use it.
 *
 * Closing-fix row CF2-B, defect RF-T-1 (decision D227): the row used to mount `GlowLayer` (three
 * Reanimated views) as its first child only while it was selected. On the tablet the row that LOST
 * the selection was then drawn as an empty card and stayed empty (3/3 in the final re-test, and the
 * same in the Sessions hub before this fix): the card kept its frame, its content was never drawn
 * again. The structural change inside a FlashList cell, with Reanimated-tracked views removed in place,
 * is the trigger (the device drops Reanimated updates, FX-M2b's lesson D208).
 *
 * So this layer is ALWAYS mounted, in every selection state, as the row's LAST child (the content keeps
 * index 0), and it is a plain `View` whose state React draws: the e2 `boxShadow` at opacity 1 while
 * selected, opacity 0 otherwise. A selection change is a prop update of this one view; nothing is
 * mounted or removed inside the row, and no animation is involved, so a lost animation update cannot
 * leave a wrong state. An outset `boxShadow` is drawn outside the border box only (Android clips the
 * border box out, `OutsetBoxShadowDrawable`), so the layer on top never covers the content; it ignores
 * touches and is hidden from TalkBack. The 240 ms cross-fade of `GlowLayer` is not used here: the
 * selection glow changes at once (decision recorded in CF2-B's report).
 */
import { StyleSheet, View } from 'react-native';
import { glowShadow } from '@/motion';

export interface SelectionGlowProps {
  selected: boolean;
  /** Corner radius of the row card, px. */
  radius: number;
  testID?: string;
}

/**
 * The row card's border in BOTH selection states; the selected state changes only `borderColor` (gold).
 * CF2-B's first device run with the always-mounted glow alone still showed the empty card: the old card
 * also went from `borderWidth: 1` (selected) to no border (deselected). On the kit `Card` (a `Surface`:
 * `overflow: hidden`, a corner radius and a `boxShadow`) that changes the border insets, the content's
 * layout (1 dp) and the padding-box clip of the children on deselection. With the border kept, a selection
 * change is a colour change of the border and of the glow, nothing else.
 */
export const ROW_CARD_BORDER = { borderWidth: 1, borderColor: 'transparent' } as const;

/** The glow's opacity for a selection state; React sets it, nothing animates it. */
export const selectionGlowOpacity = (selected: boolean): number => (selected ? 1 : 0);

export function SelectionGlow({ selected, radius, testID }: SelectionGlowProps) {
  return (
    <View
      pointerEvents="none"
      collapsable={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: glowShadow(2), opacity: selectionGlowOpacity(selected) }]}
    />
  );
}
