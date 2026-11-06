/**
 * The resource shape shared by web and mobile: plain nested objects whose leaves are
 * strings (i18next "JSON v4": `{{name}}` interpolation, `_one` / `_other` plural suffixes).
 * No arrays, functions or class instances, so a tree survives JSON and structured cloning
 * and can be deep-merged with an app-specific namespace (SCR-05).
 */

export interface ResourceTree {
  readonly [key: string]: string | ResourceTree;
}

/** Type of `mergeResources(a, b)`: B's leaves win; nested trees merge key by key. */
export type MergedResources<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? K extends keyof A
      ? A[K] extends ResourceTree
        ? B[K] extends ResourceTree
          ? MergedResources<A[K], B[K]>
          : B[K]
        : B[K]
      : B[K]
    : K extends keyof A
      ? A[K]
      : never;
};

interface MutableTree {
  [key: string]: string | MutableTree;
}

/** Keys that could reach `Object.prototype` if copied with plain assignment. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function cloneTree(tree: ResourceTree): MutableTree {
  const out: MutableTree = {};
  for (const [key, value] of Object.entries(tree)) {
    if (UNSAFE_KEYS.has(key)) continue;
    out[key] = typeof value === 'string' ? value : cloneTree(value);
  }
  return out;
}

function mergeInto(target: MutableTree, overlay: ResourceTree): void {
  for (const [key, value] of Object.entries(overlay)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const current = target[key];
    if (typeof value === 'string') {
      target[key] = value;
    } else if (current !== undefined && typeof current !== 'string') {
      mergeInto(current, value);
    } else {
      target[key] = cloneTree(value);
    }
  }
}

/**
 * Deep-merges two resource trees into a **new** tree. Neither input is modified and the
 * result shares no objects with them, so it is safe to hand to i18next (whose
 * `addResourceBundle(…, deep = true)` extends the stored object in place).
 *
 * @example
 * import { en, mergeResources } from '@dems/shared/i18n';
 * const resources = { en: { translation: mergeResources(en, enMobile) } };
 */
export function mergeResources<A extends ResourceTree, B extends ResourceTree>(
  base: A,
  overlay: B,
): MergedResources<A, B> {
  const out = cloneTree(base);
  mergeInto(out, overlay);
  return out as unknown as MergedResources<A, B>;
}
