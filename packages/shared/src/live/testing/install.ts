/**
 * The opt-in for code that cannot take its transport by injection (HB-11): puts the fake `fetch`
 * and the fake socket constructor where a runtime keeps its own, and puts back what was there.
 *
 * A fake transport touches no global by itself. A test that passes `fake.fetch` and
 * `fake.socketFactory` to its clients needs nothing from this file. Some screen tests render a
 * tree that creates its clients itself; those call `installFakeTransport(fake)` before the render
 * and the function it returns afterwards:
 *
 * ```ts
 * const restore = installFakeTransport(fake);
 * try {
 *   // render, act, assert
 * } finally {
 *   restore();
 * }
 * ```
 *
 * The names are replaced on the object given (the global object by default) for the time between
 * the two calls only. Installing twice on one object without restoring is refused.
 */
import { FakeTransportUsageError } from './errors';
import type { FakeFetch } from './http';
import type { FakeWebSocketConstructor } from './socket';

const NAMES = ['fetch', 'WebSocket'] as const;
const installed = new WeakSet<object>();

export interface FakeTransportGlobals {
  readonly fetch: FakeFetch;
  readonly WebSocket: FakeWebSocketConstructor;
}

/** Installs `fake.fetch` and `fake.WebSocket` on `target` and returns the function that restores what was there. */
export function installFakeTransport(fake: FakeTransportGlobals, target: object = globalThis): () => void {
  if (installed.has(target)) {
    throw new FakeTransportUsageError('a fake transport is already installed on this object; call the restore function of the first one');
  }
  const before = NAMES.map((name) => ({ name, descriptor: Object.getOwnPropertyDescriptor(target, name) }));
  for (const name of NAMES) {
    Object.defineProperty(target, name, { value: fake[name], configurable: true, writable: true, enumerable: true });
  }
  installed.add(target);
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const { name, descriptor } of before) {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else delete (target as Record<string, unknown>)[name];
    }
    installed.delete(target);
  };
}
