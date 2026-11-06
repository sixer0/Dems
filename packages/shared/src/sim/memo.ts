/**
 * Referential stability helpers for selectors (step 54, review 40 M1).
 *
 * `useSim` compares a selector's result shallowly. A selector that builds a fresh array or object
 * of fresh objects on every call (`selectSystemState`'s flags) never compares equal, so React
 * re-renders, and `useSyncExternalStore` loops. These helpers return the previous result when
 * the inputs are the same references (single-entry memo) or when the recomputed value deep-equals
 * the previous one (structural sharing). Correct across several sim instances: a cached result is
 * reused only for identical inputs or for an equal value.
 */

/** Deep equality for plain JSON data (numbers, strings, booleans, null, arrays, plain objects). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) if (!deepEqual(a[index], b[index])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(right, key) || !deepEqual(left[key], right[key])) return false;
  }
  return true;
}

function sameRefs(a: readonly unknown[] | null, b: readonly unknown[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (!Object.is(a[index], b[index])) return false;
  return true;
}

/**
 * A stable selector: `compute(state)` runs only when `deps(state)` changed (by reference), and a
 * recomputed result that deep-equals the previous one is replaced by the previous object.
 */
export function stableSelector<S, T>(deps: (state: S) => readonly unknown[], compute: (state: S) => T): (state: S) => T {
  let lastDeps: readonly unknown[] | null = null;
  let lastResult: T | undefined;
  let has = false;
  return (state: S): T => {
    const nextDeps = deps(state);
    if (has && sameRefs(lastDeps, nextDeps)) return lastResult as T;
    const next = compute(state);
    lastDeps = nextDeps;
    if (has && deepEqual(lastResult, next)) return lastResult as T;
    lastResult = next;
    has = true;
    return next;
  };
}

/** Like `stableSelector`, keyed by an extra argument (one cache entry per key). */
export function stableSelectorBy<S, K, T>(
  deps: (state: S, key: K) => readonly unknown[],
  compute: (state: S, key: K) => T,
): (state: S, key: K) => T {
  const cache = new Map<K, (state: S) => T>();
  return (state: S, key: K): T => {
    let selector = cache.get(key);
    if (!selector) {
      selector = stableSelector<S, T>(
        (s) => deps(s, key),
        (s) => compute(s, key),
      );
      cache.set(key, selector);
    }
    return selector(state);
  };
}
