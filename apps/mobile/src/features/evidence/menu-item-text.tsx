/**
 * The title and, when there is one, the description of a kit `Menu.Item`, stacked in one column
 * (closing-fix CF-M2, defect R-T-1).
 *
 * `Menu.Item` lays its children out in a ROW (`.menu__item { flex-direction: row }`) and the title
 * has `flex: 1` (a zero basis). With a description as a second child, the description takes its full
 * text width and the title is squeezed to nothing: the disabled Archive item of the Evidence More
 * menu showed only "Archiving needs the Supervisor role" (re-test `P07e_evidence_more_menu.png`, the
 * title area flat, no glyph). The kit's documented pattern for an item with a description wraps both
 * in a `flex-1` View (heroui-native `menu.md`, "With Item Descriptions"), as Start Session's profile
 * menu already does (`session-new-header.tsx`). The title keeps the item's variant (danger) through
 * the item's context.
 */
import { Menu } from 'heroui-native';
import { StyleSheet, View } from 'react-native';

export interface MenuItemTextProps {
  title: string;
  /** The reason under the title (a disabled item's hint), or nothing. */
  description?: string | null;
  testID?: string;
}

export function MenuItemText({ title, description, testID }: MenuItemTextProps) {
  return (
    <View style={styles.column} testID={testID}>
      <Menu.ItemTitle>{title}</Menu.ItemTitle>
      {description ? <Menu.ItemDescription>{description}</Menu.ItemDescription> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1 },
});
