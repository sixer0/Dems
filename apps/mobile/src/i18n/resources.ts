/**
 * i18n resource trees (04_mobile_specs §9; SCR-05 asks shared `en` to be a deep-mergeable plain
 * object). A tree is nested plain objects whose leaves are strings.
 */
export interface ResourceTree {
  readonly [key: string]: string | ResourceTree;
}

function isTree(value: unknown): value is ResourceTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges resource trees left to right into a new object; a later tree wins on a clash.
 * Inputs are never mutated. `onOverride` reports each leaf a later tree replaced (dev diagnostics).
 */
export function mergeResources(
  trees: readonly ResourceTree[],
  onOverride?: (path: string) => void,
): ResourceTree {
  const out: Record<string, string | ResourceTree> = {};
  for (const tree of trees) mergeInto(out, tree, '', onOverride);
  return out;
}

function mergeInto(
  target: Record<string, string | ResourceTree>,
  source: ResourceTree,
  prefix: string,
  onOverride?: (path: string) => void,
) {
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const current = target[key];
    if (isTree(value)) {
      const base: Record<string, string | ResourceTree> = isTree(current) ? { ...current } : {};
      if (current !== undefined && !isTree(current)) onOverride?.(path);
      mergeInto(base, value, path, onOverride);
      target[key] = base;
    } else {
      if (current !== undefined) onOverride?.(path);
      target[key] = value;
    }
  }
}
