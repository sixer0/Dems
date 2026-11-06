// Test helpers for CF2-B (RF-T-1): read a list row's host tree the way the native view tree mounts it.
import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

export const flat = (node: ReactTestInstance): ViewStyle => (StyleSheet.flatten(node.props?.style) ?? {}) as ViewStyle;
/** A host component (`View`, `Text`, …): what the native view tree mounts. */
export const isHost = (node: ReactTestInstance | null): boolean => !!node && typeof (node.type as unknown) === 'string';
/** True for a host `Text` node. */
export const isHostText = (node: ReactTestInstance): boolean => (node.type as unknown) === 'Text';

/** The nearest host ancestor of a node (the row's outer `View`, for the pressable). */
export function hostParent(node: ReactTestInstance): ReactTestInstance {
  let current = node.parent;
  while (current && !isHost(current)) current = current.parent;
  if (!current) throw new Error('no host parent');
  return current;
}

/** The host nodes directly under a host node (what the native view tree mounts as its children). */
export function hostChildren(node: ReactTestInstance): ReactTestInstance[] {
  const out: ReactTestInstance[] = [];
  const walk = (children: readonly (ReactTestInstance | string)[]) => {
    for (const child of children) {
      if (typeof child === 'string') continue;
      if (isHost(child)) out.push(child);
      else walk(child.children);
    }
  };
  walk(node.children);
  return out;
}


/** The product of the opacities from the node up to the root. */
export function effectiveOpacity(node: ReactTestInstance): number {
  let opacity = 1;
  let current: ReactTestInstance | null = node;
  while (current) {
    const style = flat(current);
    if (style.display === 'none') return 0;
    if (typeof style.opacity === 'number') opacity *= style.opacity;
    current = current.parent;
  }
  return opacity;
}
