/**
 * Test-only: finds a worklet that CALLS a function which is not a worklet (fix wave J, JM-01).
 *
 * On a device such a call throws on the UI runtime ("[Worklets] Tried to synchronously call a Remote
 * Function"), and one such error stops Reanimated's style loop for the life of the process
 * (`@/motion/ui-runtime-watch`). Jest cannot see it by running the code: here every worklet runs on the one JS
 * runtime, where any function may call any other. But the Worklets Babel plugin runs in Jest too, and what it
 * writes is readable: a workletized function carries `__workletHash`, the values it captured (`__closure`) and
 * its own source (`__initData.code`). So the rule can be checked on the functions themselves:
 *
 *   a function captured by a worklet, that has no `__workletHash`, and that the worklet's source CALLS
 *   (`name(`), is a remote call on the UI runtime - unless it is one of the libraries' own entry points
 *   (`scheduleOnRN`, `withTiming`, ... - plain functions under the Jest mocks, native on a device).
 *
 * A function that is only handed on (`scheduleOnRN(setState, value)`) is not called and is not reported.
 * Captured worklets are followed (a worklet may call a worklet that calls a plain function).
 *
 * `jest.setup.ts` applies this to every worklet the suite hands to Reanimated's hooks, so every render test of
 * the app is also a test of this rule.
 */
interface WorkletLike {
  __workletHash?: number;
  __closure?: Record<string, unknown>;
  __initData?: { code?: string };
  name?: string;
}

const isFunction = (value: unknown): value is ((...args: never[]) => unknown) & WorkletLike => typeof value === 'function';

/** `true` when `code` calls `name` directly: `name(`, `name.call(` or `name.apply(`. */
export function callsDirectly(code: string, name: string): boolean {
  const escaped = name.replace(/[$]/g, '\\$&');
  return new RegExp(`(^|[^.\\w$])${escaped}\\s*(\\(|\\.call\\(|\\.apply\\()`).test(code);
}

/**
 * The captured functions `worklet` (or a worklet it captured) calls although they are not worklets, as
 * `"<worklet> calls <name>"`. `allowed` holds the functions that are fine by identity (library entry points).
 */
export function nonWorkletCallees(worklet: unknown, allowed: ReadonlySet<unknown> = new Set()): string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();
  const visit = (candidate: unknown, label: string): void => {
    if (!isFunction(candidate) || seen.has(candidate)) return;
    seen.add(candidate);
    if (candidate.__workletHash === undefined) return;
    const code = candidate.__initData?.code ?? String(candidate);
    for (const [name, value] of Object.entries(candidate.__closure ?? {})) {
      if (!isFunction(value)) continue;
      if (value.__workletHash !== undefined) {
        visit(value, name);
        continue;
      }
      // A library entry point (by identity), or a Jest mock function a test put in its place.
      if (allowed.has(value) || (value as { _isMockFunction?: boolean })._isMockFunction === true) continue;
      if (callsDirectly(code, name)) found.push(`${label} calls ${name}`);
    }
  };
  visit(worklet, isFunction(worklet) && worklet.name ? worklet.name : 'worklet');
  return found;
}

/** Every function a module exports (one level): the library entry points that are allowed by identity. */
export function exportedFunctionsOf(...modules: readonly unknown[]): Set<unknown> {
  const out = new Set<unknown>();
  for (const module of modules) {
    if (module === null || typeof module !== 'object') continue;
    for (const key of Object.keys(module)) {
      let value: unknown;
      try {
        value = (module as Record<string, unknown>)[key];
      } catch {
        continue;
      }
      if (typeof value === 'function') out.add(value);
      // One level down for namespaces such as `Easing` or `Skia`.
      else if (value !== null && typeof value === 'object') {
        for (const inner of Object.values(value as Record<string, unknown>)) if (typeof inner === 'function') out.add(inner);
      }
    }
  }
  return out;
}
