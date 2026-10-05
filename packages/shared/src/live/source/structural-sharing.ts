/**
 * Structural sharing for the replica (HB-14; backend task 04_client_integration_spec §2.3 CL-13;
 * assumption CA-04).
 *
 * A snapshot and a `replace` operation arrive as freshly parsed JSON: every object in them is new,
 * also where nothing changed. Putting them into the store as they are would change every
 * reference, so every selector would run again and every list would render again. `shareStructure`
 * rebuilds the incoming value out of the parts of the previous one wherever the two are deeply
 * equal:
 *
 * | Incoming value | Result |
 * |----------------|--------|
 * | Deeply equal to the previous one | The previous value itself |
 * | An object with some equal members | A new object; each equal member is the previous reference |
 * | An array | A new array; an element keeps its previous reference when it is deeply equal to the previous element at the same index, or, for elements with a string `id`, to the previous element with that `id` (so a ring that moved by one row keeps its rows) |
 * | Anything else (a primitive, another type) | The incoming value |
 *
 * The values are the JSON of the contract's slices: plain objects, arrays, strings, numbers,
 * booleans and null. The function is the default of `createLiveSim`; a client may inject its own
 * (the `replaceEqualDeep` of its query library has the same signature, CA-04).
 *
 * Pure, framework-free, no import.
 */

/** Returns `next`, built from the parts of `previous` wherever the two are deeply equal. */
export type StructuralSharing = <T>(previous: unknown, next: T) => T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function idOf(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

function shareArray(previous: readonly unknown[], next: readonly unknown[]): unknown {
  /** The previous elements by their `id`, built only when an element is not found at its own index. */
  let byId: Map<string, unknown> | null = null;
  const lookup = (id: string): unknown => {
    if (byId === null) {
      byId = new Map();
      for (const element of previous) {
        const key = idOf(element);
        if (key !== null && !byId.has(key)) byId.set(key, element);
      }
    }
    return byId.get(id);
  };

  let same = previous.length === next.length;
  const result = next.map((element, index) => {
    const before = previous[index];
    let shared = index < previous.length ? shareStructure(before, element) : element;
    if (index >= previous.length || shared !== before) {
      const id = idOf(element);
      const candidate = id === null ? undefined : lookup(id);
      if (candidate !== undefined && candidate !== before) {
        const moved = shareStructure(candidate, element);
        if (moved === candidate) shared = moved;
      }
    }
    if (shared !== before) same = false;
    return shared;
  });
  return same ? previous : result;
}

function shareObject(previous: Readonly<Record<string, unknown>>, next: Readonly<Record<string, unknown>>): unknown {
  const keys = Object.keys(next);
  let same = keys.length === Object.keys(previous).length;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const before = Object.prototype.hasOwnProperty.call(previous, key) ? previous[key] : undefined;
    const shared = shareStructure(before, next[key]);
    result[key] = shared;
    if (shared !== before || !Object.prototype.hasOwnProperty.call(previous, key)) same = false;
  }
  return same ? previous : result;
}

export const shareStructure: StructuralSharing = <T>(previous: unknown, next: T): T => {
  if (Object.is(previous, next)) return next;
  if (Array.isArray(previous) && Array.isArray(next)) return shareArray(previous, next) as T;
  if (isPlainObject(previous) && isPlainObject(next)) return shareObject(previous, next) as T;
  return next;
};
